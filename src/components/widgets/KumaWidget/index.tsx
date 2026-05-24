import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Search,
  Settings,
  XCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup
} from '../../ui/select';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '../../ui/skeleton';
import WidgetHeader from '../common/WidgetHeader';
import { WidgetSettingsDialog, WidgetSettingsDialogFooter } from '../common/WidgetSettingsDialog';
import { cn } from '@/lib/utils';
import {
  formatMonitoringItemLimitPlaceholder,
  getAutomaticMonitoringItemLimit,
  getMonitoringItemLimit,
  parseMonitoringItemLimit,
} from '../common/monitoringItemLimit';
import { readMonitoringJson } from '../common/monitoringApiResponse';
import { KumaMonitor, KumaMonitorStatus, KumaWidgetConfig, KumaWidgetData } from './types';

const SQLITE_API_URL = import.meta.env.VITE_SQLITE_API_URL || '';
const DEFAULT_API_URL = SQLITE_API_URL ? `${SQLITE_API_URL}/monitoring/kuma` : '/api/monitoring/kuma';

const DEFAULT_CONFIG: KumaWidgetConfig = {
  title: 'Service Monitoring',
  apiUrl: DEFAULT_API_URL,
  statusPageUrl: '',
  refreshInterval: 60,
  groupFilter: '',
  statusFilter: 'all',
  showGroups: true,
  showMessages: true,
};

type Props = {
  width: number;
  height: number;
  config?: KumaWidgetConfig;
};

const STATUS_STYLES: Record<KumaMonitorStatus, { badge: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  up: {
    badge: 'bg-green-500/10 text-green-700 dark:text-green-300',
    icon: CheckCircle2,
    label: 'Up',
  },
  down: {
    badge: 'bg-red-500/10 text-red-700 dark:text-red-300',
    icon: XCircle,
    label: 'Down',
  },
  pending: {
    badge: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
    icon: AlertCircle,
    label: 'Pending',
  },
  maintenance: {
    badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
    icon: AlertCircle,
    label: 'Maintenance',
  },
  unknown: {
    badge: 'bg-muted text-muted-foreground',
    icon: AlertCircle,
    label: 'Unknown',
  },
};

const ISSUE_STATUSES: KumaMonitorStatus[] = ['down', 'pending', 'maintenance', 'unknown'];

const mergeConfig = (config?: KumaWidgetConfig): KumaWidgetConfig => ({
  ...DEFAULT_CONFIG,
  ...config,
});

const sanitizeUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
};

