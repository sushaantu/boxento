import { GRID } from '@/lib/constants';
import { breakpoints, cols } from '@/lib/layoutUtils';

export type DashboardViewportBreakpoint = keyof typeof cols;

const DASHBOARD_BREAKPOINT_ORDER = Object.keys(breakpoints)
  .sort((a, b) => breakpoints[b as DashboardViewportBreakpoint] - breakpoints[a as DashboardViewportBreakpoint]) as DashboardViewportBreakpoint[];

export const getDashboardLayoutViewportWidth = (viewportWidth: number): number => {
  return viewportWidth;
};

export const getDashboardBreakpointForWidth = (viewportWidth: number): DashboardViewportBreakpoint => {
  const layoutWidth = getDashboardLayoutViewportWidth(viewportWidth);

  for (const breakpoint of DASHBOARD_BREAKPOINT_ORDER) {
    if (layoutWidth >= breakpoints[breakpoint]) {
      return breakpoint;
    }
  }

  return DASHBOARD_BREAKPOINT_ORDER[DASHBOARD_BREAKPOINT_ORDER.length - 1];
};

export const calculateDashboardRowHeight = (
  viewportWidth: number,
  breakpoint: DashboardViewportBreakpoint
): number => {
  const layoutWidth = getDashboardLayoutViewportWidth(viewportWidth);
  const columnCount = cols[breakpoint] || cols.lg;
  const totalPadding = GRID.CONTAINER_PADDING * 2;
  const totalMargins = GRID.ITEM_MARGIN * (columnCount - 1);
  const usableWidth = Math.max(layoutWidth - totalPadding - totalMargins, columnCount);
  const columnWidth = usableWidth / columnCount;

  if (layoutWidth < 600) {
    return columnWidth * 0.8;
  }

  if (layoutWidth < 1200) {
    return columnWidth * 0.9;
  }

  return columnWidth;
};
