import { WidgetProps } from '@/types';

/**
 * Asset breakdown from Paisa API
 */
export interface AssetBreakdown {
  group: string;
  investmentAmount: number;
  withdrawalAmount: number;
  marketAmount: number;
  balanceUnits: number;
  latestPrice: number;
  xirr: number;
  gainAmount: number;
  absoluteReturn: number;
}

/**
 * Networth timeline entry
 */
export interface NetworthEntry {
  date: string;
  investmentAmount: number;
  withdrawalAmount: number;
  gainAmount: number;
  balanceAmount: number;
  balanceUnits: number;
  netInvestmentAmount: number;
}

/**
 * Configuration options for the Paisa widget
 */
export interface PaisaWidgetConfig {
  id?: string;
  title?: string;
  baseUrl?: string; // Paisa API URL
  refreshInterval?: number; // Refresh interval in seconds
  showChart?: boolean; // Show networth chart
  currency?: string; // Display currency symbol
  onUpdate?: (config: PaisaWidgetConfig) => void;
  onDelete?: () => void;
  [key: string]: unknown;
}

/**
 * Props for the Paisa widget component
 */
export type PaisaWidgetProps = WidgetProps<PaisaWidgetConfig>;
