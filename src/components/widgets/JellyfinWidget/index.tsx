import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import WidgetHeader from '../common/WidgetHeader';
import { JellyfinWidgetConfig, JellyfinWidgetProps, JellyfinItem, JellyfinSession } from './types';
import {
  Play,
  Pause,
  Film,
  Tv,
  Music,
  Loader2,
  AlertCircle,
  Settings,
  ExternalLink
} from 'lucide-react';

const JellyfinWidget: React.FC<JellyfinWidgetProps> = ({ width, height, config }) => {
  const defaultConfig: JellyfinWidgetConfig = {
    title: 'Jellyfin',
    baseUrl: 'https://mini.tailf2415.ts.net:8096',
    apiKey: '',
    userId: '',
    refreshInterval: 30
  };

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<JellyfinWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<JellyfinSession[]>([]);
  const [recentItems, setRecentItems] = useState<JellyfinItem[]>([]);
  const [needsConfig, setNeedsConfig] = useState<boolean>(false);

  // Update local config when props change
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Check if we have required config
  useEffect(() => {
    setNeedsConfig(!localConfig.apiKey);
  }, [localConfig.apiKey]);

  // Fetch data from Jellyfin
  const fetchData = useCallback(async () => {
    if (!localConfig.apiKey) {
      setNeedsConfig(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const headers = {
      'X-Emby-Token': localConfig.apiKey
    };

    try {
      // Fetch active sessions
      const sessionsRes = await fetch(`${localConfig.baseUrl}/Sessions`, { headers });
      if (!sessionsRes.ok) throw new Error('Failed to fetch sessions');
      const sessionsData = await sessionsRes.json();
      setSessions(sessionsData.filter((s: JellyfinSession) => s.NowPlayingItem));

      // Fetch recently added if we have a userId
      if (localConfig.userId) {
        const recentRes = await fetch(
          `${localConfig.baseUrl}/Users/${localConfig.userId}/Items/Latest?Limit=6&Fields=Overview`,
          { headers }
        );
        if (recentRes.ok) {
          const recentData = await recentRes.json();
          setRecentItems(recentData);
        }
      } else {
        // Try to get users and use the first one
        const usersRes = await fetch(`${localConfig.baseUrl}/Users`, { headers });
        if (usersRes.ok) {
          const users = await usersRes.json();
          if (users.length > 0) {
            setLocalConfig(prev => ({ ...prev, userId: users[0].Id }));
          }
        }
      }
    } catch (err) {
      setError('Cannot connect to Jellyfin');
      console.error('Jellyfin API error:', err);
    } finally {
      setLoading(false);
    }
  }, [localConfig.baseUrl, localConfig.apiKey, localConfig.userId]);

  // Fetch on mount and interval
  useEffect(() => {
    if (!needsConfig) {
      fetchData();
      const interval = setInterval(fetchData, (localConfig.refreshInterval || 30) * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchData, localConfig.refreshInterval, needsConfig]);

  // Get item icon
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'Movie': return <Film className="w-4 h-4" />;
      case 'Episode':
      case 'Series': return <Tv className="w-4 h-4" />;
      case 'Audio':
      case 'MusicAlbum': return <Music className="w-4 h-4" />;
      default: return <Film className="w-4 h-4" />;
    }
  };

  // Get item image URL
  const getImageUrl = (item: JellyfinItem) => {
    if (item.ImageTags?.Primary) {
      return `${localConfig.baseUrl}/Items/${item.Id}/Images/Primary?maxWidth=200&tag=${item.ImageTags.Primary}&api_key=${localConfig.apiKey}`;
    }
    return null;
  };

  // Format runtime
  const formatRuntime = (ticks?: number) => {
    if (!ticks) return '';
    const minutes = Math.round(ticks / 600000000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Open Jellyfin
  const openJellyfin = () => {
    window.open(localConfig.baseUrl, '_blank', 'noopener,noreferrer');
  };

  // Determine view mode
  const isCompact = width <= 2 && height <= 2;

  // Render needs config view
  const renderNeedsConfig = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      <Settings className="w-8 h-8 text-gray-400 mb-2" />
      <span className="text-sm text-gray-500">API key required</span>
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => setShowSettings(true)}
      >
        Configure
      </Button>
    </div>
  );

  // Render now playing
  const renderNowPlaying = () => {
    if (sessions.length === 0) return null;

    return (
      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-2">Now Playing</div>
        {sessions.map(session => (
          <div
            key={session.Id}
            className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg mb-2"
          >
            {session.PlayState?.IsPaused ? (
              <Pause className="w-4 h-4 text-purple-500" />
            ) : (
              <Play className="w-4 h-4 text-purple-500" />
            )}
            <div className="flex-grow min-w-0">
              <div className="text-sm font-medium truncate">
                {session.NowPlayingItem?.SeriesName || session.NowPlayingItem?.Name}
              </div>
              {session.NowPlayingItem?.SeriesName && (
                <div className="text-xs text-gray-500 truncate">
                  S{session.NowPlayingItem.ParentIndexNumber} E{session.NowPlayingItem.IndexNumber} - {session.NowPlayingItem.Name}
                </div>
              )}
              <div className="text-xs text-gray-400">{session.UserName} • {session.DeviceName}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render compact view
  const renderCompactView = () => {
    const nowPlaying = sessions.length > 0 ? sessions[0] : null;

    return (
      <button
        onClick={openJellyfin}
        className="flex flex-col items-center justify-center h-full p-2 text-center hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <Film className="w-6 h-6 mb-1 text-purple-500" />
        {nowPlaying ? (
          <>
            <div className="flex items-center gap-1 text-xs">
              {nowPlaying.PlayState?.IsPaused ? (
                <Pause className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3 text-green-500" />
              )}
              <span className="truncate max-w-[80px]">
                {nowPlaying.NowPlayingItem?.SeriesName || nowPlaying.NowPlayingItem?.Name}
              </span>
            </div>
          </>
        ) : (
          <span className="text-xs text-gray-500">Nothing playing</span>
        )}
      </button>
    );
  };

  // Render full view
  const renderFullView = () => (
    <div className="flex flex-col h-full p-3">
      {/* Now playing section */}
      {renderNowPlaying()}

      {/* Recently added */}
      {recentItems.length > 0 && (
        <div className="flex-grow">
          <div className="text-xs text-gray-500 mb-2">Recently Added</div>
          <div className="grid grid-cols-2 gap-2">
            {recentItems.slice(0, isCompact ? 2 : 6).map(item => (
              <div
                key={item.Id}
                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                {getImageUrl(item) ? (
                  <img
                    src={getImageUrl(item)!}
                    alt={item.Name}
                    className="w-10 h-14 object-cover rounded"
                  />
                ) : (
                  <div className="w-10 h-14 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                    {getItemIcon(item.Type)}
                  </div>
                )}
                <div className="flex-grow min-w-0">
                  <div className="text-sm font-medium truncate">
                    {item.SeriesName || item.Name}
                  </div>
                  {item.SeriesName && (
                    <div className="text-xs text-gray-500 truncate">
                      S{item.ParentIndexNumber} E{item.IndexNumber}
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    {item.ProductionYear} • {formatRuntime(item.RunTimeTicks)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open button */}
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={openJellyfin}
      >
        <ExternalLink className="w-4 h-4 mr-1" />
        Open Jellyfin
      </Button>
    </div>
  );

  // Render content based on state and size
  const renderContent = () => {
    if (needsConfig) return renderNeedsConfig();

    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <span className="text-sm text-red-500">{error}</span>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchData}>
            Retry
          </Button>
        </div>
      );
    }

    if (isCompact) return renderCompactView();
    return renderFullView();
  };

  // Save settings
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
    setNeedsConfig(!localConfig.apiKey);
  };

  // Settings dialog
  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Jellyfin Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title-input">Widget Title</Label>
            <Input
              id="title-input"
              type="text"
              value={localConfig.title || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalConfig({ ...localConfig, title: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url-input">Jellyfin URL</Label>
            <Input
              id="url-input"
              type="url"
              value={localConfig.baseUrl || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalConfig({ ...localConfig, baseUrl: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key *</Label>
            <Input
              id="api-key"
              type="password"
              value={localConfig.apiKey || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalConfig({ ...localConfig, apiKey: e.target.value })
              }
              placeholder="Your Jellyfin API key"
            />
            <p className="text-xs text-gray-500">
              Get your API key from Jellyfin Dashboard → API Keys
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-id">User ID (optional)</Label>
            <Input
              id="user-id"
              type="text"
              value={localConfig.userId || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalConfig({ ...localConfig, userId: e.target.value })
              }
              placeholder="Auto-detected if not set"
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
            <Button variant="default" onClick={saveSettings}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="widget-container h-full flex flex-col relative">
      <WidgetHeader
        title={localConfig.title || defaultConfig.title}
        onSettingsClick={() => setShowSettings(true)}
      />

      <div className="flex-grow overflow-hidden">
        {renderContent()}
      </div>

      {renderSettings()}
    </div>
  );
};

export default JellyfinWidget;
