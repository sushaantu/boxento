import { expect, test, type Locator, type Page } from '@playwright/test';

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

const readStoredLayoutX = async (page: Page, widgetId: string) => (
  page.evaluate(([storageKey, currentWidgetId]) => {
    const layouts = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return layouts.lg?.find((item: { i: string; x: number }) => item.i === currentWidgetId)?.x ?? -1;
  }, [PERSONAL_DASHBOARD_STORAGE_KEYS.layouts, widgetId] as const)
);

const mockWeatherApi = async (page: Page) => {
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        results: [
          {
            id: 5128581,
            name: 'New York',
            country: 'United States',
            latitude: 40.7128,
            longitude: -74.006,
          },
        ],
      }),
    });
  });

  await page.route('https://api.open-meteo.com/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        current: {
          temperature_2m: 22,
          relative_humidity_2m: 65,
          apparent_temperature: 24,
          weather_code: 0,
          wind_speed_10m: 5.2,
          wind_direction_10m: 120,
        },
        daily: {
          time: ['2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20'],
          weather_code: [0, 2, 3, 61, 80],
          temperature_2m_max: [24, 26, 28, 27, 25],
          temperature_2m_min: [18, 17, 19, 20, 18],
          sunrise: [
            '2026-03-16T06:30:00-04:00',
            '2026-03-17T06:29:00-04:00',
            '2026-03-18T06:27:00-04:00',
            '2026-03-19T06:26:00-04:00',
            '2026-03-20T06:24:00-04:00',
          ],
          sunset: [
            '2026-03-16T19:08:00-04:00',
            '2026-03-17T19:09:00-04:00',
            '2026-03-18T19:10:00-04:00',
            '2026-03-19T19:11:00-04:00',
            '2026-03-20T19:12:00-04:00',
          ],
        },
      }),
    });
  });
};

const readFirstTextNodeCenter = async (locator: Locator) => (
  locator.evaluate((element) => {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => (
          node.textContent && node.textContent.trim().length > 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP
        ),
      }
    );

    const textNode = walker.nextNode();
    const fallbackRect = element.getBoundingClientRect();

    if (!textNode) {
      return {
        x: fallbackRect.left + fallbackRect.width / 2,
        y: fallbackRect.top + fallbackRect.height / 2,
      };
    }

    const range = document.createRange();
    range.selectNodeContents(textNode);
    const textRect = Array.from(range.getClientRects()).find((rect) => rect.width > 0 && rect.height > 0) ?? fallbackRect;

    return {
      x: textRect.left + textRect.width / 2,
      y: textRect.top + textRect.height / 2,
    };
  })
);

const assertWidgetInteractionInactive = async (widget: Locator) => {
  await expect.poll(async () => widget.getAttribute('data-widget-interaction')).toBeNull();
  await expect.poll(async () => widget.getAttribute('data-widget-complete')).toBeNull();
};

const dragFromTextNodeWithoutStartingWidgetInteraction = async (
  page: Page,
  widget: Locator,
  control: Locator,
  expectedLayoutX: number,
  widgetId: string
) => {
  await control.scrollIntoViewIfNeeded();
  const { x, y } = await readFirstTextNodeCenter(control);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await assertWidgetInteractionInactive(widget);

  await page.mouse.move(x + 120, y + 14, { steps: 10 });
  await assertWidgetInteractionInactive(widget);

  await page.mouse.up();
  await assertWidgetInteractionInactive(widget);
  await expect.poll(async () => readStoredLayoutX(page, widgetId)).toBe(expectedLayoutX);
};

