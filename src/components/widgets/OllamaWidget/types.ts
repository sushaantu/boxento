import { WidgetProps } from '@/types';

/**
 * A chat message in the conversation
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * Configuration options for the Ollama widget
 */
export interface OllamaWidgetConfig {
  id?: string;
  title?: string;
  baseUrl?: string; // Ollama API URL (default: http://localhost:11434)
  model?: string; // Selected model (default: first available)
  systemPrompt?: string; // Optional system prompt
  messages?: ChatMessage[]; // Chat history
  onUpdate?: (config: OllamaWidgetConfig) => void;
  onDelete?: () => void;
  [key: string]: unknown;
}

/**
 * Ollama model info from API
 */
export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

/**
 * Props for the Ollama widget component
 */
export type OllamaWidgetProps = WidgetProps<OllamaWidgetConfig>;
