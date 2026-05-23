import { useCallback, useEffect, useMemo, useState } from 'react';

import { createHomeAssistantWebSocketUrl, fetchHomeAssistantSnapshot, normalizeHomeAssistantUrl } from './client';
import type { HomeAssistantBaseConfig, HomeAssistantSnapshot, HomeAssistantState } from './types';
import { patchHomeAssistantSnapshotState } from './utils';

type FetchMode = 'initial' | 'refresh';
type RealtimeStatus = 'idle' | 'connecting' | 'connected';

type HomeAssistantWebSocketMessage = {
  event?: {
    data?: {
      new_state?: unknown;
    };
    event_type?: string;
  };
  id?: number;
  success?: boolean;
  type?: string;
};

type SharedHomeAssistantData = {
  config: HomeAssistantBaseConfig;
  error: string | null;
  intervalDelayMs?: number;
  intervalId?: number;
  loading: boolean;
  promise?: Promise<void>;
  realtimeMessageId: number;
  realtimePingTimerId?: number;
  realtimeReconnectAttempts: number;
  realtimeReconnectTimerId?: number;
  realtimeSocket?: WebSocket;
  realtimeStatus: RealtimeStatus;
  realtimeSubscriptionId?: number;
  refreshing: boolean;
  snapshot: HomeAssistantSnapshot | null;
  subscriberRefreshIntervals: Map<() => void, number>;
  subscribers: Set<() => void>;
};

const DEFAULT_REFRESH_INTERVAL = 30;
const FETCH_TIMEOUT_MS = 12000;
const REALTIME_PING_INTERVAL_MS = 30000;
const REALTIME_RECONNECT_BASE_MS = 1000;
const REALTIME_RECONNECT_MAX_MS = 30000;
const sharedDataByConnection = new Map<string, SharedHomeAssistantData>();

export function useHomeAssistantData(config: HomeAssistantBaseConfig) {
  const { apiToken, baseUrl, refreshInterval } = config;
  const canFetch = Boolean(baseUrl?.trim() && apiToken?.trim());
  const connectionKey = useMemo(() => getConnectionKey(baseUrl, apiToken), [apiToken, baseUrl]);
  const refreshIntervalMs = Math.max(10, Number(refreshInterval || DEFAULT_REFRESH_INTERVAL)) * 1000;
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!canFetch || !connectionKey) return undefined;

    const entry = getSharedData(connectionKey, config);
    entry.config = config;

    const listener = () => setVersion((current) => current + 1);
    entry.subscribers.add(listener);
    entry.subscriberRefreshIntervals.set(listener, refreshIntervalMs);
    ensureRefreshInterval(entry);
    ensureRealtimeConnection(entry);

    if (!entry.snapshot && !entry.promise) {
      void fetchSharedData(entry, 'initial');
    }

    return () => {
      entry.subscribers.delete(listener);
      entry.subscriberRefreshIntervals.delete(listener);

      if (entry.subscribers.size === 0 && entry.intervalId !== undefined) {
        window.clearInterval(entry.intervalId);
        entry.intervalId = undefined;
        entry.intervalDelayMs = undefined;
      }

      if (entry.subscribers.size === 0) {
        disconnectRealtime(entry);
        sharedDataByConnection.delete(connectionKey);
      } else {
        ensureRefreshInterval(entry);
      }
    };
  }, [canFetch, config, connectionKey, refreshIntervalMs]);

  const view = useMemo(() => {
    void version;

    if (!canFetch || !connectionKey) {
      return {
        error: null,
        loading: false,
        refreshing: false,
        snapshot: null,
      };
    }

    const entry = getSharedData(connectionKey, config);
    return {
      error: entry.error,
      loading: entry.loading,
      refreshing: entry.refreshing,
      snapshot: entry.snapshot,
    };
  }, [canFetch, config, connectionKey, version]);

  const refresh = useCallback(() => {
    if (!canFetch || !connectionKey) {
      return Promise.resolve();
    }

    const entry = getSharedData(connectionKey, config);
    entry.config = config;
    return fetchSharedData(entry, 'refresh');
  }, [canFetch, config, connectionKey]);

  return useMemo(() => ({
    snapshot: view.snapshot,
    loading: view.loading,
    refreshing: view.refreshing,
    error: view.error,
    canFetch,
    refresh,
  }), [canFetch, refresh, view.error, view.loading, view.refreshing, view.snapshot]);
}

