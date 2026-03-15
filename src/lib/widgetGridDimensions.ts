import { LayoutItem } from '@/types';

type WidgetGridDimensions = {
  width: number;
  height: number;
};

type ResolveWidgetGridDimensionsOptions = {
  currentLayoutById: ReadonlyMap<string, Pick<LayoutItem, 'w' | 'h'>>;
  isLayoutReady: boolean;
  isMobileView?: boolean;
  widgetId: string;
};

const DEFAULT_DESKTOP_WIDGET_DIMENSIONS: WidgetGridDimensions = {
  width: 3,
  height: 3,
};

const DEFAULT_MOBILE_WIDGET_DIMENSIONS: WidgetGridDimensions = {
  width: 2,
  height: 2,
};

export const getWidgetGridDimensions = ({
  currentLayoutById,
  isLayoutReady,
  isMobileView = false,
  widgetId,
}: ResolveWidgetGridDimensionsOptions): WidgetGridDimensions => {
  if (isMobileView) {
    return DEFAULT_MOBILE_WIDGET_DIMENSIONS;
  }

  if (!isLayoutReady) {
    return DEFAULT_DESKTOP_WIDGET_DIMENSIONS;
  }

  const layoutItem = currentLayoutById.get(widgetId);
  if (!layoutItem) {
    return DEFAULT_DESKTOP_WIDGET_DIMENSIONS;
  }

  return {
    width: layoutItem.w,
    height: layoutItem.h,
  };
};
