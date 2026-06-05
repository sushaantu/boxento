import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useVisibilityRefresh } from '../../../lib/useVisibilityRefresh';
import { WidgetSettingsDialog, WidgetSettingsDialogFooter } from '../common/WidgetSettingsDialog';
import { WidgetShell } from '../common/WidgetShell';
import { RSSWidgetConfig, RSSFeedItem, RSSDisplayMode, RSSFeed } from './types';
import type { RSSWidgetProps } from './types';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Switch } from '../../ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs';
import sanitizeHtml from 'sanitize-html';
import { Rss, AlertCircle, Upload, ChevronDown, Settings2 } from 'lucide-react';
import { Skeleton } from '../../ui/skeleton';
import {
  getInlineReaderContent,
  sanitizeReaderHtml,
  shouldExtractReaderContent,
  type RSSArticleExtractionResponse,
  type RSSExtractedArticle,
} from './reader';
import { RSSReaderDetailPane, type RSSReaderContentState } from './RSSReaderDetailPane';

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

const getProxyErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as { message?: string; error?: string };
    return payload.message || payload.error || response.statusText || `HTTP ${response.status}`;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
};

const getXmlText = (item: Element, selector: string): string => (
  item.querySelector(selector)?.textContent?.trim() || ''
);

const getAtomLink = (entry: Element): string => (
  entry.querySelector('link[rel="alternate"]')?.getAttribute('href') ||
  entry.querySelector('link[href]')?.getAttribute('href') ||
  getXmlText(entry, 'link') ||
  '#'
);

const extractImageFromItem = (item: Element): string => {
  const mediaContent = item.querySelector('media\\:content, media\\:thumbnail, content, thumbnail');
  const enclosure = item.querySelector('enclosure[type^="image"]');
  const content = getXmlText(item, 'content\\:encoded, encoded, content, summary, description');

  if (mediaContent && mediaContent.getAttribute('url')) {
    return mediaContent.getAttribute('url') || '';
  }
  if (enclosure && enclosure.getAttribute('url')) {
    return enclosure.getAttribute('url') || '';
  }

  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : '';
};

