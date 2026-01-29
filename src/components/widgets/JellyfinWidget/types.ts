import { WidgetProps } from '@/types';

/**
 * Jellyfin media item
 */
export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  SeriesName?: string;
  SeasonName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  Overview?: string;
  ProductionYear?: number;
  RunTimeTicks?: number;
  ImageTags?: {
    Primary?: string;
  };
  UserData?: {
    PlaybackPositionTicks?: number;
    PlayedPercentage?: number;
    Played?: boolean;
  };
}

/**
 * Jellyfin session
 */
export interface JellyfinSession {
  Id: string;
  UserName: string;
  Client: string;
  DeviceName: string;
  NowPlayingItem?: JellyfinItem;
  PlayState?: {
    PositionTicks?: number;
    IsPaused?: boolean;
  };
}

/**
 * Configuration options for the Jellyfin widget
 */
export interface JellyfinWidgetConfig {
  id?: string;
  title?: string;
  baseUrl?: string; // Jellyfin server URL
  apiKey?: string; // Jellyfin API key
  userId?: string; // User ID for user-specific data
  refreshInterval?: number; // Refresh interval in seconds
  onUpdate?: (config: JellyfinWidgetConfig) => void;
  onDelete?: () => void;
  [key: string]: unknown;
}

/**
 * Props for the Jellyfin widget component
 */
export type JellyfinWidgetProps = WidgetProps<JellyfinWidgetConfig>;
