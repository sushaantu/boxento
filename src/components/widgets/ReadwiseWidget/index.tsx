import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVisibilityRefresh } from '../../../lib/useVisibilityRefresh';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import { RefreshCw, Quote, AlertCircle, BookOpen, Book } from 'lucide-react';
import { ReadwiseHighlight, ReadwiseWidgetConfig, ReadwiseWidgetProps } from './types';

// Widget size categories, same as template widget
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
 * Readwise Widget Component
 * 
 * Displays random highlights from your Readwise account
 * 
 * @param {ReadwiseWidgetProps} props - Component props
 * @returns {JSX.Element} Widget component
 */
const ReadwiseWidget: React.FC<ReadwiseWidgetProps> = ({ width, height, config }) => {
  // Default configuration
  const defaultConfig: ReadwiseWidgetConfig = {
    title: 'Readwise Highlights',
    apiToken: '',
    refreshInterval: 30, // 30 minutes
    showBookInfo: true,
    showTags: true
  };

  // Component state
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<ReadwiseWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  
  const [highlight, setHighlight] = useState<ReadwiseHighlight | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref for the widget container
  const widgetRef = useRef<HTMLDivElement | null>(null);
  
  // Update local config when props config changes
  useEffect(() => {
    setLocalConfig(prevConfig => ({
      ...prevConfig,
      ...config
    }));
  }, [config]);

  /**
   * Fetches a random highlight from Readwise API
   */
  const fetchRandomHighlight = useCallback(async () => {
    if (!localConfig.apiToken) {
      setError('API token is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get a random page number (1-10) to increase variety
      const randomPage = Math.floor(Math.random() * 10) + 1;

      const response = await fetch(`https://readwise.io/api/v2/highlights/?page=${randomPage}&page_size=100`, {
        headers: {
          'Authorization': `Token ${localConfig.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        // Select a random highlight from the results
        const randomIndex = Math.floor(Math.random() * data.results.length);
        const randomHighlight = data.results[randomIndex];

        // Get book info if available and showBookInfo is enabled
        if (localConfig.showBookInfo && randomHighlight.book_id) {
          try {
            const bookResponse = await fetch(`https://readwise.io/api/v2/books/${randomHighlight.book_id}/`, {
              headers: {
                'Authorization': `Token ${localConfig.apiToken}`,
                'Content-Type': 'application/json'
              }
            });

            if (bookResponse.ok) {
              const bookData = await bookResponse.json();
              randomHighlight.book_title = bookData.title;
              randomHighlight.book_author = bookData.author;
            }
          } catch (bookError) {
            console.error('Error fetching book info:', bookError);
          }
        }

        setHighlight(randomHighlight);
      } else {
        setError('No highlights found');
      }
    } catch (error) {
      console.error('Error fetching highlight:', error);
      setError('Failed to fetch highlight');
    } finally {
      setIsLoading(false);
    }
  }, [localConfig.apiToken, localConfig.showBookInfo]);

  // Get a random highlight when component mounts
  useEffect(() => {
    if (localConfig.apiToken) {
      fetchRandomHighlight();
    }
  }, [localConfig.apiToken, fetchRandomHighlight]);

  // Auto-refresh when tab becomes visible or at the configured interval
  useVisibilityRefresh({
    onRefresh: fetchRandomHighlight,
    minHiddenTime: 60000, // Refresh if hidden for 1+ minute
    refreshInterval: localConfig.refreshInterval && localConfig.refreshInterval > 0
      ? localConfig.refreshInterval * 60 * 1000
      : 0,
    enabled: !!localConfig.apiToken
  });
  
  /**
   * Determines the appropriate size category based on width and height
   * 
   * @param width - Widget width in grid units
   * @param height - Widget height in grid units
   * @returns The corresponding WidgetSizeCategory
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
  
  // Render content based on widget size
  const renderContent = () => {
    const sizeCategory = getWidgetSizeCategory(width, height);
    
    if (isLoading) {
      return renderLoadingState();
    }
    
    if (error) {
      return renderErrorState();
    }
    
    if (!localConfig.apiToken) {
      return renderNoApiTokenState();
    }
    
    if (!highlight) {
      return renderEmptyState();
    }
    
    switch (sizeCategory) {
      case WidgetSizeCategory.LARGE:
        return renderLargeView();
      case WidgetSizeCategory.WIDE_MEDIUM:
        return renderWideMediumView();
      case WidgetSizeCategory.TALL_MEDIUM:
        return renderTallMediumView();
      case WidgetSizeCategory.MEDIUM:
        return renderMediumView();
      case WidgetSizeCategory.WIDE_SMALL:
        return renderWideSmallView();
      case WidgetSizeCategory.TALL_SMALL:
        return renderTallSmallView();
      case WidgetSizeCategory.SMALL:
      default:
        return renderSmallView();
    }
  };
  
  /**
   * Loading state
   */
  const renderLoadingState = () => {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin mr-3 text-gray-400">
          <RefreshCw size={24} />
        </div>
        <span className="text-lg font-serif text-gray-500">Loading...</span>
      </div>
    );
  };
  
  /**
   * Error state
   */
  const renderErrorState = () => {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        {/* Use AlertCircle icon for errors */}
        <AlertCircle size={40} className="text-red-500 mb-3" strokeWidth={1.5} />
        {/* Consistent error text styling */}
        <p className="text-sm text-red-500 dark:text-red-400 mb-3">
          {error}
        </p>
        {/* Consistent button styling */}
        <Button
          size="sm"
          onClick={fetchRandomHighlight}
        >
          Try Again
        </Button>
      </div>
    );
  };
  
  /**
   * No API token state
 */