const readOverflowingLeafNodes = async (page: Page, widgetId: string) => (
  page.locator(`.react-grid-item[data-widget-id="${widgetId}"]`).evaluate((element) => {
    const widgetRect = element.getBoundingClientRect();

    return Array.from(element.querySelectorAll<HTMLElement>('*'))
      .map((node) => {
        const text = node.textContent?.trim();
        if (!text || node.children.length > 0) {
          return null;
        }

        const rect = node.getBoundingClientRect();
        const exceedsBounds = (
          rect.left < widgetRect.left - 1
          || rect.right > widgetRect.right + 1
          || rect.top < widgetRect.top - 1
          || rect.bottom > widgetRect.bottom + 1
        );
        const hasScrollOverflow = (
          node.scrollWidth > node.clientWidth + 1
          || node.scrollHeight > node.clientHeight + 1
        );

        if (!exceedsBounds && !hasScrollOverflow) {
          return null;
        }

        return {
          text,
          className: String(node.className),
          clientHeight: node.clientHeight,
          clientWidth: node.clientWidth,
          scrollHeight: node.scrollHeight,
          scrollWidth: node.scrollWidth,
        };
      })
      .filter(Boolean);
  })
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

test('keeps the weather resize preview from jumping to a layout branch that will not persist', async ({ page }) => {
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        results: [
          {
            id: 5128581,
            name: 'New York',
            country: 'United States',
            latitude: 40.7128,
            longitude: -74.006,
          },
        ],
      }),
    });
  });
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        current: {
          temperature_2m: 22,
          relative_humidity_2m: 65,
          apparent_temperature: 24,
          weather_code: 0,
          wind_speed_10m: 5.2,
          wind_direction_10m: 120,
        },
        daily: {
          time: [
            '2026-03-16',
            '2026-03-17',
            '2026-03-18',
            '2026-03-19',
            '2026-03-20',
          ],
          weather_code: [0, 2, 3, 61, 80],
          temperature_2m_max: [24, 26, 28, 27, 25],
          temperature_2m_min: [18, 17, 19, 20, 18],
          sunrise: [
            '2026-03-16T06:30:00-04:00',
            '2026-03-17T06:29:00-04:00',
            '2026-03-18T06:27:00-04:00',
            '2026-03-19T06:26:00-04:00',
            '2026-03-20T06:24:00-04:00',
          ],
          sunset: [
            '2026-03-16T19:08:00-04:00',
            '2026-03-17T19:09:00-04:00',
            '2026-03-18T19:10:00-04:00',
            '2026-03-19T19:11:00-04:00',
            '2026-03-20T19:12:00-04:00',
          ],
        },
      }),
    });
  });

  await page.setViewportSize({ width: 1512, height: 982 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'weather-preview',
        type: 'weather',
        config: {
          location: 'New York',
          units: 'metric',
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'weather-preview', x: 0, y: 0, w: 4, h: 2, minW: 1, minH: 1 },
      ],
    },
  });

  const widget = page.locator('.react-grid-item[data-widget-id="weather-preview"]');
  await expect(widget).toBeVisible();
  await expect(widget.getByText('New York')).toBeVisible();
  await expect(widget.getByText('Sunrise', { exact: true })).toHaveCount(0);
  await expect(widget.getByText('Sunset', { exact: true })).toHaveCount(0);
  await expect(widget.getByText('Sunrise/Sunset', { exact: true })).toHaveCount(0);

  const resizeHandle = widget.locator('.react-resizable-handle-se');
  const resizeBox = await resizeHandle.boundingBox();
  if (!resizeBox) {
    throw new Error('Weather resize handle is not available');
  }

  const handleCenterX = resizeBox.x + resizeBox.width / 2;
  const handleCenterY = resizeBox.y + resizeBox.height / 2;

  await page.mouse.move(handleCenterX, handleCenterY);
  await page.mouse.down();
  await page.mouse.move(handleCenterX, handleCenterY + 140, { steps: 12 });

  await expect(widget.getByText('Sunrise', { exact: true })).toHaveCount(0);
  await expect(widget.getByText('Sunset', { exact: true })).toHaveCount(0);
  await expect(widget.getByText('Sunrise/Sunset', { exact: true })).toHaveCount(0);

  await page.mouse.move(handleCenterX, handleCenterY + 90, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => {
    const layouts = await readStoredLayouts(page);
    const item = layouts.lg?.find((entry: { i: string; w: number; h: number }) => entry.i === 'weather-preview');
    return item ? `${item.w}x${item.h}` : 'missing';
  }).toBe('4x3');

  await expect(widget.getByText('Sunrise/Sunset', { exact: true })).toBeVisible();
  await expect(widget.getByText('Sunrise', { exact: true })).toHaveCount(0);
  await expect(widget.getByText('Sunset', { exact: true })).toHaveCount(0);
});

