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
import { Switch } from '../../ui/switch';
import WidgetHeader from '../common/WidgetHeader';
import { WidgetProps } from '@/types';
import { ServicesWidgetConfig, Service } from './types';
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
  LucideIcon
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

// Default services for Mac Mini
const DEFAULT_SERVICES: Service[] = [
  {
    id: 'boxento',
    name: 'Boxento',
    url: 'https://mini.tailf2415.ts.net',
    icon: 'LayoutGrid',
    description: 'Dashboard',
    category: 'Utilities'
  },
  {
    id: 'paisa',
    name: 'Paisa',
    url: 'https://mini.tailf2415.ts.net:7500',
    icon: 'PiggyBank',
    description: 'Personal Finance',
    category: 'Finance'
  },
  {
    id: 'fava',
    name: 'Fava',
    url: 'https://mini.tailf2415.ts.net:7502',
    icon: 'BookOpen',
    description: 'Beancount',
    category: 'Finance'
  },
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    url: 'https://mini.tailf2415.ts.net:8096',
    icon: 'Play',
    description: 'Media Server',
    category: 'Media'
  },
  {
    id: 'riven',
    name: 'Riven',
    url: 'https://mini.tailf2415.ts.net:3000',
    icon: 'Film',
    description: 'Media Requests',
    category: 'Media'
  },
  {
    id: 'ollama',
    name: 'Open WebUI',
    url: 'https://mini.tailf2415.ts.net:3080',
    icon: 'Bot',
    description: 'Local AI Chat',
    category: 'AI'
  }
];

