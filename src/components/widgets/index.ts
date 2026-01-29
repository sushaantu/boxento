import React from 'react';
import { WidgetConfig, WidgetProps } from '@/types';

// Lazy load widget components - each widget will be in its own chunk
const CalendarWidget = React.lazy(() => import('./CalendarWidget/index'));
const WeatherWidget = React.lazy(() => import('./WeatherWidget/index'));
const WorldClocksWidget = React.lazy(() => import('./WorldClocksWidget/index'));
const QuickLinksWidget = React.lazy(() => import('./QuickLinksWidget/index'));
const NotesWidget = React.lazy(() => import('./NotesWidget/index'));
const TodoWidget = React.lazy(() => import('./TodoWidget/index'));
const PomodoroWidget = React.lazy(() => import('./PomodoroWidget/index'));
const CurrencyConverterWidget = React.lazy(() => import('./CurrencyConverterWidget/index'));
const ReadwiseWidget = React.lazy(() => import('./ReadwiseWidget/index'));
const UFWidget = React.lazy(() => import('./UFWidget/index'));
const YouTubeWidget = React.lazy(() => import('./YouTubeWidget/index'));
const RSSWidget = React.lazy(() => import('./RSSWidget/index'));
const GitHubStreakWidget = React.lazy(() => import('./GitHubStreakWidget/index'));
const FlightTrackerWidget = React.lazy(() => import('./FlightTrackerWidget/index'));
const GeographyQuizWidget = React.lazy(() => import('./GeographyQuizWidget/index'));
const TodoistWidget = React.lazy(() => import('./TodoistWidget/index'));
const YearProgressWidget = React.lazy(() => import('./YearProgressWidget/index'));
const IframeWidget = React.lazy(() => import('./IframeWidget/index'));
const HabitWidget = React.lazy(() => import('./HabitWidget/index'));
const CountdownWidget = React.lazy(() => import('./CountdownWidget/index'));
const QRCodeWidget = React.lazy(() => import('./QRCodeWidget/index'));
const ReaderWidget = React.lazy(() => import('./ReaderWidget/index'));
const ServicesWidget = React.lazy(() => import('./ServicesWidget/index'));
const OllamaWidget = React.lazy(() => import('./OllamaWidget/index'));
const PaisaWidget = React.lazy(() => import('./PaisaWidget/index'));
const JellyfinWidget = React.lazy(() => import('./JellyfinWidget/index'));
const FavaWidget = React.lazy(() => import('./FavaWidget/index'));
const RivenWidget = React.lazy(() => import('./RivenWidget/index'));

// Export widget types
export * from './CalendarWidget/types';
export * from './WeatherWidget/types';
export * from './WorldClocksWidget/types';
export * from './QuickLinksWidget/types';
export * from './NotesWidget/types';
export * from './TodoWidget/types';
export * from './PomodoroWidget/types';
export * from './CurrencyConverterWidget/types';
export * from './ReadwiseWidget/types';
export * from './UFWidget/types';
export * from './YouTubeWidget/types';
export * from './RSSWidget/types';
export * from './GitHubStreakWidget/types';
export * from './FlightTrackerWidget/types';
export * from './GeographyQuizWidget/types';
export * from './TodoistWidget/types';
export * from './YearProgressWidget/types';
export * from './IframeWidget/types';
export * from './HabitWidget/types';
export * from './CountdownWidget/types';
export * from './QRCodeWidget/types';
export * from './ReaderWidget/types';
export * from './ServicesWidget/types';
export * from './OllamaWidget/types';
export * from './PaisaWidget/types';
export * from './JellyfinWidget/types';
export * from './FavaWidget/types';
export * from './RivenWidget/types';

// Enhanced Widget Config
export interface EnhancedWidgetConfig extends WidgetConfig {
  category: string;
  description: string;
  [key: string]: unknown;
}

