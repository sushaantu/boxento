import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import WidgetHeader from '../common/WidgetHeader';
import { RivenWidgetConfig, RivenWidgetProps, TMDBResult, RivenItem, RivenStats } from './types';
import { cn } from '@/lib/utils';
import {
  Film,
  Search,
  ExternalLink,
  Plus,
  Loader2,
  Check,
  Star,
  Tv,
  Settings2,
  Clock,
  TrendingUp,
  Library,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Download,
  XCircle,
} from 'lucide-react';

// Default TMDB Read Access Token (same as Riven frontend uses - publicly available)
const DEFAULT_TMDB_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlNTkxMmVmOWFhM2IxNzg2Zjk3ZTE1NWY1YmQ3ZjY1MSIsInN1YiI6IjY1M2NjNWUyZTg5NGE2MDBmZjE2N2FmYyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.xrIXsMFJpI1o1j5g2QpQcFP1X3AfRjFA5FlBFO5Naw8';

const defaultConfig: RivenWidgetConfig = {
  title: 'Riven',
  baseUrl: 'http://localhost:3000',
  apiUrl: 'http://localhost:8080',
  apiKey: '',
  tmdbToken: DEFAULT_TMDB_TOKEN,
};

const RIVEN_CHROME_BADGE_CLASS = 'bg-muted text-foreground';
const RIVEN_CHROME_ICON_CLASS = 'text-muted-foreground';

// State display mapping
const STATE_LABELS: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  Completed: { label: 'Completed', color: 'text-green-600 dark:text-green-400', icon: CheckCircle2 },
  Symlinked: { label: 'Symlinked', color: 'text-green-600 dark:text-green-400', icon: CheckCircle2 },
  Scraped: { label: 'Scraped', color: 'text-blue-600 dark:text-blue-400', icon: Download },
  Scraping: { label: 'Scraping', color: 'text-blue-600 dark:text-blue-400', icon: Download },
  Requested: { label: 'Requested', color: 'text-yellow-600 dark:text-yellow-400', icon: Clock },
  Indexed: { label: 'Indexed', color: 'text-purple-600 dark:text-purple-400', icon: Library },
  Unknown: { label: 'Unknown', color: 'text-muted-foreground', icon: AlertCircle },
  Failed: { label: 'Failed', color: 'text-red-600 dark:text-red-400', icon: XCircle },
};

const getStateInfo = (state: string) =>
  STATE_LABELS[state] || { label: state, color: 'text-muted-foreground', icon: AlertCircle };

