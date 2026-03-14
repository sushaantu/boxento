import { GRID } from '@/lib/constants';
import { breakpoints, cols } from '@/lib/layoutUtils';

export type DashboardViewportBreakpoint = keyof typeof cols;

const DASHBOARD_BREAKPOINT_ORDER = Object.keys(breakpoints)
  .sort((a, b) => breakpoints[b as DashboardViewportBreakpoint] - breakpoints[a as DashboardViewportBreakpoint]) as DashboardViewportBreakpoint[];

export const DASHBOARD_LAYOUT_MAX_WIDTH = GRID.MAX_DESKTOP_LAYOUT_WIDTH;

export const getDashboardLayoutViewportWidth = (viewportWidth: number): number => {
  if (viewportWidth < breakpoints.sm) {
    return viewportWidth;
  }

  return Math.min(viewportWidth, DASHBOARD_LAYOUT_MAX_WIDTH);
};

export const getDashboardBreakpointForWidth = (viewportWidth: number): DashboardViewportBreakpoint => {
  const boundedWidth = getDashboardLayoutViewportWidth(viewportWidth);

  for (const breakpoint of DASHBOARD_BREAKPOINT_ORDER) {
    if (boundedWidth >= breakpoints[breakpoint]) {
      return breakpoint;
    }
  }

  return DASHBOARD_BREAKPOINT_ORDER[DASHBOARD_BREAKPOINT_ORDER.length - 1];
};

export const calculateDashboardRowHeight = (
  viewportWidth: number,
  breakpoint: DashboardViewportBreakpoint
): number => {
  const boundedWidth = getDashboardLayoutViewportWidth(viewportWidth);
  const columnCount = cols[breakpoint] || cols.lg;
  const totalPadding = GRID.CONTAINER_PADDING * 2;
  const totalMargins = GRID.ITEM_MARGIN * (columnCount - 1);
  const usableWidth = Math.max(boundedWidth - totalPadding - totalMargins, columnCount);
  const columnWidth = usableWidth / columnCount;

  if (boundedWidth < 600) {
    return columnWidth * 0.8;
  }

  if (boundedWidth < 1200) {
    return columnWidth * 0.9;
  }

  return columnWidth;
};