const parseFeedItems = (xmlDoc: Document): RSSFeedItem[] => {
  if (xmlDoc.querySelector('parsererror')) {
    throw new Error('The feed returned invalid XML');
  }

  const rssItems = Array.from(xmlDoc.querySelectorAll('item')).map(item => ({
    title: getXmlText(item, 'title') || 'No Title',
    link: getXmlText(item, 'link') || '#',
    description: getXmlText(item, 'description'),
    content: getXmlText(item, 'content\\:encoded, encoded'),
    pubDate: getXmlText(item, 'pubDate'),
    author: getXmlText(item, 'author, dc\\:creator'),
    image: extractImageFromItem(item),
    commentsLink: getXmlText(item, 'comments')
  }));

  if (rssItems.length > 0) {
    return rssItems;
  }

  const atomItems = Array.from(xmlDoc.querySelectorAll('entry')).map(entry => ({
    title: getXmlText(entry, 'title') || 'No Title',
    link: getAtomLink(entry),
    description: getXmlText(entry, 'summary'),
    content: getXmlText(entry, 'content'),
    pubDate: getXmlText(entry, 'published, updated'),
    author: getXmlText(entry, 'author name, author, dc\\:creator'),
    image: extractImageFromItem(entry),
    commentsLink: ''
  }));

  if (atomItems.length > 0) {
    return atomItems;
  }

  throw new Error('The feed did not include any readable articles');
};

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
  const [readerContentByLink, setReaderContentByLink] = useState<Record<string, RSSReaderContentState>>({});

  // Refs for the widget container
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const readerContentByLinkRef = useRef<Record<string, RSSReaderContentState>>({});

  const fetchSingleFeed = React.useCallback(async (feed: RSSFeed): Promise<RSSFeedItem[]> => {
    // Use our own CORS proxy (server-side) instead of third-party allorigins.win
    const response = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);

    if (!response.ok) {
      throw new Error(await getProxyErrorMessage(response));
    }

    const data = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data, 'text/xml');

    return parseFeedItems(xmlDoc);
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
        const failedFeedLabel = failedFeeds.length === 1
          ? failedFeeds[0]
          : `${failedFeeds.length} configured feeds`;
        setError(`Could not load ${failedFeedLabel}.`);
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

      startTransition(() => {
        setFeedItems(sortedItems.slice(0, currentConfig.maxItems || sortedItems.length));
      });
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

  useEffect(() => {
    readerContentByLinkRef.current = readerContentByLink;
  }, [readerContentByLink]);

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

  useEffect(() => {
    if (!isApp) return;

    if (filteredFeedItems.length === 0) {
      if (selectedArticleIndex !== null) {
        setSelectedArticleIndex(null);
      }
      return;
    }

    if (selectedArticleIndex === null || selectedArticleIndex >= filteredFeedItems.length) {
      setSelectedArticleIndex(0);
    }
  }, [filteredFeedItems.length, isApp, selectedArticleIndex]);

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

  const selectedArticle = useMemo(
    () => (selectedArticleIndex !== null ? filteredFeedItems[selectedArticleIndex] ?? null : null),
    [filteredFeedItems, selectedArticleIndex]
  );

  const selectedInlineReaderContent = useMemo(
    () => (selectedArticle ? getInlineReaderContent(selectedArticle) : null),
    [selectedArticle]
  );

  const selectedReaderContentState = selectedArticle?.link ? readerContentByLink[selectedArticle.link] : undefined;

  const selectedSanitizedReaderHtml = useMemo(() => {
    if (selectedInlineReaderContent) {
      return sanitizeReaderHtml(selectedInlineReaderContent.html);
    }

    if (selectedReaderContentState?.status === 'ready') {
      return sanitizeReaderHtml(selectedReaderContentState.article.content);
    }

    return '';
  }, [selectedInlineReaderContent, selectedReaderContentState]);

  const selectedArticleLink = selectedArticle?.link || '';
  const selectedArticleContent = selectedArticle?.content || '';
  const selectedArticleDescription = selectedArticle?.description || '';
  const selectedArticleNeedsReaderExtraction = Boolean(selectedArticleLink) && shouldExtractReaderContent({
    link: selectedArticleLink,
    content: selectedArticleContent,
    description: selectedArticleDescription,
  });

  useEffect(() => {
    if (!isApp || !selectedArticleLink || !selectedArticleNeedsReaderExtraction) {
      return;
    }

    if (readerContentByLinkRef.current[selectedArticleLink]) {
      return;
    }

    const controller = new AbortController();

    startTransition(() => {
      setReaderContentByLink((current) => ({
        ...current,
        [selectedArticleLink]: { status: 'loading' },
      }));
    });

    void (async () => {
      try {
        const response = await fetch(`/api/rss?articleUrl=${encodeURIComponent(selectedArticleLink)}`, {
          signal: controller.signal,
        });
        const payload = await response.json() as RSSArticleExtractionResponse;

        if (controller.signal.aborted) {
          return;
        }

        if (response.ok && payload.ok && payload.article?.content) {
          startTransition(() => {
            setReaderContentByLink((current) => ({
              ...current,
              [selectedArticleLink]: {
                status: 'ready',
                article: payload.article as RSSExtractedArticle,
              },
            }));
          });
          return;
        }

        startTransition(() => {
            setReaderContentByLink((current) => ({
              ...current,
              [selectedArticleLink]: {
                status: 'unavailable',
                reason: payload.reason || 'This feed links to the original article, but Boxento could not extract readable content for it.',
              },
          }));
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error('Error fetching reader content:', error);

        startTransition(() => {
            setReaderContentByLink((current) => ({
              ...current,
              [selectedArticleLink]: {
                status: 'unavailable',
                reason: 'This feed links to the original article. Boxento could not load reader mode right now.',
              },
          }));
        });
      }
    })();

    return () => controller.abort();
  }, [
    isApp,
    selectedArticleLink,
    selectedArticleContent,
    selectedArticleDescription,
    selectedArticleNeedsReaderExtraction,
  ]);

  // -------------------------------------------------------
  // 1x1 TINY VIEW: Article count icon
  // -------------------------------------------------------
  const renderTinyView = () => {
    const count = feedItems.length;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
        {error && !isLoading ? (
          <AlertCircle size={18} className="text-destructive" strokeWidth={1.5} />
        ) : (
          <Rss size={18} className="text-muted-foreground" strokeWidth={1.5} />
        )}
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

    if (error && !isLoading) {
      return (
        <div className="flex h-full items-center gap-2 px-2">
          <AlertCircle size={14} className="shrink-0 text-destructive" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            RSS feeds unavailable
          </span>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleRetryClick}>
            Retry
          </Button>
        </div>
      );
    }

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
    const needsReaderExtraction = selectedArticle ? shouldExtractReaderContent(selectedArticle) : false;
    const extractedArticle = selectedReaderContentState?.status === 'ready'
      ? selectedReaderContentState.article
      : null;
    const readerByline = selectedArticle?.author || extractedArticle?.byline || '';
    const readerImage = selectedArticle?.image || extractedArticle?.image || '';
    const readerSourceLabel = selectedInlineReaderContent
      ? selectedInlineReaderContent.source === 'content'
        ? 'Full article from feed'
        : 'Feed summary from feed'
      : extractedArticle
        ? 'Reader mode extracted from original article'
        : needsReaderExtraction
          ? 'Link-only feed'
          : '';

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
      <div className="flex h-full min-h-0 flex-col bg-background">
        {/* Top bar */}
        <div className="widget-drag-handle flex shrink-0 cursor-move items-center justify-between gap-3 bg-muted/30 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Rss size={16} className="shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-semibold text-foreground">
              {localConfig.title || 'RSS Reader'}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Feed filter dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground"
                >
                  <span className="max-w-[140px] truncate">
                    {appFeedFilter === 'all' ? 'All Feeds' : appFeedFilter}
                  </span>
                  <ChevronDown size={12} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuRadioGroup
                  value={appFeedFilter}
                  onValueChange={(value) => {
                    setAppFeedFilter(value);
                    setSelectedArticleIndex(null);
                  }}
                >
                  <DropdownMenuGroup>
                    <DropdownMenuRadioItem value="all" className="text-xs">
                      <span className="truncate">All Feeds</span>
                    </DropdownMenuRadioItem>
                    {uniqueFeedTitles.map(title => (
                      <DropdownMenuRadioItem key={title} value={title} className="text-xs">
                        <span className="truncate">{title}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Article count */}
            <span className="hidden text-xs text-muted-foreground sm:inline">
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
                <Settings2 size={14} className="text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left sidebar: Article list */}
          <div className="min-w-[240px] max-w-[360px] basis-[36%] overflow-y-auto border-r border-border bg-muted/15">
            {filteredFeedItems.map((item, index) => (
              <Button
                key={`${item.link}-${index}`}
                type="button"
                variant="ghost"
                onClick={() => setSelectedArticleIndex(index)}
                className={`h-auto w-full justify-start rounded-none border-b border-border px-3 py-3 text-left transition-colors ${
                  selectedArticleIndex === index
                    ? 'border-l-2 border-l-primary bg-accent'
                    : 'border-l-2 border-l-transparent hover:bg-accent/70'
                }`}
              >
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                    {item.title}
                  </div>
                  <div className="mt-1.5 flex min-w-0 items-center gap-2">
                    {item.feedTitle && (
                      <span className="min-w-0 max-w-[70%] truncate text-[11px] font-medium text-muted-foreground">
                        {item.feedTitle}
                      </span>
                    )}
                    {item.pubDate && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatTimeAgo(item.pubDate)}
                      </span>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>

          {/* Right pane: Article reader */}
          <div className="min-w-0 flex-1 overflow-y-auto">
            <RSSReaderDetailPane
              article={selectedArticle}
              articleCount={filteredFeedItems.length}
              formattedDate={selectedArticle?.pubDate ? formatDate(selectedArticle.pubDate) : ''}
              readerByline={readerByline}
              readerImage={readerImage}
              readerSourceLabel={readerSourceLabel}
              extractedArticle={extractedArticle}
              inlineReaderContent={selectedInlineReaderContent}
              readerState={selectedReaderContentState}
              sanitizedReaderHtml={selectedSanitizedReaderHtml}
            />
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
          className="text-sm font-medium leading-snug text-foreground underline-offset-4 hover:underline"
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
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
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
                  className="media-outline w-full h-full object-cover"
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
          <div key={`${item.link}-${index}`} className="flex border-b border-border py-2 last:border-0">
            <div className="mr-2 mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            <div className="min-w-0 flex-grow">
              {commonContent}
            </div>
          </div>
        );

      case RSSDisplayMode.LIST:
      default:
        return (
          <div key={`${item.link}-${index}`} className="flex border-b border-border py-3 last:border-0">
            {showImages && item.image && (
              <div className="mr-3 h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                <img
                  src={item.image}
                  alt={item.title}
                  className="media-outline w-full h-full object-cover"
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
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <AlertCircle size={24} className="mb-3 text-destructive" strokeWidth={1.5} />
        <p className="mb-3 text-sm text-destructive">
          {error}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            onClick={handleRetryClick}
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
        return { valid: false, error: await getProxyErrorMessage(response) };
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

  const resetSettingsDraft = () => {
    if (config) {
      setLocalConfig({
        ...defaultConfig,
        ...config,
        feeds: config?.feeds || defaultConfig.feeds
      });
    }
    setValidationErrors({});
    setShowSettings(false);
  };

  /**
   * Settings dialog
   */
  const renderSettings = () => {
    return (
      <WidgetSettingsDialog
        open={showSettings}
        onOpenChange={(open: boolean) => {
          if (!open) {
            resetSettingsDraft();
            return;
          }
          setShowSettings(true);
        }}
        title="RSS Feed Settings"
        contentClassName="sm:max-w-2xl"
        bodyClassName="px-1 py-1.5"
        footer={(
          <WidgetSettingsDialogFooter
            onDelete={config?.onDelete ? () => config.onDelete?.() : undefined}
            onCancel={resetSettingsDraft}
            onSave={() => {
              void saveSettings();
            }}
            saveDisabled={!isValidUrl || isValidating}
            savePending={isValidating}
            savePendingLabel="Validating..."
          />
        )}
      >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="display">Display</TabsTrigger>
              <TabsTrigger value="examples">Examples</TabsTrigger>
            </TabsList>

            <TabsContent value="content">
              <div className="py-4">
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
              <div className="py-4">
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
              <div className="py-4">
                <div className="space-y-4 px-1">
                  <div className="text-sm text-muted-foreground">
                    Select from feeds that demonstrate both inline full-text reading and link-only reader extraction:
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
                        <div className="text-xs text-muted-foreground truncate">Link-only stories with reader extraction fallback</div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>

                    {/* Example Feed Item: Cloudflare Blog */}
                    <div
                      className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setExampleFeed('https://blog.cloudflare.com/rss/', 'Cloudflare Blog')}
                    >
                      <div className="flex-shrink-0 rounded-md bg-muted p-2 text-muted-foreground">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 15.5C5.17157 15.5 4.5 14.8284 4.5 14C4.5 13.1716 5.17157 12.5 6 12.5C6.23652 12.5 6.46026 12.5553 6.65901 12.6537C7.10891 11.0206 8.60564 9.83333 10.375 9.83333C12.4971 9.83333 14.2164 11.5526 14.2164 13.6747C14.2164 13.7383 14.2147 13.8016 14.2114 13.8644C14.6023 13.625 15.0619 13.4872 15.5536 13.4872C16.9582 13.4872 18.0969 14.6259 18.0969 16.0306C18.0969 17.4352 16.9582 18.5739 15.5536 18.5739H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">Cloudflare Blog</div>
                        <div className="text-xs text-muted-foreground truncate">Full-text engineering, security, and product posts</div>
                      </div>
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>

                    {/* Example Feed Item: Krebs on Security */}
                    <div
                      className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setExampleFeed('https://krebsonsecurity.com/feed/', 'Krebs on Security')}
                    >
                      <div className="flex-shrink-0 rounded-md bg-muted p-2 text-muted-foreground">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 3L5 6V11C5 15.55 8 19.74 12 21C16 19.74 19 15.55 19 11V6L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">Krebs on Security</div>
                        <div className="text-xs text-muted-foreground truncate">Full-text security reporting and long-form investigations</div>
                      </div>
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
      </WidgetSettingsDialog>
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
    <WidgetShell
      ref={widgetRef}
      title={localConfig.title || 'RSS Feed'}
      isTiny={isTiny}
      hideHeader={isApp}
      compactHeader={isShort || isCompact}
      onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
      contentClassName={isTiny ? 'p-1' : isApp ? '' : ''}
    >
      {renderContent()}

      {/* Settings dialog */}
      {renderSettings()}
    </WidgetShell>
  );
};

export default RSSWidget;
