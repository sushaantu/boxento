import type { WidgetProps } from '@/types';
import type { HomeAssistantBaseConfig } from '../homeAssistant/types';

export interface HomeOverviewWidgetConfig extends HomeAssistantBaseConfig {
  batteryThreshold?: number;
}

export type HomeOverviewWidgetProps = WidgetProps<HomeOverviewWidgetConfig>;