function getConnectionKey(baseUrlValue?: string, apiTokenValue?: string): string {
  const baseUrl = normalizeHomeAssistantUrl(baseUrlValue);
  const token = apiTokenValue?.trim();

  return baseUrl && token ? `${baseUrl}::${token}` : '';
}

function getSharedData(connectionKey: string, config: HomeAssistantBaseConfig): SharedHomeAssistantData {
  const existing = sharedDataByConnection.get(connectionKey);
  if (existing) return existing;

  const next: SharedHomeAssistantData = {
    config,
    error: null,
    loading: true,
    realtimeMessageId: 1,
    realtimeReconnectAttempts: 0,
    realtimeStatus: 'idle',
    refreshing: false,
    snapshot: null,
    subscriberRefreshIntervals: new Map(),
    subscribers: new Set(),
  };
  sharedDataByConnection.set(connectionKey, next);

  return next;
}

function ensureRefreshInterval(entry: SharedHomeAssistantData) {
  const intervalDelayMs = getSharedRefreshIntervalMs(entry);
  if (entry.intervalId !== undefined && entry.intervalDelayMs === intervalDelayMs) {
    return;
  }

  if (entry.intervalId !== undefined) {
    window.clearInterval(entry.intervalId);
  }

  entry.intervalDelayMs = intervalDelayMs;
  entry.intervalId = window.setInterval(() => {
    void fetchSharedData(entry, 'refresh');
  }, intervalDelayMs);
}

function getSharedRefreshIntervalMs(entry: SharedHomeAssistantData): number {
  const intervals = [...entry.subscriberRefreshIntervals.values()];
  return intervals.length ? Math.min(...intervals) : DEFAULT_REFRESH_INTERVAL * 1000;
}

function ensureRealtimeConnection(entry: SharedHomeAssistantData) {
  const baseUrl = normalizeHomeAssistantUrl(entry.config.baseUrl);
  const token = entry.config.apiToken?.trim();

  if (!baseUrl || !token) return;
  if (entry.realtimeSocket || entry.realtimeStatus !== 'idle' || entry.realtimeReconnectTimerId !== undefined) return;

  connectRealtime(entry, baseUrl, token);
}

function connectRealtime(entry: SharedHomeAssistantData, baseUrl: string, token: string) {
  let socket: WebSocket;

  try {
    socket = new WebSocket(createHomeAssistantWebSocketUrl(baseUrl));
  } catch {
    scheduleRealtimeReconnect(entry);
    return;
  }

  entry.realtimeSocket = socket;
  entry.realtimeStatus = 'connecting';

  socket.addEventListener('message', (event) => {
    handleRealtimeMessage(entry, socket, token, event);
  });

  socket.addEventListener('error', () => {
    if (entry.realtimeSocket !== socket) return;

    try {
      socket.close();
    } catch {
      scheduleRealtimeReconnect(entry);
    }
  });

  socket.addEventListener('close', () => {
    handleRealtimeClose(entry, socket);
  });
}

function handleRealtimeMessage(
  entry: SharedHomeAssistantData,
  socket: WebSocket,
  token: string,
  event: MessageEvent
) {
  let message: HomeAssistantWebSocketMessage;

  if (typeof event.data !== 'string') {
    return;
  }

  try {
    message = JSON.parse(event.data) as HomeAssistantWebSocketMessage;
  } catch {
    return;
  }

  if (message.type === 'auth_required') {
    sendSocketMessage(socket, { type: 'auth', access_token: token });
    return;
  }

  if (message.type === 'auth_invalid') {
    entry.error = 'Home Assistant rejected the access token';
    emitChange(entry);
    disconnectRealtime(entry);
    return;
  }

  if (message.type === 'auth_ok') {
    entry.realtimeStatus = 'connected';
    entry.realtimeReconnectAttempts = 0;
    entry.realtimeSubscriptionId = sendRealtimeCommand(entry, socket, {
      type: 'subscribe_events',
      event_type: 'state_changed',
    });
    startRealtimeHeartbeat(entry, socket);
    return;
  }

  if (message.type === 'result' && message.id === entry.realtimeSubscriptionId && message.success === false) {
    disconnectRealtime(entry);
    scheduleRealtimeReconnect(entry);
    return;
  }

  if (message.type !== 'event' || message.event?.event_type !== 'state_changed') {
    return;
  }

  const nextState = message.event.data?.new_state;
  if (!entry.snapshot || !isHomeAssistantState(nextState)) {
    return;
  }

  entry.snapshot = patchHomeAssistantSnapshotState(entry.snapshot, nextState);
  entry.error = null;
  emitChange(entry);
}

