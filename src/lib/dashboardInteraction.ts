type ClosestCapableTarget = EventTarget & {
  closest?: (selector: string) => Element | null;
  parentElement?: Element | null;
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

const resolveClosestCapableTarget = (
  target: EventTarget | null
): ClosestCapableTarget | null => {
  if (!target || typeof target !== 'object') {
    return null;
  }

  const closestTarget = target as ClosestCapableTarget;
  if (typeof closestTarget.closest === 'function') {
    return closestTarget;
  }

  const parentTarget = closestTarget.parentElement as ClosestCapableTarget | null;
  if (parentTarget && typeof parentTarget.closest === 'function') {
    return parentTarget;
  }

  return null;
};

export const isDashboardInteractiveTarget = (
  target: EventTarget | null
): target is ClosestCapableTarget => {
  const closestTarget = resolveClosestCapableTarget(target);
  if (!closestTarget || typeof closestTarget.closest !== 'function') {
    return false;
  }

  return Boolean(closestTarget.closest(DASHBOARD_INTERACTIVE_CHILD_SELECTOR));
};

export const stopDashboardInteractionPropagation = (
  event: DashboardInteractionEvent
): void => {
  if (isDashboardInteractiveTarget(event.target)) {
    event.stopPropagation();
  }
};

export const stopDashboardContextMenuPropagation = (
  event: { stopPropagation: () => void }
): void => {
  event.stopPropagation();
};