test('renders narrow weather widgets without a clipped title header', async ({ page }) => {
  await mockWeatherApi(page);
  await page.setViewportSize({ width: 1512, height: 982 });

  await seedDashboard(page, {
    widgets: [
      {
        id: 'weather-narrow',
        type: 'weather',
        config: {
          location: 'New York',
          units: 'metric',
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'weather-narrow', x: 0, y: 0, w: 1, h: 3, minW: 1, minH: 1 },
      ],
    },
  });

  const widget = page.locator('.react-grid-item[data-widget-id="weather-narrow"]');
  await expect(widget).toBeVisible();
  await expect(widget.getByText('New York')).toBeVisible();
  await expect(widget.locator('.widget-header')).toHaveCount(0);
  await expect(widget.getByRole('heading', { name: 'Weather' })).toHaveCount(0);
});

test('keeps failed widget fallbacks draggable and removable', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });

  await seedDashboard(page, {
    widgets: [
      {
        id: 'broken-widget',
        type: 'missing-widget-type',
        config: {},
      },
    ],
    layouts: {
      lg: [
        { i: 'broken-widget', x: 0, y: 0, w: 3, h: 3, minW: 1, minH: 1 },
      ],
    },
  });

  const widget = page.locator('.react-grid-item[data-widget-id="broken-widget"]');
  await expect(widget).toBeVisible();
  await expect(widget.getByText('Widget Error')).toBeVisible();
  await expect(widget.getByRole('button', { name: 'Remove widget' })).toBeVisible();

  const dragHandle = widget.locator('[data-testid="widget-error-fallback"]');
  const dragBox = await dragHandle.boundingBox();
  if (!dragBox) {
    throw new Error('Failed widget fallback drag handle is not available');
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + 40);
    await page.mouse.down();
    await page.mouse.move(dragBox.x + dragBox.width / 2 + 260, dragBox.y + 52, { steps: 12 });
    await page.mouse.up();

    const moved = await expect
      .poll(async () => readStoredLayoutX(page, 'broken-widget'), { timeout: 2000 })
      .toBeGreaterThan(0)
      .then(() => true)
      .catch(() => false);

    if (moved) {
      break;
    }
  }

  expect(await readStoredLayoutX(page, 'broken-widget')).toBeGreaterThan(0);

  await widget.getByRole('button', { name: 'Remove widget' }).click();
  await expect(widget).toHaveCount(0);

  await expect.poll(async () => {
    const storedWidgets = await readStoredWidgets(page);
    return storedWidgets.some((entry) => entry.id === 'broken-widget');
  }).toBe(false);
});

test('uses the full dashboard canvas on 4K-class viewports without rewriting saved layouts', async ({ page }) => {
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
  const laptopGridWidth = await page.locator('.react-grid-layout').evaluate((element) => (
    Math.round(element.getBoundingClientRect().width)
  ));
  const storedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('boxento-layouts-personal') || '{}'));

  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.reload();

  await expect(page.locator('.react-grid-item')).toHaveCount(4);
  const externalDisplayGeometry = await captureRenderedLayout();
  const externalGridWidth = await page.locator('.react-grid-layout').evaluate((element) => (
    Math.round(element.getBoundingClientRect().width)
  ));
  const storedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('boxento-layouts-personal') || '{}'));

  expect(externalGridWidth).toBeGreaterThan(laptopGridWidth + 500);
  expect(externalDisplayGeometry).not.toEqual(laptopGeometry);
  expect(externalDisplayGeometry.at(-1)?.x ?? 0).toBeGreaterThan(laptopGeometry.at(-1)?.x ?? 0);
  expect(storedAfter).toEqual(storedBefore);
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

