import { WidgetProps } from '@/types';

export interface TennisWidgetConfig {
  id?: string;
  title?: string;
  readOnly?: boolean;
  onUpdate?: (config: TennisWidgetConfig) => void;
  onDelete?: () => void;
  [key: string]: unknown;
}

export type TennisWidgetProps = WidgetProps<TennisWidgetConfig>;

export interface TennisScore {
  sets: number[];
  games: number[][] | null;
  points: (string | null)[];
  server: 1 | 2 | null;
  is_tiebreak: boolean;
}

export interface TennisMatch {
  id: number;
  tournament: string;
  players: { p1: { name: string }; p2: { name: string } };
  score: TennisScore | null;
}

export interface TennisSnapshot {
  matches: TennisMatch[];
  updatedAt: number | null;
  error?: string;
}
