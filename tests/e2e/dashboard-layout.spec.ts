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
  config: Record<string, unknown>;
};

type StoredWidgetConfig = {
  customTitle?: string;
  links?: Array<Record<string, unknown>>;
};

const PERSONAL_DASHBOARD_STORAGE_KEYS = {
  layouts: 'boxento-layouts-personal',
  widgetConfigs: 'boxento-widget-configs',
  widgets: 'boxento-widgets-personal',
} as const;

const SERVICES = [
  { id: 'boxento', name: 'Boxento', url: 'https://boxento.test', icon: 'LayoutGrid', description: 'Dashboard', category: 'Utilities' },
  { id: 'paisa', name: 'Paisa', url: 'https://paisa.test', icon: 'PiggyBank', description: 'Personal Finance', category: 'Finance' },
  { id: 'fava', name: 'Fava', url: 'https://fava.test', icon: 'BookOpen', description: 'Beancount', category: 'Finance' },
  { id: 'jellyfin', name: 'Jellyfin', url: 'https://jellyfin.test', icon: 'Play', description: 'Media Server', category: 'Media' },
  { id: 'riven', name: 'Riven', url: 'https://riven.test', icon: 'Film', description: 'Media Requests', category: 'Media' },
  { id: 'open-webui', name: 'Open WebUI', url: 'https://open-webui.test', icon: 'Bot', description: 'Local AI Chat', category: 'AI' },
];

const readStoredWidgets = async (page: Page) => (
  page.evaluate<StoredWidget[], string>((storageKey) => JSON.parse(localStorage.getItem(storageKey) || '[]'), PERSONAL_DASHBOARD_STORAGE_KEYS.widgets)
);

const readStoredLayouts = async (page: Page) => (
  page.evaluate<Record<string, StoredLayoutItem[]>, string>((storageKey) => JSON.parse(localStorage.getItem(storageKey) || '{}'), PERSONAL_DASHBOARD_STORAGE_KEYS.layouts)
);

const readStoredWidgetConfigs = async (page: Page) => (
  page.evaluate<Record<string, StoredWidgetConfig>, string>((storageKey) => JSON.parse(localStorage.getItem(storageKey) || '{}'), PERSONAL_DASHBOARD_STORAGE_KEYS.widgetConfigs)
);

test('persists quick links drag and resize changes across reloads', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await seedDashboard(page, {
    widgets: [
      { id: 'quick-links-1', type: 'quick-links', config: { customTitle: 'Quick Links', links: [] } },
    ],
    layouts: {
      lg: [
        { i: 'quick-links-1', x: 0, y: 0, w: 2, h: 2, minW: 1, minH: 1 },
      ],
    },
  });

  const widget = page.locator('.react-grid-item[data-widget-id="quick-links-1"]');
  await expect(widget).toBeVisible();

  const dragHandle = widget.locator('.widget-drag-handle').first();
  const dragBox = await dragHandle.boundingBox();
  if (!dragBox) {
    throw new Error('Quick Links drag handle is not available');
  }

  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + dragBox.width / 2 + 260, dragBox.y + dragBox.height / 2 + 12, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => {
    const layouts = await readStoredLayouts(page);
    return layouts.lg?.find((item: { i: string; x: number }) => item.i === 'quick-links-1')?.x ?? -1;
  }).toBeGreaterThan(0);

  const resizeHandle = widget.locator('.react-resizable-handle-se');
  const resizeBox = await resizeHandle.boundingBox();
  if (!resizeBox) {
    throw new Error('Quick Links resize handle is not available');
  }

  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 180, resizeBox.y + 120, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => {
    const layouts = await readStoredLayouts(page);
    const item = layouts.lg?.find((entry: { i: string; w: number; h: number }) => entry.i === 'quick-links-1');
    return item ? `${item.w}x${item.h}` : 'missing';
  }).not.toBe('2x2');

  const persistedLayouts = await readStoredLayouts(page);
  const persistedLayout = persistedLayouts.lg?.find((item: { i: string }) => item.i === 'quick-links-1') ?? null;

  expect(persistedLayout).not.toBeNull();
  if (!persistedLayout) {
    throw new Error('Quick Links layout was not persisted');
  }
  expect(persistedLayout.x).toBeGreaterThan(0);
  expect(persistedLayout.w).toBeGreaterThan(2);
  expect(persistedLayout.h).toBeGreaterThan(2);

  await page.reload();
  await expect(widget).toBeVisible();

  const reloadedLayouts = await readStoredLayouts(page);
  const reloadedLayout = reloadedLayouts.lg?.find((item: { i: string }) => item.i === 'quick-links-1') ?? null;

  expect(reloadedLayout).toEqual(persistedLayout);
});

