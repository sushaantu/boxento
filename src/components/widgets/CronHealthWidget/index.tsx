import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { parseJsonResponseText } from '@/lib/jsonResponseGuard';
import WidgetHeader from '../common/WidgetHeader';
import { WidgetProps } from '@/types';
import { CronHealthWidgetConfig, Job, HealthResponse } from './types';
import {
  Server,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Timer,
  Search,
  ChevronLeft,
  Activity,
  Clock,
  Settings2
} from 'lucide-react';

type CronHealthWidgetProps = WidgetProps<CronHealthWidgetConfig>;

// Base URL for services - override with VITE_SERVICES_BASE_URL env var
const SERVICES_BASE_URL = import.meta.env.VITE_SERVICES_BASE_URL || 'http://localhost';

const DEFAULT_CONFIG: CronHealthWidgetConfig = {
  title: 'System Health',
  apiUrl: `${SERVICES_BASE_URL}:7505`,
  refreshInterval: 60
};

const CronHealthWidget: React.FC<CronHealthWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<CronHealthWidgetConfig>({
    ...DEFAULT_CONFIG,
    ...config
  });
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // App-mode state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Update local config when props change
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Fetch health data
  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(localConfig.apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      const data = parseJsonResponseText<HealthResponse>(body, response);
      setHealthData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [localConfig.apiUrl]);

  // Fetch on mount and interval
  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, (localConfig.refreshInterval || 60) * 1000);
    return () => clearInterval(interval);
  }, [fetchHealth, localConfig.refreshInterval]);

  // Computed stats
  const stats = useMemo(() => {
    if (!healthData) return { running: 0, failed: 0, stopped: 0, total: 0 };
    return healthData.jobs.reduce(
      (acc, j) => {
        if (j.status === 'running' || j.status === 'success') acc.running++;
        else if (j.status === 'failed') acc.failed++;
        else acc.stopped++;
        return acc;
      },
      { running: 0, failed: 0, stopped: 0, total: healthData.jobs.length }
    );
  }, [healthData]);

  // Filtered jobs for app/panel modes
  const filteredJobs = useMemo(() => {
    if (!healthData) return [];
    return healthData.jobs.filter(job => {
      const matchesSearch = !searchQuery ||
        job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.message && job.message.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter = filterStatus === 'all' ||
        (filterStatus === 'healthy' && (job.status === 'running' || job.status === 'success')) ||
        (filterStatus === 'failed' && job.status === 'failed') ||
        (filterStatus === 'stopped' && (job.status === 'stopped' || job.status === 'unloaded'));
      return matchesSearch && matchesFilter;
    });
  }, [healthData, searchQuery, filterStatus]);

  const selectedJob = useMemo(() => {
    if (!selectedJobId || !healthData) return null;
    return healthData.jobs.find(j => j.id === selectedJobId) || null;
  }, [selectedJobId, healthData]);

  // Get status icon and color
  const getStatusDisplay = (status: Job['status']) => {
    switch (status) {
      case 'running':
      case 'success':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500', label: 'Healthy' };
      case 'failed':
        return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500', label: 'Failed' };
      case 'stopped':
      case 'unloaded':
        return { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'Stopped' };
      default:
        return { icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted-foreground', label: 'Unknown' };
    }
  };

  // Get job type icon
  const getJobIcon = (type: Job['type']) => {
    return type === 'cron' ? Timer : Server;
  };

  // Format time ago
  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr.replace(' ', 'T'));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'just now';
  };

  // Format full date
  const formatFullDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr.replace(' ', 'T'));
    return date.toLocaleString();
  };

  // --- Loading / Error / Empty states ---
  const renderLoading = () => (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <RefreshCw className="w-5 h-5 animate-spin" />
    </div>
  );

  const renderError = () => (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <XCircle className="w-6 h-6 mb-1 text-red-500" />
      <span className="text-xs">{error}</span>
      <Button variant="link" size="sm" onClick={fetchHealth} className="text-xs mt-1 h-auto p-0">Retry</Button>
    </div>
  );

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <Server className="w-6 h-6 mb-1" />
      <span className="text-xs">No jobs found</span>
    </div>
  );

  // --- Shared sub-renderers ---
  const renderSummaryBadges = () => {
    const summaryTone = stats.failed > 0
      ? 'bg-red-500/10 text-red-700 dark:text-red-300'
      : 'bg-green-500/10 text-green-700 dark:text-green-300';
    const SummaryIcon = stats.failed > 0 ? AlertCircle : CheckCircle;

    return (
      <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-muted-foreground">
        <Badge variant="secondary" className={`px-2.5 py-1 ${summaryTone}`}>
          <SummaryIcon aria-hidden="true" />
          <span>{stats.running}/{stats.total} ok</span>
        </Badge>
        {stats.failed > 0 && (
          <Badge variant="secondary" className="bg-red-500/10 px-2.5 py-1 text-red-700 dark:text-red-300">
            {stats.failed} failed
          </Badge>
        )}
        {stats.stopped > 0 && (
          <Badge variant="secondary" className="bg-yellow-500/10 px-2.5 py-1 text-yellow-700 dark:text-yellow-300">
            {stats.stopped} stopped
          </Badge>
        )}
      </div>
    );
  };

  // --- Size-specific renderers (most specific first) ---

  const renderTiny = () => {
    if (loading && !healthData) return renderLoading();
    if (error) return (
      <div className="flex h-full items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-red-500" />
      </div>
    );
    if (!healthData || healthData.jobs.length === 0) return (
      <div className="flex h-full items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-muted-foreground" />
      </div>
    );

    const summaryTone = stats.failed > 0
      ? 'text-red-600 dark:text-red-300'
      : 'text-green-600 dark:text-green-300';

    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <div className="text-lg font-semibold leading-none text-foreground">
          {stats.running}/{stats.total}
        </div>
        <div className={`text-[10px] uppercase tracking-wide ${summaryTone}`}>
          {stats.failed > 0 ? `${stats.failed} issue${stats.failed > 1 ? 's' : ''}` : 'healthy'}
        </div>
      </div>
    );
  };

  const renderShort = () => {
    if (loading && !healthData) return renderLoading();
    if (error) return renderError();
    if (!healthData || healthData.jobs.length === 0) return renderEmpty();

    const SummaryIcon = stats.failed > 0 ? AlertCircle : CheckCircle;
    const problematicJob = healthData.jobs.find(j =>
      j.status === 'failed' || j.status === 'stopped' || j.status === 'unloaded'
    ) || healthData.jobs[0];

    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs text-muted-foreground">
        <Badge variant="secondary" className={`shrink-0 px-2 py-1 ${stats.failed > 0 ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-green-500/10 text-green-700 dark:text-green-300'}`}>
          <SummaryIcon aria-hidden="true" />
          <span>{stats.running}/{stats.total} ok</span>
        </Badge>
        {stats.failed > 0 && (
          <Badge variant="secondary" className="shrink-0 bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-300">
            {stats.failed} failed
          </Badge>
        )}
        <Badge variant="secondary" className="min-w-0 truncate bg-black/[0.04] px-2 py-1 text-foreground dark:bg-white/[0.06]">
          {problematicJob?.name}
        </Badge>
        {healthData.updated && (
          <div className="shrink-0 text-[11px] text-muted-foreground">
            {formatTimeAgo(healthData.updated)}
          </div>
        )}
      </div>
    );
  };

  const renderCompact = () => {
    if (loading && !healthData) return renderLoading();
    if (error) return renderError();
    if (!healthData || healthData.jobs.length === 0) return renderEmpty();

    return (
      <div className="h-full flex flex-col gap-1 overflow-hidden">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-0.5">
          <span className="text-green-500 font-medium">{stats.running} ok</span>
          {stats.failed > 0 && <span className="text-red-500 font-medium">{stats.failed} fail</span>}
          <span className="flex-grow" />
          <span>{stats.total}</span>
        </div>
        <div className="flex-1 overflow-auto space-y-0.5">
          {healthData.jobs.map(job => {
            const statusDisplay = getStatusDisplay(job.status);
            return (
              <div
                key={job.id}
                className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-accent"
                title={`${job.name}: ${job.message || job.status}`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${statusDisplay.bg}`} />
                <span className="text-xs truncate flex-grow text-foreground">{job.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDefault = () => {
    if (loading && !healthData) return renderLoading();
    if (error) return renderError();
    if (!healthData || healthData.jobs.length === 0) return renderEmpty();

    return (
      <div className="h-full flex flex-col gap-2 overflow-hidden">
        {renderSummaryBadges()}

        <div className="flex-1 overflow-auto space-y-1">
          {healthData.jobs.map(job => {
            const statusDisplay = getStatusDisplay(job.status);
            const StatusIcon = statusDisplay.icon;
            const JobIcon = getJobIcon(job.type);

            return (
              <div
                key={job.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/10"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <JobIcon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate text-foreground">{job.name}</span>
                    <StatusIcon className={`w-4 h-4 shrink-0 ${statusDisplay.color}`} />
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {job.message}
                    {job.lastRun && (
                      <span className="ml-2 opacity-70">{formatTimeAgo(job.lastRun)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {healthData.updated && (
          <div className="text-xs text-muted-foreground text-right px-1">
            Updated: {formatTimeAgo(healthData.updated)}
          </div>
        )}
      </div>
    );
  };

  const renderPanel = () => {
    if (loading && !healthData) return renderLoading();
    if (error) return renderError();
    if (!healthData || healthData.jobs.length === 0) return renderEmpty();

    const failedJobs = healthData.jobs.filter(j => j.status === 'failed');
    const stoppedJobs = healthData.jobs.filter(j => j.status === 'stopped' || j.status === 'unloaded');
    const healthyJobs = healthData.jobs.filter(j => j.status === 'running' || j.status === 'success');

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Summary bar */}
        <div className="flex items-center justify-between px-2 py-1.5">
          {renderSummaryBadges()}
          <div className="flex items-center gap-2">
            {healthData.updated && (
              <span className="text-[11px] text-muted-foreground">{formatTimeAgo(healthData.updated)}</span>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchHealth} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Two-column content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Primary column: all jobs */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {healthData.jobs.map(job => {
              const statusDisplay = getStatusDisplay(job.status);
              const StatusIcon = statusDisplay.icon;
              const JobIcon = getJobIcon(job.type);

              return (
                <div
                  key={job.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/10"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                    <JobIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate text-foreground">{job.name}</span>
                      <StatusIcon className={`w-4 h-4 shrink-0 ${statusDisplay.color}`} />
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {job.message}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span className="capitalize">{job.type}</span>
                      {job.schedule && <span>Schedule: {job.schedule}</span>}
                      {job.lastRun && <span>{formatTimeAgo(job.lastRun)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Secondary column: summary breakdown */}
          <div className="w-2/5 border-l border-border/50 overflow-y-auto p-2 space-y-3">
            {failedJobs.length > 0 && (
              <div>
                <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5" />
                  Failed ({failedJobs.length})
                </div>
                <div className="space-y-1">
                  {failedJobs.map(job => (
                    <div key={job.id} className="rounded-md bg-red-500/5 px-2 py-1.5 text-xs">
                      <div className="font-medium text-foreground truncate">{job.name}</div>
                      {job.message && (
                        <div className="text-muted-foreground truncate mt-0.5">{job.message}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stoppedJobs.length > 0 && (
              <div>
                <div className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Stopped ({stoppedJobs.length})
                </div>
                <div className="space-y-1">
                  {stoppedJobs.map(job => (
                    <div key={job.id} className="rounded-md bg-yellow-500/5 px-2 py-1.5 text-xs">
                      <div className="font-medium text-foreground truncate">{job.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Healthy ({healthyJobs.length})
              </div>
              <div className="space-y-1">
                {healthyJobs.map(job => (
                  <div key={job.id} className="rounded-md bg-green-500/5 px-2 py-1.5 text-xs">
                    <div className="font-medium text-foreground truncate">{job.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderApp = () => {
    if (loading && !healthData) return renderLoading();
    if (error) return renderError();
    if (!healthData || healthData.jobs.length === 0) return renderEmpty();

    const filterTabs = [
      { key: 'all', label: 'All', count: healthData.jobs.length },
      { key: 'healthy', label: 'Healthy', count: stats.running },
      { key: 'failed', label: 'Failed', count: stats.failed },
      { key: 'stopped', label: 'Stopped', count: stats.stopped },
    ];

    return (
      <div className="flex h-full overflow-hidden">
        {/* Master list */}
        <div className="w-1/3 border-r border-border/50 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-2 widget-drag-handle cursor-move">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex border-b border-border/50 px-2 overflow-x-auto">
            {filterTabs.map(tab => (
              <Button type="button" variant="ghost" size="none"
                key={tab.key}
                className={`px-3 py-2 text-xs whitespace-nowrap ${filterStatus === tab.key ? 'border-b-2 border-primary font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setFilterStatus(tab.key)}
              >
                {tab.label} ({tab.count})
              </Button>
            ))}
          </div>

          {/* Job list */}
          <div className="flex-1 overflow-y-auto">
            {filteredJobs.map(job => {
              const statusDisplay = getStatusDisplay(job.status);
              const JobIcon = getJobIcon(job.type);
              const isSelected = selectedJobId === job.id;

              return (
                <Button type="button" variant="ghost" size="none"
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full text-left flex items-center gap-3 p-3 border-b border-border/30 transition-colors hover:bg-accent ${isSelected ? 'bg-accent' : ''}`}
                >
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center`}>
                    <JobIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate text-foreground">{job.name}</span>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${statusDisplay.bg}`} />
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {job.message || statusDisplay.label}
                    </div>
                  </div>
                </Button>
              );
            })}
            {filteredJobs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Search className="h-5 w-5 mb-2" />
                <span className="text-xs">No matching jobs</span>
              </div>
            )}
          </div>
        </div>

        {/* Detail pane */}
        <div className="flex-1 overflow-y-auto">
          {selectedJob ? (
            <div className="p-4 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    {React.createElement(getJobIcon(selectedJob.type), { className: 'w-6 h-6 text-muted-foreground' })}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-foreground truncate">{selectedJob.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        selectedJob.status === 'running' || selectedJob.status === 'success'
                          ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                          : selectedJob.status === 'failed'
                          ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                          : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'
                      }`}>
                        {React.createElement(getStatusDisplay(selectedJob.status).icon, { className: 'h-3.5 w-3.5' })}
                        <span className="capitalize">{selectedJob.status}</span>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{selectedJob.type}</span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSelectedJobId(null)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              {/* Details grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                {selectedJob.message && (
                  <div className="sm:col-span-2 rounded-lg border border-border/70 p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Message</div>
                    <div className="text-sm text-foreground">{selectedJob.message}</div>
                  </div>
                )}

                {selectedJob.schedule && (
                  <div className="rounded-lg border border-border/70 p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Schedule
                    </div>
                    <div className="text-sm font-mono text-foreground">{selectedJob.schedule}</div>
                  </div>
                )}

                {selectedJob.lastRun && (
                  <div className="rounded-lg border border-border/70 p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      Last Run
                    </div>
                    <div className="text-sm text-foreground">{formatFullDate(selectedJob.lastRun)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatTimeAgo(selectedJob.lastRun)}</div>
                  </div>
                )}

                <div className="rounded-lg border border-border/70 p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Server className="h-3 w-3" />
                    Type
                  </div>
                  <div className="text-sm text-foreground capitalize">{selectedJob.type}</div>
                </div>

                <div className="rounded-lg border border-border/70 p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Job ID</div>
                  <div className="text-sm font-mono text-foreground">{selectedJob.id}</div>
                </div>
              </div>

              {healthData.updated && (
                <div className="text-xs text-muted-foreground">
                  Data updated: {formatFullDate(healthData.updated)} ({formatTimeAgo(healthData.updated)})
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <Activity className="h-10 w-10 opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium">Select a job</p>
                <p className="text-xs mt-1">Choose a job from the list to view details</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2 text-xs">
                <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-green-700 dark:text-green-300">
                  {stats.running} healthy
                </span>
                {stats.failed > 0 && (
                  <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-red-700 dark:text-red-300">
                    {stats.failed} failed
                  </span>
                )}
                {stats.stopped > 0 && (
                  <span className="rounded-full bg-yellow-500/10 px-2.5 py-1 text-yellow-700 dark:text-yellow-300">
                    {stats.stopped} stopped
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Settings modal with snapshot/revert ---
  const handleSettingsOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      // Snapshot current persisted config
      setLocalConfig({ ...DEFAULT_CONFIG, ...config });
    } else {
      // Revert to persisted config on close
      setLocalConfig({ ...DEFAULT_CONFIG, ...config });
    }
    setShowSettings(nextOpen);
  }, [config]);

  const handleCancelSettings = useCallback(() => {
    setLocalConfig({ ...DEFAULT_CONFIG, ...config });
    setShowSettings(false);
  }, [config]);

  const saveSettings = useCallback(() => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  }, [config, localConfig]);

  // --- Setup prompt if no API URL ---
  if (!localConfig.apiUrl) {
    return (
      <div className="w-full h-full flex flex-col bg-card rounded-lg p-2 md:p-3">
        <WidgetHeader title={localConfig.title} onSettingsClick={readOnly ? undefined : () => setShowSettings(true)} />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Settings2 className="h-8 w-8" />
          <p className="text-sm">Configure the health API URL</p>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              Open Settings
            </Button>
          )}
        </div>
        {renderSettingsDialog()}
      </div>
    );
  }

  function renderSettingsDialog() {
    return (
      <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
        <DialogContent className="settings-dialog-content sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{localConfig.title || 'System Health'} Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title-input">Title</Label>
              <Input
                id="title-input"
                type="text"
                value={localConfig.title || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalConfig(prev => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="api-url">Health API URL</Label>
              <Input
                id="api-url"
                type="url"
                value={localConfig.apiUrl || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalConfig(prev => ({ ...prev, apiUrl: e.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="refresh-interval">Refresh Interval (seconds)</Label>
              <Input
                id="refresh-interval"
                type="number"
                min={10}
                value={localConfig.refreshInterval || 60}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalConfig(prev => ({ ...prev, refreshInterval: parseInt(e.target.value, 10) || 60 }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <div className="flex justify-between w-full">
              {config?.onDelete && (
                <Button variant="destructive" onClick={config.onDelete}>Delete Widget</Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" onClick={handleCancelSettings}>Cancel</Button>
                <Button onClick={saveSettings}>Save</Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className={`widget-container h-full flex flex-col relative ${isTiny ? 'widget-drag-handle' : ''}`}>
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title || DEFAULT_CONFIG.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={width === 1 || height === 1}
        />
      )}

      <div className={`flex-grow overflow-hidden ${isTiny ? 'p-2' : isShort ? 'p-1.5' : 'p-2'}`}>
        {isTiny ? renderTiny()
          : isShort ? renderShort()
          : isApp ? renderApp()
          : isWide && isTall ? renderPanel()
          : isCompact ? renderCompact()
          : renderDefault()}
      </div>

      {!readOnly && renderSettingsDialog()}
    </div>
  );
};

export default CronHealthWidget;
