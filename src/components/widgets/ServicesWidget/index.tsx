import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import WidgetHeader from '../common/WidgetHeader';
import { WidgetSettingsDialog, WidgetSettingsDialogFooter } from '../common/WidgetSettingsDialog';
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

const ServicesWidget: React.FC<ServicesWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 8 && height >= 6;
  const isDirectory = width >= 6 && height >= 6;
  const showDirectoryFilters = isDirectory || isApp;
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

  // Open service in new tab
  const openService = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // Computed stats
  const { categories, onlineCount, offlineCount } = useMemo(() => {
    const cats = new Set<string>();
    let online = 0;
    let offline = 0;

    localConfig.services.forEach(service => {
      if (service.category) cats.add(service.category);
      const status = serviceStatus[service.id];
      if (status === 'online') online += 1;
      else if (status === 'offline') offline += 1;
    });

    return {
      categories: Array.from(cats).sort(),
      onlineCount: online,
      offlineCount: offline,
    };
  }, [localConfig.services, serviceStatus]);

  // Filtered services (for app/panel mode)
  const filteredServices = useMemo(() => {
    let services = localConfig.services;
    if (showDirectoryFilters && selectedCategory) {
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
  }, [localConfig.services, selectedCategory, searchQuery, showDirectoryFilters]);

  const selectedService = useMemo(() => {
    if (!selectedServiceId) return null;
    return localConfig.services.find(s => s.id === selectedServiceId) || null;
  }, [localConfig.services, selectedServiceId]);

  useEffect(() => {
    if (!isApp) return;

    if (!filteredServices.length) {
      setSelectedServiceId(null);
      return;
    }

    setSelectedServiceId(current =>
      current && filteredServices.some(service => service.id === current)
        ? current
        : filteredServices[0].id
    );
  }, [filteredServices, isApp]);

  const serviceCountLabel = searchQuery || (showDirectoryFilters && selectedCategory)
    ? `${filteredServices.length} of ${localConfig.services.length} services`
    : `${localConfig.services.length} services`;

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
        <Badge variant="secondary" className="shrink-0 bg-muted px-2 py-1 text-foreground">
          {services.length} services
        </Badge>
        {localConfig.showStatus && (
          <>
            <Badge variant="secondary" className="shrink-0 bg-green-500/10 px-2 py-1 text-green-700 dark:text-green-300">
              {onlineCount} up
            </Badge>
            {offlineCount > 0 && (
              <Badge variant="secondary" className="shrink-0 bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-300">
                {offlineCount} down
              </Badge>
            )}
          </>
        )}
        {ribbonServices.map((service) => {
          const Icon = getIcon(service.icon);
          const status = serviceStatus[service.id];
          return (
            <Button type="button" variant="ghost" size="none"
              key={service.id}
              onClick={() => openService(service.url)}
              className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5 text-foreground transition-colors hover:bg-accent"
            >
              {localConfig.showStatus && (
                <div className={cn('h-1.5 w-1.5 rounded-full', getStatusColor(status))} />
              )}
              <Icon className="h-3.5 w-3.5" />
              <span className="max-w-[8rem] truncate">{service.name}</span>
            </Button>
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
      <Button type="button" variant="ghost" size="none"
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
      </Button>
    );
  };

  const renderSimpleServiceRow = (service: Service) => {
    const Icon = getIcon(service.icon);
    const status = serviceStatus[service.id];
    const serviceHost = getServiceHost(service.url);

    return (
      <Button type="button" variant="ghost" size="none"
        key={service.id}
        onClick={() => openService(service.url)}
        className="group flex w-full justify-start rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent"
      >
        <div className="flex w-full min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
            <Icon className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">
                {service.name}
              </span>
              {localConfig.showStatus ? (
                <span className={cn('size-2 shrink-0 rounded-full', getStatusColor(status))} />
              ) : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {serviceHost}
            </div>
          </div>

          <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      </Button>
    );
  };

  // Compact (2x2): grid of icon buttons
  const renderCompact = () => (
    <div className={cn('grid gap-2 h-full overflow-auto', getCompactGridCols())}>
      {localConfig.services.map(service => renderCompactServiceCard(service))}
    </div>
  );

  // Default (3x3): calm launcher list
  const renderDefault = () => {
    const services = localConfig.services;

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 px-1 pb-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{services.length} services</span>
          {localConfig.showStatus ? (
            <>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-green-500" />
                {onlineCount} online
              </span>
              {offlineCount > 0 ? (
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  {offlineCount} offline
                </span>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {services.map(service => renderSimpleServiceRow(service))}
        </div>
      </div>
    );
  };

  const renderDirectoryServiceRow = (service: Service) => {
    const Icon = getIcon(service.icon);
    const status = serviceStatus[service.id];
    const StatusIcon = getStatusIcon(status);

    return (
      <Button type="button" variant="ghost" size="none"
        key={service.id}
        onClick={() => openService(service.url)}
        aria-label={`Open ${service.name}`}
        className="flex w-full justify-start rounded-none border-b border-border/60 px-3 py-3 text-left transition-colors hover:bg-accent last:border-b-0"
      >
        <div className="flex w-full min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card ring-1 ring-border">
            <Icon className="h-4 w-4 text-foreground" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{service.name}</span>
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {service.description || getServiceHost(service.url)}
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 text-xs text-muted-foreground sm:block">
            <div className="truncate">{getServiceHost(service.url)}</div>
            {service.category && (
              <div className="mt-1 truncate">{service.category}</div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            {localConfig.showStatus && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2 py-1 ring-1 ring-border">
                <StatusIcon className="h-3.5 w-3.5" />
                {getStatusLabel(status)}
              </span>
            )}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </Button>
    );
  };

  const renderDirectory = () => (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className={cn('px-3 py-2', showDirectoryFilters ? 'space-y-3' : 'space-y-2')}>
        <div className={cn(
          showDirectoryFilters
            ? 'flex flex-wrap items-center justify-between gap-3'
            : 'flex items-center gap-2'
        )}>
          <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{serviceCountLabel}</span>
          </div>
          <div className={cn(
            'relative min-w-0 flex-1',
            showDirectoryFilters && 'min-w-[12rem] sm:max-w-[18rem]'
          )}>
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>

        {showDirectoryFilters && (
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" variant="ghost" size="none"
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent',
                !selectedCategory && 'bg-accent text-foreground'
              )}
            >
              All ({localConfig.services.length})
            </Button>
            {categories.map(cat => {
              const count = localConfig.services.filter(s => s.category === cat).length;
              return (
                <Button type="button" variant="ghost" size="none"
                  key={cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent',
                    selectedCategory === cat && 'bg-accent text-foreground'
                  )}
                >
                  {cat} ({count})
                </Button>
              );
            })}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/60">
        {filteredServices.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No services match filter
          </div>
        ) : (
          filteredServices.map(service => renderDirectoryServiceRow(service))
        )}
      </div>
    </div>
  );

  // Panel and app sizes keep the same simple job: find a service, see status, open it.
  const renderPanel = () => renderDirectory();

  const renderAppServiceRow = (service: Service) => {
    const Icon = getIcon(service.icon);
    const status = serviceStatus[service.id];
    const isSelected = selectedServiceId === service.id;

    return (
      <Button
        type="button"
        variant="ghost"
        size="none"
        key={service.id}
        onClick={() => setSelectedServiceId(service.id)}
        aria-label={`Select ${service.name}`}
        className={cn(
          'flex w-full justify-start rounded-none border-b border-border/60 px-3 py-3 text-left transition-colors hover:bg-accent last:border-b-0',
          isSelected && 'bg-accent'
        )}
      >
        <div className="flex w-full min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card ring-1 ring-border">
            <Icon className="h-4 w-4 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{service.name}</span>
              {localConfig.showStatus ? (
                <span className={cn('size-2 shrink-0 rounded-full', getStatusColor(status))} />
              ) : null}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {service.description || getServiceHost(service.url)}
            </div>
          </div>
        </div>
      </Button>
    );
  };

  const renderServiceDetail = (service: Service) => {
    const Icon = getIcon(service.icon);
    const status = serviceStatus[service.id];
    const StatusIcon = getStatusIcon(status);
    const rt = responseTime[service.id];

    return (
      <div className="space-y-5 p-5">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-card ring-1 ring-border">
              <Icon className="size-6 text-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-foreground">{service.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {service.description || getServiceHost(service.url)}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => openService(service.url)}>
            <ArrowUpRight className="mr-1 size-4" />
            Open
          </Button>
        </div>

        {localConfig.showStatus ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 text-xs text-muted-foreground">Status</div>
              <div className="flex items-center gap-2">
                <span className={cn('size-3 rounded-full', getStatusColor(status))} />
                <StatusIcon className="size-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">{getStatusLabel(status)}</span>
              </div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 text-xs text-muted-foreground">Response Time</div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {rt !== undefined ? `${rt}ms` : '--'}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="divide-y divide-border rounded-lg border border-border">
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="shrink-0 text-sm text-muted-foreground">URL</span>
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 break-all text-right font-mono text-sm text-foreground hover:underline"
            >
              {service.url}
            </a>
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="shrink-0 text-sm text-muted-foreground">Host</span>
            <span className="min-w-0 flex-1 break-all text-right text-sm text-foreground">
              {getServiceHost(service.url)}
            </span>
          </div>
          {service.category ? (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="shrink-0 text-sm text-muted-foreground">Category</span>
              <span className="min-w-0 truncate text-sm text-foreground">{service.category}</span>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderApp = () => (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="flex w-[38%] min-w-[260px] max-w-[420px] flex-col border-r border-border">
        <div className="space-y-3 p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="none"
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent',
                !selectedCategory && 'bg-accent text-foreground'
              )}
            >
              All
            </Button>
            {categories.map(cat => (
              <Button
                type="button"
                variant="ghost"
                size="none"
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent',
                  selectedCategory === cat && 'bg-accent text-foreground'
                )}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/60">
          {filteredServices.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No services match filter
            </div>
          ) : (
            filteredServices.map(service => renderAppServiceRow(service))
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        {selectedService ? (
          renderServiceDetail(selectedService)
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a service
          </div>
        )}
      </div>
    </div>
  );

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

    const description = newService.description?.trim();
    const icon = newService.icon?.trim();

    const service: Service = {
      id: `service-${Date.now()}`,
      name: newService.name.trim(),
      url: newService.url.trim(),
      icon: icon || 'Globe',
      description: description || undefined,
      category: newService.category?.trim() || undefined
    };

    setLocalConfig(prev => ({
      ...prev,
      services: [...prev.services, service]
    }));
    setNewService({});
    setShowAddService(false);
  }, [newService]);

  const handleAddServiceOpenChange = useCallback((nextOpen: boolean) => {
    setShowAddService(nextOpen);
    if (!nextOpen) {
      setNewService({});
    }
  }, []);

  const renderServiceSettingsRow = useCallback((service: Service) => {
    const Icon = getIcon(service.icon);
    const serviceHost = getServiceHost(service.url);
    const meta = [service.category, service.description]
      .map(item => item?.trim())
      .filter((item): item is string => Boolean(item))
      .join(' · ') || serviceHost;

    return (
      <div
        key={service.id}
        className="flex items-center gap-3 rounded-md border border-border/70 px-3 py-2.5"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
          <Icon className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {service.name}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {serviceHost}
          </div>
          {meta !== serviceHost ? (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {meta}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
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
  }, [handleDeleteService, openService]);

  const renderSettings = () => (
    <WidgetSettingsDialog
      open={showSettings}
      onOpenChange={handleSettingsOpenChange}
      title={`${localConfig.title || 'Services'} Settings`}
      contentClassName="sm:max-w-lg"
      bodyClassName="space-y-5"
      footer={(
        <WidgetSettingsDialogFooter
          onDelete={config?.onDelete}
          deleteLabel="Delete Widget"
          onCancel={handleCancelSettings}
          onSave={saveSettings}
        />
      )}
    >
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

      <div className="rounded-md border border-border/70 p-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="status-toggle" className="text-sm font-medium">
              Status checks
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Show online/offline state in the widget.
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

        {localConfig.showStatus ? (
          <div className="mt-3 flex items-center gap-2">
            <Label htmlFor="interval-input" className="shrink-0 text-xs text-muted-foreground">
              Check every
            </Label>
            <Input
              id="interval-input"
              type="number"
              min={10}
              max={3600}
              value={localConfig.checkInterval || 60}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalConfig(prev => ({ ...prev, checkInterval: Number(e.target.value) || 60 }))
              }
              className="h-8 w-20"
            />
            <span className="text-xs text-muted-foreground">seconds</span>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Services</div>
            <div className="text-xs text-muted-foreground">
              {localConfig.services.length} saved
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAddService(true)}>
            <Plus className="mr-1 size-4" />
            Add service
          </Button>
        </div>

        <div className="space-y-2">
          {localConfig.services.length ? (
            localConfig.services.map((service) => renderServiceSettingsRow(service))
          ) : (
            <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No services yet
            </div>
          )}
        </div>
      </div>
    </WidgetSettingsDialog>
  );

  const renderAddServiceDialog = () => (
    <WidgetSettingsDialog
      open={showAddService}
      onOpenChange={handleAddServiceOpenChange}
      title="Add Service"
      contentClassName="sm:max-w-md"
      bodyClassName="space-y-4"
      footer={(
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={() => handleAddServiceOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddService}
            disabled={!newService.name || !newService.url}
          >
            Add Service
          </Button>
        </div>
      )}
    >
      <div className="space-y-2">
        <Label htmlFor="service-name">Name</Label>
        <Input
          id="service-name"
          type="text"
          placeholder="Boxento"
          value={newService.name || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setNewService(prev => ({ ...prev, name: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-url">URL</Label>
        <Input
          id="service-url"
          type="url"
          placeholder="https://boxento.local"
          value={newService.url || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setNewService(prev => ({ ...prev, url: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-category">Category</Label>
        <Input
          id="service-category"
          type="text"
          placeholder="Utilities"
          value={newService.category || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setNewService(prev => ({ ...prev, category: e.target.value }))
          }
        />
      </div>

      <details className="rounded-md border border-border/70 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Optional details
        </summary>
        <div className="mt-3 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="service-desc">Description</Label>
            <Input
              id="service-desc"
              type="text"
              placeholder="Dashboard"
              value={newService.description || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewService(prev => ({ ...prev, description: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-icon">Icon</Label>
            <Input
              id="service-icon"
              type="text"
              placeholder="Globe, LayoutGrid, Play, Bot"
              value={newService.icon || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewService(prev => ({ ...prev, icon: e.target.value }))
              }
            />
          </div>
        </div>
      </details>
    </WidgetSettingsDialog>
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
          title={width === 1 ? undefined : localConfig.title || DEFAULT_CONFIG.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort || width === 1}
        />
      )}

      <div className={cn('flex-1 overflow-hidden', isTiny ? 'p-1' : '')}>
        {!hasServices
          ? renderEmptyState()
          : isTiny ? renderTiny()
          : isShort ? renderShort()
          : isApp ? renderApp()
          : isDirectory ? renderDirectory()
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
