import type { WidgetProps } from '@/types';
import type { HomeAssistantBaseConfig } from '../homeAssistant/types';

export interface HomeLightsWidgetConfig extends HomeAssistantBaseConfig {
  maxItems?: number;
  showOnlyOn?: boolean;
}

export type HomeLightsWidgetProps = WidgetProps<HomeLightsWidgetConfig>;