test('keeps quick links app header controls from dragging the widget', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'quick-links-app',
        type: 'quick-links',
        config: {
          customTitle: 'Quick Links',
          links: [
            { id: 1, title: 'Boxento', url: 'https://boxento.test', favicon: '', category: 'Utilities' },
            { id: 2, title: 'Paisa', url: 'https://paisa.test', favicon: '', category: 'Finance' },
          ],
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'quick-links-app', x: 0, y: 0, w: 6, h: 6, minW: 1, minH: 1 },
      ],
    },
  });

  const widget = page.locator('.react-grid-item[data-widget-id="quick-links-app"]');
  await expect(widget).toBeVisible();

  const searchInput = widget.getByPlaceholder('Search links...');
  await expect(searchInput).toBeVisible();

  const searchBox = await searchInput.boundingBox();
  if (!searchBox) {
    throw new Error('Quick Links app search input is not available');
  }

  await page.mouse.move(searchBox.x + searchBox.width / 2, searchBox.y + searchBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(searchBox.x + searchBox.width / 2 + 160, searchBox.y + searchBox.height / 2 + 12, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => {
    const layouts = await readStoredLayouts(page);
    return layouts.lg?.find((item: { i: string; x: number }) => item.i === 'quick-links-app')?.x ?? -1;
  }).toBe(0);

  await searchInput.fill('box');
  await expect(searchInput).toHaveValue('box');

  const clearSearchButton = widget.getByRole('button', { name: 'Clear search' });
  await expect(clearSearchButton).toBeVisible();

  const clearBox = await clearSearchButton.boundingBox();
  if (!clearBox) {
    throw new Error('Quick Links clear-search button is not available');
  }

  await page.mouse.move(clearBox.x + clearBox.width / 2, clearBox.y + clearBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(clearBox.x + clearBox.width / 2 + 160, clearBox.y + clearBox.height / 2 + 12, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => {
    const layouts = await readStoredLayouts(page);
    return layouts.lg?.find((item: { i: string; x: number }) => item.i === 'quick-links-app')?.x ?? -1;
  }).toBe(0);

  await clearSearchButton.click();
  await expect(searchInput).toHaveValue('');
});

test('preserves drag persistence on dashboards with more than five widgets', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });

  const widgets = Array.from({ length: 6 }, (_, index) => ({
    id: `quick-links-${index + 1}`,
    type: 'quick-links',
    config: {
      customTitle: `Quick Links ${index + 1}`,
      links: [],
    },
  }));

  await seedDashboard(page, {
    widgets,
    layouts: {
      lg: widgets.map((widget, index) => ({
        i: widget.id,
        x: (index % 3) * 4,
        y: Math.floor(index / 3) * 3,
        w: 3,
        h: 3,
        minW: 1,
        minH: 1,
      })),
    },
  });

  await expect(page.locator('.react-grid-item')).toHaveCount(6);

  const widget = page.locator('.react-grid-item[data-widget-id="quick-links-1"]');
  await expect(widget).toBeVisible();

  const dragHandle = widget.locator('.widget-drag-handle').first();
  const dragBox = await dragHandle.boundingBox();
  if (!dragBox) {
    throw new Error('Multi-widget drag handle is not available');
  }

  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + dragBox.width / 2 + 260, dragBox.y + dragBox.height / 2 + 12, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => {
    const layouts = await readStoredLayouts(page);
    return layouts.lg?.find((item: { i: string; x: number }) => item.i === 'quick-links-1')?.x ?? -1;
  }).toBeGreaterThan(0);

  await page.reload();

  const reloadedLayouts = await readStoredLayouts(page);
  const reloadedLayout = reloadedLayouts.lg?.find((item: { i: string }) => item.i === 'quick-links-1') ?? null;

  expect(reloadedLayout).not.toBeNull();
  expect(reloadedLayout?.x).toBeGreaterThan(0);
});

