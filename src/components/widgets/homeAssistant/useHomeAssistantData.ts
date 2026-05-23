import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchHomeAssistantSnapshot } from './client';
import type { HomeAssistantBaseConfig, HomeAssistantSnapshot } from './types';

const DEFAULT_REFRESH_INTERVAL = 30;

export function useHomeAssistantData(config: HomeAssistantBaseConfig) {
  const [snapshot, setSnapshot] = useState<HomeAssistantSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canFetch = Boolean(config.baseUrl?.trim() && config.apiToken?.trim());
  const refreshInterval = Math.max(10, Number(config.refreshInterval || DEFAULT_REFRESH_INTERVAL));

  const fetchData = useCallback(async (mode: 'initial' | 'refresh' = 'refresh') => {
    if (!canFetch) {
      setSnapshot(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    try {
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      const nextSnapshot = await fetchHomeAssistantSnapshot(config, controller.signal);
      setSnapshot(nextSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Home Assistant');
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
      setRefreshing(false);
    }
  }, [canFetch, config]);

  useEffect(() => {
    fetchData('initial');
    if (!canFetch) return undefined;

    const interval = window.setInterval(() => {
      fetchData('refresh');
    }, refreshInterval * 1000);

    return () => window.clearInterval(interval);
  }, [canFetch, fetchData, refreshInterval]);

  return useMemo(() => ({
    snapshot,
    loading,
    refreshing,
    error,
    canFetch,
    refresh: () => fetchData('refresh'),
  }), [canFetch, error, fetchData, loading, refreshing, snapshot]);
}
