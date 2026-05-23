import type { WidgetProps } from '@/types';
import type { HomeAssistantBaseConfig } from '../homeAssistant/types';

export interface HomeClimateWidgetConfig extends HomeAssistantBaseConfig {
  maxItems?: number;
}

export type HomeClimateWidgetProps = WidgetProps<HomeClimateWidgetConfig>;