test('uses an on-demand dialog for large quick links layouts and persists added links', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'quick-links-1',
        type: 'quick-links',
        config: {
          customTitle: 'Quick Links',
          links: [
            {
              id: 1,
              title: 'Boxento',
              url: 'https://boxento.test',
              favicon: 'https://icons.duckduckgo.com/ip3/boxento.test.ico',
              category: 'Work',
            },
          ],
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'quick-links-1', x: 0, y: 0, w: 6, h: 6, minW: 1, minH: 1 },
      ],
    },
  });

  const widget = page.locator('.react-grid-item[data-widget-id="quick-links-1"]');
  await expect(widget).toBeVisible();
  await expect(widget.getByText('Select a link to preview details')).toHaveCount(0);
  await expect(widget.locator('.w-72')).toHaveCount(0);

  await widget.getByRole('button', { name: 'Add Link' }).click();

  const addDialog = page.getByRole('dialog', { name: 'Add Link' });
  await expect(addDialog).toBeVisible();
  await addDialog.getByLabel('URL').fill('docs.boxento.test');
  await addDialog.getByLabel('Title').fill('Docs');
  await addDialog.getByLabel('Category').fill('Work');
  await addDialog.getByRole('button', { name: 'Add Link' }).click();

  await expect(widget.locator('[role="button"]').filter({ hasText: 'Docs' }).first()).toBeVisible();

  await expect.poll(async () => {
    const configs = await readStoredWidgetConfigs(page);
    const quickLinks = configs['quick-links-1'];
    return quickLinks?.links?.map((link: { title?: string; url?: string }) => `${link.title}:${link.url}`).join(',') ?? '';
  }).toContain('Docs:https://docs.boxento.test');

  await page.reload();
  await expect(widget.locator('[role="button"]').filter({ hasText: 'Docs' }).first()).toBeVisible();
});

test('adds, configures, and removes a quick links widget with persisted config', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'year-progress-1',
        type: 'year-progress',
        config: {
          showPercentage: true,
          showDaysLeft: true,
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'year-progress-1', x: 0, y: 0, w: 1, h: 1, minW: 1, minH: 1 },
      ],
    },
  });

  await page.getByRole('button', { name: /add widget/i }).click();
  await page.getByRole('textbox', { name: /search widgets/i }).fill('Quick Links');
  await page.getByRole('button', { name: /add quick links widget/i }).click();

  const widget = page.locator('.react-grid-item[data-widget-id^="quick-links-"]');
  await expect(widget).toHaveCount(1);
  await expect(widget.getByRole('heading', { name: 'Quick Links' })).toBeVisible();

  const widgetId = await widget.getAttribute('data-widget-id');
  expect(widgetId).toBeTruthy();
  const currentWidgetId = widgetId!;

  await expect.poll(async () => {
    const widgets = await readStoredWidgets(page);
    return widgets.some((entry) => entry.id === currentWidgetId && entry.type === 'quick-links');
  }).toBe(true);

  await widget.locator('.settings-button').click();
  await expect(page.getByRole('dialog')).toContainText('Quick Links Settings');
  await page.locator('#widget-title').fill('Team Bookmarks');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(widget.getByRole('heading', { name: 'Team Bookmarks' })).toBeVisible();
  await expect.poll(async () => {
    const configs = await readStoredWidgetConfigs(page);
    return configs[currentWidgetId]?.customTitle ?? null;
  }).toBe('Team Bookmarks');

  await widget.getByRole('button', { name: /add link/i }).click();
  await page.getByLabel('URL').fill('docs.boxento.test');
  await page.getByLabel('Display Title').fill('Docs');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(widget).toContainText('Docs');
  await expect.poll(async () => {
    const configs = await readStoredWidgetConfigs(page);
    return configs[currentWidgetId]?.links?.length ?? 0;
  }).toBe(1);

  await page.reload();

  const reloadedWidget = page.locator(`.react-grid-item[data-widget-id="${currentWidgetId}"]`);
  await expect(reloadedWidget).toBeVisible();
  await expect(reloadedWidget.getByRole('heading', { name: 'Team Bookmarks' })).toBeVisible();
  await expect(reloadedWidget).toContainText('Docs');

  await reloadedWidget.locator('.settings-button').click();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.locator(`.react-grid-item[data-widget-id="${currentWidgetId}"]`)).toHaveCount(0);
  await expect.poll(async () => {
    const widgets = await readStoredWidgets(page);
    return widgets.some((entry) => entry.id === currentWidgetId);
  }).toBe(false);
  await expect.poll(async () => {
    const configs = await readStoredWidgetConfigs(page);
    return Object.prototype.hasOwnProperty.call(configs, currentWidgetId);
  }).toBe(false);
});

