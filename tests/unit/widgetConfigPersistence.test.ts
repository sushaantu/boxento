import { describe, expect, it } from 'vitest';

import { getConfigWidgetIdsToSave } from '@/lib/widgetConfigPersistence';
import type { Widget } from '@/types';

const createWidget = (
  id: string,
  config?: Record<string, unknown>,
): Widget => ({
  id,
  type: 'notes',
  config,
});

describe('widgetConfigPersistence', () => {
  it('saves all widget configs for legacy full persistence paths', () => {
    expect(getConfigWidgetIdsToSave([
      createWidget('a', { title: 'A' }),
      createWidget('b'),
      createWidget('c', { title: 'C' }),
    ], { persistAllConfigs: true })).toEqual(['a', 'c']);
  });

  it('saves only targeted configs for optimized widget updates', () => {
    expect(getConfigWidgetIdsToSave([
      createWidget('a', { title: 'A' }),
      createWidget('b', { title: 'B' }),
    ], { configWidgetIdsToSave: ['b', 'b'] })).toEqual(['b']);
  });

  it('does not resave configs when no targeted ids are requested', () => {
    expect(getConfigWidgetIdsToSave([
      createWidget('a', { title: 'A' }),
    ], {})).toEqual([]);
  });
});
