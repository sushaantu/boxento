export type HomeAssistantDomain =
  | 'alarm_control_panel'
  | 'binary_sensor'
  | 'button'
  | 'climate'
  | 'cover'
  | 'fan'
  | 'humidifier'
  | 'light'
  | 'lock'
  | 'media_player'
  | 'person'
  | 'scene'
  | 'script'
  | 'sensor'
  | 'switch'
  | 'update'
  | 'vacuum'
  | 'weather'
  | string;

export type HomeAssistantAttributes = Record<string, unknown> & {
  friendly_name?: string;
  device_class?: string;
  unit_of_measurement?: string;
  current_temperature?: number;
  temperature?: number;
  temperature_unit?: string;
  icon?: string;
};

export interface HomeAssistantState {
  entity_id: string;
  state: string;
  attributes: HomeAssistantAttributes;
  last_changed?: string;
  last_updated?: string;
}

export interface HomeAssistantArea {
  area_id: string;
  name: string;
  icon?: string | null;
}

export interface HomeAssistantDevice {
  id: string;
  area_id?: string | null;
  name?: string | null;
  name_by_user?: string | null;
  hidden_by?: string | null;
  disabled_by?: string | null;
}

export interface HomeAssistantEntityRegistryEntry {
  entity_id: string;
  area_id?: string | null;
  device_id?: string | null;
  entity_category?: string | null;
  hidden_by?: string | null;
  disabled_by?: string | null;
  name?: string | null;
  original_name?: string | null;
}

export interface HomeAssistantEntity {
  entityId: string;
  domain: HomeAssistantDomain;
  name: string;
  state: string;
  attributes: HomeAssistantAttributes;
  areaId?: string;
  areaName?: string;
  deviceId?: string;
  deviceClass?: string;
  entityCategory?: string;
  unit?: string;
  lastChanged?: string;
  lastUpdated?: string;
  hidden: boolean;
  disabled: boolean;
}

export interface HomeAssistantSnapshot {
  states: HomeAssistantState[];
  areas: HomeAssistantArea[];
  devices: HomeAssistantDevice[];
  registryEntities: HomeAssistantEntityRegistryEntry[];
  entities: HomeAssistantEntity[];
  loadedAt: string;
}

export interface HomeAssistantBaseConfig extends Record<string, unknown> {
  id?: string;
  title?: string;
  baseUrl?: string;
  apiToken?: string;
  refreshInterval?: number;
  areaId?: string;
  entityIds?: string[];
  readOnly?: boolean;
}

export type HomeAssistantConnectionConfig = Pick<HomeAssistantBaseConfig, 'baseUrl' | 'apiToken'>;

export type HomeAssistantIssueKind = 'unavailable' | 'battery' | 'update';

export interface HomeAssistantHealthIssue {
  kind: HomeAssistantIssueKind;
  entity: HomeAssistantEntity;
  label: string;
  severity: 'info' | 'warning' | 'critical';
}
