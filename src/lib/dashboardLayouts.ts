import { getWidgetConfigByType } from '@/components/widgets';
import { GRID } from '@/lib/constants';
import { breakpoints, cols, createDefaultLayoutItem } from '@/lib/layoutUtils';
import { LayoutItem, Widget } from '@/types';

export type BreakpointName = keyof typeof cols;
export type LayoutsByBreakpoint = { [key: string]: LayoutItem[] };
export type ValidateLayoutsOptions = {
  rebalanceWideSparse?: boolean;
};

type LayoutTemplate = Omit<LayoutItem, 'i'>;

export const BREAKPOINT_ORDER = Object.keys(breakpoints)
  .sort((a, b) => breakpoints[b as BreakpointName] - breakpoints[a as BreakpointName]) as BreakpointName[];

const DEFAULT_LAYOUT_TEMPLATES: Record<BreakpointName, LayoutTemplate[]> = {
  xxxl: [
    { x: 0, y: 0, w: 6, h: 3, minW: 2, minH: 2 },
    { x: 6, y: 0, w: 6, h: 3, minW: 2, minH: 2 },
    { x: 12, y: 0, w: 6, h: 3, minW: 2, minH: 2 },
    { x: 18, y: 0, w: 6, h: 3, minW: 2, minH: 2 },
  ],
  xxl: [
    { x: 0, y: 0, w: 5, h: 3, minW: 2, minH: 2 },
    { x: 5, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
    { x: 9, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
    { x: 13, y: 0, w: 5, h: 3, minW: 2, minH: 2 },
  ],
  xl: [
    { x: 0, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
    { x: 4, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { x: 7, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { x: 10, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
  ],
  lg: [
    { x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { x: 3, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 5, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { x: 8, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  ],
  md: [
    { x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { x: 3, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 5, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
  ],
  sm: [
    { x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 3, w: 3, h: 2, minW: 2, minH: 2 },
    { x: 3, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
  ],
  xs: [
    { x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 2, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 4, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 6, w: 2, h: 3, minW: 2, minH: 2 },
  ],
  xxs: [
    { x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 2, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 4, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 6, w: 2, h: 3, minW: 2, minH: 2 },
  ],
};

const WIDE_LAYOUT_FILL_RATIO_THRESHOLD = 0.72;
const WIDE_LAYOUT_MIN_GAP = 3;
const WIDE_LAYOUT_GAP_DIVISOR = 6;

export const getBreakpointForWidth = (width: number): BreakpointName => {
  for (const breakpoint of BREAKPOINT_ORDER) {
    if (width >= breakpoints[breakpoint]) {
      return breakpoint;
    }
  }

  return BREAKPOINT_ORDER[BREAKPOINT_ORDER.length - 1];
};

const validateLayoutItem = (item: LayoutItem): LayoutItem => ({
  ...item,
  w: Math.max(item.w, GRID.MIN_WIDGET_WIDTH),
  h: Math.max(item.h, GRID.MIN_WIDGET_HEIGHT),
});

export const clampLayoutItemToCols = (item: LayoutItem, colCount: number): LayoutItem => {
  const validated = validateLayoutItem(item);
  const nextW = Math.min(validated.w, colCount);
  const nextX = Math.min(validated.x, Math.max(0, colCount - nextW));

  return {
    ...validated,
    x: nextX,
    w: nextW,
    maxW: validated.maxW ? Math.min(validated.maxW, colCount) : validated.maxW,
  };
};

export const validateLayout = (layout: LayoutItem[]): LayoutItem[] => layout.map(validateLayoutItem);

export const applyValidatedBreakpointLayout = (
  layouts: LayoutsByBreakpoint,
  breakpoint: BreakpointName,
  layout: LayoutItem[]
): LayoutsByBreakpoint => ({
  ...layouts,
  [breakpoint]: validateLayout(layout),
});

export const applyWidgetLayoutConstraints = (
  item: LayoutItem,
  widget: Widget,
  breakpoint: BreakpointName
): LayoutItem => {
  const widgetMeta = getWidgetConfigByType(widget.type);
  const isMobile = breakpoint === 'xs' || breakpoint === 'xxs';

  return clampLayoutItemToCols({
    ...item,
    minW: isMobile ? 2 : (widgetMeta?.minWidth ?? GRID.MIN_WIDGET_WIDTH),
    minH: isMobile ? 2 : (widgetMeta?.minHeight ?? GRID.MIN_WIDGET_HEIGHT),
    maxW: isMobile ? 2 : widgetMeta?.maxSize?.w,
    maxH: isMobile ? 2 : widgetMeta?.maxSize?.h,
  }, cols[breakpoint]);
};

export const layoutSignature = (layout: LayoutItem[]): string => (
  [...layout]
    .sort((a, b) => a.i.localeCompare(b.i))
    .map((item) => `${item.i}:${item.x}:${item.y}:${item.w}:${item.h}`)
    .join('|')
);

const findFallbackBreakpoint = (layouts: LayoutsByBreakpoint, breakpoint: BreakpointName): BreakpointName | null => {
  const startIndex = BREAKPOINT_ORDER.indexOf(breakpoint);

  for (let index = startIndex + 1; index < BREAKPOINT_ORDER.length; index += 1) {
    const candidate = BREAKPOINT_ORDER[index];
    if ((layouts[candidate] || []).length > 0) {
      return candidate;
    }
  }

  return null;
};

const maybeRebalanceWideLayout = (
  layout: LayoutItem[],
  colCount: number,
  options: ValidateLayoutsOptions
): LayoutItem[] => {
  if (!options.rebalanceWideSparse || colCount <= cols.lg) {
    return layout;
  }

  return rebalanceWideSparseLayout(layout, colCount) ?? layout;
};

export const scaleLayoutToCols = (
  layout: LayoutItem[],
  fromCols: number,
  toCols: number
): LayoutItem[] => {
  if (!layout.length || fromCols === toCols) {
    return layout.map((item) => clampLayoutItemToCols({ ...item }, toCols));
  }

  const scale = toCols / fromCols;

  return layout.map((item) => {
    const minW = item.minW || GRID.MIN_WIDGET_WIDTH;
    const scaledX = Math.round(item.x * scale);
    const scaledRight = Math.round((item.x + item.w) * scale);
    const scaledW = Math.max(minW, scaledRight - scaledX);
    const scaledMaxW = item.maxW ? Math.max(minW, Math.round(item.maxW * scale)) : item.maxW;

    return clampLayoutItemToCols(
      {
        ...item,
        x: scaledX,
        w: scaledW,
        maxW: scaledMaxW,
      },
      toCols
    );
  });
};

const getLargestHorizontalGap = (layout: LayoutItem[]): number => {
  const orderedItems = [...layout].sort((a, b) => a.x - b.x);
  let largestGap = 0;

  for (let index = 1; index < orderedItems.length; index += 1) {
    const previousItem = orderedItems[index - 1];
    const currentItem = orderedItems[index];
    largestGap = Math.max(largestGap, currentItem.x - (previousItem.x + previousItem.w));
  }

  return largestGap;
};

export const rebalanceWideSparseLayout = (layout: LayoutItem[], colCount: number): LayoutItem[] | null => {
  if (layout.length < 2 || layout.length > 4) {
    return null;
  }

  const orderedItems = [...layout].sort((a, b) => a.y - b.y || a.x - b.x || a.i.localeCompare(b.i));
  const isSingleRow = orderedItems.every((item) => item.y === orderedItems[0].y);

  if (!isSingleRow) {
    return null;
  }

  const totalWidth = orderedItems.reduce((sum, item) => sum + item.w, 0);
  const fillRatio = totalWidth / colCount;
  const largestGap = getLargestHorizontalGap(orderedItems);
  const shouldRebalance =
    fillRatio < WIDE_LAYOUT_FILL_RATIO_THRESHOLD
    || largestGap >= Math.max(WIDE_LAYOUT_MIN_GAP, Math.floor(colCount / WIDE_LAYOUT_GAP_DIVISOR));

  if (!shouldRebalance) {
    return null;
  }

  let currentX = 0;
  let remainingCols = colCount;

  return orderedItems.map((item, index) => {
    const itemsRemaining = orderedItems.length - index;
    const minW = Math.min(item.minW || GRID.MIN_WIDGET_WIDTH, colCount);
    const maxW = item.maxW ? Math.min(item.maxW, colCount) : undefined;
    const balancedW = Math.max(minW, Math.floor(remainingCols / itemsRemaining));
    const nextW = maxW ? Math.min(balancedW, maxW) : balancedW;

    const rebalancedItem = clampLayoutItemToCols(
      {
        ...item,
        x: currentX,
        y: orderedItems[0].y,
        w: nextW,
      },
      colCount
    );

    currentX = rebalancedItem.x + rebalancedItem.w;
    remainingCols = Math.max(0, colCount - currentX);

    return rebalancedItem;
  });
};

export const createLayoutsFromTemplates = (widgetIds: string[]): LayoutsByBreakpoint => {
  const layoutsByBreakpoint: LayoutsByBreakpoint = {};

  BREAKPOINT_ORDER.forEach((breakpoint) => {
    const template = DEFAULT_LAYOUT_TEMPLATES[breakpoint];
    const colCount = cols[breakpoint];
    const layout: LayoutItem[] = [];

    widgetIds.forEach((widgetId, index) => {
      if (index < template.length) {
        layout.push({
          ...template[index],
          i: widgetId,
          minW: GRID.MIN_WIDGET_WIDTH,
          minH: GRID.MIN_WIDGET_HEIGHT,
        });
        return;
      }

      layout.push(createDefaultLayoutItem(widgetId, index, colCount, breakpoint, layout));
    });

    layoutsByBreakpoint[breakpoint] = layout;
  });

  return layoutsByBreakpoint;
};

export const validateLayouts = (
  layouts: LayoutsByBreakpoint,
  options: ValidateLayoutsOptions = {}
): LayoutsByBreakpoint => {
  const validatedLayouts: LayoutsByBreakpoint = { ...layouts };

  BREAKPOINT_ORDER.forEach((breakpoint) => {
    const colCount = cols[breakpoint];
    validatedLayouts[breakpoint] = (validatedLayouts[breakpoint] || []).map((item) => clampLayoutItemToCols(item, colCount));
  });

  BREAKPOINT_ORDER.forEach((breakpoint) => {
    const fallbackBreakpoint = findFallbackBreakpoint(validatedLayouts, breakpoint);
    if (!fallbackBreakpoint) {
      return;
    }

    const currentLayout = validatedLayouts[breakpoint];
    const fallbackLayout = validatedLayouts[fallbackBreakpoint];
    const targetCols = cols[breakpoint];
    const fallbackCols = cols[fallbackBreakpoint];

    if (!currentLayout.length) {
      validatedLayouts[breakpoint] = maybeRebalanceWideLayout(
        scaleLayoutToCols(fallbackLayout, fallbackCols, targetCols),
        targetCols,
        options
      );
      return;
    }

    if (targetCols <= fallbackCols || currentLayout.length !== fallbackLayout.length) {
      return;
    }

    if (targetCols > cols.lg && layoutSignature(currentLayout) === layoutSignature(fallbackLayout)) {
      validatedLayouts[breakpoint] = maybeRebalanceWideLayout(
        scaleLayoutToCols(fallbackLayout, fallbackCols, targetCols),
        targetCols,
        options
      );
    }
  });

  return validatedLayouts;
};
