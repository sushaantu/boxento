import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useVisibilityRefresh } from '../../../lib/useVisibilityRefresh';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import WidgetHeader from '../common/WidgetHeader';
import {
  RefreshCw,
  Quote,
  AlertCircle,
  BookOpen,
  Settings,
  Search,
  ChevronRight,
  Tag,
} from 'lucide-react';
import { ReadwiseHighlight, ReadwiseBook, ReadwiseWidgetConfig, ReadwiseWidgetProps } from './types';
import { cn } from '@/lib/utils';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';

const defaultConfig: ReadwiseWidgetConfig = {
  title: 'Readwise Highlights',
  apiToken: '',
  refreshInterval: 30,
  showBookInfo: true,
  showTags: true,
};

const ReadwiseWidget: React.FC<ReadwiseWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<ReadwiseWidgetConfig>({
    ...defaultConfig,
    ...config,
  });

  // Snapshot for settings reset on cancel/close
  const [configSnapshot, setConfigSnapshot] = useState<ReadwiseWidgetConfig>(localConfig);

  // Data state
  const [highlights, setHighlights] = useState<ReadwiseHighlight[]>([]);
  const [books, setBooks] = useState<ReadwiseBook[]>([]);
  const [currentHighlight, setCurrentHighlight] = useState<ReadwiseHighlight | null>(null);
  const [selectedHighlight, setSelectedHighlight] = useState<ReadwiseHighlight | null>(null);
  const [selectedBookFilter, setSelectedBookFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightCount, setHighlightCount] = useState<number>(0);

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Fetch highlights from the API
  const fetchHighlights = useCallback(async () => {
    if (!localConfig.apiToken) {
      setError('API token is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const randomPage = Math.floor(Math.random() * 10) + 1;
      const response = await fetch(
        `https://readwise.io/api/v2/highlights/?page=${randomPage}&page_size=100`,
        {
          headers: {
            Authorization: `Token ${localConfig.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.count) {
        setHighlightCount(data.count);
      }

      if (data.results && data.results.length > 0) {
        // Enrich with book info
        const enriched = await Promise.all(
          data.results.map(async (h: ReadwiseHighlight) => {
            if (localConfig.showBookInfo && h.book_id) {
              try {
                const bookRes = await fetch(
                  `https://readwise.io/api/v2/books/${h.book_id}/`,
                  {
                    headers: {
                      Authorization: `Token ${localConfig.apiToken}`,
                      'Content-Type': 'application/json',
                    },
                  }
                );
                if (bookRes.ok) {
                  const bookData = await bookRes.json();
                  h.book_title = bookData.title;
                  h.book_author = bookData.author;
                }
              } catch {
                // silently ignore book fetch errors
              }
            }
            return h;
          })
        );

        setHighlights(enriched);
        // Pick a random one for the current display
        const randomIndex = Math.floor(Math.random() * enriched.length);
        setCurrentHighlight(enriched[randomIndex]);
      } else {
        setError('No highlights found');
      }
    } catch (err) {
      console.error('Error fetching highlights:', err);
      setError('Failed to fetch highlights');
    } finally {
      setIsLoading(false);
    }
  }, [localConfig.apiToken, localConfig.showBookInfo]);

  // Fetch books list (for app mode)
  const fetchBooks = useCallback(async () => {
    if (!localConfig.apiToken) return;

    try {
      const response = await fetch(
        'https://readwise.io/api/v2/books/?page_size=100',
        {
          headers: {
            Authorization: `Token ${localConfig.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.results) {
          setBooks(
            data.results.map((b: Record<string, unknown>) => ({
              id: b.id as number,
              title: b.title as string,
              author: b.author as string,
              category: b.category as string,
              num_highlights: b.num_highlights as number,
              cover_image_url: b.cover_image_url as string | undefined,
              source_url: b.source_url as string | undefined,
            }))
          );
        }
      }
    } catch {
      // silently ignore book list errors
    }
  }, [localConfig.apiToken]);

  // Get a new random highlight from the current set
  const shuffleHighlight = useCallback(() => {
    if (highlights.length > 0) {
      const randomIndex = Math.floor(Math.random() * highlights.length);
      setCurrentHighlight(highlights[randomIndex]);
    }
  }, [highlights]);

  // Fetch on mount
  useEffect(() => {
    if (localConfig.apiToken) {
      fetchHighlights();
      if (isApp) {
        fetchBooks();
      }
    }
  }, [localConfig.apiToken, fetchHighlights, fetchBooks, isApp]);

  // Auto-refresh
  useVisibilityRefresh({
    onRefresh: fetchHighlights,
    minHiddenTime: 60000,
    refreshInterval:
      localConfig.refreshInterval && localConfig.refreshInterval > 0
        ? localConfig.refreshInterval * 60 * 1000
        : 0,
    enabled: !!localConfig.apiToken,
  });

  // Unique book list from highlights for app-mode sidebar filter
  const bookList = useMemo(() => {
    const bookMap = new Map<number, { id: number; title: string; count: number }>();
    highlights.forEach(h => {
      if (h.book_id && h.book_title) {
        const existing = bookMap.get(h.book_id);
        if (existing) {
          existing.count += 1;
        } else {
          bookMap.set(h.book_id, { id: h.book_id, title: h.book_title, count: 1 });
        }
      }
    });
    return Array.from(bookMap.values()).sort((a, b) => b.count - a.count);
  }, [highlights]);

  // Filtered highlights for app mode
  const filteredHighlights = useMemo(() => {
    let filtered = highlights;

    if (selectedBookFilter !== null) {
      filtered = filtered.filter(h => h.book_id === selectedBookFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        h =>
          h.text.toLowerCase().includes(q) ||
          (h.book_title && h.book_title.toLowerCase().includes(q)) ||
          (h.book_author && h.book_author.toLowerCase().includes(q)) ||
          (h.note && h.note.toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [highlights, selectedBookFilter, searchQuery]);

  // Open highlight in Readwise
  const openHighlightInReadwise = useCallback((highlightId?: number) => {
    const id = highlightId || currentHighlight?.id;
    if (id) {
      window.open(`https://readwise.io/open/${id}`, '_blank', 'noopener,noreferrer');
    }
  }, [currentHighlight]);

  // Settings persistence
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
    fetchHighlights();
  };

  const handleSettingsOpenChange = (open: boolean) => {
    if (open) {
      setConfigSnapshot({ ...localConfig });
    } else {
      // revert to snapshot on close without save
      setLocalConfig(configSnapshot);
    }
    setShowSettings(open);
  };

  const handleCancelSettings = () => {
    setLocalConfig(configSnapshot);
    setShowSettings(false);
  };

  // --- Setup prompt (no API token) ---
  if (!localConfig.apiToken) {
    if (isTiny) {
      return (
        <div className="widget-container h-full flex flex-col widget-drag-handle p-1">
          <WidgetHeader
            title={undefined}
            onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
            compact
          />
          <div className="flex-1 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
          </div>
          {renderSettingsDialog()}
        </div>
      );
    }

    return (
      <div className="widget-container h-full flex flex-col p-2 md:p-3">
        <WidgetHeader
          title={localConfig.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isTiny}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Settings className="h-8 w-8" />
          <p className="text-sm">Configure this widget to get started</p>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              Open Settings
            </Button>
          )}
        </div>
        {renderSettingsDialog()}
      </div>
    );
  }

  // --- Size-specific renderers ---

  // 1x1 ICON: book icon + highlight count
  function renderTiny() {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-1 text-center">
        <div className="text-lg font-semibold leading-none text-foreground">
          {highlightCount || highlights.length}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          highlights
        </div>
      </div>
    );
  }

  // Nx1 RIBBON: quote preview chips
  function renderShort() {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error || !currentHighlight) {
      return (
        <div className="flex-1 flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Quote className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{error || 'No highlights'}</span>
        </div>
      );
    }

    const previewHighlights = highlights.slice(0, Math.min(highlights.length, width + 1));

    return (
      <div className="flex-1 flex items-center gap-2 overflow-x-auto px-1 text-xs">
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 font-medium text-foreground">
          {highlightCount || highlights.length} highlights
        </span>
        {previewHighlights.map(h => (
          <button
            key={h.id}
            onClick={() => openHighlightInReadwise(h.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-foreground transition-colors hover:bg-accent"
            title={h.text}
          >
            <Quote className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="max-w-[10rem] truncate italic">{h.text}</span>
          </button>
        ))}
      </div>
    );
  }

  // 2x2 MICRO: single quote, compact
  function renderCompact() {
    if (isLoading) return renderLoadingState();
    if (error) return renderErrorState();
    if (!currentHighlight) return renderEmptyState();

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto min-h-0">
          <div
            className="text-sm font-serif italic text-foreground leading-snug cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={() => openHighlightInReadwise()}
            title="Open in Readwise"
          >
            &ldquo;{currentHighlight.text}&rdquo;
          </div>
        </div>
        {localConfig.showBookInfo && currentHighlight.book_title && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
            <BookOpen className="h-3 w-3 shrink-0" />
            <span className="truncate">{currentHighlight.book_title}</span>
          </div>
        )}
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={shuffleHighlight}
            className="mt-1 self-end h-5 px-1 text-[10px]"
          >
            <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
            shuffle
          </Button>
        )}
      </div>
    );
  }

  // 3x3 DEFAULT WIDGET: balanced quote view with book info, tags, refresh
  function renderDefault() {
    if (isLoading) return renderLoadingState();
    if (error) return renderErrorState();
    if (!currentHighlight) return renderEmptyState();

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto min-h-0">
          <div
            className="text-base font-serif italic text-foreground leading-relaxed cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={() => openHighlightInReadwise()}
            title="Open in Readwise"
          >
            &ldquo;{currentHighlight.text}&rdquo;
          </div>

          {currentHighlight.note && (
            <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
              <span className="font-medium">Note:</span> {currentHighlight.note}
            </div>
          )}
        </div>

        <div className="shrink-0 mt-2 space-y-1.5">
          {localConfig.showBookInfo && (
            <div>
              {currentHighlight.book_title && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <BookOpen className="h-3 w-3 shrink-0" />
                  <span className="truncate font-medium">{currentHighlight.book_title}</span>
                </div>
              )}
              {currentHighlight.book_author && (
                <div className="text-[10px] text-muted-foreground ml-4">
                  by {currentHighlight.book_author}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            {localConfig.showTags && currentHighlight.tags && currentHighlight.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1 min-w-0">
                {currentHighlight.tags.map(tag => (
                  <span
                    key={tag.id}
                    className="text-[10px] bg-muted px-1.5 py-0.5 rounded"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : (
              <div />
            )}

            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={shuffleHighlight}
                className="shrink-0 h-7 px-2 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Shuffle
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 4x4-5x5 PANEL: split view with highlight list + detail
  function renderPanel() {
    if (isLoading) return renderLoadingState();
    if (error) return renderErrorState();
    if (highlights.length === 0) return renderEmptyState();

    const displayHighlight = selectedHighlight || currentHighlight;

    return (
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Highlight list */}
        <div className="w-2/5 border-r border-border overflow-y-auto">
          <div className="p-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {highlights.length} highlights
            </span>
            {!readOnly && (
              <Button variant="ghost" size="sm" onClick={fetchHighlights} className="h-6 px-1.5">
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
          {highlights.map(h => (
            <button
              key={h.id}
              className={`w-full text-left p-2.5 border-b border-border/50 transition-colors hover:bg-accent ${
                displayHighlight?.id === h.id ? 'bg-accent' : ''
              }`}
              onClick={() => setSelectedHighlight(h)}
            >
              <p className="text-xs font-serif italic text-foreground line-clamp-2">
                &ldquo;{h.text}&rdquo;
              </p>
              {h.book_title && (
                <p className="text-[10px] text-muted-foreground mt-1 truncate">
                  {h.book_title}
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Detail pane */}
        <div className="flex-1 overflow-y-auto p-3">
          {displayHighlight ? (
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <div
                  className="text-lg font-serif italic text-foreground leading-relaxed cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  onClick={() => openHighlightInReadwise(displayHighlight.id)}
                  title="Open in Readwise"
                >
                  &ldquo;{displayHighlight.text}&rdquo;
                </div>

                {displayHighlight.note && (
                  <div className="text-sm text-muted-foreground mt-3 p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium mb-1 text-xs">Note</div>
                    {displayHighlight.note}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-border space-y-2">
                {localConfig.showBookInfo && (
                  <div>
                    {displayHighlight.book_title && (
                      <div className="text-sm flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />
                        <span className="font-medium">{displayHighlight.book_title}</span>
                      </div>
                    )}
                    {displayHighlight.book_author && (
                      <div className="text-xs text-muted-foreground ml-5.5 mt-0.5">
                        by {displayHighlight.book_author}
                      </div>
                    )}
                  </div>
                )}

                {localConfig.showTags &&
                  displayHighlight.tags &&
                  displayHighlight.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {displayHighlight.tags.map(tag => (
                        <span
                          key={tag.id}
                          className="text-xs bg-muted px-2 py-0.5 rounded"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}

                {displayHighlight.highlighted_at && (
                  <div className="text-[10px] text-muted-foreground">
                    Highlighted {new Date(displayHighlight.highlighted_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a highlight
            </div>
          )}
        </div>
      </div>
    );
  }

  // 6x6+ APP: full highlight browser with book sidebar, search, filters
  function renderApp() {
    if (isLoading) return renderLoadingState();
    if (error) return renderErrorState();
    if (highlights.length === 0) return renderEmptyState();

    const displayHighlight = selectedHighlight || currentHighlight;

    return (
      <div className="flex h-full overflow-hidden">
        {/* Left sidebar: books/sources */}
        <div className="w-1/4 border-r border-border flex flex-col overflow-hidden">
          <div className="p-3 widget-drag-handle cursor-move">
            <h3 className="text-sm font-semibold text-foreground mb-2">Sources</h3>
            <div className="text-xs text-muted-foreground">
              {books.length > 0 ? `${books.length} books` : `${bookList.length} sources`}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <button
              className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-accent ${
                selectedBookFilter === null ? 'bg-accent font-medium' : ''
              }`}
              onClick={() => setSelectedBookFilter(null)}
            >
              All highlights ({highlights.length})
            </button>

            {bookList.map(book => (
              <button
                key={book.id}
                className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-accent flex items-center justify-between ${
                  selectedBookFilter === book.id ? 'bg-accent font-medium' : ''
                }`}
                onClick={() => setSelectedBookFilter(book.id)}
              >
                <span className="truncate">{book.title}</span>
                <span className="shrink-0 ml-2 text-muted-foreground">{book.count}</span>
              </button>
            ))}
          </div>

          {!readOnly && (
            <div className="p-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchHighlights}
                className="w-full text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
          )}
        </div>

        {/* Middle: highlight list */}
        <div className="w-1/3 border-r border-border flex flex-col overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search highlights..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredHighlights.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No matching highlights
              </div>
            ) : (
              filteredHighlights.map(h => (
                <button
                  key={h.id}
                  className={`w-full text-left p-3 border-b border-border/50 transition-colors hover:bg-accent ${
                    displayHighlight?.id === h.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => setSelectedHighlight(h)}
                >
                  <p className="text-sm font-serif italic text-foreground line-clamp-3">
                    &ldquo;{h.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {h.book_title && (
                      <span className="text-[11px] text-muted-foreground truncate">
                        {h.book_title}
                      </span>
                    )}
                    {h.tags && h.tags.length > 0 && (
                      <div className="flex items-center gap-0.5 text-muted-foreground">
                        <Tag className="h-2.5 w-2.5" />
                        <span className="text-[10px]">{h.tags.length}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-2 border-t border-border text-[11px] text-muted-foreground text-center">
            {filteredHighlights.length} of {highlights.length} highlights
          </div>
        </div>

        {/* Right: detail pane */}
        <div className="flex-1 overflow-y-auto p-4">
          {displayHighlight ? (
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <Quote className="h-8 w-8 text-muted-foreground/30 shrink-0 mt-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openHighlightInReadwise(displayHighlight.id)}
                    className="shrink-0 text-xs"
                  >
                    Open in Readwise
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>

                <div className="text-xl font-serif italic text-foreground leading-relaxed mb-4">
                  &ldquo;{displayHighlight.text}&rdquo;
                </div>

                {displayHighlight.note && (
                  <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg mb-4">
                    <div className="font-medium mb-1 text-xs uppercase tracking-wide">Note</div>
                    {displayHighlight.note}
                  </div>
                )}
              </div>

              <div className="mt-auto pt-4 border-t border-border space-y-3">
                {localConfig.showBookInfo && (
                  <div>
                    {displayHighlight.book_title && (
                      <div className="text-base flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />
                        <span className="font-medium">{displayHighlight.book_title}</span>
                      </div>
                    )}
                    {displayHighlight.book_author && (
                      <div className="text-sm text-muted-foreground ml-6 mt-0.5">
                        by {displayHighlight.book_author}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  {localConfig.showTags &&
                  displayHighlight.tags &&
                  displayHighlight.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {displayHighlight.tags.map(tag => (
                        <span
                          key={tag.id}
                          className="text-xs bg-muted px-2 py-1 rounded"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div />
                  )}

                  {displayHighlight.highlighted_at && (
                    <div className="text-xs text-muted-foreground shrink-0">
                      {new Date(displayHighlight.highlighted_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Quote className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm">Select a highlight to view details</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Shared state renderers ---

  function renderLoadingState() {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  function renderErrorState() {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        {!readOnly && (
          <Button size="sm" onClick={fetchHighlights}>
            Try Again
          </Button>
        )}
      </div>
    );
  }

  function renderEmptyState() {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
        <BookOpen className="h-8 w-8" />
        <p className="text-sm">No highlights found</p>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={fetchHighlights}>
            Refresh
          </Button>
        )}
      </div>
    );
  }

  // --- Settings dialog ---
  function renderSettingsDialog() {
    if (readOnly) return null;

    return (
      <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{localConfig.title || 'Readwise Highlights'} Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="rw-title">Title</Label>
              <Input
                id="rw-title"
                value={localConfig.title || ''}
                onChange={e =>
                  setLocalConfig(prev => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="rw-token">Readwise API Token</Label>
              <Input
                id="rw-token"
                type="password"
                value={localConfig.apiToken || ''}
                onChange={e =>
                  setLocalConfig(prev => ({ ...prev, apiToken: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Get your token at{' '}
                <a
                  href="https://readwise.io/access_token"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  readwise.io/access_token
                </a>
              </p>
            </div>

            <div>
              <Label htmlFor="rw-interval">Refresh Interval (minutes)</Label>
              <Input
                id="rw-interval"
                type="number"
                min="0"
                value={localConfig.refreshInterval || 0}
                onChange={e =>
                  setLocalConfig(prev => ({
                    ...prev,
                    refreshInterval: parseInt(e.target.value) || 0,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Set to 0 to disable automatic refresh
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="rw-book-info">Show Book Information</Label>
              <Switch
                id="rw-book-info"
                checked={localConfig.showBookInfo ?? true}
                onCheckedChange={checked =>
                  setLocalConfig(prev => ({ ...prev, showBookInfo: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="rw-tags">Show Tags</Label>
              <Switch
                id="rw-tags"
                checked={localConfig.showTags ?? true}
                onCheckedChange={checked =>
                  setLocalConfig(prev => ({ ...prev, showTags: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <div className="flex justify-between w-full">
              {config?.onDelete && (
                <Button variant="destructive" onClick={config.onDelete}>
                  Delete Widget
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" onClick={handleCancelSettings}>
                  Cancel
                </Button>
                <Button onClick={saveSettings}>Save</Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}>
      <WidgetHeader
        title={isTiny ? undefined : localConfig.title}
        onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
        compact={isTiny}
      />

      {isTiny
        ? renderTiny()
        : isShort
          ? renderShort()
          : isApp
            ? renderApp()
            : isWide && isTall
              ? renderPanel()
              : isCompact
                ? renderCompact()
                : renderDefault()}

      {renderSettingsDialog()}
    </div>
  );
};

export default ReadwiseWidget;
