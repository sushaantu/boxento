import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { useHomeAssistantOptimisticStates } from '../homeAssistant/optimisticEntityStates';
import { useHomeAssistantData } from '../homeAssistant/useHomeAssistantData';
import {
  applyEntityStateOverrides,
  getHealthIssues,
  isActiveSecurityEntity,
  isEntityOn,
  removeRedundantAggregateEntities,
  selectEntities,
  toPersistedHomeAssistantConfig,
} from '../homeAssistant/utils';
import type { HomeOverviewWidgetConfig, HomeOverviewWidgetProps } from './types';

const DEFAULT_CONFIG: HomeOverviewWidgetConfig = {
  title: 'Home Overview',
  baseUrl: '',
  apiToken: '',
  refreshInterval: 30,
  batteryThreshold: 20,
};

const HomeOverviewWidget: React.FC<HomeOverviewWidgetProps> = ({ width, height, config }) => {
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const appliedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const [draftConfig, setDraftConfig] = useState<HomeOverviewWidgetConfig>(appliedConfig);
  const [showSettings, setShowSettings] = useState(false);
  const { snapshot, loading, refreshing, error, canFetch, refresh } = useHomeAssistantData(appliedConfig);
  const { optimisticStateValues } = useHomeAssistantOptimisticStates(appliedConfig, snapshot);

  useEffect(() => {
    setDraftConfig(appliedConfig);
  }, [appliedConfig]);

  const summary = useMemo(() => {
    const lights = removeRedundantAggregateEntities(
      applyEntityStateOverrides(selectEntities(snapshot, { domains: ['light'] }), optimisticStateValues)
    );
    const climate = selectEntities(snapshot, { domains: ['climate'] });
    const security = selectEntities(snapshot, { domains: ['lock', 'cover', 'binary_sensor', 'alarm_control_panel'] });
    const issues = getHealthIssues(snapshot, appliedConfig.batteryThreshold);
    const doorsOpen = security.filter(isActiveSecurityEntity).length;

    return {
      lightsOn: lights.filter(isEntityOn).length,
      lightCount: lights.length,
      climateCount: climate.length,
      doorsOpen,
      issueCount: issues.length,
      issues: issues.slice(0, isApp ? 12 : 5),
      entityCount: snapshot?.entities.length || 0,
    };
  }, [appliedConfig.batteryThreshold, isApp, optimisticStateValues, snapshot]);

  const resetSettings = () => {
    setDraftConfig(appliedConfig);
    setShowSettings(false);
  };

  const saveSettings = () => {
    config?.onUpdate?.(toPersistedHomeAssistantConfig(draftConfig));
    setShowSettings(false);
  };

  const renderContent = () => {
    if (!canFetch) {
      return <HomeSetupState readOnly={readOnly} onSettingsClick={() => setShowSettings(true)} />;
    }

    if (loading) return <HomeLoadingState compact={isCompact} />;
    if (error) return <HomeErrorState message={error} onRetry={refresh} />;
    if (!snapshot || summary.entityCount === 0) return <HomeEmptyState label="No Home Assistant entities" />;

    if (isTiny) {
      return (
        <HomeTinyStatus
          value={summary.issueCount || 'OK'}
          label={summary.issueCount ? 'Issues' : 'Home'}
          tone={summary.issueCount ? 'danger' : 'good'}
        />
      );
    }

    if (isShort) {
      return (
        <div className="flex h-full min-h-0 items-center gap-2 p-2">
          <HomeMetricTile compact label="Lights" value={`${summary.lightsOn}/${summary.lightCount}`} />
          <HomeMetricTile compact label="Open" value={summary.doorsOpen} tone={summary.doorsOpen ? 'warning' : 'good'} />
          <HomeMetricTile compact label="Issues" value={summary.issueCount} tone={summary.issueCount ? 'danger' : 'good'} />
          <HomeRefreshingBadge refreshing={refreshing} />
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <HomeMetricTile label="Lights On" value={`${summary.lightsOn}/${summary.lightCount}`} />
          <HomeMetricTile label="Climate" value={summary.climateCount} />
          <HomeMetricTile label="Open / Unlocked" value={summary.doorsOpen} tone={summary.doorsOpen ? 'warning' : 'good'} />
          <HomeMetricTile label="Health Issues" value={summary.issueCount} tone={summary.issueCount ? 'danger' : 'good'} />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Needs attention</p>
            <HomeRefreshingBadge refreshing={refreshing} />
          </div>
          {summary.issues.length ? (
            <div className="flex h-full min-h-0 flex-col overflow-y-auto">
              {summary.issues.map((issue) => (
                <div key={`${issue.kind}-${issue.entity.entityId}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                  <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground">{issue.entity.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{issue.label}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-0 items-center gap-2 rounded-md bg-muted/40 px-3 text-sm text-muted-foreground">
              <Home className="size-4" aria-hidden="true" />
              Home looks normal
            </div>
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
        }} aria-label="Refresh Home Assistant">
          <RefreshCw className="size-4" />
        </Button>
      ) : undefined}
    >
      {renderContent()}
      {!readOnly ? (
        <HomeAssistantSettingsDialog
          open={showSettings}
          title="Home Overview Settings"
          config={draftConfig}
          onConfigChange={setDraftConfig}
          onOpenChange={setShowSettings}
          onCancel={resetSettings}
          onSave={saveSettings}
          onDelete={config?.onDelete}
        />
      ) : null}
    </WidgetShell>
  );
};

export default HomeOverviewWidget;
