import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { Switch } from '../../ui/switch';
import WidgetHeader from '../common/WidgetHeader';
import { WidgetProps } from '@/types';
import { ServicesWidgetConfig, Service } from './types';
import { cn } from '@/lib/utils';
import {
  Globe,
  Server,
  LayoutGrid,
  PiggyBank,
  BookOpen,
  Play,
  Film,
  Bot,
  Plus,
  Trash2,
  LucideIcon,
  ArrowUpRight,
  Wifi,
  WifiOff,
  Activity,
  Search,
  Clock,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';

type ServicesWidgetProps = WidgetProps<ServicesWidgetConfig>;

// Icon mapping
const ICONS: Record<string, LucideIcon> = {
  Globe,
  Server,
  LayoutGrid,
  PiggyBank,
  BookOpen,
  Play,
  Film,
  Bot,
};

// Base URL for services - override with VITE_SERVICES_BASE_URL env var
const SERVICES_BASE_URL = import.meta.env.VITE_SERVICES_BASE_URL || 'http://localhost';
const IS_REMOTE = SERVICES_BASE_URL.includes('https://');

// Service ports - can be overridden with environment variables
const FAVA_PORT = import.meta.env.VITE_FAVA_PORT || '7503';

// Default services
const DEFAULT_SERVICES: Service[] = [
  {
    id: 'boxento',
    name: 'Boxento',
    url: IS_REMOTE ? SERVICES_BASE_URL : `${SERVICES_BASE_URL}:5173`,
    icon: 'LayoutGrid',
    description: 'Dashboard',
    category: 'Utilities'
  },
  {
    id: 'paisa',
    name: 'Paisa',
    url: `${SERVICES_BASE_URL}:7500`,
    icon: 'PiggyBank',
    description: 'Personal Finance',
    category: 'Finance'
  },
  {
    id: 'fava',
    name: 'Fava',
    url: `${SERVICES_BASE_URL}:${FAVA_PORT}`,
    icon: 'BookOpen',
    description: 'Beancount',
    category: 'Finance'
  },
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    url: `${SERVICES_BASE_URL}:8096`,
    icon: 'Play',
    description: 'Media Server',
    category: 'Media'
  },
  {
    id: 'riven',
    name: 'Riven',
    url: `${SERVICES_BASE_URL}:3000`,
    icon: 'Film',
    description: 'Media Requests',
    category: 'Media'
  },
  {
    id: 'ollama',
    name: 'Open WebUI',
    url: `${SERVICES_BASE_URL}:3080`,
    icon: 'Bot',
    description: 'Local AI Chat',
    category: 'AI'
  }
];

const DEFAULT_CONFIG: ServicesWidgetConfig = {
  title: 'Services',
  services: DEFAULT_SERVICES,
  showStatus: true,
  checkInterval: 60
};

const mergeConfigWithDefaults = (config?: ServicesWidgetConfig): ServicesWidgetConfig => ({
  ...DEFAULT_CONFIG,
  ...config,
  services: config?.services ?? DEFAULT_SERVICES
});

const getIcon = (iconName?: string): LucideIcon => {
  if (!iconName) return Globe;
  return ICONS[iconName] || Globe;
};

const getStatusColor = (status?: 'online' | 'offline' | 'checking') => {
  switch (status) {
    case 'online':
      return 'bg-green-500';
    case 'offline':
      return 'bg-red-500';
    case 'checking':
      return 'bg-yellow-500 animate-pulse';
    default:
      return 'bg-muted-foreground';
  }
};

const getStatusLabel = (status?: 'online' | 'offline' | 'checking') => {
  switch (status) {
    case 'online':
      return 'Online';
    case 'offline':
      return 'Offline';
    case 'checking':
      return 'Checking';
    default:
      return 'Unknown';
  }
};

const getStatusIcon = (status?: 'online' | 'offline' | 'checking') => {
  switch (status) {
    case 'online':
      return Wifi;
    case 'offline':
      return WifiOff;
    default:
      return Activity;
  }
};

const getServiceHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
};

const getServicePort = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  } catch {
    return '';
  }
};

