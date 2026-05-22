import type { Widget } from '@/types';

export type WidgetConfigPersistenceOptions = {
  configWidgetIdsToSave?: Iterable<string>;
  persistAllConfigs?: boolean;
};

export const getConfigWidgetIdsToSave = (
  widgets: Widget[],
  options: WidgetConfigPersistenceOptions,
): string[] => {
  if (options.persistAllConfigs) {
    return widgets
      .filter(widget => widget.id && widget.config)
      .map(widget => widget.id);
  }

  return Array.from(new Set(options.configWidgetIdsToSave ?? []));
};
