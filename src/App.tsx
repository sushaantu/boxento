import React, { useState, useEffect, useRef, Suspense } from 'react'
import { Plus, Moon, Sun, Cloud, CloudOff, Loader2 } from 'lucide-react'
// Import GridLayout components - direct imports to avoid runtime issues

// @ts-expect-error - The types don't correctly represent the module structure
import { Responsive, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { getWidgetComponent, getWidgetConfigByType, WIDGET_REGISTRY } from '@/components/widgets'
import { 
  WidgetConfig, 
  Widget,
  LayoutItem
} from '@/types'
import WidgetErrorBoundary from '@/components/widgets/common/WidgetErrorBoundary'
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
import { DashboardSwitcher, Dashboard, DashboardVisibility } from '@/components/dashboard/DashboardSwitcher'
import { breakpoints, cols, createDefaultLayoutItem } from '@/lib/layoutUtils'
import { useNetworkStatus } from '@/lib/useNetworkStatus'
import { AppFooter } from '@/components/AppFooter'

interface WidgetCategory {
  [category: string]: WidgetConfig[];
}

// Create responsive grid layout with width provider - once, outside the component
// This is important for performance as it prevents recreation on each render
const ResponsiveReactGridLayout = WidthProvider(Responsive);

type BreakpointName = keyof typeof cols;
type LayoutsByBreakpoint = { [key: string]: LayoutItem[] };
type LayoutTemplate = Omit<LayoutItem, 'i'>;

const BREAKPOINT_ORDER = Object.keys(breakpoints)
  .sort((a, b) => breakpoints[b as BreakpointName] - breakpoints[a as BreakpointName]) as BreakpointName[];

const DEFAULT_LAYOUT_TEMPLATES: Record<BreakpointName, LayoutTemplate[]> = {
  xxxl: [
    { x: 0, y: 0, w: 6, h: 3, minW: 2, minH: 2 },
    { x: 6, y: 0, w: 6, h: 3, minW: 2, minH: 2 },
    { x: 12, y: 0, w: 6, h: 3, minW: 2, minH: 2 },
    { x: 18, y: 0, w: 6, h: 3, minW: 2, minH: 2 },
  ],
  xxl: [
    { x: 0, y: 0, w: 5, h: 3, minW: 2, minH: 2 },
    { x: 5, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
    { x: 9, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
    { x: 13, y: 0, w: 5, h: 3, minW: 2, minH: 2 },
  ],
  xl: [
    { x: 0, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
    { x: 4, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { x: 7, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { x: 10, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
  ],
  lg: [
    { x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { x: 3, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 5, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { x: 8, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  ],
  md: [
    { x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { x: 3, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 5, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
  ],
  sm: [
    { x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 3, w: 3, h: 2, minW: 2, minH: 2 },
    { x: 3, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
  ],
  xs: [
    { x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 2, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 4, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 6, w: 2, h: 3, minW: 2, minH: 2 },
  ],
  xxs: [
    { x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 2, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 4, w: 2, h: 2, minW: 2, minH: 2 },
    { x: 0, y: 6, w: 2, h: 3, minW: 2, minH: 2 },
  ],
};

const validateLayoutItem = (item: LayoutItem): LayoutItem => ({
  ...item,
  w: Math.max(item.w, 2), // Minimum width of 2
  h: Math.max(item.h, 2)  // Minimum height of 2
});

const clampLayoutItemToCols = (item: LayoutItem, colCount: number): LayoutItem => {
  const validated = validateLayoutItem(item);
  const nextW = Math.min(validated.w, colCount);
  const nextX = Math.min(validated.x, Math.max(0, colCount - nextW));

  return {
    ...validated,
    x: nextX,
    w: nextW,
    maxW: validated.maxW ? Math.min(validated.maxW, colCount) : validated.maxW,
  };
};

const validateLayout = (layout: LayoutItem[]): LayoutItem[] => {
  return layout.map(validateLayoutItem);
};

const layoutSignature = (layout: LayoutItem[]): string => (
  [...layout]
    .sort((a, b) => a.i.localeCompare(b.i))
    .map((item) => `${item.i}:${item.x}:${item.y}:${item.w}:${item.h}`)
    .join('|')
);

const findFallbackBreakpoint = (layouts: LayoutsByBreakpoint, breakpoint: BreakpointName): BreakpointName | null => {
  const startIndex = BREAKPOINT_ORDER.indexOf(breakpoint);

  for (let index = startIndex + 1; index < BREAKPOINT_ORDER.length; index += 1) {
    const candidate = BREAKPOINT_ORDER[index];
    if ((layouts[candidate] || []).length > 0) {
      return candidate;
    }
  }

  return null;
};

const scaleLayoutToCols = (
  layout: LayoutItem[],
  fromCols: number,
  toCols: number
): LayoutItem[] => {
  if (!layout.length || fromCols === toCols) {
    return layout.map((item) => clampLayoutItemToCols({ ...item }, toCols));
  }

  const scale = toCols / fromCols;

  return layout.map((item) => {
    const minW = item.minW || 2;
    const scaledW = Math.max(minW, Math.round(item.w * scale));
    const scaledX = Math.round(item.x * scale);
    const scaledMaxW = item.maxW ? Math.max(minW, Math.round(item.maxW * scale)) : item.maxW;

    return clampLayoutItemToCols(
      {
        ...item,
        x: scaledX,
        w: scaledW,
        maxW: scaledMaxW,
      },
      toCols
    );
  });
};

const createLayoutsFromTemplates = (widgetIds: string[]): LayoutsByBreakpoint => {
  const layoutsByBreakpoint: LayoutsByBreakpoint = {};

  BREAKPOINT_ORDER.forEach((breakpoint) => {
    const template = DEFAULT_LAYOUT_TEMPLATES[breakpoint];
    const colCount = cols[breakpoint];
    const layout: LayoutItem[] = [];

    widgetIds.forEach((widgetId, index) => {
      if (index < template.length) {
        layout.push({ ...template[index], i: widgetId });
        return;
      }

      layout.push(createDefaultLayoutItem(widgetId, index, colCount, breakpoint, layout));
    });

    layoutsByBreakpoint[breakpoint] = layout;
  });

  return layoutsByBreakpoint;
};

const validateLayouts = (layouts: LayoutsByBreakpoint): LayoutsByBreakpoint => {
  const validatedLayouts: LayoutsByBreakpoint = { ...layouts };

  BREAKPOINT_ORDER.forEach((breakpoint) => {
    const colCount = cols[breakpoint];
    validatedLayouts[breakpoint] = (validatedLayouts[breakpoint] || []).map((item) => clampLayoutItemToCols(item, colCount));
  });

  BREAKPOINT_ORDER.forEach((breakpoint) => {
    const fallbackBreakpoint = findFallbackBreakpoint(validatedLayouts, breakpoint);
    if (!fallbackBreakpoint) {
      return;
    }

    const currentLayout = validatedLayouts[breakpoint];
    const fallbackLayout = validatedLayouts[fallbackBreakpoint];
    const targetCols = cols[breakpoint];
    const fallbackCols = cols[fallbackBreakpoint];

    if (!currentLayout.length) {
      validatedLayouts[breakpoint] = scaleLayoutToCols(fallbackLayout, fallbackCols, targetCols);
      return;
    }

    if (targetCols <= fallbackCols || currentLayout.length !== fallbackLayout.length) {
      return;
    }

    if (targetCols > cols.lg && layoutSignature(currentLayout) === layoutSignature(fallbackLayout)) {
      validatedLayouts[breakpoint] = scaleLayoutToCols(fallbackLayout, fallbackCols, targetCols);
    }
  });

  return validatedLayouts;
};

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

function App() {
  // Register service worker for PWA functionality
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(() => {
            // ServiceWorker registration successful
          })
          .catch(error => {
            console.error('ServiceWorker registration failed: ', error);
          });
      });
    }
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
          return validateLayouts(parsed);
        }
      }

      // Fall back to legacy storage only for personal dashboard
      if (dashboardId === 'personal') {
        const savedLayouts = loadFromLocalStorage(STORAGE_KEYS.LAYOUTS, {});
        if (Object.keys(savedLayouts).length > 0) {
          return validateLayouts(savedLayouts);
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
  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('lg');
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

  // Helper to get storage keys for a specific dashboard
  const getDashboardStorageKeys = (dashboardId: string) => ({
    widgets: `boxento-widgets-${dashboardId}`,
    layouts: `boxento-layouts-${dashboardId}`,
    configs: `boxento-configs-${dashboardId}`,
  });

  // Save current dashboard's widgets and layouts before switching
  const saveCurrentDashboardData = () => {
    const keys = getDashboardStorageKeys(currentDashboardId);
    localStorage.setItem(keys.widgets, JSON.stringify(widgets));
    localStorage.setItem(keys.layouts, JSON.stringify(layouts));
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

  // Load widgets and layouts for a specific dashboard
  const loadDashboardData = async (dashboardId: string) => {
    const keys = getDashboardStorageKeys(dashboardId);

    // Try to load from dashboard-specific storage
    const savedWidgets = localStorage.getItem(keys.widgets);
    const savedLayouts = localStorage.getItem(keys.layouts);

    let widgetsToLoad: Widget[];
    let layoutsToLoad: { [key: string]: LayoutItem[] };

    if (savedWidgets && savedLayouts) {
      // Dashboard has saved data
      widgetsToLoad = JSON.parse(savedWidgets);
      layoutsToLoad = validateLayouts(JSON.parse(savedLayouts));
    } else if (dashboardId === 'personal') {
      // Personal dashboard falls back to legacy storage
      widgetsToLoad = loadFromLocalStorage(STORAGE_KEYS.WIDGETS, getDefaultWidgets());
      layoutsToLoad = validateLayouts(loadFromLocalStorage(STORAGE_KEYS.LAYOUTS, getDefaultLayouts()));
    } else {
      // Non-personal dashboards without storage get fresh widgets with unique IDs
      widgetsToLoad = generateFreshDefaultWidgets();
      layoutsToLoad = validateLayouts(generateLayoutsForWidgets(widgetsToLoad));
      // Save immediately so they persist
      localStorage.setItem(keys.widgets, JSON.stringify(widgetsToLoad));
      localStorage.setItem(keys.layouts, JSON.stringify(layoutsToLoad));
    }

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
    setLayouts(validateLayouts(layoutsToLoad));
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

    const newDashboard: Dashboard = {
      id: `dashboard-${Date.now()}`,
      name,
      visibility,
      sharedWith: [],
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    setDashboards(prev => [...prev, newDashboard]);
    setCurrentDashboardId(newDashboard.id);

    // Generate fresh widgets with UNIQUE IDs for this dashboard
    // This ensures widget configs don't conflict between dashboards
    const freshWidgets = generateFreshDefaultWidgets();
    const freshLayouts = generateLayoutsForWidgets(freshWidgets);

    setWidgets(freshWidgets);
    setLayouts(validateLayouts(freshLayouts));

    // Save to the new dashboard's storage immediately
    const keys = getDashboardStorageKeys(newDashboard.id);
    localStorage.setItem(keys.widgets, JSON.stringify(freshWidgets));
    localStorage.setItem(keys.layouts, JSON.stringify(freshLayouts));

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
    const dashboard = dashboards.find(d => d.id === dashboardId);
    if (dashboard?.isDefault) return; // Can't delete default

    // Clean up storage for deleted dashboard
    const keys = getDashboardStorageKeys(dashboardId);
    localStorage.removeItem(keys.widgets);
    localStorage.removeItem(keys.layouts);
    localStorage.removeItem(keys.configs);

    // Delete from public-dashboards collection if it was public/team
    if (dashboard?.visibility !== 'private' && auth?.currentUser) {
      try {
        await publicDashboardService.deleteDashboard(dashboardId);
      } catch (error) {
        console.error('Error deleting public dashboard:', error);
      }
    }

    setDashboards(prev => prev.filter(d => d.id !== dashboardId));
    if (currentDashboardId === dashboardId) {
      setCurrentDashboardId('personal');
      // Load personal dashboard data
      loadDashboardData('personal');
    }
  };

  const widgetCategories: WidgetCategory = (() => {
    // Group widgets by category
    const categories: WidgetCategory = {};
    
    WIDGET_REGISTRY.forEach(widget => {
      const category = widget.category || 'Other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(widget);
    });
    
    return categories;
  })();
  
  // References for debouncing updates
  const layoutUpdateTimeout = useRef<number | null>(null);
  const widgetUpdateTimeout = useRef<number | null>(null);
  const publicDashboardSyncTimeout = useRef<number | null>(null);

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
   * Save widgets to storage (localStorage and Firestore if logged in)
   *
   * @param updatedWidgets - Array of widgets to save
   * @param debounce - If true, Firestore save is scheduled for 500ms later and function returns immediately.
   *                   If false, waits for Firestore save to complete before returning.
   *                   Use debounce=false when sequential operation order matters (e.g., during migration).
   */
  const saveWidgets = async (updatedWidgets: Widget[], debounce = true): Promise<void> => {
    setWidgets(updatedWidgets);

    // Save to per-dashboard localStorage
    const keys = getDashboardStorageKeys(currentDashboardId);
    localStorage.setItem(keys.widgets, JSON.stringify(updatedWidgets));

    // Save each widget's configuration separately using configManager
    updatedWidgets.forEach(widget => {
      if (widget.config && widget.id) {
        const configToSave = prepareWidgetConfigForSave(widget.config);
        configManager.saveWidgetConfig(widget.id, configToSave);
      }
    });

    // Save widgets to Firestore when user is logged in
    if (auth?.currentUser) {
      // IMPORTANT: Only save to user's global Firestore storage for the personal dashboard
      // Non-personal dashboards use localStorage + public-dashboards collection only
      // This prevents overwriting personal dashboard data when editing other dashboards
      if (currentDashboardId === 'personal') {
        // Extract Firestore save logic to avoid duplication
        const saveToFirestore = async () => {
          try {
            await userDashboardService.saveWidgets(updatedWidgets);
            // Widget metadata saved to Firestore
          } catch (error) {
            console.error('Error saving widgets to Firestore:', error);
          }
        };

        // Always cancel pending debounced save to prevent race conditions
        if (widgetUpdateTimeout.current !== null) {
          clearTimeout(widgetUpdateTimeout.current);
          widgetUpdateTimeout.current = null;
        }

        if (debounce) {
          // Schedule save for later (returns immediately)
          widgetUpdateTimeout.current = window.setTimeout(saveToFirestore, TIMING.SAVE_DEBOUNCE_MS);
        } else {
          // Save immediately and wait for completion
          await saveToFirestore();
        }
      }

      // Sync to public dashboard if visibility is public/team
      syncPublicDashboard(currentDashboard, updatedWidgets, layouts);
    }
  };
  
  /**
   * Save layouts to storage (localStorage and Firestore if logged in)
   *
   * @param updatedLayouts - Layout configuration for all breakpoints
   * @param debounce - If true, Firestore save is scheduled for 500ms later and function returns immediately.
   *                   If false, waits for Firestore save to complete before returning.
   *                   Use debounce=false when sequential operation order matters (e.g., during migration).
   */
  const saveLayouts = async (updatedLayouts: { [key: string]: LayoutItem[] }, debounce = true): Promise<void> => {
    const normalizedLayouts = validateLayouts(updatedLayouts);

    // Update state
    setLayouts(normalizedLayouts);

    // Save to per-dashboard localStorage
    const keys = getDashboardStorageKeys(currentDashboardId);
    localStorage.setItem(keys.layouts, JSON.stringify(normalizedLayouts));

    // Save to Firestore if logged in
    if (auth?.currentUser) {
      // IMPORTANT: Only save to user's global Firestore storage for the personal dashboard
      // Non-personal dashboards use localStorage + public-dashboards collection only
      // This prevents overwriting personal dashboard data when editing other dashboards
      if (currentDashboardId === 'personal') {
        // Extract Firestore save logic to avoid duplication
        const saveToFirestore = async () => {
          try {
            await userDashboardService.saveLayouts(normalizedLayouts);
            // Layouts saved to Firestore
          } catch (error) {
            console.error('Error saving layouts to Firestore:', error);
          }
        };

        // Always cancel pending debounced save to prevent race conditions
        if (layoutUpdateTimeout.current !== null) {
          clearTimeout(layoutUpdateTimeout.current);
          layoutUpdateTimeout.current = null;
        }

        if (debounce) {
          // Schedule save for later (returns immediately)
          layoutUpdateTimeout.current = window.setTimeout(saveToFirestore, TIMING.SAVE_DEBOUNCE_MS);
        } else {
          // Save immediately and wait for completion
          await saveToFirestore();
        }
      }

      // Sync to public dashboard if visibility is public/team
      syncPublicDashboard(currentDashboard, widgets, normalizedLayouts);
    }
  };

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
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Listen for resize events to update the breakpoint
  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      let newBreakpoint = 'lg';
      
      // Find which breakpoint we're in
      for (const bp of Object.keys(breakpoints).sort((a, b) => 
        breakpoints[b as keyof typeof breakpoints] - breakpoints[a as keyof typeof breakpoints])) {
        if (width >= breakpoints[bp as keyof typeof breakpoints]) {
          newBreakpoint = bp;
          break;
        }
      }
      
      if (newBreakpoint !== currentBreakpoint) {
        setCurrentBreakpoint(newBreakpoint);
        // Breakpoint changed
      }
    };
    
    // Initial check
    updateBreakpoint();
    
    // Add listener
    window.addEventListener('resize', updateBreakpoint);
    
    // Clean up
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, [currentBreakpoint]);
  
  // Calculate row height based on window width to ensure square widgets
  const calculateRowHeight = (): number => {
    const columnCount = cols[currentBreakpoint as BreakpointName] || cols.lg;
    const totalPadding = GRID.CONTAINER_PADDING * 2;
    const totalMargins = GRID.ITEM_MARGIN * (columnCount - 1);
    const usableWidth = windowWidth - totalPadding - totalMargins;

    const columnWidth = usableWidth / columnCount;

    if (windowWidth < 600) {
      return columnWidth * 0.8;
    } else if (windowWidth < 1200) {
      return columnWidth * 0.9;
    } else {
      return columnWidth;
    }
  };
  
  const rowHeight = calculateRowHeight();
  
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
    const updatedLayouts = { ...layouts };
    
    // For each breakpoint, add a layout item
    Object.keys(breakpoints).forEach((breakpoint) => {
      if (!updatedLayouts[breakpoint]) {
        updatedLayouts[breakpoint] = [];
      }
      
      // Calculate column count for this breakpoint
      const colCount = cols[breakpoint as keyof typeof cols];
      
      // Create default layout item based on the breakpoint
      // Pass existing layout so it can find the first available position
      const defaultItem = createDefaultLayoutItem(
        widgetId,
        updatedLayouts[breakpoint].length,
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
      
      updatedLayouts[breakpoint].push(defaultItem);
    });
    
    // Update states and save data
    setWidgets(updatedWidgets);
    setLayouts(updatedLayouts);
    setLastCreatedWidgetId(widgetId);
    
    // Save changes
    saveWidgets(updatedWidgets);
    saveLayouts(updatedLayouts, false);
    
    // Close the widget selector if it's open
    if (widgetSelectorOpen) {
      setWidgetSelectorOpen(false);
    }
  };
  
  // Delete widget function - refactored to reduce duplication
  const deleteWidget = async (widgetId: string): Promise<void> => {
    // Remove widget config from storage
    await configManager.clearConfig(widgetId);
    
    // Remove widget from state
    const updatedWidgets = widgets.filter(widget => widget.id !== widgetId);
    
    // Remove layout item from all breakpoints
    const updatedLayouts = { ...layouts };
    Object.keys(updatedLayouts).forEach(breakpoint => {
      updatedLayouts[breakpoint] = updatedLayouts[breakpoint].filter(item => item.i !== widgetId);
    });
    
    // Update state and save
    setWidgets(updatedWidgets);
    setLayouts(updatedLayouts);
    
    // Save changes
    saveWidgets(updatedWidgets);
    saveLayouts(updatedLayouts, false);
  };
  
  // Update layout function - refactored to reduce duplication
  const handleLayoutChange = (currentLayout: LayoutItem[], allLayouts?: { [key: string]: LayoutItem[] }): void => {
    const validatedLayout = validateLayout(currentLayout);

    // If we have all layouts from the responsive grid
    if (allLayouts) {
      // Use a timeout to debounce the layout update
      if (layoutUpdateTimeout.current !== null) {
        clearTimeout(layoutUpdateTimeout.current);
      }
      
      layoutUpdateTimeout.current = window.setTimeout(() => {
        // Create a validated copy to prevent mutating the input
        const validatedLayouts = validateLayouts(allLayouts);
        
        // Update layout state and save
        setLayouts(validatedLayouts);
        saveLayouts(validatedLayouts);
      }, 100); // 100ms debounce
    } else {
      // If we only have the current layout, update only the current breakpoint
      const updatedLayouts = { ...layouts };
      updatedLayouts[currentBreakpoint] = validatedLayout;
      
      // Update state and save
      setLayouts(updatedLayouts);
      saveLayouts(updatedLayouts);
    }
  };
  
  // Update widget config - refactored to be more maintainable
  const updateWidgetConfig = (widgetId: string, newConfig: Record<string, unknown>): void => {
    // Update widget in state
    const updatedWidgets = widgets.map(widget => 
      widget.id === widgetId 
        ? { ...widget, config: { ...widget.config, ...newConfig } }
        : widget
    );
    
    setWidgets(updatedWidgets);
    
    // Save to configManager - excluding function properties
    const configToSave = prepareWidgetConfigForSave(newConfig);
    configManager.saveWidgetConfig(widgetId, configToSave);
    
    // Save to Firestore if logged in
    if (auth?.currentUser) {
      saveWidgets(updatedWidgets);
    }
  };

  // Unified widget rendering function
  const renderWidget = (widget: Widget, isMobileView = false): React.ReactNode => {
    const WidgetComponent = getWidgetComponent(widget.type);
    
    if (!WidgetComponent) {
      return (
        <div className="widget-error">
          <p>Widget type "{widget.type}" not found</p>
        </div>
      );
    }
    
    // Get widget dimensions
    const getWidgetDimensions = () => {
      // If layout isn't ready yet, use default dimensions
      if (!isLayoutReady) {
        return { width: isMobileView ? 2 : 3, height: isMobileView ? 2 : 3 };
      }
      
      // Find layout item for this widget
      const layoutItem = layouts[currentBreakpoint]?.find(item => item.i === widget.id);
      
      // If no layout item found, use default dimensions
      if (!layoutItem) {
        return { width: isMobileView ? 2 : 3, height: isMobileView ? 2 : 3 };
      }
      
      // Use the layout item dimensions
      return {
        width: isMobileView ? 2 : layoutItem.w,
        height: isMobileView ? 2 : layoutItem.h
      };
    };
    
    const { width, height } = getWidgetDimensions();
    
    // Determine if we're in read-only mode (viewing someone else's dashboard)
    // For now, check if dashboard has an ownerId that doesn't match current user
    const isReadOnly = currentDashboard.ownerId !== undefined &&
                       auth?.currentUser?.uid !== currentDashboard.ownerId;

    // Create widget config with callbacks
    // IMPORTANT: Include widget.id so widgets can use it for storage keys
    // In read-only mode, don't provide edit/delete callbacks
    const widgetConfig = {
      ...widget.config,
      id: widget.id,
      readOnly: isReadOnly,
      ...(isReadOnly ? {} : {
        onDelete: () => deleteWidget(widget.id),
        onUpdate: (newConfig: Record<string, unknown>) => updateWidgetConfig(widget.id, newConfig)
      })
    };
    
    return (
      <WidgetErrorBoundary>
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center bg-card rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }>
          <WidgetComponent
            width={width}
            height={height}
            config={widgetConfig}
          />
        </Suspense>
      </WidgetErrorBoundary>
    );
  };
  
  // Handle drag events - refactored to be more maintainable
  const [dragDirection, setDragDirection] = useState<'left' | 'right' | null>(null);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const lastMousePos = useRef<{ x: number, y: number } | null>(null);
  const dragThreshold = 5; // Minimum mouse movement to determine direction
  
  const handleDragStart = (_layout: LayoutItem[], _oldItem: LayoutItem, newItem: LayoutItem, _placeholder: LayoutItem, event: MouseEvent): void => {
    document.body.classList.add('dragging', 'react-grid-layout--dragging');
    setDraggedWidgetId(newItem.i);
    lastMousePos.current = { x: event.clientX, y: event.clientY };
    setDragDirection(null);
    // Drag started
  };
  
  const handleDrag = (_layout: LayoutItem[], _oldItem: LayoutItem, _newItem: LayoutItem, _placeholder: LayoutItem, event: MouseEvent): void => {
    // Skip if no mouse position
    if (!lastMousePos.current) return;
    
    // Calculate direction based on mouse movement
    const deltaX = event.clientX - lastMousePos.current.x;
    
    // Only change direction if movement is significant
    if (Math.abs(deltaX) > dragThreshold) {
      const newDirection = deltaX < 0 ? 'left' : 'right';
      
      // Only update if direction changed
      if (newDirection !== dragDirection) {
        setDragDirection(newDirection);
      }
      
      // Update last position
      lastMousePos.current = { x: event.clientX, y: event.clientY };
    }
  };
  
  const handleDragStop = (): void => {
    // Apply rebound class before removing direction class
    if (draggedWidgetId) {
      // Find the widget that was being dragged by ID
      const widgetElement = document.querySelector(`.react-grid-item[data-grid*="i:${draggedWidgetId}"]`);
      if (widgetElement) {
        widgetElement.classList.add('drag-rebound');
        
        // Remove rebound class after animation completes
        setTimeout(() => {
          widgetElement.classList.remove('drag-rebound');
        }, TIMING.WIDGET_REMOVE_ANIMATION_MS);
      }
    }
    
    // Reset states
    setDragDirection(null);
    setDraggedWidgetId(null);
    lastMousePos.current = null;
    
    // Remove classes
    document.body.classList.remove('dragging', 'react-grid-layout--dragging');
    
    // Save the layout
    saveLayouts(layouts, false);
    // Drag completed, layout saved
  };
  
  // Apply drag direction classes to the dragged widget
  useEffect(() => {
    if (draggedWidgetId && dragDirection) {
      // Find the dragged widget element
      const widgetElement = document.querySelector(`.react-grid-item[data-grid*="i:${draggedWidgetId}"].react-draggable-dragging`);

      if (widgetElement) {
        // Remove any existing direction classes
        widgetElement.classList.remove('dragging-left', 'dragging-right');

        // Add the appropriate direction class
        widgetElement.classList.add(`dragging-${dragDirection}`);
      }
    }
  }, [draggedWidgetId, dragDirection]);

  // Cleanup drag/resize classes on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clean up any lingering drag/resize classes from body
      document.body.classList.remove(
        'dragging',
        'react-grid-layout--dragging',
        'react-grid-layout--resizing'
      );

      // Clean up any widget-specific classes
      document.querySelectorAll('.dragging-left, .dragging-right, .drag-rebound').forEach(el => {
        el.classList.remove('dragging-left', 'dragging-right', 'drag-rebound');
      });
    };
  }, []);

  // Track resizing widget for constraint feedback
  const [resizingWidgetId, setResizingWidgetId] = useState<string | null>(null);
  const lastResizeSize = useRef<{ w: number; h: number } | null>(null);

  // Handle resize events
  const handleResizeStart = (_layout: LayoutItem[], _oldItem: LayoutItem, newItem: LayoutItem): void => {
    document.body.classList.add('react-grid-layout--resizing');
    setResizingWidgetId(newItem.i);
    lastResizeSize.current = { w: newItem.w, h: newItem.h };
  };

  // Handle resize in progress - for constraint feedback
  const handleResize = (_layout: LayoutItem[], _oldItem: LayoutItem, newItem: LayoutItem): void => {
    if (!resizingWidgetId || !lastResizeSize.current) return;

    const widgetElement = document.querySelector(`[data-grid*='"i":"${newItem.i}"']`) as HTMLElement;
    if (!widgetElement) return;

    // Check if hitting min constraints
    const isAtMinWidth = newItem.w === (newItem.minW || 2);
    const isAtMinHeight = newItem.h === (newItem.minH || 2);
    const wasLarger = lastResizeSize.current.w > newItem.w || lastResizeSize.current.h > newItem.h;

    // Check if hitting max constraints
    const isAtMaxWidth = newItem.maxW && newItem.w === newItem.maxW;
    const isAtMaxHeight = newItem.maxH && newItem.h === newItem.maxH;
    const wasSmaller = lastResizeSize.current.w < newItem.w || lastResizeSize.current.h < newItem.h;

    // Apply constraint feedback classes
    if ((isAtMinWidth || isAtMinHeight) && wasLarger) {
      widgetElement.classList.remove('at-max-size');
      widgetElement.classList.add('at-min-size');
      // Remove after animation
      setTimeout(() => widgetElement.classList.remove('at-min-size'), 300);
    } else if ((isAtMaxWidth || isAtMaxHeight) && wasSmaller) {
      widgetElement.classList.remove('at-min-size');
      widgetElement.classList.add('at-max-size');
      // Remove after animation
      setTimeout(() => widgetElement.classList.remove('at-max-size'), 300);
    }

    lastResizeSize.current = { w: newItem.w, h: newItem.h };
  };

  const handleResizeStop = (_layout: LayoutItem[], _oldItem: LayoutItem, newItem: LayoutItem): void => {
    document.body.classList.remove('react-grid-layout--resizing');

    // Apply bounce effect to the resized widget
    const widgetElement = document.querySelector(`[data-grid*='"i":"${newItem.i}"']`) as HTMLElement;
    if (widgetElement) {
      widgetElement.classList.add('resize-complete');
      // Remove class after animation completes
      setTimeout(() => {
        widgetElement.classList.remove('resize-complete');
      }, 400);
    }

    // Reset tracking
    setResizingWidgetId(null);
    lastResizeSize.current = null;

    saveLayouts(layouts, false);
  };
  
  // Toggle widget selector
  const toggleWidgetSelector = (): void => {
    setWidgetSelectorOpen(!widgetSelectorOpen);
  };
  
  // Unified function to render widget items for the grid
  const renderWidgetItems = () => {
    return widgets.map(widget => {
      // Find the layout data for this widget
      const layoutItem = layouts[currentBreakpoint]?.find(item => item.i === widget.id);
      const widgetMeta = getWidgetConfigByType(widget.type);
      
      // Determine if mobile view
      const isMobile = currentBreakpoint === 'xs' || currentBreakpoint === 'xxs';
      
      // Set default dimensions
      const defaultWidth = isMobile ? 2 : 3;
      const defaultHeight = isMobile ? 2 : 3;
      
      // Create data-grid object with fallbacks
      const dataGrid = {
        i: widget.id,
        x: layoutItem?.x ?? 0,
        y: layoutItem?.y ?? 0,
        w: layoutItem?.w ?? defaultWidth,
        h: isMobile ? 5 : (layoutItem?.h ?? defaultHeight),
        minW: layoutItem?.minW ?? widgetMeta?.minWidth ?? 2,
        minH: isMobile ? 3 : (layoutItem?.minH ?? widgetMeta?.minHeight ?? 2),
        maxW: isMobile ? undefined : (layoutItem?.maxW ?? widgetMeta?.maxSize?.w),
        maxH: isMobile ? undefined : (layoutItem?.maxH ?? widgetMeta?.maxSize?.h),
      };
      
      // Add different classes based on screen size
      const isTablet = currentBreakpoint === 'sm';
      const sizeClass = isMobile ? 'mobile-widget' : isTablet ? 'tablet-widget' : 'desktop-widget';
      
      return (
        <div 
          key={widget.id} 
          className={`widget-wrapper ${sizeClass} app-widget`} 
          data-grid={dataGrid}
          data-breakpoint={currentBreakpoint}
          style={isMobile ? { marginBottom: '16px', height: 'auto' } : undefined}
        >
          {renderWidget(widget, isMobile)}
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
            className="mobile-widget-item"
          >
            {renderWidget(widget, true)}
          </div>
        ))}
      </div>
    );
  };
  
  // Load local data (async to properly load encrypted configs)
  const loadLocalData = async () => {
    const personalKeys = getDashboardStorageKeys('personal');

    // Check if we need to migrate legacy data to personal dashboard
    const hasLegacyData = localStorage.getItem(STORAGE_KEYS.WIDGETS);
    const hasPersonalDashboardData = localStorage.getItem(personalKeys.widgets);

    // If we have legacy data but no personal dashboard data, migrate
    if (hasLegacyData && !hasPersonalDashboardData) {
      localStorage.setItem(personalKeys.widgets, hasLegacyData);
      const legacyLayouts = localStorage.getItem(STORAGE_KEYS.LAYOUTS);
      if (legacyLayouts) {
        localStorage.setItem(personalKeys.layouts, legacyLayouts);
      }
    }

    // Load from dashboard-specific storage
    const keys = getDashboardStorageKeys(currentDashboardId);
    const dashboardWidgets = localStorage.getItem(keys.widgets);
    const dashboardLayouts = localStorage.getItem(keys.layouts);

    // Load widgets and layouts together to ensure they match
    let localWidgets: Widget[];
    let localLayouts: { [key: string]: LayoutItem[] };

    if (dashboardWidgets && dashboardLayouts) {
      // Dashboard has saved data - use it
      localWidgets = JSON.parse(dashboardWidgets);
      localLayouts = validateLayouts(JSON.parse(dashboardLayouts));
    } else if (currentDashboardId === 'personal') {
      // Personal dashboard can fall back to legacy storage
      localWidgets = loadFromLocalStorage(STORAGE_KEYS.WIDGETS, getDefaultWidgets());
      localLayouts = validateLayouts(loadFromLocalStorage(STORAGE_KEYS.LAYOUTS, getDefaultLayouts()));
    } else {
      // Non-personal dashboards without storage get fresh widgets with unique IDs
      // AND matching layouts to ensure they work together
      localWidgets = generateFreshDefaultWidgets();
      localLayouts = validateLayouts(generateLayoutsForWidgets(localWidgets));
      // Save immediately so they persist
      const keys = getDashboardStorageKeys(currentDashboardId);
      localStorage.setItem(keys.widgets, JSON.stringify(localWidgets));
      localStorage.setItem(keys.layouts, JSON.stringify(localLayouts));
    }

    setLayouts(validateLayouts(localLayouts));

    // Load and decrypt widget configs from localStorage
    const localConfigs = await configManager.getConfigs(true);

    // Merge configs into widgets
    const widgetsWithConfigs = localWidgets.map((widget: Widget) => {
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

          // 6. Validate and fix layouts based on the widgets
          const validatedLayouts = validateLayouts(await userDashboardService.validateAndFixLayouts(
            typedWidgets.map(w => ({ id: w.id, type: w.type }))
          ));

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
            setLayouts(validateLayouts(validatedLayouts));
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
  
  // Initialize auth listener
  useEffect(() => {
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

      // ALWAYS load from localStorage first - this prevents blocking on Firebase auth
      // and ensures the dashboard shows quickly
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
  }, []);
  
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
    const updatedLayouts = { ...layouts };

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
          updatedLayouts[breakpoint].push(newItem);
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
        updatedLayouts = { ...layouts };
        
        // For each breakpoint, add a layout item
        Object.keys(breakpoints).forEach((breakpoint) => {
          if (!updatedLayouts[breakpoint]) {
            updatedLayouts[breakpoint] = [];
          }
          
          // Calculate column count for this breakpoint
          const colCount = cols[breakpoint as keyof typeof cols];
          
          // Create default layout item based on the breakpoint
          const defaultItem = createDefaultLayoutItem(
            widgetId, 
            updatedLayouts[breakpoint].length, 
            colCount,
            breakpoint
          );
          
          // Set appropriate size for video content
          if (breakpoint === 'lg' || breakpoint === 'md') {
            defaultItem.w = 4; // Wider for better video viewing
            defaultItem.h = 3; // 16:9 aspect ratio approximately
          }
          
          updatedLayouts[breakpoint].push(defaultItem);
        });
        
        // Update states
        setWidgets(updatedWidgets);
        setLayouts(updatedLayouts);
        setLastCreatedWidgetId(widgetId);
        
        // Save changes
        saveWidgets(updatedWidgets);
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
              className="rounded-full h-9 transition-colors"
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4 sm:mr-2" /> {/* Remove margin on xs */}
              <span className="hidden sm:inline">Add Widget</span> {/* Hide text on xs */}
            </Button>

            <Button
              onClick={toggleTheme}
              className="rounded-full h-9 w-9 p-0 flex items-center justify-center transition-colors"
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
            <div className="mobile-view-container">
              <div className="mobile-view">
                {renderMobileLayout()}
              </div>
            </div>

            <div className="desktop-view-container">
              {/* Show skeleton grid while layout is calculating */}
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
              {/* Hide grid completely until layout is ready to prevent position animation */}
              <DashboardContextMenu onAddWidget={toggleWidgetSelector} onAutoArrange={handleAutoArrange}>
                <div className={isLayoutReady ? '' : 'hidden'}>
                  <ResponsiveReactGridLayout
                    className={`layout ${!isTransitionsEnabled ? 'layout-loading' : ''}`}
                    layouts={layouts}
                    breakpoints={breakpoints}
                    cols={cols}
                    rowHeight={rowHeight}
                    onLayoutChange={handleLayoutChange}
                    onBreakpointChange={(newBreakpoint: string) => {
                      if (newBreakpoint !== currentBreakpoint) {
                        // Breakpoint changed
                        setCurrentBreakpoint(newBreakpoint);
                      }
                    }}
                    onDragStart={handleDragStart}
                    onDrag={handleDrag}
                    onDragStop={handleDragStop}
                    onResizeStart={handleResizeStart}
                    onResize={handleResize}
                    onResizeStop={handleResizeStop}
                    margin={[GRID.ITEM_MARGIN, GRID.ITEM_MARGIN]}
                    containerPadding={[GRID.CONTAINER_PADDING, GRID.CONTAINER_PADDING]}
                    draggableHandle=".widget-drag-handle"
                    draggableCancel=".settings-button"
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
                    style={{ width: '100%', minHeight: '100%' }}
                  >
                    {renderWidgetItems()}
                  </ResponsiveReactGridLayout>
                </div>
              </DashboardContextMenu>
            </div>
          </div>
        </main>
        {/* Add the footer */}
        <AppFooter />
      </div>
    </div>
  )
}

export default App
