import { WidgetProps } from '@/types';

/**
 * RSS feed item structure
 * 
 * @interface RSSFeedItem
 * @property {string} title - Title of the feed item
 * @property {string} link - Link to the full article
 * @property {string} [description] - Summary or excerpt of the article
 * @property {string} [content] - Full content of the article if available
 * @property {string} [pubDate] - Publication date
 * @property {string} [author] - Author of the article
 * @property {string} [image] - Featured image URL
 * @property {string} [commentsLink] - Optional discussion/comments URL
 * @property {string} [feedTitle] - Title of the feed the item came from
 */
export interface RSSFeedItem {
  title: string;
  link: string;
  description?: string;
  content?: string;
  pubDate?: string;
  author?: string;
  image?: string;
  commentsLink?: string;
  feedTitle?: string;
}

/**
 * Display mode for the RSS widget
 */
export enum RSSDisplayMode {
  LIST = 'list',
  CARDS = 'cards',
  COMPACT = 'compact'
}

/**
 * RSS Feed configuration
 */
export interface RSSFeed {
  url: string;
  title: string;
  enabled: boolean;
  category?: string;
}

/**
 * Configuration options for the RSS widget
 * 
 * @interface RSSWidgetConfig
 * @property {string} [id] - Unique identifier for the widget instance
 * @property {string} [title] - Title to display in the widget header
 * @property {RSSFeed[]} feeds - Array of RSS feeds to display
 * @property {number} [maxItems] - Maximum number of items to display
 * @property {boolean} [showImages] - Whether to show images in the feed
 * @property {boolean} [showDate] - Whether to show publication dates
 * @property {boolean} [showAuthor] - Whether to show authors
 * @property {boolean} [showDescription] - Whether to show article descriptions
 * @property {RSSDisplayMode} [displayMode] - How to display the feed (list, cards, compact)
 * @property {boolean} [openInNewTab] - Whether to open links in a new tab
 */
export interface RSSWidgetConfig {
  id?: string;
  title?: string;
  feeds: RSSFeed[];
  maxItems?: number;
  showImages?: boolean;
  showDate?: boolean;
  showAuthor?: boolean;
  showDescription?: boolean;
  displayMode?: RSSDisplayMode;
  openInNewTab?: boolean;
  onUpdate?: (config: RSSWidgetConfig) => void;
  onDelete?: () => void;
  [key: string]: unknown; // Index signature to satisfy Record<string, unknown>
}

/**
 * Props for the RSS widget component
 * 
 * @type RSSWidgetProps
 */
export type RSSWidgetProps = WidgetProps<RSSWidgetConfig>; 
