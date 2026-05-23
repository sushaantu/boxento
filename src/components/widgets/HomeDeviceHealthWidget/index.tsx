import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BatteryWarning, CheckCircle2, Download, RefreshCw, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WidgetShell } from '../common/WidgetShell';
import {
  HomeEmptyState,
  HomeErrorState,
  HomeLoadingState,
  HomeMetricTile,
  HomeRefreshingBadge,
  HomeSetupState,
  HomeTinyStatus,
} from '../homeAssistant/components';
import { HomeAssistantSettingsDialog } from '../homeAssistant/settings';
import { useHomeAssistantData } from '../homeAssistant/useHomeAssistantData';
import {
  formatRelativeTime,
  getHealthIssues,
  toPersistedHomeAssistantConfig,
} from '../homeAssistant/utils';
import type { HomeAssistantHealthIssue } from '../homeAssistant/types';
import type { HomeDeviceHealthWidgetConfig, HomeDeviceHealthWidgetProps } from './types';

const DEFAULT_CONFIG: HomeDeviceHealthWidgetConfig = {
  title: 'Device Health',
  baseUrl: '',
  apiToken: '',
  refreshInterval: 30,
  areaId: '',
  entityIds: [],
  batteryThreshold: 20,
};

const HomeDeviceHealthWidget: React.FC<HomeDeviceHealthWidgetProps> = ({ width, height, config }) => {
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const appliedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const [draftConfig, setDraftConfig] = useState<HomeDeviceHealthWidgetConfig>(appliedConfig);
  const [showSettings, setShowSettings] = useState(false);
  const { snapshot, loading, refreshing, error, canFetch, refresh } = useHomeAssistantData(appliedConfig);

  useEffect(() => {
    setDraftConfig(appliedConfig);
  }, [appliedConfig]);

  const issues = useMemo(() => (
    getHealthIssues(snapshot, appliedConfig.batteryThreshold)
      .filter((issue) => !appliedConfig.areaId || issue.entity.areaId === appliedConfig.areaId)
      .filter((issue) => !appliedConfig.entityIds?.length || appliedConfig.entityIds.includes(issue.entity.entityId))
  ), [appliedConfig.areaId, appliedConfig.batteryThreshold, appliedConfig.entityIds, snapshot]);

  const unavailableCount = issues.filter((issue) => issue.kind === 'unavailable').length;
  const batteryCount = issues.filter((issue) => issue.kind === 'battery').length;
  const updateCount = issues.filter((issue) => issue.kind === 'update').length;
  const visibleIssues = issues.slice(0, isApp ? 24 : 8);

  const resetSettings = () => {
    setDraftConfig(appliedConfig);
    setShowSettings(false);
  };

  const saveSettings = () => {
    config?.onUpdate?.(toPersistedHomeAssistantConfig(draftConfig));
    setShowSettings(false);
  };

  const renderContent = () => {
    if (!canFetch) return <HomeSetupState readOnly={readOnly} onSettingsClick={() => setShowSettings(true)} />;
    if (loading) return <HomeLoadingState compact={isCompact} />;
    if (error) return <HomeErrorState message={error} onRetry={refresh} />;

    if (isTiny) {
      return <HomeTinyStatus value={issues.length || 'OK'} label={issues.length ? 'Issues' : 'Health'} tone={issues.length ? 'danger' : 'good'} />;
    }

    if (isShort) {
      return (
        <div className="flex h-full min-h-0 items-center gap-2 p-2">
          <HomeMetricTile compact label="Offline" value={unavailableCount} tone={unavailableCount ? 'danger' : 'good'} />
          <HomeMetricTile compact label="Battery" value={batteryCount} tone={batteryCount ? 'warning' : 'good'} />
          <HomeMetricTile compact label="Updates" value={updateCount} />
          <HomeRefreshingBadge refreshing={refreshing} />
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          <HomeMetricTile compact label="Offline" value={unavailableCount} tone={unavailableCount ? 'danger' : 'good'} />
          <HomeMetricTile compact label="Battery" value={batteryCount} tone={batteryCount ? 'warning' : 'good'} />
          <HomeMetricTile compact label="Updates" value={updateCount} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleIssues.length ? (
            visibleIssues.map((issue) => <IssueRow key={`${issue.kind}-${issue.entity.entityId}`} issue={issue} dense={isCompact} />)
          ) : (
            <HomeEmptyState label="All devices look healthy" />
          )}
        </div>
      </div>
    );
  };

  return (
    <WidgetShell
      title={appliedConfig.title || DEFAULT_CONFIG.title}
      isTiny={isTiny}
      hideHeader={isApp}
      compactHeader={isShort}
      onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
      contentClassName={isTiny ? 'p-1' : ''}
      headerActions={!isTiny && !isApp ? (
        <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={(event) => {
          event.stopPropagation();
          refresh();
        }} aria-label="Refresh device health">
          <RefreshCw className="size-4" />
        </Button>
      ) : undefined}
    >
      {renderContent()}
      {!readOnly ? (
        <HomeAssistantSettingsDialog
          open={showSettings}
          title="Device Health Settings"
          config={draftConfig}
          areas={snapshot?.areas}
          showArea
          showEntityIds
          entityHelp="Optional. Leave empty to monitor all matching health signals."
          onConfigChange={setDraftConfig}
          onOpenChange={setShowSettings}
          onCancel={resetSettings}
          onSave={saveSettings}
          onDelete={config?.onDelete}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="ha-battery-threshold">Low Battery Threshold</Label>
            <Input
              id="ha-battery-threshold"
              type="number"
              min={1}
              max={100}
              value={String(draftConfig.batteryThreshold || 20)}
              onChange={(event) => setDraftConfig((current) => ({
                ...current,
                batteryThreshold: Number(event.target.value) || 20,
              }))}
            />
          </div>
        </HomeAssistantSettingsDialog>
      ) : null}
    </WidgetShell>
  );
};

function IssueRow({ issue, dense }: { issue: HomeAssistantHealthIssue; dense: boolean }) {
  const Icon = issue.kind === 'battery'
    ? BatteryWarning
    : issue.kind === 'update'
      ? Download
      : WifiOff;

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/60">
      <Icon className={issue.severity === 'critical' ? 'size-4 shrink-0 text-destructive' : 'size-4 shrink-0 text-yellow-600 dark:text-yellow-300'} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className={dense ? 'truncate text-xs font-medium text-foreground' : 'truncate text-sm font-medium text-foreground'}>
          {issue.entity.name}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {issue.label} · {formatRelativeTime(issue.entity.lastChanged)}
        </div>
      </div>
      {issue.severity === 'critical' ? (
        <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}

export default HomeDeviceHealthWidget;