const renderNoApiTokenState = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      {/* Use BookOpen icon from Lucide with consistent styling */}
      <BookOpen size={24} className="text-gray-400 mb-3" strokeWidth={1.5} />
      {/* Consistent text styling */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Please add your Readwise API token.
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
   * Empty state
   */
  const renderEmptyState = () => {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center mb-3 font-serif text-lg">No highlights found</div>
        <button 
          onClick={fetchRandomHighlight}
          className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm"
        >
          Refresh
        </button>
      </div>
    );
  };
  
  /**
   * Opens the highlight in Readwise
   */
  const openHighlightInReadwise = () => {
    if (highlight?.id) {
      window.open(`https://readwise.io/open/${highlight.id}`, '_blank', 'noopener,noreferrer');
    }
  };

  /**
   * Small View (2x2) - Just the highlight text
   *
   * @returns {JSX.Element} Small view content
   */
  const renderSmallView = () => {
    return (
      <div className="h-full overflow-y-auto">
        <div
          className="text-sm font-serif italic text-gray-800 dark:text-gray-200 leading-snug cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          onClick={openHighlightInReadwise}
          title="Open in Readwise"
        >
          "{highlight?.text}"
        </div>
      </div>
    );
  };
  
  /**
   * Wide Small View (3x2) - Highlight with minimal book info
   *
   * @returns {JSX.Element} Wide small view content
   */
  const renderWideSmallView = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-grow overflow-y-auto min-h-0">
          <div
            className="text-base font-serif italic text-gray-800 dark:text-gray-200 leading-snug cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={openHighlightInReadwise}
            title="Open in Readwise"
          >
            "{highlight?.text}"
          </div>
        </div>

        {localConfig.showBookInfo && highlight?.book_title && (
          <div className="text-xs text-gray-500 mt-2 flex items-center flex-shrink-0">
            <BookOpen size={12} className="mr-1" />
            <span className="truncate">{highlight.book_title}</span>
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Tall Small View (2x3) - Highlight with book title and author
   *
   * @returns {JSX.Element} Tall small view content
   */
  const renderTallSmallView = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-grow overflow-y-auto min-h-0">
          <div
            className="text-base font-serif italic text-gray-800 dark:text-gray-200 leading-snug cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={openHighlightInReadwise}
            title="Open in Readwise"
          >
            "{highlight?.text}"
          </div>
        </div>

        {localConfig.showBookInfo && (
          <div className="mt-2 flex-shrink-0">
            {highlight?.book_title && (
              <div className="text-xs text-gray-500 flex items-center">
                <BookOpen size={12} className="mr-1" />
                <span className="truncate">{highlight.book_title}</span>
              </div>
            )}
            {highlight?.book_author && (
              <div className="text-xs text-gray-500">
                by {highlight.book_author}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Medium View (3x3) - Full highlight with book info and tags
   *
   * @returns {JSX.Element} Medium view content
   */
  const renderMediumView = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-grow overflow-y-auto min-h-0">
          <div
            className="text-xl font-serif italic text-gray-800 dark:text-gray-200 leading-relaxed mb-4 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={openHighlightInReadwise}
            title="Open in Readwise"
          >
            "{highlight?.text}"
          </div>

          {highlight?.note && (
            <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Note: {highlight.note}
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {localConfig.showBookInfo && (
            <div className="mb-2">
              {highlight?.book_title && (
                <div className="text-sm text-gray-500 flex items-center">
                  <BookOpen size={12} className="mr-1" />
                  <span className="truncate font-medium">{highlight.book_title}</span>
                </div>
              )}
              {highlight?.book_author && (
                <div className="text-xs text-gray-500">
                  by {highlight.book_author}
                </div>
              )}
            </div>
          )}

          {localConfig.showTags && highlight?.tags && highlight.tags.length > 0 && (
            <div className="flex flex-wrap">
              {highlight.tags.map(tag => (
                <span key={tag.id} className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded mr-1 mb-1">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  /**
   * Wide Medium View (4x3) - Everything from medium plus refresh button
   *
   * @returns {JSX.Element} Wide medium view content
   */
  const renderWideMediumView = () => {
    return (
      <div className="grid grid-cols-4 h-full">
        <div className="col-span-3 flex flex-col pr-3">
          <div className="flex-grow overflow-y-auto min-h-0">
            <div
              className="text-xl font-serif italic text-gray-800 dark:text-gray-200 leading-relaxed mb-4 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              onClick={openHighlightInReadwise}
              title="Open in Readwise"
            >
              "{highlight?.text}"
            </div>

            {highlight?.note && (
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                Note: {highlight.note}
              </div>
            )}
          </div>

          <div className="flex-shrink-0">
            {localConfig.showBookInfo && (
              <div className="mb-2">
                {highlight?.book_title && (
                  <div className="text-sm text-gray-500 flex items-center">
                    <Book size={12} className="mr-1" />
                    <span className="truncate font-medium">{highlight.book_title}</span>
                  </div>
                )}
                {highlight?.book_author && (
                  <div className="text-xs text-gray-500">
                    by {highlight.book_author}
                  </div>
                )}
              </div>
            )}

            {localConfig.showTags && highlight?.tags && highlight.tags.length > 0 && (
              <div className="flex flex-wrap">
                {highlight.tags.map(tag => (
                  <span key={tag.id} className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded mr-1 mb-1">
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-1 flex flex-col items-center justify-center border-l border-gray-200 dark:border-gray-700 pl-3">
          <button
            onClick={fetchRandomHighlight}
            className="flex items-center justify-center w-10 h-10 bg-blue-500 text-white rounded-full mb-2"
            aria-label="Refresh highlight"
          >
            <RefreshCw size={16} />
          </button>
          <span className="text-xs text-gray-500 text-center">New Highlight</span>

          <div className="flex items-center justify-center mt-6">
            <Quote size={40} className="text-gray-300 dark:text-gray-600" />
          </div>
        </div>
      </div>
    );
  };
  
  /**
   * Tall Medium View (3x4) - Similar to medium view but with larger quote display
   *
   * @returns {JSX.Element} Tall medium view content
   */
  const renderTallMediumView = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-grow overflow-y-auto min-h-0">
          <div
            className="text-2xl font-serif italic text-gray-800 dark:text-gray-200 leading-relaxed mb-4 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={openHighlightInReadwise}
            title="Open in Readwise"
          >
            "{highlight?.text}"
          </div>

          {highlight?.note && (
            <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Note: {highlight.note}
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {localConfig.showBookInfo && (
            <div className="mb-2">
              {highlight?.book_title && (
                <div className="text-sm text-gray-500 flex items-center">
                  <BookOpen size={14} className="mr-1" />
                  <span className="truncate font-medium">{highlight.book_title}</span>
                </div>
              )}
              {highlight?.book_author && (
                <div className="text-xs text-gray-500">
                  by {highlight.book_author}
                </div>
              )}
            </div>
          )}

          {localConfig.showTags && highlight?.tags && highlight.tags.length > 0 && (
            <div className="flex flex-wrap mb-2">
              {highlight.tags.map(tag => (
                <span key={tag.id} className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded mr-1 mb-1">
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={fetchRandomHighlight}
              className="flex items-center justify-center px-3 py-1 bg-blue-500 text-white rounded text-sm"
            >
              <RefreshCw size={14} className="mr-1" />
              New Highlight
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  /**
   * Large View (4x4) - Full featured view with all highlight details
   *
   * @returns {JSX.Element} Large view content
   */
  const renderLargeView = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="mb-4 flex-grow overflow-auto">
          <div
            className="text-2xl font-serif italic text-gray-800 dark:text-gray-200 leading-relaxed mb-4 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={openHighlightInReadwise}
            title="Open in Readwise"
          >
            "{highlight?.text}"
          </div>

          {highlight?.note && (
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="font-medium mb-1">Note:</div>
              {highlight.note}
            </div>
          )}
        </div>
        
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          {localConfig.showBookInfo && (
            <div className="mb-3">
              {highlight?.book_title && (
                <div className="text-base flex items-center">
                  <BookOpen size={16} className="mr-2 text-blue-500" />
                  <span className="font-medium">{highlight.book_title}</span>
                </div>
              )}
              {highlight?.book_author && (
                <div className="text-sm text-gray-500 ml-6 mt-1">
                  by {highlight.book_author}
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <div>
              {localConfig.showTags && highlight?.tags && highlight.tags.length > 0 && (
                <div className="flex flex-wrap">
                  {highlight.tags.map(tag => (
                    <span key={tag.id} className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded mr-1 mb-1">
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={fetchRandomHighlight}
              className="flex items-center justify-center px-3 py-1 bg-blue-500 text-white rounded text-sm ml-2"
            >
              <RefreshCw size={14} className="mr-1" />
              New Highlight
            </button>
          </div>
          
          {highlight?.highlighted_at && (
            <div className="text-xs text-gray-500 mt-2">
              Highlighted: {new Date(highlight.highlighted_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Save settings
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
    
    // Fetch a new highlight if token changed
    fetchRandomHighlight();
  };
  
  // Settings dialog
  const renderSettings = () => {
    return (
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Readwise Widget Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Title setting */}
            <div className="space-y-2">
              <Label htmlFor="title-input">Widget Title</Label>
              <Input
                id="title-input"
                type="text"
                value={localConfig.title || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setLocalConfig({...localConfig, title: e.target.value})
                }
              />
            </div>
            
            {/* API Token */}
            <div className="space-y-2">
              <Label htmlFor="api-token-input">Readwise API Token</Label>
              <Input
                id="api-token-input"
                type="password"
                value={localConfig.apiToken || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setLocalConfig({...localConfig, apiToken: e.target.value})
                }
              />
              <p className="text-xs text-gray-500">
                Get your token at <a href="https://readwise.io/access_token" target="_blank" rel="noopener noreferrer" className="text-blue-500">readwise.io/access_token</a>
              </p>
            </div>
            
            {/* Refresh interval */}
            <div className="space-y-2">
              <Label htmlFor="refresh-interval-input">Refresh Interval (minutes)</Label>
              <Input
                id="refresh-interval-input"
                type="number"
                min="0"
                value={localConfig.refreshInterval || 0}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setLocalConfig({...localConfig, refreshInterval: parseInt(e.target.value) || 0})
                }
              />
              <p className="text-xs text-gray-500">
                Set to 0 to disable automatic refresh
              </p>
            </div>
            
            {/* Show book info toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="show-book-info-toggle"
                checked={localConfig.showBookInfo || false}
                onCheckedChange={(checked: boolean) => 
                  setLocalConfig({...localConfig, showBookInfo: checked})
                }
              />
              <Label htmlFor="show-book-info-toggle">Show Book Information</Label>
            </div>
            
            {/* Show tags toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="show-tags-toggle"
                checked={localConfig.showTags || false}
                onCheckedChange={(checked: boolean) => 
                  setLocalConfig({...localConfig, showTags: checked})
                }
              />
              <Label htmlFor="show-tags-toggle">Show Tags</Label>
            </div>
          </div>
          
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
                onClick={saveSettings}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };
  
  return (
    <div ref={widgetRef} className="widget-container h-full flex flex-col">
      <WidgetHeader
        title={localConfig.title || 'Readwise Highlights'}
        onSettingsClick={() => setShowSettings(true)}
      />
      <div className="flex-grow px-4 pb-4 pt-2 overflow-hidden">
        {renderContent()}
      </div>
      {renderSettings()}
    </div>
  );
};

export default ReadwiseWidget; 