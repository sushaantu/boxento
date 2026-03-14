type ClosestCapableTarget = EventTarget & {
  closest?: (selector: string) => Element | null;
};

type DashboardInteractionEvent = {
  target: EventTarget | null;
  stopPropagation: () => void;
};

const DASHBOARD_INTERACTIVE_CHILD_SELECTORS = [
  '.settings-button',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'a[href]',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[data-dashboard-interactive]',
];

export const DASHBOARD_INTERACTIVE_CHILD_SELECTOR =
  DASHBOARD_INTERACTIVE_CHILD_SELECTORS.join(', ');

export const isDashboardInteractiveTarget = (
  target: EventTarget | null
): target is ClosestCapableTarget => {
  if (!target || typeof target !== 'object') {
    return false;
  }

  const closestTarget = target as ClosestCapableTarget;
  return (
    typeof closestTarget.closest === 'function' &&
    Boolean(closestTarget.closest(DASHBOARD_INTERACTIVE_CHILD_SELECTOR))
  );
};

export const stopDashboardInteractionPropagation = (
  event: DashboardInteractionEvent
): void => {
  if (isDashboardInteractiveTarget(event.target)) {
    event.stopPropagation();
  }
};