test('keeps the dashboard visible at the 768px tablet boundary', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await seedDashboard(page, {
    widgets: [
      { id: 'quick-links-1', type: 'quick-links', config: { customTitle: 'Quick Links', links: [] } },
    ],
    layouts: {
      sm: [
        { i: 'quick-links-1', x: 0, y: 0, w: 3, h: 3, minW: 1, minH: 1 },
      ],
    },
  });

  const widget = page.locator('.react-grid-item[data-widget-id="quick-links-1"]');
  await expect(widget).toBeVisible();
});

test('reflows service cards without right-edge clipping on laptop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'services-1',
        type: 'services',
        config: {
          title: 'Services',
          showStatus: false,
          services: SERVICES,
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'services-1', x: 0, y: 0, w: 10, h: 4, minW: 1, minH: 1 },
      ],
    },
  });

  const widget = page.locator('.react-grid-item[data-widget-id="services-1"]');
  await expect(widget).toBeVisible();
  await expect(widget.getByRole('heading', { name: 'Services' })).toBeVisible();

  for (const service of SERVICES) {
    await expect(widget.getByRole('button', { name: new RegExp(service.name, 'i') })).toBeVisible();
  }

  const allCardsWithinBounds = await widget.evaluate((element) => {
    const widgetRect = element.getBoundingClientRect();
    const cards = Array.from(element.querySelectorAll('button')).filter((node) => {
      const text = node.textContent?.trim() || '';
      return text.length > 0 && text !== 'Login' && text !== 'Add Widget';
    });

    return cards.every((card) => card.getBoundingClientRect().right <= widgetRect.right + 1);
  });

  expect(allCardsWithinBounds).toBe(true);
});

test('renders audited 1x1 widgets without header chrome', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'world-clocks-1',
        type: 'world-clocks',
        config: {
          timezones: [{ id: 1, name: 'Tokyo, Japan', timezone: 'Asia/Tokyo' }],
        },
      },
      {
        id: 'year-progress-1',
        type: 'year-progress',
        config: {
          showPercentage: true,
          showDaysLeft: true,
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'world-clocks-1', x: 0, y: 0, w: 1, h: 1, minW: 1, minH: 1 },
        { i: 'year-progress-1', x: 1, y: 0, w: 1, h: 1, minW: 1, minH: 1 },
      ],
    },
  });

  const clocksWidget = page.locator('.react-grid-item[data-widget-id="world-clocks-1"]');
  await expect(clocksWidget).toBeVisible();
  await expect(clocksWidget.getByRole('heading', { name: 'World Clocks' })).toHaveCount(0);
  await expect(clocksWidget).toContainText('Tokyo');

  const yearProgressWidget = page.locator('.react-grid-item[data-widget-id="year-progress-1"]');
  await expect(yearProgressWidget).toBeVisible();
  await expect(yearProgressWidget.getByRole('heading', { name: 'Year Progress' })).toHaveCount(0);
  await expect(yearProgressWidget.getByText(/\d+%/)).toBeVisible();
});
