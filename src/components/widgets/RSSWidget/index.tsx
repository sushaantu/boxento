import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { useVisibilityRefresh } from '../../../lib/useVisibilityRefresh';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Button,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import { RSSWidgetConfig, RSSFeedItem, RSSDisplayMode, RSSFeed } from './types';
import type { RSSWidgetProps } from './types';
import sanitizeHtml from 'sanitize-html';
import { Rss, AlertCircle, Upload } from 'lucide-react';

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
 * This widget allows users to view RSS feeds directly on their dashboard.
 * 
 * @param {RSSWidgetProps} props - Component props
 * @returns {React.ReactElement} Widget component
 */
export const RSSWidget: React.FC<RSSWidgetProps> = ({ config, width, height }) => {
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
  }), []); // Empty dependency array since these values never change

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

  // Refs for the widget container
  const widgetRef = useRef<HTMLDivElement | null>(null);
  

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
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {item.feedTitle}
          </div>
        )}
        
        {(showDate || showAuthor) && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {showDate && item.pubDate && <span>{formatDate(item.pubDate)}</span>}
            {showDate && showAuthor && item.pubDate && item.author && <span> · </span>}
            {showAuthor && item.author && <span>{item.author}</span>}
          </div>
        )}
        
        {showDescription && item.description && (
          <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 line-clamp-3">
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
            <div className="mr-2 text-gray-400 dark:text-gray-500">•</div>
            <div className="flex-grow min-w-0">
              {commonContent}
            </div>
          </div>
        );
        
      case RSSDisplayMode.LIST:
      default:
        return (
          <div key={`${item.link}-${index}`} className="py-3 flex border-b border-gray-200 dark:border-gray-700 last:border-0">
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
        <Rss size={24} className="text-gray-400 mb-3" strokeWidth={1.5} />
        {/* Consistent text styling */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          No RSS feed configured.
        </p>
        {/* Consistent button styling */}
        <Button
          size="sm"
          onClick={() => setShowSettings(true)} 
          variant="outline"
        >
          Configure Widget
        </Button>
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
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowSettings(true)}
        >
          Settings
        </Button>
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
   * Render feed content
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
   * Render content based on widget size
   */
  const renderContent = () => {
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
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
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
            
            <TabsContent value="content" className="space-y-4 py-4">
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
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Leave empty to use the feed's title
                </p>
              </div>
              
              {/* Feed URL */}
              <div className="space-y-2">
                <Label>RSS Feeds</Label>
                <div className="space-y-3">
                  <div className="max-h-[300px] overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 shadow-inner">
                    {localConfig.feeds?.length === 0 ? (
                      <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        <Rss className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No feeds added yet</p>
                        <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">Add feeds manually or import from OPML</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {localConfig.feeds?.map((feed, index) => (
                          <div key={index} className="p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900">
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
                                      : 'border-transparent focus:border-gray-300 dark:focus:border-gray-600'
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
                                className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 h-8 w-8 p-0 transition-colors"
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
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Add RSS feed URLs manually or import from an OPML file
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="display" className="space-y-4 py-4">
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
            </TabsContent>
            
            <TabsContent value="examples" className="space-y-4 py-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Select from popular RSS feeds to get started:
              </div>
              <div className="space-y-2">
                {/* Example Feed Item: Hacker News */}
                <div
                  className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setExampleFeed('https://news.ycombinator.com/rss', 'Hacker News')}
                >
                  <div className="flex-shrink-0 rounded-md bg-orange-100 dark:bg-orange-900/20 p-2 text-orange-600 dark:text-orange-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 19.7778H22L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">Hacker News</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">Tech news and discussions</div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="text-gray-400 dark:text-gray-500"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>

                {/* Example Feed Item: New York Times */}
                <div
                  className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setExampleFeed('https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'New York Times')}
                >
                  <div className="flex-shrink-0 rounded-md bg-gray-100 dark:bg-gray-900/40 p-2 text-gray-600 dark:text-gray-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">New York Times</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">Breaking news and opinion</div>
                  </div>
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="text-gray-400 dark:text-gray-500"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>

                {/* Example Feed Item: Wired */}
                 <div
                  className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setExampleFeed('https://www.wired.com/feed/rss', 'Wired')}
                >
                  <div className="flex-shrink-0 rounded-md bg-purple-100 dark:bg-purple-900/20 p-2 text-purple-600 dark:text-purple-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 3V21M21 12H3M18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">Wired</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">Latest technology news and features</div>
                  </div>
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="text-gray-400 dark:text-gray-500"><polyline points="9 18 15 12 9 6"></polyline></svg>
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
                >
                  Delete
                </Button>
              )}
              
              <Button
                variant="default"
                onClick={() => saveSettings()}
                disabled={!isValidUrl || isValidating}
              >
                {isValidating ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Validating...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
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
    <div ref={widgetRef} className="widget-container h-full flex flex-col relative">
      <WidgetHeader 
        title={localConfig.title || 'RSS Feed'} 
        onSettingsClick={() => setShowSettings(true)}
      />
      
      <div className="flex-grow overflow-hidden">
        {renderContent()}
      </div>
      
      {/* Settings dialog */}
      {renderSettings()}
    </div>
  );
};

export default RSSWidget; 