// Widget registry with enhanced metadata
export const WIDGET_REGISTRY: EnhancedWidgetConfig[] = [
  {
    type: 'calendar',
    name: 'Calendar',
    icon: 'Calendar',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Productivity',
    description: 'Display your upcoming events and appointments'
  },
  {
    type: 'weather',
    name: 'Weather',
    icon: 'Cloud',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Information',
    description: 'Display current weather and forecast'
  },
  {
    type: 'world-clocks',
    name: 'World Clocks',
    icon: 'Clock',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Information',
    description: 'Display time across different timezones'
  },
  {
    type: 'quick-links',
    name: 'Quick Links',
    icon: 'Link',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Productivity',
    description: 'Save and quickly access your favorite links'
  },
  {
    type: 'notes',
    name: 'Notes',
    icon: 'StickyNote',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Productivity',
    description: 'Take and save quick notes'
  },
  {
    type: 'todo',
    name: 'Todo List',
    icon: 'CheckSquare',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Productivity',
    description: 'Manage your tasks and to-dos'
  },
  {
    type: 'pomodoro',
    name: 'Pomodoro Timer',
    icon: 'Timer',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Productivity',
    description: 'Time management with the Pomodoro Technique'
  },
  {
    type: 'currency-converter',
    name: 'Currency Converter',
    icon: 'DollarSign',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Finance',
    description: 'Convert between currencies using live exchange rates'
  },
  {
    type: 'readwise',
    name: 'Readwise Highlights',
    icon: 'BookOpen',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 3,
    category: 'Information',
    description: 'Display highlights from your Readwise account'
  },
  {
    type: 'uf-chile',
    name: 'UF (Chile)',
    icon: 'DollarSign',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Finance',
    description: 'Display the value of UF in Chilean Pesos'
  },
  {
    type: 'youtube',
    name: 'YouTube Video',
    icon: 'Video',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Entertainment',
    description: 'Watch YouTube videos directly on your dashboard'
  },
  {
    type: 'rss',
    name: 'RSS Feed',
    icon: 'Rss',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 3,
    defaultHeight: 3,
    category: 'Information',
    description: 'Display RSS feeds from your favorite websites'
  },
  {
    type: 'github-streak',
    name: 'GitHub Streak',
    icon: 'Github',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Productivity',
    description: 'Track your GitHub contribution streak and activity'
  },
  {
    type: 'flight-tracker',
    name: 'Flight Tracker',
    icon: 'Plane',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Travel',
    description: 'Track real-time flight status using Amadeus API'
  },
  {
    type: 'geography-quiz',
    name: 'Geography Quiz',
    icon: 'Globe',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Education',
    description: 'Test your geography knowledge with an interactive quiz'
  },
  {
    type: 'todoist',
    name: 'Todoist Tasks',
    icon: 'CheckSquare',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 4,
    category: 'Productivity',
    description: 'View and manage your Todoist tasks'
  },
  {
    type: 'year-progress',
    name: 'Year Progress',
    icon: 'Calendar',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Information',
    description: 'Visual representation of year progress with dots'
  },
  {
    type: 'iframe',
    name: 'Embed',
    icon: 'Globe',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 3,
    defaultHeight: 3,
    category: 'Utilities',
    description: 'Embed external content via iframe URL'
  },
  {
    type: 'habits',
    name: 'Habit Tracker',
    icon: 'CheckSquare',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 3,
    defaultHeight: 3,
    category: 'Productivity',
    description: 'Track daily habits and build streaks'
  },
  {
    type: 'countdown',
    name: 'Countdown',
    icon: 'Clock',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Productivity',
    description: 'Count down to important events and dates'
  },
  {
    type: 'qrcode',
    name: 'QR Code',
    icon: 'QrCode',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'Utilities',
    description: 'Generate QR codes from text or URLs'
  },
  {
    type: 'reader',
    name: 'Reader',
    icon: 'BookMarked',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 3,
    defaultHeight: 3,
    category: 'Information',
    description: 'Random articles from your Readwise Reader library'
  },
  {
    type: 'services',
    name: 'Services',
    icon: 'Server',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 3,
    defaultHeight: 3,
    category: 'Local Services',
    description: 'Monitor and access your self-hosted services'
  },
  {
    type: 'ollama',
    name: 'Ollama Chat',
    icon: 'Bot',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 3,
    defaultHeight: 4,
    category: 'Local Services',
    description: 'Chat with your local Ollama AI models'
  },
  {
    type: 'paisa',
    name: 'Paisa Finance',
    icon: 'PiggyBank',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 3,
    defaultHeight: 3,
    category: 'Local Services',
    description: 'View your networth and asset breakdown from Paisa'
  },
  {
    type: 'jellyfin',
    name: 'Jellyfin',
    icon: 'Film',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 3,
    defaultHeight: 3,
    category: 'Local Services',
    description: 'View now playing and recently added media from Jellyfin'
  },
  {
    type: 'fava',
    name: 'Fava',
    icon: 'BookOpen',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 3,
    defaultHeight: 3,
    category: 'Local Services',
    description: 'View beancount balance sheet and income statement'
  },
  {
    type: 'riven',
    name: 'Riven',
    icon: 'Film',
    minWidth: 2,
    minHeight: 2,
    defaultWidth: 2,
    defaultHeight: 3,
    category: 'Local Services',
    description: 'Quick access to Riven media automation'
  }
];

