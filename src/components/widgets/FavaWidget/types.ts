import { WidgetProps } from '@/types';

/**
 * Balance entry from Fava API
 */
export interface FavaBalance {
  [currency: string]: number;
}

/**
 * Account tree node from Fava
 */
export interface FavaAccountNode {
  account: string;
  balance: FavaBalance;
  balance_children: FavaBalance;
  children: FavaAccountNode[];
}

/**
 * Configuration options for the Fava widget
 */
export interface FavaWidgetConfig {
  id?: string;
  title?: string;
  baseUrl?: string; // Fava URL
  beancountPath?: string; // Path to beancount file (e.g., "eleva-spa")
  refreshInterval?: number; // Refresh interval in seconds
  currency?: string; // Display currency symbol
  onUpdate?: (config: FavaWidgetConfig) => void;
  onDelete?: () => void;
  [key: string]: unknown;
}

/**
 * Props for the Fava widget component
 */
export type FavaWidgetProps = WidgetProps<FavaWidgetConfig>;
