import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { useVisibilityRefresh } from '../../../lib/useVisibilityRefresh';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../ui/dialog';
import WidgetHeader from '../common/WidgetHeader';
import { RSSWidgetConfig, RSSFeedItem, RSSDisplayMode, RSSFeed } from './types';
import type { RSSWidgetProps } from './types';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs';
import sanitizeHtml from 'sanitize-html';
import { Rss, AlertCircle, Upload, ExternalLink, ChevronDown } from 'lucide-react';
import { Skeleton } from '../../ui/skeleton';

/**
 * Size categories for widget content rendering
 */
enum WidgetSizeCategory {
  SMALL = 'small',         // 2x2
  WIDE_SMALL = 'wideSmall', // 3x2
  TALL_SMALL = 'tallSmall', // 2x3
  MEDIUM = 'medium',       // 3x3
  WIDE_MEDIUM = 'wideMedium', // 4x3
  TALL_MEDIUM = 'tallMedium', // 3x4
  LARGE = 'large'          // 4x4
}

/**
 * RSS Widget Component
 *
 * Implements the full "icon -> widget -> app" spectrum:
 * - 1x1 (Tiny): Article count icon
 * - Nx1 (Ribbon): Article count badge + horizontal title chips
 * - 2x2 (Micro): Tight list of 2-3 titles
 * - 3x3 (Widget): Standard list/compact view
 * - 4x4-5x5 (Panel): Card/list view with images
 * - 6x6+ (App): Full news reader with master-detail layout
 *
 * @param {RSSWidgetProps} props - Component props
 * @returns {React.ReactElement} Widget component
 */
