import { describe, expect, it } from 'vitest';

import type { HomeAssistantState } from '@/components/widgets/homeAssistant/types';
import {
  buildHomeAssistantEntities,
  formatTemperatureValue,
  getHealthIssues,
  getTemperatureUnit,
  getToggleAction,
  isActiveSecurityEntity,
  patchHomeAssistantSnapshotState,
  parseEntityIds,
  removeRedundantAggregateEntities,
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

  it('keeps entity ordering stable across state changes', () => {
    const orderedStates: HomeAssistantState[] = [
      {
        entity_id: 'light.hue_candle_2',
        state: 'on',
        attributes: { friendly_name: 'Hue candle 2' },
      },
      {
        entity_id: 'light.hue_candle_10',
        state: 'off',
        attributes: { friendly_name: 'Hue candle 10' },
      },
      {
        entity_id: 'light.hue_candle_1',
        state: 'off',
        attributes: { friendly_name: 'Hue candle 1' },
      },
    ];
    const snapshot = {
      loadedAt: new Date().toISOString(),
      states: orderedStates,
      areas: [],
      devices: [],
      registryEntities: [],
      entities: buildHomeAssistantEntities(orderedStates, {
        areas: [],
        devices: [],
        entities: [],
      }),
    };

    expect(selectEntities(snapshot, { domains: ['light'] }).map((entity) => entity.entityId)).toEqual([
      'light.hue_candle_1',
      'light.hue_candle_2',
      'light.hue_candle_10',
    ]);
  });

  it('removes aggregate entities when their members are already present', () => {
    const groupStates: HomeAssistantState[] = [
      {
        entity_id: 'light.hue_candle_1',
        state: 'off',
        attributes: { friendly_name: 'Hue candle 1' },
      },
      {
        entity_id: 'light.hue_candle_2',
        state: 'off',
        attributes: { friendly_name: 'Hue candle 2' },
      },
      {
        entity_id: 'light.living_room',
        state: 'off',
        attributes: {
          friendly_name: 'Living room',
          entity_id: ['light.hue_candle_1', 'light.hue_candle_2'],
        },
      },
    ];
    const entities = buildHomeAssistantEntities(groupStates, {
      areas: [],
      devices: [],
      entities: [],
    });

    expect(removeRedundantAggregateEntities(entities).map((entity) => entity.entityId)).toEqual([
      'light.hue_candle_1',
      'light.hue_candle_2',
    ]);
  });

  it('patches snapshots from realtime Home Assistant state events', () => {
    const snapshot = {
      loadedAt: new Date().toISOString(),
      states,
      areas: [{ area_id: 'kitchen', name: 'Kitchen' }],
      devices: [],
      registryEntities: [{ entity_id: 'light.kitchen', area_id: 'kitchen' }],
      entities: buildHomeAssistantEntities(states, {
        areas: [{ area_id: 'kitchen', name: 'Kitchen' }],
        devices: [],
        entities: [{ entity_id: 'light.kitchen', area_id: 'kitchen' }],
      }),
    };
    const originalRemoteBattery = snapshot.entities.find((entity) => entity.entityId === 'sensor.remote_battery');

    const patched = patchHomeAssistantSnapshotState(snapshot, {
      entity_id: 'light.kitchen',
      state: 'off',
      attributes: { friendly_name: 'Kitchen Light' },
    });

    expect(patched.states.find((state) => state.entity_id === 'light.kitchen')?.state).toBe('off');
    expect(patched.entities.find((entity) => entity.entityId === 'sensor.remote_battery')).toBe(originalRemoteBattery);
    expect(patched.entities.find((entity) => entity.entityId === 'light.kitchen')).toMatchObject({
      areaId: 'kitchen',
      areaName: 'Kitchen',
      state: 'off',
    });
  });

  it('uses explicit service calls for deterministic toggles', () => {
    const entities = buildHomeAssistantEntities(states, {
      areas: [],
      devices: [],
      entities: [],
    });

    expect(getToggleAction(entities.find((entity) => entity.entityId === 'light.kitchen')!)).toMatchObject({
      domain: 'light',
      service: 'turn_off',
      nextState: 'off',
    });
    expect(getToggleAction(entities.find((entity) => entity.entityId === 'light.living_room')!)).toMatchObject({
      domain: 'light',
      service: 'turn_on',
      nextState: 'on',
    });
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
