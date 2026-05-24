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
import {
  JellyfinWidgetConfig,
  JellyfinWidgetProps,
  JellyfinItem,
  JellyfinSession,
  JellyfinLibrary,
} from './types';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  Film,
  Tv,
  Music,
  Loader2,
  AlertCircle,
  Settings,
  ExternalLink,
  Library,
  Search,
  ArrowLeft,
  Clock,
  MonitorPlay,
} from 'lucide-react';

const defaultConfig: JellyfinWidgetConfig = {
  title: 'Jellyfin',
  baseUrl: 'http://localhost:8096',
  apiKey: '',
  userId: '',
  refreshInterval: 30,
};

const JellyfinWidget: React.FC<JellyfinWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<JellyfinWidgetConfig>({
    ...defaultConfig,
    ...config,
  });
  const [settingsSnapshot, setSettingsSnapshot] = useState<JellyfinWidgetConfig>(localConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<JellyfinSession[]>([]);
  const [recentItems, setRecentItems] = useState<JellyfinItem[]>([]);
  const [libraries, setLibraries] = useState<JellyfinLibrary[]>([]);
  const [libraryItems, setLibraryItems] = useState<JellyfinItem[]>([]);

  // App-mode state
  const [activeTab, setActiveTab] = useState<'playing' | 'recent' | 'libraries'>('playing');
  const [selectedLibrary, setSelectedLibrary] = useState<JellyfinLibrary | null>(null);
  const [selectedItem, setSelectedItem] = useState<JellyfinItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<JellyfinItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  const needsConfig = !localConfig.apiKey;

  const headers = useMemo(
    () => ({ 'X-Emby-Token': localConfig.apiKey || '' }),
    [localConfig.apiKey]
  );

  // --- Data fetching ---

  const fetchData = useCallback(async () => {
    if (!localConfig.apiKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch active sessions
      const sessionsRes = await fetch(`${localConfig.baseUrl}/Sessions`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!sessionsRes.ok) throw new Error('Failed to fetch sessions');
      const sessionsData = await sessionsRes.json();
      setSessions(sessionsData.filter((s: JellyfinSession) => s.NowPlayingItem));

      // Auto-detect userId if not set
      let userId = localConfig.userId;
      if (!userId) {
        try {
          const usersRes = await fetch(`${localConfig.baseUrl}/Users`, {
            headers,
            signal: AbortSignal.timeout(8000),
          });
          if (usersRes.ok) {
            const users = await usersRes.json();
            if (users.length > 0) {
              userId = users[0].Id;
              // Persist auto-detected userId
              const updated = { ...localConfig, userId };
              setLocalConfig(updated);
              if (config?.onUpdate) config.onUpdate(updated);
            }
          }
        } catch {
          // non-critical
        }
      }

      // Fetch recently added
      if (userId) {
        const recentRes = await fetch(
          `${localConfig.baseUrl}/Users/${userId}/Items/Latest?Limit=12&Fields=Overview`,
          { headers, signal: AbortSignal.timeout(8000) }
        );
        if (recentRes.ok) {
          setRecentItems(await recentRes.json());
        }
      }

      // Fetch libraries (for app mode)
      if (isApp || (isWide && isTall)) {
        try {
          const libRes = await fetch(
            `${localConfig.baseUrl}/Library/VirtualFolders`,
            { headers, signal: AbortSignal.timeout(8000) }
          );
          if (libRes.ok) {
            setLibraries(await libRes.json());
          }
        } catch {
          // non-critical
        }
      }
    } catch (err) {
      setError('Cannot connect to Jellyfin');
      console.error('Jellyfin API error:', err);
    } finally {
      setLoading(false);
    }
  }, [localConfig.baseUrl, localConfig.apiKey, localConfig.userId, headers, isApp, isWide, isTall, config]);

  // Fetch on mount and interval
  useEffect(() => {
    if (!needsConfig) {
      fetchData();
      const interval = setInterval(fetchData, (localConfig.refreshInterval || 30) * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchData, localConfig.refreshInterval, needsConfig]);

  // Fetch library items when a library is selected
  const fetchLibraryItems = useCallback(
    async (library: JellyfinLibrary) => {
      if (!localConfig.userId) return;
      try {
        const res = await fetch(
          `${localConfig.baseUrl}/Users/${localConfig.userId}/Items?ParentId=${library.ItemId}&Limit=30&Fields=Overview&SortBy=DateCreated&SortOrder=Descending`,
          { headers, signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) {
          const data = await res.json();
          setLibraryItems(data.Items || []);
        }
      } catch {
        setLibraryItems([]);
      }
    },
    [localConfig.baseUrl, localConfig.userId, headers]
  );

  useEffect(() => {
    if (selectedLibrary) {
      fetchLibraryItems(selectedLibrary);
    }
  }, [selectedLibrary, fetchLibraryItems]);

  // Search
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || !localConfig.userId) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(
          `${localConfig.baseUrl}/Users/${localConfig.userId}/Items?SearchTerm=${encodeURIComponent(query)}&Limit=20&Fields=Overview&Recursive=true&IncludeItemTypes=Movie,Series,Episode,Audio,MusicAlbum`,
          { headers, signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.Items || []);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [localConfig.baseUrl, localConfig.userId, headers]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery) handleSearch(searchQuery);
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, handleSearch]);

  // --- Helpers ---

  const getItemIcon = (type: string, size = 'w-4 h-4') => {
    switch (type) {
      case 'Movie':
        return <Film className={size} />;
      case 'Episode':
      case 'Series':
        return <Tv className={size} />;
      case 'Audio':
      case 'MusicAlbum':
        return <Music className={size} />;
      default:
        return <Film className={size} />;
    }
  };

  const getLibraryIcon = (collectionType?: string) => {
    switch (collectionType) {
      case 'movies':
        return <Film className="w-4 h-4" />;
      case 'tvshows':
        return <Tv className="w-4 h-4" />;
      case 'music':
        return <Music className="w-4 h-4" />;
      default:
        return <Library className="w-4 h-4" />;
    }
  };

  const getImageUrl = (item: JellyfinItem, maxWidth = 200): string | null => {
    if (!item.ImageTags?.Primary || !localConfig.baseUrl) return null;
    try {
      const baseUrl = new URL(localConfig.baseUrl);
      const imagePath = `/Items/${encodeURIComponent(item.Id)}/Images/Primary`;
      const imageUrl = new URL(imagePath, baseUrl);
      imageUrl.searchParams.set('maxWidth', String(maxWidth));
      imageUrl.searchParams.set('tag', item.ImageTags.Primary);
      if (localConfig.apiKey) {
        imageUrl.searchParams.set('api_key', localConfig.apiKey);
      }
      return imageUrl.href;
    } catch {
      return null;
    }
  };

  const formatRuntime = (ticks?: number) => {
    if (!ticks) return '';
    const minutes = Math.round(ticks / 600000000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatProgress = (position?: number, total?: number) => {
    if (!position || !total || total === 0) return null;
    return Math.round((position / total) * 100);
  };

  const openJellyfin = () => {
    window.open(localConfig.baseUrl, '_blank', 'noopener,noreferrer');
  };

  const activeSessions = sessions.filter(s => s.NowPlayingItem);

  // --- Needs config view ---

  const renderNeedsConfig = () => {
    if (isTiny) {
      const setupIcon = <Settings className="h-5 w-5 text-muted-foreground" />;

      if (readOnly) {
        return (
          <div className="flex flex-1 items-center justify-center">
            {setupIcon}
          </div>
        );
      }

      return (
        <button
          type="button"
          className="flex flex-1 items-center justify-center rounded-md"
          onClick={() => setShowSettings(true)}
          aria-label="Open Jellyfin settings"
        >
          {setupIcon}
        </button>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Settings className="h-8 w-8" />
        <p className="text-sm">Configure Jellyfin to get started</p>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            Open Settings
          </Button>
        )}
      </div>
    );
  };

  // --- Loading / Error states ---

  const renderLoading = () => (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  const renderError = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-2">
      <AlertCircle className="w-6 h-6 text-red-500" />
      <span className="text-xs text-red-500">{error}</span>
      <Button variant="outline" size="sm" onClick={fetchData}>
        Retry
      </Button>
    </div>
  );

  // --- Size-specific renderers ---

  // 1x1 ICON: play icon with now-playing pulse indicator
  const renderTiny = () => {
    const hasActive = activeSessions.length > 0;
    const isPaused = hasActive && activeSessions.every(s => s.PlayState?.IsPaused);

    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <div className="relative">
          {hasActive ? (
            isPaused ? (
              <Pause className="w-5 h-5 text-purple-500" />
            ) : (
              <Play className="w-5 h-5 text-purple-500" />
            )
          ) : (
            <Film className="w-5 h-5 text-muted-foreground" />
          )}
          {hasActive && !isPaused && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground leading-none">
          {hasActive ? `${activeSessions.length} playing` : 'idle'}
        </span>
      </div>
    );
  };

  // Nx1 RIBBON: now playing title + status badges
  const renderShort = () => {
    const nowPlaying = activeSessions[0];

    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs">
        {/* Status badge */}
        <span className="shrink-0 rounded-full bg-purple-500/10 px-2 py-1 font-medium text-purple-700 dark:text-purple-300">
          {activeSessions.length > 0
            ? `${activeSessions.length} playing`
            : 'idle'}
        </span>

        {/* Now playing chip */}
        {nowPlaying && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-foreground">
            {nowPlaying.PlayState?.IsPaused ? (
              <Pause className="h-3 w-3 text-purple-500" />
            ) : (
              <Play className="h-3 w-3 text-green-500" />
            )}
            <span className="max-w-[10rem] truncate">
              {nowPlaying.NowPlayingItem?.SeriesName || nowPlaying.NowPlayingItem?.Name}
            </span>
          </div>
        )}

        {/* Recent count */}
        {recentItems.length > 0 && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-muted-foreground">
            {recentItems.length} recent
          </span>
        )}

        {/* Additional sessions */}
        {activeSessions.slice(1, Math.max(2, width - 1)).map(session => (
          <div
            key={session.Id}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-foreground"
          >
            {session.PlayState?.IsPaused ? (
              <Pause className="h-3 w-3 text-purple-500" />
            ) : (
              <Play className="h-3 w-3 text-green-500" />
            )}
            <span className="max-w-[8rem] truncate">
              {session.NowPlayingItem?.SeriesName || session.NowPlayingItem?.Name}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Now Playing session card (shared across sizes)
  const renderSessionCard = (session: JellyfinSession, compact = false) => {
    const item = session.NowPlayingItem;
    if (!item) return null;
    const progress = formatProgress(session.PlayState?.PositionTicks, item.RunTimeTicks);

    return (
      <div
        key={session.Id}
        className={`flex items-center gap-2 ${compact ? 'p-1.5' : 'p-2'} bg-purple-50 dark:bg-purple-900/20 rounded-lg`}
      >
        {session.PlayState?.IsPaused ? (
          <Pause className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-purple-500 flex-shrink-0`} />
        ) : (
          <Play className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-purple-500 flex-shrink-0`} />
        )}
        <div className="flex-grow min-w-0">
          <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium truncate`}>
            {item.SeriesName || item.Name}
          </div>
          {item.SeriesName && !compact && (
            <div className="text-xs text-muted-foreground truncate">
              S{item.ParentIndexNumber} E{item.IndexNumber} - {item.Name}
            </div>
          )}
          {!compact && (
            <div className="text-xs text-muted-foreground">
              {session.UserName} {progress !== null ? `\u00B7 ${progress}%` : ''}
            </div>
          )}
        </div>
        {progress !== null && (
          <div className={`${compact ? 'w-8' : 'w-12'} h-1 rounded-full bg-secondary flex-shrink-0`}>
            <div
              className="h-full rounded-full bg-purple-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  // Recent item card (shared across sizes)
  const renderItemCard = (item: JellyfinItem, compact = false) => {
    const imgUrl = getImageUrl(item, compact ? 100 : 200);

    return (
      <div
        key={item.Id}
        className={`flex items-center gap-2 ${compact ? 'p-1.5' : 'p-2'} bg-black/[0.02] dark:bg-white/[0.03] rounded-lg`}
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={item.Name}
            className={`media-outline ${compact ? 'w-8 h-11' : 'w-10 h-14'} object-cover rounded flex-shrink-0`}
          />
        ) : (
          <div
            className={`${compact ? 'w-8 h-11' : 'w-10 h-14'} bg-muted rounded flex items-center justify-center flex-shrink-0`}
          >
            {getItemIcon(item.Type)}
          </div>
        )}
        <div className="flex-grow min-w-0">
          <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium truncate`}>
            {item.SeriesName || item.Name}
          </div>
          {item.SeriesName && !compact && (
            <div className="text-xs text-muted-foreground truncate">
              S{item.ParentIndexNumber} E{item.IndexNumber}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {item.ProductionYear}{item.RunTimeTicks ? ` \u00B7 ${formatRuntime(item.RunTimeTicks)}` : ''}
          </div>
        </div>
      </div>
    );
  };

  // Compact view (2x2 micro-widget): now playing or idle icon + recent count
  const renderCompact = () => (
    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
      {activeSessions.length > 0 ? (
        <div className="flex-1 overflow-auto space-y-1">
          {activeSessions.slice(0, 2).map(s => renderSessionCard(s, true))}
        </div>
      ) : (
        <Button type="button" variant="ghost" size="none"
          onClick={openJellyfin}
          className="flex-1 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-accent transition-colors"
        >
          <Film className="w-6 h-6 text-purple-500" />
          <span className="text-xs text-muted-foreground">Nothing playing</span>
        </Button>
      )}
      {recentItems.length > 0 && (
        <div className="text-[10px] text-muted-foreground text-center">
          {recentItems.length} recently added
        </div>
      )}
    </div>
  );

  // Default view (3x3 widget): now playing + recently added list
  const renderDefault = () => (
    <div className="flex-1 flex flex-col overflow-hidden gap-2">
      {/* Now Playing section */}
      {activeSessions.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1 px-1">Now Playing</div>
          <div className="space-y-1.5">
            {activeSessions.map(s => renderSessionCard(s))}
          </div>
        </div>
      )}

      {/* Recently Added */}
      {recentItems.length > 0 && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="text-xs text-muted-foreground mb-1 px-1">Recently Added</div>
          <div className="flex-1 overflow-auto space-y-1.5">
            {recentItems.slice(0, 4).map(item => renderItemCard(item))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeSessions.length === 0 && recentItems.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Film className="w-8 h-8" />
          <span className="text-sm">No activity</span>
        </div>
      )}

      {/* Open Jellyfin link */}
      <Button variant="outline" size="sm" className="w-full" onClick={openJellyfin}>
        <ExternalLink className="w-3 h-3 mr-1" />
        Open Jellyfin
      </Button>
    </div>
  );

  // Panel view (4x4-5x5): split now playing + recent with more items
  const renderPanel = () => (
    <div className="flex flex-1 overflow-hidden gap-2">
      {/* Left: Now Playing + Open button */}
      <div className="w-2/5 flex flex-col overflow-hidden">
        <div className="text-xs font-medium text-muted-foreground mb-1 px-1 flex items-center gap-1">
          <MonitorPlay className="w-3 h-3" /> Now Playing
        </div>
        <div className="flex-1 overflow-auto space-y-1.5">
          {activeSessions.length > 0 ? (
            activeSessions.map(s => renderSessionCard(s))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-1">
              <Film className="w-6 h-6" />
              <span className="text-xs">Nothing playing</span>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={openJellyfin}>
          <ExternalLink className="w-3 h-3 mr-1" />
          Open Jellyfin
        </Button>
      </div>

      {/* Right: Recently Added */}
      <div className="flex-1 flex flex-col border-l border-border pl-2 overflow-hidden">
        <div className="text-xs font-medium text-muted-foreground mb-1 px-1 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Recently Added
        </div>
        <div className="flex-1 overflow-auto space-y-1.5">
          {recentItems.length > 0 ? (
            recentItems.slice(0, 8).map(item => renderItemCard(item))
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
              No recent items
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Item detail view for app mode
  const renderItemDetail = (item: JellyfinItem) => {
    const imgUrl = getImageUrl(item, 400);

    return (
      <div className="p-4 space-y-4">
        <Button type="button" variant="ghost" size="none"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setSelectedItem(null)}
        >
          <ArrowLeft className="w-3 h-3" /> Back
        </Button>

        <div className="flex gap-4">
          {imgUrl ? (
            <img src={imgUrl} alt={item.Name} className="media-outline w-28 h-40 object-cover rounded-lg flex-shrink-0" />
          ) : (
            <div className="w-28 h-40 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
              {getItemIcon(item.Type, 'w-8 h-8')}
            </div>
          )}
          <div className="min-w-0 space-y-2">
            <h3 className="text-lg font-semibold truncate">{item.SeriesName || item.Name}</h3>
            {item.SeriesName && (
              <p className="text-sm text-muted-foreground">
                S{item.ParentIndexNumber} E{item.IndexNumber} - {item.Name}
              </p>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {getItemIcon(item.Type, 'w-3 h-3')} {item.Type}
              </span>
              {item.ProductionYear && <span>{item.ProductionYear}</span>}
              {item.RunTimeTicks && <span>{formatRuntime(item.RunTimeTicks)}</span>}
            </div>
            {item.UserData?.PlayedPercentage != null && item.UserData.PlayedPercentage > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  {Math.round(item.UserData.PlayedPercentage)}% watched
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{ width: `${item.UserData.PlayedPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {item.Overview && (
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Overview</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.Overview}</p>
          </div>
        )}
      </div>
    );
  };

  // App view (6x6+): full media browser with tabbed navigation
  const renderApp = () => {
    return (
      <div className="flex h-full">
        {/* Sidebar / Master */}
        <div className="w-1/3 border-r border-border flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-2 widget-drag-handle cursor-move">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search media..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Tabs */}
          {!searchQuery && (
            <div className="flex border-b border-border">
              {[
                { id: 'playing' as const, label: 'Playing', icon: MonitorPlay },
                { id: 'recent' as const, label: 'Recent', icon: Clock },
                { id: 'libraries' as const, label: 'Libraries', icon: Library },
              ].map(tab => {
                const TabIcon = tab.icon;
                return (
                  <Button type="button" variant="ghost" size="none"
                    key={tab.id}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs transition-colors ${
                      activeTab === tab.id
                        ? 'border-b-2 border-purple-500 font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSelectedItem(null);
                      setSelectedLibrary(null);
                    }}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.id === 'playing' && activeSessions.length > 0 && (
                      <span className="rounded-full bg-purple-500/20 px-1.5 text-[10px] text-purple-600 dark:text-purple-300">
                        {activeSessions.length}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Sidebar content */}
          <div className="flex-1 overflow-auto">
            {searchQuery ? (
              searching ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map(item => (
                  <Button type="button" variant="ghost" size="none"
                    key={item.Id}
                    className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/50 ${
                      selectedItem?.Id === item.Id ? 'bg-accent' : ''
                    }`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex items-center gap-2">
                      {getItemIcon(item.Type, 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0')}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{item.SeriesName || item.Name}</div>
                        <div className="text-xs text-muted-foreground">{item.Type} {item.ProductionYear ? `\u00B7 ${item.ProductionYear}` : ''}</div>
                      </div>
                    </div>
                  </Button>
                ))
              ) : (
                <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                  No results
                </div>
              )
            ) : activeTab === 'playing' ? (
              activeSessions.length > 0 ? (
                activeSessions.map(session => (
                  <Button type="button" variant="ghost" size="none"
                    key={session.Id}
                    className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/50 ${
                      selectedItem?.Id === session.NowPlayingItem?.Id ? 'bg-accent' : ''
                    }`}
                    onClick={() => session.NowPlayingItem && setSelectedItem(session.NowPlayingItem)}
                  >
                    <div className="flex items-center gap-2">
                      {session.PlayState?.IsPaused ? (
                        <Pause className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {session.NowPlayingItem?.SeriesName || session.NowPlayingItem?.Name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {session.UserName} on {session.DeviceName}
                        </div>
                      </div>
                    </div>
                  </Button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-4">
                  <MonitorPlay className="w-8 h-8" />
                  <span className="text-sm">Nothing is playing</span>
                </div>
              )
            ) : activeTab === 'recent' ? (
              recentItems.length > 0 ? (
                recentItems.map(item => (
                  <Button type="button" variant="ghost" size="none"
                    key={item.Id}
                    className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/50 ${
                      selectedItem?.Id === item.Id ? 'bg-accent' : ''
                    }`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex items-center gap-2">
                      {getItemIcon(item.Type, 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0')}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{item.SeriesName || item.Name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.ProductionYear}{item.RunTimeTicks ? ` \u00B7 ${formatRuntime(item.RunTimeTicks)}` : ''}
                        </div>
                      </div>
                    </div>
                  </Button>
                ))
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  No recent items
                </div>
              )
            ) : /* libraries tab */ (
              selectedLibrary ? (
                <>
                  <Button type="button" variant="ghost" size="none"
                    className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 border-b border-border"
                    onClick={() => {
                      setSelectedLibrary(null);
                      setLibraryItems([]);
                      setSelectedItem(null);
                    }}
                  >
                    <ArrowLeft className="w-3 h-3" /> All Libraries
                  </Button>
                  {libraryItems.map(item => (
                    <Button type="button" variant="ghost" size="none"
                      key={item.Id}
                      className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/50 ${
                        selectedItem?.Id === item.Id ? 'bg-accent' : ''
                      }`}
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="flex items-center gap-2">
                        {getItemIcon(item.Type, 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0')}
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{item.Name}</div>
                          <div className="text-xs text-muted-foreground">{item.ProductionYear || item.Type}</div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </>
              ) : (
                libraries.map(lib => (
                  <Button type="button" variant="ghost" size="none"
                    key={lib.ItemId}
                    className="w-full text-left px-3 py-3 hover:bg-accent transition-colors border-b border-border/50 flex items-center gap-3"
                    onClick={() => setSelectedLibrary(lib)}
                  >
                    {getLibraryIcon(lib.CollectionType)}
                    <div>
                      <div className="text-sm font-medium">{lib.Name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {lib.CollectionType || 'mixed'}
                      </div>
                    </div>
                  </Button>
                ))
              )
            )}
          </div>
        </div>

        {/* Detail pane */}
        <div className="flex-1 overflow-auto">
          {selectedItem ? (
            renderItemDetail(selectedItem)
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Film className="w-12 h-12" />
              <p className="text-sm">Select an item to view details</p>
              <Button variant="outline" size="sm" onClick={openJellyfin}>
                <ExternalLink className="w-3 h-3 mr-1" />
                Open Jellyfin
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Main content dispatcher ---

  const renderContent = () => {
    if (needsConfig) return renderNeedsConfig();
    if (loading && sessions.length === 0 && recentItems.length === 0) return renderLoading();
    if (error) return renderError();

    if (isTiny) return renderTiny();
    if (isShort) return renderShort();
    if (isApp) return renderApp();
    if (isWide && isTall) return renderPanel();
    if (isCompact) return renderCompact();
    return renderDefault();
  };

  // --- Settings modal ---

  const handleSettingsOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSettingsSnapshot({ ...localConfig });
    } else {
      // Revert to snapshot on close (cancel)
      setLocalConfig(settingsSnapshot);
    }
    setShowSettings(nextOpen);
  };

  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  };

  const cancelSettings = () => {
    setLocalConfig(settingsSnapshot);
    setShowSettings(false);
  };

  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}>
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      <div className={`flex-1 overflow-hidden flex flex-col ${isTiny ? 'p-1' : ''}`}>
        {renderContent()}
      </div>

      {/* Settings Modal */}
      {!readOnly && (
        <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
          <DialogContent className="settings-dialog-content sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{localConfig.title || 'Jellyfin'} Settings</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="jf-title">Title</Label>
                <Input
                  id="jf-title"
                  value={localConfig.title || ''}
                  onChange={e =>
                    setLocalConfig(prev => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="jf-url">Jellyfin URL</Label>
                <Input
                  id="jf-url"
                  type="url"
                  value={localConfig.baseUrl || ''}
                  onChange={e =>
                    setLocalConfig(prev => ({ ...prev, baseUrl: e.target.value }))
                  }
                  placeholder="http://localhost:8096"
                />
              </div>

              <div>
                <Label htmlFor="jf-apikey">API Key *</Label>
                <Input
                  id="jf-apikey"
                  type="password"
                  value={localConfig.apiKey || ''}
                  onChange={e =>
                    setLocalConfig(prev => ({ ...prev, apiKey: e.target.value }))
                  }
                  placeholder="Your Jellyfin API key"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get your API key from Jellyfin Dashboard &rarr; API Keys
                </p>
              </div>

              <div>
                <Label htmlFor="jf-userid">User ID (optional)</Label>
                <Input
                  id="jf-userid"
                  value={localConfig.userId || ''}
                  onChange={e =>
                    setLocalConfig(prev => ({ ...prev, userId: e.target.value }))
                  }
                  placeholder="Auto-detected if not set"
                />
              </div>

              <div>
                <Label htmlFor="jf-interval">Refresh interval (seconds)</Label>
                <Input
                  id="jf-interval"
                  type="number"
                  min={5}
                  max={300}
                  value={localConfig.refreshInterval || 30}
                  onChange={e =>
                    setLocalConfig(prev => ({
                      ...prev,
                      refreshInterval: parseInt(e.target.value) || 30,
                    }))
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
                  <Button variant="outline" onClick={cancelSettings}>
                    Cancel
                  </Button>
                  <Button onClick={saveSettings}>Save</Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default JellyfinWidget;
