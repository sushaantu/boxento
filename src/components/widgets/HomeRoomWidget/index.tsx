import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DoorOpen, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
  ROOM_DOMAINS,
  applyEntityStateOverrides,
  canToggleEntity,
  getAreaName,
  getToggleAction,
  isEntityOn,
  removeRedundantAggregateEntities,
  selectEntities,
  toPersistedHomeAssistantConfig,
} from '../homeAssistant/utils';
import type { HomeAssistantEntity } from '../homeAssistant/types';
import type { HomeRoomWidgetConfig, HomeRoomWidgetProps } from './types';

const DEFAULT_CONFIG: HomeRoomWidgetConfig = {
  title: 'Room Control',
  baseUrl: '',
  apiToken: '',
  refreshInterval: 30,
  areaId: '',
  entityIds: [],
  maxItems: 8,
};

const HomeRoomWidget: React.FC<HomeRoomWidgetProps> = ({ width, height, config }) => {
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const appliedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const [draftConfig, setDraftConfig] = useState<HomeRoomWidgetConfig>(appliedConfig);
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

  const roomEntities = useMemo(() => {
    const explicitAreaId = appliedConfig.areaId || inferPrimaryAreaId(snapshot);

    const selected = selectEntities(snapshot, {
      domains: ROOM_DOMAINS,
      areaId: explicitAreaId,
      entityIds: appliedConfig.entityIds,
    });

    return removeRedundantAggregateEntities(applyEntityStateOverrides(selected, optimisticStateValues));
  }, [appliedConfig.areaId, appliedConfig.entityIds, optimisticStateValues, snapshot]);

  const roomName = getAreaName(snapshot, appliedConfig.areaId || inferPrimaryAreaId(snapshot));
  const visibleEntities = roomEntities.slice(0, isApp ? 18 : appliedConfig.maxItems || 8);
  const activeCount = roomEntities.filter(isEntityOn).length;

  const toggleEntity = useCallback(async (entity: HomeAssistantEntity) => {
    const action = getToggleAction(entity);
    if (!action || readOnly) return;

    setOptimisticState(entity.entityId, action.nextState);
    setPendingEntity(entity.entityId, true);

    try {
      await callHomeAssistantService(appliedConfig, action.domain, action.service, entity.entityId);
      await refresh();
    } catch (toggleError) {
      clearOptimisticState(entity.entityId);
      console.error('Failed to toggle Home Assistant device', toggleError);
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
    if (!visibleEntities.length) return <HomeEmptyState label="No room devices found" />;

    if (isTiny) {
      return <HomeTinyStatus value={activeCount} label={roomName} tone={activeCount ? 'good' : 'neutral'} />;
    }

    if (isShort) {
      return (
        <div className="flex h-full min-h-0 items-center gap-2 p-2">
          <HomeMetricTile compact label={roomName} value={`${activeCount} active`} />
          <HomeMetricTile compact label="Devices" value={roomEntities.length} />
          <HomeRefreshingBadge refreshing={refreshing} />
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{roomName}</div>
            <div className="text-xs text-muted-foreground">{activeCount} active of {roomEntities.length}</div>
          </div>
          <DoorOpen className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleEntities.map((entity) => (
            <HomeEntityRow
              key={entity.entityId}
              entity={entity}
              dense={isCompact}
              action={canToggleEntity(entity) && !readOnly ? () => toggleEntity(entity) : undefined}
              actionDisabled={pendingEntityIds.has(entity.entityId)}
            />
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
        }} aria-label="Refresh room">
          <RefreshCw className="size-4" />
        </Button>
      ) : undefined}
    >
      {renderContent()}
      {!readOnly ? (
        <HomeAssistantSettingsDialog
          open={showSettings}
          title="Room Control Settings"
          config={draftConfig}
          areas={snapshot?.areas}
          showArea
          showEntityIds
          entityHelp="Optional. Leave empty to show the selected room."
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

function inferPrimaryAreaId(snapshot: ReturnType<typeof useHomeAssistantData>['snapshot']): string {
  if (!snapshot?.areas.length) return '';

  const counts = new Map<string, number>();
  for (const entity of snapshot.entities) {
    if (!entity.areaId) continue;
    counts.set(entity.areaId, (counts.get(entity.areaId) || 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || snapshot.areas[0].area_id;
}

export default HomeRoomWidget;
