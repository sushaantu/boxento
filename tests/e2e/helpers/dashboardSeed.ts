import type { Page } from '@playwright/test';

type SeedWidget = {
  id: string;
  type: string;
  config?: Record<string, unknown>;
};

type SeedLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

type SeedDashboardState = {
  widgets: SeedWidget[];
  layouts: Record<string, SeedLayoutItem[]>;
};

type SeedDashboardOptions = {
  widgets?: SeedWidget[];
  layouts?: Record<string, SeedLayoutItem[]>;
  dashboards?: Array<Record<string, unknown>>;
  currentDashboardId?: string;
  dashboardState?: Record<string, SeedDashboardState>;
  widgetConfigs?: Record<string, Record<string, unknown>>;
};

const DEFAULT_DASHBOARDS = [
  {
    id: 'personal',
    name: 'Personal',
    visibility: 'private',
    sharedWith: [],
    isDefault: true,
    createdAt: '2026-03-12T00:00:00.000Z',
  },
];

export async function seedDashboard(page: Page, options: SeedDashboardOptions): Promise<void> {
  const dashboardState = {
    ...(options.dashboardState ?? {}),
    personal: options.dashboardState?.personal ?? {
      widgets: options.widgets ?? [],
      layouts: options.layouts ?? {},
    },
  };

  await page.goto('./index.html');
  await page.evaluate((seed) => {
    localStorage.clear();
    localStorage.setItem('theme', 'light');
    localStorage.setItem('boxento-dashboards', JSON.stringify(seed.dashboards));
    localStorage.setItem('boxento-current-dashboard', seed.currentDashboardId);

    Object.entries(seed.dashboardState).forEach(([dashboardId, state]) => {
      localStorage.setItem(`boxento-widgets-${dashboardId}`, JSON.stringify(state.widgets));
      localStorage.setItem(`boxento-layouts-${dashboardId}`, JSON.stringify(state.layouts));

      if (dashboardId === 'personal') {
        localStorage.setItem('boxento-widgets', JSON.stringify(state.widgets));
        localStorage.setItem('boxento-layouts', JSON.stringify(state.layouts));
      }
    });

    localStorage.setItem('boxento-widget-configs', JSON.stringify(seed.widgetConfigs));
  }, {
    currentDashboardId: options.currentDashboardId ?? 'personal',
    dashboardState,
    widgetConfigs: options.widgetConfigs ?? {},
    dashboards: options.dashboards ?? DEFAULT_DASHBOARDS,
  });
  await page.reload();
}
