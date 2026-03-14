import { expect, test } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

type StoredLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const SERVICES = [
  { id: 'boxento', name: 'Boxento', url: 'https://boxento.test', icon: 'LayoutGrid', description: 'Dashboard', category: 'Utilities' },
  { id: 'paisa', name: 'Paisa', url: 'https://paisa.test', icon: 'PiggyBank', description: 'Personal Finance', category: 'Finance' },
  { id: 'fava', name: 'Fava', url: 'https://fava.test', icon: 'BookOpen', description: 'Beancount', category: 'Finance' },
  { id: 'jellyfin', name: 'Jellyfin', url: 'https://jellyfin.test', icon: 'Play', description: 'Media Server', category: 'Media' },
  { id: 'riven', name: 'Riven', url: 'https://riven.test', icon: 'Film', description: 'Media Requests', category: 'Media' },
  { id: 'open-webui', name: 'Open WebUI', url: 'https://open-webui.test', icon: 'Bot', description: 'Local AI Chat', category: 'AI' },
];

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
    return page.evaluate(() => {
      const layouts = JSON.parse(localStorage.getItem('boxento-layouts-personal') || '{}');
      return layouts.lg?.find((item: { i: string; x: number }) => item.i === 'quick-links-1')?.x ?? -1;
    });
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
    return page.evaluate(() => {
      const layouts = JSON.parse(localStorage.getItem('boxento-layouts-personal') || '{}');
      const item = layouts.lg?.find((entry: { i: string; w: number; h: number }) => entry.i === 'quick-links-1');
      return item ? `${item.w}x${item.h}` : 'missing';
    });
  }).not.toBe('2x2');

  const persistedLayout = await page.evaluate<StoredLayoutItem | null>(() => {
    const layouts = JSON.parse(localStorage.getItem('boxento-layouts-personal') || '{}');
    return layouts.lg?.find((item: { i: string }) => item.i === 'quick-links-1') ?? null;
  });

  expect(persistedLayout).not.toBeNull();
  if (!persistedLayout) {
    throw new Error('Quick Links layout was not persisted');
  }
  expect(persistedLayout.x).toBeGreaterThan(0);
  expect(persistedLayout.w).toBeGreaterThan(2);
  expect(persistedLayout.h).toBeGreaterThan(2);

  await page.reload();
  await expect(widget).toBeVisible();

  const reloadedLayout = await page.evaluate<StoredLayoutItem | null>(() => {
    const layouts = JSON.parse(localStorage.getItem('boxento-layouts-personal') || '{}');
    return layouts.lg?.find((item: { i: string }) => item.i === 'quick-links-1') ?? null;
  });

  expect(reloadedLayout).toEqual(persistedLayout);
});

test('keeps widget geometry stable when switching from laptop to 4K-class viewports', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });

  const widgets = Array.from({ length: 4 }, (_, index) => ({
    id: `quick-links-${index + 1}`,
    type: 'quick-links',
    config: {
      customTitle: `Quick Links ${index + 1}`,
      links: [],
    },
  }));

  const lgLayout = [
    { i: 'quick-links-1', x: 0, y: 0, w: 3, h: 3, minW: 1, minH: 1 },
    { i: 'quick-links-2', x: 3, y: 0, w: 2, h: 2, minW: 1, minH: 1 },
    { i: 'quick-links-3', x: 5, y: 0, w: 3, h: 2, minW: 1, minH: 1 },
    { i: 'quick-links-4', x: 8, y: 0, w: 3, h: 3, minW: 1, minH: 1 },
  ];

  await seedDashboard(page, {
    widgets,
    layouts: {
      lg: lgLayout,
    },
  });

  const captureRenderedLayout = async () => page.evaluate(() => {
    const grid = document.querySelector('.react-grid-layout');
    if (!(grid instanceof HTMLElement)) {
      throw new Error('Grid layout is not available');
    }

    const gridRect = grid.getBoundingClientRect();
    return Array.from(document.querySelectorAll('.react-grid-item'))
      .map((element) => {
        if (!(element instanceof HTMLElement)) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        return {
          id: element.dataset.widgetId || '',
          x: Math.round(rect.left - gridRect.left),
          y: Math.round(rect.top - gridRect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((item): item is { id: string; x: number; y: number; width: number; height: number } => item !== null)
      .sort((left, right) => left.id.localeCompare(right.id));
  });

  await expect(page.locator('.react-grid-item')).toHaveCount(4);
  const laptopGeometry = await captureRenderedLayout();
  const storedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('boxento-layouts-personal') || '{}'));

  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.reload();

  await expect(page.locator('.react-grid-item')).toHaveCount(4);
  const externalDisplayGeometry = await captureRenderedLayout();
  const storedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('boxento-layouts-personal') || '{}'));

  expect(externalDisplayGeometry).toEqual(laptopGeometry);
  expect(storedAfter).toEqual(storedBefore);
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
    return page.evaluate(() => {
      const layouts = JSON.parse(localStorage.getItem('boxento-layouts-personal') || '{}');
      return layouts.lg?.find((item: { i: string; x: number }) => item.i === 'quick-links-1')?.x ?? -1;
    });
  }).toBeGreaterThan(0);

  await page.reload();

  const reloadedLayout = await page.evaluate<StoredLayoutItem | null>(() => {
    const layouts = JSON.parse(localStorage.getItem('boxento-layouts-personal') || '{}');
    return layouts.lg?.find((item: { i: string }) => item.i === 'quick-links-1') ?? null;
  });

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
    return page.evaluate(() => {
      const configs = JSON.parse(localStorage.getItem('boxento-widget-configs') || '{}');
      const quickLinks = configs['quick-links-1'];
      return quickLinks?.links?.map((link: { title: string; url: string }) => `${link.title}:${link.url}`).join(',') ?? '';
    });
  }).toContain('Docs:https://docs.boxento.test');

  await page.reload();
  await expect(widget.locator('[role="button"]').filter({ hasText: 'Docs' }).first()).toBeVisible();
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
