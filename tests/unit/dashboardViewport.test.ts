import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_LAYOUT_MAX_WIDTH,
  calculateDashboardRowHeight,
  getDashboardBreakpointForWidth,
  getDashboardLayoutViewportWidth,
} from '@/lib/dashboardViewport';

describe('dashboardViewport', () => {
  it('caps desktop layout width on large external displays', () => {
    expect(getDashboardLayoutViewportWidth(1512)).toBe(1512);
    expect(getDashboardLayoutViewportWidth(2560)).toBe(DASHBOARD_LAYOUT_MAX_WIDTH);
  });

  it('keeps large external displays on the laptop-class dashboard breakpoint', () => {
    expect(getDashboardBreakpointForWidth(1512)).toBe('lg');
    expect(getDashboardBreakpointForWidth(2560)).toBe('lg');
    expect(getDashboardBreakpointForWidth(767)).toBe('xs');
  });

  it('uses the bounded dashboard width for row height calculations', () => {
    const laptopRowHeight = calculateDashboardRowHeight(1512, 'lg');
    const externalDisplayRowHeight = calculateDashboardRowHeight(2560, 'lg');

    expect(externalDisplayRowHeight).toBe(laptopRowHeight);
  });
});