function handleRealtimeClose(entry: SharedHomeAssistantData, socket: WebSocket) {
  if (entry.realtimeSocket !== socket) return;

  stopRealtimeHeartbeat(entry);
  entry.realtimeSocket = undefined;
  entry.realtimeStatus = 'idle';
  entry.realtimeSubscriptionId = undefined;
  scheduleRealtimeReconnect(entry);
}

function startRealtimeHeartbeat(entry: SharedHomeAssistantData, socket: WebSocket) {
  stopRealtimeHeartbeat(entry);

  entry.realtimePingTimerId = window.setInterval(() => {
    if (entry.realtimeSocket !== socket || socket.readyState !== WebSocket.OPEN) return;

    sendRealtimeCommand(entry, socket, { type: 'ping' });
  }, REALTIME_PING_INTERVAL_MS);
}

function stopRealtimeHeartbeat(entry: SharedHomeAssistantData) {
  if (entry.realtimePingTimerId === undefined) return;

  window.clearInterval(entry.realtimePingTimerId);
  entry.realtimePingTimerId = undefined;
}

function scheduleRealtimeReconnect(entry: SharedHomeAssistantData) {
  if (entry.subscribers.size === 0 || entry.realtimeReconnectTimerId !== undefined) return;

  const delay = Math.min(
    REALTIME_RECONNECT_MAX_MS,
    REALTIME_RECONNECT_BASE_MS * 2 ** entry.realtimeReconnectAttempts
  );
  entry.realtimeReconnectAttempts += 1;
  entry.realtimeReconnectTimerId = window.setTimeout(() => {
    entry.realtimeReconnectTimerId = undefined;
    ensureRealtimeConnection(entry);
  }, delay);
}

function disconnectRealtime(entry: SharedHomeAssistantData) {
  if (entry.realtimeReconnectTimerId !== undefined) {
    window.clearTimeout(entry.realtimeReconnectTimerId);
    entry.realtimeReconnectTimerId = undefined;
  }

  stopRealtimeHeartbeat(entry);

  const socket = entry.realtimeSocket;
  entry.realtimeSocket = undefined;
  entry.realtimeStatus = 'idle';
  entry.realtimeSubscriptionId = undefined;
  entry.realtimeReconnectAttempts = 0;

  if (!socket) return;

  try {
    socket.close();
  } catch {
    // The socket may already be closing.
  }
}

function sendRealtimeCommand(
  entry: SharedHomeAssistantData,
  socket: WebSocket,
  message: Record<string, unknown>
): number {
  const id = entry.realtimeMessageId;
  entry.realtimeMessageId += 1;
  sendSocketMessage(socket, { id, ...message });

  return id;
}

function sendSocketMessage(socket: WebSocket, message: Record<string, unknown>) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(message));
}

function isHomeAssistantState(value: unknown): value is HomeAssistantState {
  if (!value || typeof value !== 'object') return false;

  const state = value as Partial<HomeAssistantState>;
  return (
    typeof state.entity_id === 'string' &&
    typeof state.state === 'string' &&
    Boolean(state.attributes) &&
    typeof state.attributes === 'object'
  );
}

async function fetchSharedData(entry: SharedHomeAssistantData, mode: FetchMode): Promise<void> {
  if (entry.promise) {
    return entry.promise;
  }

  const fetchPromise = fetchSharedDataUncached(entry, mode);
  entry.promise = fetchPromise;

  return fetchPromise;
}

async function fetchSharedDataUncached(entry: SharedHomeAssistantData, mode: FetchMode): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    if (mode === 'initial' && !entry.snapshot) {
      entry.loading = true;
    } else {
      entry.refreshing = true;
    }
    entry.error = null;
    emitChange(entry);

    entry.snapshot = await fetchHomeAssistantSnapshot(entry.config, controller.signal);
  } catch (err) {
    entry.error = err instanceof Error ? err.message : 'Failed to load Home Assistant';
  } finally {
    window.clearTimeout(timeout);
    entry.loading = false;
    entry.refreshing = false;
    entry.promise = undefined;
    emitChange(entry);
  }
}

function emitChange(entry: SharedHomeAssistantData) {
  entry.subscribers.forEach((listener) => listener());
}
