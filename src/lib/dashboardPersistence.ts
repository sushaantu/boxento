import type { Dashboard, DashboardVisibility } from '@/components/dashboard/DashboardSwitcher';
import { STORAGE_KEYS } from '@/lib/constants';
import type { LayoutItem, Widget } from '@/types';

export type LayoutsByBreakpoint = { [key: string]: LayoutItem[] };

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

type LoadDashboardDataOptions = {
  createFreshLayouts: (widgets: Widget[]) => LayoutsByBreakpoint;
  createFreshWidgets: () => Widget[];
  dashboardId: string;
  getDefaultLayouts: () => LayoutsByBreakpoint;
  getDefaultWidgets: () => Widget[];
  reconcileLayouts: (layouts: LayoutsByBreakpoint, widgets: Widget[]) => LayoutsByBreakpoint;
  storage: StorageLike;
};

type DeleteDashboardPlanOptions = {
  currentDashboardId: string;
  dashboardId: string;
  dashboards: Dashboard[];
};

const readJson = <T>(storage: StorageLike, key: string, fallback: T): T => {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

export const getDashboardStorageKeys = (dashboardId: string) => ({
  widgets: `boxento-widgets-${dashboardId}`,
  layouts: `boxento-layouts-${dashboardId}`,
  configs: `boxento-configs-${dashboardId}`,
});

export const persistDashboardData = (
  storage: StorageLike,
  dashboardId: string,
  widgets: Widget[],
  layouts: LayoutsByBreakpoint
): void => {
  const keys = getDashboardStorageKeys(dashboardId);
  storage.setItem(keys.widgets, JSON.stringify(widgets));
  storage.setItem(keys.layouts, JSON.stringify(layouts));
};

export const loadDashboardDataFromStorage = ({
  createFreshLayouts,
  createFreshWidgets,
  dashboardId,
  getDefaultLayouts,
  getDefaultWidgets,
  reconcileLayouts,
  storage,
}: LoadDashboardDataOptions): { initializedFreshDashboard: boolean; layouts: LayoutsByBreakpoint; widgets: Widget[] } => {
  const keys = getDashboardStorageKeys(dashboardId);
  const savedWidgets = storage.getItem(keys.widgets);
  const savedLayouts = storage.getItem(keys.layouts);

  if (savedWidgets && savedLayouts) {
    const widgets = readJson<Widget[]>(storage, keys.widgets, []);
    const layouts = reconcileLayouts(readJson<LayoutsByBreakpoint>(storage, keys.layouts, {}), widgets);

    return {
      initializedFreshDashboard: false,
      layouts,
      widgets,
    };
  }

  if (dashboardId === 'personal') {
    const widgets = readJson<Widget[]>(storage, STORAGE_KEYS.WIDGETS, getDefaultWidgets());
    const layouts = reconcileLayouts(
      readJson<LayoutsByBreakpoint>(storage, STORAGE_KEYS.LAYOUTS, getDefaultLayouts()),
      widgets
    );

    return {
      initializedFreshDashboard: false,
      layouts,
      widgets,
    };
  }

  const widgets = createFreshWidgets();
  const layouts = createFreshLayouts(widgets);
  persistDashboardData(storage, dashboardId, widgets, layouts);

  return {
    initializedFreshDashboard: true,
    layouts,
    widgets,
  };
};

export const createDashboardRecord = (
  name: string,
  visibility: DashboardVisibility,
  timestamp: number
): Dashboard => ({
  id: `dashboard-${timestamp}`,
  name,
  visibility,
  sharedWith: [],
  isDefault: false,
  createdAt: new Date(timestamp).toISOString(),
});

export const removeDashboardData = (storage: StorageLike, dashboardId: string): void => {
  const keys = getDashboardStorageKeys(dashboardId);
  storage.removeItem(keys.widgets);
  storage.removeItem(keys.layouts);
  storage.removeItem(keys.configs);
};

export const planDashboardDeletion = ({
  currentDashboardId,
  dashboardId,
  dashboards,
}: DeleteDashboardPlanOptions): {
  dashboard: Dashboard | undefined;
  nextDashboardId: string;
  remainingDashboards: Dashboard[];
  shouldReloadDashboardId: string | null;
} => ({
  dashboard: dashboards.find((entry) => entry.id === dashboardId),
  nextDashboardId: currentDashboardId === dashboardId ? 'personal' : currentDashboardId,
  remainingDashboards: dashboards.filter((entry) => entry.id !== dashboardId),
  shouldReloadDashboardId: currentDashboardId === dashboardId ? 'personal' : null,
});
