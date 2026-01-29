import { WidgetProps } from '@/types';

/**
 * TMDB search result
 */
export interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv';
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  overview: string;
  vote_average: number;
}

/**
 * Configuration options for the Riven widget
 */
export interface RivenWidgetConfig {
  id?: string;
  title?: string;
  baseUrl?: string; // Riven frontend URL
  apiUrl?: string; // Riven backend API URL
  apiKey?: string; // Riven API key
  onUpdate?: (config: RivenWidgetConfig) => void;
  onDelete?: () => void;
  [key: string]: unknown;
}

/**
 * Props for the Riven widget component
 */
export type RivenWidgetProps = WidgetProps<RivenWidgetConfig>;