const ServicesWidget: React.FC<ServicesWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const mergedConfig = useMemo(() => mergeConfigWithDefaults(config), [config]);

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<ServicesWidgetConfig>(() => mergedConfig);
  const [configSnapshot, setConfigSnapshot] = useState<ServicesWidgetConfig>(() => mergedConfig);
  const [serviceStatus, setServiceStatus] = useState<Record<string, 'online' | 'offline' | 'checking'>>({});
  const [responseTime, setResponseTime] = useState<Record<string, number>>({});
  const [showAddService, setShowAddService] = useState<boolean>(false);
  const [newService, setNewService] = useState<Partial<Service>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // App-mode state
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Update local config when props change
  useEffect(() => {
    setLocalConfig(mergedConfig);
  }, [mergedConfig]);

  // Check service status
  const checkServiceStatus = useCallback(async (service: Service) => {
    setServiceStatus(prev => ({ ...prev, [service.id]: 'checking' }));

    try {
      const urlToCheck = service.statusUrl || service.url;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const start = performance.now();

      await fetch(urlToCheck, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const elapsed = Math.round(performance.now() - start);
      setResponseTime(prev => ({ ...prev, [service.id]: elapsed }));
      setServiceStatus(prev => ({ ...prev, [service.id]: 'online' }));
    } catch {
      setServiceStatus(prev => ({ ...prev, [service.id]: 'offline' }));
      setResponseTime(prev => {
        const next = { ...prev };
        delete next[service.id];
        return next;
      });
    }
  }, []);

  // Check all services on mount and interval
  useEffect(() => {
    if (!localConfig.showStatus) return;

    const checkAll = () => {
      localConfig.services.forEach(service => {
        checkServiceStatus(service);
      });
    };

    checkAll();
    const interval = setInterval(checkAll, (localConfig.checkInterval || 60) * 1000);

    return () => clearInterval(interval);
  }, [localConfig.services, localConfig.showStatus, localConfig.checkInterval, checkServiceStatus]);

  // Measure container width
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setContainerWidth(element.getBoundingClientRect().width);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // Open service in new tab
  const openService = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // Computed stats
  const { categories, onlineCount, offlineCount, checkingCount } = useMemo(() => {
    const cats = new Set<string>();
    let online = 0;
    let offline = 0;
    let checking = 0;

    localConfig.services.forEach(service => {
      if (service.category) cats.add(service.category);
      const status = serviceStatus[service.id];
      if (status === 'online') online += 1;
      else if (status === 'offline') offline += 1;
      else if (status === 'checking') checking += 1;
    });

    return {
      categories: Array.from(cats).sort(),
      onlineCount: online,
      offlineCount: offline,
      checkingCount: checking,
    };
  }, [localConfig.services, serviceStatus]);

  // Filtered services (for app/panel mode)
  const filteredServices = useMemo(() => {
    let services = localConfig.services;
    if (selectedCategory) {
      services = services.filter(s => s.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      services = services.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.url.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
      );
    }
    return services;
  }, [localConfig.services, selectedCategory, searchQuery]);

  const selectedService = useMemo(() => {
    if (!selectedServiceId) return null;
    return localConfig.services.find(s => s.id === selectedServiceId) || null;
  }, [localConfig.services, selectedServiceId]);

  const getGridColumns = (measuredWidth: number) => {
    if (measuredWidth >= 1500) return 5;
    if (measuredWidth >= 1100) return 4;
    if (measuredWidth >= 680) return 3;
    if (measuredWidth >= 430) return 2;
    if (width >= 12) return 5;
    if (width >= 9) return 4;
    if (width >= 6) return 3;
    if (width >= 3) return 2;
    return 1;
  };

  const getCompactGridCols = () => {
    if (width >= 4) return 'grid-cols-4';
    if (width >= 3) return 'grid-cols-3';
    if (width >= 2) return 'grid-cols-2';
    return 'grid-cols-1';
  };

  // --- Size-specific renderers ---

  // 1x1 ICON: online/total count
  const renderTiny = () => {
    const total = localConfig.services.length;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <div className="text-lg font-semibold leading-none text-foreground">
          {localConfig.showStatus ? `${onlineCount}/${total}` : total}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {localConfig.showStatus ? 'online' : 'services'}
        </div>
      </div>
    );
  };

  // Nx1 RIBBON: horizontal scroll with status chips
  const renderShort = () => {
    const services = localConfig.services;
    const ribbonServices = services.slice(0, Math.min(services.length, Math.max(2, width + 1)));
    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs">
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 font-medium text-foreground">
          {services.length} services
        </span>
        {localConfig.showStatus && (
          <>
            <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-1 text-green-700 dark:text-green-300">
              {onlineCount} up
            </span>
            {offlineCount > 0 && (
              <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-300">
                {offlineCount} down
              </span>
            )}
          </>
        )}
        {ribbonServices.map((service) => {
          const Icon = getIcon(service.icon);
          const status = serviceStatus[service.id];
          return (
            <button
              key={service.id}
              onClick={() => openService(service.url)}
              className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5 text-foreground transition-colors hover:bg-accent"
            >
              {localConfig.showStatus && (
                <div className={cn('h-1.5 w-1.5 rounded-full', getStatusColor(status))} />
              )}
              <Icon className="h-3.5 w-3.5" />
              <span className="max-w-[8rem] truncate">{service.name}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // Compact service icon button (for 2x2 / compact grid)
  const renderCompactServiceCard = (service: Service) => {
    const Icon = getIcon(service.icon);
    const status = serviceStatus[service.id];

    return (
      <button
        key={service.id}
        onClick={() => openService(service.url)}
        className="relative flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 p-2 transition-colors hover:bg-accent"
        title={`${service.name}${service.description ? ` - ${service.description}` : ''}`}
      >
        {localConfig.showStatus && (
          <div className={cn('absolute top-1 right-1 h-2 w-2 rounded-full', getStatusColor(status))} />
        )}
        <Icon className="h-6 w-6 text-foreground" />
        <span className="w-full truncate text-center text-xs font-medium text-foreground">{service.name}</span>
      </button>
    );
  };

  // Full service card (for default / panel grid)
  const renderFullServiceCard = (service: Service) => {
    const Icon = getIcon(service.icon);
    const status = serviceStatus[service.id];
    const serviceHost = getServiceHost(service.url);
    const StatusIcon = getStatusIcon(status);

    return (
      <button
        key={service.id}
        onClick={() => openService(service.url)}
        className="group flex h-full min-h-[112px] flex-col justify-between rounded-xl border border-border bg-muted/30 p-4 text-left transition-colors hover:bg-accent"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-card text-foreground shadow-sm ring-1 ring-border">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{service.name}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{serviceHost}</div>
            </div>
          </div>
          {localConfig.showStatus && (
            <div className="flex items-center gap-1.5 rounded-full bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
              <div className={cn('h-2 w-2 rounded-full', getStatusColor(status))} />
              <StatusIcon className="h-3.5 w-3.5" />
              <span>{getStatusLabel(status)}</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 mt-2">
          <div className="line-clamp-2 text-sm text-muted-foreground">
            {service.description || 'Open service dashboard'}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground mt-2">
          <div className="flex min-w-0 items-center gap-2">
            {service.category && (
              <span className="truncate rounded-full bg-card px-2 py-1 ring-1 ring-border">
                {service.category}
              </span>
            )}
            {responseTime[service.id] !== undefined && localConfig.showStatus && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {responseTime[service.id]}ms
              </span>
            )}
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      </button>
    );
  };

  // Compact (2x2): grid of icon buttons
  const renderCompact = () => (
    <div className={cn('grid gap-2 h-full overflow-auto', getCompactGridCols())}>
      {localConfig.services.map(service => renderCompactServiceCard(service))}
    </div>
  );

  // Default (3x3): summary bar + service card grid
  const renderDefault = () => {
    const services = localConfig.services;
    const regularColumns = Math.min(getGridColumns(containerWidth), Math.max(services.length, 1));

    return (
      <div className="flex h-full flex-col gap-3 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
            {services.length} services
          </span>
          {localConfig.showStatus && (
            <>
              <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-green-700 dark:text-green-300">
                {onlineCount} online
              </span>
              {offlineCount > 0 && (
                <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-red-700 dark:text-red-300">
                  {offlineCount} offline
                </span>
              )}
              {checkingCount > 0 && (
                <span className="rounded-full bg-yellow-500/10 px-2.5 py-1 text-yellow-700 dark:text-yellow-300">
                  {checkingCount} checking
                </span>
              )}
            </>
          )}
        </div>

        <div
          className="grid flex-1 gap-3 overflow-auto pr-1"
          style={{
            gridTemplateColumns: `repeat(${regularColumns}, minmax(0, 1fr))`,
            gridAutoRows: 'minmax(112px, auto)',
          }}
        >
          {services.map(service => renderFullServiceCard(service))}
        </div>
      </div>
    );
  };

  // Panel (4x4-5x5): category sidebar + service grid
  const renderPanel = () => {
    const panelColumns = Math.min(getGridColumns(containerWidth * 0.65), Math.max(filteredServices.length, 1));

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Summary bar */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{localConfig.services.length} services</span>
            {localConfig.showStatus && (
              <>
                <span className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  {onlineCount} up
                </span>
                {offlineCount > 0 && (
                  <span className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    {offlineCount} down
                  </span>
                )}
              </>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-40 pl-7 text-xs"
            />
          </div>
        </div>
        {/* Two-column content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Category sidebar */}
          <div className="w-36 shrink-0 border-r border-border overflow-y-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'w-full px-3 py-2 text-left text-xs transition-colors hover:bg-accent',
                !selectedCategory && 'bg-accent font-medium text-foreground'
              )}
            >
              All ({localConfig.services.length})
            </button>
            {categories.map(cat => {
              const count = localConfig.services.filter(s => s.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-xs transition-colors hover:bg-accent',
                    selectedCategory === cat && 'bg-accent font-medium text-foreground'
                  )}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
          {/* Service grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredServices.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No services match filter
              </div>
            ) : (
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${panelColumns}, minmax(0, 1fr))`,
                  gridAutoRows: 'minmax(112px, auto)',
                }}
              >
                {filteredServices.map(service => renderFullServiceCard(service))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // App (6x6+): full service dashboard - master-detail with categories, search, response times
  const renderApp = () => {
    return (
      <div className="flex h-full overflow-hidden">
        {/* Left sidebar: categories + service list */}
        <div className="flex w-1/3 min-w-[200px] max-w-[320px] flex-col border-r border-border">
          {/* Search */}
          <div className="p-2 widget-drag-handle cursor-move">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>

          {/* Category filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5 border-b border-border">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                !selectedCategory
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Service list */}
          <div className="flex-1 overflow-y-auto">
            {filteredServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-4">
                <Search className="h-6 w-6" />
                <span className="text-sm">No services found</span>
              </div>
            ) : (
              filteredServices.map(service => {
                const Icon = getIcon(service.icon);
                const status = serviceStatus[service.id];
                const isSelected = selectedServiceId === service.id;
                return (
                  <div
                    key={service.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-border/50 transition-colors hover:bg-accent',
                      isSelected && 'bg-accent'
                    )}
                    onClick={() => setSelectedServiceId(service.id)}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-card ring-1 ring-border">
                      <Icon className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{service.name}</span>
                        {localConfig.showStatus && (
                          <div className={cn('h-2 w-2 shrink-0 rounded-full', getStatusColor(status))} />
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground mt-0.5">
                        {service.description || getServiceHost(service.url)}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom status bar */}
          <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span>{localConfig.services.length} total</span>
            {localConfig.showStatus && (
              <>
                <span className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  {onlineCount}
                </span>
                <span className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {offlineCount}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right detail pane */}
        <div className="flex-1 overflow-y-auto">
          {selectedService ? (
            <div className="p-6">
              {renderServiceDetail(selectedService)}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Server className="h-10 w-10" />
              <div className="text-center">
                <p className="text-sm font-medium">Select a service</p>
                <p className="text-xs mt-1">Choose a service from the list to view details</p>
              </div>
              {/* Overview grid */}
              <div className="mt-4 w-full max-w-lg px-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-card p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{localConfig.services.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">Total</div>
                  </div>
                  {localConfig.showStatus && (
                    <>
                      <div className="rounded-lg border border-border bg-card p-3 text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">{onlineCount}</div>
                        <div className="text-xs text-muted-foreground mt-1">Online</div>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-3 text-center">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{offlineCount}</div>
                        <div className="text-xs text-muted-foreground mt-1">Offline</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Service detail view (used in app mode detail pane)
  const renderServiceDetail = (service: Service) => {
    const Icon = getIcon(service.icon);
    const status = serviceStatus[service.id];
    const StatusIcon = getStatusIcon(status);
    const rt = responseTime[service.id];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-foreground shadow-sm ring-1 ring-border">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{service.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {service.description || 'No description'}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => openService(service.url)}>
            <ArrowUpRight className="h-4 w-4 mr-1" />
            Open
          </Button>
        </div>

        {/* Status + response time */}
        {localConfig.showStatus && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs text-muted-foreground mb-2">Status</div>
              <div className="flex items-center gap-2">
                <div className={cn('h-3 w-3 rounded-full', getStatusColor(status))} />
                <StatusIcon className="h-4 w-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">{getStatusLabel(status)}</span>
              </div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs text-muted-foreground mb-2">Response Time</div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {rt !== undefined ? `${rt}ms` : '--'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Connection details */}
        <div className="rounded-lg border border-border divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">URL</span>
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono text-foreground hover:underline"
            >
              {service.url}
            </a>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Host</span>
            <span className="text-sm text-foreground">{getServiceHost(service.url)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Port</span>
            <span className="text-sm font-mono text-foreground">{getServicePort(service.url)}</span>
          </div>
          {service.category && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Category</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                <FolderOpen className="h-3 w-3" />
                {service.category}
              </span>
            </div>
          )}
          {service.statusUrl && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Health URL</span>
              <span className="text-sm font-mono text-foreground">{service.statusUrl}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkServiceStatus(service)}
          >
            <Activity className="h-4 w-4 mr-1" />
            Check Now
          </Button>
        </div>
      </div>
    );
  };

  // Empty state
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
      <Server className="w-8 h-8" />
      <span className="text-sm">No services configured</span>
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
          Add services
        </Button>
      )}
    </div>
  );

  // --- Settings modal ---
  const handleSettingsOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      // Snapshot on open
      const snap = mergeConfigWithDefaults(config);
      setConfigSnapshot(snap);
      setLocalConfig(snap);
    } else {
      // Revert on close (cancel)
      setLocalConfig(configSnapshot);
    }
    setShowSettings(nextOpen);
  }, [config, configSnapshot]);

  const handleCancelSettings = useCallback(() => {
    setLocalConfig(configSnapshot);
    setShowSettings(false);
  }, [configSnapshot]);

  const saveSettings = useCallback(() => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  }, [config, localConfig]);

  const handleDeleteService = useCallback((serviceId: string) => {
    setLocalConfig(prev => ({
      ...prev,
      services: prev.services.filter(s => s.id !== serviceId)
    }));
  }, []);

  const handleAddService = useCallback(() => {
    if (!newService.name || !newService.url) return;

    const service: Service = {
      id: `service-${Date.now()}`,
      name: newService.name,
      url: newService.url,
      icon: newService.icon || 'Globe',
      description: newService.description,
      category: newService.category
    };

    setLocalConfig(prev => ({
      ...prev,
      services: [...prev.services, service]
    }));
    setNewService({});
    setShowAddService(false);
  }, [newService]);

  const renderServiceSettingsRow = useCallback((service: Service) => {
    const Icon = getIcon(service.icon);
    const status = serviceStatus[service.id];
    const StatusIcon = getStatusIcon(status);

    return (
      <div
        key={service.id}
        className="grid min-w-[760px] grid-cols-[minmax(0,1.1fr)_minmax(0,1.7fr)_minmax(0,0.85fr)_auto] gap-3 px-3 py-2.5"
      >
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 flex size-7 flex-shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
            <Icon className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{service.name}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {service.description || 'No description'}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="truncate font-mono text-[11px] text-foreground" title={service.url}>
            {service.url}
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {getServiceHost(service.url)} : {getServicePort(service.url)}
          </div>
        </div>

        <div className="min-w-0 text-[11px] text-muted-foreground">
          <div className="truncate">{service.category || 'Uncategorized'}</div>
          {localConfig.showStatus && (
            <div
              className={cn(
                'mt-1 inline-flex items-center gap-1 font-medium',
                status === 'online' && 'text-emerald-700 dark:text-emerald-300',
                status === 'offline' && 'text-rose-700 dark:text-rose-300'
              )}
            >
              <div className={cn('size-1.5 rounded-full', getStatusColor(status))} />
              <StatusIcon className="size-3" />
              <span>{getStatusLabel(status)}</span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-1 justify-self-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openService(service.url)}
            aria-label={`Open ${service.name}`}
          >
            <ArrowUpRight />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDeleteService(service.id)}
            aria-label={`Delete ${service.name}`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    );
  }, [handleDeleteService, localConfig.showStatus, openService, serviceStatus]);

  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-[980px]">
        <DialogHeader className="gap-2 px-6 pt-6">
          <DialogTitle>{localConfig.title || 'Services'} Settings</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="title-input">Widget title</Label>
              <Input
                id="title-input"
                type="text"
                value={localConfig.title || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalConfig(prev => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 px-3 py-2 md:min-w-[280px]">
              <div className="min-w-0">
                <Label htmlFor="status-toggle" className="text-sm font-medium">
                  Show status indicators
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Surface online/offline state and response times.
                </p>
              </div>
              <Switch
                id="status-toggle"
                checked={Boolean(localConfig.showStatus)}
                onCheckedChange={(checked: boolean) =>
                  setLocalConfig(prev => ({ ...prev, showStatus: checked }))
                }
              />
            </div>
          </div>

          {localConfig.showStatus && (
            <div className="space-y-2">
              <Label htmlFor="interval-input">Check interval (seconds)</Label>
              <Input
                id="interval-input"
                type="number"
                min={10}
                max={3600}
                value={localConfig.checkInterval || 60}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalConfig(prev => ({ ...prev, checkInterval: Number(e.target.value) || 60 }))
                }
                className="w-32"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">Services</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {localConfig.services.length} total · {categories.length} categories
                {localConfig.showStatus ? ` · ${onlineCount} online · ${offlineCount} offline` : ' · status hidden'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAddService(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add service
            </Button>
          </div>

          <div className="overflow-hidden rounded-md border border-border/70">
            <div className="overflow-x-auto">
              <div className="grid min-w-[760px] grid-cols-[minmax(0,1.1fr)_minmax(0,1.7fr)_minmax(0,0.85fr)_auto] gap-3 border-b border-border/70 bg-muted/20 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <span>Service</span>
                <span>URL</span>
                <span>Meta</span>
                <span className="justify-self-end">Actions</span>
              </div>

              <div className="max-h-[min(54vh,520px)] divide-y divide-border/70 overflow-y-auto">
                {localConfig.services.map((service) => renderServiceSettingsRow(service))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4">
          <div className="flex justify-between w-full">
            {config?.onDelete && (
              <Button variant="destructive" onClick={config.onDelete}>Delete Widget</Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={handleCancelSettings}>Cancel</Button>
              <Button onClick={saveSettings}>Save</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const renderAddServiceDialog = () => (
    <Dialog open={showAddService} onOpenChange={setShowAddService}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Service</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="service-name">Name *</Label>
            <Input
              id="service-name"
              type="text"
              placeholder="My Service"
              value={newService.name || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewService(prev => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="service-url">URL *</Label>
            <Input
              id="service-url"
              type="url"
              placeholder="https://example.com"
              value={newService.url || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewService(prev => ({ ...prev, url: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="service-icon">Icon (Lucide icon name)</Label>
            <Input
              id="service-icon"
              type="text"
              placeholder="Globe, Server, Database..."
              value={newService.icon || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewService(prev => ({ ...prev, icon: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="service-desc">Description</Label>
            <Input
              id="service-desc"
              type="text"
              placeholder="What this service does"
              value={newService.description || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewService(prev => ({ ...prev, description: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="service-category">Category</Label>
            <Input
              id="service-category"
              type="text"
              placeholder="Finance, Media, AI..."
              value={newService.category || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewService(prev => ({ ...prev, category: e.target.value }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-end w-full gap-2">
            <Button variant="outline" onClick={() => setShowAddService(false)}>Cancel</Button>
            <Button
              onClick={handleAddService}
              disabled={!newService.name || !newService.url}
            >
              Add Service
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // --- Main render ---
  const services = localConfig.services || [];
  const hasServices = services.length > 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        'widget-container h-full flex flex-col',
        isTiny ? 'widget-drag-handle' : '',
        isTiny ? 'p-1' : isShort ? 'p-1.5' : 'p-2 md:p-3'
      )}
    >
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title || DEFAULT_CONFIG.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      <div className={cn('flex-1 overflow-hidden', isTiny ? 'p-1' : '')}>
        {!hasServices
          ? renderEmptyState()
          : isTiny ? renderTiny()
          : isShort ? renderShort()
          : isApp ? renderApp()
          : isWide && isTall ? renderPanel()
          : isCompact ? renderCompact()
          : renderDefault()}
      </div>

      {!readOnly && renderSettings()}
      {!readOnly && renderAddServiceDialog()}
    </div>
  );
};

export default ServicesWidget;
