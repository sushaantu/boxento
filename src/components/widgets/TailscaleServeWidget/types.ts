import { WidgetProps } from '@/types';

export type TailscaleServeTargetType = 'local' | 'lan' | 'tailnet' | 'orb' | 'remote' | 'text' | 'unknown';

export interface TailscaleServeRoute {
  id: string;
  host: string;
  hostPort: string;
  port: number | null;
  path: string;
  protocol: 'http' | 'https' | 'tcp';
  publicUrl: string;
  target: string;
  targetHost: string | null;
  targetPort: number | null;
  targetProtocol: string | null;
  targetType: TailscaleServeTargetType;
}

export interface TailscaleServeWidgetData {
  routes: TailscaleServeRoute[];
  summary: {
    total: number;
    https: number;
    http: number;
    local: number;
    lan: number;
    tailnet: number;
    orb: number;
  };
  source: 'cli' | 'url' | 'file' | 'env';
  updatedAt: string;
}

export interface TailscaleServeWidgetConfig {
  id?: string;
  title?: string;
  apiUrl?: string;
  refreshInterval?: number;
  maxItems?: number;
  showTargets?: boolean;
  targetTypeFilter?: TailscaleServeTargetType | 'all';
  onUpdate?: (config: TailscaleServeWidgetConfig) => void;
  onDelete?: () => void;
  readOnly?: boolean;
  [key: string]: unknown;
}

export type TailscaleServeWidgetProps = WidgetProps<TailscaleServeWidgetConfig>;
