import type {
  HomeAssistantArea,
  HomeAssistantConnectionConfig,
  HomeAssistantDevice,
  HomeAssistantEntityRegistryEntry,
  HomeAssistantSnapshot,
  HomeAssistantState,
} from './types';
import { buildHomeAssistantEntities } from './utils';

type RegistryResults = {
  areas: HomeAssistantArea[];
  devices: HomeAssistantDevice[];
  entities: HomeAssistantEntityRegistryEntry[];
};

const EMPTY_REGISTRY: RegistryResults = {
  areas: [],
  devices: [],
  entities: [],
};

type RegistryCacheEntry = {
  expiresAt: number;
  promise?: Promise<RegistryResults>;
  value?: RegistryResults;
};

const REGISTRY_FETCH_TIMEOUT_MS = 8000;
const REGISTRY_CACHE_TTL_MS = 30 * 60 * 1000;
const EMPTY_REGISTRY_CACHE_TTL_MS = 60 * 1000;
const registryCache = new Map<string, RegistryCacheEntry>();

export function normalizeHomeAssistantUrl(value?: string): string {
  const rawValue = (value || '').trim();
  if (!rawValue) return '';

  const withProtocol = /^https?:\/\//i.test(rawValue) ? rawValue : `http://${rawValue}`;

  try {
    const parsed = new URL(withProtocol);
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export async function fetchHomeAssistantSnapshot(
  config: HomeAssistantConnectionConfig,
  signal?: AbortSignal
): Promise<HomeAssistantSnapshot> {
  const baseUrl = normalizeHomeAssistantUrl(config.baseUrl);
  const token = config.apiToken?.trim();

  if (!baseUrl || !token) {
    throw new Error('Home Assistant connection is not configured');
  }

  const states = await homeAssistantFetch<HomeAssistantState[]>(baseUrl, token, '/api/states', {
    signal,
  });
  const registry = await fetchRegistrySnapshot(baseUrl, token);
  const entities = buildHomeAssistantEntities(states, registry);

  return {
    states,
    areas: registry.areas,
    devices: registry.devices,
    registryEntities: registry.entities,
    entities,
    loadedAt: new Date().toISOString(),
  };
}

export async function callHomeAssistantService(
  config: HomeAssistantConnectionConfig,
  domain: string,
  service: string,
  entityId: string
): Promise<void> {
  const baseUrl = normalizeHomeAssistantUrl(config.baseUrl);
  const token = config.apiToken?.trim();

  if (!baseUrl || !token) {
    throw new Error('Home Assistant connection is not configured');
  }

  await homeAssistantFetch(baseUrl, token, `/api/services/${domain}/${service}`, {
    method: 'POST',
    body: JSON.stringify({ entity_id: entityId }),
  });
}

async function homeAssistantFetch<T = unknown>(
  baseUrl: string,
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Home Assistant rejected the access token');
    }

    throw new Error(`Home Assistant request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function fetchRegistrySnapshot(baseUrl: string, token: string): Promise<RegistryResults> {
  const now = Date.now();
  const cached = registryCache.get(baseUrl);

  if (cached?.value && cached.expiresAt > now) {
    return cached.value;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = fetchRegistrySnapshotUncached(baseUrl, token)
    .then((value) => {
      registryCache.set(baseUrl, {
        value,
        expiresAt: Date.now() + getRegistryCacheDuration(value),
      });
      return value;
    })
    .catch((error) => {
      registryCache.delete(baseUrl);
      throw error;
    });

  registryCache.set(baseUrl, {
    promise,
    expiresAt: now + REGISTRY_FETCH_TIMEOUT_MS,
  });

  return promise;
}

function fetchRegistrySnapshotUncached(baseUrl: string, token: string): Promise<RegistryResults> {
  return new Promise((resolve) => {
    let settled = false;
    let nextId = 1;
    const results: RegistryResults = { ...EMPTY_REGISTRY };
    const pending = new Map<number, keyof RegistryResults>();
    const ws = new WebSocket(createWebSocketUrl(baseUrl));

    const finish = (value: RegistryResults) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try {
        ws.close();
      } catch {
        // The socket can already be closing.
      }
      resolve(value);
    };

    const sendRegistryRequest = (key: keyof RegistryResults, type: string) => {
      const id = nextId;
      nextId += 1;
      pending.set(id, key);
      ws.send(JSON.stringify({ id, type }));
    };

    const timeoutId = window.setTimeout(() => finish(EMPTY_REGISTRY), REGISTRY_FETCH_TIMEOUT_MS);

    ws.addEventListener('message', (event) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (message.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: token }));
        return;
      }

      if (message.type === 'auth_invalid') {
        finish(EMPTY_REGISTRY);
        return;
      }

      if (message.type === 'auth_ok') {
        sendRegistryRequest('areas', 'config/area_registry/list');
        sendRegistryRequest('devices', 'config/device_registry/list');
        sendRegistryRequest('entities', 'config/entity_registry/list');
        return;
      }

      if (message.type !== 'result' || typeof message.id !== 'number') {
        return;
      }

      const key = pending.get(message.id);
      if (!key) return;

      pending.delete(message.id);
      const result = Array.isArray(message.result) ? message.result : [];
      results[key] = result as never;

      if (pending.size === 0) {
        finish(results);
      }
    });

    ws.addEventListener('error', () => finish(EMPTY_REGISTRY));
    ws.addEventListener('close', () => {
      if (!settled) finish(EMPTY_REGISTRY);
    });
  });
}

function getRegistryCacheDuration(value: RegistryResults): number {
  const hasRegistryData = value.areas.length > 0 || value.devices.length > 0 || value.entities.length > 0;
  return hasRegistryData ? REGISTRY_CACHE_TTL_MS : EMPTY_REGISTRY_CACHE_TTL_MS;
}

function createWebSocketUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/api/websocket`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}
