import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Moon, Sun, Cloud, CloudOff, Loader2 } from 'lucide-react'
// Import GridLayout components - direct imports to avoid runtime issues

// @ts-expect-error - The types don't correctly represent the module structure
import { Responsive, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { getWidgetConfigByType, WIDGET_REGISTRY } from '@/components/widgets'
import { 
  WidgetConfig, 
  Widget,
  LayoutItem
} from '@/types'
import WidgetSelector from '@/components/widgets/common/WidgetSelector'
import { configManager } from '@/lib/configManager'
import { UserMenuButton } from '@/components/auth/UserMenuButton'
import { auth } from '@/lib/firebase'
import { userDashboardService, publicDashboardService } from '@/lib/firestoreService'
import { GRID, TIMING, STORAGE_KEYS } from '@/lib/constants'
import { useSync } from '@/lib/SyncContext'
import { Button } from './components/ui/button'
import { Skeleton } from './components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PasteDetectionLayer } from '@/components/clipboard/PasteDetectionLayer'
import { Toaster } from 'sonner'
import { UrlMatchResult } from '@/lib/services/clipboard/urlDetector'
import { Changelog } from '@/components/Changelog'
import { faviconService } from '@/lib/services/favicon'
import { useAppSettings } from '@/context/AppSettingsContext'
import { DashboardContextMenu } from '@/components/dashboard/DashboardContextMenu'
import DeferredDashboardWidgetFrame from '@/components/dashboard/DeferredDashboardWidgetFrame'
import { DashboardSwitcher, Dashboard, DashboardVisibility } from '@/components/dashboard/DashboardSwitcher'
import {
  createDashboardRecord,
  getDashboardStorageKeys,
  loadDashboardDataFromStorage,
  persistDashboardData,
  planDashboardDeletion,
  removeDashboardData,
} from '@/lib/dashboardPersistence'
import { breakpoints, cols, createDefaultLayoutItem } from '@/lib/layoutUtils'
import {
  applyValidatedBreakpointLayout,
  BREAKPOINT_ORDER,
  BreakpointName,
  LayoutsByBreakpoint,
  ValidateLayoutsOptions,
  applyWidgetLayoutConstraints,
  createLayoutsFromTemplates,
  validateLayouts,
} from '@/lib/dashboardLayouts'
import {
  calculateDashboardRowHeight,
  getDashboardBreakpointForWidth,
} from '@/lib/dashboardViewport'
import { getWidgetGridDimensions } from '@/lib/widgetGridDimensions'
import { useNetworkStatus } from '@/lib/useNetworkStatus'
import { getConfigWidgetIdsToSave } from '@/lib/widgetConfigPersistence'
import type { WidgetConfigPersistenceOptions } from '@/lib/widgetConfigPersistence'
import { AppFooter } from '@/components/AppFooter'
import { useStorage } from '@/lib/storage/StorageContext'
import { getStorageProvider } from '@/lib/storage'
import { DASHBOARD_INTERACTIVE_CHILD_SELECTOR } from '@/lib/dashboardInteraction'

interface WidgetCategory {
  [category: string]: WidgetConfig[];
}

// Create responsive grid layout with width provider - once, outside the component
// This is important for performance as it prevents recreation on each render
const ResponsiveReactGridLayout = WidthProvider(Responsive);

const prepareWidgetConfigForSave = (config: Record<string, unknown>): Record<string, unknown> => {
  // Create a copy of the config without function properties
  const configToSave = { ...config };
  delete configToSave.onDelete;
  delete configToSave.onUpdate;
  return configToSave;
};

const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const savedItem = localStorage.getItem(key);
    if (savedItem) {
      return JSON.parse(savedItem);
    }
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
  }
  
  return defaultValue;
};

const cloneLayoutsByBreakpoint = (sourceLayouts: LayoutsByBreakpoint): LayoutsByBreakpoint => (
  Object.fromEntries(
    Object.entries(sourceLayouts).map(([breakpoint, layout]) => [breakpoint, [...layout]])
  )
);

type SaveWidgetsOptions = WidgetConfigPersistenceOptions & {
  debounce?: boolean;
};

const createAppendLayoutItem = (
  widgetId: string,
  colCount: number,
  breakpoint: string,
  existingLayout: LayoutItem[] = []
): LayoutItem => {
  const isMobile = breakpoint === 'xs' || breakpoint === 'xxs';
  const width = isMobile ? 2 : Math.min(3, colCount);
  const height = isMobile ? 2 : 3;
  const y = existingLayout.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0);

  return {
    i: widgetId,
    x: 0,
    y,
    w: width,
    h: height,
    minW: 2,
    minH: 2,
    ...(isMobile ? { maxW: 2, maxH: 2 } : {}),
  };
};

