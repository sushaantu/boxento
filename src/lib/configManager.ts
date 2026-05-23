/**
 * Configuration Manager for Boxento widgets
 *
 * Handles storing and retrieving widget configurations using the storage provider abstraction.
 * Supports localStorage, Firebase, and SQLite backends transparently.
 */

import { encryptionUtils } from './encryption';
import { getStorageProvider } from './storage';

/**
 * Interface for the widget configuration store
 */
export interface WidgetConfigStore {
  [widgetId: string]: Record<string, unknown>;
}

/**
 * Default sensitive fields that should be encrypted
 */
const DEFAULT_SENSITIVE_FIELDS = ['apiKey', 'token', 'secret', 'password', 'key'];

/**
 * Configuration Manager
 * Provides methods to save, retrieve, and manage widget configurations
 */
export const configManager = {
  /**
   * Save a widget's configuration using the current storage provider
   *
   * @param widgetId - Unique identifier for the widget
   * @param config - Configuration object to save
   * @param sensitiveFields - Optional array of field names that should be encrypted
   */
  saveWidgetConfig: async (widgetId: string, config: Record<string, unknown>, sensitiveFields = DEFAULT_SENSITIVE_FIELDS): Promise<void> => {
    try {
      // Process sensitive fields (like API keys) for encryption
      const processedConfig = await encryptionUtils.processObjectForStorage(config, sensitiveFields);

      // Use the current storage provider
      const provider = getStorageProvider();
      await provider.saveWidgetConfig(widgetId, processedConfig);
    } catch (e) {
      console.error('Error saving widget configuration', e);
    }
  },

  /**
   * Retrieve a widget's configuration from the current storage provider
   *
   * @param widgetId - Unique identifier for the widget
   * @param sensitiveFields - Optional array of field names that should be decrypted
   * @returns The widget's configuration or null if not found
   */
  getWidgetConfig: async (widgetId: string, sensitiveFields = DEFAULT_SENSITIVE_FIELDS): Promise<Record<string, unknown> | null> => {
    try {
      // Use the current storage provider
      const provider = getStorageProvider();
      const config = await provider.getWidgetConfig(widgetId);

      if (!config) return null;

      // Process and decrypt any sensitive fields
      const decryptedConfig = await encryptionUtils.processObjectFromStorage(config, sensitiveFields);

      // Restore Date objects for TodoWidget and other widgets
      return configManager.restoreDates(decryptedConfig);
    } catch (e) {
      console.error('Error getting widget configuration', e);
      return null;
    }
  },

  /**
   * Get all stored widget configurations
   *
   * @param decryptSensitiveFields - Whether to decrypt sensitive fields in all configs
   * @returns Object containing all widget configurations
   */
  getConfigs: async (decryptSensitiveFields = false): Promise<WidgetConfigStore> => {
    try {
      // Use the current storage provider
      const provider = getStorageProvider();
      const configs = await provider.getAllWidgetConfigs();

      if (!decryptSensitiveFields) return configs;

      // Decrypt sensitive fields if requested
      const decryptedConfigs: WidgetConfigStore = {};

      for (const widgetId of Object.keys(configs)) {
        try {
          const decryptedConfig = await encryptionUtils.processObjectFromStorage(
            configs[widgetId],
            DEFAULT_SENSITIVE_FIELDS
          );

          // Restore Date objects
          decryptedConfigs[widgetId] = configManager.restoreDates(decryptedConfig);
        } catch (error) {
          console.warn(`Skipping undecryptable sensitive fields for widget config "${widgetId}"`, error);

          const fallbackConfig = { ...configs[widgetId] };
          for (const field of DEFAULT_SENSITIVE_FIELDS) {
            if (typeof fallbackConfig[field] === 'string' && (fallbackConfig[field] as string).startsWith('enc:v1:')) {
              delete fallbackConfig[field];
            }
          }

          decryptedConfigs[widgetId] = configManager.restoreDates(fallbackConfig);
        }
      }

      return decryptedConfigs;
    } catch (e) {
      console.error('Error loading widget configurations', e);
      return {};
    }
  },

  /**
   * Get configs from localStorage (helper method for backward compatibility)
   */
  getConfigsFromLocalStorage: (): WidgetConfigStore => {
    try {
      const stored = localStorage.getItem('boxento-widget-configs');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error('Error parsing localStorage configs', e);
      return {};
    }
  },

  /**
   * Clear a widget's configuration from storage
   *
   * @param widgetId - Unique identifier for the widget to clear
   */
  clearConfig: async (widgetId: string): Promise<void> => {
    try {
      // Use the current storage provider
      const provider = getStorageProvider();
      await provider.deleteWidgetConfig(widgetId);
    } catch (e) {
      console.error('Error clearing widget configuration', e);
    }
  },

  /**
   * Clear all widget configurations from storage
   */
  clearAllConfigs: async (): Promise<void> => {
    try {
      // Use the current storage provider
      const provider = getStorageProvider();
      const configs = await provider.getAllWidgetConfigs();

      // Delete each config
      for (const widgetId of Object.keys(configs)) {
        await provider.deleteWidgetConfig(widgetId);
      }
    } catch (e) {
      console.error('Error clearing all widget configurations', e);
    }
  },

  /**
   * Migrate all stored configs to use proper encryption
   * Call this on app startup to upgrade legacy Base64 encoded data
   */
  migrateToSecureEncryption: async (): Promise<void> => {
    try {
      // Use the current storage provider
      const provider = getStorageProvider();
      const configs = await provider.getAllWidgetConfigs();

      if (Object.keys(configs).length === 0) return;

      let needsSave = false;

      for (const widgetId of Object.keys(configs)) {
        const config = configs[widgetId];

        for (const field of DEFAULT_SENSITIVE_FIELDS) {
          if (config[field] && typeof config[field] === 'string') {
            const value = config[field] as string;
            // Check if it needs migration (not already encrypted with new format)
            if (!value.startsWith('enc:v1:')) {
              const migratedValue = await encryptionUtils.migrateValue(value);
              if (migratedValue !== value) {
                config[field] = migratedValue;
                needsSave = true;
              }
            }
          }
        }
      }

      if (needsSave) {
        await provider.saveAllWidgetConfigs(configs);
      }
    } catch (e) {
      console.error('Error migrating to secure encryption', e);
    }
  },

  /**
   * Helper method to restore Date objects in a configuration object
   * Looks for objects with date-like string properties and converts them to Date objects
   *
   * @param config - Configuration object to process
   * @returns Processed configuration with restored Date objects
   */
  restoreDates: (config: Record<string, unknown>): Record<string, unknown> => {
    // Helper function to check if a string is a valid ISO date format
    const isISODateString = (str: string): boolean => {
      const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z$/;
      return isoDatePattern.test(str);
    };

    // Helper function to recursively process objects
    const processObject = (obj: unknown): unknown => {
      if (obj === null || obj === undefined) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => processObject(item));
      }

      if (typeof obj === 'object') {
        // Type guard to ensure obj is a Record<string, unknown>
        const objRecord = obj as Record<string, unknown>;

        // Handle objects with special date properties
        if (
          objRecord.createdAt &&
          typeof objRecord.createdAt === 'string' &&
          isISODateString(objRecord.createdAt)
        ) {
          return {
            ...objRecord,
            createdAt: new Date(objRecord.createdAt)
          };
        }

        // Process all properties of the object
        const result: Record<string, unknown> = {};
        for (const key in objRecord) {
          if (Object.prototype.hasOwnProperty.call(objRecord, key)) {
            result[key] = processObject(objRecord[key]);
          }
        }
        return result;
      }

      return obj;
    };

    return processObject(config) as Record<string, unknown>;
  }
};
