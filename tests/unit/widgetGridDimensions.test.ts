import { describe, expect, it } from 'vitest';

import { getWidgetGridDimensions } from '@/lib/widgetGridDimensions';

const createLayoutMap = (
  items: Array<{ id: string; w: number; h: number }>
) => new Map(items.map((item) => [item.id, { w: item.w, h: item.h }]));

describe('widgetGridDimensions', () => {
  it('returns desktop defaults before the layout is ready', () => {
    expect(getWidgetGridDimensions({
      currentLayoutById: createLayoutMap([{ id: 'weather-1', w: 4, h: 3 }]),
      isLayoutReady: false,
      widgetId: 'weather-1',
    })).toEqual({ width: 3, height: 3 });
  });

  it('returns fixed mobile dimensions in mobile view', () => {
    expect(getWidgetGridDimensions({
      currentLayoutById: createLayoutMap([{ id: 'weather-1', w: 4, h: 3 }]),
      isLayoutReady: true,
      isMobileView: true,
      widgetId: 'weather-1',
    })).toEqual({ width: 2, height: 2 });
  });

  it('uses the persisted snapped layout dimensions on desktop', () => {
    expect(getWidgetGridDimensions({
      currentLayoutById: createLayoutMap([{ id: 'weather-1', w: 4, h: 3 }]),
      isLayoutReady: true,
      widgetId: 'weather-1',
    })).toEqual({ width: 4, height: 3 });
  });

  it('falls back to desktop defaults when the widget is missing from the layout map', () => {
    expect(getWidgetGridDimensions({
      currentLayoutById: createLayoutMap([]),
      isLayoutReady: true,
      widgetId: 'weather-1',
    })).toEqual({ width: 3, height: 3 });
  });
});
