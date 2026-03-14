import { beforeEach, describe, expect, it } from 'vitest';

import type { Dashboard } from '@/components/dashboard/DashboardSwitcher';
import { STORAGE_KEYS } from '@/lib/constants';
import {
  createDashboardRecord,
  getDashboardStorageKeys,
  loadDashboardDataFromStorage,
  persistDashboardData,
  planDashboardDeletion,
  removeDashboardData,
} from '@/lib/dashboardPersistence';
import type { LayoutItem, Widget } from '@/types';

type LocalStorageMock = {
  clear: () => void;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

const createLocalStorageMock = (): LocalStorageMock => {
  const store = new Map<string, string>();

  return {
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
};

const createLayouts = (widgetId: string): Record<string, LayoutItem[]> => ({
  lg: [
    {
      i: widgetId,
      x: 1,
      y: 2,
      w: 3,
      h: 4,
      minW: 1,
      minH: 1,
    },
  ],
});

const createWidgets = (widgetId: string): Widget[] => [
  {
    id: widgetId,
    type: 'quick-links',
    config: {
      customTitle: 'Quick Links',
    },
  },
];

const personalDashboard: Dashboard = {
  id: 'personal',
  name: 'Personal',
  visibility: 'private',
  sharedWith: [],
  isDefault: true,
  createdAt: '2026-03-12T00:00:00.000Z',
};

const teamDashboard: Dashboard = {
  id: 'team-dashboard',
  name: 'Team',
  visibility: 'private',
  sharedWith: [],
  isDefault: false,
  createdAt: '2026-03-13T00:00:00.000Z',
};

describe('dashboardPersistence helpers', () => {
  let storage: LocalStorageMock;

  beforeEach(() => {
    storage = createLocalStorageMock();
  });

  it('persists dashboard snapshots to scoped storage keys', () => {
    const widgets = createWidgets('quick-links-ops');
    const layouts = createLayouts('quick-links-ops');

    persistDashboardData(storage, 'ops-dashboard', widgets, layouts);

    const keys = getDashboardStorageKeys('ops-dashboard');
    expect(JSON.parse(storage.getItem(keys.widgets) || 'null')).toEqual(widgets);
    expect(JSON.parse(storage.getItem(keys.layouts) || 'null')).toEqual(layouts);
    expect(storage.getItem(STORAGE_KEYS.WIDGETS)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.LAYOUTS)).toBeNull();
  });

  it('loads scoped non-personal dashboard data without falling back to personal legacy storage', () => {
    const teamWidgets = createWidgets('quick-links-team');
    const teamLayouts = createLayouts('quick-links-team');
    const personalWidgets = createWidgets('quick-links-personal');
    const personalLayouts = createLayouts('quick-links-personal');

    persistDashboardData(storage, 'team-dashboard', teamWidgets, teamLayouts);
    storage.setItem(STORAGE_KEYS.WIDGETS, JSON.stringify(personalWidgets));
    storage.setItem(STORAGE_KEYS.LAYOUTS, JSON.stringify(personalLayouts));

    const loaded = loadDashboardDataFromStorage({
      createFreshLayouts: createLayouts,
      createFreshWidgets: () => createWidgets('fresh'),
      dashboardId: 'team-dashboard',
      getDefaultLayouts: () => createLayouts('default'),
      getDefaultWidgets: () => createWidgets('default'),
      reconcileLayouts: (layouts) => layouts,
      storage,
    });

    expect(loaded.initializedFreshDashboard).toBe(false);
    expect(loaded.widgets).toEqual(teamWidgets);
    expect(loaded.layouts).toEqual(teamLayouts);
  });

  it('loads the personal dashboard from legacy storage when scoped keys are missing', () => {
    const personalWidgets = createWidgets('quick-links-personal');
    const personalLayouts = createLayouts('quick-links-personal');

    storage.setItem(STORAGE_KEYS.WIDGETS, JSON.stringify(personalWidgets));
    storage.setItem(STORAGE_KEYS.LAYOUTS, JSON.stringify(personalLayouts));

    const loaded = loadDashboardDataFromStorage({
      createFreshLayouts: createLayouts,
      createFreshWidgets: () => createWidgets('fresh'),
      dashboardId: 'personal',
      getDefaultLayouts: () => createLayouts('default'),
      getDefaultWidgets: () => createWidgets('default'),
      reconcileLayouts: (layouts) => layouts,
      storage,
    });

    expect(loaded.initializedFreshDashboard).toBe(false);
    expect(loaded.widgets).toEqual(personalWidgets);
    expect(loaded.layouts).toEqual(personalLayouts);
  });

  it('initializes and persists fresh state for new non-personal dashboards', () => {
    const freshWidgets = createWidgets('quick-links-fresh');
    const freshLayouts = createLayouts('quick-links-fresh');

    const loaded = loadDashboardDataFromStorage({
      createFreshLayouts: () => freshLayouts,
      createFreshWidgets: () => freshWidgets,
      dashboardId: 'travel-dashboard',
      getDefaultLayouts: () => createLayouts('default'),
      getDefaultWidgets: () => createWidgets('default'),
      reconcileLayouts: (layouts) => layouts,
      storage,
    });

    const keys = getDashboardStorageKeys('travel-dashboard');
    expect(loaded.initializedFreshDashboard).toBe(true);
    expect(loaded.widgets).toEqual(freshWidgets);
    expect(loaded.layouts).toEqual(freshLayouts);
    expect(JSON.parse(storage.getItem(keys.widgets) || 'null')).toEqual(freshWidgets);
    expect(JSON.parse(storage.getItem(keys.layouts) || 'null')).toEqual(freshLayouts);
  });

  it('creates deterministic dashboard records for new dashboards', () => {
    expect(createDashboardRecord('Travel Board', 'public', 1_710_374_400_000)).toEqual({
      id: 'dashboard-1710374400000',
      name: 'Travel Board',
      visibility: 'public',
      sharedWith: [],
      isDefault: false,
      createdAt: '2024-03-14T00:00:00.000Z',
    });
  });

  it('removes dashboard storage and falls back to personal when deleting the current dashboard', () => {
    persistDashboardData(storage, 'team-dashboard', createWidgets('quick-links-team'), createLayouts('quick-links-team'));
    storage.setItem(getDashboardStorageKeys('team-dashboard').configs, JSON.stringify({ some: 'config' }));

    const deletionPlan = planDashboardDeletion({
      currentDashboardId: 'team-dashboard',
      dashboardId: 'team-dashboard',
      dashboards: [personalDashboard, teamDashboard],
    });

    removeDashboardData(storage, 'team-dashboard');

    expect(deletionPlan.dashboard).toEqual(teamDashboard);
    expect(deletionPlan.remainingDashboards).toEqual([personalDashboard]);
    expect(deletionPlan.nextDashboardId).toBe('personal');
    expect(deletionPlan.shouldReloadDashboardId).toBe('personal');

    const keys = getDashboardStorageKeys('team-dashboard');
    expect(storage.getItem(keys.widgets)).toBeNull();
    expect(storage.getItem(keys.layouts)).toBeNull();
    expect(storage.getItem(keys.configs)).toBeNull();
  });

  it('keeps the current dashboard selection when deleting a different dashboard', () => {
    const deletionPlan = planDashboardDeletion({
      currentDashboardId: 'personal',
      dashboardId: 'team-dashboard',
      dashboards: [personalDashboard, teamDashboard],
    });

    expect(deletionPlan.nextDashboardId).toBe('personal');
    expect(deletionPlan.shouldReloadDashboardId).toBeNull();
    expect(deletionPlan.remainingDashboards).toEqual([personalDashboard]);
  });
});