test('keeps app-mode text button controls from triggering widget press or drag visuals', async ({ page }) => {
  await page.route('https://www.googleapis.com/calendar/v3/calendars/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        items: [
          {
            id: 'evt-1',
            summary: 'Team sync',
            start: { dateTime: '2026-03-18T14:00:00.000Z' },
            end: { dateTime: '2026-03-18T15:00:00.000Z' },
          },
        ],
      }),
    });
  });

  await page.setViewportSize({ width: 1512, height: 1400 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'calendar-app',
        type: 'calendar',
        config: {
          googleCalendarConnected: true,
          viewMode: 'month',
          calendars: [
            {
              id: 'primary',
              name: 'Primary',
              color: '#4285F4',
              selected: true,
            },
          ],
        },
      },
      {
        id: 'todo-app',
        type: 'todo',
        config: {
          title: 'Operations Todo',
          items: [
            { id: 'todo-1', text: 'Pay rent', completed: false, createdAt: '2026-03-12T00:00:00.000Z', sortOrder: 0 },
          ],
          showCompletedItems: true,
          sortOrder: 'manual',
        },
      },
      {
        id: 'quick-links-app',
        type: 'quick-links',
        config: {
          customTitle: 'Quick Links',
          links: [
            { id: 1, title: 'Boxento', url: 'https://boxento.test', favicon: '', category: 'Utilities' },
          ],
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'calendar-app', x: 0, y: 0, w: 6, h: 6, minW: 2, minH: 2 },
        { i: 'todo-app', x: 6, y: 0, w: 6, h: 6, minW: 2, minH: 2 },
        { i: 'quick-links-app', x: 0, y: 6, w: 6, h: 6, minW: 2, minH: 2 },
      ],
    },
  });

  await page.evaluate(() => {
    localStorage.setItem('googleAccessToken-calendar-app', 'test-access-token');
    localStorage.setItem('googleRefreshToken-calendar-app', 'test-refresh-token');
    localStorage.setItem('googleTokenExpiry-calendar-app', String(Date.now() + 60 * 60 * 1000));
  });
  await page.reload();

  const calendarWidget = page.locator('.react-grid-item[data-widget-id="calendar-app"]');
  const todoWidget = page.locator('.react-grid-item[data-widget-id="todo-app"]');
  const quickLinksWidget = page.locator('.react-grid-item[data-widget-id="quick-links-app"]');

  const weekTab = calendarWidget.getByRole('tab', { name: 'Week' });
  await expect(weekTab).toBeVisible();

  await dragFromTextNodeWithoutStartingWidgetInteraction(
    page,
    calendarWidget,
    weekTab,
    0,
    'calendar-app'
  );

  const weekPoint = await readFirstTextNodeCenter(weekTab);
  await page.mouse.click(weekPoint.x, weekPoint.y);
  await assertWidgetInteractionInactive(calendarWidget);
  await expect.poll(async () => weekTab.getAttribute('class')).toContain('bg-background');
  await expect.poll(async () => readStoredLayoutX(page, 'calendar-app')).toBe(0);

  const todoComposer = todoWidget.getByRole('textbox', { name: 'New task' });
  await todoComposer.fill('Call supplier');
  const todoAddButton = todoWidget.getByRole('button', { name: 'Add' });

  await dragFromTextNodeWithoutStartingWidgetInteraction(
    page,
    todoWidget,
    todoAddButton,
    6,
    'todo-app'
  );

  const todoAddPoint = await readFirstTextNodeCenter(todoAddButton);
  await page.mouse.click(todoAddPoint.x, todoAddPoint.y);
  await assertWidgetInteractionInactive(todoWidget);
  await expect(todoWidget).toContainText('Call supplier');
  await expect.poll(async () => readStoredLayoutX(page, 'todo-app')).toBe(6);

  const quickLinksAddButton = quickLinksWidget.getByRole('button', { name: 'Add Link' });
  await expect(quickLinksAddButton).toBeVisible();

  await dragFromTextNodeWithoutStartingWidgetInteraction(
    page,
    quickLinksWidget,
    quickLinksAddButton,
    0,
    'quick-links-app'
  );

  const quickLinksAddPoint = await readFirstTextNodeCenter(quickLinksAddButton);
  await page.mouse.click(quickLinksAddPoint.x, quickLinksAddPoint.y);
  await assertWidgetInteractionInactive(quickLinksWidget);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Add Link' })).toBeVisible();
  await expect.poll(async () => readStoredLayoutX(page, 'quick-links-app')).toBe(0);
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
          timezones: [{ id: 1, name: 'Mexico City, Mexico', timezone: 'America/Mexico_City' }],
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
  await expect(clocksWidget).toContainText('Mexico');
  await expect.poll(async () => readOverflowingLeafNodes(page, 'world-clocks-1')).toEqual([]);

  const yearProgressWidget = page.locator('.react-grid-item[data-widget-id="year-progress-1"]');
  await expect(yearProgressWidget).toBeVisible();
  await expect(yearProgressWidget.getByRole('heading', { name: 'Year Progress' })).toHaveCount(0);
  await expect(yearProgressWidget.getByText(/\d+%/)).toBeVisible();
});

