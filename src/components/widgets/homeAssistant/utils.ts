import type {
  HomeAssistantArea,
  HomeAssistantDevice,
  HomeAssistantEntity,
  HomeAssistantEntityRegistryEntry,
  HomeAssistantHealthIssue,
  HomeAssistantSnapshot,
  HomeAssistantState,
} from './types';

const UNAVAILABLE_STATES = new Set(['unavailable', 'unknown']);
const ON_STATES = new Set(['on', 'open', 'opening', 'unlocked', 'home', 'heat', 'cool', 'heat_cool', 'playing']);
const LOW_BATTERY_CLASSES = new Set(['battery']);
const OPEN_SECURITY_STATES = new Set(['open', 'unlocked', 'triggered']);
const ENTITY_NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const LIGHT_DOMAINS = ['light'];
export const CLIMATE_DOMAINS = ['climate', 'fan', 'humidifier'];
export const ROOM_DOMAINS = ['light', 'switch', 'climate', 'fan', 'cover', 'lock', 'sensor', 'binary_sensor', 'media_player'];

export function buildHomeAssistantEntities(
  states: HomeAssistantState[],
  registry: {
    areas: HomeAssistantArea[];
    devices: HomeAssistantDevice[];
    entities: HomeAssistantEntityRegistryEntry[];
  }
): HomeAssistantEntity[] {
  const areaById = new Map(registry.areas.map((area) => [area.area_id, area]));
  const deviceById = new Map(registry.devices.map((device) => [device.id, device]));
  const registryByEntityId = new Map(registry.entities.map((entity) => [entity.entity_id, entity]));

  return states.map((state) => {
    const registryEntry = registryByEntityId.get(state.entity_id);
    const device = registryEntry?.device_id ? deviceById.get(registryEntry.device_id) : undefined;
    const areaId = registryEntry?.area_id || device?.area_id || undefined;
    const area = areaId ? areaById.get(areaId) : undefined;
    const domain = getDomain(state.entity_id);

    return {
      entityId: state.entity_id,
      domain,
      name: getEntityName(state, registryEntry),
      state: state.state,
      attributes: state.attributes,
      areaId,
      areaName: area?.name,
      deviceId: registryEntry?.device_id || undefined,
      deviceClass: getStringAttribute(state, 'device_class'),
      entityCategory: registryEntry?.entity_category || undefined,
      unit: getStringAttribute(state, 'unit_of_measurement'),
      lastChanged: state.last_changed,
      lastUpdated: state.last_updated,
      hidden: Boolean(registryEntry?.hidden_by || device?.hidden_by),
      disabled: Boolean(registryEntry?.disabled_by || device?.disabled_by),
    };
  });
}

export function getDomain(entityId: string): string {
  return entityId.split('.')[0] || '';
}

export function getEntityName(
  state: HomeAssistantState,
  registryEntry?: HomeAssistantEntityRegistryEntry
): string {
  return registryEntry?.name || state.attributes.friendly_name || registryEntry?.original_name || state.entity_id;
}

