import { expect, test, type Locator, type Page } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

const expectNoHeaderSeparator = async (header: Locator) => {
  await expect(header).toBeVisible();

  const details = await header.evaluate((element) => {
    const styles = getComputedStyle(element);

    return {
      borderBottomWidth: styles.borderBottomWidth,
      className: element.getAttribute('class') || '',
    };
  });

  expect(details.className).not.toContain('border-b');
  expect(details.borderBottomWidth).toBe('0px');
};

const routeCalendarEvents = async (page: Page) => {
  await page.route('https://www.googleapis.com/calendar/v3/calendars/**', async (route) => {
    await route.fulfill({
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
      contentType: 'application/json',
      status: 200,
    });
  });
};

const routePaisaData = async (page: Page) => {
  await page.route('http://localhost:7500/api/assets/balance', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        asset_breakdowns: {
          Assets: { marketAmount: 12450, xirr: 0, gainAmount: 0 },
          'Assets:cash': { marketAmount: 12450, xirr: 0, gainAmount: 0 },
        },
      }),
      contentType: 'application/json',
      status: 200,
    });
  });

  await page.route('http://localhost:7500/api/networth', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        networthTimeline: [
          { balanceAmount: 12000, date: '2026-03-01' },
          { balanceAmount: 12450, date: '2026-03-14' },
        ],
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
};

test('renders dashboard widget headers without separator borders', async ({ page }) => {
  await routeCalendarEvents(page);
  await routePaisaData(page);

  await page.setViewportSize({ width: 1600, height: 2200 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'todo-widget',
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
        id: 'weather-widget',
        type: 'weather',
        config: {
          city: 'Santiago',
          units: 'metric',
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
      {
        id: 'notes-app',
        type: 'notes',
        config: {
          title: 'Notes',
          content: 'Notes content',
        },
      },
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
        id: 'paisa-app',
        type: 'paisa',
        config: {
          title: 'Paisa',
          baseUrl: 'http://localhost:7500',
          refreshInterval: 300,
          showChart: true,
          currency: '$',
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'todo-widget', x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
        { i: 'weather-widget', x: 4, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
        { i: 'quick-links-app', x: 6, y: 0, w: 6, h: 6, minW: 2, minH: 2 },
        { i: 'notes-app', x: 0, y: 4, w: 6, h: 6, minW: 2, minH: 2 },
        { i: 'calendar-app', x: 6, y: 6, w: 6, h: 6, minW: 2, minH: 2 },
        { i: 'paisa-app', x: 0, y: 10, w: 6, h: 6, minW: 2, minH: 2 },
      ],
    },
  });

  await page.evaluate(() => {
    localStorage.setItem('googleAccessToken-calendar-app', 'test-access-token');
    localStorage.setItem('googleRefreshToken-calendar-app', 'test-refresh-token');
    localStorage.setItem('googleTokenExpiry-calendar-app', String(Date.now() + 60 * 60 * 1000));
  });
  await page.reload();

  await expectNoHeaderSeparator(page.locator('.react-grid-item[data-widget-id="todo-widget"] .widget-header'));
  await expectNoHeaderSeparator(page.locator('.react-grid-item[data-widget-id="weather-widget"] .widget-header'));
  await expectNoHeaderSeparator(page.locator('.react-grid-item[data-widget-id="quick-links-app"] [data-testid="quick-links-header"]'));
  await expectNoHeaderSeparator(page.locator('.react-grid-item[data-widget-id="notes-app"] [data-testid="notes-app-header"]'));
  await expectNoHeaderSeparator(page.locator('.react-grid-item[data-widget-id="calendar-app"] [data-testid="calendar-app-header"]'));
  await expectNoHeaderSeparator(page.locator('.react-grid-item[data-widget-id="paisa-app"] [data-testid="paisa-app-header"]'));
});
