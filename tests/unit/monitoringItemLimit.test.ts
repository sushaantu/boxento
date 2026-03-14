import { describe, expect, it } from 'vitest';

import {
  formatMonitoringItemLimitPlaceholder,
  getAutomaticMonitoringItemLimit,
  getMonitoringItemLimit,
  parseMonitoringItemLimit,
} from '@/components/widgets/common/monitoringItemLimit';

describe('monitoring item limit helpers', () => {
  it('uses size-aware defaults for compact, standard, and panel layouts', () => {
    expect(getAutomaticMonitoringItemLimit(2, 2)).toBe(3);
    expect(getAutomaticMonitoringItemLimit(3, 4)).toBe(9);
    expect(getAutomaticMonitoringItemLimit(4, 4)).toBe(12);
  });

  it('shows all matching items for app layouts unless a limit is configured', () => {
    expect(getAutomaticMonitoringItemLimit(6, 6)).toBeUndefined();
    expect(getMonitoringItemLimit(6, 6, 15)).toBe(15);
  });

  it('parses optional item limits from settings input', () => {
    expect(parseMonitoringItemLimit('')).toBeUndefined();
    expect(parseMonitoringItemLimit('0')).toBeUndefined();
    expect(parseMonitoringItemLimit('4.5')).toBeUndefined();
    expect(parseMonitoringItemLimit('7')).toBe(7);
  });

  it('formats the auto placeholder for optional limits', () => {
    expect(formatMonitoringItemLimitPlaceholder(9)).toBe('Auto (9)');
    expect(formatMonitoringItemLimitPlaceholder()).toBe('Auto (All)');
  });
});
