import React, { useState, useRef, useEffect } from 'react'
import { ExternalLink, Plus, Trash, Edit } from 'lucide-react'
import WidgetHeader from '../../widgets/common/WidgetHeader'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Button,
  Label,
  Switch,
  RadioGroup,
  RadioGroupItem,
} from '@boxento/primitives'
import { QuickLinksWidgetProps, LinkItem } from './types'

/**
 * Fetches metadata from a URL including title and favicon
 * @param url The URL to fetch metadata from
 * @returns Promise with title and favicon extracted from favicon
 */
const fetchUrlMetadata = async (url: string): Promise<{ title: string; favicon: string }> => {
  try {
    // Validate and normalize the URL
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const urlObj = new URL(normalizedUrl);

    // Special handling for localhost URLs
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
      return {
        title: 'Localhost',
        favicon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjIiIHk9IjIiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcng9IjIuMTgiIHJ5PSIyLjE4Ii8+PHJlY3QgeD0iNyIgeT0iNyIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIi8+PC9zdmc+'
      };
    }

    // Use DuckDuckGo's favicon service for non-localhost URLs
    const favicon = `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`;

    // Extract a reasonable title from the URL if metadata fetching fails
    let extractedTitle = "";
    
    // Try to get a reasonable title from the URL path
    if (urlObj.pathname && urlObj.pathname !== "/") {
      const path = urlObj.pathname.endsWith('/') 
        ? urlObj.pathname.slice(0, -1) 
        : urlObj.pathname;
      
      const segments = path.split('/').filter(Boolean);
      if (segments.length > 0) {
        extractedTitle = segments[segments.length - 1]
          .replace(/[-_]/g, ' ')
          .replace(/\.\w+$/, '')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }

    // If path doesn't provide a good title, use the hostname without TLD
    if (!extractedTitle) {
      const hostnameWithoutWWW = urlObj.hostname.replace(/^www\./, '');
      const mainDomain = hostnameWithoutWWW.split('.')[0];
      
      extractedTitle = mainDomain
        .charAt(0).toUpperCase() + mainDomain.slice(1)
        .replace(/-/g, ' ');
    }

    // Skip the JSONLink API call since it's causing CORS issues
    // Return our fallback data immediately
    return { 
      title: extractedTitle || urlObj.hostname,
      favicon
    };

  } catch (error) {
    console.error('Error in fetchUrlMetadata:', error);
    // Return a basic fallback using the URL's hostname
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return {
        title: urlObj.hostname,
        favicon: `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`
      };
    } catch {
      // Final fallback if URL parsing also fails
      return {
        title: url,
        favicon: `https://icons.duckduckgo.com/ip3/example.com.ico`
      };
    }
  }
};

/**
 * QuickLinks Widget Component
 * 
 * A widget that displays a collection of customizable links for quick access.
 * Supports different layouts based on widget dimensions (minimum size 2x2) and provides a settings
 * interface for adding, editing, and removing links.
 * 
 * @component
 * @param {QuickLinksWidgetProps} props - Component props
 * @returns {JSX.Element} QuickLinks widget component
 */
