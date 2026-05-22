import { describe, expect, it } from 'vitest';

import {
  calculateDashboardRowHeight,
  getDashboardBreakpointForWidth,
  getDashboardLayoutViewportWidth,
} from '@/lib/dashboardViewport';

describe('dashboardViewport', () => {
  it('uses the full layout width on large external displays', () => {
    expect(getDashboardLayoutViewportWidth(1512)).toBe(1512);
    expect(getDashboardLayoutViewportWidth(2560)).toBe(2560);
    expect(getDashboardLayoutViewportWidth(3840)).toBe(3840);
  });

  it('uses wide dashboard breakpoints on large external displays', () => {
    expect(getDashboardBreakpointForWidth(1512)).toBe('lg');
    expect(getDashboardBreakpointForWidth(1536)).toBe('xl');
    expect(getDashboardBreakpointForWidth(1920)).toBe('xxl');
    expect(getDashboardBreakpointForWidth(2560)).toBe('xxxl');
    expect(getDashboardBreakpointForWidth(767)).toBe('xs');
  });

  it('uses the full dashboard width for row height calculations', () => {
    const laptopRowHeight = calculateDashboardRowHeight(1512, 'lg');
    const externalDisplayRowHeight = calculateDashboardRowHeight(3840, 'xxxl');

    expect(externalDisplayRowHeight).toBeGreaterThan(laptopRowHeight);
  });
});
