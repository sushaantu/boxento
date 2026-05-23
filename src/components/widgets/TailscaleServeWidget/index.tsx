import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Globe2,
  Lock,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { readMonitoringJson } from '../common/monitoringApiResponse';
import { WidgetSettingsDialog, WidgetSettingsDialogFooter } from '../common/WidgetSettingsDialog';
import { WidgetShell } from '../common/WidgetShell';
import {
  TailscaleServeRoute,
  TailscaleServeTargetType,
  TailscaleServeWidgetConfig,
  TailscaleServeWidgetData,
  TailscaleServeWidgetProps,
} from './types';

const SQLITE_API_URL = import.meta.env.VITE_SQLITE_API_URL || '';
const DEFAULT_API_URL = SQLITE_API_URL ? `${SQLITE_API_URL}/tailscale/serve` : '/api/tailscale/serve';

const DEFAULT_CONFIG: TailscaleServeWidgetConfig = {
  title: 'Tailscale Serve',
  apiUrl: DEFAULT_API_URL,
  refreshInterval: 60,
  maxItems: undefined,
  showTargets: true,
  targetTypeFilter: 'all',
};

const TARGET_TYPE_LABELS: Record<TailscaleServeTargetType | 'all', string> = {
  all: 'All targets',
  local: 'Localhost',
  lan: 'LAN',
  tailnet: 'Tailnet',
  orb: 'OrbStack',
  remote: 'Remote',
  text: 'Static',
  unknown: 'Unknown',
};

const TARGET_TYPE_CLASS_NAMES: Record<TailscaleServeTargetType, string> = {
  local: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  lan: 'bg-green-500/10 text-green-700 dark:text-green-300',
  tailnet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  orb: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  remote: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  text: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  unknown: 'bg-muted text-muted-foreground',
};

const mergeConfig = (config?: TailscaleServeWidgetConfig): TailscaleServeWidgetConfig => ({
  ...DEFAULT_CONFIG,
  ...config,
});

const sanitizeUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
};

const formatRelative = (value: string | null | undefined) => {
  if (!value) return 'Never';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return 'Just now';
};

const compactUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

