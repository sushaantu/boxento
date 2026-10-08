/**
 * Encryption utilities for Boxento
 *
 * Uses Web Crypto API with AES-GCM for secure encryption of sensitive data.
 * This provides authenticated encryption with proper key derivation.
 *
 * Key Strategy:
 * - When user is logged in: key derived from user UID (consistent across devices)
 * - When user is logged out: device-specific key (localStorage only, no sync needed)
 */

// Constants for encryption
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for GCM
const SALT_LENGTH = 16;
const ITERATIONS = 100000; // PBKDF2 iterations

// Prefix to identify encrypted values (vs legacy Base64)
const ENCRYPTED_PREFIX = 'enc:v1:';
const LEGACY_PREFIX_CHECK = /^[A-Za-z0-9+/]+=*$/; // Base64 pattern

// Module-level state for user key
let currentUserKey: string | null = null;

/**
 * Set the current user's key for encryption.
 * Call this when user logs in (with user.uid) or logs out (with null).
 *
 * @param userId - The user's UID from Firebase Auth, or null when logged out
 */
export const setUserKey = (userId: string | null): void => {
  currentUserKey = userId;
};

/**
 * Get the current user key (for testing/debugging)
 */
export const getUserKey = (): string | null => currentUserKey;

/**
 * Get or create a device-specific encryption key stored in localStorage.
 * This key is unique per browser/device and persists across sessions.
 * Only used when user is NOT logged in.
 */
const getDeviceKey = (): string => {
  const DEVICE_KEY_STORAGE = 'boxento-device-key';
  let deviceKey = localStorage.getItem(DEVICE_KEY_STORAGE);

  if (!deviceKey) {
    // Generate a random device key
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    deviceKey = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_KEY_STORAGE, deviceKey);
  }

  return deviceKey;
};

/**
 * Get the encryption key to use.
 * - If user is logged in: returns user UID (consistent across devices)
 * - If user is logged out: returns device key (local only)
 */
const getEncryptionKey = (): string => {
  if (currentUserKey) {
    // User is logged in - use their UID for cross-device consistency
    // Add a prefix to distinguish from device keys
    return `user:${currentUserKey}`;
  }
  // User is logged out - use device key (localStorage only anyway)
  return `device:${getDeviceKey()}`;
};

/**
 * Derive an encryption key from a password using PBKDF2
 */
const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import the password as a key
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive the actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Convert ArrayBuffer to Base64 string
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Convert Base64 string to ArrayBuffer
 */
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Check if a string looks like it was encrypted with the legacy Base64 method
 */
const isLegacyEncrypted = (text: string): boolean => {
  if (!text || text.startsWith(ENCRYPTED_PREFIX)) {
    return false;
  }
  // Check if it looks like Base64 and can be decoded to valid UTF-8
  if (LEGACY_PREFIX_CHECK.test(text)) {
    try {
      const decoded = atob(text);
      // Check if decoded text looks like valid content (not binary garbage)
      // Valid API keys/tokens typically contain alphanumeric chars and some symbols
      return /^[\x20-\x7E]+$/.test(decoded);
    } catch {
      return false;
    }
  }
  return false;
};

/**
 * Decrypt legacy Base64 "encrypted" data
 */
const decryptLegacy = (text: string): string => {
  try {
    return atob(text);
  } catch {
    return text;
  }
};