export function parseEntityIds(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  return (value || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatEntityIds(entityIds?: string[]): string {
  return (entityIds || []).join('\n');
}

export function selectEntities(
  snapshot: HomeAssistantSnapshot | null,
  options: {
    domains?: string[];
    areaId?: string;
    entityIds?: string[];
    includeDiagnostic?: boolean;
  } = {}
): HomeAssistantEntity[] {
  if (!snapshot) return [];

  const selectedIds = new Set(options.entityIds || []);
  const domains = new Set(options.domains || []);

  return snapshot.entities
    .filter((entity) => !entity.hidden && !entity.disabled)
    .filter((entity) => options.includeDiagnostic || !isDiagnosticEntity(entity))
    .filter((entity) => domains.size === 0 || domains.has(entity.domain))
    .filter((entity) => !options.areaId || entity.areaId === options.areaId)
    .filter((entity) => selectedIds.size === 0 || selectedIds.has(entity.entityId))
    .sort((a, b) => ENTITY_NAME_COLLATOR.compare(a.name, b.name) || a.entityId.localeCompare(b.entityId));
}

export function getAreaName(snapshot: HomeAssistantSnapshot | null, areaId?: string): string {
  if (!areaId) return 'All rooms';
  return snapshot?.areas.find((area) => area.area_id === areaId)?.name || toTitle(areaId);
}

export function isUnavailable(entity: HomeAssistantEntity): boolean {
  return UNAVAILABLE_STATES.has(entity.state);
}

export function isEntityOn(entity: HomeAssistantEntity): boolean {
  return ON_STATES.has(entity.state);
}

export type HomeAssistantEntityStateOverrides = Record<string, string>;

export function applyEntityStateOverrides(
  entities: HomeAssistantEntity[],
  overrides: HomeAssistantEntityStateOverrides
): HomeAssistantEntity[] {
  if (Object.keys(overrides).length === 0) {
    return entities;
  }

  return entities.map((entity) => {
    const nextState = overrides[entity.entityId];
    return nextState ? { ...entity, state: nextState } : entity;
  });
}

export function patchHomeAssistantSnapshotState(
  snapshot: HomeAssistantSnapshot,
  nextState: HomeAssistantState
): HomeAssistantSnapshot {
  let found = false;
  const states = snapshot.states.map((state) => {
    if (state.entity_id !== nextState.entity_id) {
      return state;
    }

    found = true;
    return nextState;
  });

  if (!found) {
    states.push(nextState);
  }

  const registryEntry = snapshot.registryEntities.find((entity) => entity.entity_id === nextState.entity_id);
  const entities = found
    ? snapshot.entities.map((entity) => entity.entityId === nextState.entity_id
      ? {
          ...entity,
          name: getEntityName(nextState, registryEntry),
          state: nextState.state,
          attributes: nextState.attributes,
          deviceClass: getStringAttribute(nextState, 'device_class'),
          unit: getStringAttribute(nextState, 'unit_of_measurement'),
          lastChanged: nextState.last_changed,
          lastUpdated: nextState.last_updated,
        }
      : entity)
    : buildHomeAssistantEntities(states, {
        areas: snapshot.areas,
        devices: snapshot.devices,
        entities: snapshot.registryEntities,
      });

  return {
    ...snapshot,
    states,
    entities,
    loadedAt: new Date().toISOString(),
  };
}

export function removeRedundantAggregateEntities(entities: HomeAssistantEntity[]): HomeAssistantEntity[] {
  const selectedEntityIds = new Set(entities.map((entity) => entity.entityId));

  return entities.filter((entity) => {
    const groupedEntityIds = getGroupedEntityIds(entity);
    return groupedEntityIds.length === 0 || !groupedEntityIds.some((entityId) => selectedEntityIds.has(entityId));
  });
}

export function isActiveSecurityEntity(entity: HomeAssistantEntity): boolean {
  return OPEN_SECURITY_STATES.has(entity.state) || (entity.domain === 'binary_sensor' && isEntityOn(entity));
}

export function canToggleEntity(entity: HomeAssistantEntity): boolean {
  return ['light', 'switch', 'fan', 'cover', 'lock', 'input_boolean'].includes(entity.domain);
}

export function getToggleAction(entity: HomeAssistantEntity): { domain: string; service: string; nextState: string } | null {
  if (entity.domain === 'cover') {
    const shouldClose = entity.state === 'open' || entity.state === 'opening';
    return {
      domain: 'cover',
      service: shouldClose ? 'close_cover' : 'open_cover',
      nextState: shouldClose ? 'closed' : 'open',
    };
  }

  if (entity.domain === 'lock') {
    const shouldLock = entity.state === 'unlocked';
    return {
      domain: 'lock',
      service: shouldLock ? 'lock' : 'unlock',
      nextState: shouldLock ? 'locked' : 'unlocked',
    };
  }

  if (['light', 'switch', 'fan', 'input_boolean'].includes(entity.domain)) {
    const shouldTurnOff = isEntityOn(entity);
    return {
      domain: entity.domain,
      service: shouldTurnOff ? 'turn_off' : 'turn_on',
      nextState: shouldTurnOff ? 'off' : 'on',
    };
  }

  return null;
}

export function getToggleService(entity: HomeAssistantEntity): { domain: string; service: string } | null {
  const action = getToggleAction(entity);
  return action ? { domain: action.domain, service: action.service } : null;
}

export function getOptimisticToggleState(entity: HomeAssistantEntity): string {
  return getToggleAction(entity)?.nextState || entity.state;
}

export function getClimateTemperature(entity: HomeAssistantEntity): number | null {
  const current = entity.attributes.current_temperature;
  const direct = entity.attributes.temperature;
  const stateNumber = Number(entity.state);

  if (typeof current === 'number') return current;
  if (typeof direct === 'number') return direct;
  if (Number.isFinite(stateNumber)) return stateNumber;
  return null;
}

export function isTemperatureEntity(entity: HomeAssistantEntity): boolean {
  return entity.domain !== 'sensor' || entity.deviceClass === 'temperature';
}

export function getTemperatureUnit(entity: HomeAssistantEntity): string | undefined {
  const unit = entity.unit || entity.attributes.temperature_unit || entity.attributes.unit_of_measurement;
  return typeof unit === 'string' ? unit : undefined;
}

export function formatTemperatureValue(value: number, unit?: string): string {
  return `${value}${unit || ''}`;
}

export function getHealthIssues(snapshot: HomeAssistantSnapshot | null, batteryThreshold = 20): HomeAssistantHealthIssue[] {
  if (!snapshot) return [];

  const issues: HomeAssistantHealthIssue[] = [];

  for (const entity of snapshot.entities) {
    if (entity.hidden || entity.disabled) continue;

    if (isUnavailable(entity)) {
      issues.push({
        kind: 'unavailable',
        entity,
        label: 'Unavailable',
        severity: 'critical',
      });
      continue;
    }

    if (entity.domain === 'update' && entity.state === 'on') {
      issues.push({
        kind: 'update',
        entity,
        label: 'Update available',
        severity: 'info',
      });
      continue;
    }

    if (entity.domain === 'sensor' && entity.deviceClass && LOW_BATTERY_CLASSES.has(entity.deviceClass)) {
      const battery = Number(entity.state);
      if (Number.isFinite(battery) && battery <= batteryThreshold) {
        issues.push({
          kind: 'battery',
          entity,
          label: `${battery}% battery`,
          severity: battery <= 10 ? 'critical' : 'warning',
        });
      }
    }
  }

  return issues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.entity.name.localeCompare(b.entity.name));
}

export function formatState(entity: HomeAssistantEntity): string {
  if (entity.unit) return `${entity.state} ${entity.unit}`;
  return toTitle(entity.state);
}

export function formatRelativeTime(value?: string): string {
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
}

export function toTitle(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function toPersistedHomeAssistantConfig<T extends Record<string, unknown>>(config: T): T {
  const { onDelete, onUpdate, readOnly, ...persisted } = config;
  void onDelete;
  void onUpdate;
  void readOnly;
  return persisted as T;
}

function getStringAttribute(state: HomeAssistantState, key: keyof HomeAssistantState['attributes']): string | undefined {
  const value = state.attributes[key];
  return typeof value === 'string' ? value : undefined;
}

function isDiagnosticEntity(entity: HomeAssistantEntity): boolean {
  return entity.entityCategory === 'diagnostic' || entity.entityCategory === 'config';
}

function getGroupedEntityIds(entity: HomeAssistantEntity): string[] {
  const groupedEntityIds = entity.attributes.entity_id;

  if (Array.isArray(groupedEntityIds)) {
    return groupedEntityIds.filter((entityId): entityId is string => typeof entityId === 'string');
  }

  return typeof groupedEntityIds === 'string' ? [groupedEntityIds] : [];
}

function severityRank(severity: HomeAssistantHealthIssue['severity']): number {
  if (severity === 'critical') return 0;
  if (severity === 'warning') return 1;
  return 2;
}