const RivenWidget: React.FC<RivenWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<RivenWidgetConfig>({
    ...defaultConfig,
    ...config,
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');

  // Library state (for app mode)
  const [items, setItems] = useState<RivenItem[]>([]);
  const [stats, setStats] = useState<RivenStats | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RivenItem | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'library' | 'stats'>('search');
  const [libraryFilter, setLibraryFilter] = useState<string>('all');
  const [librarySearch, setLibrarySearch] = useState('');

  // Snapshot for settings revert on cancel
  const [configSnapshot, setConfigSnapshot] = useState<RivenWidgetConfig | null>(null);

  useEffect(() => {
    setLocalConfig((prev) => ({ ...prev, ...config }));
  }, [config]);

  const hasApiKey = !!localConfig.apiKey;
  const hasApiUrl = !!localConfig.apiUrl;

  // --- API helpers ---
  const openRiven = () => {
    window.open(localConfig.baseUrl, '_blank', 'noopener,noreferrer');
  };

  const fetchItems = useCallback(async () => {
    if (!hasApiUrl || !hasApiKey) return;
    setLoadingItems(true);
    try {
      const response = await fetch(
        `${localConfig.apiUrl}/api/v1/items?api_key=${localConfig.apiKey}&limit=50&sort=updated_at&desc=true`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!response.ok) throw new Error('Failed to fetch items');
      const data = await response.json();
      setItems(Array.isArray(data) ? data : data.items || data.results || []);
    } catch (err) {
      console.error('Riven items fetch error:', err);
    } finally {
      setLoadingItems(false);
    }
  }, [localConfig.apiUrl, localConfig.apiKey, hasApiUrl, hasApiKey]);

  const fetchStats = useCallback(async () => {
    if (!hasApiUrl || !hasApiKey) return;
    try {
      const response = await fetch(
        `${localConfig.apiUrl}/api/v1/items/stats?api_key=${localConfig.apiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Riven stats fetch error:', err);
    }
  }, [localConfig.apiUrl, localConfig.apiKey, hasApiUrl, hasApiKey]);

  // Fetch library data for larger sizes
  useEffect(() => {
    if ((isApp || (isWide && isTall)) && hasApiKey && hasApiUrl) {
      fetchItems();
      fetchStats();
    }
  }, [isApp, isWide, isTall, hasApiKey, hasApiUrl, fetchItems, fetchStats]);

  // TMDB Search
  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      const endpoint =
        mediaType === 'movie'
          ? `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(searchQuery.trim())}&include_adult=false`
          : `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(searchQuery.trim())}&include_adult=false`;

      const token = localConfig.tmdbToken || DEFAULT_TMDB_TOKEN;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      const results = (data.results || []).map((item: TMDBResult) => ({
        ...item,
        media_type: mediaType,
      }));
      setSearchResults(results.slice(0, 12));
    } catch (err) {
      setError('Search failed');
      console.error('TMDB search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Add to Riven
  const addToRiven = async (item: TMDBResult) => {
    if (!localConfig.apiUrl || !localConfig.apiKey) {
      setError('Configure Riven API key in settings');
      return;
    }

    setAddingId(item.id);
    setError(null);

    try {
      const response = await fetch(
        `${localConfig.apiUrl}/api/v1/items/add?api_key=${localConfig.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tmdb_ids: [item.id.toString()],
            media_type: item.media_type,
          }),
        }
      );

      if (response.status >= 200 && response.status < 300) {
        setAddedIds((prev) => new Set([...prev, item.id]));
        return;
      }

      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || data.detail || `Status ${response.status}`);
    } catch (err) {
      setError('Failed to add to Riven');
      console.error('Riven add error:', err);
    } finally {
      setAddingId(null);
    }
  };

  const getTitle = (item: TMDBResult) => item.title || item.name || 'Unknown';
  const getYear = (item: TMDBResult) => {
    const date = item.release_date || item.first_air_date;
    return date ? date.substring(0, 4) : '';
  };

  // Summary stats for tiny/short
  const totalItems = stats?.total_items ?? items.length;
  const totalMovies = stats?.total_movies ?? items.filter((i) => i.type === 'movie').length;
  const totalShows = stats?.total_shows ?? items.filter((i) => i.type === 'show').length;

  // Filtered library items
  const filteredItems = useMemo(() => {
    let filtered = items;
    if (libraryFilter !== 'all') {
      filtered = filtered.filter((i) => i.state === libraryFilter);
    }
    if (librarySearch.trim()) {
      const q = librarySearch.toLowerCase();
      filtered = filtered.filter((i) => i.title.toLowerCase().includes(q));
    }
    return filtered;
  }, [items, libraryFilter, librarySearch]);

  // Unique states from items for filter
  const availableStates = useMemo(() => {
    const states = new Set(items.map((i) => i.state));
    return Array.from(states).sort();
  }, [items]);

  // --- Settings modal ---
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setConfigSnapshot(null);
    setShowSettings(false);
  };

  const handleSettingsOpenChange = (open: boolean) => {
    if (open) {
      setConfigSnapshot({ ...localConfig });
    } else if (configSnapshot) {
      setLocalConfig(configSnapshot);
      setConfigSnapshot(null);
    }
    setShowSettings(open);
  };

  const handleCancelSettings = () => {
    if (configSnapshot) {
      setLocalConfig(configSnapshot);
      setConfigSnapshot(null);
    }
    setShowSettings(false);
  };

  // --- Setup prompt (no API configured) ---
  const needsSetup = !localConfig.apiUrl && !localConfig.baseUrl;

  if (needsSetup && !isTiny && !isShort) {
    return (
      <div className="widget-container h-full flex flex-col p-2 md:p-3">
        <WidgetHeader
          title={localConfig.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Settings2 className="h-8 w-8" />
          <p className="text-sm">Configure Riven to get started</p>
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

  // --- Search result item ---
  function renderResultItem(item: TMDBResult, compact = false) {
    const isAdding = addingId === item.id;
    const isAdded = addedIds.has(item.id);

    if (compact) {
      return (
        <div
          key={item.id}
          className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
        >
          <div className="w-7 h-10 flex-shrink-0 bg-secondary rounded overflow-hidden">
            {item.poster_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                alt={getTitle(item)}
                className="media-outline w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-grow min-w-0">
            <div className="font-medium text-xs truncate">{getTitle(item)}</div>
            <div className="text-[10px] text-muted-foreground">{getYear(item)}</div>
          </div>
          {!readOnly && (
            <Button
              variant={isAdded ? 'outline' : 'default'}
              size="sm"
              onClick={() => addToRiven(item)}
              disabled={isAdding || isAdded || !hasApiKey}
              className="h-6 w-6 p-0 flex-shrink-0"
            >
              {isAdding ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isAdded ? (
                <Check className="w-3 h-3" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
            </Button>
          )}
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      >
        <div className="w-10 h-14 flex-shrink-0 bg-secondary rounded overflow-hidden">
          {item.poster_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
              alt={getTitle(item)}
              className="media-outline w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-grow min-w-0">
          <div className="font-medium text-sm truncate">{getTitle(item)}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{item.media_type === 'movie' ? 'Movie' : 'TV'}</span>
            {getYear(item) && <span>{getYear(item)}</span>}
            {item.vote_average > 0 && (
              <span className="flex items-center">
                <Star className="w-3 h-3 mr-0.5 text-yellow-500" />
                {item.vote_average.toFixed(1)}
              </span>
            )}
          </div>
          {item.overview && (
            <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.overview}</div>
          )}
        </div>
        {!readOnly && (
          <Button
            variant={isAdded ? 'outline' : 'default'}
            size="sm"
            onClick={() => addToRiven(item)}
            disabled={isAdding || isAdded || !hasApiKey}
            className="flex-shrink-0"
          >
            {isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isAdded ? (
              <Check className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    );
  }

  // --- Library item renderer ---
  function renderLibraryItem(item: RivenItem, compact = false) {
    const stateInfo = getStateInfo(item.state);
    const StateIcon = stateInfo.icon;

    return (
      <div
        key={item._id}
        className={`flex items-center gap-2 rounded-lg hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer ${
          selectedItem?._id === item._id ? 'bg-accent' : ''
        } ${compact ? 'py-1.5 px-2' : 'p-2'}`}
        onClick={() => setSelectedItem(item)}
      >
        <div className={`flex-shrink-0 ${compact ? 'w-5' : 'w-6'}`}>
          {item.type === 'movie' ? (
            <Film className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${RIVEN_CHROME_ICON_CLASS}`} />
          ) : (
            <Tv className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${RIVEN_CHROME_ICON_CLASS}`} />
          )}
        </div>
        <div className="flex-grow min-w-0">
          <div className={`font-medium truncate ${compact ? 'text-xs' : 'text-sm'}`}>{item.title}</div>
          <div className={`flex items-center gap-1 ${stateInfo.color} ${compact ? 'text-[10px]' : 'text-xs'}`}>
            <StateIcon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            <span>{stateInfo.label}</span>
          </div>
        </div>
      </div>
    );
  }

  // --- Search form ---
  function renderSearchForm(compact = false) {
    return (
      <form onSubmit={handleSearch} className={compact ? 'space-y-1' : 'space-y-2'}>
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant={mediaType === 'movie' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setMediaType('movie');
              setSearchResults([]);
            }}
            className={`flex-1 ${compact ? 'h-7 text-[10px]' : 'h-8 text-xs'}`}
          >
            <Film className={compact ? 'w-3 h-3 mr-0.5' : 'w-3 h-3 mr-1'} />
            Movie
          </Button>
          <Button
            type="button"
            variant={mediaType === 'tv' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setMediaType('tv');
              setSearchResults([]);
            }}
            className={`flex-1 ${compact ? 'h-7 text-[10px]' : 'h-8 text-xs'}`}
          >
            <Tv className={compact ? 'w-3 h-3 mr-0.5' : 'w-3 h-3 mr-1'} />
            TV
          </Button>
        </div>
        <div className="flex gap-1.5">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`Search ${mediaType === 'movie' ? 'movies' : 'TV shows'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-8 ${compact ? 'h-7 text-xs' : 'h-8 text-sm'}`}
            />
          </div>
          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={!searchQuery.trim() || searching}
            className={compact ? 'h-7 w-7 p-0' : 'h-8 w-8 p-0'}
          >
            {searching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </form>
    );
  }

  // --- Size-specific renderers ---

  // 1x1 ICON: media count
  const renderTiny = () => (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
      <Film className={`w-4 h-4 ${RIVEN_CHROME_ICON_CLASS}`} />
      <div className="text-lg font-semibold leading-none text-foreground">
        {totalItems || 0}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">media</div>
    </div>
  );

  // Nx1 RIBBON: status + recent items
  const renderShort = () => (
    <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs">
      <Button
        variant="ghost"
        size="sm"
        onClick={openRiven}
        className={`shrink-0 h-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${RIVEN_CHROME_BADGE_CLASS}`}
      >
        <Film className="w-3 h-3" />
        {totalItems} items
      </Button>
      {totalMovies > 0 && (
        <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 text-foreground dark:bg-white/[0.06]">
          {totalMovies} movies
        </span>
      )}
      {totalShows > 0 && (
        <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 text-foreground dark:bg-white/[0.06]">
          {totalShows} shows
        </span>
      )}
      {stats?.states &&
        Object.entries(stats.states)
          .filter(([, count]) => count > 0)
          .slice(0, width - 2)
          .map(([state, count]) => {
            const info = getStateInfo(state);
            return (
              <span key={state} className={`shrink-0 rounded-full bg-black/[0.04] px-2 py-1 dark:bg-white/[0.06] ${info.color}`}>
                {count} {info.label.toLowerCase()}
              </span>
            );
          })}
    </div>
  );

  // 2x2 COMPACT: quick search + link
  const renderCompact = () => (
    <div className="flex-1 flex flex-col overflow-hidden gap-1">
      <Button
        variant="ghost"
        onClick={openRiven}
        className="h-auto flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Film className={`w-4 h-4 ${RIVEN_CHROME_ICON_CLASS}`} />
        </div>
        <div className="text-left min-w-0">
          <div className="text-xs font-semibold truncate">Riven</div>
          <div className="text-[10px] text-muted-foreground">
            {totalItems > 0 ? `${totalItems} items` : 'Media automation'}
          </div>
        </div>
        <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
      </Button>
      {!readOnly && (
        <div className="flex-1 overflow-hidden">
          {renderSearchForm(true)}
          <div className="flex-1 overflow-auto mt-1">
            {searchResults.slice(0, 3).map((item) => renderResultItem(item, true))}
          </div>
        </div>
      )}
    </div>
  );

  // 3x3 DEFAULT: search + results
  const renderDefault = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Film className={`w-4 h-4 ${RIVEN_CHROME_ICON_CLASS}`} />
        </div>
        <div className="flex-grow min-w-0">
          <div className="text-sm font-semibold">Riven</div>
          <div className="text-xs text-muted-foreground">
            {totalItems > 0 ? `${totalMovies} movies, ${totalShows} shows` : 'Media automation'}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={openRiven} className="h-7 w-7 p-0 flex-shrink-0">
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </div>

      {!readOnly && renderSearchForm(false)}

      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
      {!readOnly && !hasApiKey && searchResults.length > 0 && (
        <div className="text-[10px] text-muted-foreground mt-1">Configure API key to add items</div>
      )}

      <div className="flex-1 overflow-auto mt-2 space-y-0.5">
        {searchResults.map((item) => renderResultItem(item, false))}
        {searchResults.length === 0 && !searching && !readOnly && (
          <div className="text-xs text-muted-foreground text-center py-6">
            Search for movies or TV shows to add
          </div>
        )}
        {readOnly && totalItems > 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">
            {totalItems} items in library
          </div>
        )}
      </div>
    </div>
  );

  // 4x4-5x5 PANEL: search + library side-by-side
  const renderPanel = () => (
    <div className="flex flex-1 overflow-hidden gap-0">
      {/* Left: search */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-border/50 pr-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-foreground">Search & Add</div>
          <Button variant="ghost" size="sm" onClick={openRiven} className="h-6 w-6 p-0">
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
        {!readOnly && renderSearchForm(false)}
        {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
        <div className="flex-1 overflow-auto mt-2 space-y-0.5">
          {searchResults.map((item) => renderResultItem(item, false))}
          {searchResults.length === 0 && !searching && (
            <div className="text-xs text-muted-foreground text-center py-6">
              Search TMDB to add media
            </div>
          )}
        </div>
      </div>

      {/* Right: library */}
      <div className="w-2/5 flex flex-col overflow-hidden pl-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-foreground">Library</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchItems}
            disabled={loadingItems}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={`w-3 h-3 ${loadingItems ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {stats && (
          <div className="flex gap-1.5 mb-2 text-[10px]">
            <span className={`rounded-full px-2 py-0.5 ${RIVEN_CHROME_BADGE_CLASS}`}>
              {stats.total_movies} movies
            </span>
            <span className={`rounded-full px-2 py-0.5 ${RIVEN_CHROME_BADGE_CLASS}`}>
              {stats.total_shows} shows
            </span>
          </div>
        )}
        <div className="flex-1 overflow-auto space-y-0.5">
          {loadingItems ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              {hasApiKey ? 'No items yet' : 'Set API key'}
            </div>
          ) : (
            items.slice(0, 20).map((item) => renderLibraryItem(item, true))
          )}
        </div>
      </div>
    </div>
  );

  // 6x6+ APP: full media automation dashboard
  const renderApp = () => (
    <div className="flex flex-col h-full">
      {/* Tab navigation */}
      <div className="flex items-center px-1 mb-2 widget-drag-handle cursor-move">
        {(
          [
            { key: 'search' as const, label: 'Search', icon: Search },
            { key: 'library' as const, label: 'Library', icon: Library },
            { key: 'stats' as const, label: 'Stats', icon: TrendingUp },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.key}
            variant="ghost"
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-none border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={openRiven} className="h-7">
            <ExternalLink className="w-3.5 h-3.5 mr-1" />
            Open Riven
          </Button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'search' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Search panel */}
          <div className="w-2/5 flex flex-col border-r border-border/50 pr-3 overflow-hidden">
            {!readOnly && renderSearchForm(false)}
            {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
            {!readOnly && !hasApiKey && searchResults.length > 0 && (
              <div className="text-[10px] text-muted-foreground mt-1">Configure API key to add items</div>
            )}
            <div className="flex-1 overflow-auto mt-2 space-y-0.5">
              {searchResults.map((item) => renderResultItem(item, false))}
              {searchResults.length === 0 && !searching && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Search for movies or TV shows
                </div>
              )}
            </div>
          </div>

          {/* Detail panel */}
          <div className="flex-1 overflow-auto pl-3">
            {searchResults.length > 0 && searchResults[0] ? (
              <div className="space-y-3">
                <div className="flex gap-4">
                  <div className="w-24 h-36 flex-shrink-0 bg-secondary rounded-lg overflow-hidden">
                    {searchResults[0].poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${searchResults[0].poster_path}`}
                        alt={getTitle(searchResults[0])}
                        className="media-outline w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">{getTitle(searchResults[0])}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <span>{searchResults[0].media_type === 'movie' ? 'Movie' : 'TV Show'}</span>
                      {getYear(searchResults[0]) && <span>{getYear(searchResults[0])}</span>}
                      {searchResults[0].vote_average > 0 && (
                        <span className="flex items-center">
                          <Star className="w-4 h-4 mr-0.5 text-yellow-500" />
                          {searchResults[0].vote_average.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-4">
                      {searchResults[0].overview || 'No description available.'}
                    </p>
                    {!readOnly && (
                      <Button
                        className="mt-3"
                        size="sm"
                        onClick={() => addToRiven(searchResults[0])}
                        disabled={addingId === searchResults[0].id || addedIds.has(searchResults[0].id) || !hasApiKey}
                      >
                        {addingId === searchResults[0].id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : addedIds.has(searchResults[0].id) ? (
                          <Check className="w-4 h-4 mr-1" />
                        ) : (
                          <Plus className="w-4 h-4 mr-1" />
                        )}
                        {addedIds.has(searchResults[0].id) ? 'Added' : 'Add to Riven'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Film className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Search results will appear here</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'library' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Master list */}
          <div className="w-1/3 flex flex-col border-r border-border/50 overflow-hidden">
            <div className="p-2 border-b border-border/50 space-y-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter library..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="h-8 text-sm pl-8"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-auto px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                    libraryFilter === 'all'
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                  onClick={() => setLibraryFilter('all')}
                >
                  All ({items.length})
                </Button>
                {availableStates.map((state) => {
                  const info = getStateInfo(state);
                  const count = items.filter((i) => i.state === state).length;
                  return (
                    <Button
                      key={state}
                      variant="ghost"
                      size="sm"
                      className={`h-auto px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                        libraryFilter === state
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                      onClick={() => setLibraryFilter(state)}
                    >
                      {info.label} ({count})
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 text-[10px] text-muted-foreground">
              <span>{filteredItems.length} items</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchItems}
                disabled={loadingItems}
                className="h-5 w-5 p-0"
              >
                <RefreshCw className={`w-3 h-3 ${loadingItems ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              {loadingItems ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {hasApiKey ? 'No items found' : 'Configure API key to view library'}
                </div>
              ) : (
                filteredItems.map((item) => renderLibraryItem(item, false))
              )}
            </div>
          </div>

          {/* Detail pane */}
          <div className="flex-1 overflow-auto p-4">
            {selectedItem ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  {selectedItem.type === 'movie' ? (
                    <Film className={`w-8 h-8 ${RIVEN_CHROME_ICON_CLASS} flex-shrink-0`} />
                  ) : (
                    <Tv className={`w-8 h-8 ${RIVEN_CHROME_ICON_CLASS} flex-shrink-0`} />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">{selectedItem.title}</h3>
                    <div className="text-sm text-muted-foreground capitalize">{selectedItem.type}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-black/[0.02] dark:bg-white/[0.03] p-3">
                    <div className="text-xs text-muted-foreground mb-1">State</div>
                    <div className={`font-medium flex items-center gap-1.5 ${getStateInfo(selectedItem.state).color}`}>
                      {React.createElement(getStateInfo(selectedItem.state).icon, { className: 'w-4 h-4' })}
                      {getStateInfo(selectedItem.state).label}
                    </div>
                  </div>
                  <div className="rounded-lg bg-black/[0.02] dark:bg-white/[0.03] p-3">
                    <div className="text-xs text-muted-foreground mb-1">Type</div>
                    <div className="font-medium capitalize">{selectedItem.type}</div>
                  </div>
                  {selectedItem.imdb_id && (
                    <div className="rounded-lg bg-black/[0.02] dark:bg-white/[0.03] p-3">
                      <div className="text-xs text-muted-foreground mb-1">IMDB</div>
                      <div className="font-medium font-mono text-xs">{selectedItem.imdb_id}</div>
                    </div>
                  )}
                  {selectedItem.tmdb_id && (
                    <div className="rounded-lg bg-black/[0.02] dark:bg-white/[0.03] p-3">
                      <div className="text-xs text-muted-foreground mb-1">TMDB</div>
                      <div className="font-medium font-mono text-xs">{selectedItem.tmdb_id}</div>
                    </div>
                  )}
                  {selectedItem.requested_at && (
                    <div className="rounded-lg bg-black/[0.02] dark:bg-white/[0.03] p-3 col-span-2">
                      <div className="text-xs text-muted-foreground mb-1">Requested</div>
                      <div className="font-medium text-xs">
                        {new Date(selectedItem.requested_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {selectedItem.updated_at && (
                    <div className="rounded-lg bg-black/[0.02] dark:bg-white/[0.03] p-3 col-span-2">
                      <div className="text-xs text-muted-foreground mb-1">Last Updated</div>
                      <div className="font-medium text-xs">
                        {new Date(selectedItem.updated_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Library className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Select an item to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="flex-1 overflow-auto p-3">
          {stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-muted p-4 text-center">
                  <div className="text-3xl font-bold text-foreground">{stats.total_items}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Items</div>
                </div>
                <div className="rounded-xl bg-muted p-4 text-center">
                  <div className="text-3xl font-bold text-foreground">
                    {stats.total_movies}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Movies</div>
                </div>
                <div className="rounded-xl bg-muted p-4 text-center">
                  <div className="text-3xl font-bold text-foreground">
                    {stats.total_shows}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">TV Shows</div>
                </div>
              </div>

              {stats.states && Object.keys(stats.states).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Items by State</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(stats.states)
                      .sort(([, a], [, b]) => b - a)
                      .map(([state, count]) => {
                        const info = getStateInfo(state);
                        const StateIcon = info.icon;
                        const pct = stats.total_items > 0 ? (count / stats.total_items) * 100 : 0;
                        return (
                          <div key={state} className="rounded-lg bg-black/[0.02] dark:bg-white/[0.03] p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className={`flex items-center gap-1.5 text-sm font-medium ${info.color}`}>
                                <StateIcon className="w-4 h-4" />
                                {info.label}
                              </div>
                              <span className="text-sm font-semibold">{count}</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-1.5">
                              <div
                                className="bg-current rounded-full h-1.5 transition-all"
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              {hasApiKey ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <p className="text-sm">Loading stats...</p>
                </>
              ) : (
                <>
                  <TrendingUp className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Configure API key to view stats</p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // --- Settings dialog ---
  function renderSettingsDialog() {
    return (
      <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
        <DialogContent className="settings-dialog-content sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{localConfig.title || 'Riven'} Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="riven-title">Title</Label>
              <Input
                id="riven-title"
                value={localConfig.title || ''}
                onChange={(e) => setLocalConfig((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="riven-base-url">Riven Frontend URL</Label>
              <Input
                id="riven-base-url"
                type="url"
                value={localConfig.baseUrl || ''}
                onChange={(e) => setLocalConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="http://localhost:3000"
              />
            </div>

            <div>
              <Label htmlFor="riven-api-url">Riven API URL</Label>
              <Input
                id="riven-api-url"
                type="url"
                value={localConfig.apiUrl || ''}
                onChange={(e) => setLocalConfig((prev) => ({ ...prev, apiUrl: e.target.value }))}
                placeholder="http://localhost:8080"
              />
              <p className="text-xs text-muted-foreground mt-1">Backend API URL for searching and adding media</p>
            </div>

            <div>
              <Label htmlFor="riven-api-key">Riven API Key</Label>
              <Input
                id="riven-api-key"
                type="password"
                value={localConfig.apiKey || ''}
                onChange={(e) => setLocalConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Your Riven API key"
              />
              <p className="text-xs text-muted-foreground mt-1">Generate from Riven Settings &rarr; General</p>
            </div>

            <div>
              <Label htmlFor="riven-tmdb-token">TMDB Token (optional)</Label>
              <Input
                id="riven-tmdb-token"
                type="password"
                value={localConfig.tmdbToken || ''}
                onChange={(e) => setLocalConfig((prev) => ({ ...prev, tmdbToken: e.target.value }))}
                placeholder="Uses default public token if empty"
              />
              <p className="text-xs text-muted-foreground mt-1">Custom TMDB read access token for search</p>
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
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      <div className={`flex-grow overflow-hidden ${isTiny ? 'p-2' : ''}`}>
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
      </div>

      {!readOnly && renderSettingsDialog()}
    </div>
  );
};

export default RivenWidget;
