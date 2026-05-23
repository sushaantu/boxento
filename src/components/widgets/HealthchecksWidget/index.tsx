import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  RefreshCw,
  Search,
  Settings,
  Siren,
  Timer,
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
} from '../../ui/select';
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
import { HealthchecksCheck, HealthchecksStatus, HealthchecksWidgetConfig, HealthchecksWidgetData } from './types';

const SQLITE_API_URL = import.meta.env.VITE_SQLITE_API_URL || '';
const DEFAULT_API_URL = SQLITE_API_URL ? `${SQLITE_API_URL}/monitoring/healthchecks` : '/api/monitoring/healthchecks';

const DEFAULT_CONFIG: HealthchecksWidgetConfig = {
  title: 'Job Monitoring',
  apiUrl: DEFAULT_API_URL,
  baseUrl: '',
  apiKey: '',
  refreshInterval: 60,
  tagFilter: '',
  statusFilter: 'all',
  showTags: true,
  showDescription: false,
};

type Props = {
  width: number;
  height: number;
  config?: HealthchecksWidgetConfig;
};

const STATUS_STYLES: Record<HealthchecksStatus, { badge: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
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
  grace: {
    badge: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
    icon: AlertCircle,
    label: 'Grace',
  },
  late: {
    badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
    icon: Siren,
    label: 'Late',
  },
  new: {
    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    icon: Timer,
    label: 'New',
  },
  paused: {
    badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
    icon: Clock3,
    label: 'Paused',
  },
};

const ATTENTION_STATUSES: HealthchecksStatus[] = ['down', 'late', 'grace'];