const ServicesWidget: React.FC<ServicesWidgetProps> = ({ width, height, config }) => {
  const defaultConfig: ServicesWidgetConfig = {
    title: 'Services',
    services: DEFAULT_SERVICES,
    showStatus: true,
    checkInterval: 60
  };

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<ServicesWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  const [serviceStatus, setServiceStatus] = useState<Record<string, 'online' | 'offline' | 'checking'>>({});
  // const [editingService, setEditingService] = useState<Service | null>(null);
  const [showAddService, setShowAddService] = useState<boolean>(false);
  const [newService, setNewService] = useState<Partial<Service>>({});

  // Update local config when props change
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Check service status
  const checkServiceStatus = useCallback(async (service: Service) => {
    setServiceStatus(prev => ({ ...prev, [service.id]: 'checking' }));

    try {
      // Use the service URL or a custom status URL
      const urlToCheck = service.statusUrl || service.url;

      // We can't directly fetch due to CORS, so we'll use a simple approach
      // In production, you'd want a backend proxy for this
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch(urlToCheck, {
        method: 'HEAD',
        mode: 'no-cors', // This won't give us status but will tell us if reachable
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      // With no-cors, we can't read the response, but if we get here without error, it's likely online
      setServiceStatus(prev => ({ ...prev, [service.id]: 'online' }));
    } catch {
      setServiceStatus(prev => ({ ...prev, [service.id]: 'offline' }));
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

  // Get Lucide icon component
  const getIcon = (iconName?: string): LucideIcon => {
    if (!iconName) return Globe;
    return ICONS[iconName] || Globe;
  };

  // Get status color
  const getStatusColor = (status?: 'online' | 'offline' | 'checking') => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'checking': return 'bg-yellow-500 animate-pulse';
      default: return 'bg-gray-400';
    }
  };

  // Open service in new tab
  const openService = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Determine grid columns based on width
  const getGridCols = () => {
    if (width >= 4) return 'grid-cols-4';
    if (width >= 3) return 'grid-cols-3';
    return 'grid-cols-2';
  };

  // Render service card
  const renderServiceCard = (service: Service, compact: boolean = false) => {
    const Icon = getIcon(service.icon);
    const status = serviceStatus[service.id];

    if (compact) {
      return (
        <button
          key={service.id}
          onClick={() => openService(service.url)}
          className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative group"
          title={`${service.name}${service.description ? ` - ${service.description}` : ''}`}
        >
          {localConfig.showStatus && (
            <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${getStatusColor(status)}`} />
          )}
          <Icon className="w-6 h-6 mb-1 text-gray-700 dark:text-gray-300" />
          <span className="text-xs text-center truncate w-full">{service.name}</span>
        </button>
      );
    }

    return (
      <button
        key={service.id}
        onClick={() => openService(service.url)}
        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative group"
      >
        {localConfig.showStatus && (
          <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${getStatusColor(status)}`} />
        )}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <Icon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </div>
        <div className="flex-grow min-w-0 text-left">
          <div className="font-medium text-sm truncate">{service.name}</div>
          {service.description && (
            <div className="text-xs text-gray-500 truncate">{service.description}</div>
          )}
        </div>
      </button>
    );
  };

  // Render content based on size
  const renderContent = () => {
    const services = localConfig.services || [];
    const isCompact = width <= 2 || height <= 2;

    if (services.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <Server className="w-8 h-8 mb-2" />
          <span className="text-sm">No services configured</span>
          <button
            onClick={() => setShowSettings(true)}
            className="mt-2 text-xs text-blue-500 hover:underline"
          >
            Add services
          </button>
        </div>
      );
    }

    if (isCompact) {
      return (
        <div className={`grid ${getGridCols()} gap-1 h-full overflow-auto`}>
          {services.map(service => renderServiceCard(service, true))}
        </div>
      );
    }

    return (
      <div className="grid gap-2 h-full overflow-auto" style={{ gridTemplateColumns: `repeat(${Math.min(width, 2)}, 1fr)` }}>
        {services.map(service => renderServiceCard(service, false))}
      </div>
    );
  };

  // Add service handler
  const handleAddService = () => {
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
  };

  // Delete service handler
  const handleDeleteService = (serviceId: string) => {
    setLocalConfig(prev => ({
      ...prev,
      services: prev.services.filter(s => s.id !== serviceId)
    }));
  };

  // Save settings
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  };

  // Settings dialog
  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Services Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          <div className="flex items-center space-x-2">
            <Switch
              id="status-toggle"
              checked={Boolean(localConfig.showStatus)}
              onCheckedChange={(checked: boolean) =>
                setLocalConfig({...localConfig, showStatus: checked})
              }
            />
            <Label htmlFor="status-toggle">Show Status Indicators</Label>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Services ({localConfig.services.length})</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddService(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {localConfig.services.map(service => {
                const Icon = getIcon(service.icon);
                return (
                  <div key={service.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-grow min-w-0">
                      <div className="text-sm font-medium truncate">{service.name}</div>
                      <div className="text-xs text-gray-500 truncate">{service.url}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteService(service.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                );
              })}
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
            <Button variant="default" onClick={saveSettings}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Add service dialog
  const renderAddServiceDialog = () => (
    <Dialog open={showAddService} onOpenChange={setShowAddService}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Service</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="service-name">Name *</Label>
            <Input
              id="service-name"
              type="text"
              placeholder="My Service"
              value={newService.name || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewService({...newService, name: e.target.value})
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-url">URL *</Label>
            <Input
              id="service-url"
              type="url"
              placeholder="https://example.com"
              value={newService.url || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewService({...newService, url: e.target.value})
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-icon">Icon (Lucide icon name)</Label>
            <Input
              id="service-icon"
              type="text"
              placeholder="Globe, Server, Database..."
              value={newService.icon || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewService({...newService, icon: e.target.value})
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-desc">Description</Label>
            <Input
              id="service-desc"
              type="text"
              placeholder="What this service does"
              value={newService.description || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewService({...newService, description: e.target.value})
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAddService(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleAddService}
            disabled={!newService.name || !newService.url}
          >
            Add Service
          </Button>
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

      <div className="flex-grow p-2 overflow-hidden">
        {renderContent()}
      </div>

      {renderSettings()}
      {renderAddServiceDialog()}
    </div>
  );
};

export default ServicesWidget;