const QuickLinksWidget: React.FC<QuickLinksWidgetProps> = ({ config }) => {
  const [links, setLinks] = useState<LinkItem[]>(config?.links || []);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [newLinkUrl, setNewLinkUrl] = useState<string>('');
  const [isLoading] = useState<boolean>(false);
  const newLinkInputRef = useRef<HTMLInputElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const [loadingLinkIds, setLoadingLinkIds] = useState<number[]>([]);

  // Widget settings state
  const [displayMode, setDisplayMode] = useState<'regular' | 'compact'>(config?.displayMode || 'regular');
  const [showFavicons, setShowFavicons] = useState<boolean>(config?.showFavicons !== false);
  const [customTitle, setCustomTitle] = useState<string>(config?.customTitle || 'Quick Links');
  const [isCompact, setIsCompact] = useState(false);

  // Detect if widget is in compact mode (small size)
  useEffect(() => {
    const checkSize = () => {
      if (widgetRef.current) {
        const height = widgetRef.current.offsetHeight;
        setIsCompact(height < 280);
      }
    };

    checkSize();
    const resizeObserver = new ResizeObserver(checkSize);
    if (widgetRef.current) {
      resizeObserver.observe(widgetRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Remove the separate useEffects and combine them into one
  React.useEffect(() => {
    // Only update if we have config and it's different from current state
    if (config) {
      const shouldUpdateLinks = config.links && JSON.stringify(config.links) !== JSON.stringify(links);
      if (shouldUpdateLinks) {
        setLinks(config.links);
      }
      
      // Update other settings only if they've changed
      if (config.displayMode && config.displayMode !== displayMode) {
        setDisplayMode(config.displayMode);
      }
      if (config.customTitle && config.customTitle !== customTitle) {
        setCustomTitle(config.customTitle);
      }
      if (config.showFavicons !== undefined && config.showFavicons !== showFavicons) {
        setShowFavicons(config.showFavicons);
      }
    }
  }, [config]); // Depend on entire config object

  /**
   * Adds or updates a link in the links collection
   * 
   * If the editingLink has an id, it updates the existing link.
   * Otherwise, it creates a new link with a unique id.
   */
  const addLink = () => {
    if (editingLink && editingLink.title && editingLink.url) {
      let updatedLinks: LinkItem[];

      if (editingLink.id) {
        // Update existing link
        updatedLinks = links.map(link => 
          link.id === editingLink.id ? editingLink : link
        );
      } else {
        // Add new link
        const newId = Math.max(0, ...links.map(link => link.id)) + 1;
        updatedLinks = [...links, { ...editingLink, id: newId }];
      }

      // Update state
      setLinks(updatedLinks);
      
      // Separate the onUpdate to avoid React warnings about updates during render
      // Use setTimeout to ensure it runs after the current render cycle
      if (config && config.onUpdate) {
        const updateFunction = config.onUpdate;
        const configCopy = { ...config };
        
        setTimeout(() => {
          // Create a clean copy of the data to avoid undefined values
          const linksCopy = JSON.parse(JSON.stringify(updatedLinks));
          updateFunction({
            ...configCopy,
            links: linksCopy
          });
        }, 0);
      }
      
      setEditingLink(null);
    }
  }

  /**
   * Removes a link from the links collection
   * 
   * @param {number} id - The id of the link to remove
   */
  const removeLink = (id: number) => {
    const updatedLinks = links.filter(link => link.id !== id);
    
    // Update state
    setLinks(updatedLinks);
    
    // Save using onUpdate callback to persist
    if (config?.onUpdate) {
      config.onUpdate({
        ...config,
        links: updatedLinks
      });
    }
  }

  /**
   * Starts editing a link or creates a new one
   * 
   * @param {LinkItem | null} link - The link to edit, or null to create a new one
   */
  const startEdit = (link: LinkItem | null = null) => {
    setEditingLink(link || { id: 0, title: '', url: '', favicon: '' })
  }

  /**
   * Updates widget settings and saves them
   */
  const saveSettings = () => {
    if (config && config.onUpdate) {
      const updateFunction = config.onUpdate;
      const configCopy = { ...config };
      
      // Use setTimeout to ensure it runs after the current render cycle
      setTimeout(() => {
        // Create a clean copy of the data to avoid undefined values
        const linksCopy = JSON.parse(JSON.stringify(links));
        updateFunction({
          ...configCopy,
          links: linksCopy,
          displayMode,
          showFavicons,
          customTitle
        });
      }, 0);
    }
    setShowSettings(false);
  }

  // Modify handleQuickAdd to handle updates more carefully
  const handleQuickAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const rawUrl = newLinkUrl.trim();
    if (!rawUrl) return;

    try {
      // Validate and normalize the URL
      let normalizedUrl = rawUrl;
      if (!rawUrl.match(/^https?:\/\//)) {
        normalizedUrl = `https://${rawUrl}`;
      }

      const urlObj = new URL(normalizedUrl);
      
      // Generate new ID using current links state
      const newId = Math.max(0, ...links.map(link => link.id), 0) + 1;
      
      // Create new link
      const newLink: LinkItem = {
        id: newId,
        url: normalizedUrl,
        title: urlObj.hostname,
        favicon: `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`
      };

      // Create updated links array
      const updatedLinks = [...links, newLink];

      // Update local state first
      setLinks(updatedLinks);
      setNewLinkUrl('');
      setLoadingLinkIds(prev => [...prev, newId]);

      // Update config with new links
      if (config?.onUpdate) {
        const configUpdate = {
          ...config,
          links: updatedLinks // Use the updated links array
        };
        
        try {
          await config.onUpdate(configUpdate);
        } catch (error) {
          console.error('Error updating config:', error);
          // Rollback on error
          setLinks(links);
          return;
        }
      }

      // Fetch metadata after successful save
      try {
        const metadata = await fetchUrlMetadata(normalizedUrl);
        
        if (metadata.title !== newLink.title) {
          const finalLink = {
            ...newLink,
            title: metadata.title,
            favicon: metadata.favicon
          };

          // Update with metadata
          const finalUpdatedLinks = updatedLinks.map(link => 
            link.id === newId ? finalLink : link
          );

          setLinks(finalUpdatedLinks);

          // Update config with metadata
          if (config?.onUpdate) {
            const finalConfigUpdate = {
              ...config,
              links: finalUpdatedLinks
            };
            await config.onUpdate(finalConfigUpdate);
          }
        }
      } catch (error) {
        console.error('Error fetching metadata:', error);
        // Link is already saved with basic info, so we can continue
      } finally {
        setLoadingLinkIds(prev => prev.filter(id => id !== newId));
      }
    } catch (error) {
      console.error('Error adding link:', error);
    }
  };

  const handleUrlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingLink) return;
    const currentLink = editingLink;
    const url = e.target.value;
    try {
      // Basic URL validation
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      const favicon = `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`;
      setEditingLink({
        ...currentLink,
        url,
        favicon,
        title: currentLink.title || urlObj.hostname
      });
      
      if (url && url.match(/^https?:\/\/.+/)) {
        try {
          // Try to get enhanced metadata
          const metadata = await fetchUrlMetadata(url);
          setEditingLink(prev => prev ? ({
            ...prev,
            url,
            title: metadata.title,
            favicon
          }) : prev);
        } catch (error) {
          console.error('Error fetching URL metadata:', error);
          setEditingLink(prev => prev ? ({
            ...prev,
            url,
            favicon
          }) : prev);
        }
      }
    } catch (urlError) {
      console.warn('Invalid URL format:', urlError);
      setEditingLink({ ...currentLink, url });
    }
  };

  /**
   * Renders the main content of the widget
   */
  const renderContent = () => {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-grow overflow-y-auto">
          {links.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <p>No links yet. Add one below!</p>
            </div>
          ) : displayMode === 'compact' ? (
            // Compact view - slim single-column layout with smaller elements
            <div className="space-y-1 pr-1">
              {links.map(link => (
                <a 
                  key={link.id}
                  href={link.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`flex items-center p-1 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 dark:hover:bg-opacity-50 transition-all relative text-gray-800 dark:text-gray-100 group ${
                    loadingLinkIds.includes(link.id) ? 'opacity-50' : ''
                  }`}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  aria-label={`Visit ${link.title} at ${link.url}`}
                >
                  {showFavicons && (
                    <img 
                      src={link.favicon}
                      alt=""
                      className={`w-3 h-3 mr-1.5 ${
                        loadingLinkIds.includes(link.id) ? 'animate-pulse' : ''
                      }`}
                      loading="lazy"
                    />
                  )}
                  <span className="text-xs font-medium flex-grow truncate">
                    {loadingLinkIds.includes(link.id) ? 'Loading...' : link.title}
                  </span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                    <button 
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startEdit(link);
                      }}
                      className="p-0.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      aria-label={`Edit ${link.title} link`}
                      disabled={loadingLinkIds.includes(link.id)}
                    >
                      <Edit size={10} />
                    </button>
                    <button 
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeLink(link.id);
                      }}
                      className="p-0.5 text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                      aria-label={`Remove ${link.title} link`}
                      disabled={loadingLinkIds.includes(link.id)}
                    >
                      <Trash size={10} />
                    </button>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            // Regular view - standard list with normal spacing
            <div className="space-y-2 pr-1">
              {links.map(link => (
                <a 
                  key={link.id}
                  href={link.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`flex items-center p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:hover:bg-opacity-50 transition-all relative text-gray-800 dark:text-gray-100 group ${
                    loadingLinkIds.includes(link.id) ? 'opacity-50' : ''
                  }`}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  aria-label={`Visit ${link.title} at ${link.url}`}
                >
                  {showFavicons && (
                    <img 
                      src={link.favicon}
                      alt=""
                      className={`w-4 h-4 mr-2.5 ${
                        loadingLinkIds.includes(link.id) ? 'animate-pulse' : ''
                      }`}
                      loading="lazy"
                    />
                  )}
                  <span className="font-medium flex-grow truncate">
                    {loadingLinkIds.includes(link.id) ? 'Loading...' : link.title}
                  </span>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startEdit(link);
                      }}
                      className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      aria-label={`Edit ${link.title} link`}
                      disabled={loadingLinkIds.includes(link.id)}
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeLink(link.id);
                      }}
                      className="p-1 text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                      aria-label={`Remove ${link.title} link`}
                      disabled={loadingLinkIds.includes(link.id)}
                    >
                      <Trash size={14} />
                    </button>
                    <ExternalLink size={14} className="text-gray-400" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Integrated add link form - hidden on small sizes */}
        {isCompact ? (
          <button
            onClick={() => startEdit(null)}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Link
          </button>
        ) : (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <form
              onSubmit={handleQuickAdd}
              className="flex items-center gap-2"
            >
              <Input
                ref={newLinkInputRef}
                type="url"
                value={newLinkUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLinkUrl(e.target.value)}
                placeholder="Paste a URL and press Enter..."
                className="flex-grow"
                disabled={isLoading}
              />
              <button
                type="submit"
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                disabled={!newLinkUrl.trim() || isLoading}
                aria-label="Add link"
              >
                <Plus size={20} />
              </button>
            </form>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={widgetRef} 
      className="widget-container h-full flex flex-col"
    >
      <WidgetHeader 
        title={customTitle}
        onSettingsClick={() => setShowSettings(true)}
      />
      <div className="flex-1 overflow-hidden p-3">
        {renderContent()}
      </div>
      
      {/* Settings Dialog */}
      {showSettings && (
        <Dialog
          open={showSettings}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setShowSettings(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Quick Links Settings</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-2 mt-2">
              <div className="space-y-2">
                <Label htmlFor="widget-title">Title</Label>
                <Input 
                  id="widget-title"
                  value={customTitle} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomTitle(e.target.value)}
                  placeholder="Quick Links"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Display Mode</Label>
                <RadioGroup value={displayMode} onValueChange={(val: string) => setDisplayMode(val as 'regular' | 'compact')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="regular" id="regular-view" />
                    <Label htmlFor="regular-view" className="flex items-center">
                      Regular View
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="compact" id="compact-view" />
                    <Label htmlFor="compact-view" className="flex items-center">
                      Compact View
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="space-y-2">
                <Label>Show Favicons</Label>
                <div className="flex items-center space-x-2">
                  <Switch 
                    checked={showFavicons}
                    onCheckedChange={setShowFavicons}
                    id="show-favicons"
                  />
                  <Label htmlFor="show-favicons">Show website icons</Label>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              {/* Remove pt-6 border-t border-gray-100 dark:border-gray-800 classes */}
              <div className="flex justify-between w-full">
                <div>
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
                </div>
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
      )}

      {/* Edit Link Dialog */}
      {editingLink && (
        <Dialog
          open={true}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setEditingLink(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">

              <div className="space-y-2 mt-4">
                <Label htmlFor="url-input">URL</Label>
                <Input 
                  id="url-input"
                  type="url" 
                  value={editingLink.url} 
                  onChange={handleUrlChange}
                  placeholder="https://google.com"
                  className="w-full truncate"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title-input">Display Title</Label>
                <Input 
                  id="title-input"
                  type="text" 
                  value={editingLink.title} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingLink({...editingLink, title: e.target.value})}
                  placeholder="Override auto-detected title"
                />
              </div>
            </div>
            <DialogFooter>
              <div className="flex justify-end">
                <Button
                  variant="default"
                  onClick={() => {
                    if (editingLink.url) {
                      addLink();
                      setEditingLink(null);
                    }
                  }}
                  disabled={!editingLink.url}
                >
                  {editingLink.id ? 'Update' : 'Add'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default QuickLinksWidget 