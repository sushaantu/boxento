import React, { useState, useRef, useMemo } from 'react'
import { ExternalLink, Plus, Trash, Edit, Search, Globe, X, Pencil, Trash2, FolderOpen } from 'lucide-react'
import { WidgetSettingsDialog, WidgetSettingsDialogFooter } from '../../widgets/common/WidgetSettingsDialog'
import { WidgetShell } from '../../widgets/common/WidgetShell'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../ui/dialog'
import { Input } from '@/components/ui/input'
import { QuickLinksWidgetProps, LinkItem } from './types'
import { Button } from '../../ui/button'
import { Label } from '../../ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

// Sanitize URLs to prevent javascript: and data: protocol injection
const sanitizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
    return '#';
  } catch {
    return '#';
  }
};

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

type AppDialogMode = 'add' | 'edit' | 'details';

const createEmptyAppLink = (): LinkItem => ({
  id: 0,
  title: '',
  url: '',
  favicon: '',
  category: '',
});

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
const QuickLinksWidget: React.FC<QuickLinksWidgetProps> = ({ width, height, config }) => {
  const isTiny = width === 1 && height === 1;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;
  const [links, setLinks] = useState<LinkItem[]>(config?.links || []);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [newLinkUrl, setNewLinkUrl] = useState<string>('');
  const [isLoading] = useState<boolean>(false);
  const newLinkInputRef = useRef<HTMLInputElement | null>(null);
  const [loadingLinkIds, setLoadingLinkIds] = useState<number[]>([]);

  // App-mode state
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null);
  const [appEditingLink, setAppEditingLink] = useState<LinkItem | null>(null);
  const [appDialogMode, setAppDialogMode] = useState<AppDialogMode | null>(null);

  // Widget settings state
  const [displayMode, setDisplayMode] = useState<'regular' | 'compact'>(config?.displayMode || 'regular');
  const [showFavicons, setShowFavicons] = useState<boolean>(config?.showFavicons !== false);
  const [customTitle, setCustomTitle] = useState<string>(config?.customTitle || 'Quick Links');

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sync local widget state only when upstream config changes
  }, [config]);

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
    if (selectedLinkId === id) {
      setSelectedLinkId(null);
    }
    if (appEditingLink?.id === id) {
      setAppEditingLink(null);
    }
    if ((selectedLinkId === id || appEditingLink?.id === id) && appDialogMode) {
      setAppDialogMode(null);
    }
    
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

  const resetSettings = () => {
    if (config) {
      setDisplayMode(config.displayMode || 'regular');
      setShowFavicons(config.showFavicons !== false);
      setCustomTitle(config.customTitle || 'Quick Links');
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

  // ─── App-mode helpers ─────────────────────────────────────────────────
  const filteredLinks = useMemo(() => {
    if (!appSearchQuery.trim()) return links;
    const q = appSearchQuery.toLowerCase();
    return links.filter(
      l =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.category && l.category.toLowerCase().includes(q))
    );
  }, [links, appSearchQuery]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    links.forEach(l => { if (l.category) cats.add(l.category); });
    return Array.from(cats).sort();
  }, [links]);

  const selectedLink = useMemo(
    () => links.find(l => l.id === selectedLinkId) ?? null,
    [links, selectedLinkId]
  );

  const openAppAddDialog = () => {
    setAppEditingLink(createEmptyAppLink());
    setSelectedLinkId(null);
    setAppDialogMode('add');
  };

  const openAppEditDialog = (link: LinkItem) => {
    setAppEditingLink({ ...link });
    setSelectedLinkId(link.id);
    setAppDialogMode('edit');
  };

  const openAppDetailsDialog = (linkId: number) => {
    setSelectedLinkId(linkId);
    setAppEditingLink(null);
    setAppDialogMode('details');
  };

  const closeAppDialog = () => {
    setAppDialogMode(null);
    setAppEditingLink(null);
  };

  const handleAppAddLink = async () => {
    if (!appEditingLink || !appEditingLink.url.trim()) return;
    const normalizedUrl = appEditingLink.url.startsWith('http')
      ? appEditingLink.url
      : `https://${appEditingLink.url}`;

    let title = appEditingLink.title;
    let favicon = appEditingLink.favicon;
    try {
      const urlObj = new URL(normalizedUrl);
      if (!favicon) favicon = `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`;
      if (!title) title = urlObj.hostname;
    } catch {
      if (!title) title = normalizedUrl;
      if (!favicon) favicon = '';
    }

    const newId = Math.max(0, ...links.map(l => l.id), 0) + 1;
    const newLink: LinkItem = {
      id: appEditingLink.id || newId,
      url: normalizedUrl,
      title,
      favicon,
      category: appEditingLink.category || undefined,
    };

    let updatedLinks: LinkItem[];
    if (appEditingLink.id) {
      updatedLinks = links.map(l => (l.id === appEditingLink.id ? newLink : l));
    } else {
      updatedLinks = [...links, newLink];
    }

    const previousLinks = links;
    setLinks(updatedLinks);

    // Persist
    try {
      if (config?.onUpdate) {
        await Promise.resolve(config.onUpdate({ ...config, links: updatedLinks }));
      }
    } catch (error) {
      console.error('Error updating quick links:', error);
      setLinks(previousLinks);
      return;
    }

    setSelectedLinkId(newLink.id);
    closeAppDialog();

    // Fetch metadata in background
    try {
      const metadata = await fetchUrlMetadata(normalizedUrl);
      if (metadata.title !== title) {
        const enriched = { ...newLink, title: metadata.title, favicon: metadata.favicon };
        const enrichedLinks = updatedLinks.map(l => (l.id === newLink.id ? enriched : l));
        setLinks(enrichedLinks);
        if (config?.onUpdate) {
          await Promise.resolve(config.onUpdate({ ...config, links: enrichedLinks }));
        }
      }
    } catch { /* best-effort */ }
  };

  // ─── App view (6x6+) ────────────────────────────────────────────────
  const renderAppView = () => {
    return (
      <div className="flex h-full flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-3 py-2">
          <div
            data-testid="quick-links-header"
            className="widget-drag-handle flex shrink-0 cursor-move items-center gap-2 rounded-md px-1 py-0.5"
          >
            <h2 className="text-lg font-semibold text-foreground">
              {customTitle}
            </h2>
            <span className="shrink-0 text-xs text-muted-foreground">
              {filteredLinks.length} / {links.length} links
            </span>
          </div>
          <div className="relative min-w-0 max-w-md flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={appSearchQuery}
              onChange={e => setAppSearchQuery(e.target.value)}
              placeholder="Search links..."
              className="pl-8 pr-8"
            />
            {appSearchQuery && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear search"
                onClick={() => setAppSearchQuery('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              >
                <X size={14} />
              </Button>
            )}
          </div>
          {!readOnly && (
            <Button
              size="sm"
              onClick={openAppAddDialog}
              className="shrink-0"
            >
              <Plus size={14} className="mr-1" />
              Add Link
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pt-2">
          {filteredLinks.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Globe size={32} className="mb-2 opacity-60" />
              <p className="text-sm">
                {appSearchQuery ? 'No links match your search' : 'No links yet. Add your first bookmark!'}
              </p>
              {!readOnly && !appSearchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openAppAddDialog}
                  className="mt-4"
                >
                  <Plus size={14} className="mr-1" />
                  Add Link
                </Button>
              )}
            </div>
          ) : (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
            >
              {filteredLinks.map(link => (
                <div
                  key={link.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openAppDetailsDialog(link.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openAppDetailsDialog(link.id);
                    }
                  }}
                  className={`group relative flex cursor-pointer flex-col rounded-lg border p-3 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selectedLinkId === link.id
                      ? 'border-blue-400 bg-blue-50 shadow-sm dark:border-blue-500 dark:bg-blue-900/20'
                      : 'border-border bg-card hover:border-border'
                  }`}
                >
                  {!readOnly && (
                    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={e => {
                          e.stopPropagation();
                          openAppEditDialog(link);
                        }}
                        aria-label={`Edit ${link.title}`}
                      >
                        <Pencil size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={e => {
                          e.stopPropagation();
                          removeLink(link.id);
                        }}
                        aria-label={`Delete ${link.title}`}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5">
                    {showFavicons && link.favicon && (
                      <img
                        src={link.favicon}
                        alt=""
                        className="h-5 w-5 shrink-0 rounded"
                        loading="lazy"
                      />
                    )}
                    <span className="truncate text-sm font-medium text-foreground">
                      {link.title}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-xs text-muted-foreground">
                    {link.url}
                  </p>
                  {link.category && (
                    <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <FolderOpen size={10} />
                      {link.category}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog
          open={appDialogMode !== null}
          onOpenChange={(open: boolean) => {
            if (!open) {
              closeAppDialog();
            }
          }}
        >
          {(appDialogMode === 'add' || appDialogMode === 'edit') && appEditingLink ? (
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{appDialogMode === 'add' ? 'Add Link' : 'Edit Link'}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={event => {
                  event.preventDefault();
                  void handleAppAddLink();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="app-link-url">URL</Label>
                  <Input
                    id="app-link-url"
                    type="text"
                    inputMode="url"
                    value={appEditingLink.url}
                    onChange={e => setAppEditingLink({ ...appEditingLink, url: e.target.value })}
                    placeholder="https://example.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app-link-title">Title</Label>
                  <Input
                    id="app-link-title"
                    type="text"
                    value={appEditingLink.title}
                    onChange={e => setAppEditingLink({ ...appEditingLink, title: e.target.value })}
                    placeholder="Auto-detected from URL"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app-link-category">Category</Label>
                  <Input
                    id="app-link-category"
                    type="text"
                    value={appEditingLink.category || ''}
                    onChange={e => setAppEditingLink({ ...appEditingLink, category: e.target.value })}
                    placeholder="e.g. Work, Social, News"
                    list="app-link-categories"
                  />
                  {categories.length > 0 && (
                    <datalist id="app-link-categories">
                      {categories.map(category => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeAppDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!appEditingLink.url.trim()}>
                    {appDialogMode === 'add' ? 'Add Link' : 'Save'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          ) : appDialogMode === 'details' && selectedLink ? (
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Link Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {showFavicons && selectedLink.favicon && (
                    <img
                      src={selectedLink.favicon}
                      alt=""
                      className="h-10 w-10 rounded"
                      loading="lazy"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-foreground">
                      {selectedLink.title}
                    </p>
                    {selectedLink.category && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <FolderOpen size={10} />
                        {selectedLink.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>URL</Label>
                  <a
                    href={sanitizeUrl(selectedLink.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {selectedLink.url}
                  </a>
                </div>
                <DialogFooter>
                  <a
                    href={sanitizeUrl(selectedLink.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    <ExternalLink size={14} />
                    Open
                  </a>
                  {!readOnly && (
                    <Button variant="outline" onClick={() => openAppEditDialog(selectedLink)}>
                      <Pencil size={14} className="mr-1" />
                      Edit
                    </Button>
                  )}
                </DialogFooter>
              </div>
            </DialogContent>
          ) : null}
        </Dialog>
      </div>
    );
  };

  /**
   * Renders the main content of the widget
   */
  const renderContent = () => {
    const isShort = height === 1 && width > 1;
    const isCompactLayout = displayMode === 'compact' || width <= 2 || height <= 2;
    const previewLinks = links.slice(0, Math.min(links.length, Math.max(2, width + 1)));
    const firstLink = links[0];

    // App mode takes priority after tiny/short detection
    if (isApp) return renderAppView();

    if (links.length === 0) {
      if (isTiny) {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <div className="text-lg font-semibold leading-none text-foreground">0</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">links</div>
          </div>
        );
      }

      return (
        <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
          <p className="text-xs">No links yet</p>
          {!isTiny && (
            <Button
              variant="link"
              size="sm"
              onClick={() => startEdit(null)}
              className="mt-2 text-xs"
            >
              Add link
            </Button>
          )}
        </div>
      );
    }

    if (isTiny && firstLink) {
      return (
        <a
          href={sanitizeUrl(firstLink.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-full flex-col items-center justify-center gap-1 text-center text-foreground"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <div className="text-lg font-semibold leading-none">{links.length}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">links</div>
        </a>
      );
    }

    if (isShort) {
      return (
        <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs">
          <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 font-medium text-foreground dark:bg-white/[0.06]">
            {links.length} links
          </span>
          {previewLinks.map(link => (
            <a
              key={link.id}
              href={sanitizeUrl(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex shrink-0 items-center gap-2 rounded-full border border-black/5 bg-white/80 px-2.5 py-1.5 text-foreground ring-1 ring-black/5 transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:bg-black/20 dark:ring-white/10 ${
                loadingLinkIds.includes(link.id) ? 'opacity-50' : ''
              }`}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {showFavicons && (
                <img src={link.favicon} alt="" className="h-3.5 w-3.5 rounded-sm" loading="lazy" />
              )}
              <span className="max-w-[8rem] truncate">{loadingLinkIds.includes(link.id) ? 'Loading...' : link.title}</span>
            </a>
          ))}
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        <div className="flex-grow overflow-y-auto">
          {isCompactLayout ? (
            // Compact view - slim single-column layout with smaller elements
            <div className="space-y-1 pr-1">
              {links.map(link => (
                <a 
                  key={link.id}
                  href={sanitizeUrl(link.url)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`flex items-center p-1 rounded-md hover:bg-accent transition-all relative text-foreground group ${
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startEdit(link);
                      }}
                      aria-label={`Edit ${link.title} link`}
                      disabled={loadingLinkIds.includes(link.id)}
                    >
                      <Edit size={10} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeLink(link.id);
                      }}
                      aria-label={`Remove ${link.title} link`}
                      disabled={loadingLinkIds.includes(link.id)}
                    >
                      <Trash size={10} />
                    </Button>
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
                  href={sanitizeUrl(link.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center p-2.5 rounded-lg hover:bg-accent transition-all relative text-foreground group ${
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startEdit(link);
                      }}
                      aria-label={`Edit ${link.title} link`}
                      disabled={loadingLinkIds.includes(link.id)}
                    >
                      <Edit size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeLink(link.id);
                      }}
                      aria-label={`Remove ${link.title} link`}
                      disabled={loadingLinkIds.includes(link.id)}
                    >
                      <Trash size={14} />
                    </Button>
                    <ExternalLink size={14} className="text-muted-foreground" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Integrated add link form - hidden on small sizes */}
        {isCompactLayout ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => startEdit(null)}
            className="mt-2 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Link
          </Button>
        ) : (
          <div className="mt-3 pt-3 border-t border-border">
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
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                disabled={!newLinkUrl.trim() || isLoading}
                aria-label="Add link"
              >
                <Plus size={20} />
              </Button>
            </form>
          </div>
        )}
      </div>
    );
  };

  return (
    <WidgetShell
      title={customTitle}
      isTiny={isTiny}
      hideHeader={isApp}
      compactHeader={width === 1 || height === 1}
      onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
      contentClassName={isTiny ? 'p-2' : isApp ? '' : 'pt-1'}
    >
      {renderContent()}

      {/* Settings Dialog */}
      {showSettings && (
        <WidgetSettingsDialog
          open={showSettings}
          onOpenChange={(open: boolean) => {
            if (!open) {
              resetSettings();
              return;
            }
            setShowSettings(true);
          }}
          title="Quick Links Settings"
          bodyClassName="flex flex-col gap-4 px-1"
          footer={(
            <WidgetSettingsDialogFooter
              onDelete={config?.onDelete ? () => config.onDelete?.() : undefined}
              onCancel={resetSettings}
              onSave={saveSettings}
            />
          )}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="widget-title">Title</Label>
            <Input
              id="widget-title"
              value={customTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomTitle(e.target.value)}
              placeholder="Quick Links"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Display Mode</Label>
            <RadioGroup value={displayMode} onValueChange={(val: string) => setDisplayMode(val as 'regular' | 'compact')}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="regular" id="regular-view" />
                <Label htmlFor="regular-view" className="flex items-center">
                  Regular View
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="compact" id="compact-view" />
                <Label htmlFor="compact-view" className="flex items-center">
                  Compact View
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Show Favicons</Label>
            <div className="flex items-center gap-2">
              <Switch
                checked={showFavicons}
                onCheckedChange={setShowFavicons}
                id="show-favicons"
              />
              <Label htmlFor="show-favicons">Show website icons</Label>
            </div>
          </div>
        </WidgetSettingsDialog>
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
    </WidgetShell>
  )
}

export default QuickLinksWidget 
