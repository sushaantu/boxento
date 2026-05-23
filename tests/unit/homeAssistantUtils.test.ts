import { describe, expect, it } from 'vitest';

import type { HomeAssistantState } from '@/components/widgets/homeAssistant/types';
import {
  buildHomeAssistantEntities,
  getHealthIssues,
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
