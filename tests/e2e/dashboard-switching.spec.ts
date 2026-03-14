import { expect, test, type Page } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

type StoredLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type StoredWidget = {
  id: string;
  type: string;
};

const PERSONAL_DASHBOARD = {
  id: 'personal',
  name: 'Personal',
  visibility: 'private',
  sharedWith: [],
  isDefault: true,
  createdAt: '2026-03-12T00:00:00.000Z',
};

const TEAM_DASHBOARD = {
  id: 'ops-dashboard',
  name: 'Operations',
  visibility: 'private',
  sharedWith: [],
  isDefault: false,
  createdAt: '2026-03-13T00:00:00.000Z',
};

const readCurrentDashboardId = async (page: Page) => (
  page.evaluate(() => localStorage.getItem('boxento-current-dashboard'))
);

const readDashboardWidgets = async (page: Page, dashboardId: string) => (
  page.evaluate<StoredWidget[], string>((id) => JSON.parse(localStorage.getItem(`boxento-widgets-${id}`) || '[]'), dashboardId)
);

const readDashboardLayouts = async (page: Page, dashboardId: string) => (
  page.evaluate<Record<string, StoredLayoutItem[]>, string>((id) => JSON.parse(localStorage.getItem(`boxento-layouts-${id}`) || '{}'), dashboardId)
);

const readWidgetConfigs = async (page: Page) => (
  page.evaluate<Record<string, Record<string, unknown>>>(() => JSON.parse(localStorage.getItem('boxento-widget-configs') || '{}'))
);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function openDashboardMenu(page: Page, currentDashboardName: string): Promise<void> {
  const trigger = page.locator('.app-header').getByRole('button', {
    name: new RegExp(`^${escapeRegex(currentDashboardName)}$`),
  });

  await expect(trigger).toBeVisible();
  await trigger.click();
}

async function switchDashboard(page: Page, currentDashboardName: string, targetDashboardName: string): Promise<void> {
  await openDashboardMenu(page, currentDashboardName);
  await page.getByRole('menuitem', {
    name: new RegExp(`^${escapeRegex(targetDashboardName)}$`),
  }).click();

  await expect(page.locator('.app-header').getByRole('button', {
    name: new RegExp(`^${escapeRegex(targetDashboardName)}$`),
  })).toBeVisible();
}

async function dragWidgetToTheRight(page: Page, widgetId: string): Promise<void> {
  const widget = page.locator(`.react-grid-item[data-widget-id="${widgetId}"]`);
  const dragHandle = widget.locator('.widget-drag-handle').first();
  const dragBox = await dragHandle.boundingBox();

  if (!dragBox) {
    throw new Error(`Drag handle is not available for ${widgetId}`);
  }

  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + dragBox.width / 2 + 260, dragBox.y + dragBox.height / 2 + 12, { steps: 12 });
  await page.mouse.up();
}

test('switches dashboards and restores dashboard-scoped widget and layout state after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await seedDashboard(page, {
    dashboards: [PERSONAL_DASHBOARD, TEAM_DASHBOARD],
    dashboardState: {
      personal: {
        widgets: [
          {
            id: 'quick-links-personal',
            type: 'quick-links',
            config: {
              customTitle: 'Personal Links',
              links: [],
            },
          },
        ],
        layouts: {
          lg: [
            { i: 'quick-links-personal', x: 0, y: 0, w: 2, h: 2, minW: 1, minH: 1 },
          ],
        },
      },
      'ops-dashboard': {
        widgets: [
          {
            id: 'quick-links-ops',
            type: 'quick-links',
            config: {
              customTitle: 'Operations Links',
              links: [],
            },
          },
        ],
        layouts: {
          lg: [
            { i: 'quick-links-ops', x: 0, y: 0, w: 2, h: 2, minW: 1, minH: 1 },
          ],
        },
      },
    },
  });

  await expect(page.locator('.react-grid-item[data-widget-id="quick-links-personal"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Personal Links' })).toBeVisible();

  await switchDashboard(page, 'Personal', 'Operations');

  const teamWidget = page.locator('.react-grid-item[data-widget-id="quick-links-ops"]');
  await expect(teamWidget).toBeVisible();
  await expect(teamWidget.getByRole('heading', { name: 'Operations Links' })).toBeVisible();
  await expect(page.locator('.react-grid-item[data-widget-id="quick-links-personal"]')).toHaveCount(0);
  await expect.poll(async () => readCurrentDashboardId(page)).toBe('ops-dashboard');

  await dragWidgetToTheRight(page, 'quick-links-ops');
  await expect.poll(async () => {
    const layouts = await readDashboardLayouts(page, 'ops-dashboard');
    return layouts.lg?.find((item) => item.i === 'quick-links-ops')?.x ?? -1;
  }).toBeGreaterThan(0);

  await teamWidget.locator('.settings-button').click();
  await page.locator('#widget-title').fill('Operations War Room');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(teamWidget.getByRole('heading', { name: 'Operations War Room' })).toBeVisible();
  await expect.poll(async () => {
    const configs = await readWidgetConfigs(page);
    return configs['quick-links-ops']?.customTitle ?? null;
  }).toBe('Operations War Room');

  await switchDashboard(page, 'Operations', 'Personal');

  const personalWidget = page.locator('.react-grid-item[data-widget-id="quick-links-personal"]');
  await expect(personalWidget).toBeVisible();
  await expect(personalWidget.getByRole('heading', { name: 'Personal Links' })).toBeVisible();
  await expect(page.locator('.react-grid-item[data-widget-id="quick-links-ops"]')).toHaveCount(0);
  await expect.poll(async () => readCurrentDashboardId(page)).toBe('personal');

  const personalWidgets = await readDashboardWidgets(page, 'personal');
  const teamWidgets = await readDashboardWidgets(page, 'ops-dashboard');
  expect(personalWidgets.map((widget) => widget.id)).toEqual(['quick-links-personal']);
  expect(teamWidgets.map((widget) => widget.id)).toEqual(['quick-links-ops']);

  const personalLayouts = await readDashboardLayouts(page, 'personal');
  expect(personalLayouts.lg?.find((item) => item.i === 'quick-links-personal')?.x).toBe(0);

  await switchDashboard(page, 'Personal', 'Operations');
  await expect(page.locator('.react-grid-item[data-widget-id="quick-links-ops"]')).toBeVisible();
  await page.reload();

  const reloadedTeamWidget = page.locator('.react-grid-item[data-widget-id="quick-links-ops"]');
  await expect(reloadedTeamWidget).toBeVisible();
  await expect(reloadedTeamWidget.getByRole('heading', { name: 'Operations War Room' })).toBeVisible();
  await expect(page.locator('.react-grid-item[data-widget-id="quick-links-personal"]')).toHaveCount(0);
  await expect.poll(async () => readCurrentDashboardId(page)).toBe('ops-dashboard');
  await expect.poll(async () => {
    const layouts = await readDashboardLayouts(page, 'ops-dashboard');
    return layouts.lg?.find((item) => item.i === 'quick-links-ops')?.x ?? -1;
  }).toBeGreaterThan(0);
});

