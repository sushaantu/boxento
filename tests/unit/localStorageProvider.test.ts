import { beforeEach, describe, expect, it } from 'vitest';

import { STORAGE_KEYS } from '@/lib/constants';
import { LocalStorageProvider } from '@/lib/storage/LocalStorageProvider';
import { LayoutItem, Widget } from '@/types';

type LocalStorageMock = {
  clear: () => void;
  getItem: (key: string) => string | null;
  key: (index: number) => string | null;
  readonly length: number;
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
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
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

const getDashboardLayoutsKey = (dashboardId: string) => `${STORAGE_KEYS.LAYOUTS}-${dashboardId}`;
const getDashboardWidgetsKey = (dashboardId: string) => `${STORAGE_KEYS.WIDGETS}-${dashboardId}`;

describe('LocalStorageProvider dashboard persistence', () => {
  let provider: LocalStorageProvider;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createLocalStorageMock(),
      writable: true,
    });

    provider = new LocalStorageProvider();
  });

  it('saves personal dashboard layouts to scoped and legacy keys, then restores from the legacy fallback', async () => {
    const layouts = createLayouts('quick-links-1');

    await provider.saveLayouts('personal', layouts);

    expect(JSON.parse(localStorage.getItem(getDashboardLayoutsKey('personal')) || 'null')).toEqual(layouts);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.LAYOUTS) || 'null')).toEqual(layouts);

    localStorage.removeItem(getDashboardLayoutsKey('personal'));

    await expect(provider.getLayouts('personal')).resolves.toEqual(layouts);
  });

  it('keeps non-personal dashboard layouts isolated from the personal legacy store', async () => {
    const teamLayouts = createLayouts('services-1');
    const personalLayouts = createLayouts('quick-links-1');

    localStorage.setItem(STORAGE_KEYS.LAYOUTS, JSON.stringify(personalLayouts));
    await provider.saveLayouts('team-dashboard', teamLayouts);

    expect(JSON.parse(localStorage.getItem(getDashboardLayoutsKey('team-dashboard')) || 'null')).toEqual(teamLayouts);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.LAYOUTS) || 'null')).toEqual(personalLayouts);
    await expect(provider.getLayouts('team-dashboard')).resolves.toEqual(teamLayouts);
  });

  it('saves personal dashboard widgets to scoped and legacy keys, then restores from the legacy fallback', async () => {
    const widgets = createWidgets('quick-links-1');

    await provider.saveWidgets('personal', widgets);

    expect(JSON.parse(localStorage.getItem(getDashboardWidgetsKey('personal')) || 'null')).toEqual(widgets);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.WIDGETS) || 'null')).toEqual(widgets);

    localStorage.removeItem(getDashboardWidgetsKey('personal'));

    await expect(provider.getWidgets('personal')).resolves.toEqual(widgets);
  });

  it('removes dashboard-specific widget and layout data when deleting a dashboard', async () => {
    await provider.saveDashboard({
      id: 'team-dashboard',
      name: 'Team',
      visibility: 'team',
    });
    await provider.saveLayouts('team-dashboard', createLayouts('services-1'));
    await provider.saveWidgets('team-dashboard', createWidgets('services-1'));

    await provider.deleteDashboard('team-dashboard');

    await expect(provider.getDashboard('team-dashboard')).resolves.toBeNull();
    expect(localStorage.getItem(getDashboardLayoutsKey('team-dashboard'))).toBeNull();
    expect(localStorage.getItem(getDashboardWidgetsKey('team-dashboard'))).toBeNull();
  });
});