const formatRelative = (value: string | null) => {
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

const sortMonitors = (monitors: KumaMonitor[]) => {
  const rank: Record<KumaMonitorStatus, number> = {
    down: 0,
    pending: 1,
    maintenance: 2,
    unknown: 3,
    up: 4,
  };

  return [...monitors].sort((a, b) => {
    const rankDiff = rank[a.status] - rank[b.status];
    return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
  });
};

const KumaWidget: React.FC<Props> = ({ width, height, config }) => {
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const mergedConfig = useMemo(() => mergeConfig(config), [config]);
  const automaticMaxItems = useMemo(() => getAutomaticMonitoringItemLimit(width, height), [width, height]);
  const [localConfig, setLocalConfig] = useState<KumaWidgetConfig>(mergedConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [data, setData] = useState<KumaWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedMonitorId, setSelectedMonitorId] = useState<number | null>(null);
  const hasCustomStatusPageUrl = Boolean(localConfig.statusPageUrl?.trim());
  const shouldUseServerFallback = !hasCustomStatusPageUrl;
  const shouldShowSetupPrompt = !data && !loading && shouldUseServerFallback && error === 'Kuma monitoring is not configured';

  useEffect(() => {
    setLocalConfig(mergedConfig);
  }, [mergedConfig]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(localConfig.apiUrl || DEFAULT_API_URL, {
        method: hasCustomStatusPageUrl ? 'POST' : 'GET',
        headers: hasCustomStatusPageUrl ? { 'Content-Type': 'application/json' } : undefined,
        body: hasCustomStatusPageUrl
          ? JSON.stringify({ statusPageUrl: localConfig.statusPageUrl?.trim() })
          : undefined,
        signal: AbortSignal.timeout(10000),
      });
      const payload = await readMonitoringJson<KumaWidgetData>(response, 'Uptime Kuma');
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [hasCustomStatusPageUrl, localConfig.apiUrl, localConfig.statusPageUrl]);

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, Math.max(15, localConfig.refreshInterval || 60) * 1000);
    return () => window.clearInterval(interval);
  }, [fetchData, localConfig.refreshInterval]);

  const monitors = useMemo(() => {
    const groupFilter = (localConfig.groupFilter || '').trim().toLowerCase();

    const filtered = (data?.monitors ?? []).filter((monitor) => {
      const matchesQuery = query
        ? `${monitor.name} ${monitor.group} ${monitor.type} ${monitor.message || ''}`.toLowerCase().includes(query.toLowerCase())
        : true;
      const matchesGroup = groupFilter ? monitor.group.toLowerCase().includes(groupFilter) : true;
      const matchesStatus = localConfig.statusFilter === 'issues'
        ? ISSUE_STATUSES.includes(monitor.status)
        : localConfig.statusFilter === 'up'
          ? monitor.status === 'up'
          : true;

      return matchesQuery && matchesGroup && matchesStatus;
    });

    return sortMonitors(filtered);
  }, [data?.monitors, localConfig.groupFilter, localConfig.statusFilter, query]);

  useEffect(() => {
    if (!monitors.length) {
      setSelectedMonitorId(null);
      return;
    }

    setSelectedMonitorId((current) =>
      current != null && monitors.some((monitor) => monitor.id === current) ? current : monitors[0].id,
    );
  }, [monitors]);

  const selectedMonitor = useMemo(
    () => monitors.find((monitor) => monitor.id === selectedMonitorId) ?? null,
    [monitors, selectedMonitorId],
  );

  const resolvedMaxItems = useMemo(
    () => getMonitoringItemLimit(width, height, localConfig.maxItems),
    [height, localConfig.maxItems, width],
  );

  const visibleMonitors = useMemo(() => {
    if (typeof resolvedMaxItems !== 'number') {
      return monitors;
    }

    return monitors.slice(0, resolvedMaxItems);
  }, [monitors, resolvedMaxItems]);

  const summary = useMemo(() => {
    const all = data?.monitors ?? [];
    return all.reduce(
      (acc, monitor) => {
        acc.total += 1;
        if (monitor.status === 'up') acc.up += 1;
        if (monitor.status === 'down') acc.down += 1;
        if (monitor.status === 'pending') acc.pending += 1;
        if (monitor.status === 'maintenance') acc.maintenance += 1;
        if (monitor.status === 'unknown') acc.unknown += 1;
        return acc;
      },
      { total: 0, up: 0, down: 0, pending: 0, maintenance: 0, unknown: 0 },
    );
  }, [data?.monitors]);

  const attentionCount = summary.down + summary.pending + summary.maintenance + summary.unknown;
  const openUrl = sanitizeUrl(localConfig.dashboardUrl || data?.dashboardUrl);

  const saveSettings = () => {
    config?.onUpdate?.(localConfig);
    setShowSettings(false);
  };

  const renderSetupPrompt = () => {
    if (isTiny) {
      return (
        <div className="flex h-full items-center justify-center">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <Settings className="h-8 w-8" />
        <p className="text-sm">Add your Uptime Kuma status page URL to get started.</p>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            Open Settings
          </Button>
        )}
      </div>
    );
  };

  const renderLoading = () => (
    <div className="flex flex-1 flex-col gap-2 p-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );

  const renderError = () => {
    if (isTiny) {
      const tinyError = (
        <>
          <XCircle className="h-5 w-5 text-red-500" />
          <span className="text-[10px] font-medium text-muted-foreground">Error</span>
        </>
      );

      if (readOnly) {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            {tinyError}
          </div>
        );
      }

      return (
        <button
          type="button"
          className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-md text-center"
          onClick={() => setShowSettings(true)}
          aria-label="Open Uptime Kuma settings"
        >
          {tinyError}
        </button>
      );
    }

    const compactError = isCompact && !isShort;

    return (
      <div className={cn(
        'flex h-full flex-col items-center justify-center text-center text-muted-foreground',
        compactError ? 'gap-1.5 p-2 text-xs' : 'gap-2 p-3 text-sm',
      )}>
        <XCircle className="h-5 w-5 text-red-500" />
        <span className={cn('max-w-full break-words', compactError && 'line-clamp-2')}>
          {error}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className={cn(compactError && 'h-7 px-2 text-xs')}
            onClick={fetchData}
          >
            Retry
          </Button>
          {!compactError && !readOnly && (
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              Settings
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderEmpty = (message: string) => (
    <Empty className="h-full border-0 p-3">
      <EmptyHeader className="gap-2">
        <EmptyMedia variant="icon" className="mb-0">
          <AlertCircle aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle className="text-sm font-normal text-muted-foreground">{message}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );

  const renderStatusPills = () => (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <Badge variant="secondary" className="bg-green-500/10 px-2.5 py-1 text-green-700 dark:text-green-300">
        {summary.up} healthy
      </Badge>
      {attentionCount > 0 && (
        <Badge variant="secondary" className="bg-red-500/10 px-2.5 py-1 text-red-700 dark:text-red-300">
          {attentionCount} need attention
        </Badge>
      )}
      <Badge variant="secondary" className="bg-muted px-2.5 py-1">
        {summary.total} total
      </Badge>
    </div>
  );

  const renderActions = (textOnly = false) => (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Button
        variant="ghost"
        size={textOnly ? 'sm' : 'icon'}
        onClick={fetchData}
        className={cn(textOnly ? 'h-7 px-2' : 'h-7 w-7')}
        aria-label="Refresh service monitoring"
      >
        <RefreshCw className={cn('h-4 w-4', loading ? 'animate-spin' : '')} />
        {textOnly && <span className="ml-1">Refresh</span>}
      </Button>
      {openUrl && (
        <a href={openUrl} target="_blank" rel="noreferrer" className="inline-flex">
          <Button
            variant="ghost"
            size={textOnly ? 'sm' : 'icon'}
            className={cn(textOnly ? 'h-7 px-2' : 'h-7 w-7')}
            aria-label="Open Uptime Kuma"
          >
            <ExternalLink className="h-4 w-4" />
            {textOnly && <span className="ml-1">Open</span>}
          </Button>
        </a>
      )}
    </div>
  );

  const renderMonitorRow = (monitor: KumaMonitor, compact = false, selected = false) => {
    const statusStyle = STATUS_STYLES[monitor.status];
    const StatusIcon = statusStyle.icon;

    return (
      <Button type="button" variant="ghost" size="none"
        key={monitor.id}
        onClick={() => setSelectedMonitorId(monitor.id)}
        className={cn(
          'w-full justify-start rounded-lg border border-border/60 bg-background/40 text-left transition-colors hover:bg-accent/50',
          compact ? 'px-2 py-2' : 'px-3 py-2',
          selected && 'border-primary/40 bg-accent/50',
        )}
      >
        <div className="flex w-full min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <StatusIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium text-foreground">{monitor.name}</span>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {localConfig.showGroups ? `${monitor.group} · ` : ''}{monitor.type}
            </div>
            {!compact && localConfig.showMessages && monitor.message && (
              <div className="truncate text-xs text-muted-foreground">
                {monitor.message}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              {monitor.ping != null ? `${monitor.ping} ms` : 'No ping'} · {formatRelative(monitor.lastChecked)}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Badge variant="secondary" className={cn('px-2 py-1 text-[11px]', statusStyle.badge)}>
              {statusStyle.label}
            </Badge>
            {!compact && (
              <span className="text-[11px] text-muted-foreground">
                {monitor.uptime24 != null ? `${Math.round(monitor.uptime24 * 100)}% 24h` : 'No uptime'}
              </span>
            )}
          </div>
        </div>
      </Button>
    );
  };

  const renderDetail = (monitor: KumaMonitor | null) => {
    if (!monitor) return renderEmpty('Select a monitor to view details.');

    const statusStyle = STATUS_STYLES[monitor.status];
    const StatusIcon = statusStyle.icon;

    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusIcon className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">{monitor.name}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {localConfig.showGroups && <span>{monitor.group}</span>}
            <span>{monitor.type}</span>
            <Badge variant="secondary" className={cn('px-2 py-1', statusStyle.badge)}>{statusStyle.label}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/60 p-3">
            <div className="text-xs text-muted-foreground">Response time</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {monitor.ping != null ? `${monitor.ping} ms` : 'N/A'}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <div className="text-xs text-muted-foreground">24h uptime</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {monitor.uptime24 != null ? `${Math.round(monitor.uptime24 * 100)}%` : 'N/A'}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 p-3">
          <div className="text-xs text-muted-foreground">Last update</div>
          <div className="mt-1 text-sm text-foreground">{formatRelative(monitor.lastChecked)}</div>
          {localConfig.showMessages && monitor.message && (
            <>
              <div className="mt-3 text-xs text-muted-foreground">Latest message</div>
              <div className="mt-1 text-sm text-foreground">{monitor.message}</div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderTiny = () => (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
      <div className="text-lg font-semibold">{summary.up}/{summary.total}</div>
      <div className={cn('text-[10px] uppercase tracking-wide', attentionCount > 0 ? 'text-red-500' : 'text-green-500')}>
        {attentionCount > 0 ? `${attentionCount} issue${attentionCount > 1 ? 's' : ''}` : 'healthy'}
      </div>
    </div>
  );

  const renderShort = () => (
    <div className="flex h-full items-center gap-2 overflow-x-auto px-1">
      {renderStatusPills()}
      {visibleMonitors.slice(0, 4).map((monitor) => {
        const statusStyle = STATUS_STYLES[monitor.status];
        return (
          <Badge key={monitor.id} variant="secondary" className={cn('shrink-0 px-2.5 py-1 text-[11px]', statusStyle.badge)}>
            {monitor.name}
          </Badge>
        );
      })}
    </div>
  );

  const renderCompact = () => (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        {renderStatusPills()}
        {renderActions()}
      </div>
      <div className="flex-1 space-y-2 overflow-auto">
        {visibleMonitors.length > 0
          ? visibleMonitors.slice(0, 3).map((monitor) => renderMonitorRow(monitor, true))
          : renderEmpty('No monitors match the current filters.')}
      </div>
    </div>
  );

  const renderDefault = () => (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        {renderStatusPills()}
        {renderActions()}
      </div>
      <div className="flex-1 space-y-2 overflow-auto">
        {visibleMonitors.length > 0
          ? visibleMonitors.map((monitor) => renderMonitorRow(monitor))
          : renderEmpty('No monitors match the current filters.')}
      </div>
      {data?.updatedAt && (
        <div className="text-[11px] text-muted-foreground">
          Updated {formatRelative(data.updatedAt)}
        </div>
      )}
    </div>
  );

  const renderPanel = () => (
    <div className="flex h-full overflow-hidden">
      <div className="flex w-2/5 flex-col border-r border-border/60 p-3">
        <div className="flex items-start justify-between gap-3">
          {renderStatusPills()}
          {renderActions()}
        </div>
        <div className="mt-3 flex-1 space-y-2 overflow-auto">
          {visibleMonitors.length > 0
            ? visibleMonitors.map((monitor) => renderMonitorRow(monitor, false, monitor.id === selectedMonitorId))
            : renderEmpty('No monitors match the current filters.')}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {renderDetail(selectedMonitor)}
      </div>
    </div>
  );

  const renderApp = () => (
    <div className="flex h-full flex-col">
      <div className="px-4 py-2 widget-drag-handle cursor-move">
        <div>
          <h2 className="text-base font-semibold text-foreground">{localConfig.title || DEFAULT_CONFIG.title}</h2>
          <div className="mt-1 flex items-start justify-between gap-3">
            {renderStatusPills()}
            <div className="flex items-center gap-2">
              {renderActions(true)}
              {!readOnly && (
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                  Settings
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-1/3 flex-col border-r border-border/60">
          <div className="border-b border-border/60 p-3">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search monitors"
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-auto p-3">
            {monitors.length > 0
              ? monitors.map((monitor) => renderMonitorRow(monitor, false, monitor.id === selectedMonitorId))
              : renderEmpty('No monitors match the current filters.')}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {renderDetail(selectedMonitor)}
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : '')}>
      {!isTiny && !isApp && (
        <WidgetHeader
          title={localConfig.title || DEFAULT_CONFIG.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      <div className={cn('flex-1 overflow-hidden', isTiny ? 'p-1' : isApp ? '' : 'p-2 md:p-3')}>
        {loading && !data ? renderLoading()
          : error && !data && !shouldShowSetupPrompt ? renderError()
          : shouldShowSetupPrompt ? renderSetupPrompt()
          : isTiny ? renderTiny()
          : isShort ? renderShort()
          : isApp ? renderApp()
          : isWide && isTall ? renderPanel()
          : isCompact ? renderCompact()
          : renderDefault()}
      </div>

      <WidgetSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        title={`${localConfig.title || DEFAULT_CONFIG.title} Settings`}
        description="Configure the Uptime Kuma status page and backend endpoint."
        bodyClassName="py-2"
        footer={(
          <WidgetSettingsDialogFooter
            onDelete={config?.onDelete}
            deleteLabel="Delete Widget"
            onCancel={() => setShowSettings(false)}
            onSave={saveSettings}
          />
        )}
      >
        <div className="space-y-4 px-1">
              <div className="space-y-2">
                <Label htmlFor="kuma-title">Title</Label>
                <Input
                  id="kuma-title"
                  value={localConfig.title || ''}
                  onChange={(event) => setLocalConfig((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kuma-status-page-url">Status Page URL *</Label>
                <Input
                  id="kuma-status-page-url"
                  type="url"
                  value={localConfig.statusPageUrl || ''}
                  onChange={(event) => setLocalConfig((prev) => ({ ...prev, statusPageUrl: event.target.value }))}
                  placeholder="https://kuma.example.com/status/homelab"
                />
                <p className="text-xs text-muted-foreground">
                  Required. Paste the public Uptime Kuma status page URL for this widget.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kuma-api-url">Backend Endpoint</Label>
                <Input
                  id="kuma-api-url"
                  value={localConfig.apiUrl || ''}
                  onChange={(event) => setLocalConfig((prev) => ({ ...prev, apiUrl: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Advanced: override the Boxento backend endpoint used by this widget.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kuma-dashboard-url">Open URL Override</Label>
                <Input
                  id="kuma-dashboard-url"
                  value={localConfig.dashboardUrl || ''}
                  onChange={(event) => setLocalConfig((prev) => ({ ...prev, dashboardUrl: event.target.value }))}
                  placeholder="Optional override for external link"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kuma-refresh">Refresh (s)</Label>
                  <Input
                    id="kuma-refresh"
                    type="number"
                    min={15}
                    value={localConfig.refreshInterval || DEFAULT_CONFIG.refreshInterval || 60}
                    onChange={(event) => setLocalConfig((prev) => ({ ...prev, refreshInterval: Number(event.target.value) || 60 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kuma-max-items">Item limit</Label>
                  <Input
                    id="kuma-max-items"
                    type="number"
                    min={1}
                    value={localConfig.maxItems?.toString() ?? ''}
                    placeholder={formatMonitoringItemLimitPlaceholder(automaticMaxItems)}
                    onChange={(event) => setLocalConfig((prev) => ({
                      ...prev,
                      maxItems: parseMonitoringItemLimit(event.target.value),
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Leave blank to use the size-aware default for this widget.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kuma-group-filter">Group filter</Label>
                <Input
                  id="kuma-group-filter"
                  value={localConfig.groupFilter || ''}
                  onChange={(event) => setLocalConfig((prev) => ({ ...prev, groupFilter: event.target.value }))}
                  placeholder="Optional group name"
                />
              </div>
              <div className="space-y-2">
                <Label>Status filter</Label>
                <Select
                  value={localConfig.statusFilter || 'all'}
                  onValueChange={(value) => setLocalConfig((prev) => ({
                    ...prev,
                    statusFilter: value as KumaWidgetConfig['statusFilter'],
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                    <SelectItem value="all">All monitors</SelectItem>
                    <SelectItem value="issues">Issues only</SelectItem>
                    <SelectItem value="up">Healthy only</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="kuma-show-groups">Show groups</Label>
                <Switch
                  id="kuma-show-groups"
                  checked={Boolean(localConfig.showGroups)}
                  onCheckedChange={(checked) => setLocalConfig((prev) => ({ ...prev, showGroups: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="kuma-show-messages">Show messages</Label>
                <Switch
                  id="kuma-show-messages"
                  checked={Boolean(localConfig.showMessages)}
                  onCheckedChange={(checked) => setLocalConfig((prev) => ({ ...prev, showMessages: checked }))}
                />
              </div>
            </div>
      </WidgetSettingsDialog>
    </div>
  );
};

export default KumaWidget;
