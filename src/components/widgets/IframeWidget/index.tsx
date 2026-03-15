import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Globe,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Slider } from '../../ui/slider';
import WidgetHeader from '../common/WidgetHeader';
import type { IframeWidgetConfig, IframeWidgetProps } from './types';
import { cn } from '@/lib/utils';

const defaultConfig: IframeWidgetConfig = {
  title: 'Embed',
  url: '',
  scale: 1,
  alignment: 'top',
};

// Validate URL (http/https only)
const isValidUrl = (urlString: string): boolean => {
  try {
    const urlObj = new URL(urlString);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

// Sanitize URL — returns empty string for non-http(s) protocols
const sanitizeUrl = (urlString: string): string => {
  try {
    const urlObj = new URL(urlString);
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') return urlObj.href;
    return '';
  } catch {
    return '';
  }
};

// Check if URL points to an image
const isImageUrl = (urlString: string): boolean => {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  try {
    const urlObj = new URL(urlString);
    const pathname = urlObj.pathname.toLowerCase();
    return imageExtensions.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
};

// Extract hostname for display
const getHostname = (urlString: string): string => {
  try {
    return new URL(urlString).hostname;
  } catch {
    return urlString;
  }
};

// Build a Google favicon URL
const getFaviconUrl = (urlString: string): string => {
  try {
    const origin = new URL(urlString).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return '';
  }
};

const IframeWidget: React.FC<IframeWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<IframeWidgetConfig>({
    ...defaultConfig,
    ...config,
  });

  // Snapshot for cancel/revert in settings modal
  const configSnapshot = useRef<IframeWidgetConfig>(localConfig);

  // App-mode navigation state
  const [iframeKey, setIframeKey] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(config?.scale || 1);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Error state for settings validation
  const [error, setError] = useState<string | null>(null);

  // Favicon load tracking
  const [faviconLoaded, setFaviconLoaded] = useState(false);

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Track favicon availability when URL changes
  useEffect(() => {
    const url = localConfig.url;
    if (!url || !isValidUrl(url)) {
      setFaviconLoaded(false);
      return;
    }
    const img = new Image();
    img.onload = () => setFaviconLoaded(true);
    img.onerror = () => setFaviconLoaded(false);
    img.src = getFaviconUrl(url);
  }, [localConfig.url]);

  // Open settings with snapshot
  const openSettings = useCallback(() => {
    configSnapshot.current = { ...localConfig };
    setError(null);
    setShowSettings(true);
  }, [localConfig]);

  // Cancel settings (revert to snapshot)
  const cancelSettings = useCallback(() => {
    setLocalConfig(configSnapshot.current);
    setError(null);
    setShowSettings(false);
  }, []);

  // Save settings
  const saveSettings = useCallback(() => {
    const trimmedUrl = (localConfig.url || '').trim();

    if (trimmedUrl && !isValidUrl(trimmedUrl)) {
      setError('Please enter a valid URL (starting with http:// or https://)');
      return;
    }

    const finalConfig = { ...localConfig, url: trimmedUrl };
    setLocalConfig(finalConfig);
    setError(null);

    if (config?.onUpdate) {
      config.onUpdate(finalConfig);
    }
    setShowSettings(false);
  }, [localConfig, config]);

  // App-mode controls
  const handleRefresh = useCallback(() => {
    setIframeKey(prev => prev + 1);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.1, 2.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.3));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1);
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (localConfig.url) {
      window.open(localConfig.url, '_blank', 'noopener,noreferrer');
    }
  }, [localConfig.url]);

  const url = localConfig.url || '';
  const title = localConfig.title || 'Embed';
  const scale = localConfig.scale || 1;
  const alignment = localConfig.alignment || 'top';

  // --- Iframe rendering helper ---
  const renderIframeElement = (
    overrideScale?: number,
    overrideAlignment?: string,
    extraClass?: string,
  ) => {
    const effectiveScale = overrideScale ?? scale;
    const effectiveAlignment = overrideAlignment ?? alignment;

    const alignmentClass = {
      top: 'items-start',
      center: 'items-center',
      bottom: 'items-end',
    }[effectiveAlignment] || 'items-start';

    const iframeStyle: React.CSSProperties = effectiveScale !== 1 ? {
      transform: `scale(${effectiveScale})`,
      transformOrigin: effectiveAlignment === 'bottom' ? 'bottom center' : effectiveAlignment === 'center' ? 'center center' : 'top center',
      width: `${100 / effectiveScale}%`,
      height: `${100 / effectiveScale}%`,
    } : {};

    if (isImageUrl(url)) {
      return (
        <div className={`h-full w-full flex items-center justify-center ${extraClass || ''}`}>
          <img
            src={sanitizeUrl(url)}
            alt={title || 'Embedded image'}
            className="max-w-full max-h-full object-contain"
            loading="lazy"
          />
        </div>
      );
    }

    return (
      <div className={`h-full w-full flex justify-center overflow-hidden ${alignmentClass} ${extraClass || ''}`}>
        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={sanitizeUrl(url)}
          className="w-full h-full border-0"
          style={iframeStyle}
          sandbox="allow-scripts allow-same-origin allow-popups"
          loading="lazy"
          title={title || 'Embedded content'}
        />
      </div>
    );
  };

  // --- Setup prompt (no URL configured) ---
  const renderSetup = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <Globe className="h-8 w-8" />
      <p className="text-sm">Embed external content</p>
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={openSettings}>
          Add URL
        </Button>
      )}
    </div>
  );

  // --- 1x1 ICON: globe with favicon overlay ---
  const renderTiny = () => {
    if (!url || !isValidUrl(url)) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Globe className="h-5 w-5 text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center">
        {faviconLoaded ? (
          <img
            src={getFaviconUrl(url)}
            alt=""
            className="h-6 w-6 rounded-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : (
          <Globe className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
    );
  };

  // --- Nx1 RIBBON: favicon + truncated URL/title ---
  const renderRibbon = () => {
    if (!url || !isValidUrl(url)) {
      return (
        <div className="flex-1 flex items-center gap-2 px-1 overflow-hidden">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground truncate">No URL configured</span>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center gap-2 px-1 overflow-hidden">
        {faviconLoaded ? (
          <img
            src={getFaviconUrl(url)}
            alt=""
            className="h-4 w-4 shrink-0 rounded-sm"
          />
        ) : (
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-xs truncate text-foreground">
          {title !== 'Embed' ? title : getHostname(url)}
        </span>
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenExternal}
            className="shrink-0 ml-auto h-5 w-5"
          >
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </Button>
        )}
      </div>
    );
  };

  // --- Compact (2x2): embed with minimal chrome ---
  const renderCompact = () => {
    if (!url || !isValidUrl(url)) return renderSetup();

    return (
      <div className="flex-1 overflow-hidden">
        {renderIframeElement(scale, alignment)}
      </div>
    );
  };

  // --- Default (3x3): standard embed ---
  const renderDefault = () => {
    if (!url || !isValidUrl(url)) return renderSetup();

    return (
      <div className="flex-1 overflow-hidden">
        {renderIframeElement(scale, alignment)}
      </div>
    );
  };

  // --- App (6x6+): full embed with URL bar, refresh, navigation controls, zoom ---
  const renderApp = () => {
    if (!url || !isValidUrl(url)) return renderSetup();

    return (
      <div className="flex flex-col h-full">
        {/* URL bar and controls */}
        <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/30 widget-drag-handle cursor-move">
          {/* Navigation controls */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              try { iframeRef.current?.contentWindow?.history.back(); } catch { /* cross-origin */ }
            }}
            className="h-7 w-7"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              try { iframeRef.current?.contentWindow?.history.forward(); } catch { /* cross-origin */ }
            }}
            className="h-7 w-7"
            title="Forward"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="h-7 w-7"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* URL display */}
          <div className="flex-1 flex items-center gap-1.5 px-2 py-1 bg-background rounded border text-xs text-muted-foreground overflow-hidden mx-1">
            {faviconLoaded && (
              <img
                src={getFaviconUrl(url)}
                alt=""
                className="h-3.5 w-3.5 shrink-0 rounded-sm"
              />
            )}
            <span className="truncate">{url}</span>
          </div>

          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="h-7 w-7"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-[10px] text-muted-foreground min-w-[3ch] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="h-7 w-7"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          {zoomLevel !== 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomReset}
              className="h-7 w-7"
              title="Reset zoom"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* External link */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenExternal}
            className="h-7 w-7"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        {/* Iframe content */}
        <div className="flex-1 overflow-hidden">
          {renderIframeElement(zoomLevel, alignment)}
        </div>
      </div>
    );
  };

  // --- Error state ---
  const renderError = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-4">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-destructive">Failed to load content</p>
      {!readOnly && (
        <Button size="sm" variant="outline" onClick={openSettings}>
          Settings
        </Button>
      )}
    </div>
  );

  // --- Main content selector ---
  const renderContent = () => {
    // Setup prompt if no URL
    if (!url && !isTiny && !isShort) return renderSetup();

    // Error state for invalid URL (only when URL is provided)
    if (url && !isValidUrl(url) && !isTiny && !isShort) return renderError();

    // Size-branching render (most specific first)
    if (isTiny) return renderTiny();
    if (isShort) return renderRibbon();
    if (isApp) return renderApp();
    if (isCompact) return renderCompact();
    return renderDefault();
  };

  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}>
      {/* Header: hide on tiny (tap opens settings), show compact on short */}
      {!isTiny && (
        <WidgetHeader
          title={title}
          onSettingsClick={readOnly ? undefined : openSettings}
          compact={isShort}
        />
      )}

      {renderContent()}

      {/* Settings Modal */}
      {!readOnly && (
        <Dialog
          open={showSettings}
          onOpenChange={(open) => {
            if (!open) cancelSettings();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {localConfig.title || 'Embed'} Settings
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="iframe-url">URL</Label>
                <Input
                  id="iframe-url"
                  placeholder="https://example.com/widget"
                  value={localConfig.url || ''}
                  onChange={(e) => {
                    setLocalConfig(prev => ({ ...prev, url: e.target.value }));
                    setError(null);
                  }}
                />
                {error && (
                  <p className="text-xs text-red-500 mt-1">{error}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the URL from an iframe src attribute
                </p>
              </div>

              <div>
                <Label htmlFor="iframe-title">Title</Label>
                <Input
                  id="iframe-title"
                  placeholder="Widget title"
                  value={localConfig.title || ''}
                  onChange={(e) =>
                    setLocalConfig(prev => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="iframe-scale">
                  Scale ({Math.round((localConfig.scale || 1) * 100)}%)
                </Label>
                <Slider
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  value={[localConfig.scale || 1]}
                  onValueChange={([value]) => {
                    if (typeof value === 'number') {
                      setLocalConfig(prev => ({ ...prev, scale: value }));
                    }
                  }}
                  className="mt-3"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Adjust to fit content within widget
                </p>
              </div>

              <div>
                <Label>Vertical Alignment</Label>
                <div className="flex gap-2 mt-1">
                  {(['top', 'center', 'bottom'] as const).map((align) => (
                    <Button
                      key={align}
                      type="button"
                      variant={(localConfig.alignment || 'top') === align ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() =>
                        setLocalConfig(prev => ({ ...prev, alignment: align }))
                      }
                    >
                      {align.charAt(0).toUpperCase() + align.slice(1)}
                    </Button>
                  ))}
                </div>
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

export default IframeWidget;
