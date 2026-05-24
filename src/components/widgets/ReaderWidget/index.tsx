import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVisibilityRefresh } from '../../../lib/useVisibilityRefresh';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../ui/dialog';
import WidgetHeader from '../common/WidgetHeader';
import {
  RefreshCw,
  AlertCircle,
  BookOpen,
  ExternalLink,
  Clock,
  FileText,
  ArrowLeft,
  Loader2,
  BookMarked,
  Search,
} from 'lucide-react';
import { ReaderDocument, ReaderWidgetConfig, ReaderWidgetProps } from './types';
import { cn } from '@/lib/utils';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup
} from '../../ui/select';

const defaultConfig: ReaderWidgetConfig = {
  title: 'Reader',
  apiToken: '',
  refreshInterval: 30,
  location: 'all',
  contentType: 'all',
  showImage: true,
  showSummary: true,
  showProgress: true,
};

const ReaderWidget: React.FC<ReaderWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [settingsSnapshot, setSettingsSnapshot] = useState<ReaderWidgetConfig | null>(null);
  const [localConfig, setLocalConfig] = useState<ReaderWidgetConfig>({
    ...defaultConfig,
    ...config,
  });

  const [document, setDocument] = useState<ReaderDocument | null>(null);
  const [allDocuments, setAllDocuments] = useState<ReaderDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appCategoryFilter, setAppCategoryFilter] = useState<string>('all');

  const contentRef = useRef<HTMLDivElement | null>(null);

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // --- Data fetching ---
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

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${localConfig.apiToken.trim()}`,
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API token');
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        setAllDocuments(data.results);
        const randomIndex = Math.floor(Math.random() * data.results.length);
        setDocument(data.results[randomIndex]);
        setSelectedDocId(data.results[randomIndex].id);
        setError(null);
      } else {
        setError('No articles found in your Reader library');
        setAllDocuments([]);
        setDocument(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch articles');
    } finally {
      setIsLoading(false);
    }
  }, [localConfig.apiToken, localConfig.location, localConfig.contentType]);

  const showRandomDocument = useCallback(() => {
    setIsReadingMode(false);
    if (allDocuments.length > 0) {
      const randomIndex = Math.floor(Math.random() * allDocuments.length);
      const doc = allDocuments[randomIndex];
      setDocument(doc);
      setSelectedDocId(doc.id);
    } else {
      fetchDocuments();
    }
  }, [allDocuments, fetchDocuments]);

  const fetchDocumentContent = useCallback(async (doc?: ReaderDocument) => {
    const target = doc || document;
    if (!target?.id || !localConfig.apiToken) return;

    setIsLoadingContent(true);
    try {
      const url = `https://readwise.io/api/v3/list/?id=${target.id}&withHtmlContent=true`;
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
          setSelectedDocId(data.results[0].id);
          setIsReadingMode(true);
        }
      }
    } catch (err) {
      console.error('[Reader] Error fetching content:', err);
    } finally {
      setIsLoadingContent(false);
    }
  }, [document?.id, localConfig.apiToken]);

  const selectDocument = useCallback((doc: ReaderDocument) => {
    setDocument(doc);
    setSelectedDocId(doc.id);
    setIsReadingMode(false);
  }, []);

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

  // --- Helpers ---
  const formatReadingTime = (wordCount: number | null): string => {
    if (!wordCount) return '';
    const minutes = Math.ceil(wordCount / 200);
    return `${minutes} min`;
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

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      article: 'Article',
      rss: 'RSS',
      email: 'Email',
      pdf: 'PDF',
      epub: 'EPUB',
      tweet: 'Tweet',
      video: 'Video',
      highlight: 'Highlight',
      note: 'Note',
    };
    return labels[category] || category;
  };

  const openDocument = (doc?: ReaderDocument) => {
    const target = doc || document;
    if (target?.url) {
      window.open(target.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Filtered documents for app mode
  const filteredDocuments = allDocuments.filter(doc => {
    const matchesSearch = !appSearchQuery ||
      doc.title.toLowerCase().includes(appSearchQuery.toLowerCase()) ||
      (doc.author && doc.author.toLowerCase().includes(appSearchQuery.toLowerCase())) ||
      (doc.site_name && doc.site_name.toLowerCase().includes(appSearchQuery.toLowerCase()));
    const matchesCategory = appCategoryFilter === 'all' || doc.category === appCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Unique categories from loaded documents
  const availableCategories = Array.from(new Set(allDocuments.map(d => d.category)));

  // --- Settings modal open/close with snapshot/revert ---
  const openSettings = () => {
    setSettingsSnapshot({ ...localConfig });
    setShowSettings(true);
  };

  const cancelSettings = () => {
    if (settingsSnapshot) {
      setLocalConfig(settingsSnapshot);
    }
    setSettingsSnapshot(null);
    setShowSettings(false);
  };

  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setSettingsSnapshot(null);
    setShowSettings(false);
  };

  // --- State renders ---
  const renderLoadingState = () => (
    <div className="flex-1 flex items-center justify-center">
      <RefreshCw size={20} className="animate-spin text-muted-foreground mr-2" />
      <span className="text-sm text-muted-foreground">Loading...</span>
    </div>
  );

  const renderErrorState = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-2">
      <AlertCircle size={24} className="text-destructive mb-2" />
      <p className="text-xs text-destructive mb-2">{error}</p>
      {!readOnly && (
        <Button size="sm" variant="outline" onClick={fetchDocuments}>Try Again</Button>
      )}
    </div>
  );

  const renderSetupState = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-2">
      <BookOpen size={24} className="text-muted-foreground mb-2" />
      <p className="text-xs text-muted-foreground mb-2">Add your Readwise API token</p>
      {!readOnly && (
        <Button size="sm" variant="outline" onClick={openSettings}>
          Configure
        </Button>
      )}
    </div>
  );

  const renderEmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-2">
      <FileText size={24} className="text-muted-foreground mb-2" />
      <p className="text-xs text-muted-foreground mb-2">No articles found</p>
      {!readOnly && (
        <Button size="sm" variant="outline" onClick={fetchDocuments}>Refresh</Button>
      )}
    </div>
  );

  const renderStateOrNull = () => {
    if (isLoading) return renderLoadingState();
    if (error) return renderErrorState();
    if (!localConfig.apiToken) return renderSetupState();
    if (!document && allDocuments.length === 0) return renderEmptyState();
    return null;
  };

  // --- 1x1 TINY: book icon + article count ---
  const renderTiny = () => {
    const stateView = renderStateOrNull();
    if (stateView) {
      const stateIcon = <BookMarked size={18} className="text-muted-foreground" />;

      if (!localConfig.apiToken && !readOnly) {
        return (
          <button
            type="button"
            className="flex flex-1 items-center justify-center rounded-md"
            onClick={openSettings}
            aria-label="Open Reader settings"
          >
            {stateIcon}
          </button>
        );
      }

      return (
        <div className="flex-1 flex items-center justify-center">
          {stateIcon}
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
        <BookMarked size={18} className="text-primary" />
        <span className="text-[10px] font-medium text-muted-foreground">
          {allDocuments.length}
        </span>
      </div>
    );
  };

  // --- Nx1 RIBBON: horizontal article title chips ---
  const renderShort = () => {
    const stateView = renderStateOrNull();
    if (stateView) return stateView;

    return (
      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto px-1">
        <span className="shrink-0 text-[10px] font-semibold text-muted-foreground bg-muted rounded px-1.5 py-0.5">
          {allDocuments.length}
        </span>
        {allDocuments.slice(0, 8).map((doc) => (
          <Button
            key={doc.id}
            variant="ghost"
            size="sm"
            onClick={() => openDocument(doc)}
            className="shrink-0 h-auto text-[10px] px-2 py-0.5 rounded bg-accent/50 hover:bg-accent text-foreground truncate max-w-[120px] transition-colors"
            title={doc.title}
          >
            {doc.title}
          </Button>
        ))}
      </div>
    );
  };

  // --- 2x2 COMPACT: current article title, author, reading time ---
  const renderCompact = () => {
    const stateView = renderStateOrNull();
    if (stateView) return stateView;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="flex-1 cursor-pointer hover:text-primary transition-colors overflow-hidden"
          onClick={() => openDocument()}
          title="Open article"
        >
          <h3 className="font-medium text-xs line-clamp-2">{document?.title}</h3>
          {document?.author && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{document.author}</p>
          )}
          {localConfig.showSummary && document?.summary && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{document.summary}</p>
          )}
        </div>
        <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            {document?.word_count && (
              <span className="flex items-center">
                <Clock size={10} className="mr-0.5" />
                {formatReadingTime(document.word_count)}
              </span>
            )}
          </div>
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={showRandomDocument}
              className="h-auto p-0 hover:text-primary flex items-center text-[10px] text-muted-foreground"
            >
              <RefreshCw size={10} className="mr-0.5" /> Next
            </Button>
          )}
        </div>
      </div>
    );
  };

  // --- 3x3 DEFAULT WIDGET: image, title, author, summary, actions ---
  const renderDefault = () => {
    const stateView = renderStateOrNull();
    if (stateView) return stateView;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {localConfig.showImage && document?.image_url && (
          <div className="h-24 mb-2 rounded-md overflow-hidden bg-muted flex-shrink-0">
            <img
              src={document.image_url}
              alt=""
              className="media-outline w-full h-full object-cover"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}
        <div
          className="flex-1 cursor-pointer hover:text-primary transition-colors overflow-hidden"
          onClick={() => openDocument()}
          title="Open article"
        >
          <h3 className="font-semibold text-sm line-clamp-2">{document?.title}</h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
            {document?.author && <span className="truncate">{document.author}</span>}
            {document?.site_name && <span className="truncate">via {document.site_name}</span>}
            {document?.published_date && (
              <>
                <span>-</span>
                <span>{formatPublishedDate(document.published_date)}</span>
              </>
            )}
          </div>
          {localConfig.showSummary && document?.summary && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{document.summary}</p>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {document?.word_count && (
              <span className="flex items-center">
                <Clock size={12} className="mr-1" />
                {formatReadingTime(document.word_count)}
              </span>
            )}
            {localConfig.showProgress && document?.reading_progress != null && document.reading_progress > 0 && (
              <span>{Math.round(document.reading_progress * 100)}% read</span>
            )}
          </div>
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={showRandomDocument}
              className="h-auto p-0 hover:text-primary flex items-center text-xs text-muted-foreground"
            >
              <RefreshCw size={12} className="mr-1" /> Next
            </Button>
          )}
        </div>
      </div>
    );
  };

  // --- 4x4-5x5 PANEL: summary + reading pane ---
  const renderPanel = () => {
    const stateView = renderStateOrNull();
    if (stateView) return stateView;

    // Reading mode - show full content
    if (isReadingMode && document?.html_content) {
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setIsReadingMode(false)}>
              <ArrowLeft size={14} className="mr-1" /> Back
            </Button>
            <div className="flex gap-1">
              {!readOnly && (
                <Button size="sm" variant="ghost" onClick={showRandomDocument}>
                  <RefreshCw size={14} className="mr-1" /> Next
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => openDocument()}>
                <ExternalLink size={14} className="mr-1" /> Open
              </Button>
            </div>
          </div>
          <h2 className="font-semibold text-base mb-1 flex-shrink-0 line-clamp-2">{document.title}</h2>
          <div className="text-xs text-muted-foreground mb-2 flex-shrink-0 flex items-center gap-2 flex-wrap">
            {document.author && <span>by {document.author}</span>}
            {document.published_date && (
              <>
                <span>-</span>
                <span>{formatPublishedDate(document.published_date)}</span>
              </>
            )}
          </div>
          <div
            ref={contentRef}
            className="rich-media-outline flex-1 overflow-y-auto text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3 [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_img]:max-w-full [&_img]:rounded"
            dangerouslySetInnerHTML={{ __html: document.html_content }}
          />
        </div>
      );
    }

    // Summary mode
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {localConfig.showImage && document?.image_url && (
          <div className="h-32 mb-2 rounded-md overflow-hidden bg-muted flex-shrink-0">
            <img
              src={document.image_url}
              alt=""
              className="media-outline w-full h-full object-cover"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}
        <div
          className="flex-1 cursor-pointer group overflow-hidden"
          onClick={() => openDocument()}
          title="Open article"
        >
          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors line-clamp-2">
            {document?.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
            {document?.author && <span>{document.author}</span>}
            {document?.site_name && (
              <>
                <span>-</span>
                <span>{document.site_name}</span>
              </>
            )}
            {document?.published_date && (
              <>
                <span>-</span>
                <span>{formatPublishedDate(document.published_date)}</span>
              </>
            )}
          </div>
          {localConfig.showSummary && document?.summary && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-4">{document.summary}</p>
          )}
        </div>
        <div className="mt-3 pt-2 border-t flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {document?.word_count && (
              <span className="flex items-center">
                <Clock size={14} className="mr-1" />
                {formatReadingTime(document.word_count)}
              </span>
            )}
            {localConfig.showProgress && document?.reading_progress != null && document.reading_progress > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${document.reading_progress * 100}%` }}
                  />
                </div>
                <span className="text-xs">{Math.round(document.reading_progress * 100)}%</span>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            {!readOnly && (
              <Button size="sm" variant="ghost" onClick={showRandomDocument}>
                <RefreshCw size={14} className="mr-1" /> Next
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchDocumentContent()}
              disabled={isLoadingContent}
            >
              {isLoadingContent ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <BookOpen size={14} className="mr-1" />
              )}
              Read
            </Button>
            <Button size="sm" variant="outline" onClick={() => openDocument()}>
              <ExternalLink size={14} className="mr-1" /> Open
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // --- 6x6+ APP: master-detail with article list, reading pane, categories ---
  const renderApp = () => {
    const stateView = renderStateOrNull();
    if (stateView) return stateView;

    return (
      <div className="flex-1 flex overflow-hidden">
        {/* Master list -- 1/3 width */}
        <div className="w-1/3 border-r flex flex-col overflow-hidden">
          {/* Search + filter */}
          <div className="p-2 space-y-1.5 flex-shrink-0 widget-drag-handle cursor-move">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={appSearchQuery}
                onChange={(e) => setAppSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              <Button
                variant="ghost"
                size="sm"
                className={`shrink-0 h-auto text-[10px] px-2 py-0.5 rounded-full transition-colors ${appCategoryFilter === 'all' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                onClick={() => setAppCategoryFilter('all')}
              >
                All
              </Button>
              {availableCategories.map(cat => (
                <Button
                  key={cat}
                  variant="ghost"
                  size="sm"
                  className={`shrink-0 h-auto text-[10px] px-2 py-0.5 rounded-full transition-colors ${appCategoryFilter === cat ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                  onClick={() => setAppCategoryFilter(cat)}
                >
                  {getCategoryLabel(cat)}
                </Button>
              ))}
            </div>
          </div>
          {/* Article list */}
          <div className="flex-1 overflow-y-auto">
            {filteredDocuments.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No articles match your filters
              </div>
            )}
            {filteredDocuments.map(doc => (
              <div
                key={doc.id}
                className={`p-3 cursor-pointer border-b transition-colors hover:bg-accent/50 ${selectedDocId === doc.id ? 'bg-accent' : ''}`}
                onClick={() => selectDocument(doc)}
              >
                <h4 className="text-xs font-medium line-clamp-2">{doc.title}</h4>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  {doc.author && <span className="truncate">{doc.author}</span>}
                  <span className="shrink-0">{getCategoryLabel(doc.category)}</span>
                  {doc.word_count && (
                    <span className="shrink-0">{formatReadingTime(doc.word_count)}</span>
                  )}
                </div>
                {doc.reading_progress > 0 && (
                  <div className="mt-1.5 w-full h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${doc.reading_progress * 100}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Footer with count */}
          <div className="p-2 border-t flex items-center justify-between text-[10px] text-muted-foreground flex-shrink-0">
            <span>{filteredDocuments.length} of {allDocuments.length} articles</span>
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchDocuments}
                className="h-auto p-0 hover:text-primary flex items-center text-[10px] text-muted-foreground"
              >
                <RefreshCw size={10} className="mr-0.5" /> Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Detail pane -- 2/3 width */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!document ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <BookMarked size={32} className="mb-2 opacity-50" />
              <p className="text-sm">Select an article to read</p>
            </div>
          ) : isReadingMode && document.html_content ? (
            /* Full reading mode */
            <>
              <div className="flex items-center justify-between p-3 border-b flex-shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setIsReadingMode(false)}>
                  <ArrowLeft size={14} className="mr-1" /> Back
                </Button>
                <div className="flex gap-1">
                  {!readOnly && (
                    <Button size="sm" variant="ghost" onClick={showRandomDocument}>
                      <RefreshCw size={14} />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openDocument()}>
                    <ExternalLink size={14} className="mr-1" /> Reader
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <h1 className="text-xl font-bold mb-2">{document.title}</h1>
                <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2 flex-wrap">
                  {document.author && <span>by {document.author}</span>}
                  {document.published_date && (
                    <>
                      <span>-</span>
                      <span>{formatPublishedDate(document.published_date)}</span>
                    </>
                  )}
                  {document.word_count && (
                    <>
                      <span>-</span>
                      <span>{formatReadingTime(document.word_count)} read</span>
                    </>
                  )}
                </div>
                <div
                  className="rich-media-outline text-sm leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3 [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_img]:max-w-full [&_img]:rounded"
                  dangerouslySetInnerHTML={{ __html: document.html_content }}
                />
              </div>
            </>
          ) : (
            /* Article preview / summary */
            <div className="flex-1 overflow-y-auto p-4">
              {localConfig.showImage && document.image_url && (
                <div className="h-48 mb-4 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={document.image_url}
                    alt=""
                    className="media-outline w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
              <h2 className="text-xl font-bold mb-2">{document.title}</h2>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4 flex-wrap">
                {document.author && <span>{document.author}</span>}
                {document.site_name && (
                  <>
                    <span>-</span>
                    <span>{document.site_name}</span>
                  </>
                )}
                {document.published_date && (
                  <>
                    <span>-</span>
                    <span>{formatPublishedDate(document.published_date)}</span>
                  </>
                )}
                <span className="px-2 py-0.5 rounded-full bg-muted text-xs">
                  {getCategoryLabel(document.category)}
                </span>
              </div>
              {localConfig.showSummary && document.summary && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{document.summary}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                {document.word_count && (
                  <span className="flex items-center">
                    <Clock size={14} className="mr-1" />
                    {formatReadingTime(document.word_count)} read
                  </span>
                )}
                {localConfig.showProgress && document.reading_progress > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${document.reading_progress * 100}%` }}
                      />
                    </div>
                    <span className="text-xs">{Math.round(document.reading_progress * 100)}% read</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={() => fetchDocumentContent()}
                  disabled={isLoadingContent}
                >
                  {isLoadingContent ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : (
                    <BookOpen size={14} className="mr-1" />
                  )}
                  Read here
                </Button>
                <Button variant="outline" onClick={() => openDocument()}>
                  <ExternalLink size={14} className="mr-1" /> Open in Reader
                </Button>
                {!readOnly && (
                  <Button variant="ghost" onClick={showRandomDocument}>
                    <RefreshCw size={14} className="mr-1" /> Random
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Settings Modal ---
  const renderSettingsModal = () => (
    <Dialog open={showSettings} onOpenChange={(open) => { if (!open) cancelSettings(); }}>
      <DialogContent className="settings-dialog-content sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{localConfig.title || 'Reader'} Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="reader-title">Title</Label>
            <Input
              id="reader-title"
              value={localConfig.title || ''}
              onChange={(e) => setLocalConfig(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="reader-apiToken">Readwise API Token</Label>
            <Input
              id="reader-apiToken"
              type="password"
              value={localConfig.apiToken || ''}
              onChange={(e) => setLocalConfig(prev => ({ ...prev, apiToken: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Get your token at{' '}
              <a href="https://readwise.io/access_token" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                readwise.io/access_token
              </a>
            </p>
          </div>

          <div>
            <Label>Location Filter</Label>
            <Select
              value={localConfig.location || 'all'}
              onValueChange={(value) => setLocalConfig(prev => ({ ...prev, location: value as ReaderWidgetConfig['location'] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="new">Inbox (New)</SelectItem>
                <SelectItem value="later">Later</SelectItem>
                <SelectItem value="shortlist">Shortlist</SelectItem>
                <SelectItem value="archive">Archive</SelectItem>
                <SelectItem value="feed">Feed</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Content Type</Label>
            <Select
              value={localConfig.contentType || 'all'}
              onValueChange={(value) => setLocalConfig(prev => ({ ...prev, contentType: value as ReaderWidgetConfig['contentType'] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="article">Articles</SelectItem>
                <SelectItem value="rss">RSS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="epub">EPUB</SelectItem>
                <SelectItem value="tweet">Tweets</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="reader-refreshInterval">Refresh Interval (minutes)</Label>
            <Input
              id="reader-refreshInterval"
              type="number"
              min="0"
              value={localConfig.refreshInterval || 0}
              onChange={(e) => setLocalConfig(prev => ({ ...prev, refreshInterval: parseInt(e.target.value) || 0 }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="reader-showImage">Show Cover Image</Label>
            <Switch
              id="reader-showImage"
              checked={localConfig.showImage ?? true}
              onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, showImage: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="reader-showSummary">Show Summary</Label>
            <Switch
              id="reader-showSummary"
              checked={localConfig.showSummary ?? true}
              onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, showSummary: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="reader-showProgress">Show Reading Progress</Label>
            <Switch
              id="reader-showProgress"
              checked={localConfig.showProgress ?? true}
              onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, showProgress: checked }))}
            />
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            {config?.onDelete && (
              <Button variant="destructive" onClick={config.onDelete}>Delete Widget</Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={cancelSettings}>Cancel</Button>
              <Button onClick={saveSettings}>Save</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}>
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title || 'Reader'}
          onSettingsClick={readOnly ? undefined : openSettings}
        />
      )}

      {/* Size-branching render (most specific first) */}
      {isTiny ? renderTiny()
        : isShort ? renderShort()
        : isApp ? renderApp()
        : isWide && isTall ? renderPanel()
        : isCompact ? renderCompact()
        : renderDefault()}

      {!readOnly && renderSettingsModal()}
    </div>
  );
};

export default ReaderWidget;