export const encryptionUtils = {
  /**
   * Encrypt a string using AES-GCM
   *
   * @param text - Text to encrypt
   * @returns Promise<string> - Encrypted text with prefix, salt, and IV
   */
  encrypt: async (text: string): Promise<string> => {
    if (!text) return '';

    try {
      const encryptionKey = getEncryptionKey();

      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

      // Derive the encryption key
      const key = await deriveKey(encryptionKey, salt);

      // Encrypt the text
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(text);

      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) },
        key,
        dataBuffer
      );

      // Combine salt + iv + encrypted data
      const combined = new Uint8Array(salt.length + iv.length + encryptedBuffer.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encryptedBuffer), salt.length + iv.length);

      // Return with prefix to identify as encrypted
      return ENCRYPTED_PREFIX + arrayBufferToBase64(combined.buffer);
    } catch (e) {
      // Re-throw to allow proper error handling upstream
      // Silent failures can cause data loss
      throw new Error(`Encryption failed: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
  },

  /**
   * Decrypt a string that was encrypted with the encrypt method
   * Also handles legacy Base64 "encrypted" data for migration
   *
   * @param encryptedText - Text to decrypt
   * @returns Promise<string> - Decrypted text
   */
  decrypt: async (encryptedText: string): Promise<string> => {
    if (!encryptedText) return '';

    try {
      // Handle legacy Base64 "encryption" for migration
      if (isLegacyEncrypted(encryptedText)) {
        return decryptLegacy(encryptedText);
      }

      // Check for our encryption prefix
      if (!encryptedText.startsWith(ENCRYPTED_PREFIX)) {
        // Not encrypted, return as-is
        return encryptedText;
      }

      const encryptionKey = getEncryptionKey();

      // Remove prefix and decode
      const data = encryptedText.slice(ENCRYPTED_PREFIX.length);
      const combined = new Uint8Array(base64ToArrayBuffer(data));

      // Extract salt, IV, and encrypted data
      const salt = combined.slice(0, SALT_LENGTH);
      const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const encryptedData = combined.slice(SALT_LENGTH + IV_LENGTH);

      // Derive the key
      const key = await deriveKey(encryptionKey, salt);

      // Decrypt
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) },
        key,
        encryptedData.buffer.slice(encryptedData.byteOffset, encryptedData.byteOffset + encryptedData.byteLength)
      );

      // Decode and return
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (e) {
      // Re-throw to allow proper error handling upstream
      // Silent failures can mask data corruption or key mismatches
      throw new Error(`Decryption failed: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
  },

  /**
   * Synchronous encrypt for backward compatibility during migration
   * Uses a simple marker that will be handled by async code later
   *
   * @deprecated Use encrypt() async version instead
   */
  encryptSync: (text: string): string => {
    if (!text) return '';
    // For sync contexts, we still need to return something
    // This returns a marker that will be replaced by async encryption
    return `__PENDING_ENCRYPT__${text}`;
  },

  /**
   * Synchronous decrypt for backward compatibility
   * Handles legacy Base64 data and pending encryption markers
   *
   * @deprecated Use decrypt() async version instead
   */
  decryptSync: (encryptedText: string): string => {
    if (!encryptedText) return '';

    // Handle pending encryption marker
    if (encryptedText.startsWith('__PENDING_ENCRYPT__')) {
      return encryptedText.slice('__PENDING_ENCRYPT__'.length);
    }

    // Handle legacy Base64
    if (isLegacyEncrypted(encryptedText)) {
      return decryptLegacy(encryptedText);
    }

    // For properly encrypted data, we can't decrypt synchronously
    // Return the encrypted text and let async code handle it
    if (encryptedText.startsWith(ENCRYPTED_PREFIX)) {
      console.warn('Attempted sync decryption of async-encrypted data. Use decrypt() instead.');
      return encryptedText;
    }

    return encryptedText;
  },

  /**
   * Process an object, encrypting any sensitive fields (async version)
   *
   * @param obj - Object to process
   * @param sensitiveFields - Array of field names that should be encrypted
   * @returns Promise<object> - Processed object with encrypted sensitive fields
   */
  processObjectForStorage: async (
    obj: Record<string, unknown>,
    sensitiveFields: string[] = ['apiKey', 'token', 'secret', 'password', 'key']
  ): Promise<Record<string, unknown>> => {
    if (!obj || typeof obj !== 'object') return obj;

    const result = { ...obj };

    for (const field of sensitiveFields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = await encryptionUtils.encrypt(result[field] as string);
      }
    }

    return result;
  },

  /**
   * Process an object, decrypting any sensitive fields (async version)
   *
   * @param obj - Object to process
   * @param sensitiveFields - Array of field names that should be decrypted
   * @returns Promise<object> - Processed object with decrypted sensitive fields
   */
  processObjectFromStorage: async (
    obj: Record<string, unknown>,
    sensitiveFields: string[] = ['apiKey', 'token', 'secret', 'password', 'key']
  ): Promise<Record<string, unknown>> => {
    if (!obj || typeof obj !== 'object') return obj;

    const result = { ...obj };

    for (const field of sensitiveFields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = await encryptionUtils.decrypt(result[field] as string);
      }
    }

    return result;
  },

  /**
   * Check if Web Crypto API is available
   */
  isSupported: (): boolean => {
    return typeof crypto !== 'undefined' &&
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.getRandomValues === 'function';
  },

  /**
   * Migrate a value from legacy Base64 to proper encryption
   *
   * @param value - Potentially legacy encrypted value
   * @returns Promise<string> - Properly encrypted value
   */
  migrateValue: async (value: string): Promise<string> => {
    if (!value) return '';

    // Already properly encrypted
    if (value.startsWith(ENCRYPTED_PREFIX)) {
      return value;
    }

    // Decrypt legacy and re-encrypt properly
    if (isLegacyEncrypted(value)) {
      const decrypted = decryptLegacy(value);
      return encryptionUtils.encrypt(decrypted);
    }

    // Plain text, encrypt it
    return encryptionUtils.encrypt(value);
  }
};
