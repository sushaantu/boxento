import React, { useState, useEffect } from 'react';
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
import { RivenWidgetConfig, RivenWidgetProps, TMDBResult } from './types';
import { Film, Search, ExternalLink, Plus, Loader2, Check, Star, Tv } from 'lucide-react';

// TMDB Read Access Token (same as Riven frontend uses)
const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlNTkxMmVmOWFhM2IxNzg2Zjk3ZTE1NWY1YmQ3ZjY1MSIsInN1YiI6IjY1M2NjNWUyZTg5NGE2MDBmZjE2N2FmYyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.xrIXsMFJpI1o1j5g2QpQcFP1X3AfRjFA5FlBFO5Naw8';

const RivenWidget: React.FC<RivenWidgetProps> = ({ width, height, config }) => {
  const defaultConfig: RivenWidgetConfig = {
    title: 'Riven',
    baseUrl: 'https://mini.tailf2415.ts.net:3000',
    apiUrl: 'https://mini.tailf2415.ts.net:7504',
    apiKey: ''
  };

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<RivenWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');

  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  const openRiven = () => {
    window.open(localConfig.baseUrl, '_blank', 'noopener,noreferrer');
  };

  // Search TMDB
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      const endpoint = mediaType === 'movie'
        ? `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(searchQuery.trim())}&include_adult=false`
        : `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(searchQuery.trim())}&include_adult=false`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${TMDB_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      const results = (data.results || []).map((item: TMDBResult) => ({
        ...item,
        media_type: mediaType
      }));
      setSearchResults(results.slice(0, 8));
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
            media_type: item.media_type
          })
        }
      );

      // Accept any 2xx status as success
      if (response.status >= 200 && response.status < 300) {
        setAddedIds(prev => new Set([...prev, item.id]));
        return;
      }

      // Try to get error details
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || data.detail || `Status ${response.status}`);
    } catch (err) {
      // If we got a network error but the item was likely added, show success
      // (CORS issues can cause this - request succeeds but response is blocked)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setAddedIds(prev => new Set([...prev, item.id]));
        return;
      }
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

  const isCompact = width <= 2 && height <= 2;
  const hasApiKey = !!localConfig.apiKey;

  const renderCompactView = () => (
    <button
      onClick={openRiven}
      className="flex flex-col items-center justify-center h-full p-2 text-center hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors w-full"
    >
      <Film className="w-8 h-8 mb-1 text-purple-500" />
      <span className="text-sm font-medium">Riven</span>
    </button>
  );

  const renderResultItem = (item: TMDBResult) => {
    const isAdding = addingId === item.id;
    const isAdded = addedIds.has(item.id);

    return (
      <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
        <div className="w-10 h-14 flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
          {item.poster_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
              alt={getTitle(item)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-5 h-5 text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-grow min-w-0">
          <div className="font-medium text-sm truncate">{getTitle(item)}</div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{item.media_type === 'movie' ? 'Movie' : 'TV'}</span>
            {getYear(item) && <span>{getYear(item)}</span>}
            {item.vote_average > 0 && (
              <span className="flex items-center">
                <Star className="w-3 h-3 mr-0.5 text-yellow-500" />
                {item.vote_average.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <Button
          variant={isAdded ? 'outline' : 'default'}
          size="sm"
          onClick={() => addToRiven(item)}
          disabled={isAdding || isAdded || !hasApiKey}
          className="flex-shrink-0"
        >
          {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>
    );
  };

  const renderFullView = () => (
    <div className="flex flex-col h-full p-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <Film className="w-6 h-6 text-purple-500" />
        </div>
        <div className="flex-grow">
          <div className="font-semibold">Riven</div>
          <div className="text-xs text-gray-500">Media requests</div>
        </div>
        <Button variant="ghost" size="sm" onClick={openRiven}>
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSearch} className="mb-2">
        <div className="flex gap-2 mb-2">
          <Button
            type="button"
            variant={mediaType === 'movie' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setMediaType('movie'); setSearchResults([]); }}
            className="flex-1"
          >
            <Film className="w-3 h-3 mr-1" />
            Movie
          </Button>
          <Button
            type="button"
            variant={mediaType === 'tv' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setMediaType('tv'); setSearchResults([]); }}
            className="flex-1"
          >
            <Tv className="w-3 h-3 mr-1" />
            TV
          </Button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder={`Search ${mediaType === 'movie' ? 'movies' : 'TV shows'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="default" size="sm" disabled={!searchQuery.trim() || searching}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
      </form>

      {error && <div className="text-sm text-red-500 mb-2">{error}</div>}
      {!hasApiKey && searchResults.length > 0 && (
        <div className="text-xs text-amber-500 mb-2">Configure Riven API key to add items</div>
      )}

      <div className="flex-grow overflow-auto space-y-1">
        {searchResults.map(renderResultItem)}
        {searchResults.length === 0 && !searching && (
          <div className="text-sm text-gray-400 text-center py-8">
            Search for movies or TV shows to add to Riven
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    if (isCompact) return renderCompactView();
    return renderFullView();
  };

  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  };

  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Riven Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title-input">Widget Title</Label>
            <Input
              id="title-input"
              type="text"
              value={localConfig.title || ''}
              onChange={(e) => setLocalConfig({ ...localConfig, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url-input">Riven Frontend URL</Label>
            <Input
              id="url-input"
              type="url"
              value={localConfig.baseUrl || ''}
              onChange={(e) => setLocalConfig({ ...localConfig, baseUrl: e.target.value })}
              placeholder="https://mini.tailf2415.ts.net:3000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-url-input">Riven API URL</Label>
            <Input
              id="api-url-input"
              type="url"
              value={localConfig.apiUrl || ''}
              onChange={(e) => setLocalConfig({ ...localConfig, apiUrl: e.target.value })}
              placeholder="https://mini.tailf2415.ts.net:7504"
            />
            <p className="text-xs text-gray-500">Backend API (port 7504)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key-input">Riven API Key</Label>
            <Input
              id="api-key-input"
              type="password"
              value={localConfig.apiKey || ''}
              onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
              placeholder="Your Riven API key"
            />
            <p className="text-xs text-gray-500">Generate from Riven Settings → General</p>
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

export default RivenWidget;
