import { WidgetProps } from '@/types';

/**
 * A single service configuration
 */
export interface Service {
  id: string;
  name: string;
  url: string;
  icon?: string; // Lucide icon name or URL to icon
  description?: string;
  category?: string;
  statusUrl?: string; // URL to check for health (defaults to url)
}

/**
 * Configuration options for the Services widget
 */
export interface ServicesWidgetConfig {
  id?: string;
  title?: string;
  services: Service[];
  showStatus?: boolean; // Whether to show online/offline status
  checkInterval?: number; // Status check interval in seconds (default: 60)
  onUpdate?: (config: ServicesWidgetConfig) => void;
  onDelete?: () => void;
  [key: string]: unknown;
}

/**
 * Props for the Services widget component
 */
export type ServicesWidgetProps = WidgetProps<ServicesWidgetConfig>;
