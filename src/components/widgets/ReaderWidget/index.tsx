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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import { RefreshCw, AlertCircle, BookOpen, ExternalLink, Clock, FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { ReaderDocument, ReaderWidgetConfig, ReaderWidgetProps } from './types';

enum WidgetSizeCategory {
  SMALL = 'small',
  WIDE_SMALL = 'wideSmall',
  TALL_SMALL = 'tallSmall',
  MEDIUM = 'medium',
  WIDE_MEDIUM = 'wideMedium',
  TALL_MEDIUM = 'tallMedium',
  LARGE = 'large'
}

const ReaderWidget: React.FC<ReaderWidgetProps> = ({ width, height, config }) => {
  const defaultConfig: ReaderWidgetConfig = {
    title: 'Reader',
    apiToken: '',
    refreshInterval: 30,
    location: 'all',
    contentType: 'all',
    showImage: true,
    showSummary: true,
    showProgress: true
  };

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<ReaderWidgetConfig>({
    ...defaultConfig,
    ...config
  });

  const [document, setDocument] = useState<ReaderDocument | null>(null);
  const [allDocuments, setAllDocuments] = useState<ReaderDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isReadingMode, setIsReadingMode] = useState<boolean>(false);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);

  const widgetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocalConfig(prevConfig => ({
      ...prevConfig,
      ...config
    }));
  }, [config]);

  const fetchDocuments = useCallback(async () => {
    if (!localConfig.apiToken) {
      setError('API token is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let url = 'https://readwise.io/api/v3/list/';
      const params = new URLSearchParams();

      if (localConfig.location && localConfig.location !== 'all') {
        params.append('location', localConfig.location);
      }
      if (localConfig.contentType && localConfig.contentType !== 'all') {
        params.append('category', localConfig.contentType);
      }

      if (params.toString()) {
        url += '?' + params.toString();
      }

      console.log('[Reader] Fetching from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${localConfig.apiToken.trim()}`,
        }
      });

      console.log('[Reader] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Reader] Error response:', errorText);
        if (response.status === 401) {
          throw new Error('Invalid API token');
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Reader] Got data, count:', data.count, 'results:', data.results?.length);

      if (data.results && data.results.length > 0) {
        setAllDocuments(data.results);
        const randomIndex = Math.floor(Math.random() * data.results.length);
        setDocument(data.results[randomIndex]);
        setError(null);
      } else {
        setError('No articles found in your Reader library');
        setAllDocuments([]);
        setDocument(null);
      }
    } catch (error) {
      console.error('[Reader] Error fetching documents:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch articles');
    } finally {
      setIsLoading(false);
    }
  }, [localConfig.apiToken, localConfig.location, localConfig.contentType]);

  const showRandomDocument = useCallback(() => {
    setIsReadingMode(false);
    if (allDocuments.length > 0) {
      const randomIndex = Math.floor(Math.random() * allDocuments.length);
      setDocument(allDocuments[randomIndex]);
    } else {
      fetchDocuments();
    }
  }, [allDocuments, fetchDocuments]);

  const fetchDocumentContent = useCallback(async () => {
    if (!document?.id || !localConfig.apiToken) return;

    setIsLoadingContent(true);
    try {
      const url = `https://readwise.io/api/v3/list/?id=${document.id}&withHtmlContent=true`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${localConfig.apiToken.trim()}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          setDocument(data.results[0]);
          setIsReadingMode(true);
        }
      }
    } catch (error) {
      console.error('[Reader] Error fetching content:', error);
    } finally {
      setIsLoadingContent(false);
    }
  }, [document?.id, localConfig.apiToken]);

  useEffect(() => {
    if (localConfig.apiToken) {
      fetchDocuments();
    }
  }, [localConfig.apiToken, localConfig.location, localConfig.contentType, fetchDocuments]);

  useVisibilityRefresh({
    onRefresh: fetchDocuments,
    minHiddenTime: 60000,
    refreshInterval: localConfig.refreshInterval && localConfig.refreshInterval > 0
      ? localConfig.refreshInterval * 60 * 1000
      : 0,
    enabled: !!localConfig.apiToken
  });

  const getWidgetSizeCategory = (width: number, height: number): WidgetSizeCategory => {
    if (width >= 4 && height >= 4) return WidgetSizeCategory.LARGE;
    if (width >= 4 && height >= 3) return WidgetSizeCategory.WIDE_MEDIUM;
    if (width >= 3 && height >= 4) return WidgetSizeCategory.TALL_MEDIUM;
    if (width >= 3 && height >= 3) return WidgetSizeCategory.MEDIUM;
    if (width >= 3 && height >= 2) return WidgetSizeCategory.WIDE_SMALL;
    if (width >= 2 && height >= 3) return WidgetSizeCategory.TALL_SMALL;
    return WidgetSizeCategory.SMALL;
  };

  const formatReadingTime = (wordCount: number | null): string => {
    if (!wordCount) return '';
    const minutes = Math.ceil(wordCount / 200);
    return `${minutes} min read`;
  };

  const formatPublishedDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'article':
      case 'rss':
        return <FileText size={12} className="mr-1" />;
      case 'pdf':
      case 'epub':
        return <BookOpen size={12} className="mr-1" />;
      default:
        return <FileText size={12} className="mr-1" />;
    }
  };

  const openDocument = () => {
    if (document?.url) {
      window.open(document.url, '_blank', 'noopener,noreferrer');
    }
  };

  const renderContent = () => {
    const sizeCategory = getWidgetSizeCategory(width, height);

    if (isLoading) return renderLoadingState();
    if (error) return renderErrorState();
    if (!localConfig.apiToken) return renderNoApiTokenState();
    if (!document) return renderEmptyState();

    switch (sizeCategory) {
      case WidgetSizeCategory.LARGE:
      case WidgetSizeCategory.TALL_MEDIUM:
        return renderLargeView();
      case WidgetSizeCategory.WIDE_MEDIUM:
      case WidgetSizeCategory.MEDIUM:
        return renderMediumView();
      case WidgetSizeCategory.WIDE_SMALL:
      case WidgetSizeCategory.TALL_SMALL:
        return renderSmallView();
      case WidgetSizeCategory.SMALL:
      default:
        return renderTinyView();
    }
  };

  const renderLoadingState = () => (
    <div className="flex items-center justify-center h-full">
      <RefreshCw size={24} className="animate-spin text-muted-foreground mr-2" />
      <span className="text-muted-foreground">Loading...</span>
    </div>
  );

  const renderErrorState = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <AlertCircle size={32} className="text-destructive mb-3" />
      <p className="text-sm text-destructive mb-3">{error}</p>
      <Button size="sm" onClick={fetchDocuments}>Try Again</Button>
    </div>
  );

  const renderNoApiTokenState = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <BookOpen size={32} className="text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground mb-3">Add your Readwise API token</p>
      <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>
        Configure
      </Button>
    </div>
  );

  const renderEmptyState = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <FileText size={32} className="text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground mb-3">No articles found</p>
      <Button size="sm" onClick={fetchDocuments}>Refresh</Button>
    </div>
  );

  const renderTinyView = () => (
    <div className="h-full flex flex-col">
      <div
        className="flex-grow cursor-pointer hover:text-primary transition-colors overflow-hidden"
        onClick={openDocument}
        title="Open article"
      >
        <h3 className="font-medium text-sm line-clamp-3">{document?.title}</h3>
        {document?.author && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{document.author}</p>
        )}
      </div>
      <button
        onClick={showRandomDocument}
        className="mt-2 text-xs text-muted-foreground hover:text-primary flex items-center"
      >
        <RefreshCw size={12} className="mr-1" /> Next
      </button>
    </div>
  );

  const renderSmallView = () => (
    <div className="h-full flex flex-col">
      <div
        className="flex-grow cursor-pointer hover:text-primary transition-colors overflow-hidden"
        onClick={openDocument}
        title="Open article"
      >
        <h3 className="font-medium text-sm line-clamp-2">{document?.title}</h3>
        {document?.author && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{document.author}</p>
        )}
        {localConfig.showSummary && document?.summary && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{document.summary}</p>
        )}
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <div className="flex items-center">
          {getCategoryIcon(document?.category || '')}
          {document?.word_count && (
            <span className="flex items-center">
              <Clock size={12} className="mr-1" />
              {formatReadingTime(document.word_count)}
            </span>
          )}
        </div>
        <button
          onClick={showRandomDocument}
          className="hover:text-primary flex items-center"
        >
          <RefreshCw size={12} className="mr-1" /> Next
        </button>
      </div>
    </div>
  );

  const renderMediumView = () => (
    <div className="h-full flex flex-col">
      {localConfig.showImage && document?.image_url && (
        <div className="h-24 mb-3 rounded-md overflow-hidden bg-muted flex-shrink-0">
          <img
            src={document.image_url}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
      )}
      <div
        className="flex-grow cursor-pointer hover:text-primary transition-colors overflow-hidden"
        onClick={openDocument}
        title="Open article"
      >
        <h3 className="font-semibold line-clamp-2">{document?.title}</h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
          {document?.author && <span className="truncate">{document.author}</span>}
          {document?.site_name && <span className="truncate">via {document.site_name}</span>}
          {document?.published_date && (
            <>
              <span>•</span>
              <span>{formatPublishedDate(document.published_date)}</span>
            </>
          )}
        </div>
        {localConfig.showSummary && document?.summary && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{document.summary}</p>
        )}
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {document?.word_count && (
            <span className="flex items-center">
              <Clock size={12} className="mr-1" />
              {formatReadingTime(document.word_count)}
            </span>
          )}
          {localConfig.showProgress && document?.reading_progress && document.reading_progress > 0 && (
            <span>{Math.round(document.reading_progress * 100)}% read</span>
          )}
        </div>
        <button
          onClick={showRandomDocument}
          className="hover:text-primary flex items-center"
        >
          <RefreshCw size={14} className="mr-1" /> Next
        </button>
      </div>
    </div>
  );

  const renderLargeView = () => {
    // Reading mode - show full content
    if (isReadingMode && document?.html_content) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setIsReadingMode(false)}>
              <ArrowLeft size={14} className="mr-1" /> Back
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={showRandomDocument}>
                <RefreshCw size={14} className="mr-1" /> Next
              </Button>
              <Button size="sm" variant="outline" onClick={openDocument}>
                <ExternalLink size={14} className="mr-1" /> Reader
              </Button>
            </div>
          </div>
          <h2 className="font-semibold text-lg mb-2 flex-shrink-0">{document.title}</h2>
          <div className="text-sm text-muted-foreground mb-3 flex-shrink-0 flex items-center gap-2 flex-wrap">
            {document.author && <span>by {document.author}</span>}
            {document.published_date && (
              <>
                <span>•</span>
                <span>{formatPublishedDate(document.published_date)}</span>
              </>
            )}
          </div>
          <div
            className="flex-grow overflow-y-auto text-sm leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3 [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_img]:max-w-full [&_img]:rounded"
            dangerouslySetInnerHTML={{ __html: document.html_content }}
          />
        </div>
      );
    }

    // Summary mode - show preview
    return (
      <div className="h-full flex flex-col">
        {localConfig.showImage && document?.image_url && (
          <div className="h-32 mb-3 rounded-md overflow-hidden bg-muted flex-shrink-0">
            <img
              src={document.image_url}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}
        <div
          className="flex-grow cursor-pointer group overflow-hidden"
          onClick={openDocument}
          title="Open article"
        >
          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors line-clamp-2">
            {document?.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
            {document?.author && <span>{document.author}</span>}
            {document?.site_name && (
              <>
                <span>•</span>
                <span>{document.site_name}</span>
              </>
            )}
            {document?.published_date && (
              <>
                <span>•</span>
                <span>{formatPublishedDate(document.published_date)}</span>
              </>
            )}
          </div>
          {localConfig.showSummary && document?.summary && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-4">{document.summary}</p>
          )}
        </div>
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {document?.word_count && (
              <span className="flex items-center">
                <Clock size={14} className="mr-1" />
                {formatReadingTime(document.word_count)}
              </span>
            )}
            {localConfig.showProgress && document?.reading_progress && document.reading_progress > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(document.reading_progress ?? 0) * 100}%` }}
                  />
                </div>
                <span className="text-xs">{Math.round((document.reading_progress ?? 0) * 100)}%</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={showRandomDocument}>
              <RefreshCw size={14} className="mr-1" /> Next
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchDocumentContent}
              disabled={isLoadingContent}
            >
              {isLoadingContent ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <BookOpen size={14} className="mr-1" />
              )}
              Read here
            </Button>
            <Button size="sm" onClick={openDocument}>
              <ExternalLink size={14} className="mr-1" /> Reader
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
    fetchDocuments();
  };

  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reader Widget Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Widget Title</Label>
            <Input
              id="title"
              value={localConfig.title || ''}
              onChange={(e) => setLocalConfig({...localConfig, title: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiToken">Readwise API Token</Label>
            <Input
              id="apiToken"
              type="password"
              value={localConfig.apiToken || ''}
              onChange={(e) => setLocalConfig({...localConfig, apiToken: e.target.value})}
            />
            <p className="text-xs text-muted-foreground">
              Get your token at{' '}
              <a href="https://readwise.io/access_token" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                readwise.io/access_token
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Location Filter</Label>
            <Select
              value={localConfig.location || 'all'}
              onValueChange={(value) => setLocalConfig({...localConfig, location: value as ReaderWidgetConfig['location']})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="new">Inbox (New)</SelectItem>
                <SelectItem value="later">Later</SelectItem>
                <SelectItem value="shortlist">Shortlist</SelectItem>
                <SelectItem value="archive">Archive</SelectItem>
                <SelectItem value="feed">Feed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Content Type</Label>
            <Select
              value={localConfig.contentType || 'all'}
              onValueChange={(value) => setLocalConfig({...localConfig, contentType: value as ReaderWidgetConfig['contentType']})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="article">Articles</SelectItem>
                <SelectItem value="rss">RSS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="epub">EPUB</SelectItem>
                <SelectItem value="tweet">Tweets</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refreshInterval">Refresh Interval (minutes)</Label>
            <Input
              id="refreshInterval"
              type="number"
              min="0"
              value={localConfig.refreshInterval || 0}
              onChange={(e) => setLocalConfig({...localConfig, refreshInterval: parseInt(e.target.value) || 0})}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="showImage"
              checked={localConfig.showImage ?? true}
              onCheckedChange={(checked) => setLocalConfig({...localConfig, showImage: checked})}
            />
            <Label htmlFor="showImage">Show Cover Image</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="showSummary"
              checked={localConfig.showSummary ?? true}
              onCheckedChange={(checked) => setLocalConfig({...localConfig, showSummary: checked})}
            />
            <Label htmlFor="showSummary">Show Summary</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="showProgress"
              checked={localConfig.showProgress ?? true}
              onCheckedChange={(checked) => setLocalConfig({...localConfig, showProgress: checked})}
            />
            <Label htmlFor="showProgress">Show Reading Progress</Label>
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            {config?.onDelete && (
              <Button variant="destructive" onClick={config.onDelete}>
                Delete
              </Button>
            )}
            <Button onClick={saveSettings}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div ref={widgetRef} className="widget-container h-full flex flex-col">
      <WidgetHeader
        title={localConfig.title || 'Reader'}
        onSettingsClick={() => setShowSettings(true)}
      />
      <div className="flex-grow px-4 pb-4 pt-2 overflow-hidden">
        {renderContent()}
      </div>
      {renderSettings()}
    </div>
  );
};

export default ReaderWidget;