test('creates and deletes dashboards without leaking or preserving non-personal storage', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'quick-links-personal',
        type: 'quick-links',
        config: {
          customTitle: 'Personal Links',
          links: [],
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'quick-links-personal', x: 0, y: 0, w: 2, h: 2, minW: 1, minH: 1 },
      ],
    },
  });

  await expect(page.locator('.react-grid-item[data-widget-id="quick-links-personal"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Personal Links' })).toBeVisible();

  await openDashboardMenu(page, 'Personal');
  await page.getByRole('menuitem', { name: /Create New Dashboard/i }).click();
  await page.getByRole('dialog').getByLabel('Dashboard Name').fill('Travel Board');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.locator('.app-header').getByRole('button', {
    name: /^Travel Board$/,
  })).toBeVisible();
  await expect(page.locator('.react-grid-item')).toHaveCount(4);

  const createdDashboardId = await readCurrentDashboardId(page);
  expect(createdDashboardId).toBeTruthy();
  expect(createdDashboardId).not.toBe('personal');

  await expect.poll(async () => {
    const widgets = await readDashboardWidgets(page, createdDashboardId!);
    return widgets.length;
  }).toBe(4);

  const storedDashboards = await page.evaluate<Array<{ id: string; name: string }>>(
    () => JSON.parse(localStorage.getItem('boxento-dashboards') || '[]')
  );
  expect(storedDashboards.map((dashboard) => dashboard.name)).toContain('Travel Board');

  const createdDashboardLayouts = await readDashboardLayouts(page, createdDashboardId!);
  expect(Object.keys(createdDashboardLayouts)).toContain('lg');

  await openDashboardMenu(page, 'Travel Board');
  await page.getByRole('menuitem', { name: /Dashboard Settings/i }).click();

  const confirmDialogPromise = page.waitForEvent('dialog').then((dialog) => dialog.accept());
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click({ force: true });
  await confirmDialogPromise;

  await expect(page.locator('.app-header').getByRole('button', {
    name: /^Personal$/,
  })).toBeVisible();
  await expect(page.locator('.react-grid-item[data-widget-id="quick-links-personal"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Personal Links' })).toBeVisible();
  await expect.poll(async () => readCurrentDashboardId(page)).toBe('personal');

  const remainingDashboards = await page.evaluate<Array<{ id: string; name: string }>>(
    () => JSON.parse(localStorage.getItem('boxento-dashboards') || '[]')
  );
  expect(remainingDashboards).toHaveLength(1);
  expect(remainingDashboards[0]?.id).toBe('personal');
  expect(remainingDashboards[0]?.name).toBe('Personal');

  const deletedDashboardStorage = await page.evaluate((dashboardId) => ({
    widgets: localStorage.getItem(`boxento-widgets-${dashboardId}`),
    layouts: localStorage.getItem(`boxento-layouts-${dashboardId}`),
    configs: localStorage.getItem(`boxento-configs-${dashboardId}`),
  }), createdDashboardId!);

  expect(deletedDashboardStorage).toEqual({
    widgets: null,
    layouts: null,
    configs: null,
  });

  const personalWidgets = await readDashboardWidgets(page, 'personal');
  expect(personalWidgets.map((widget) => widget.id)).toEqual(['quick-links-personal']);
});
