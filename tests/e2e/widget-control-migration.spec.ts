import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

const OUTPUT_DIR = join('output', 'playwright');
const LIGHT_DASHBOARD = join(OUTPUT_DIR, 'widget-control-migration-light.png');
const DARK_DASHBOARD = join(OUTPUT_DIR, 'widget-control-migration-dark.png');
const LIGHT_RSS = join(OUTPUT_DIR, 'widget-control-migration-rss-light.png');
const DARK_WEATHER = join(OUTPUT_DIR, 'widget-control-migration-weather-dark.png');
const DARK_IFRAME = join(OUTPUT_DIR, 'widget-control-migration-iframe-dark.png');
const DARK_QRCODE = join(OUTPUT_DIR, 'widget-control-migration-qrcode-dark.png');

const RSS_FEEDS = {
  'https://feeds.example/engineering.xml': `<?xml version="1.0"?><rss version="2.0"><channel><title>Engineering</title><item><title>Replace controls with primitives</title><link>https://example.com/eng-1</link><description>Button and textarea migration complete.</description><pubDate>Fri, 14 Mar 2026 12:00:00 GMT</pubDate><author>Alex</author></item><item><title>Validate tabs and sliders</title><link>https://example.com/eng-2</link><description>Calendar and iframe widgets verified.</description><pubDate>Thu, 13 Mar 2026 12:00:00 GMT</pubDate><author>Sam</author></item></channel></rss>`,
  'https://feeds.example/design.xml': `<?xml version="1.0"?><rss version="2.0"><channel><title>Design</title><item><title>Dark mode audit</title><link>https://example.com/des-1</link><description>Dropdowns and tabs align with the system palette.</description><pubDate>Fri, 14 Mar 2026 11:30:00 GMT</pubDate><author>Jamie</author></item></channel></rss>`,
} as const;

const WEATHER_PAYLOAD = {
  current: {
    temperature_2m: 21,
    relative_humidity_2m: 54,
    apparent_temperature: 22,
    weather_code: 1,
    wind_speed_10m: 9,
    wind_direction_10m: 230,
  },
  daily: {
    time: ['2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17', '2026-03-18'],
    weather_code: [1, 2, 3, 61, 0],
    temperature_2m_max: [24, 23, 22, 19, 25],
    temperature_2m_min: [14, 13, 12, 11, 15],
    sunrise: ['2026-03-14T07:26:00-03:00', '2026-03-15T07:27:00-03:00', '2026-03-16T07:28:00-03:00', '2026-03-17T07:29:00-03:00', '2026-03-18T07:30:00-03:00'],
    sunset: ['2026-03-14T19:46:00-03:00', '2026-03-15T19:44:00-03:00', '2026-03-16T19:43:00-03:00', '2026-03-17T19:41:00-03:00', '2026-03-18T19:40:00-03:00'],
  },
} as const;

const configureExternalRoutes = async (page: Page) => {
  await page.route('https://www.googleapis.com/calendar/v3/users/me/calendarList', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'primary',
            summary: 'Primary',
            backgroundColor: '#4285F4',
          },
        ],
      }),
    });
  });

  await page.route('https://www.googleapis.com/calendar/v3/calendars/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'evt-1',
            summary: 'Design review',
            start: { dateTime: '2026-03-14T15:00:00.000Z' },
            end: { dateTime: '2026-03-14T16:00:00.000Z' },
          },
          {
            id: 'evt-2',
            summary: 'Release checklist',
            start: { dateTime: '2026-03-15T18:00:00.000Z' },
            end: { dateTime: '2026-03-15T19:00:00.000Z' },
          },
        ],
      }),
    });
  });

  await page.route('**/api/rss?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    const url = requestUrl.searchParams.get('url') || 'https://feeds.example/engineering.xml';
    const body = RSS_FEEDS[url as keyof typeof RSS_FEEDS] ?? RSS_FEEDS['https://feeds.example/engineering.xml'];
    await route.fulfill({ status: 200, contentType: 'application/rss+xml', body });
  });

  await page.route('https://geocoding-api.open-meteo.com/v1/search?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    const query = (requestUrl.searchParams.get('name') || '').toLowerCase();
    const results = query.startsWith('san')
      ? {
          results: [
            { id: 2, name: 'San Francisco', country: 'United States', admin1: 'California', latitude: 37.77, longitude: -122.42 },
            { id: 3, name: 'San Diego', country: 'United States', admin1: 'California', latitude: 32.72, longitude: -117.16 },
            { id: 4, name: 'San Jose', country: 'United States', admin1: 'California', latitude: 37.33, longitude: -121.89 },
          ],
        }
      : {
          results: [
            { id: 1, name: 'Santiago', country: 'Chile', admin1: 'Santiago Metropolitan', latitude: -33.45, longitude: -70.66 },
          ],
        };

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(results) });
  });

  await page.route('https://api.open-meteo.com/v1/forecast?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WEATHER_PAYLOAD) });
  });
};

