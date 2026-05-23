import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lightbulb, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { WidgetShell } from '../common/WidgetShell';
import { callHomeAssistantService } from '../homeAssistant/client';
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
import { useHomeAssistantOptimisticStates } from '../homeAssistant/optimisticEntityStates';
import { useHomeAssistantData } from '../homeAssistant/useHomeAssistantData';
import {
  LIGHT_DOMAINS,
  applyEntityStateOverrides,
  getToggleAction,
  isEntityOn,
  removeRedundantAggregateEntities,
  selectEntities,
  toPersistedHomeAssistantConfig,
} from '../homeAssistant/utils';
import type { HomeAssistantEntity } from '../homeAssistant/types';
import type { HomeLightsWidgetConfig, HomeLightsWidgetProps } from './types';

const DEFAULT_CONFIG: HomeLightsWidgetConfig = {
  title: 'Lights',
  baseUrl: '',
  apiToken: '',
  refreshInterval: 30,
  areaId: '',
  entityIds: [],
  maxItems: 10,
  showOnlyOn: false,
};

const HomeLightsWidget: React.FC<HomeLightsWidgetProps> = ({ width, height, config }) => {
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const appliedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const [draftConfig, setDraftConfig] = useState<HomeLightsWidgetConfig>(appliedConfig);
  const [showSettings, setShowSettings] = useState(false);
  const { snapshot, loading, refreshing, error, canFetch, refresh } = useHomeAssistantData(appliedConfig);
  const {
    optimisticStateValues,
    pendingEntityIds,
    setOptimisticState,
    clearOptimisticState,
    setPendingEntity,
  } = useHomeAssistantOptimisticStates(appliedConfig, snapshot);

  useEffect(() => {
    setDraftConfig(appliedConfig);
  }, [appliedConfig]);

  const lights = useMemo(() => {
    const selected = selectEntities(snapshot, {
      domains: LIGHT_DOMAINS,
      areaId: appliedConfig.areaId,
      entityIds: appliedConfig.entityIds,
    });
    const withOptimisticState = applyEntityStateOverrides(selected, optimisticStateValues);
    const withoutAggregateDuplicates = removeRedundantAggregateEntities(withOptimisticState);

    return appliedConfig.showOnlyOn ? withoutAggregateDuplicates.filter(isEntityOn) : withoutAggregateDuplicates;
  }, [appliedConfig.areaId, appliedConfig.entityIds, appliedConfig.showOnlyOn, optimisticStateValues, snapshot]);

  const onCount = lights.filter(isEntityOn).length;
  const visibleLights = lights.slice(0, isApp ? 24 : appliedConfig.maxItems || 10);

  const toggleLight = useCallback(async (entity: HomeAssistantEntity) => {
    const action = getToggleAction(entity);
    if (!action || readOnly) return;

    setOptimisticState(entity.entityId, action.nextState);
    setPendingEntity(entity.entityId, true);

    try {
      await callHomeAssistantService(appliedConfig, action.domain, action.service, entity.entityId);
      await refresh();
    } catch (toggleError) {
      clearOptimisticState(entity.entityId);
      console.error('Failed to toggle Home Assistant light', toggleError);
    } finally {
      setPendingEntity(entity.entityId, false);
    }
  }, [appliedConfig, clearOptimisticState, readOnly, refresh, setOptimisticState, setPendingEntity]);

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
    if (!visibleLights.length) return <HomeEmptyState label="No lights found" />;

    if (isTiny) {
      return <HomeTinyStatus value={onCount} label="Lights on" tone={onCount ? 'good' : 'neutral'} />;
    }

    if (isShort) {
      return (
        <div className="flex h-full min-h-0 items-center gap-2 overflow-hidden p-2">
          <HomeMetricTile compact label="On" value={`${onCount}/${lights.length}`} />
          {visibleLights.slice(0, 3).map((light) => (
            <Button
              key={light.entityId}
              type="button"
              size="sm"
              variant={isEntityOn(light) ? 'default' : 'outline'}
              disabled={readOnly || pendingEntityIds.has(light.entityId)}
              onClick={() => toggleLight(light)}
              className="h-8 min-w-0 shrink truncate px-2 text-xs"
            >
              {light.name}
            </Button>
          ))}
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <HomeMetricTile compact label="Lights On" value={`${onCount}/${lights.length}`} tone={onCount ? 'good' : 'neutral'} />
          <Lightbulb className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleLights.map((light) => (
            <HomeEntityRow
              key={light.entityId}
              entity={light}
              dense={isCompact}
              action={readOnly ? undefined : () => toggleLight(light)}
              actionDisabled={pendingEntityIds.has(light.entityId)}
            />
          ))}
        </div>
        <HomeRefreshingBadge refreshing={refreshing} />
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
        }} aria-label="Refresh lights">
          <RefreshCw className="size-4" />
        </Button>
      ) : undefined}
    >
      {renderContent()}
      {!readOnly ? (
        <HomeAssistantSettingsDialog
          open={showSettings}
          title="Lights Settings"
          config={draftConfig}
          areas={snapshot?.areas}
          showArea
          showEntityIds
          entityHelp="Optional. Leave empty to show all lights in the selected room."
          onConfigChange={setDraftConfig}
          onOpenChange={setShowSettings}
          onCancel={resetSettings}
          onSave={saveSettings}
          onDelete={config?.onDelete}
        >
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="ha-lights-only-on">Only show lights that are on</Label>
            <Switch
              id="ha-lights-only-on"
              checked={!!draftConfig.showOnlyOn}
              onCheckedChange={(checked) => setDraftConfig((current) => ({ ...current, showOnlyOn: checked }))}
            />
          </div>
        </HomeAssistantSettingsDialog>
      ) : null}
    </WidgetShell>
  );
};

export default HomeLightsWidget;