// Widget categories
export const WIDGET_CATEGORIES = [
  { id: 'productivity', name: 'Productivity' },
  { id: 'information', name: 'Information' },
  { id: 'social', name: 'Social' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'finance', name: 'Finance' },
  { id: 'entertainment', name: 'Entertainment' },
  { id: 'local-services', name: 'Local Services' }
];

// Widget component type - now supports lazy components
type WidgetComponent = React.ComponentType<WidgetProps<Record<string, unknown>>>;
type LazyWidgetComponent = React.LazyExoticComponent<React.ComponentType<WidgetProps<Record<string, unknown>>>>;

/**
 * Widget component registry - maps widget types to their lazy-loaded components.
 * Each widget is loaded on-demand when first rendered.
 */
const WIDGET_COMPONENTS: Record<string, LazyWidgetComponent> = {
  'calendar': CalendarWidget,
  'weather': WeatherWidget,
  'world-clocks': WorldClocksWidget,
  'quick-links': QuickLinksWidget as unknown as LazyWidgetComponent,
  'notes': NotesWidget,
  'todo': TodoWidget,
  'pomodoro': PomodoroWidget,
  'currency-converter': CurrencyConverterWidget,
  'readwise': ReadwiseWidget,
  'uf-chile': UFWidget,
  'youtube': YouTubeWidget,
  'rss': RSSWidget as unknown as LazyWidgetComponent,
  'github-streak': GitHubStreakWidget,
  'flight-tracker': FlightTrackerWidget,
  'geography-quiz': GeographyQuizWidget,
  'todoist': TodoistWidget,
  'year-progress': YearProgressWidget,
  'iframe': IframeWidget,
  'habits': HabitWidget,
  'countdown': CountdownWidget,
  'qrcode': QRCodeWidget,
  'reader': ReaderWidget,
  'services': ServicesWidget as unknown as LazyWidgetComponent,
  'ollama': OllamaWidget as unknown as LazyWidgetComponent,
  'paisa': PaisaWidget as unknown as LazyWidgetComponent,
  'jellyfin': JellyfinWidget as unknown as LazyWidgetComponent,
  'fava': FavaWidget as unknown as LazyWidgetComponent,
  'riven': RivenWidget as unknown as LazyWidgetComponent,
};

/**
 * Get widget component by type (returns lazy-loaded component)
 */
export const getWidgetComponent = (type: string): WidgetComponent | null => {
  return WIDGET_COMPONENTS[type] ?? null;
};

/**
 * Get widget configuration by type
 */
export const getWidgetConfigByType = (type: string): EnhancedWidgetConfig | undefined => {
  return WIDGET_REGISTRY.find(widget => widget.type === type);
};