const setTheme = async (page: Page, theme: 'light' | 'dark') => {
  const appRoot = page.locator('[data-theme]').first();
  const currentTheme = await appRoot.getAttribute('data-theme');

  if (currentTheme !== theme) {
    await page.getByRole('button', { name: 'Toggle theme' }).click();
  }

  await expect(appRoot).toHaveAttribute('data-theme', theme);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark).*$/);
};

test('captures representative migrated controls in light and dark themes', async ({ page, baseURL }) => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 2200 });
  await configureExternalRoutes(page);

  await seedDashboard(page, {
    widgets: [
      {
        id: 'calendar-app',
        type: 'calendar',
        config: {
          title: 'Calendar',
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
        id: 'rss-app',
        type: 'rss',
        config: {
          title: 'RSS Reader',
          feeds: [
            { title: 'Engineering', url: 'https://feeds.example/engineering.xml', enabled: true },
            { title: 'Design', url: 'https://feeds.example/design.xml', enabled: true },
          ],
          maxItems: 5,
          showImages: false,
          showDate: true,
          showAuthor: true,
          showDescription: true,
          displayMode: 'list',
          openInNewTab: true,
        },
      },
      { id: 'weather-app', type: 'weather', config: { title: 'Weather', location: 'Santiago', units: 'metric' } },
      { id: 'iframe-1', type: 'iframe', config: { title: 'Embed', url: `${baseURL}/index.html`, scale: 1, alignment: 'top' } },
      { id: 'qrcode-1', type: 'qrcode', config: { title: 'QR Code', content: 'https://boxento.test', errorLevel: 'M', history: [{ id: 'qr-1', content: 'https://boxento.test', label: 'Boxento' }] } },
      { id: 'notes-1', type: 'notes', config: { title: 'Notes', content: 'Replace native controls\nUse Tabs, DropdownMenu, Slider, and Textarea\nVerify light and dark mode.' } },
      {
        id: 'todo-app',
        type: 'todo',
        config: {
          title: 'Operations Todo',
          items: [
            { id: 'todo-1', text: 'Replace native buttons', completed: false, createdAt: '2026-03-12T00:00:00.000Z', sortOrder: 0 },
            { id: 'todo-2', text: 'Validate widget settings', completed: false, createdAt: '2026-03-12T00:01:00.000Z', sortOrder: 1 },
            { id: 'todo-3', text: 'Record blocker state', completed: true, createdAt: '2026-03-12T00:02:00.000Z', sortOrder: 2 },
          ],
          showCompletedItems: true,
          sortOrder: 'manual',
        },
      },
      {
        id: 'services-1',
        type: 'services',
        config: {
          title: 'Services',
          services: [
            { id: 'boxento', name: 'Boxento', url: 'https://boxento.test', icon: 'LayoutGrid', description: 'Dashboard', category: 'Utilities' },
            { id: 'paisa', name: 'Paisa', url: 'https://paisa.test', icon: 'PiggyBank', description: 'Personal Finance', category: 'Finance' },
            { id: 'jellyfin', name: 'Jellyfin', url: 'https://jellyfin.test', icon: 'Play', description: 'Media Server', category: 'Media' },
            { id: 'open-webui', name: 'Open WebUI', url: 'https://open-webui.test', icon: 'Bot', description: 'Local AI Chat', category: 'AI' },
          ],
          showStatus: false,
          checkInterval: 60,
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'calendar-app', x: 0, y: 0, w: 6, h: 6, minW: 2, minH: 2 },
        { i: 'rss-app', x: 6, y: 0, w: 6, h: 6, minW: 2, minH: 2 },
        { i: 'weather-app', x: 0, y: 6, w: 4, h: 4, minW: 2, minH: 2 },
        { i: 'iframe-1', x: 4, y: 6, w: 4, h: 4, minW: 2, minH: 2 },
        { i: 'qrcode-1', x: 8, y: 6, w: 4, h: 4, minW: 2, minH: 2 },
        { i: 'notes-1', x: 0, y: 10, w: 4, h: 4, minW: 2, minH: 2 },
        { i: 'todo-app', x: 4, y: 10, w: 4, h: 4, minW: 2, minH: 2 },
        { i: 'services-1', x: 8, y: 10, w: 4, h: 4, minW: 2, minH: 2 },
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
  const rssWidget = page.locator('.react-grid-item[data-widget-id="rss-app"]');
  const weatherWidget = page.locator('.react-grid-item[data-widget-id="weather-app"]');
  const iframeWidget = page.locator('.react-grid-item[data-widget-id="iframe-1"]');
  const qrWidget = page.locator('.react-grid-item[data-widget-id="qrcode-1"]');
  const notesWidget = page.locator('.react-grid-item[data-widget-id="notes-1"]');

  await expect(calendarWidget.getByRole('tab', { name: 'Week' })).toBeVisible();
  await calendarWidget.getByRole('tab', { name: 'Week' }).click();
  await expect(calendarWidget.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true');

  await expect(notesWidget.getByRole('textbox', { name: 'Notes content' })).toBeVisible();

  await page.screenshot({ path: LIGHT_DASHBOARD, fullPage: true });

  const feedFilter = rssWidget.getByRole('button', { name: 'All Feeds' });
  await feedFilter.click();
  await expect(page.getByRole('menuitemradio', { name: 'Engineering' })).toBeVisible();
  await expect(page.getByRole('menuitemradio', { name: 'Design' })).toBeVisible();
  await page.screenshot({ path: LIGHT_RSS, fullPage: true });
  await page.keyboard.press('Escape');

  await setTheme(page, 'dark');

  const weatherSettings = weatherWidget.getByRole('button', { name: 'Open widget settings' });
  await weatherSettings.click();
  const weatherDialog = page.getByRole('dialog').filter({ hasText: 'Weather Settings' });
  await expect(weatherDialog).toBeVisible();
  await weatherDialog.getByLabel('Location').fill('San');
  await expect(page.getByRole('button', { name: /San Francisco/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /San Diego/i })).toBeVisible();
  await page.screenshot({ path: DARK_WEATHER, fullPage: true });
  await page.getByRole('button', { name: /San Francisco/i }).click();
  await expect(page.getByRole('button', { name: /San Diego/i })).toBeHidden();
  await weatherDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(weatherDialog).toBeHidden();

  await iframeWidget.scrollIntoViewIfNeeded();
  const iframeSettings = iframeWidget.locator('.settings-button').first();
  await iframeSettings.click();
  const iframeDialog = page.getByRole('dialog').filter({ hasText: 'Embed Settings' });
  await expect(iframeDialog).toBeVisible();
  const iframeSlider = iframeDialog.getByRole('slider');
  await expect(iframeSlider).toBeVisible();
  const initialScale = Number((await iframeSlider.getAttribute('aria-valuenow')) || '0');
  await iframeSlider.press('ArrowRight');
  await expect.poll(async () => Number((await iframeSlider.getAttribute('aria-valuenow')) || '0')).toBeGreaterThan(initialScale);
  await page.screenshot({ path: DARK_IFRAME, fullPage: true });
  await iframeDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(iframeDialog).toBeHidden();

  await qrWidget.scrollIntoViewIfNeeded();
  const qrSettings = qrWidget.locator('.settings-button').first();
  await qrSettings.click();
  const qrDialog = page.getByRole('dialog').filter({ hasText: 'QR Code Settings' });
  await expect(qrDialog).toBeVisible();
  await expect(qrDialog.getByLabel('Content (URL or text)')).toBeVisible();
  await page.screenshot({ path: DARK_QRCODE, fullPage: true });
  await qrDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(qrDialog).toBeHidden();

  await page.screenshot({ path: DARK_DASHBOARD, fullPage: true });
});
