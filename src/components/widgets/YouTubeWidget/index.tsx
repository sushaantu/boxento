import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import WidgetHeader from '../common/WidgetHeader';
import { YouTubeWidgetConfig, YouTubeWidgetProps } from './types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Play, Youtube, ExternalLink, Settings } from 'lucide-react';

const PLAY_BUTTON_CHROME_CLASS = 'rounded-full bg-black/75 text-white shadow-lg';

const defaultConfig: YouTubeWidgetConfig = {
  title: 'YouTube',
  videoId: '',
  autoplay: false,
  showControls: true,
  mute: false,
};

/**
 * Extract YouTube video ID from various URL formats or a bare ID.
 */
const extractVideoId = (input: string): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  // Direct 11-character ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  // URL patterns
  const regex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regex);
  return match ? match[1] : null;
};

const YouTubeWidget: React.FC<YouTubeWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<YouTubeWidgetConfig>({
    ...defaultConfig,
    ...config,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(localConfig.videoId || '');
  const [urlError, setUrlError] = useState<string | null>(null);

  // Snapshot for revert on cancel
  const configSnapshotRef = useRef<YouTubeWidgetConfig>(localConfig);

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Fetch video title via oEmbed when videoId changes
  const fetchTitle = useCallback(async (videoId: string) => {
    try {
      const resp = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`
      );
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.title) setVideoTitle(data.title);
    } catch {
      // Silently fail — title is a nice-to-have
    }
  }, []);

  useEffect(() => {
    if (localConfig.videoId) {
      fetchTitle(localConfig.videoId);
    } else {
      setVideoTitle(null);
    }
  }, [localConfig.videoId, fetchTitle]);

  // Build embed URL
  const getEmbedUrl = (videoId: string) => {
    const params = new URLSearchParams();
    if (localConfig.autoplay) params.append('autoplay', '1');
    if (!localConfig.showControls) params.append('controls', '0');
    if (localConfig.mute) params.append('mute', '1');
    params.append('rel', '0');
    params.append('modestbranding', '1');
    params.append('origin', window.location.origin);
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  };

  const getThumbnailUrl = (videoId: string) =>
    `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;

  const getWatchUrl = (videoId: string) =>
    `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

  // Persist config changes
  const saveSettings = () => {
    // Process URL input to extract video ID
    const id = extractVideoId(urlInput);
    const updatedConfig = {
      ...localConfig,
      videoId: id || urlInput,
    };
    if (config?.onUpdate) {
      config.onUpdate(updatedConfig);
    }
    setLocalConfig(updatedConfig);
    setShowSettings(false);
  };

  const handleSettingsOpenChange = (open: boolean) => {
    if (open) {
      configSnapshotRef.current = { ...localConfig };
      setUrlInput(localConfig.videoId || '');
      setUrlError(null);
    } else {
      // Revert on close without save
      setLocalConfig(configSnapshotRef.current);
    }
    setShowSettings(open);
  };

  const handleUrlInputChange = (value: string) => {
    setUrlInput(value);
    if (!value.trim()) {
      setUrlError(null);
      return;
    }
    const id = extractVideoId(value);
    if (id) {
      setUrlError(null);
    } else {
      setUrlError('Could not detect a valid YouTube video ID');
    }
  };

  // --- Setup prompt when no video configured ---
  const renderSetup = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <Settings className="h-8 w-8" />
      <p className="text-sm">Configure a YouTube video</p>
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
          Open Settings
        </Button>
      )}
    </div>
  );

  // --- Size-specific renderers ---

  // 1x1 ICON: YouTube play icon or thumbnail
  const renderTiny = () => {
    if (!localConfig.videoId) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Youtube className="h-5 w-5 text-muted-foreground" />
        </div>
      );
    }
    return (
      <button
        className="flex-1 flex items-center justify-center relative overflow-hidden rounded"
        onClick={() => window.open(getWatchUrl(localConfig.videoId!), '_blank', 'noopener,noreferrer')}
        title={videoTitle || 'Play on YouTube'}
      >
        <img
          src={getThumbnailUrl(localConfig.videoId)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className={`relative z-10 p-1 ${PLAY_BUTTON_CHROME_CLASS}`}>
          <Play className="h-3 w-3 text-white fill-white" />
        </div>
      </button>
    );
  };

  // Nx1 RIBBON: title + play button horizontally
  const renderShort = () => {
    if (!localConfig.videoId) {
      return (
        <div className="flex-1 flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Youtube className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">No video configured</span>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center gap-2 overflow-hidden px-1">
        <button
          onClick={() => window.open(getWatchUrl(localConfig.videoId!), '_blank', 'noopener,noreferrer')}
          className="shrink-0 relative rounded overflow-hidden"
          style={{ width: Math.max(width * 20, 48), height: '100%' }}
        >
          <img
            src={getThumbnailUrl(localConfig.videoId)}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`p-0.5 ${PLAY_BUTTON_CHROME_CLASS}`}>
              <Play className="h-3 w-3 text-white fill-white" />
            </div>
          </div>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{videoTitle || localConfig.title || 'YouTube Video'}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(getWatchUrl(localConfig.videoId!), '_blank', 'noopener,noreferrer')}
          className="shrink-0 h-auto p-0 text-muted-foreground hover:text-foreground"
          title="Open on YouTube"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  // Compact (2x2): thumbnail with play overlay, click to play inline
  const renderCompact = () => {
    if (!localConfig.videoId) return renderSetup();

    if (isPlaying) {
      return (
        <div className="flex-1 overflow-hidden rounded-lg">
          <iframe
            src={getEmbedUrl(localConfig.videoId)}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
            className="w-full h-full"
          />
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <button
          className="flex-1 relative overflow-hidden rounded-lg cursor-pointer"
          onClick={() => setIsPlaying(true)}
        >
          <img
            src={getThumbnailUrl(localConfig.videoId)}
            alt={videoTitle || 'Video thumbnail'}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className={`p-2 ${PLAY_BUTTON_CHROME_CLASS}`}>
              <Play className="h-5 w-5 text-white fill-white" />
            </div>
          </div>
        </button>
        <p className="mt-1 text-[10px] truncate text-muted-foreground">
          {videoTitle || localConfig.title || 'Click to play'}
        </p>
      </div>
    );
  };

  // Default (3x3 WIDGET): embedded player with title
  const renderDefault = () => {
    if (!localConfig.videoId) return renderSetup();

    if (isPlaying) {
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden rounded-lg">
            <iframe
              src={getEmbedUrl(localConfig.videoId)}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
              className="w-full h-full"
            />
          </div>
          {videoTitle && (
            <p className="mt-1.5 text-xs font-medium truncate">{videoTitle}</p>
          )}
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <button
          className="flex-1 relative overflow-hidden rounded-lg cursor-pointer"
          onClick={() => setIsPlaying(true)}
        >
          <img
            src={getThumbnailUrl(localConfig.videoId)}
            alt={videoTitle || 'Video thumbnail'}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className={`p-3 ${PLAY_BUTTON_CHROME_CLASS}`}>
              <Play className="h-6 w-6 text-white fill-white" />
            </div>
          </div>
        </button>
        <div className="mt-1.5 min-w-0">
          <p className="text-sm font-medium truncate">{videoTitle || localConfig.title || 'YouTube Video'}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(getWatchUrl(localConfig.videoId!), '_blank', 'noopener,noreferrer')}
            className="h-auto p-0 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5"
          >
            <ExternalLink className="h-3 w-3" /> Open on YouTube
          </Button>
        </div>
      </div>
    );
  };

  // Panel (4x4-5x5): larger player with video info sidebar
  const renderPanel = () => {
    if (!localConfig.videoId) return renderSetup();

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden rounded-lg">
          <iframe
            src={getEmbedUrl(localConfig.videoId)}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
            className="w-full h-full"
          />
        </div>
        <div className="mt-2 flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{videoTitle || localConfig.title || 'YouTube Video'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              ID: {localConfig.videoId}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => window.open(getWatchUrl(localConfig.videoId!), '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            YouTube
          </Button>
        </div>
      </div>
    );
  };

  // App (6x6+): full player with info panel, open-on-YouTube, large controls
  const renderApp = () => {
    if (!localConfig.videoId) return renderSetup();

    return (
      <div className="flex h-full gap-4">
        {/* Main player area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-hidden rounded-lg bg-black">
            <iframe
              src={getEmbedUrl(localConfig.videoId)}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
              className="w-full h-full"
            />
          </div>
          <div className="mt-3 min-w-0 widget-drag-handle cursor-move">
            <h2 className="text-base font-semibold truncate">
              {videoTitle || localConfig.title || 'YouTube Video'}
            </h2>
          </div>
        </div>

        {/* Side panel with video info */}
        <div className="w-1/3 max-w-[280px] border-l pl-4 flex flex-col overflow-y-auto">
          <h3 className="text-sm font-semibold mb-3">Video Info</h3>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Title</span>
              <p className="mt-0.5 font-medium">{videoTitle || localConfig.title || 'Untitled'}</p>
            </div>

            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Video ID</span>
              <p className="mt-0.5 font-mono text-xs break-all">{localConfig.videoId}</p>
            </div>

            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Playback</span>
              <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                <p>Autoplay: {localConfig.autoplay ? 'On' : 'Off'}</p>
                <p>Controls: {localConfig.showControls !== false ? 'Shown' : 'Hidden'}</p>
                <p>Muted: {localConfig.mute ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(getWatchUrl(localConfig.videoId!), '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open on YouTube
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // --- Settings modal ---
  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{localConfig.title || 'YouTube'} Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="yt-title">Title</Label>
            <Input
              id="yt-title"
              value={localConfig.title || ''}
              onChange={(e) =>
                setLocalConfig(prev => ({ ...prev, title: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="yt-url">YouTube Video URL or ID</Label>
            <Input
              id="yt-url"
              placeholder="https://www.youtube.com/watch?v=... or video ID"
              value={urlInput}
              onChange={(e) => handleUrlInputChange(e.target.value)}
            />
            {urlError && (
              <p className="text-xs text-red-500 mt-1">{urlError}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Paste a YouTube URL or an 11-character video ID
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="yt-autoplay">Autoplay</Label>
            <Switch
              id="yt-autoplay"
              checked={localConfig.autoplay ?? false}
              onCheckedChange={(checked) =>
                setLocalConfig(prev => ({
                  ...prev,
                  autoplay: checked,
                  // Auto-enable mute when autoplay is turned on (browser policy)
                  mute: checked ? true : prev.mute,
                }))
              }
            />
          </div>
          {localConfig.autoplay && (
            <p className="text-xs text-muted-foreground -mt-2 ml-1">
              Most browsers require mute for autoplay to work
            </p>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="yt-mute">Mute</Label>
            <Switch
              id="yt-mute"
              checked={localConfig.mute ?? false}
              onCheckedChange={(checked) =>
                setLocalConfig(prev => ({ ...prev, mute: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="yt-controls">Show player controls</Label>
            <Switch
              id="yt-controls"
              checked={localConfig.showControls !== false}
              onCheckedChange={(checked) =>
                setLocalConfig(prev => ({ ...prev, showControls: checked }))
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
              <Button variant="outline" onClick={() => handleSettingsOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={saveSettings}>Save</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Reset playing state when video changes
  useEffect(() => {
    setIsPlaying(false);
  }, [localConfig.videoId]);

  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}>
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title || defaultConfig.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      {/* Size-branching render (most specific first) */}
      {isTiny ? renderTiny()
        : isShort ? renderShort()
        : isApp ? renderApp()
        : isWide && isTall ? renderPanel()
        : isCompact ? renderCompact()
        : renderDefault()}

      {/* Settings modal (hidden in readOnly mode) */}
      {!readOnly && renderSettings()}
    </div>
  );
};

export default YouTubeWidget;
