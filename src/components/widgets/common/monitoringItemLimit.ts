const MIN_STANDARD_MONITORING_ITEMS = 6;
const MAX_STANDARD_MONITORING_ITEMS = 12;
const SHORT_LAYOUT_ITEM_LIMIT = 4;
const COMPACT_LAYOUT_ITEM_LIMIT = 3;

export const getAutomaticMonitoringItemLimit = (
  width: number,
  height: number,
): number | undefined => {
  if (width >= 6 && height >= 6) {
    return undefined;
  }

  if (height === 1 && width > 1) {
    return SHORT_LAYOUT_ITEM_LIMIT;
  }

  if (width <= 2 || height <= 2) {
    return COMPACT_LAYOUT_ITEM_LIMIT;
  }

  return Math.min(
    MAX_STANDARD_MONITORING_ITEMS,
    Math.max(MIN_STANDARD_MONITORING_ITEMS, Math.floor(width * height * 0.75)),
  );
};

export const getMonitoringItemLimit = (
  width: number,
  height: number,
  maxItems?: number,
): number | undefined => {
  if (typeof maxItems === 'number' && Number.isFinite(maxItems) && maxItems > 0) {
    return Math.floor(maxItems);
  }

  return getAutomaticMonitoringItemLimit(width, height);
};

export const parseMonitoringItemLimit = (value: string): number | undefined => {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
};

export const formatMonitoringItemLimitPlaceholder = (itemLimit?: number): string =>
  itemLimit ? `Auto (${itemLimit})` : 'Auto (All)';
