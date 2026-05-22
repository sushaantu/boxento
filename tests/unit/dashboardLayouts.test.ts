import { describe, expect, it } from 'vitest';

import {
  applyValidatedBreakpointLayout,
  applyWidgetLayoutConstraints,
  getBreakpointForWidth,
  rebalanceWideSparseLayout,
  scaleLayoutToCols,
  validateLayouts,
} from '@/lib/dashboardLayouts';
import { LayoutItem, Widget } from '@/types';

const createWidget = (type: string, id = type): Widget => ({
  id,
  type,
  config: {},
});

const createLayoutItem = (
  overrides: Partial<LayoutItem> & Pick<LayoutItem, 'i' | 'x' | 'y' | 'w' | 'h'>
): LayoutItem => ({
  minW: 2,
  minH: 2,
  ...overrides,
});

describe('dashboardLayouts', () => {
  it('maps viewport widths to the expected breakpoints', () => {
    expect(getBreakpointForWidth(2560)).toBe('xxxl');
    expect(getBreakpointForWidth(2559)).toBe('xxl');
    expect(getBreakpointForWidth(1536)).toBe('xl');
    expect(getBreakpointForWidth(1512)).toBe('lg');
    expect(getBreakpointForWidth(768)).toBe('sm');
    expect(getBreakpointForWidth(767)).toBe('xs');
    expect(getBreakpointForWidth(480)).toBe('xs');
    expect(getBreakpointForWidth(-1)).toBe('xxs');
  });

  it('applies widget-specific desktop and mobile size constraints', () => {
    const quickLinks = applyWidgetLayoutConstraints(
      createLayoutItem({ i: 'quick-links-1', x: 0, y: 0, w: 1, h: 1 }),
      createWidget('quick-links', 'quick-links-1'),
      'xl'
    );
    expect(quickLinks.minW).toBe(1);
    expect(quickLinks.minH).toBe(1);

    const worldClocks = applyWidgetLayoutConstraints(
      createLayoutItem({ i: 'world-clocks-1', x: 0, y: 0, w: 1, h: 1 }),
      createWidget('world-clocks', 'world-clocks-1'),
      'xl'
    );
    expect(worldClocks.minW).toBe(1);
    expect(worldClocks.minH).toBe(1);

    const yearProgress = applyWidgetLayoutConstraints(
      createLayoutItem({ i: 'year-progress-1', x: 0, y: 0, w: 1, h: 1 }),
      createWidget('year-progress', 'year-progress-1'),
      'xl'
    );
    expect(yearProgress.minW).toBe(1);
    expect(yearProgress.minH).toBe(1);

    const weather = applyWidgetLayoutConstraints(
      createLayoutItem({ i: 'weather-1', x: 0, y: 0, w: 1, h: 1 }),
      createWidget('weather', 'weather-1'),
      'xl'
    );
    expect(weather.minW).toBe(1);
    expect(weather.minH).toBe(1);

    const calendar = applyWidgetLayoutConstraints(
      createLayoutItem({ i: 'calendar-1', x: 0, y: 0, w: 1, h: 1 }),
      createWidget('calendar', 'calendar-1'),
      'xl'
    );
    expect(calendar.minW).toBe(1);
    expect(calendar.minH).toBe(1);

    const mobileQuickLinks = applyWidgetLayoutConstraints(
      createLayoutItem({ i: 'quick-links-1', x: 1, y: 0, w: 5, h: 1 }),
      createWidget('quick-links', 'quick-links-1'),
      'xs'
    );
    expect(mobileQuickLinks.minW).toBe(2);
    expect(mobileQuickLinks.minH).toBe(2);
    expect(mobileQuickLinks.maxW).toBe(2);
    expect(mobileQuickLinks.maxH).toBe(2);
    expect(mobileQuickLinks.x).toBe(0);
  });

  it('scales saved layouts to wider breakpoints without overlapping items', () => {
    const scaled = scaleLayoutToCols([
      createLayoutItem({ i: 'a', x: 0, y: 0, w: 3, h: 3 }),
      createLayoutItem({ i: 'b', x: 3, y: 0, w: 2, h: 3 }),
      createLayoutItem({ i: 'c', x: 5, y: 0, w: 3, h: 3 }),
      createLayoutItem({ i: 'd', x: 8, y: 0, w: 3, h: 3 }),
    ], 12, 18);

    expect(scaled.map((item) => [item.i, item.x, item.w])).toEqual([
      ['a', 0, 5],
      ['b', 5, 3],
      ['c', 8, 4],
      ['d', 12, 5],
    ]);

    for (let index = 1; index < scaled.length; index += 1) {
      const previous = scaled[index - 1];
      const current = scaled[index];
      expect(current.x).toBeGreaterThanOrEqual(previous.x + previous.w);
    }
  });

  it('updates only the active breakpoint with a validated persisted layout', () => {
    const savedLayouts = {
      lg: [
        createLayoutItem({ i: 'a', x: 0, y: 0, w: 3, h: 3 }),
      ],
      md: [
        createLayoutItem({ i: 'a', x: 0, y: 0, w: 1, h: 1 }),
      ],
    };

    const updated = applyValidatedBreakpointLayout(savedLayouts, 'md', [
      createLayoutItem({ i: 'a', x: 1, y: 2, w: 1, h: 1 }),
      createLayoutItem({ i: 'b', x: 4, y: 5, w: 1, h: 1 }),
    ]);

    expect(updated.lg).toEqual(savedLayouts.lg);
    expect(updated.md).toEqual([
      createLayoutItem({ i: 'a', x: 1, y: 2, w: 1, h: 1 }),
      createLayoutItem({ i: 'b', x: 4, y: 5, w: 1, h: 1 }),
    ]);
    expect(savedLayouts.md).toEqual([
      createLayoutItem({ i: 'a', x: 0, y: 0, w: 1, h: 1 }),
    ]);
  });

  it('rebalances sparse single-row wide layouts into evenly filled rows', () => {
    const rebalanced = rebalanceWideSparseLayout([
      createLayoutItem({ i: 'left', x: 0, y: 0, w: 3, h: 3 }),
      createLayoutItem({ i: 'right', x: 18, y: 0, w: 3, h: 3 }),
    ], 24);

    expect(rebalanced).not.toBeNull();
    expect(rebalanced?.map((item) => [item.i, item.x, item.w])).toEqual([
      ['left', 0, 12],
      ['right', 12, 12],
    ]);
  });

  it('hydrates missing wide layouts from a persisted laptop layout', () => {
    const lgLayout = [
      createLayoutItem({ i: 'left', x: 0, y: 0, w: 3, h: 3 }),
      createLayoutItem({ i: 'right', x: 9, y: 0, w: 3, h: 3 }),
    ];

    const validated = validateLayouts({ lg: lgLayout }, { rebalanceWideSparse: true });

    expect(validated.lg).toEqual(lgLayout);
    expect(validated.xl.map((item) => [item.i, item.x, item.w])).toEqual([
      ['left', 0, 7],
      ['right', 7, 7],
    ]);
    expect(validated.xxl.map((item) => [item.i, item.x, item.w])).toEqual([
      ['left', 0, 9],
      ['right', 9, 9],
    ]);
    expect(validated.xxxl.map((item) => [item.i, item.x, item.w])).toEqual([
      ['left', 0, 12],
      ['right', 12, 12],
    ]);
  });

  it('keeps generated wide layouts stable across repeated validation passes', () => {
    const savedLayouts = {
      lg: [
        createLayoutItem({ i: 'a', x: 0, y: 0, w: 3, h: 3 }),
        createLayoutItem({ i: 'b', x: 3, y: 0, w: 2, h: 2 }),
        createLayoutItem({ i: 'c', x: 5, y: 0, w: 3, h: 2 }),
        createLayoutItem({ i: 'd', x: 8, y: 0, w: 3, h: 3 }),
      ],
    };
    const originalLayouts = JSON.parse(JSON.stringify(savedLayouts));

    const firstPass = validateLayouts(savedLayouts, { rebalanceWideSparse: true });
    const secondPass = validateLayouts(firstPass, { rebalanceWideSparse: true });

    expect(savedLayouts).toEqual(originalLayouts);
    expect(firstPass.lg).toEqual(
      originalLayouts.lg.map((item: LayoutItem) => ({
        ...item,
        maxW: undefined,
      }))
    );
    expect(secondPass).toEqual(firstPass);
    expect(firstPass.md).toEqual([]);
    expect(firstPass.sm).toEqual([]);
    expect(secondPass.xl.length).toBe(4);
    expect(secondPass.xxl.length).toBe(4);
    expect(secondPass.xxxl.length).toBe(4);
  });

  it('preserves authored wide-screen layouts instead of rescaling them from laptop layouts', () => {
    const savedLayouts = {
      lg: [
        createLayoutItem({ i: 'a', x: 0, y: 0, w: 3, h: 3 }),
        createLayoutItem({ i: 'b', x: 3, y: 0, w: 2, h: 2 }),
      ],
      xxl: [
        createLayoutItem({ i: 'a', x: 0, y: 0, w: 8, h: 3 }),
        createLayoutItem({ i: 'b', x: 8, y: 0, w: 10, h: 3 }),
      ],
    };
    const originalLayouts = JSON.parse(JSON.stringify(savedLayouts));

    const validated = validateLayouts(savedLayouts, { rebalanceWideSparse: true });

    expect(validated.lg).toEqual(originalLayouts.lg);
    expect(validated.xxl).toEqual(originalLayouts.xxl);
    expect(savedLayouts).toEqual(originalLayouts);
  });
});