test('keeps world clock audit layouts within bounds from 1x1 through 4x4', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'world-clocks-1',
        type: 'world-clocks',
        config: {
          timezones: [{ id: 1, name: 'Mexico City, Mexico', timezone: 'America/Mexico_City' }],
        },
      },
      {
        id: 'world-clocks-2',
        type: 'world-clocks',
        config: {
          timezones: [
            { id: 1, name: 'Mexico City, Mexico', timezone: 'America/Mexico_City' },
            { id: 2, name: 'San Francisco, USA', timezone: 'America/Los_Angeles' },
          ],
        },
      },
      {
        id: 'world-clocks-3',
        type: 'world-clocks',
        config: {
          timezones: [
            { id: 1, name: 'Mexico City, Mexico', timezone: 'America/Mexico_City' },
            { id: 2, name: 'San Francisco, USA', timezone: 'America/Los_Angeles' },
            { id: 3, name: 'New York, USA', timezone: 'America/New_York' },
          ],
        },
      },
      {
        id: 'world-clocks-4',
        type: 'world-clocks',
        config: {
          timezones: [
            { id: 1, name: 'Mexico City, Mexico', timezone: 'America/Mexico_City' },
            { id: 2, name: 'San Francisco, USA', timezone: 'America/Los_Angeles' },
            { id: 3, name: 'New York, USA', timezone: 'America/New_York' },
            { id: 4, name: 'Los Angeles, USA', timezone: 'America/Los_Angeles' },
          ],
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'world-clocks-1', x: 0, y: 0, w: 1, h: 1, minW: 1, minH: 1 },
        { i: 'world-clocks-2', x: 1, y: 0, w: 2, h: 2, minW: 1, minH: 1 },
        { i: 'world-clocks-3', x: 3, y: 0, w: 3, h: 3, minW: 1, minH: 1 },
        { i: 'world-clocks-4', x: 6, y: 0, w: 4, h: 4, minW: 1, minH: 1 },
      ],
    },
  });

  for (const widgetId of ['world-clocks-1', 'world-clocks-2', 'world-clocks-3', 'world-clocks-4']) {
    const widget = page.locator(`.react-grid-item[data-widget-id="${widgetId}"]`);
    await expect(widget).toBeVisible();
    await expect.poll(async () => readOverflowingLeafNodes(page, widgetId)).toEqual([]);
  }
});
