import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Thermometer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { WidgetShell } from '../common/WidgetShell';
import {
  HomeEmptyState,
  HomeEntityRow,
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
  CLIMATE_DOMAINS,
  formatTemperatureValue,
  getClimateTemperature,
  getTemperatureUnit,
  isTemperatureEntity,
  selectEntities,
  toPersistedHomeAssistantConfig,
} from '../homeAssistant/utils';
import type { HomeClimateWidgetConfig, HomeClimateWidgetProps } from './types';

const DEFAULT_CONFIG: HomeClimateWidgetConfig = {
  title: 'Climate',
  baseUrl: '',
  apiToken: '',
  refreshInterval: 30,
  areaId: '',
  entityIds: [],
  maxItems: 8,
};

const CLIMATE_SENSOR_CLASSES = new Set(['temperature', 'humidity']);

const HomeClimateWidget: React.FC<HomeClimateWidgetProps> = ({ width, height, config }) => {
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const appliedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const [draftConfig, setDraftConfig] = useState<HomeClimateWidgetConfig>(appliedConfig);
  const [showSettings, setShowSettings] = useState(false);
  const { snapshot, loading, refreshing, error, canFetch, refresh } = useHomeAssistantData(appliedConfig);

  useEffect(() => {
    setDraftConfig(appliedConfig);
  }, [appliedConfig]);

  const climateEntities = useMemo(() => {
    const direct = selectEntities(snapshot, {
      domains: CLIMATE_DOMAINS,
      areaId: appliedConfig.areaId,
      entityIds: appliedConfig.entityIds,
    });
    const sensors = selectEntities(snapshot, {
      domains: ['sensor'],
      areaId: appliedConfig.areaId,
      entityIds: appliedConfig.entityIds,
    }).filter((entity) => entity.deviceClass && CLIMATE_SENSOR_CLASSES.has(entity.deviceClass));

    return [...direct, ...sensors];
  }, [appliedConfig.areaId, appliedConfig.entityIds, snapshot]);

  const temperatureEntities = climateEntities.filter(isTemperatureEntity);
  const temperatures = temperatureEntities
    .map(getClimateTemperature)
    .filter((value): value is number => typeof value === 'number');
  const averageTemperature = temperatures.length
    ? Math.round(temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length)
    : null;
  const temperatureUnit = temperatureEntities.map(getTemperatureUnit).find(Boolean);
  const averageTemperatureLabel = averageTemperature != null
    ? formatTemperatureValue(averageTemperature, temperatureUnit)
    : 'n/a';
  const visibleEntities = climateEntities.slice(0, isApp ? 18 : appliedConfig.maxItems || 8);

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
    if (!visibleEntities.length) return <HomeEmptyState label="No climate devices found" />;

    if (isTiny) {
      return <HomeTinyStatus value={averageTemperature != null ? averageTemperatureLabel : visibleEntities.length} label="Climate" />;
    }

    if (isShort) {
      return (
        <div className="flex h-full min-h-0 items-center gap-2 p-2">
          <HomeMetricTile compact label="Average" value={averageTemperatureLabel} />
          <HomeMetricTile compact label="Devices" value={climateEntities.length} />
          <HomeRefreshingBadge refreshing={refreshing} />
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <HomeMetricTile label="Average Temperature" value={averageTemperatureLabel} />
          <Thermometer className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleEntities.map((entity) => (
            <HomeEntityRow key={entity.entityId} entity={entity} dense={isCompact} />
          ))}
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
        }} aria-label="Refresh climate">
          <RefreshCw className="size-4" />
        </Button>
      ) : undefined}
    >
      {renderContent()}
      {!readOnly ? (
        <HomeAssistantSettingsDialog
          open={showSettings}
          title="Climate Settings"
          config={draftConfig}
          areas={snapshot?.areas}
          showArea
          showEntityIds
          entityHelp="Optional. Include climate entities or temperature and humidity sensors."
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

export default HomeClimateWidget;