const compactTarget = (route: TailscaleServeRoute) => {
  if (!route.target) return 'No target';
  return route.target.replace(/^https?:\/\//, '').replace(/\/$/, '');
};

const routeLabel = (route: TailscaleServeRoute) => {
  if (route.port != null) {
    return `${route.host}:${route.port}`;
  }
  return route.hostPort || route.host;
};

const getRouteLimit = (width: number, height: number, configuredLimit?: number) => {
  if (configuredLimit && configuredLimit > 0) return configuredLimit;
  if (width === 1 && height === 1) return 0;
  if (height === 1) return Math.max(1, Math.min(3, width));
  if (width <= 2 || height <= 2) return Math.max(2, Math.min(4, height + 1));
  if (width >= 6 && height >= 6) return undefined;
  return Math.max(4, Math.min(10, height * 2));
};

const openRoute = (route: TailscaleServeRoute) => {
  const url = sanitizeUrl(route.publicUrl);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

const TailscaleServeWidget: React.FC<TailscaleServeWidgetProps> = ({ width, height, config }) => {
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const mergedConfig = useMemo(() => mergeConfig(config), [config]);
  const [localConfig, setLocalConfig] = useState<TailscaleServeWidgetConfig>(mergedConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [data, setData] = useState<TailscaleServeWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [copiedRouteId, setCopiedRouteId] = useState<string | null>(null);

  useEffect(() => {
    setLocalConfig(mergedConfig);
  }, [mergedConfig]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(localConfig.apiUrl || DEFAULT_API_URL, {
        signal: AbortSignal.timeout(10000),
      });
      const payload = await readMonitoringJson<TailscaleServeWidgetData>(response, 'Tailscale Serve');
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Tailscale Serve routes');
    } finally {
      setLoading(false);
    }
  }, [localConfig.apiUrl]);

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, Math.max(15, localConfig.refreshInterval || 60) * 1000);
    return () => window.clearInterval(interval);
  }, [fetchData, localConfig.refreshInterval]);

  const routes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const targetTypeFilter = localConfig.targetTypeFilter || 'all';

    return (data?.routes ?? []).filter((route) => {
      const matchesQuery = normalizedQuery
        ? `${route.publicUrl} ${route.target} ${route.host} ${route.targetHost || ''}`.toLowerCase().includes(normalizedQuery)
        : true;
      const matchesTargetType = targetTypeFilter === 'all' || route.targetType === targetTypeFilter;
      return matchesQuery && matchesTargetType;
    });
  }, [data?.routes, localConfig.targetTypeFilter, query]);

  const visibleRouteLimit = getRouteLimit(width, height, localConfig.maxItems);
  const visibleRoutes = typeof visibleRouteLimit === 'number' ? routes.slice(0, visibleRouteLimit) : routes;
  const hiddenCount = Math.max(0, routes.length - visibleRoutes.length);
  const totalCount = data?.summary.total ?? data?.routes.length ?? 0;
  const sourceLabel = data?.source === 'cli' ? 'CLI' : data?.source || 'backend';

  const saveSettings = () => {
    config?.onUpdate?.(localConfig);
    setShowSettings(false);
  };

  const cancelSettings = () => {
    setLocalConfig(mergedConfig);
    setShowSettings(false);
  };

  const copyRoute = async (route: TailscaleServeRoute) => {
    try {
      await navigator.clipboard.writeText(route.publicUrl);
      setCopiedRouteId(route.id);
      window.setTimeout(() => setCopiedRouteId(null), 1500);
    } catch {
      setCopiedRouteId(null);
    }
  };

  const renderTypeBadge = (route: TailscaleServeRoute) => (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium', TARGET_TYPE_CLASS_NAMES[route.targetType])}>
      {TARGET_TYPE_LABELS[route.targetType]}
    </span>
  );

  const renderRouteActions = (route: TailscaleServeRoute, compact = false) => (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={compact ? 'size-7' : 'size-8'}
        onClick={() => copyRoute(route)}
        aria-label={`Copy ${route.publicUrl}`}
      >
        {copiedRouteId === route.id ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={compact ? 'size-7' : 'size-8'}
        onClick={() => openRoute(route)}
        aria-label={`Open ${route.publicUrl}`}
      >
        <ExternalLink className="size-4" />
      </Button>
    </div>
  );

  const renderRouteRow = (route: TailscaleServeRoute, compact = false) => (
    <div
      key={route.id}
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-lg border border-border/70 bg-background/70',
        compact ? 'px-2 py-1.5' : 'px-3 py-2'
      )}
    >
      <div className={cn('flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground', compact ? 'size-8' : 'size-10')}>
        {route.protocol === 'https' ? <Lock className="size-4" /> : <Globe2 className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('truncate font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>
          {routeLabel(route)}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {localConfig.showTargets !== false ? compactTarget(route) : compactUrl(route.publicUrl)}
        </div>
      </div>
      {!compact && renderTypeBadge(route)}
      {renderRouteActions(route, compact)}
    </div>
  );

  const renderLoading = () => (
    <div className="space-y-2">
      <Skeleton className="h-12 w-full rounded-lg" />
      {!isTiny && !isShort ? <Skeleton className="h-12 w-full rounded-lg" /> : null}
      {!isCompact ? <Skeleton className="h-12 w-full rounded-lg" /> : null}
    </div>
  );

  const renderError = () => (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-300">
        <AlertTriangle className="size-5" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">Serve status unavailable</div>
        {!isTiny ? (
          <p className="line-clamp-3 px-2 text-xs text-muted-foreground">
            {error || 'The backend could not read Tailscale Serve routes.'}
          </p>
        ) : null}
      </div>
      {!readOnly && !isTiny ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowSettings(true)}>
          <Settings2 className="size-4" />
          Settings
        </Button>
      ) : null}
    </div>
  );

  const renderEmpty = () => (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldCheck className="size-5" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">No Serve routes</div>
        <p className="px-2 text-xs text-muted-foreground">
          Run Tailscale Serve for a local app to expose it inside your tailnet.
        </p>
      </div>
    </div>
  );

  const renderTiny = () => {
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <button
        type="button"
        className="widget-drag-handle flex h-full w-full flex-col items-center justify-center gap-1 text-center"
        onClick={() => !readOnly && setShowSettings(true)}
        aria-label="Open Tailscale Serve settings"
      >
        {error ? (
          <AlertTriangle className="size-5 text-red-600 dark:text-red-300" />
        ) : (
          <ShieldCheck className="size-5 text-muted-foreground" />
        )}
        <span className="text-lg font-semibold leading-none text-foreground">{totalCount}</span>
        <span className="text-[10px] leading-none text-muted-foreground">Serve</span>
      </button>
    );
  };

  const renderShort = () => (
    <div className="flex h-full min-w-0 items-center gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">{totalCount}</span>
        <span className="text-xs text-muted-foreground">Serve URLs</span>
      </div>
      <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
        {visibleRoutes.map((route) => (
          <Button
            key={route.id}
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 min-w-0 shrink truncate px-2 text-xs"
            onClick={() => openRoute(route)}
            aria-label={`Open ${route.publicUrl}`}
          >
            {route.port ?? compactUrl(route.publicUrl)}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={fetchData}
        aria-label="Refresh Tailscale Serve routes"
      >
        <RefreshCw className="size-4" />
      </Button>
    </div>
  );

  const renderStandard = () => (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className={cn('grid gap-2', isCompact ? 'grid-cols-2' : 'grid-cols-3')}>
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="text-lg font-semibold text-foreground">{totalCount}</div>
        </div>
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <div className="text-xs text-muted-foreground">HTTPS</div>
          <div className="text-lg font-semibold text-foreground">{data?.summary.https ?? 0}</div>
        </div>
        {!isCompact ? (
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <div className="text-xs text-muted-foreground">Updated</div>
            <div className="truncate text-sm font-medium text-foreground">{formatRelative(data?.updatedAt)}</div>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {visibleRoutes.map((route) => renderRouteRow(route, isCompact || width <= 3))}
        {hiddenCount > 0 ? (
          <div className="px-2 text-xs text-muted-foreground">
            {hiddenCount} more route{hiddenCount === 1 ? '' : 's'}
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderApp = () => (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldCheck className="size-5 text-muted-foreground" />
            {localConfig.title || 'Tailscale Serve'}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {totalCount} active URLs · {sourceLabel} · updated {formatRelative(data?.updatedAt)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          {!readOnly ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <Settings2 className="size-4" />
              Settings
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="text-lg font-semibold">{totalCount}</div>
        </div>
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <div className="text-xs text-muted-foreground">LAN</div>
          <div className="text-lg font-semibold">{data?.summary.lan ?? 0}</div>
        </div>
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <div className="text-xs text-muted-foreground">Localhost</div>
          <div className="text-lg font-semibold">{data?.summary.local ?? 0}</div>
        </div>
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <div className="text-xs text-muted-foreground">OrbStack</div>
          <div className="text-lg font-semibold">{data?.summary.orb ?? 0}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter URLs or targets..."
            className="pl-9"
            aria-label="Filter Tailscale Serve URLs"
          />
        </div>
        <Select
          value={localConfig.targetTypeFilter || 'all'}
          onValueChange={(value) => setLocalConfig((previous) => ({
            ...previous,
            targetTypeFilter: value as TailscaleServeWidgetConfig['targetTypeFilter'],
          }))}
        >
          <SelectTrigger className="w-[150px]" aria-label="Filter by target type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TARGET_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/70">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_120px_92px] gap-3 border-b border-border/70 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <div>Serve URL</div>
          <div>Target</div>
          <div>Type</div>
          <div className="text-right">Actions</div>
        </div>
        {visibleRoutes.length ? (
          visibleRoutes.map((route) => (
            <div
              key={route.id}
              className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_120px_92px] items-center gap-3 border-b border-border/50 px-3 py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <button
                  type="button"
                  className="block max-w-full truncate text-left text-sm font-medium text-foreground hover:underline"
                  onClick={() => openRoute(route)}
                >
                  {compactUrl(route.publicUrl)}
                </button>
                <div className="text-xs text-muted-foreground">{route.protocol.toUpperCase()}</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm text-foreground">{compactTarget(route)}</div>
                <div className="truncate text-xs text-muted-foreground">{route.targetHost || 'static response'}</div>
              </div>
              {renderTypeBadge(route)}
              <div className="flex justify-end">{renderRouteActions(route)}</div>
            </div>
          ))
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No routes match this filter.
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    if (isTiny) return renderTiny();
    if (loading) return renderLoading();
    if (error) return renderError();
    if (!data || totalCount === 0) return renderEmpty();
    if (isShort) return renderShort();
    if (isApp) return renderApp();
    return renderStandard();
  };

  return (
    <>
      <WidgetShell
        title={localConfig.title || 'Tailscale Serve'}
        icon={<Server className="size-4" />}
        isTiny={isTiny}
        hideHeader={isApp}
        compactHeader={isShort || isCompact}
        onSettingsClick={!readOnly ? () => setShowSettings(true) : undefined}
        headerActions={!isTiny && !isApp ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('text-muted-foreground', isShort || isCompact ? 'size-7' : 'size-8')}
            onClick={(event) => {
              event.stopPropagation();
              fetchData();
            }}
            aria-label="Refresh Tailscale Serve routes"
          >
            <RefreshCw className="size-4" />
          </Button>
        ) : undefined}
        contentClassName={cn(
          isTiny ? 'p-0' : isShort ? 'px-3 py-2' : 'p-4',
        )}
      >
        {renderContent()}
      </WidgetShell>

      <WidgetSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        title="Tailscale Serve Settings"
        description="Configure the read-only endpoint used to list Tailscale Serve URLs."
        footer={(
          <WidgetSettingsDialogFooter
            onDelete={config?.onDelete}
            onCancel={cancelSettings}
            onSave={saveSettings}
            deleteLabel="Delete Widget"
          />
        )}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tailscale-serve-title">Title</Label>
            <Input
              id="tailscale-serve-title"
              value={localConfig.title || ''}
              onChange={(event) => setLocalConfig((previous) => ({ ...previous, title: event.target.value }))}
              placeholder="Tailscale Serve"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tailscale-serve-api">API URL</Label>
            <Input
              id="tailscale-serve-api"
              value={localConfig.apiUrl || ''}
              onChange={(event) => setLocalConfig((previous) => ({ ...previous, apiUrl: event.target.value }))}
              placeholder={DEFAULT_API_URL}
            />
            <p className="text-xs text-muted-foreground">
              Advanced: override the Boxento backend endpoint for this widget.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tailscale-serve-refresh">Refresh seconds</Label>
              <Input
                id="tailscale-serve-refresh"
                type="number"
                min={15}
                value={localConfig.refreshInterval ?? 60}
                onChange={(event) => setLocalConfig((previous) => ({
                  ...previous,
                  refreshInterval: Number(event.target.value) || 60,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tailscale-serve-max">Max rows</Label>
              <Input
                id="tailscale-serve-max"
                type="number"
                min={0}
                value={localConfig.maxItems ?? ''}
                onChange={(event) => setLocalConfig((previous) => ({
                  ...previous,
                  maxItems: event.target.value ? Number(event.target.value) : undefined,
                }))}
                placeholder="Auto"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
            <div>
              <Label htmlFor="tailscale-serve-targets">Show targets</Label>
              <p className="text-xs text-muted-foreground">
                Display where each Serve URL proxies traffic.
              </p>
            </div>
            <Switch
              id="tailscale-serve-targets"
              checked={localConfig.showTargets !== false}
              onCheckedChange={(checked) => setLocalConfig((previous) => ({ ...previous, showTargets: checked }))}
            />
          </div>
        </div>
      </WidgetSettingsDialog>
    </>
  );
};

export default TailscaleServeWidget;