function App() {
  // Get storage context for provider info
  const { providerType: _providerType, refresh: refreshStorage, isInitialized: storageInitialized } = useStorage();

  // Register service worker for PWA functionality
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined;
    }

    if (!import.meta.env.PROD) {
      void navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch((error) => {
          console.error('ServiceWorker cleanup failed: ', error);
        });

      if ('caches' in window) {
        void caches.keys()
          .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
          .catch((error) => {
            console.error('Cache cleanup failed: ', error);
          });
      }

      return undefined;
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => registration.update())
        .catch(error => {
          console.error('ServiceWorker registration failed: ', error);
        });
    };

    window.addEventListener('load', registerServiceWorker);
    return () => window.removeEventListener('load', registerServiceWorker);
  }, []);

  // Track online status for PWA functionality with toast notifications
  const { isOnline } = useNetworkStatus();

  // Add a class to the body for theme styling
  useEffect(() => {
    document.body.className = 'app-background min-h-screen';
    return () => { document.body.className = ''; };
  }, []);
  
  // Setup default favicon with current time
  useEffect(() => {
    // Initialize with current time
    faviconService.updateWithCurrentTime();
    
    // Update time every minute
    const intervalId = setInterval(() => {
      faviconService.updateWithCurrentTime();
    }, TIMING.FAVICON_UPDATE_INTERVAL_MS);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);
  
  // Default layouts configuration
  const getDefaultLayouts = () => createLayoutsFromTemplates([
    'default-todo',
    'default-weather',
    'default-quick-links',
    'default-notes',
  ]);

  // Default widgets
  const getDefaultWidgets = (): Widget[] => [
    {
      id: 'default-todo',
      type: 'todo',
      config: getWidgetConfigByType('todo') || {}
    },
    {
      id: 'default-weather',
      type: 'weather',
      config: getWidgetConfigByType('weather') || {}
    },
    {
      id: 'default-quick-links',
      type: 'quick-links',
      config: getWidgetConfigByType('quick-links') || {}
    },
    {
      id: 'default-notes',
      type: 'notes',
      config: getWidgetConfigByType('notes') || {}
    }
  ];
  
  const { settings, updateSettings } = useAppSettings();
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme as 'light' | 'dark';
      
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    return 'light'
  });
  
  const [layouts, setLayouts] = useState<{ [key: string]: LayoutItem[] }>(() => {
    if (typeof window === 'undefined') return getDefaultLayouts();

    try {
      // Get current dashboard ID from localStorage
      const dashboardId = localStorage.getItem('boxento-current-dashboard') || 'personal';
      const dashboardKey = `boxento-layouts-${dashboardId}`;

      // Try dashboard-specific storage first
      const dashboardLayouts = localStorage.getItem(dashboardKey);
      if (dashboardLayouts) {
        const parsed = JSON.parse(dashboardLayouts);
        if (Object.keys(parsed).length > 0) {
          return validateLayouts(parsed, { rebalanceWideSparse: true });
        }
      }

      // Fall back to legacy storage only for personal dashboard
      if (dashboardId === 'personal') {
        const savedLayouts = loadFromLocalStorage(STORAGE_KEYS.LAYOUTS, {});
        if (Object.keys(savedLayouts).length > 0) {
          return validateLayouts(savedLayouts, { rebalanceWideSparse: true });
        }
      }
    } catch (error) {
      console.error('Error initializing layouts:', error);
    }

    // Default layout for all breakpoints with default widgets
    return getDefaultLayouts();
  });

  const [widgets, setWidgets] = useState<Widget[]>(() => {
    if (typeof window === 'undefined') return [];

    try {
      // Get current dashboard ID from localStorage
      const dashboardId = localStorage.getItem('boxento-current-dashboard') || 'personal';
      const dashboardKey = `boxento-widgets-${dashboardId}`;

      // Try dashboard-specific storage first
      const dashboardWidgets = localStorage.getItem(dashboardKey);
      if (dashboardWidgets) {
        const parsed = JSON.parse(dashboardWidgets);
        if (parsed.length > 0) {
          return parsed;
        }
      }

      // Fall back to legacy storage only for personal dashboard
      if (dashboardId === 'personal') {
        const savedWidgets = loadFromLocalStorage(STORAGE_KEYS.WIDGETS, []);
        if (savedWidgets.length > 0) {
          return savedWidgets;
        }
      }
    } catch (error) {
      console.error('Error initializing widgets:', error);
    }

    // Use default widgets if nothing found
    return getDefaultWidgets();
  });
  
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [widgetSelectorOpen, setWidgetSelectorOpen] = useState<boolean>(false);
  const [currentBreakpoint, setCurrentBreakpoint] = useState<BreakpointName>(() => (
    typeof window === 'undefined' ? 'lg' : getDashboardBreakpointForWidth(window.innerWidth)
  ));
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [isTransitionsEnabled, setIsTransitionsEnabled] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

  // Default dashboard to ensure there's always at least one
  const defaultDashboard: Dashboard = {
    id: 'personal',
    name: 'Personal',
    visibility: 'private' as DashboardVisibility,
    sharedWith: [],
    isDefault: true,
    createdAt: new Date().toISOString()
  };

  // Multi-dashboard state
  const [dashboards, setDashboards] = useState<Dashboard[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('boxento-dashboards');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Ensure parsed is a valid array
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Migrate old isPublic to visibility if needed
            const migrated = parsed.map((d: Dashboard & { isPublic?: boolean }) => ({
              ...d,
              visibility: d.visibility || (d.isPublic ? 'public' : 'private'),
              sharedWith: d.sharedWith || [],
            }));
            // Ensure the result has at least one valid dashboard
            if (migrated.length > 0 && migrated[0]?.id && migrated[0]?.name) {
              return migrated;
            }
          }
        } catch {
          // ignore corrupted data
        }
      }
    }
    return [defaultDashboard];
  });

  const [currentDashboardId, setCurrentDashboardId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('boxento-current-dashboard') || 'personal';
    }
    return 'personal';
  });

  // Ensure currentDashboard is always defined - fallback to first dashboard or default
  const currentDashboard = dashboards.find(d => d.id === currentDashboardId)
    || dashboards[0]
    || defaultDashboard;

  // Save dashboards to localStorage
  useEffect(() => {
    localStorage.setItem('boxento-dashboards', JSON.stringify(dashboards));
  }, [dashboards]);

  useEffect(() => {
    localStorage.setItem('boxento-current-dashboard', currentDashboardId);
  }, [currentDashboardId]);

  // Save current dashboard's widgets and layouts before switching
  const saveCurrentDashboardData = () => {
    persistDashboardData(localStorage, currentDashboardId, widgets, layouts);
  };

  // Helper to generate fresh widgets with unique IDs
  const generateFreshDefaultWidgets = () => {
    const timestamp = Date.now();
    return [
      { id: `todo-${timestamp}`, type: 'todo', config: getWidgetConfigByType('todo') || {} },
      { id: `weather-${timestamp + 1}`, type: 'weather', config: getWidgetConfigByType('weather') || {} },
      { id: `quick-links-${timestamp + 2}`, type: 'quick-links', config: getWidgetConfigByType('quick-links') || {} },
      { id: `notes-${timestamp + 3}`, type: 'notes', config: getWidgetConfigByType('notes') || {} },
    ] as Widget[];
  };

  // Helper to generate layouts for given widgets
  const generateLayoutsForWidgets = (widgets: Widget[]) => createLayoutsFromTemplates(
    widgets.map((widget) => widget.id)
  );

  const reconcileLayoutsWithWidgets = (
    layoutsToReconcile: LayoutsByBreakpoint,
    widgetsToReconcile: Widget[],
    options: ValidateLayoutsOptions = {}
  ): { layouts: LayoutsByBreakpoint; changed: boolean } => {
    const widgetIds = new Set(widgetsToReconcile.map((widget) => widget.id));
    const widgetsById = new Map(widgetsToReconcile.map((widget) => [widget.id, widget]));
    const validatedInputLayouts = validateLayouts(layoutsToReconcile, options);
    const reconciledLayouts: LayoutsByBreakpoint = {};
    let changed = false;

    BREAKPOINT_ORDER.forEach((breakpoint) => {
      const currentLayout = validatedInputLayouts[breakpoint] || [];
      const filteredLayout = currentLayout.filter((item) => widgetIds.has(item.i));

      if (filteredLayout.length !== currentLayout.length) {
        changed = true;
      }

      const existingIds = new Set(filteredLayout.map((item) => item.i));
      const nextLayout = [...filteredLayout];

      widgetsToReconcile.forEach((widget, index) => {
        if (existingIds.has(widget.id)) {
          return;
        }

        nextLayout.push(
          applyWidgetLayoutConstraints(
            createDefaultLayoutItem(
              widget.id,
              index,
              cols[breakpoint],
              breakpoint,
              nextLayout
            ),
            widget,
            breakpoint
          )
        );
        existingIds.add(widget.id);
        changed = true;
      });

      reconciledLayouts[breakpoint] = nextLayout.map((item) => {
        const widget = widgetsById.get(item.i);
        if (!widget) {
          return item;
        }

        const constrainedItem = applyWidgetLayoutConstraints(item, widget, breakpoint);
        if (
          constrainedItem.minW !== item.minW
          || constrainedItem.minH !== item.minH
          || constrainedItem.maxW !== item.maxW
          || constrainedItem.maxH !== item.maxH
          || constrainedItem.x !== item.x
          || constrainedItem.w !== item.w
        ) {
          changed = true;
        }

        return constrainedItem;
      });
    });

    return {
      layouts: validateLayouts(reconciledLayouts, options),
      changed,
    };
  };

  // Load widgets and layouts for a specific dashboard
  const loadDashboardData = async (dashboardId: string) => {
    const { layouts: layoutsToLoad, widgets: widgetsToLoad } = loadDashboardDataFromStorage({
      createFreshLayouts: (freshWidgets) => validateLayouts(generateLayoutsForWidgets(freshWidgets), { rebalanceWideSparse: true }),
      createFreshWidgets: generateFreshDefaultWidgets,
      dashboardId,
      getDefaultLayouts,
      getDefaultWidgets,
      reconcileLayouts: (storedLayouts, storedWidgets) => reconcileLayoutsWithWidgets(
        storedLayouts,
        storedWidgets,
        { rebalanceWideSparse: true }
      ).layouts,
      storage: localStorage,
    });

    // Load configs for these widgets
    const localConfigs = await configManager.getConfigs(true);
    const widgetsWithConfigs = widgetsToLoad.map((widget: Widget) => {
      if (widget.id && localConfigs[widget.id]) {
        return {
          ...widget,
          config: {
            ...widget.config,
            ...localConfigs[widget.id]
          }
        };
      }
      return widget;
    });
    setWidgets(widgetsWithConfigs);
    setLayouts(layoutsToLoad);
  };

  const handleSwitchDashboard = async (dashboard: Dashboard) => {
    // Save current dashboard's data first
    saveCurrentDashboardData();

    // Switch to new dashboard
    setCurrentDashboardId(dashboard.id);

    // Load the new dashboard's data
    await loadDashboardData(dashboard.id);
  };

  const handleCreateDashboard = async (name: string, visibility: DashboardVisibility) => {
    // Save current dashboard's data first
    saveCurrentDashboardData();

    const timestamp = Date.now();
    const newDashboard = createDashboardRecord(name, visibility, timestamp);
    setDashboards(prev => [...prev, newDashboard]);
    setCurrentDashboardId(newDashboard.id);

    // Generate fresh widgets with UNIQUE IDs for this dashboard
    // This ensures widget configs don't conflict between dashboards
    const freshWidgets = generateFreshDefaultWidgets();
    const freshLayouts = generateLayoutsForWidgets(freshWidgets);

    setWidgets(freshWidgets);
    setLayouts(validateLayouts(freshLayouts));

    // Save to the new dashboard's storage immediately
    persistDashboardData(localStorage, newDashboard.id, freshWidgets, freshLayouts);

    // Sync to Firestore if the dashboard is public or team
    if (visibility !== 'private') {
      syncPublicDashboard(newDashboard, freshWidgets, freshLayouts);
    }
  };

  const handleUpdateDashboard = (updated: Dashboard) => {
    setDashboards(prev => prev.map(d => d.id === updated.id ? updated : d));

    // Sync to public dashboard if this is the current dashboard and visibility changed to public/team
    // or if metadata (name, sharedWith) changed
    if (updated.id === currentDashboardId) {
      syncPublicDashboard(updated, widgets, layouts);
    }
  };

  const handleDeleteDashboard = async (dashboardId: string) => {
    const {
      dashboard,
      nextDashboardId,
      shouldReloadDashboardId,
    } = planDashboardDeletion({
      currentDashboardId,
      dashboardId,
      dashboards,
    });
    if (!dashboard || dashboard.isDefault) return; // Can't delete a non-existent or default dashboard

    // Clean up storage for deleted dashboard
    removeDashboardData(localStorage, dashboardId);

    // Delete from public-dashboards collection if it was public/team
    if (dashboard?.visibility !== 'private' && auth?.currentUser) {
      try {
        await publicDashboardService.deleteDashboard(dashboardId);
      } catch (error) {
        console.error('Error deleting public dashboard:', error);
      }
    }

    setDashboards((previousDashboards) => previousDashboards.filter((entry) => entry.id !== dashboardId));
    if (shouldReloadDashboardId) {
      setCurrentDashboardId(nextDashboardId);
      loadDashboardData(shouldReloadDashboardId);
    }
  };

  const widgetCategories = useMemo<WidgetCategory>(() => {
    const categories: WidgetCategory = {};

    WIDGET_REGISTRY.forEach(widget => {
      const category = widget.category || 'Other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(widget);
    });

    return categories;
  }, []);
  
  // References for debouncing updates
  const layoutSaveTimeout = useRef<number | null>(null);
  const widgetUpdateTimeout = useRef<number | null>(null);
  const publicDashboardSyncTimeout = useRef<number | null>(null);
  const layoutsRef = useRef(layouts);
  const widgetsRef = useRef(widgets);

  useEffect(() => {
    layoutsRef.current = layouts;
  }, [layouts]);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  // Get sync status from context
  const { isSyncing, syncStatus } = useSync();

  /**
   * Sync public/team dashboard to Firestore for sharing
   * This is debounced to avoid excessive writes
   */
  const syncPublicDashboard = async (
    dashboard: Dashboard,
    widgetsToSync: Widget[],
    layoutsToSync: { [key: string]: LayoutItem[] }
  ) => {
    // Only sync if dashboard is public or team
    if (dashboard.visibility === 'private') {
      return;
    }

    // Only sync if user is logged in
    if (!auth?.currentUser) {
      console.warn('Cannot sync public dashboard: user not logged in');
      return;
    }

    // Cancel any pending sync
    if (publicDashboardSyncTimeout.current !== null) {
      clearTimeout(publicDashboardSyncTimeout.current);
    }

    // Debounce the sync
    publicDashboardSyncTimeout.current = window.setTimeout(async () => {
      try {
        // Get all widget configs
        const allConfigs = await configManager.getConfigs(true);

        await publicDashboardService.saveDashboard(
          dashboard.id,
          dashboard,
          widgetsToSync,
          layoutsToSync,
          allConfigs
        );
        console.log('[App] Public dashboard synced:', dashboard.id);
      } catch (error) {
        console.error('[App] Failed to sync public dashboard:', error);
      }
    }, 2000); // 2 second debounce for public dashboard sync
  };
  
  // Track the last created widget for undo functionality
  const [lastCreatedWidgetId, setLastCreatedWidgetId] = useState<string | null>(null);
  
  /**
   * Save widgets to storage using the current storage provider
   *
   * @param updatedWidgets - Array of widgets to save
   * @param options - Save timing and widget config persistence options.
   */
  const saveWidgets = async (
    updatedWidgets: Widget[],
    options: boolean | SaveWidgetsOptions = { debounce: true }
  ): Promise<void> => {
    const saveOptions: SaveWidgetsOptions = typeof options === 'boolean'
      ? { debounce: options, persistAllConfigs: true }
      : options;
    const debounce = saveOptions.debounce ?? true;
    widgetsRef.current = updatedWidgets;
    setWidgets(updatedWidgets);

    const provider = getStorageProvider();

    const widgetsById = new Map(updatedWidgets.map(widget => [widget.id, widget]));
    const configWidgetIdsToSave = getConfigWidgetIdsToSave(updatedWidgets, saveOptions);

    // Most saves persist only configs that changed. Legacy immediate saves can
    // still persist all configs for migration paths where widget metadata and
    // config documents must both be written.
    const configSavePromise = Promise.all(configWidgetIdsToSave.map((widgetId) => {
      const widget = widgetsById.get(widgetId);
      if (widget?.config && widget.id) {
        const configToSave = prepareWidgetConfigForSave(widget.config);
        return configManager.saveWidgetConfig(widget.id, configToSave);
      }
      return Promise.resolve();
    }));

    if (debounce) {
      void configSavePromise;
    } else {
      await configSavePromise;
    }

    // Save widgets to storage provider
    const saveToProvider = async () => {
      try {
        await provider.saveWidgets(currentDashboardId, updatedWidgets);
      } catch (error) {
        console.error('Error saving widgets:', error);
      }
    };

    // Always cancel pending debounced save to prevent race conditions
    if (widgetUpdateTimeout.current !== null) {
      clearTimeout(widgetUpdateTimeout.current);
      widgetUpdateTimeout.current = null;
    }

    if (debounce) {
      // Schedule save for later (returns immediately)
      widgetUpdateTimeout.current = window.setTimeout(saveToProvider, TIMING.SAVE_DEBOUNCE_MS);
    } else {
      // Save immediately and wait for completion
      await saveToProvider();
    }

    // Sync to public dashboard if visibility is public/team (Firebase-specific)
    if (auth?.currentUser && currentDashboard.visibility !== 'private') {
      syncPublicDashboard(currentDashboard, updatedWidgets, layoutsRef.current);
    }
  };
  
  /**
   * Save layouts to storage using the current storage provider
   *
   * @param updatedLayouts - Layout configuration for all breakpoints
   * @param debounce - If true, save is scheduled for 500ms later and function returns immediately.
   *                   If false, waits for save to complete before returning.
   */
  const saveLayouts = async (updatedLayouts: { [key: string]: LayoutItem[] }, debounce = true): Promise<void> => {
    const normalizedLayouts = validateLayouts(updatedLayouts);

    // Update state
    layoutsRef.current = normalizedLayouts;
    setLayouts(normalizedLayouts);
    const provider = getStorageProvider();

    // Save layouts to storage provider
    const saveToProvider = async () => {
      try {
        await provider.saveLayouts(currentDashboardId, normalizedLayouts);
      } catch (error) {
        console.error('Error saving layouts:', error);
      }
    };

    // Always cancel pending debounced save to prevent race conditions
    if (layoutSaveTimeout.current !== null) {
      clearTimeout(layoutSaveTimeout.current);
      layoutSaveTimeout.current = null;
    }

    if (debounce) {
      // Schedule save for later (returns immediately)
      layoutSaveTimeout.current = window.setTimeout(saveToProvider, TIMING.SAVE_DEBOUNCE_MS);
    } else {
      // Save immediately and wait for completion
      await saveToProvider();
    }

    // Sync to public dashboard if visibility is public/team (Firebase-specific)
    if (auth?.currentUser && currentDashboard.visibility !== 'private') {
      syncPublicDashboard(currentDashboard, widgetsRef.current, normalizedLayouts);
    }
  };

  const saveWidgetsRef = useRef(saveWidgets);
  const saveLayoutsRef = useRef(saveLayouts);
  saveWidgetsRef.current = saveWidgets;
  saveLayoutsRef.current = saveLayouts;

  // Update theme based on settings
  useEffect(() => {
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let newTheme: 'light' | 'dark' = 'light';

    // Set theme based on app settings
    if (settings.themeMode === 'dark') {
      newTheme = 'dark';
    } else if (settings.themeMode === 'light') {
      newTheme = 'light';
    } else if (settings.themeMode === 'system') {
      newTheme = prefersDarkMode ? 'dark' : 'light';
    }

    // Set the theme
    setTheme(newTheme);

    // Set the document class
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.themeMode]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const nextWidth = window.innerWidth;
      setWindowWidth(nextWidth);
      setCurrentBreakpoint(getDashboardBreakpointForWidth(nextWidth));
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const rowHeight = useMemo(() => {
    return calculateDashboardRowHeight(windowWidth, currentBreakpoint as BreakpointName);
  }, [currentBreakpoint, windowWidth]);
  
  const toggleTheme = (): void => {
    const newTheme: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    // Also update app settings
    const newThemeMode: 'light' | 'dark' | 'system' = newTheme === 'dark' ? 'dark' : 'light';
    if (settings.themeMode !== newThemeMode) {
      updateSettings({ themeMode: newThemeMode });
    }
  };

  // Auto-arrange widgets to fill empty space compactly
  const handleAutoArrange = (): void => {
    const updatedLayouts: { [key: string]: LayoutItem[] } = {};

    // Process each breakpoint
    Object.keys(breakpoints).forEach((breakpoint) => {
      const colCount = cols[breakpoint as keyof typeof cols];
      const currentLayout = layouts[breakpoint] || [];

      // Sort widgets by y position, then x position (top-left to bottom-right)
      const sortedItems = [...currentLayout].sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      });

      // Create a grid to track occupied cells
      const maxY = Math.max(...sortedItems.map(item => item.y + item.h), 0);
      const grid: boolean[][] = Array(maxY + 100)
        .fill(null)
        .map(() => Array(colCount).fill(false));

      // Helper to check if a position is available
      const canPlace = (x: number, y: number, w: number, h: number): boolean => {
        if (x + w > colCount) return false;
        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (grid[y + dy]?.[x + dx]) return false;
          }
        }
        return true;
      };

      // Helper to mark cells as occupied
      const placeItem = (x: number, y: number, w: number, h: number): void => {
        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (!grid[y + dy]) grid[y + dy] = Array(colCount).fill(false);
            grid[y + dy][x + dx] = true;
          }
        }
      };

      // Place each widget in the first available position
      const newLayout: LayoutItem[] = [];
      for (const item of sortedItems) {
        let placed = false;
        // Try each row, then each column
        for (let y = 0; !placed && y < grid.length; y++) {
          for (let x = 0; x <= colCount - item.w; x++) {
            if (canPlace(x, y, item.w, item.h)) {
              newLayout.push({ ...item, x, y });
              placeItem(x, y, item.w, item.h);
              placed = true;
              break;
            }
          }
        }
        // If not placed (shouldn't happen), keep original position
        if (!placed) {
          newLayout.push(item);
        }
      }

      updatedLayouts[breakpoint] = newLayout;
    });

    saveLayouts(updatedLayouts);
  };

  // Add widget function - refactored to reduce duplication
  const addWidget = (type: string): void => {
    // Generate unique ID for this widget instance
    const widgetId = `${type}-${Date.now()}`;
    
    // Create new widget instance
    const newWidget: Widget = {
      id: widgetId,
      type,
      config: getWidgetConfigByType(type) || {}
    };
    
    // Add new widget to state
    const updatedWidgets = [...widgets, newWidget];
    
    // For each breakpoint, create a layout item
    const updatedLayouts = cloneLayoutsByBreakpoint(layouts);
    
    // For each breakpoint, add a layout item
    Object.keys(breakpoints).forEach((breakpoint) => {
      if (!updatedLayouts[breakpoint]) {
        updatedLayouts[breakpoint] = [];
      }
      
      // Calculate column count for this breakpoint
      const colCount = cols[breakpoint as keyof typeof cols];
      
      // Adding one widget should not rescan thousands of existing layout cells.
      // Auto-arrange remains available when the user wants to fill gaps.
      const defaultItem = createAppendLayoutItem(
        widgetId,
        colCount,
        breakpoint,
        updatedLayouts[breakpoint]
      );
      
      // Force 2x2 grid size for mobile
      const isMobile = breakpoint === 'xs' || breakpoint === 'xxs';
      if (isMobile) {
        defaultItem.w = 2;
        defaultItem.h = 2;
        defaultItem.maxW = 2;
        defaultItem.maxH = 2;
      }
      
      updatedLayouts[breakpoint].push(
        applyWidgetLayoutConstraints(defaultItem, newWidget, breakpoint as BreakpointName)
      );
    });
    
    // Update state through the save helpers to avoid duplicate dashboard renders.
    setLastCreatedWidgetId(widgetId);
    
    // Save changes
    saveWidgets(updatedWidgets, { configWidgetIdsToSave: [widgetId] });
    saveLayouts(updatedLayouts, false);
    
    // Close the widget selector if it's open
    if (widgetSelectorOpen) {
      setWidgetSelectorOpen(false);
    }
  };
  
  const currentLayoutById = useMemo(
    () => new Map((layouts[currentBreakpoint] || []).map(item => [item.i, item])),
    [currentBreakpoint, layouts]
  );
  const isReadOnlyDashboard = currentDashboard.ownerId !== undefined
    && auth?.currentUser?.uid !== currentDashboard.ownerId;
  const isAuthenticated = Boolean(auth?.currentUser);

  const deleteWidget = useCallback(async (widgetId: string): Promise<void> => {
    await configManager.clearConfig(widgetId);

    const updatedWidgets = widgetsRef.current.filter(widget => widget.id !== widgetId);
    const updatedLayouts = { ...layoutsRef.current };
    Object.keys(updatedLayouts).forEach(breakpoint => {
      updatedLayouts[breakpoint] = updatedLayouts[breakpoint].filter(item => item.i !== widgetId);
    });

    const normalizedLayouts = validateLayouts(updatedLayouts, { rebalanceWideSparse: true });

    await saveWidgetsRef.current(updatedWidgets);
    await saveLayoutsRef.current(normalizedLayouts, false);
  }, []);

  const updateWidgetConfig = useCallback((widgetId: string, newConfig: Record<string, unknown>): void => {
    const updatedWidgets = widgetsRef.current.map(widget =>
      widget.id === widgetId
        ? { ...widget, config: { ...widget.config, ...newConfig } }
        : widget
    );

    widgetsRef.current = updatedWidgets;
    setWidgets(updatedWidgets);

    const configToSave = prepareWidgetConfigForSave(newConfig);
    void configManager.saveWidgetConfig(widgetId, configToSave);

    if (isAuthenticated) {
      void saveWidgetsRef.current(updatedWidgets);
    }
  }, [isAuthenticated]);

  const draggedWidgetIdRef = useRef<string | null>(null);
  const resizingWidgetIdRef = useRef<string | null>(null);

  const getWidgetDimensions = useCallback((widgetId: string, isMobileView = false) => (
    // Keep widget branch selection pinned to persisted grid units during resize.
    getWidgetGridDimensions({
      currentLayoutById,
      isLayoutReady,
      isMobileView,
      widgetId,
    })
  ), [currentLayoutById, isLayoutReady]);
  const isMobileViewport = windowWidth < breakpoints.sm;
  const isTabletBreakpoint = !isMobileViewport && currentBreakpoint === 'sm';

  const handleLayoutChange = (_currentLayout: LayoutItem[]): void => {
    if (!draggedWidgetIdRef.current && !resizingWidgetIdRef.current) {
      return;
    }

    // React-grid-layout updates item positions internally during pointer moves.
    // Persisting the whole layout only on interaction end avoids rerendering every widget each tick.
  };

  const handleDragStart = (_layout: LayoutItem[], _oldItem: LayoutItem, newItem: LayoutItem): void => {
    document.body.classList.add('react-grid-layout--dragging');
    draggedWidgetIdRef.current = newItem.i;
  };

  const handleDragStop = (currentLayout: LayoutItem[]): void => {
    const activeDraggedWidgetId = draggedWidgetIdRef.current;
    draggedWidgetIdRef.current = null;
    document.body.classList.remove('react-grid-layout--dragging');

    if (!activeDraggedWidgetId) {
      return;
    }

    void saveLayouts(
      applyValidatedBreakpointLayout(layoutsRef.current, currentBreakpoint, currentLayout),
      false
    );
  };

  useEffect(() => {
    return () => {
      document.body.classList.remove(
        'react-grid-layout--dragging',
        'react-grid-layout--resizing'
      );
    };
  }, []);

  const handleResizeStart = (_layout: LayoutItem[], _oldItem: LayoutItem, newItem: LayoutItem): void => {
    document.body.classList.add('react-grid-layout--resizing');
    resizingWidgetIdRef.current = newItem.i;
  };

  const handleResizeStop = (currentLayout: LayoutItem[]): void => {
    document.body.classList.remove('react-grid-layout--resizing');
    const activeResizingWidgetId = resizingWidgetIdRef.current;
    resizingWidgetIdRef.current = null;

    if (!activeResizingWidgetId) {
      return;
    }

    void saveLayouts(
      applyValidatedBreakpointLayout(layoutsRef.current, currentBreakpoint, currentLayout),
      false
    );
  };
  
  // Toggle widget selector
  const toggleWidgetSelector = (): void => {
    setWidgetSelectorOpen(!widgetSelectorOpen);
  };
  
  // Unified function to render widget items for the grid
  const renderWidgetItems = () => {
    const sizeClass = isMobileViewport ? 'mobile-widget' : isTabletBreakpoint ? 'tablet-widget' : 'desktop-widget';

    return widgets.map(widget => {
      const { width, height } = getWidgetDimensions(widget.id, isMobileViewport);

      return (
        <div 
          key={widget.id} 
          className={`widget-wrapper ${sizeClass} app-widget`} 
          data-widget-id={widget.id}
          data-breakpoint={currentBreakpoint}
          style={isMobileViewport ? { marginBottom: '16px', height: 'auto' } : undefined}
        >
          <DeferredDashboardWidgetFrame
            widget={widget}
            width={width}
            height={height}
            isReadOnly={isReadOnlyDashboard}
            onDeleteWidget={deleteWidget}
            onUpdateWidgetConfig={updateWidgetConfig}
          />
        </div>
      );
    });
  };
  
  // Unified function to render mobile layout
  const renderMobileLayout = () => {
    return (
      <div className="mobile-widget-list">
        {widgets.map(widget => (
          <div 
            key={widget.id} 
            className="mobile-widget-item mobile-widget"
          >
            <DeferredDashboardWidgetFrame
              widget={widget}
              width={2}
              height={2}
              isReadOnly={isReadOnlyDashboard}
              onDeleteWidget={deleteWidget}
              onUpdateWidgetConfig={updateWidgetConfig}
            />
          </div>
        ))}
      </div>
    );
  };
  
  // Load data from the current storage provider (SQLite, Firebase, or localStorage)
  const loadLocalData = async () => {
    const provider = getStorageProvider();
    console.log('[Storage] loadLocalData using provider:', provider.name);

    // Load widgets and layouts from the storage provider
    let loadedWidgets = await provider.getWidgets(currentDashboardId);
    let loadedLayouts = await provider.getLayouts(currentDashboardId);
    console.log('[Storage] Loaded from provider - widgets:', loadedWidgets?.length || 0, 'layouts:', loadedLayouts ? Object.keys(loadedLayouts).length : 0);

    if (loadedLayouts && Object.keys(loadedLayouts).length > 0 && loadedWidgets && loadedWidgets.length > 0) {
      const reconciledLayouts = reconcileLayoutsWithWidgets(
        loadedLayouts,
        loadedWidgets,
        { rebalanceWideSparse: true }
      );
      loadedLayouts = reconciledLayouts.layouts;

      if (reconciledLayouts.changed) {
        await provider.saveLayouts(currentDashboardId, loadedLayouts);
      }
    }

    // If no data in storage provider, check localStorage for migration
    if (!loadedWidgets || loadedWidgets.length === 0) {
      console.log('[Storage] No widgets in provider, checking localStorage for migration...');
      // Try to migrate from localStorage
      const keys = getDashboardStorageKeys(currentDashboardId);
      const localWidgetsStr = localStorage.getItem(keys.widgets);
      const localLayoutsStr = localStorage.getItem(keys.layouts);
      console.log('[Storage] localStorage check - widgets key:', keys.widgets, 'found:', !!localWidgetsStr, 'layouts found:', !!localLayoutsStr);

      if (localWidgetsStr && localLayoutsStr) {
        // Migrate localStorage data to storage provider
        const migratedWidgets = JSON.parse(localWidgetsStr) as Widget[];
        loadedWidgets = migratedWidgets;
        loadedLayouts = reconcileLayoutsWithWidgets(
          JSON.parse(localLayoutsStr),
          migratedWidgets,
          { rebalanceWideSparse: true }
        ).layouts;

        // Save to storage provider for future use
        if (loadedWidgets && loadedWidgets.length > 0) {
          await provider.saveWidgets(currentDashboardId, loadedWidgets);
          console.log('[Storage] Migrated widgets from localStorage to storage provider');
        }
        if (loadedLayouts && Object.keys(loadedLayouts).length > 0) {
          await provider.saveLayouts(currentDashboardId, loadedLayouts);
          console.log('[Storage] Migrated layouts from localStorage to storage provider');
        }
      } else if (currentDashboardId === 'personal') {
        // Check legacy storage keys
        const legacyWidgets = loadFromLocalStorage(STORAGE_KEYS.WIDGETS, []);
        const legacyLayouts = loadFromLocalStorage(STORAGE_KEYS.LAYOUTS, {});

        if (legacyWidgets.length > 0) {
          loadedWidgets = legacyWidgets;
          loadedLayouts = reconcileLayoutsWithWidgets(
            legacyLayouts,
            loadedWidgets,
            { rebalanceWideSparse: true }
          ).layouts;

          // Migrate to storage provider
          await provider.saveWidgets(currentDashboardId, loadedWidgets);
          await provider.saveLayouts(currentDashboardId, loadedLayouts);
          console.log('[Storage] Migrated legacy localStorage data to storage provider');
        }
      }
    }

    // If still no data, use defaults
    if (!loadedWidgets || loadedWidgets.length === 0) {
      loadedWidgets = getDefaultWidgets();
      loadedLayouts = getDefaultLayouts();

      // Save defaults to storage provider
      await provider.saveWidgets(currentDashboardId, loadedWidgets);
      await provider.saveLayouts(currentDashboardId, loadedLayouts);
      console.log('[Storage] Initialized with default widgets');
    }

    const normalizedLayouts = reconcileLayoutsWithWidgets(
      loadedLayouts || getDefaultLayouts(),
      loadedWidgets,
      { rebalanceWideSparse: true }
    ).layouts;
    setLayouts(normalizedLayouts);

    // Load and decrypt widget configs from storage provider
    let configs = await configManager.getConfigs(true);

    // Migrate widget configs from localStorage if provider has none
    if (Object.keys(configs).length === 0) {
      const localConfigs = configManager.getConfigsFromLocalStorage();
      if (Object.keys(localConfigs).length > 0) {
        console.log('[Storage] Migrating widget configs from localStorage...');
        // Save each config to the storage provider
        for (const [widgetId, config] of Object.entries(localConfigs)) {
          await provider.saveWidgetConfig(widgetId, config as Record<string, unknown>);
        }
        console.log('[Storage] Migrated', Object.keys(localConfigs).length, 'widget configs to storage provider');
        // Reload configs from provider
        configs = await configManager.getConfigs(true);
      }
    }

    // Merge configs into widgets
    const widgetsWithConfigs = loadedWidgets.map((widget: Widget) => {
      if (widget.id && configs[widget.id]) {
        return {
          ...widget,
          config: {
            ...widget.config,
            ...configs[widget.id]
          }
        };
      }
      return widget;
    });

    setWidgets(widgetsWithConfigs);
  };

  /**
   * Migrate widget-specific localStorage keys to unified storage
   * This cleans up old Calendar widget configs that were stored with widget-specific keys
   */
  const migrateWidgetSpecificConfigs = () => {
    try {
      const unifiedConfigs = configManager.getConfigsFromLocalStorage();
      let hasChanges = false;

      // Find all widget-specific keys (e.g., calendar-widget-config-{id})
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('calendar-widget-config-')) {
          try {
            const widgetId = key.replace('calendar-widget-config-', '');
            const widgetConfigStr = localStorage.getItem(key);

            if (widgetConfigStr) {
              const widgetConfig = JSON.parse(widgetConfigStr);

              // Merge into unified config (prefer existing unified config if present)
              if (!unifiedConfigs[widgetId]) {
                unifiedConfigs[widgetId] = widgetConfig;
                hasChanges = true;
              }

              // Remove old widget-specific key
              localStorage.removeItem(key);
            }
          } catch (e) {
            console.error(`Error migrating widget config for key ${key}:`, e);
          }
        }
      });

      // Save back to unified storage if we made changes
      if (hasChanges) {
        localStorage.setItem(STORAGE_KEYS.WIDGET_CONFIGS, JSON.stringify(unifiedConfigs));
        console.warn('Migrated widget-specific localStorage keys to unified storage');
      }
    } catch (e) {
      console.error('Error during widget config migration:', e);
    }
  };

  // Function to load user data from Firestore
  const loadUserData = async (): Promise<void> => {
    try {
      let userHasFirestoreData = false;
      
      // Migrate any legacy layout data structure first
      await userDashboardService.migrateLayoutDataStructure();
      
      // Load widgets first - we'll use them to validate layouts
      try {
        // 1. Load widget metadata first (without configs)
        const firestoreWidgets = await userDashboardService.loadWidgets();
        
        if (firestoreWidgets !== null && firestoreWidgets !== undefined) {
          // Widget metadata loaded from Firestore
          
          // 2. Load all widget configurations from Firestore
          const firestoreConfigs = await configManager.getConfigs(true);

          // 3. Also load localStorage configs in case there are unsaved local changes
          const localConfigs = configManager.getConfigsFromLocalStorage();

          // 4. Merge configs: prefer local over Firestore for each widget
          // This handles the case where user made changes but refreshed before debounce completed
          const mergedConfigs: Record<string, Record<string, unknown>> = {};

          // Start with Firestore configs as base
          Object.keys(firestoreConfigs).forEach(widgetId => {
            mergedConfigs[widgetId] = firestoreConfigs[widgetId];
          });

          // Merge in local configs (will override Firestore if exists)
          Object.keys(localConfigs).forEach(widgetId => {
            if (mergedConfigs[widgetId]) {
              // Merge local changes over Firestore config
              mergedConfigs[widgetId] = { ...mergedConfigs[widgetId], ...localConfigs[widgetId] };
            } else {
              // Use local config if no Firestore config exists
              mergedConfigs[widgetId] = localConfigs[widgetId];
            }
          });

          // 5. Merge the widget metadata with their respective configurations
          const typedWidgets = Array.isArray(firestoreWidgets) ? firestoreWidgets.map(widget => {
            const widgetId = widget.id as string;
            return {
              id: widgetId || '',
              type: widget.type as string || '',
              config: widgetId ? (mergedConfigs[widgetId] || {}) : {}
            } as Widget;
          }) : [];

          // 6. Validate and reconcile layouts against the current widget constraints
          const validatedLayoutsResult = reconcileLayoutsWithWidgets(
            validateLayouts(await userDashboardService.validateAndFixLayouts(
              typedWidgets.map(w => ({ id: w.id, type: w.type }))
            ), { rebalanceWideSparse: true }),
            typedWidgets,
            { rebalanceWideSparse: true }
          );
          const validatedLayouts = validatedLayoutsResult.layouts;

          if (validatedLayoutsResult.changed) {
            await userDashboardService.saveLayouts(validatedLayouts);
          }

          // 7. Update localStorage for personal dashboard
          const personalKeys = getDashboardStorageKeys('personal');
          localStorage.setItem(personalKeys.widgets, JSON.stringify(typedWidgets));
          localStorage.setItem(personalKeys.layouts, JSON.stringify(validatedLayouts));
          // Also save to legacy keys for backwards compatibility
          localStorage.setItem(STORAGE_KEYS.WIDGETS, JSON.stringify(typedWidgets));
          localStorage.setItem(STORAGE_KEYS.LAYOUTS, JSON.stringify(validatedLayouts));

          // 8. IMPORTANT: Only apply Firestore data to state if on personal dashboard
          // This prevents overwriting other dashboard data with personal dashboard data
          if (currentDashboardId === 'personal') {
            setWidgets(typedWidgets);
            setLayouts(validatedLayouts);
          }

          userHasFirestoreData = true;
        } else if (!userHasFirestoreData) {
          // Fall back to localStorage if no Firestore data
          await loadLocalData();

          // Migrate to Firestore if logged in
          if (auth?.currentUser && widgets.length > 0) {
            try {
              // Use debounce=false to ensure sequential saves complete before proceeding
              await saveWidgets(widgets, false);
              await saveLayouts(layouts, false);
            } catch (error) {
              console.error('Error migrating to Firestore:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error loading widgets from Firestore:', error);
        // Only fall back to localStorage if we haven't loaded Firestore data
        if (!userHasFirestoreData) {
          await loadLocalData();
        }
      }
    } catch (error) {
      console.error('Error loading user data from Firestore:', error);
      // Fallback to localStorage
      await loadLocalData();
    }
  };
  
  // Initialize auth listener - wait for storage to be initialized first
  useEffect(() => {
    // Don't run until storage provider is initialized
    // This ensures SQLite backend is properly detected before loading data
    if (!storageInitialized) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    // Use async IIFE to properly await migrations before loading data
    const initializeApp = async () => {
      // Handle OAuth callback params BEFORE loading data
      // This prevents the params from being lost while showing "Loading your dashboard..."
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (code && state) {
          // Only store if we have a matching state in localStorage (valid OAuth flow)
          const storedState = localStorage.getItem('googleOAuthState');
          if (storedState === state) {
            sessionStorage.setItem('googleOAuthCode', code);
            sessionStorage.setItem('googleOAuthState', state);
          }
          // Clear URL immediately regardless
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        // Don't clear sessionStorage here - let the CalendarWidget clear it after processing
        // This prevents race conditions with React strict mode running effects twice
      }

      // Migrate any widget-specific localStorage keys before loading data
      migrateWidgetSpecificConfigs();

      // Migrate legacy Base64 "encryption" to real AES-GCM encryption
      // IMPORTANT: Must complete before loading data to prevent race conditions
      try {
        await configManager.migrateToSecureEncryption();
      } catch (err) {
        console.error('Failed to migrate encryption:', err);
      }

      // Load from storage provider (SQLite, Firebase, or localStorage)
      // Storage provider is already initialized at this point
      try {
        await loadLocalData();
      } catch (error) {
        console.error('Error loading local data:', error);
      }

      // Show the dashboard immediately with local data
      setIsDataLoaded(true);

      // If Firebase auth is configured, set up listener to sync with Firestore
      // This runs in the background AFTER the dashboard is already visible
      if (auth) {
        unsubscribe = auth.onAuthStateChanged(async (user) => {
          // Refresh storage provider on auth state change
          // This allows switching between localStorage and Firebase based on auth
          await refreshStorage();

          if (user) {
            // User is signed in, load their data from Firestore
            // This will merge/override local data with Firestore data
            await loadUserData();
          }
          // If user is null (logged out), we already loaded local data above
        });
      }
    };

    initializeApp();

    // Cleanup subscription
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [storageInitialized, refreshStorage]);
  
  // Effect to handle initial layout loading
  useEffect(() => {
    // Only show the grid once layouts and widgets are loaded
    if (layouts && Object.keys(layouts).length > 0 && widgets.length > 0) {
      // Check if all widgets have layout items
      let allWidgetsHaveLayouts = true;
      
      // Check current breakpoint
      if (currentBreakpoint) {
        for (const widget of widgets) {
          if (!layouts[currentBreakpoint]?.some(item => item.i === widget.id)) {
            allWidgetsHaveLayouts = false;
            // Widget missing layout item for current breakpoint
            break;
          }
        }
      }
      
      // Add delay to ensure layout calculations are complete
      const delay = allWidgetsHaveLayouts ? 300 : 500;

      const timer = setTimeout(() => {
        setIsLayoutReady(true);
        // Enable transitions after another short delay to prevent initial animation
        setTimeout(() => {
          setIsTransitionsEnabled(true);
        }, 100);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [layouts, widgets, currentBreakpoint]);
  
  // NOTE: Automatic orphaned layout cleanup was removed because it caused data loss
  // when running before Firestore data finished loading. Layout cleanup is now handled
  // only during explicit widget deletion via the deleteWidget function.
  
  // Ensure layouts exist for all widgets - only add missing items, don't recreate
  useEffect(() => {
    if (widgets.length === 0 || !layouts) return;

    let needsUpdate = false;
    const updatedLayouts = cloneLayoutsByBreakpoint(layouts);

    // Check each breakpoint
    Object.keys(breakpoints).forEach(breakpoint => {
      if (!updatedLayouts[breakpoint]) {
        updatedLayouts[breakpoint] = [];
      }

      const existingIds = new Set(updatedLayouts[breakpoint].map(item => item.i));

      // Find widgets without layout items in this breakpoint
      widgets.forEach((widget, index) => {
        if (!existingIds.has(widget.id)) {
          // Add missing layout item
          const colCount = cols[breakpoint as keyof typeof cols];
          const newItem = createDefaultLayoutItem(
            widget.id,
            index,
            colCount,
            breakpoint,
            updatedLayouts[breakpoint]
          );
          updatedLayouts[breakpoint].push(
            applyWidgetLayoutConstraints(newItem, widget, breakpoint as BreakpointName)
          );
          needsUpdate = true;
        }
      });
    });

    if (needsUpdate) {
      setLayouts(updatedLayouts);
    }
  }, [widgets, layouts]);
  
  // Handle URL detection
  const handleUrlDetected = (result: UrlMatchResult) => {
    let widgetId: string;
    let newWidget: Widget;
    let updatedWidgets: Widget[];
    let updatedLayouts: { [key: string]: LayoutItem[] };

    switch (result.type) {
      case 'youtube':
        // Create YouTube widget
        widgetId = `youtube-${Date.now()}`;
        newWidget = {
          id: widgetId,
          type: 'youtube',
          config: {
            ...getWidgetConfigByType('youtube'),
            videoId: result.data.videoId
          }
        };
        
        // Add new widget to state
        updatedWidgets = [...widgets, newWidget];
        
        // For each breakpoint, create a layout item
        updatedLayouts = cloneLayoutsByBreakpoint(layouts);
        
        // For each breakpoint, add a layout item
        Object.keys(breakpoints).forEach((breakpoint) => {
          if (!updatedLayouts[breakpoint]) {
            updatedLayouts[breakpoint] = [];
          }
          
          // Calculate column count for this breakpoint
          const colCount = cols[breakpoint as keyof typeof cols];
          
          // Append pasted widgets cheaply; auto-arrange can fill gaps later.
          const defaultItem = createAppendLayoutItem(
            widgetId, 
            colCount,
            breakpoint,
            updatedLayouts[breakpoint]
          );
          
          // Set appropriate size for video content
          if (breakpoint === 'lg' || breakpoint === 'md') {
            defaultItem.w = 4; // Wider for better video viewing
            defaultItem.h = 3; // 16:9 aspect ratio approximately
          }
          
          updatedLayouts[breakpoint].push(defaultItem);
        });
        
        // Update state through the save helpers to avoid duplicate dashboard renders.
        setLastCreatedWidgetId(widgetId);
        
        // Save changes
        saveWidgets(updatedWidgets, { configWidgetIdsToSave: [widgetId] });
        saveLayouts(updatedLayouts, false);
        break;
        
      // Add more cases here for other URL types
      // case 'sports':
      //   // Create sports widget with result.data
      //   break;
      // case 'weather':
      //   // Create weather widget with result.data
      //   break;
      
      default:
        // Unsupported URL type
    }
  };
  
  // Handle undo of last widget creation
  const handleUndoLastWidget = () => {
    if (lastCreatedWidgetId) {
      deleteWidget(lastCreatedWidgetId);
      setLastCreatedWidgetId(null);
    }
  };
  
  // Show skeleton dashboard while loading data
  if (!isDataLoaded) {
    return (
      <div className="app app-background dark:bg-slate-950 min-h-screen">
        {/* Skeleton Header */}
        <header className="app-header">
          <div className="header-container">
            <div className="header-left">
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
            <div className="header-right flex gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        </header>

        {/* Skeleton Dashboard Grid */}
        <main className="main-content pt-20 px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="w-full">
            <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-4 auto-rows-[100px]">
              {/* Skeleton widgets mimicking typical dashboard layout */}
              <div className="col-span-2 md:col-span-3 lg:col-span-3 row-span-3">
                <Skeleton className="w-full h-full rounded-2xl" />
              </div>
              <div className="col-span-2 md:col-span-3 lg:col-span-3 row-span-3">
                <Skeleton className="w-full h-full rounded-2xl" />
              </div>
              <div className="col-span-2 md:col-span-3 lg:col-span-3 row-span-2">
                <Skeleton className="w-full h-full rounded-2xl" />
              </div>
              <div className="col-span-2 md:col-span-3 lg:col-span-3 row-span-2">
                <Skeleton className="w-full h-full rounded-2xl" />
              </div>
              <div className="col-span-2 md:col-span-2 lg:col-span-2 row-span-2">
                <Skeleton className="w-full h-full rounded-2xl" />
              </div>
              <div className="col-span-2 md:col-span-2 lg:col-span-2 row-span-2">
                <Skeleton className="w-full h-full rounded-2xl" />
              </div>
              <div className="col-span-2 md:col-span-2 lg:col-span-2 row-span-2">
                <Skeleton className="w-full h-full rounded-2xl" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  return (
    <div className={`app ${theme === 'dark' ? 'dark' : ''} app-background`} data-theme={theme}>
      {/* Add Toaster */}
      <Toaster 
        position="bottom-right"
        theme={theme}
        closeButton
      />
      
      {/* Add PasteDetectionLayer */}
      <PasteDetectionLayer 
        onUrlDetected={handleUrlDetected}
        onUndo={handleUndoLastWidget}
        className="z-0"
      />
      
      {/* Header */}
      <div className="fixed top-0 z-50 w-full backdrop-blur-sm app-header">
        <div className="px-2 sm:px-4 py-3 flex items-center justify-between"> {/* Use px-2 for xs, px-4 for sm+ */}
          <div className="flex items-center">
            <div className="mr-2 sm:mr-3">
              <DashboardSwitcher
                dashboards={dashboards}
                currentDashboard={currentDashboard}
                onSwitchDashboard={handleSwitchDashboard}
                onCreateDashboard={handleCreateDashboard}
                onUpdateDashboard={handleUpdateDashboard}
                onDeleteDashboard={handleDeleteDashboard}
              />
            </div>
            {/* Sync indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    {!isOnline ? (
                      <CloudOff className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                    ) : auth?.currentUser ? (
                      isSyncing ? (
                        <Loader2 className="h-5 w-5 text-green-500 dark:text-green-400" />
                      ) : syncStatus === 'success' ? (
                        <Cloud className="h-5 w-5 text-green-500 dark:text-green-400" />
                      ) : syncStatus === 'error' ? (
                        <Cloud className="h-5 w-5 text-red-500 dark:text-red-400" />
                      ) : (
                        <Cloud className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      )
                    ) : (
                      <Cloud className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={5} className="max-w-[300px] bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shadow-lg">
                  <div>
                    <p className="font-semibold">
                      {!isOnline ? (
                        "You are offline. Some features may be limited."
                      ) : auth?.currentUser ? (
                        isSyncing ? "Syncing..." : 
                        syncStatus === 'success' ? "Everything is synced!" :
                        syncStatus === 'error' ? "Sync error" :
                        "Ready to sync"
                      ) : (
                        "Sign up to sync (saved locally for now)"
                      )}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2"> {/* Use space-x-1 for xs, space-x-2 for sm+ */}
            <Button
              onClick={toggleWidgetSelector}
              aria-label="Add widget"
              className="rounded-full h-9"
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4 sm:mr-2" /> {/* Remove margin on xs */}
              <span className="hidden sm:inline">Add Widget</span> {/* Hide text on xs */}
            </Button>

            <Button
              onClick={toggleTheme}
              className="rounded-full h-9 w-9 p-0 flex items-center justify-center"
              size="sm"
              aria-label="Toggle theme"
              variant="outline"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            
            <Changelog />

            <div className="flex items-center">
              {/* UserMenuButton is now responsive internally */}
              <UserMenuButton className="h-9" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Main */}
      <div className="min-h-screen overflow-x-hidden app-background">
        <main className="pt-16 md:pt-20">
          <WidgetSelector 
            isOpen={widgetSelectorOpen}
            onClose={toggleWidgetSelector}
            onAddWidget={addWidget}
            widgetRegistry={WIDGET_REGISTRY}
            widgetCategories={widgetCategories}
          />
          
          <div className="w-full">
            {isMobileViewport ? (
              <div className="mobile-view-container">
                <div className="mobile-view">
                  {renderMobileLayout()}
                </div>
              </div>
            ) : (
              <div className="desktop-view-container">
                <div className="dashboard-canvas">
                  {!isLayoutReady && widgets.length > 0 && (
                    <div className="px-[10px] py-[10px]">
                      <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-4 auto-rows-[100px]">
                        <div className="col-span-2 md:col-span-3 lg:col-span-3 row-span-3">
                          <Skeleton className="w-full h-full rounded-2xl" />
                        </div>
                        <div className="col-span-2 md:col-span-3 lg:col-span-3 row-span-3">
                          <Skeleton className="w-full h-full rounded-2xl" />
                        </div>
                        <div className="col-span-2 md:col-span-3 lg:col-span-3 row-span-2">
                          <Skeleton className="w-full h-full rounded-2xl" />
                        </div>
                        <div className="col-span-2 md:col-span-3 lg:col-span-3 row-span-2">
                          <Skeleton className="w-full h-full rounded-2xl" />
                        </div>
                      </div>
                    </div>
                  )}
                  <DashboardContextMenu onAddWidget={toggleWidgetSelector} onAutoArrange={handleAutoArrange}>
                    <div>
                      <ResponsiveReactGridLayout
                        className={`layout ${!isTransitionsEnabled ? 'layout-loading' : ''}`}
                        layouts={layouts}
                        breakpoints={breakpoints}
                        cols={cols}
                        rowHeight={rowHeight}
                        onLayoutChange={handleLayoutChange}
                        onBreakpointChange={(newBreakpoint: string) => {
                          if (newBreakpoint in cols && newBreakpoint !== currentBreakpoint) {
                            setCurrentBreakpoint(newBreakpoint as BreakpointName);
                          }
                        }}
                        onDragStart={handleDragStart}
                        onDragStop={handleDragStop}
                        onResizeStart={handleResizeStart}
                        onResizeStop={handleResizeStop}
                        margin={[GRID.ITEM_MARGIN, GRID.ITEM_MARGIN]}
                        containerPadding={[GRID.CONTAINER_PADDING, GRID.CONTAINER_PADDING]}
                        draggableHandle=".widget-drag-handle"
                        draggableCancel={DASHBOARD_INTERACTIVE_CHILD_SELECTOR}
                        useCSSTransforms={true}
                        measureBeforeMount={false}
                        compactType="vertical"
                        verticalCompact={true}
                        preventCollision={false}
                        isResizable={true}
                        isDraggable={true}
                        isBounded={false}
                        autoSize={true}
                        transformScale={1}
                        style={{
                          width: '100%',
                          minHeight: '100%',
                        }}
                      >
                        {renderWidgetItems()}
                      </ResponsiveReactGridLayout>
                    </div>
                  </DashboardContextMenu>
                </div>
              </div>
            )}
          </div>
        </main>
        {/* Add the footer */}
        <AppFooter />
      </div>
    </div>
  )
}

export default App
