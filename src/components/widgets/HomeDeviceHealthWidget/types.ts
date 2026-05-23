import type { WidgetProps } from '@/types';
import type { HomeAssistantBaseConfig } from '../homeAssistant/types';

export interface HomeDeviceHealthWidgetConfig extends HomeAssistantBaseConfig {
  batteryThreshold?: number;
}

export type HomeDeviceHealthWidgetProps = WidgetProps<HomeDeviceHealthWidgetConfig>;