export const RSSWidget: React.FC<RSSWidgetProps> = ({ config, width, height }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  // Default configuration
  const defaultConfig = useMemo<RSSWidgetConfig>(() => ({
    title: 'RSS Feed',
    feeds: [],
    maxItems: 5,
    showImages: true,
    showDate: true,
    showAuthor: true,
    showDescription: true,
    displayMode: RSSDisplayMode.LIST,
    openInNewTab: true
  }), []);

  // Component state
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<RSSWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  const [feedItems, setFeedItems] = useState<RSSFeedItem[]>([]);
  // Start loading if there are enabled feeds configured
  const [isLoading, setIsLoading] = useState<boolean>(
    () => (config?.feeds || defaultConfig.feeds)?.some(feed => feed.enabled) ?? false
  );
  const [error, setError] = useState<string | null>(null);
  const [isValidUrl, setIsValidUrl] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('content');

  // App mode state
  const [selectedArticleIndex, setSelectedArticleIndex] = useState<number | null>(null);
  const [appFeedFilter, setAppFeedFilter] = useState<string>('all');
  const [showFeedFilterDropdown, setShowFeedFilterDropdown] = useState(false);

  // Refs for the widget container
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const feedFilterRef = useRef<HTMLDivElement | null>(null);


  // Move fetchSingleFeed before fetchAllFeeds
  const fetchSingleFeed = React.useCallback(async (feed: RSSFeed): Promise<RSSFeedItem[]> => {
    // Use our own CORS proxy (server-side) instead of third-party allorigins.win
    const response = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
    }

    const data = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data, 'text/xml');

    return Array.from(xmlDoc.querySelectorAll('item')).map(item => ({
      title: item.querySelector('title')?.textContent || 'No Title',
      link: item.querySelector('link')?.textContent || '#',
      description: item.querySelector('description')?.textContent || '',
      content: item.querySelector('content\\:encoded, encoded')?.textContent || '',
      pubDate: item.querySelector('pubDate')?.textContent || '',
      author: item.querySelector('author, dc\\:creator')?.textContent || '',
      image: extractImageFromItem(item)
    }));
  }, []);

  /**
   * Fetch all enabled feeds
   */
  const fetchAllFeeds = React.useCallback(async (configToUse?: RSSWidgetConfig) => {
    const currentConfig = configToUse || localConfig;
    const enabledFeeds = (currentConfig.feeds || []).filter(feed => feed.enabled);

    if (!enabledFeeds || enabledFeeds.length === 0) {
      setFeedItems([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const allItems: RSSFeedItem[] = [];
      const failedFeeds: string[] = [];

      // Fetch all feeds in parallel
      await Promise.all(enabledFeeds.map(async feed => {
        try {
          const items = await fetchSingleFeed(feed);
          allItems.push(...items.map(item => ({
            ...item,
            feedTitle: feed.title // Add feed title to each item
          })));
        } catch (error) {
          console.error(`Error fetching feed ${feed.url}:`, error);
          failedFeeds.push(feed.title || feed.url);
        }
      }));

      // Notify user if some feeds failed
      if (failedFeeds.length > 0 && allItems.length > 0) {
        toast.warning(`${failedFeeds.length} feed${failedFeeds.length > 1 ? 's' : ''} failed to load`, {
          description: failedFeeds.slice(0, 2).join(', ') + (failedFeeds.length > 2 ? '...' : ''),
          duration: 4000,
        });
      } else if (failedFeeds.length > 0 && allItems.length === 0) {
        toast.error('Failed to load RSS feeds', {
          description: 'Check your feed URLs or try again later.',
          duration: 5000,
        });
      }

      // Sort all items by date
      const sortedItems = allItems.sort((a, b) => {
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return dateB - dateA;
      });

      setFeedItems(sortedItems);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching feeds:', error);
      setError('Failed to fetch RSS feeds');
      toast.error('Failed to load RSS feeds', {
        description: 'Please check your internet connection.',
        duration: 5000,
      });
      setIsLoading(false);
    }
  }, [localConfig, fetchSingleFeed]);

  /**
   * Extract image from RSS item
   */
  const extractImageFromItem = (item: Element): string => {
    const mediaContent = item.querySelector('media\\:content, content');
    const enclosure = item.querySelector('enclosure[type^="image"]');
    const content = item.querySelector('content\\:encoded, encoded')?.textContent || '';

    if (mediaContent && mediaContent.getAttribute('url')) {
      return mediaContent.getAttribute('url') || '';
    }
    if (enclosure && enclosure.getAttribute('url')) {
      return enclosure.getAttribute('url') || '';
    }

    const imgMatch = content.match(/<img[^>]+src="([^">]+)"/i);
    return imgMatch ? imgMatch[1] : '';
  };

  // Update feeds when config changes
  useEffect(() => {
    const initialConfig = {
      ...defaultConfig,
      ...config,
      feeds: config?.feeds || defaultConfig.feeds
    };
    setLocalConfig(initialConfig);
  }, [config, defaultConfig]);

  // Fetch feeds when enabled feeds change
  useEffect(() => {
    fetchAllFeeds();
  }, [localConfig.feeds, fetchAllFeeds]);

  // Auto-refresh when tab becomes visible or every 15 minutes
  useVisibilityRefresh({
    onRefresh: fetchAllFeeds,
    minHiddenTime: 60000, // Refresh if hidden for 1+ minute
    refreshInterval: 900000, // Refresh every 15 minutes
    enabled: localConfig.feeds?.some(feed => feed.enabled) ?? false
  });

  // Close feed filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (feedFilterRef.current && !feedFilterRef.current.contains(event.target as Node)) {
        setShowFeedFilterDropdown(false);
      }
    };
    if (showFeedFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFeedFilterDropdown]);

  /**
   * Format publication date
   */
  const formatDate = (dateString: string): string => {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  /**
   * Format relative time ago
   */
  const formatTimeAgo = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDay = Math.floor(diffHr / 24);
      if (diffDay < 7) return `${diffDay}d ago`;
      return formatDate(dateString);
    } catch {
      return '';
    }
  };

  /**
   * Truncate text to a certain length
   */
  const truncateText = (text: string, maxLength: number): string => {
    if (!text) return '';

    // Remove unsafe HTML tags
    const strippedText = sanitizeHtml(text, {
      allowedTags: [],
      allowedAttributes: {}
    });

    if (strippedText.length <= maxLength) return strippedText;

    return strippedText.substring(0, maxLength) + '...';
  };

  /**
   * Determines the appropriate size category based on width and height
   */
  const getWidgetSizeCategory = (width: number, height: number): WidgetSizeCategory => {
    if (width >= 4 && height >= 4) {
      return WidgetSizeCategory.LARGE;
    } else if (width >= 4 && height >= 3) {
      return WidgetSizeCategory.WIDE_MEDIUM;
    } else if (width >= 3 && height >= 4) {
      return WidgetSizeCategory.TALL_MEDIUM;
    } else if (width >= 3 && height >= 3) {
      return WidgetSizeCategory.MEDIUM;
    } else if (width >= 3 && height >= 2) {
      return WidgetSizeCategory.WIDE_SMALL;
    } else if (width >= 2 && height >= 3) {
      return WidgetSizeCategory.TALL_SMALL;
    } else {
      return WidgetSizeCategory.SMALL;
    }
  };

  /**
   * Check if feeds are configured (has at least one enabled feed with a URL)
   */
  const hasFeeds = localConfig.feeds?.some(feed => feed.enabled && feed.url) ?? false;

  /**
   * Get filtered feed items for app mode
   */
  const filteredFeedItems = useMemo(() => {
    if (appFeedFilter === 'all') return feedItems;
    return feedItems.filter(item => item.feedTitle === appFeedFilter);
  }, [feedItems, appFeedFilter]);

  /**
   * Get unique feed titles for the filter dropdown
   */
  const uniqueFeedTitles = useMemo(() => {
    const titles = new Set<string>();
    feedItems.forEach(item => {
      if (item.feedTitle) titles.add(item.feedTitle);
    });
    return Array.from(titles);
  }, [feedItems]);

  // -------------------------------------------------------
  // 1x1 TINY VIEW: Article count icon
  // -------------------------------------------------------
  const renderTinyView = () => {
    const count = feedItems.length;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
        <Rss size={18} className="text-muted-foreground" strokeWidth={1.5} />
        {hasFeeds && !isLoading && (
          <div className="text-[1.5rem] font-bold leading-none text-foreground">
            {count}
          </div>
        )}
        {isLoading && hasFeeds && (
          <div className="mt-1 h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/50" />
        )}
      </div>
    );
  };

  // -------------------------------------------------------
  // Nx1 RIBBON VIEW: Count badge + horizontal title chips
  // -------------------------------------------------------
  const renderRibbonView = () => {
    const count = feedItems.length;
    const chipCount = Math.max(2, width - 1);
    const latestItems = feedItems.slice(0, chipCount);

    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1">
        {/* Count badge */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex flex-col items-center rounded-lg bg-muted px-2 py-0.5">
            <Rss size={12} className="text-muted-foreground" strokeWidth={2} />
            <span className="text-lg font-bold leading-tight text-foreground">
              {isLoading ? '-' : count}
            </span>
          </div>
        </div>

        {/* Article title chips */}
        {!isLoading && latestItems.length > 0 ? (
          latestItems.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 hover:bg-accent transition-colors"
            >
              <span className="max-w-[120px] truncate text-xs font-medium text-foreground">
                {item.title}
              </span>
            </a>
          ))
        ) : !isLoading ? (
          <span className="text-xs text-muted-foreground">No articles</span>
        ) : (
          <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
        )}
      </div>
    );
  };

  // -------------------------------------------------------
  // 2x2 MICRO VIEW: Tight list of 2-3 titles
  // -------------------------------------------------------
  const renderMicroView = () => {
    if (isLoading) {
      return (
        <div className="h-full flex flex-col p-2 space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2 w-2/3" />
            </div>
          ))}
        </div>
      );
    }

    if (error) return renderErrorState();

    if (!hasFeeds || feedItems.length === 0) {
      return renderEmptyState();
    }

    const items = feedItems.slice(0, 3);

    return (
      <div className="h-full overflow-hidden px-2 py-1">
        {items.map((item, index) => (
          <a
            key={`${item.link}-${index}`}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-1.5 border-b border-border last:border-0 hover:bg-accent transition-colors rounded-sm px-1"
          >
            <div className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
              {item.title}
            </div>
            {item.feedTitle && (
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {item.feedTitle}
              </div>
            )}
          </a>
        ))}
      </div>
    );
  };

  // -------------------------------------------------------
  // 6x6+ APP VIEW: Full news reader application
  // -------------------------------------------------------
  const renderAppView = () => {
    const selectedArticle = selectedArticleIndex !== null ? filteredFeedItems[selectedArticleIndex] : null;

    if (isLoading) {
      return (
        <div className="flex h-full">
          {/* Left sidebar skeleton */}
          <div className="w-1/3 border-r border-border p-3 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2 w-1/2" />
              </div>
            ))}
          </div>
          {/* Right pane skeleton */}
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <div className="space-y-2 mt-6">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </div>
      );
    }

    if (error) return renderErrorState();

    if (!hasFeeds || feedItems.length === 0) {
      return renderEmptyState();
    }

    return (
      <div className="flex h-full flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2 widget-drag-handle cursor-move">
          <div className="flex items-center gap-3">
            <Rss size={16} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              {localConfig.title || 'RSS Reader'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Feed filter dropdown */}
            <div className="relative" ref={feedFilterRef}>
              <button
                onClick={() => setShowFeedFilterDropdown(!showFeedFilterDropdown)}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
              >
                <span className="max-w-[140px] truncate">
                  {appFeedFilter === 'all' ? 'All Feeds' : appFeedFilter}
                </span>
                <ChevronDown size={12} />
              </button>
              {showFeedFilterDropdown && (
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border border-border bg-background shadow-lg py-1">
                  <button
                    onClick={() => { setAppFeedFilter('all'); setShowFeedFilterDropdown(false); setSelectedArticleIndex(null); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${appFeedFilter === 'all' ? 'font-semibold text-foreground' : 'text-foreground'}`}
                  >
                    All Feeds
                  </button>
                  {uniqueFeedTitles.map(title => (
                    <button
                      key={title}
                      onClick={() => { setAppFeedFilter(title); setShowFeedFilterDropdown(false); setSelectedArticleIndex(null); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors truncate ${appFeedFilter === title ? 'font-semibold text-foreground' : 'text-foreground'}`}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Article count */}
            <span className="text-xs text-muted-foreground">
              {filteredFeedItems.length} article{filteredFeedItems.length !== 1 ? 's' : ''}
            </span>
            {/* Settings button */}
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowSettings(true)}
                title="Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </Button>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar: Article list */}
          <div className="w-1/3 border-r border-border overflow-y-auto">
            {filteredFeedItems.map((item, index) => (
              <button
                key={`${item.link}-${index}`}
                onClick={() => setSelectedArticleIndex(index)}
                className={`w-full text-left px-3 py-2.5 border-b border-border transition-colors ${
                  selectedArticleIndex === index
                    ? 'bg-accent border-l-2 border-l-border'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                  {item.title}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {item.feedTitle && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-[60%]">
                      {item.feedTitle}
                    </span>
                  )}
                  {item.pubDate && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTimeAgo(item.pubDate)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Right pane: Article reader */}
          <div className="flex-1 overflow-y-auto">
            {selectedArticle ? (
              <div className="p-6">
                {/* Article title */}
                <h1 className="text-xl font-bold text-foreground leading-tight">
                  {selectedArticle.title}
                </h1>
                {/* Meta line */}
                <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                  {selectedArticle.feedTitle && (
                    <span className="font-medium text-muted-foreground">
                      {selectedArticle.feedTitle}
                    </span>
                  )}
                  {selectedArticle.feedTitle && selectedArticle.pubDate && (
                    <span className="text-muted-foreground/40">|</span>
                  )}
                  {selectedArticle.pubDate && (
                    <span>{formatDate(selectedArticle.pubDate)}</span>
                  )}
                  {selectedArticle.author && (
                    <>
                      <span className="text-muted-foreground/40">|</span>
                      <span>{selectedArticle.author}</span>
                    </>
                  )}
                </div>
                {/* Open in browser link */}
                <a
                  href={selectedArticle.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink size={14} />
                  Open in browser
                </a>
                {/* Article image */}
                {selectedArticle.image && (
                  <div className="mt-4 rounded-lg overflow-hidden">
                    <img
                      src={selectedArticle.image}
                      alt={selectedArticle.title}
                      className="w-full max-h-64 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {/* Article content */}
                <div className="mt-4 prose prose-sm dark:prose-invert max-w-none">
                  {selectedArticle.content ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(selectedArticle.content, {
                          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
                          allowedAttributes: {
                            ...sanitizeHtml.defaults.allowedAttributes,
                            img: ['src', 'alt', 'width', 'height']
                          }
                        })
                      }}
                    />
                  ) : selectedArticle.description ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(selectedArticle.description, {
                          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
                          allowedAttributes: {
                            ...sanitizeHtml.defaults.allowedAttributes,
                            img: ['src', 'alt', 'width', 'height']
                          }
                        })
                      }}
                    />
                  ) : (
                    <p className="text-muted-foreground italic">
                      No content available. Open in browser to read the full article.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Empty state: no article selected */
              <div className="flex h-full flex-col items-center justify-center text-center p-6">
                <Rss size={32} className="text-muted-foreground/40 mb-3" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">
                  Select an article to read
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filteredFeedItems.length} article{filteredFeedItems.length !== 1 ? 's' : ''} available
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Render feed item
   */
  const renderFeedItem = (item: RSSFeedItem, index: number, mode: RSSDisplayMode): React.ReactElement => {
    const { showImages, showDate, showAuthor, showDescription, openInNewTab } = localConfig;

    const commonContent = (
      <>
        <a
          href={item.link}
          target={openInNewTab ? "_blank" : "_self"}
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm"
        >
          {item.title}
        </a>

        {item.feedTitle && (
          <div className="text-xs text-muted-foreground mt-1">
            {item.feedTitle}
          </div>
        )}

        {(showDate || showAuthor) && (
          <div className="text-xs text-muted-foreground mt-1">
            {showDate && item.pubDate && <span>{formatDate(item.pubDate)}</span>}
            {showDate && showAuthor && item.pubDate && item.author && <span> · </span>}
            {showAuthor && item.author && <span>{item.author}</span>}
          </div>
        )}

        {showDescription && item.description && (
          <p className="text-xs text-foreground mt-2 line-clamp-3">
            {truncateText(item.description, mode === RSSDisplayMode.COMPACT ? 100 : 200)}
          </p>
        )}
      </>
    );

    switch (mode) {
      case RSSDisplayMode.CARDS:
        return (
          <div key={`${item.link}-${index}`} className="h-full flex flex-col">
            {showImages && item.image && (
              <div className="h-32 overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="p-4 flex-grow flex flex-col">
              {commonContent}
            </div>
          </div>
        );

      case RSSDisplayMode.COMPACT:
        return (
          <div key={`${item.link}-${index}`} className="py-2 flex">
            <div className="mr-2 text-muted-foreground">•</div>
            <div className="flex-grow min-w-0">
              {commonContent}
            </div>
          </div>
        );

      case RSSDisplayMode.LIST:
      default:
        return (
          <div key={`${item.link}-${index}`} className="py-3 flex border-b border-border last:border-0">
            {showImages && item.image && (
              <div className="w-16 h-16 mr-3 flex-shrink-0 overflow-hidden rounded">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="flex-grow min-w-0">
              {commonContent}
            </div>
          </div>
        );
    }
  };

  /**
   * Render empty state when no feed URL is provided
   */
  const renderEmptyState = (): React.ReactElement => {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        {/* Use Rss icon from Lucide with consistent styling */}
        <Rss size={24} className="text-muted-foreground mb-3" strokeWidth={1.5} />
        {/* Consistent text styling */}
        <p className="text-sm text-muted-foreground mb-3">
          No RSS feed configured.
        </p>
        {/* Consistent button styling */}
        {!readOnly && (
          <Button
            size="sm"
            onClick={() => setShowSettings(true)}
            variant="outline"
          >
            Configure Feeds
          </Button>
        )}
      </div>
    );
  };

  /**
   * Handle retry button click
   */
  const handleRetryClick = (): void => {
    fetchAllFeeds();
  };

  /**
   * Render error state
   */
  const renderErrorState = (): React.ReactElement => {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <AlertCircle size={24} className="text-red-500 mb-3" strokeWidth={1.5} />
        <p className="text-sm text-red-500 dark:text-red-400 mb-3">
          {error}
        </p>
        <Button
          size="sm"
          onClick={handleRetryClick}
          className="mr-2"
        >
          Try Again
        </Button>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSettings(true)}
          >
            Settings
          </Button>
        )}
      </div>
    );
  };

  /**
   * Render loading state
   */
  const renderLoadingState = (): React.ReactElement => {
    return (
      <div className="h-full flex flex-col p-4 space-y-3 overflow-hidden">
        {/* Feed item skeletons */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-12 w-12 rounded flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Render feed content (for 3x3+ standard/panel sizes)
   */
  const renderFeedContent = () => {
    const { displayMode } = localConfig;

    if (isLoading) {
      return renderLoadingState();
    }

    if (error) {
      return renderErrorState();
    }

    if (!localConfig.feeds || !localConfig.feeds.length || feedItems.length === 0) {
      return renderEmptyState();
    }

    // Determine appropriate display mode based on size and configured preference
    const sizeCategory = getWidgetSizeCategory(width, height);
    let effectiveDisplayMode = displayMode;

    // Override display mode for small widgets
    if (sizeCategory === WidgetSizeCategory.SMALL) {
      effectiveDisplayMode = RSSDisplayMode.COMPACT;
    }

    // Render based on display mode
    switch (effectiveDisplayMode) {
      case RSSDisplayMode.CARDS:
        return (
          <div className="h-full overflow-auto">
            <div className="grid grid-cols-1 gap-4 p-4">
              {renderFeedItems(effectiveDisplayMode)}
            </div>
          </div>
        );

      case RSSDisplayMode.COMPACT:
        return (
          <div className="h-full overflow-auto">
            <div className="px-4 py-2">
              {renderFeedItems(effectiveDisplayMode)}
            </div>
          </div>
        );

      case RSSDisplayMode.LIST:
      default:
        return (
          <div className="h-full overflow-auto">
            <div className="px-4">
              {renderFeedItems(effectiveDisplayMode)}
            </div>
          </div>
        );
    }
  };

  /**
   * Render content based on widget size - full spectrum routing
   */
  const renderContent = () => {
    // Tiny and ribbon always render, even without feeds
    if (isTiny) return renderTinyView();
    if (isShort) return renderRibbonView();

    // App mode has its own layout
    if (isApp) return renderAppView();

    // 2x2 micro view
    if (isCompact && width <= 2 && height <= 2) return renderMicroView();

    // 3x3+ standard/panel sizes use existing feed content logic
    return renderFeedContent();
  };

  // Track validation state
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  /**
   * Test if a feed URL is accessible
   */
  const testFeedUrl = async (url: string): Promise<{ valid: boolean; error?: string }> => {
    if (!url) return { valid: true };

    try {
      new URL(url);
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }

    try {
      // Use our own CORS proxy for validation
      const response = await fetch(`/api/rss?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        return { valid: false, error: `Failed to fetch (${response.status})` };
      }

      const text = await response.text();
      // Check if it looks like RSS/XML
      if (!text.includes('<rss') && !text.includes('<feed') && !text.includes('<channel')) {
        return { valid: false, error: 'Not a valid RSS feed' };
      }

      return { valid: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        return { valid: false, error: 'Request timed out' };
      }
      return { valid: false, error: 'Could not reach feed' };
    }
  };

  /**
   * Save settings with validation
   */
  const saveSettings = async () => {
    const enabledFeeds = localConfig.feeds.filter(f => f.enabled && f.url);

    // Validate enabled feeds before saving
    if (enabledFeeds.length > 0) {
      setIsValidating(true);
      const errors: Record<string, string> = {};

      await Promise.all(
        enabledFeeds.map(async (feed) => {
          const result = await testFeedUrl(feed.url);
          if (!result.valid) {
            errors[feed.url] = result.error || 'Invalid feed';
          }
        })
      );

      setIsValidating(false);

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        toast.error('Some feeds are invalid', {
          description: 'Please check the highlighted feeds and try again.',
          duration: 4000,
        });
        return; // Don't save if validation fails
      }
    }

    setValidationErrors({});

    // Call onUpdate to persist changes
    if (config?.onUpdate && typeof config.onUpdate === 'function') {
      config.onUpdate(localConfig);
    }

    setShowSettings(false);

    // If the feed URL changed, fetch the feed
    if (localConfig.feeds.length > 0) {
      fetchAllFeeds(localConfig);
    }
  };

  /**
   * Validate feed URL format only (for real-time feedback)
   */
  const validateFeedUrl = (url: string): boolean => {
    if (!url) return true; // Empty URL is allowed

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Settings dialog
   */
  const renderSettings = () => {
    return (
      <Dialog
        open={showSettings}
        onOpenChange={(open: boolean) => {
          if (!open) {
            // Reset to original config when closing without save
            if (config) {
              setLocalConfig({
                ...defaultConfig,
                ...config,
                feeds: config?.feeds || defaultConfig.feeds
              });
            }
            setValidationErrors({});
            setShowSettings(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>RSS Feed Settings</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="display">Display</TabsTrigger>
              <TabsTrigger value="examples">Examples</TabsTrigger>
            </TabsList>

            <TabsContent value="content">
              <div className="max-h-[min(60vh,500px)] overflow-y-auto py-4">
                <div className="space-y-4 px-1">
                  {/* Widget Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title-input">Widget Title</Label>
                    <Input
                      id="title-input"
                      type="text"
                      value={localConfig.title || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalConfig({...localConfig, title: e.target.value})}
                      placeholder="RSS Feed"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to use the feed's title
                    </p>
                  </div>

                  {/* Feed URL */}
                  <div className="space-y-2">
                    <Label>RSS Feeds</Label>
                    <div className="space-y-3">
                      <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg bg-background shadow-inner">
                        {localConfig.feeds?.length === 0 ? (
                          <div className="p-8 text-center text-sm text-muted-foreground">
                            <Rss className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No feeds added yet</p>
                            <p className="text-xs mt-1 text-muted-foreground">Add feeds manually or import from OPML</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-border">
                            {localConfig.feeds?.map((feed, index) => (
                              <div key={index} className="p-2 transition-colors hover:bg-accent">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 min-w-0">
                                    <Input
                                      type="url"
                                      value={feed.url}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const newFeeds = [...(localConfig.feeds || [])];
                                        newFeeds[index] = {
                                          ...feed,
                                          url: e.target.value,
                                          title: e.target.value
                                        };
                                        setLocalConfig({
                                          ...localConfig,
                                          feeds: newFeeds
                                        });
                                        setIsValidUrl(newFeeds.every(f => validateFeedUrl(f.url)));
                                        // Clear validation error when user edits
                                        if (validationErrors[feed.url]) {
                                          const newErrors = { ...validationErrors };
                                          delete newErrors[feed.url];
                                          setValidationErrors(newErrors);
                                        }
                                      }}
                                      className={`${
                                        !validateFeedUrl(feed.url) || validationErrors[feed.url]
                                          ? 'border-red-500 dark:border-red-500'
                                          : 'border-transparent focus:border-border'
                                      } text-sm bg-transparent shadow-none`}
                                      placeholder="https://example.com/rss"
                                    />
                                    {validationErrors[feed.url] && (
                                      <p className="text-xs text-red-500 mt-1">{validationErrors[feed.url]}</p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newFeeds = [...(localConfig.feeds || [])];
                                      newFeeds.splice(index, 1);
                                      setLocalConfig({
                                        ...localConfig,
                                        feeds: newFeeds
                                      });
                                    }}
                                    className="text-muted-foreground hover:text-red-500 dark:hover:text-red-400 h-8 w-8 p-0 transition-colors"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M18 6L6 18M6 6l12 12"/>
                                    </svg>
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLocalConfig({
                              ...localConfig,
                              feeds: [{ url: '', title: '', enabled: true }, ...(localConfig.feeds || [])]
                            });
                          }}
                          className="flex-1 font-normal"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                            <path d="M12 5v14M5 12h14"/>
                          </svg>
                          Add Feed
                        </Button>
                        <div className="relative">
                          <input
                            type="file"
                            accept=".opml,text/xml"
                            onChange={handleOPMLImport}
                            className="hidden"
                            id="opml-file-input"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('opml-file-input')?.click()}
                            title="Import from OPML"
                            className="font-normal"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Import OPML
                          </Button>
                        </div>
                      </div>
                    </div>
                    {!isValidUrl && (
                      <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12" y2="16"/>
                        </svg>
                        Please enter valid URLs
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Add RSS feed URLs manually or import from an OPML file
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="display">
              <div className="max-h-[min(60vh,500px)] overflow-y-auto py-4">
                <div className="space-y-4 px-1">
                  {/* Display Mode */}
                  <div className="space-y-2">
                    <Label>Display Mode</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        onClick={() => setLocalConfig({...localConfig, displayMode: RSSDisplayMode.LIST})}
                        variant={localConfig.displayMode === RSSDisplayMode.LIST ? "default" : "outline"}
                        size="sm"
                      >
                        List
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setLocalConfig({...localConfig, displayMode: RSSDisplayMode.CARDS})}
                        variant={localConfig.displayMode === RSSDisplayMode.CARDS ? "default" : "outline"}
                        size="sm"
                      >
                        Cards
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setLocalConfig({...localConfig, displayMode: RSSDisplayMode.COMPACT})}
                        variant={localConfig.displayMode === RSSDisplayMode.COMPACT ? "default" : "outline"}
                        size="sm"
                      >
                        Compact
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Display Options</Label>

                    {/* Show Images */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-images-toggle" className="flex-1">Show Images</Label>
                      <Switch
                        id="show-images-toggle"
                        checked={localConfig.showImages}
                        onCheckedChange={(checked: boolean) => setLocalConfig({...localConfig, showImages: checked})}
                      />
                    </div>

                    {/* Show Dates */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-date-toggle" className="flex-1">Show Publication Dates</Label>
                      <Switch
                        id="show-date-toggle"
                        checked={localConfig.showDate}
                        onCheckedChange={(checked: boolean) => setLocalConfig({...localConfig, showDate: checked})}
                      />
                    </div>

                    {/* Show Authors */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-author-toggle" className="flex-1">Show Authors</Label>
                      <Switch
                        id="show-author-toggle"
                        checked={localConfig.showAuthor}
                        onCheckedChange={(checked: boolean) => setLocalConfig({...localConfig, showAuthor: checked})}
                      />
                    </div>

                    {/* Show Descriptions */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-description-toggle" className="flex-1">Show Descriptions</Label>
                      <Switch
                        id="show-description-toggle"
                        checked={localConfig.showDescription}
                        onCheckedChange={(checked: boolean) => setLocalConfig({...localConfig, showDescription: checked})}
                      />
                    </div>

                    {/* Open Links in New Tab */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="open-new-tab-toggle" className="flex-1">Open Links in New Tab</Label>
                      <Switch
                        id="open-new-tab-toggle"
                        checked={localConfig.openInNewTab}
                        onCheckedChange={(checked: boolean) => setLocalConfig({...localConfig, openInNewTab: checked})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="examples">
              <div className="max-h-[min(60vh,500px)] overflow-y-auto py-4">
                <div className="space-y-4 px-1">
                  <div className="text-sm text-muted-foreground">
                    Select from popular RSS feeds to get started:
                  </div>
                  <div className="space-y-2">
                    {/* Example Feed Item: Hacker News */}
                    <div
                      className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setExampleFeed('https://news.ycombinator.com/rss', 'Hacker News')}
                    >
                      <div className="flex-shrink-0 rounded-md bg-muted p-2 text-muted-foreground">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2L2 19.7778H22L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">Hacker News</div>
                        <div className="text-xs text-muted-foreground truncate">Tech news and discussions</div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>

                    {/* Example Feed Item: New York Times */}
                    <div
                      className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setExampleFeed('https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'New York Times')}
                    >
                      <div className="flex-shrink-0 rounded-md bg-muted p-2 text-muted-foreground">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">New York Times</div>
                        <div className="text-xs text-muted-foreground truncate">Breaking news and opinion</div>
                      </div>
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>

                    {/* Example Feed Item: Wired */}
                     <div
                      className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setExampleFeed('https://www.wired.com/feed/rss', 'Wired')}
                    >
                      <div className="flex-shrink-0 rounded-md bg-muted p-2 text-muted-foreground">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 3V21M21 12H3M18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">Wired</div>
                        <div className="text-xs text-muted-foreground truncate">Latest technology news and features</div>
                      </div>
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <div className="flex justify-between w-full">
              {config?.onDelete && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (config.onDelete) {
                      config.onDelete();
                    }
                  }}
                  aria-label="Delete this widget"
                >
                  Delete
                </Button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reset to original config on cancel
                    if (config) {
                      setLocalConfig({
                        ...defaultConfig,
                        ...config,
                        feeds: config?.feeds || defaultConfig.feeds
                      });
                    }
                    setValidationErrors({});
                    setShowSettings(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={() => saveSettings()}
                  disabled={!isValidUrl || isValidating}
                >
                  {isValidating ? (
                    <>
                      <span className="animate-spin mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                      </span>
                      Validating...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Update example feed buttons
  const setExampleFeed = (url: string, title: string) => {
    setLocalConfig({
      ...localConfig,
      feeds: [{ url, title, enabled: true }, ...(localConfig.feeds || [])]
    });
    setIsValidUrl(true);
    setActiveTab('content');
  };

  // Ensure display mode is always defined by using a default value
  const renderFeedItems = (displayMode: RSSDisplayMode = RSSDisplayMode.LIST) => {
    return feedItems.map((item, index) => renderFeedItem(item, index, displayMode));
  };

  const handleOPMLImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');

      // Get all outline elements that have an xmlUrl attribute (these are the feed entries)
      const outlines = xmlDoc.querySelectorAll('outline[xmlUrl]');
      const feeds: RSSFeed[] = Array.from(outlines).map(outline => ({
        url: outline.getAttribute('xmlUrl') || '',
        title: outline.getAttribute('title') || outline.getAttribute('text') || '',
        enabled: true
      }));

      if (feeds.length > 0) {
        setLocalConfig(prevConfig => ({
          ...prevConfig,
          feeds: [...feeds, ...(prevConfig.feeds || [])] // Add new feeds at the beginning
        }));
        setIsValidUrl(true);
        setActiveTab('content');
      } else {
        setError('No valid RSS feeds found in the OPML file');
      }
    };

    reader.onerror = () => {
      setError('Failed to read OPML file');
    };

    reader.readAsText(file);

    // Reset the file input
    event.target.value = '';
  };

  // Main render
  return (
    <div
      ref={widgetRef}
      className={`widget-container h-full flex flex-col relative ${isTiny ? 'widget-drag-handle' : ''}`}
    >
      {!isTiny && !isApp && (
        <WidgetHeader
          title={localConfig.title || 'RSS Feed'}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      <div className={`flex-1 overflow-hidden ${isTiny ? 'p-1' : isApp ? '' : ''}`}>
        {renderContent()}
      </div>

      {/* Settings dialog */}
      {renderSettings()}
    </div>
  );
};

export default RSSWidget;
