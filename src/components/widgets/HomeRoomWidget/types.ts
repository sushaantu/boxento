import type { WidgetProps } from '@/types';
import type { HomeAssistantBaseConfig } from '../homeAssistant/types';

export interface HomeRoomWidgetConfig extends HomeAssistantBaseConfig {
  maxItems?: number;
}

export type HomeRoomWidgetProps = WidgetProps<HomeRoomWidgetConfig>;
