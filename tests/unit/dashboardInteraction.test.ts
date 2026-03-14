import { describe, expect, it, vi } from 'vitest';

import {
  DASHBOARD_INTERACTIVE_CHILD_SELECTOR,
  isDashboardInteractiveTarget,
  stopDashboardInteractionPropagation,
} from '@/lib/dashboardInteraction';

const createClosestTarget = (closestResult: Element | null) => {
  const closest = vi.fn(() => closestResult);

  return {
    closest,
  } as unknown as EventTarget & {
    closest: (selector: string) => Element | null;
  };
};

describe('dashboard interaction helpers', () => {
  it('matches the shared selector for standard widget controls', () => {
    expect(DASHBOARD_INTERACTIVE_CHILD_SELECTOR).toContain('.settings-button');
    expect(DASHBOARD_INTERACTIVE_CHILD_SELECTOR).toContain('button');
    expect(DASHBOARD_INTERACTIVE_CHILD_SELECTOR).toContain('input');
    expect(DASHBOARD_INTERACTIVE_CHILD_SELECTOR).toContain('a[href]');
    expect(DASHBOARD_INTERACTIVE_CHILD_SELECTOR).toContain('[data-dashboard-interactive]');
  });

  it('treats matching descendants as interactive dashboard targets', () => {
    const target = createClosestTarget({} as Element);

    expect(isDashboardInteractiveTarget(target)).toBe(true);
    expect(target.closest).toHaveBeenCalledWith(DASHBOARD_INTERACTIVE_CHILD_SELECTOR);
  });

  it('ignores targets that do not match the interactive selector', () => {
    const target = createClosestTarget(null);

    expect(isDashboardInteractiveTarget(target)).toBe(false);
    expect(target.closest).toHaveBeenCalledWith(DASHBOARD_INTERACTIVE_CHILD_SELECTOR);
  });

  it('stops propagation for interactive targets', () => {
    const stopPropagation = vi.fn();

    stopDashboardInteractionPropagation({
      target: createClosestTarget({} as Element),
      stopPropagation,
    });

    expect(stopPropagation).toHaveBeenCalledOnce();
  });

  it('does not stop propagation for non-interactive targets', () => {
    const stopPropagation = vi.fn();

    stopDashboardInteractionPropagation({
      target: createClosestTarget(null),
      stopPropagation,
    });

    expect(stopPropagation).not.toHaveBeenCalled();
  });
});
