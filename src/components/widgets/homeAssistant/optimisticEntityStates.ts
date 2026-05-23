import { useCallback, useEffect, useMemo, useState } from 'react';

import { normalizeHomeAssistantUrl } from './client';
import type { HomeAssistantBaseConfig, HomeAssistantSnapshot } from './types';

type OptimisticEntityState = {
  state: string;
  expiresAt: number;
};

const OPTIMISTIC_TOGGLE_TIMEOUT_MS = 10000;
const DEFAULT_SCOPE = 'home-assistant';
const optimisticStatesByScope = new Map<string, Map<string, OptimisticEntityState>>();
const pendingEntityIdsByScope = new Map<string, Set<string>>();
const listenersByScope = new Map<string, Set<() => void>>();

export function useHomeAssistantOptimisticStates(
  config: HomeAssistantBaseConfig,
  snapshot: HomeAssistantSnapshot | null
) {
  const scope = useMemo(() => getScopeKey(config.baseUrl, config.apiToken), [config.apiToken, config.baseUrl]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const listener = () => setVersion((current) => current + 1);
    const listeners = getScopeListeners(scope);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        listenersByScope.delete(scope);
      }
    };
  }, [scope]);

  const view = useMemo(() => {
    void version;
    return readScopeView(scope);
  }, [scope, version]);

  useEffect(() => {
    if (!snapshot) return;
    reconcileOptimisticStates(scope, snapshot);
  }, [scope, snapshot]);

  useEffect(() => {
    if (view.optimisticCount === 0) return undefined;

    const interval = window.setInterval(() => {
      expireOptimisticStates(scope);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [scope, view.optimisticCount]);

  const setOptimisticState = useCallback((entityId: string, state: string) => {
    setOptimisticEntityState(scope, entityId, state);
  }, [scope]);

  const clearOptimisticState = useCallback((entityId: string) => {
    clearOptimisticEntityState(scope, entityId);
  }, [scope]);

  const setPendingEntity = useCallback((entityId: string, pending: boolean) => {
    setPendingEntityState(scope, entityId, pending);
  }, [scope]);

  return {
    optimisticStateValues: view.optimisticStateValues,
    pendingEntityIds: view.pendingEntityIds,
    setOptimisticState,
    clearOptimisticState,
    setPendingEntity,
  };
}

function getScopeKey(baseUrlValue?: string, apiTokenValue?: string): string {
  const baseUrl = normalizeHomeAssistantUrl(baseUrlValue);
  const token = apiTokenValue?.trim();

  return baseUrl && token ? `${baseUrl}::${token}` : DEFAULT_SCOPE;
}

function readScopeView(scope: string): {
  optimisticCount: number;
  optimisticStateValues: Record<string, string>;
  pendingEntityIds: Set<string>;
} {
  const optimisticStates = optimisticStatesByScope.get(scope);
  const pendingEntityIds = pendingEntityIdsByScope.get(scope);

  return {
    optimisticCount: optimisticStates?.size || 0,
    optimisticStateValues: Object.fromEntries(
      [...(optimisticStates?.entries() || [])].map(([entityId, optimistic]) => [entityId, optimistic.state])
    ),
    pendingEntityIds: new Set(pendingEntityIds || []),
  };
}

function setOptimisticEntityState(scope: string, entityId: string, state: string) {
  const optimisticStates = getOptimisticStates(scope);
  optimisticStates.set(entityId, {
    state,
    expiresAt: Date.now() + OPTIMISTIC_TOGGLE_TIMEOUT_MS,
  });
  emitScopeChange(scope);
}

function clearOptimisticEntityState(scope: string, entityId: string) {
  const optimisticStates = optimisticStatesByScope.get(scope);
  if (!optimisticStates?.delete(entityId)) return;

  if (optimisticStates.size === 0) {
    optimisticStatesByScope.delete(scope);
  }

  emitScopeChange(scope);
}

function setPendingEntityState(scope: string, entityId: string, pending: boolean) {
  const pendingEntityIds = getPendingEntityIds(scope);

  if (pending) {
    pendingEntityIds.add(entityId);
  } else {
    pendingEntityIds.delete(entityId);
  }

  if (pendingEntityIds.size === 0) {
    pendingEntityIdsByScope.delete(scope);
  }

  emitScopeChange(scope);
}

function reconcileOptimisticStates(scope: string, snapshot: HomeAssistantSnapshot) {
  const optimisticStates = optimisticStatesByScope.get(scope);
  if (!optimisticStates?.size) return;

  const actualStates = new Map(snapshot.entities.map((entity) => [entity.entityId, entity.state]));
  const now = Date.now();
  let changed = false;

  for (const [entityId, optimistic] of optimisticStates.entries()) {
    if (actualStates.get(entityId) === optimistic.state || optimistic.expiresAt <= now) {
      optimisticStates.delete(entityId);
      changed = true;
    }
  }

  if (optimisticStates.size === 0) {
    optimisticStatesByScope.delete(scope);
  }

  if (changed) {
    emitScopeChange(scope);
  }
}

function expireOptimisticStates(scope: string) {
  const optimisticStates = optimisticStatesByScope.get(scope);
  if (!optimisticStates?.size) return;

  const now = Date.now();
  let changed = false;

  for (const [entityId, optimistic] of optimisticStates.entries()) {
    if (optimistic.expiresAt <= now) {
      optimisticStates.delete(entityId);
      changed = true;
    }
  }

  if (optimisticStates.size === 0) {
    optimisticStatesByScope.delete(scope);
  }

  if (changed) {
    emitScopeChange(scope);
  }
}

function getOptimisticStates(scope: string): Map<string, OptimisticEntityState> {
  let optimisticStates = optimisticStatesByScope.get(scope);
  if (!optimisticStates) {
    optimisticStates = new Map();
    optimisticStatesByScope.set(scope, optimisticStates);
  }

  return optimisticStates;
}

function getPendingEntityIds(scope: string): Set<string> {
  let pendingEntityIds = pendingEntityIdsByScope.get(scope);
  if (!pendingEntityIds) {
    pendingEntityIds = new Set();
    pendingEntityIdsByScope.set(scope, pendingEntityIds);
  }

  return pendingEntityIds;
}

function getScopeListeners(scope: string): Set<() => void> {
  let listeners = listenersByScope.get(scope);
  if (!listeners) {
    listeners = new Set();
    listenersByScope.set(scope, listeners);
  }

  return listeners;
}

function emitScopeChange(scope: string) {
  listenersByScope.get(scope)?.forEach((listener) => listener());
}