const mergeConfig = (config?: HealthchecksWidgetConfig): HealthchecksWidgetConfig => ({
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

const sortChecks = (checks: HealthchecksCheck[]) => {
  const rank: Record<HealthchecksStatus, number> = {
    down: 0,
    late: 1,
    grace: 2,
    paused: 3,
    new: 4,
    up: 5,
  };

  return [...checks].sort((a, b) => {
    const rankDiff = rank[a.status] - rank[b.status];
    return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
  });
};

const HealthchecksWidget: React.FC<Props> = ({ width, height, config }) => {
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const mergedConfig = useMemo(() => mergeConfig(config), [config]);
  const automaticMaxItems = useMemo(() => getAutomaticMonitoringItemLimit(width, height), [width, height]);
  const [localConfig, setLocalConfig] = useState<HealthchecksWidgetConfig>(mergedConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [data, setData] = useState<HealthchecksWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCheckSlug, setSelectedCheckSlug] = useState<string | null>(null);
  const hasCustomHealthchecksConfig = Boolean(localConfig.baseUrl?.trim() && localConfig.apiKey?.trim());
  const shouldUseServerFallback = !hasCustomHealthchecksConfig;
  const shouldShowSetupPrompt = !data && !loading && shouldUseServerFallback && error === 'Healthchecks monitoring is not configured';

  useEffect(() => {
    setLocalConfig(mergedConfig);
  }, [mergedConfig]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(localConfig.apiUrl || DEFAULT_API_URL, {
        method: hasCustomHealthchecksConfig ? 'POST' : 'GET',
        headers: hasCustomHealthchecksConfig ? { 'Content-Type': 'application/json' } : undefined,
        body: hasCustomHealthchecksConfig
          ? JSON.stringify({
              baseUrl: localConfig.baseUrl?.trim(),
              apiKey: localConfig.apiKey?.trim(),
            })
          : undefined,
        signal: AbortSignal.timeout(10000),
      });
      const payload = await readMonitoringJson<HealthchecksWidgetData>(response, 'Healthchecks');
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [hasCustomHealthchecksConfig, localConfig.apiKey, localConfig.apiUrl, localConfig.baseUrl]);

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, Math.max(15, localConfig.refreshInterval || 60) * 1000);
    return () => window.clearInterval(interval);
  }, [fetchData, localConfig.refreshInterval]);

  const checks = useMemo(() => {
    const tagFilter = (localConfig.tagFilter || '').trim().toLowerCase();

    const filtered = (data?.checks ?? []).filter((check) => {
      const matchesQuery = query
        ? `${check.name} ${check.slug} ${check.tags} ${check.description}`.toLowerCase().includes(query.toLowerCase())
        : true;
      const matchesTag = tagFilter ? check.tags.toLowerCase().includes(tagFilter) : true;
      const matchesStatus = localConfig.statusFilter === 'attention'
        ? ATTENTION_STATUSES.includes(check.status)
        : localConfig.statusFilter === 'healthy'
          ? check.status === 'up'
          : true;

      return matchesQuery && matchesTag && matchesStatus;
    });

    return sortChecks(filtered);
  }, [data?.checks, localConfig.statusFilter, localConfig.tagFilter, query]);

  useEffect(() => {
    if (!checks.length) {
      setSelectedCheckSlug(null);
      return;
    }

    setSelectedCheckSlug((current) =>
      current && checks.some((check) => check.slug === current) ? current : checks[0].slug,
    );
  }, [checks]);

  const selectedCheck = useMemo(
    () => checks.find((check) => check.slug === selectedCheckSlug) ?? null,
    [checks, selectedCheckSlug],
  );

  const resolvedMaxItems = useMemo(
    () => getMonitoringItemLimit(width, height, localConfig.maxItems),
    [height, localConfig.maxItems, width],
  );

  const visibleChecks = useMemo(() => {
    if (typeof resolvedMaxItems !== 'number') {
      return checks;
    }

    return checks.slice(0, resolvedMaxItems);
  }, [checks, resolvedMaxItems]);

  const summary = useMemo(() => {
    const all = data?.checks ?? [];
    return all.reduce(
      (acc, check) => {
        acc.total += 1;
        if (check.status === 'up') acc.up += 1;
        if (check.status === 'down') acc.down += 1;
        if (check.status === 'grace') acc.grace += 1;
        if (check.status === 'late') acc.late += 1;
        if (check.status === 'new') acc.new += 1;
        if (check.status === 'paused') acc.paused += 1;
        return acc;
      },
      { total: 0, up: 0, down: 0, grace: 0, late: 0, new: 0, paused: 0 },
    );
  }, [data?.checks]);

  const attentionCount = summary.down + summary.late + summary.grace;
  const openUrl = sanitizeUrl(localConfig.dashboardUrl || data?.dashboardUrl);

  const saveSettings = () => {
    config?.onUpdate?.(localConfig);
    setShowSettings(false);
  };

  const renderSetupPrompt = () => {
    if (isTiny) {
      return (
        <div className="flex h-full items-center justify-center">
          <Clock3 className="h-5 w-5 text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <Settings className="h-8 w-8" />
        <p className="text-sm">Add your Healthchecks URL and read-only API key to get started.</p>
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
          aria-label="Open Healthchecks settings"
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
    <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-sm text-muted-foreground">
      <AlertCircle className="h-5 w-5" />
      <span>{message}</span>
    </div>
  );

  const renderStatusPills = () => (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-green-700 dark:text-green-300">
        {summary.up} healthy
      </span>
      {attentionCount > 0 && (
        <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-red-700 dark:text-red-300">
          {attentionCount} need attention
        </span>
      )}
      <span className="rounded-full bg-muted px-2.5 py-1">
        {summary.total} total
      </span>
    </div>
  );

  const renderActions = (textOnly = false) => (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Button
        variant="ghost"
        size={textOnly ? 'sm' : 'icon'}
        onClick={fetchData}
        className={cn(textOnly ? 'h-7 px-2' : 'h-7 w-7')}
        aria-label="Refresh job monitoring"
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
            aria-label="Open Healthchecks"
          >
            <ExternalLink className="h-4 w-4" />
            {textOnly && <span className="ml-1">Open</span>}
          </Button>
        </a>
      )}
    </div>
  );

  const renderCheckRow = (check: HealthchecksCheck, compact = false, selected = false) => {
    const statusStyle = STATUS_STYLES[check.status];
    const StatusIcon = statusStyle.icon;

    return (
      <Button type="button" variant="ghost" size="none"
        key={check.slug}
        onClick={() => setSelectedCheckSlug(check.slug)}
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
              <span className="truncate text-sm font-medium text-foreground">{check.name}</span>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {localConfig.showTags && check.tags ? `${check.tags} · ` : ''}{check.slug}
            </div>
            {!compact && localConfig.showDescription && check.description && (
              <div className="truncate text-xs text-muted-foreground">
                {check.description}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              {check.lastDuration != null ? `${check.lastDuration}s` : 'No run'} · {formatRelative(check.lastPing)}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className={cn('rounded-full px-2 py-1 text-[11px] font-medium', statusStyle.badge)}>
              {statusStyle.label}
            </span>
            {!compact && (
              <span className="text-[11px] text-muted-foreground">
                grace {Math.round(check.graceSeconds / 3600)}h
              </span>
            )}
          </div>
        </div>
      </Button>
    );
  };

  const renderDetail = (check: HealthchecksCheck | null) => {
    if (!check) return renderEmpty('Select a check to view details.');

    const statusStyle = STATUS_STYLES[check.status];
    const StatusIcon = statusStyle.icon;

    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusIcon className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">{check.name}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {check.tags && localConfig.showTags && <span>{check.tags}</span>}
            <span>{check.slug}</span>
            <span className={cn('rounded-full px-2 py-1 font-medium', statusStyle.badge)}>{statusStyle.label}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/60 p-3">
            <div className="text-xs text-muted-foreground">Last run</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {check.lastDuration != null ? `${check.lastDuration}s` : 'N/A'}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <div className="text-xs text-muted-foreground">Grace window</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {Math.round(check.graceSeconds / 60)} min
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 p-3">
          <div className="text-xs text-muted-foreground">Last ping</div>
          <div className="mt-1 text-sm text-foreground">{formatRelative(check.lastPing)}</div>
          {check.nextPing && (
            <>
              <div className="mt-3 text-xs text-muted-foreground">Next expected ping</div>
              <div className="mt-1 text-sm text-foreground">{formatRelative(check.nextPing)}</div>
            </>
          )}
          {localConfig.showDescription && check.description && (
            <>
              <div className="mt-3 text-xs text-muted-foreground">Description</div>
              <div className="mt-1 text-sm text-foreground">{check.description}</div>
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
        {attentionCount > 0 ? `${attentionCount} alert${attentionCount > 1 ? 's' : ''}` : 'healthy'}
      </div>
    </div>
  );

  const renderShort = () => (
    <div className="flex h-full items-center gap-2 overflow-x-auto px-1">
      {renderStatusPills()}
      {visibleChecks.slice(0, 4).map((check) => {
        const statusStyle = STATUS_STYLES[check.status];
        return (
          <div key={check.slug} className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium', statusStyle.badge)}>
            {check.name}
          </div>
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
        {visibleChecks.length > 0
          ? visibleChecks.slice(0, 3).map((check) => renderCheckRow(check, true))
          : renderEmpty('No checks match the current filters.')}
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
        {visibleChecks.length > 0
          ? visibleChecks.map((check) => renderCheckRow(check))
          : renderEmpty('No checks match the current filters.')}
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
          {visibleChecks.length > 0
            ? visibleChecks.map((check) => renderCheckRow(check, false, check.slug === selectedCheckSlug))
            : renderEmpty('No checks match the current filters.')}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {renderDetail(selectedCheck)}
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
                placeholder="Search checks"
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-auto p-3">
            {checks.length > 0
              ? checks.map((check) => renderCheckRow(check, false, check.slug === selectedCheckSlug))
              : renderEmpty('No checks match the current filters.')}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {renderDetail(selectedCheck)}
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
        description="Configure the Healthchecks instance, API key, and backend endpoint."
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
                <Label htmlFor="health-title">Title</Label>
                <Input
                  id="health-title"
                  value={localConfig.title || ''}
                  onChange={(event) => setLocalConfig((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="health-base-url">Healthchecks URL *</Label>
                <Input
                  id="health-base-url"
                  type="url"
                  value={localConfig.baseUrl || ''}
                  onChange={(event) => setLocalConfig((prev) => ({ ...prev, baseUrl: event.target.value }))}
                  placeholder="https://healthchecks.example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Required. Your Healthchecks instance base URL.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="health-api-key">Read-only API Key *</Label>
                <Input
                  id="health-api-key"
                  type="password"
                  value={localConfig.apiKey || ''}
                  onChange={(event) => setLocalConfig((prev) => ({ ...prev, apiKey: event.target.value }))}
                  placeholder="hcs_..."
                />
                <p className="text-xs text-muted-foreground">
                  Required. Stored as an encrypted widget config field by Boxento.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="health-api-url">Backend Endpoint</Label>
                <Input
                  id="health-api-url"
                  value={localConfig.apiUrl || ''}
                  onChange={(event) => setLocalConfig((prev) => ({ ...prev, apiUrl: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Advanced: override the Boxento backend endpoint used by this widget.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="health-dashboard-url">Open URL Override</Label>
                <Input
                  id="health-dashboard-url"
                  value={localConfig.dashboardUrl || ''}
                  onChange={(event) => setLocalConfig((prev) => ({ ...prev, dashboardUrl: event.target.value }))}
                  placeholder="Optional override for external link"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="health-refresh">Refresh (s)</Label>
                  <Input
                    id="health-refresh"
                    type="number"
                    min={15}
                    value={localConfig.refreshInterval || DEFAULT_CONFIG.refreshInterval || 60}
                    onChange={(event) => setLocalConfig((prev) => ({ ...prev, refreshInterval: Number(event.target.value) || 60 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="health-max-items">Item limit</Label>
                  <Input
                    id="health-max-items"
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
                <Label htmlFor="health-tag-filter">Tag filter</Label>
                <Input
                  id="health-tag-filter"
                  value={localConfig.tagFilter || ''}
                  onChange={(event) => setLocalConfig((prev) => ({ ...prev, tagFilter: event.target.value }))}
                  placeholder="Optional tag"
                />
              </div>
              <div className="space-y-2">
                <Label>Status filter</Label>
                <Select
                  value={localConfig.statusFilter || 'all'}
                  onValueChange={(value) => setLocalConfig((prev) => ({
                    ...prev,
                    statusFilter: value as HealthchecksWidgetConfig['statusFilter'],
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All checks</SelectItem>
                    <SelectItem value="attention">Needs attention</SelectItem>
                    <SelectItem value="healthy">Healthy only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="health-show-tags">Show tags</Label>
                <Switch
                  id="health-show-tags"
                  checked={Boolean(localConfig.showTags)}
                  onCheckedChange={(checked) => setLocalConfig((prev) => ({ ...prev, showTags: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="health-show-description">Show descriptions</Label>
                <Switch
                  id="health-show-description"
                  checked={Boolean(localConfig.showDescription)}
                  onCheckedChange={(checked) => setLocalConfig((prev) => ({ ...prev, showDescription: checked }))}
                />
              </div>
            </div>
      </WidgetSettingsDialog>
    </div>
  );
};

export default HealthchecksWidget;
