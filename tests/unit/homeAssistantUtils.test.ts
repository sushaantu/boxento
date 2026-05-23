import { describe, expect, it } from 'vitest';

import type { HomeAssistantState } from '@/components/widgets/homeAssistant/types';
import {
  buildHomeAssistantEntities,
  formatTemperatureValue,
  getHealthIssues,
  getTemperatureUnit,
  isActiveSecurityEntity,
  parseEntityIds,
  selectEntities,
} from '@/components/widgets/homeAssistant/utils';

const states: HomeAssistantState[] = [
  {
    entity_id: 'light.kitchen',
    state: 'on',
    attributes: { friendly_name: 'Kitchen Light' },
  },
  {
    entity_id: 'sensor.remote_battery',
    state: '12',
    attributes: {
      friendly_name: 'Remote Battery',
      device_class: 'battery',
      unit_of_measurement: '%',
    },
  },
  {
    entity_id: 'switch.router',
    state: 'unavailable',
    attributes: { friendly_name: 'Router' },
  },
  {
    entity_id: 'sensor.router_signal',
    state: '80',
    attributes: { friendly_name: 'Router Signal' },
  },
  {
    entity_id: 'light.living_room',
    state: 'off',
    attributes: { friendly_name: 'Living Room Light' },
  },
  {
    entity_id: 'binary_sensor.front_door',
    state: 'on',
    attributes: { friendly_name: 'Front Door', device_class: 'door' },
  },
  {
    entity_id: 'climate.living_room',
    state: 'heat',
    attributes: {
      friendly_name: 'Living Room Thermostat',
      current_temperature: 72,
      temperature_unit: '°F',
    },
  },
];

describe('Home Assistant widget utilities', () => {
  it('parses entity id input from commas and new lines', () => {
    expect(parseEntityIds('light.kitchen, climate.living\nsensor.temp')).toEqual([
      'light.kitchen',
      'climate.living',
      'sensor.temp',
    ]);
  });

  it('enriches states with room and registry metadata', () => {
    const entities = buildHomeAssistantEntities(states, {
      areas: [{ area_id: 'kitchen', name: 'Kitchen' }],
      devices: [],
      entities: [
        { entity_id: 'light.kitchen', area_id: 'kitchen' },
        { entity_id: 'sensor.remote_battery', area_id: 'kitchen' },
      ],
    });

    expect(entities.find((entity) => entity.entityId === 'light.kitchen')).toMatchObject({
      domain: 'light',
      areaId: 'kitchen',
      areaName: 'Kitchen',
      name: 'Kitchen Light',
    });
  });

  it('selects by domain and area', () => {
    const snapshot = {
      loadedAt: new Date().toISOString(),
      states,
      areas: [{ area_id: 'kitchen', name: 'Kitchen' }],
      devices: [],
      registryEntities: [],
      entities: buildHomeAssistantEntities(states, {
        areas: [{ area_id: 'kitchen', name: 'Kitchen' }],
        devices: [],
        entities: [{ entity_id: 'light.kitchen', area_id: 'kitchen' }],
      }),
    };

    expect(selectEntities(snapshot, { domains: ['light'], areaId: 'kitchen' }).map((entity) => entity.entityId)).toEqual([
      'light.kitchen',
    ]);
  });

  it('sorts active entities before idle and unavailable entities', () => {
    const snapshot = {
      loadedAt: new Date().toISOString(),
      states,
      areas: [],
      devices: [],
      registryEntities: [],
      entities: buildHomeAssistantEntities(states, {
        areas: [],
        devices: [],
        entities: [],
      }),
    };

    expect(selectEntities(snapshot, { domains: ['light', 'switch'] }).map((entity) => entity.entityId)).toEqual([
      'light.kitchen',
      'light.living_room',
      'switch.router',
    ]);
  });

  it('counts active binary sensors as security activity', () => {
    const entity = buildHomeAssistantEntities(states, {
      areas: [],
      devices: [],
      entities: [],
    }).find((item) => item.entityId === 'binary_sensor.front_door');

    expect(entity).toBeDefined();
    expect(isActiveSecurityEntity(entity!)).toBe(true);
  });

  it('formats climate temperatures with Home Assistant units', () => {
    const entity = buildHomeAssistantEntities(states, {
      areas: [],
      devices: [],
      entities: [],
    }).find((item) => item.entityId === 'climate.living_room');

    expect(entity).toBeDefined();
    expect(formatTemperatureValue(72, getTemperatureUnit(entity!))).toBe('72°F');
  });

  it('detects unavailable and low battery health issues', () => {
    const snapshot = {
      loadedAt: new Date().toISOString(),
      states,
      areas: [],
      devices: [],
      registryEntities: [],
      entities: buildHomeAssistantEntities(states, {
        areas: [],
        devices: [],
        entities: [],
      }),
    };

    expect(getHealthIssues(snapshot, 20).map((issue) => issue.kind)).toEqual([
      'unavailable',
      'battery',
    ]);
  });
});
