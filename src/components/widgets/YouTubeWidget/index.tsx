import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Label,
  Input,
  Checkbox,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import { YouTubeWidgetProps, YouTubeWidgetConfig } from './types';
import { Youtube } from 'lucide-react';

/**
 * Size categories for widget content rendering
 * This enum provides clear naming for different widget dimensions
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
 * YouTube Widget Component
 * 
 * This widget allows users to embed and watch YouTube videos directly
 * in their Boxento dashboard.
 * 
 * @param {YouTubeWidgetProps} props - Component props
 * @returns {JSX.Element} Widget component
 */
const YouTubeWidget: React.FC<YouTubeWidgetProps> = ({ width, height, config }) => {
  // Default configuration
  const defaultConfig: YouTubeWidgetConfig = {
    title: 'YouTube Video',
    videoId: 'dQw4w9WgXcQ', // Default video (Rick Astley - Never Gonna Give You Up)
    autoplay: false,
    showControls: true,
    mute: false
  };

  // Component state
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<YouTubeWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [embedMode, setEmbedMode] = useState<'iframe' | 'direct-link'>('iframe');
  
  // Use a ref for expanded state to prevent re-renders
  const isExpandedRef = useRef<boolean>(!!config?._expandedView);
  // Mirror in state for forcing re-renders when actually needed
  const [isExpanded, setIsExpanded] = useState<boolean>(isExpandedRef.current);
  
  // Static instance ID to use as a stable iframe key
  const instanceIdRef = useRef<string>(`youtube-${Math.random().toString(36).substring(2, 9)}`);
  
  // Refs for the widget container and iframe
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  
  // Update local config when props config changes, but don't update expanded state
  useEffect(() => {
    setLocalConfig((prevConfig: YouTubeWidgetConfig) => ({
      ...prevConfig,
      ...config
    }));
  }, [config]);
  
  // Get YouTube embed URL
  const getYouTubeEmbedUrl = () => {
    const { videoId, autoplay, showControls, mute } = localConfig;
    
    if (!videoId) return '';
    
    // Sanitize videoId to prevent XSS
    const sanitizedVideoId = encodeURIComponent(videoId);
    
    const params = new URLSearchParams();
    
    if (autoplay) params.append('autoplay', '1');
    if (!showControls) params.append('controls', '0');
    if (mute) params.append('mute', '1');
    
    // Always add these parameters for better embedding
    params.append('rel', '0'); // Don't show related videos
    params.append('modestbranding', '1'); // Minimal YouTube branding
    params.append('origin', window.location.origin); // Add origin for security
    params.append('enablejsapi', '1'); // Enable JavaScript API
    params.append('widget_referrer', window.location.href); // Add referrer
    
    return `https://www.youtube.com/embed/${sanitizedVideoId}?${params.toString()}`;
  };
  
  // Toggle expanded state
  const toggleExpanded = (expanded: boolean) => {
    isExpandedRef.current = expanded;
    setIsExpanded(expanded);
  };
  
  // Handle thumbnail click
  const handleThumbnailClick = () => {
    if (embedMode === 'direct-link') {
      window.open(getDirectYouTubeUrl(), '_blank', 'noopener,noreferrer');
    } else {
      toggleExpanded(true);
    }
  };
  
  // Handle back button click
  const handleBackButtonClick = () => {
    toggleExpanded(false);
  };

  // Get direct YouTube URL
  const getDirectYouTubeUrl = (): string => {
    const { videoId } = localConfig;
    if (!videoId) return '';
    // Sanitize videoId to prevent XSS
    const sanitizedVideoId = encodeURIComponent(videoId);
    return `https://www.youtube.com/watch?v=${sanitizedVideoId}`;
  };
  
  // Toggle embedding mode
  const toggleEmbedMode = () => {
    setEmbedMode(prev => prev === 'iframe' ? 'direct-link' : 'iframe');
    setEmbedError(null);
  };
  
  // Handle iframe load event
  const handleIframeLoad = () => {
    setIsLoading(false);
    setEmbedError(null);
  };
  
  // Handle iframe error event
  const handleIframeError = () => {
    setIsLoading(false);
    setEmbedError('Could not load the YouTube video. Please check your internet connection or try the direct link option.');
  };
  
  // Move state hooks to component level
  const [videoIdFeedback, setVideoIdFeedback] = useState<{type: 'success' | 'error' | 'info' | null, message: string | null}>({
    type: null,
    message: null
  });
  
  const [activeTab, setActiveTab] = useState('general');
  
  // Validate video ID or URL input
  const validateYouTubeInput = React.useCallback((input: string) => {
    if (!input.trim()) {
      setVideoIdFeedback({
        type: 'info',
        message: 'Please enter a YouTube URL or video ID'
      });
      return;
    }
    
    if (input.includes('youtu')) {
      const id = extractYouTubeId(input);
      if (id) {
        setVideoIdFeedback({
          type: 'success',
          message: 'Valid YouTube URL detected'
        });
      } else {
        setVideoIdFeedback({
          type: 'error',
          message: 'Could not extract a valid YouTube video ID from this URL'
        });
      }
    } else if (input.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(input)) {
      setVideoIdFeedback({
        type: 'success',
        message: 'Valid YouTube video ID format'
      });
    } else {
      setVideoIdFeedback({
        type: 'error',
        message: 'This doesn\'t look like a valid YouTube video ID (should be 11 characters)'
      });
    }
  }, []);
  
  // Move useEffect to component level
  useEffect(() => {
    if (localConfig.videoId) {
      validateYouTubeInput(localConfig.videoId);
    }
  }, [localConfig.videoId, validateYouTubeInput]);
  
  // Extract YouTube ID from various URL formats
  const extractYouTubeId = (url: string): string | null => {
    // Regular YouTube URL pattern - remove unnecessary escapes
    const regExp = /^.*(youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([^#&?]*).*/;
    const match = url.match(regExp);

    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Fetch video title from YouTube oEmbed API
  const fetchVideoTitle = React.useCallback(async (videoId: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`
      );
      if (!response.ok) return null;
      const data = await response.json();
      return data.title || null;
    } catch {
      return null;
    }
  }, []);

  // Auto-fetch video title when videoId changes
  useEffect(() => {
    const updateTitle = async () => {
      if (!localConfig.videoId) return;

      // Only fetch if title is default or empty
      if (!localConfig.title || localConfig.title === 'YouTube Video' || localConfig.title === defaultConfig.title) {
        const title = await fetchVideoTitle(localConfig.videoId);
        if (title) {
          const updatedConfig = { ...localConfig, title };
          setLocalConfig(updatedConfig);
          // Persist the title to parent
          if (config?.onUpdate) {
            config.onUpdate(updatedConfig);
          }
        }
      }
    };

    updateTitle();
  }, [localConfig.videoId]); // Only run when videoId changes
  
  // Process YouTube URL input
  const handleYouTubeUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setIsLoading(true);

    // Clear any previous errors when changing the URL
    setEmbedError(null);

    // If it looks like a URL, try to extract the ID
    if (url.includes('youtu')) {
      const id = extractYouTubeId(url);
      if (id) {
        // Reset title to default so auto-fetch will update it
        setLocalConfig({...localConfig, videoId: id, title: 'YouTube Video'});
      } else {
        // If not a valid URL but might be direct ID, just use the value
        setLocalConfig({...localConfig, videoId: url, title: 'YouTube Video'});
      }
    } else {
      // If not YouTube URL format, assume it's a direct video ID
      setLocalConfig({...localConfig, videoId: url, title: 'YouTube Video'});
    }
  };

  // Small view (2x2) - Show thumbnail with play button
  const renderSmallView = () => {
    const { videoId } = localConfig;
    
    if (!videoId) {
      return renderEmptyState();
    }
    
    // If we're in expanded view, show the player even in small size
    if (isExpanded) {
      return renderYouTubeEmbed();
    }
    
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="relative w-full aspect-video max-h-full overflow-hidden rounded-lg cursor-pointer" 
             onClick={handleThumbnailClick}>
          <img 
            src={`https://img.youtube.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`} 
            alt="Video thumbnail" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-red-600 rounded-full w-12 h-12 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm truncate w-full">
          {embedMode === 'direct-link' ? 'Click to open on YouTube' : 'Click to play'}
        </p>
      </div>
    );
  };
  
  // Wide small view (3x2) - Show thumbnail with play button and title
  const renderWideSmallView = () => {
    const { videoId, title } = localConfig;
    
    if (!videoId) {
      return renderEmptyState();
    }
    
    // If we're in expanded view, show the player even in small size
    if (isExpanded) {
      return renderYouTubeEmbed();
    }
    
    return (
      <div className="h-full flex flex-col">
        <div className="relative w-full aspect-video max-h-full overflow-hidden rounded-lg cursor-pointer" 
             onClick={handleThumbnailClick}>
          <img 
            src={`https://img.youtube.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`} 
            alt="Video thumbnail" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-red-600 rounded-full w-12 h-12 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm truncate">{title || 'YouTube Video'}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {embedMode === 'direct-link' ? 'Click to open on YouTube' : 'Click to play'}
        </p>
      </div>
    );
  };

  // Render YouTube embed
  const renderYouTubeEmbed = () => {
    const { videoId, title } = localConfig;
    
    if (!videoId) {
      return renderEmptyState();
    }
    
    // If using direct link mode
    if (embedMode === 'direct-link') {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 mb-3">
            <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
            <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
          </svg>
          <h3 className="text-lg font-medium">{title || 'YouTube Video'}</h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Click below to watch on YouTube
          </p>
          <div className="flex flex-col space-y-2">
            <a 
              href={getDirectYouTubeUrl()} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              Open in YouTube
            </a>
            <button
              onClick={toggleEmbedMode}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Try Embedded Player
            </button>
          </div>
        </div>
      );
    }
    
    // Check if this is a small widget in expanded view
    const isSmallExpandedWidget = 
      (width <= 2 && height <= 2) || 
      (width === 3 && height === 2);
    
    // Regular iframe embed
    return (
      <div className="h-full flex flex-col relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/70 dark:bg-gray-800/70 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}
        
        {embedError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 dark:bg-gray-800/80 z-10 p-4">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-red-500 mb-2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <p className="text-sm text-red-600 dark:text-red-400">{embedError}</p>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                <button 
                  onClick={() => setShowSettings(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 underline"
                >
                  Change Video
                </button>
                <button 
                  onClick={toggleEmbedMode}
                  className="text-xs text-blue-600 dark:text-blue-400 underline"
                >
                  Try Direct Link
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Back button for small widgets in expanded mode */}
        {isSmallExpandedWidget && isExpanded && (
          <button 
            onClick={handleBackButtonClick}
            className="absolute top-2 left-2 z-10 p-1 bg-black/50 hover:bg-black/70 text-white rounded-full"
            aria-label="Back to thumbnail"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        )}
        
        <div className="w-full flex-grow overflow-hidden rounded-lg">
          <iframe
            ref={iframeRef}
            src={getYouTubeEmbedUrl()}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
            className="w-full h-full"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            key={`${instanceIdRef.current}-${localConfig.videoId}`}
          />
        </div>
        
        {title && <p className="mt-2 text-sm truncate">{title}</p>}
      </div>
    );
  };
  
  // Render content based on widget size
  const renderContent = () => {
    const sizeCategory = getWidgetSizeCategory(width, height);
    
    switch (sizeCategory) {
      case WidgetSizeCategory.SMALL:
        return renderSmallView();
      case WidgetSizeCategory.WIDE_SMALL:
        return renderWideSmallView();
      case WidgetSizeCategory.TALL_SMALL:
      case WidgetSizeCategory.MEDIUM:
      case WidgetSizeCategory.WIDE_MEDIUM:
      case WidgetSizeCategory.TALL_MEDIUM:
      case WidgetSizeCategory.LARGE:
        return renderYouTubeEmbed();
      default:
        return renderSmallView();
    }
  };
  
  // Empty state when no video ID is provided
  const renderEmptyState = () => {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        {/* Use Youtube icon from Lucide with consistent styling (red color) */}
        <Youtube size={40} className="text-red-500 dark:text-red-400 mb-3" strokeWidth={1.5} />
        {/* Consistent text styling */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          No YouTube video configured.
        </p>
        {/* Consistent button styling */}
        <Button
          size="sm"
          onClick={() => setShowSettings(true)} 
        >
          Configure Video
        </Button>
      </div>
    );
  };

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

  // Save settings
  const saveSettings = () => {
    // If we're in a small widget and returning to thumbnail view, preserve that state
    const updatedConfig = {
      ...localConfig,
    };
    
    if (config?.onUpdate) {
      config.onUpdate(updatedConfig);
    }
    setShowSettings(false);
  };
  
  // Updated Settings Dialog to include debug mode and embed mode toggle
  const renderSettings = () => {
    return (
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>YouTube Widget Settings</DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="playback">Playback Options</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="space-y-4 py-4">
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
              
              {/* YouTube Video URL or ID */}
              <div className="space-y-2">
                <Label htmlFor="video-input">YouTube Video URL or ID</Label>
                <Input
                  id="video-input"
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={localConfig.videoId || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    handleYouTubeUrlChange(e);
                    setVideoIdFeedback({type: 'info', message: 'Checking...'});
                  }}
                  className={
                    videoIdFeedback.type === 'error' 
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-500 dark:border-red-700 dark:bg-red-900/20' 
                      : videoIdFeedback.type === 'success'
                      ? 'border-green-300 focus:border-green-400 focus:ring-green-500 dark:border-green-700 dark:bg-green-900/20'
                      : ''
                  }
                  aria-invalid={videoIdFeedback.type === 'error'}
                  aria-describedby="video-feedback"
                />
                {videoIdFeedback.message && (
                  <p 
                    id="video-feedback"
                    className={`text-xs ${
                      videoIdFeedback.type === 'error' 
                        ? 'text-red-600 dark:text-red-400' 
                        : videoIdFeedback.type === 'success'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {videoIdFeedback.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Examples: https://www.youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="playback" className="space-y-4 py-4">
              {/* Autoplay toggle */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoplay-toggle"
                  checked={localConfig.autoplay || false}
                  onCheckedChange={(checked: boolean) => {
                    // If enabling autoplay, suggest enabling mute as well for better compatibility
                    setLocalConfig({
                      ...localConfig, 
                      autoplay: checked,
                      // Automatically enable mute when autoplay is enabled to help with browser autoplay policies
                      mute: checked ? true : localConfig.mute
                    });
                  }}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="autoplay-toggle">
                    Autoplay video
                    {localConfig.autoplay && (
                      <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">
                        (requires mute in most browsers)
                      </span>
                    )}
                  </Label>
                </div>
              </div>
              
              {/* Mute toggle */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mute-toggle"
                  checked={localConfig.mute || false}
                  onCheckedChange={(checked: boolean) => 
                    setLocalConfig({...localConfig, mute: checked})
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="mute-toggle">
                    Mute video
                    {localConfig.autoplay && !localConfig.mute && (
                      <span className="ml-1 text-xs text-red-600 dark:text-red-400">
                        (required for autoplay to work)
                      </span>
                    )}
                  </Label>
                </div>
              </div>
              
              {/* Show controls toggle */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="controls-toggle"
                  checked={localConfig.showControls !== false}
                  onCheckedChange={(checked: boolean) => 
                    setLocalConfig({...localConfig, showControls: checked})
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="controls-toggle">
                    Show video controls
                  </Label>
                </div>
              </div>
              
              {/* Add embed mode toggle */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="embed-mode-toggle"
                  checked={embedMode === 'direct-link'}
                  onCheckedChange={() => setEmbedMode(prev => prev === 'iframe' ? 'direct-link' : 'iframe')}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="embed-mode-toggle">
                    Use direct link to YouTube (instead of embedded player)
                  </Label>
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
                onClick={() => {
                  saveSettings();
                  setShowSettings(false);
                }}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Main render
  return (
    <div ref={widgetRef} className="widget-container h-full flex flex-col relative">
      <WidgetHeader 
        title={localConfig.title || defaultConfig.title} 
        onSettingsClick={() => setShowSettings(true)}
      />
      
      <div className="flex-grow p-4 overflow-hidden">
        {renderContent()}
      </div>
      
      {/* Settings dialog */}
      {renderSettings()}
    </div>
  );
};

export default YouTubeWidget; 