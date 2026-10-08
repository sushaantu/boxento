import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

const API_KEY = 'test-existing-key';
const MATCHES_URL = 'https://api.livetennisapi.com/api/public/v1/matches';
const REFRESH_INTERVAL = 900_000;
const MATCH = {
  id: 1,
  status: 'live',
  tournament: 'Tokyo Open',
  players: {
    p1: { id: 'player-1', name: 'Alex Rivera' },
    p2: { id: 'player-2', name: 'Robin Chen' },
  },
  score: {
    sets: [1, 0],
    games: [[6, 3], [4, 4]],
    points: ['30', '40'],
    server: 1,
  },
};

type CapturedRequest = { url: string; key: string | undefined; method: string };

const mockMatches = async (
  context: BrowserContext,
  matches: unknown[] = [MATCH],
  status = 200
): Promise<CapturedRequest[]> => {
  const requests: CapturedRequest[] = [];
  await context.route(`${MATCHES_URL}?*`, async (route) => {
    requests.push({
      url: route.request().url(),
      key: route.request().headers()['x-api-key'],
      method: route.request().method(),
    });
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ data: matches }),
    });
  });
  return requests;
};

const tennisWidget = (id: string, config: Record<string, unknown> = {}) => ({
  id,
  type: 'tennis',
  config: { title: 'Tennis', ...config },
});

const seedTennisDashboard = async (
  page: Page,
  options: Parameters<typeof seedDashboard>[1],
  configured = true
): Promise<void> => {
  await seedDashboard(page, options);
  if (configured) {
    await page.evaluate(async (key) => {
      const modulePath = '/src/lib/sharedCredentials.ts';
      const { sharedCredentialsManager } = await import(modulePath);
      await sharedCredentialsManager.saveCredential('livetennis-api', key);
    }, API_KEY);
    await page.reload();
  }
};

const layoutItem = (id: string, width = 3, height = 3, x = 0) => ({
  i: id, x, y: 0, w: width, h: height, minW: 1, minH: 1,
});

const getWidget = (page: Page, id = 'tennis-1'): Locator => (
  page.locator(`.react-grid-item[data-widget-id="${id}"]`)
);

const expectNoOverflow = async (widget: Locator): Promise<void> => {
  const overflow = await widget.locator('.widget-container').evaluate((element) => {
    const root = element.getBoundingClientRect();
    const escaped = Array.from(element.querySelectorAll('button, input, span, p, [aria-label="Tennis match"]'))
      .filter((child) => {
        const box = child.getBoundingClientRect();
        const style = getComputedStyle(child);
        if (box.width === 0 || box.height === 0 || style.visibility === 'hidden') return false;
        return box.left < root.left - 1 || box.right > root.right + 1
          || box.top < root.top - 1 || box.bottom > root.bottom + 1;
      })
      .map((child) => child.getAttribute('aria-label') || child.textContent?.trim() || child.tagName);
    return { horizontal: element.scrollWidth > element.clientWidth + 1, escaped };
  });
  expect(overflow, await widget.getAttribute('data-widget-id') || 'Tennis widget')
    .toEqual({ horizontal: false, escaped: [] });
};

test('shows player-major game scores and keeps matches without a score readable', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const requests = await mockMatches(context, [
    MATCH,
    {
      ...MATCH,
      id: 2,
      players: {
        p1: { id: 'player-3', name: 'Sam Taylor' },
        p2: { id: 'player-4', name: 'Morgan Kim' },
      },
      score: null,
    },
  ]);
  await seedTennisDashboard(page, {
    widgets: [tennisWidget('tennis-1')],
    layouts: { lg: [layoutItem('tennis-1', 4, 4)] },
  });

  const widget = getWidget(page);
  await expect(widget).toContainText('Alex Rivera');
  await expect(widget).toContainText('Robin Chen');
  await expect(widget).toContainText('6-4');
  await expect(widget).toContainText('3-4');
  await expect(widget).toContainText('30');
  await expect(widget).toContainText('40');
  await expect(widget).toContainText('Sam Taylor');
  await expect(widget).toContainText('Morgan Kim');
  await expect(widget.getByLabel('Tennis match', { exact: true })).toHaveCount(2);
  await expect(widget).not.toContainText('NaN');
  await expect(widget).not.toContainText('undefined');
  await expect.poll(() => requests.length).toBe(1);
  const url = new URL(requests[0].url);
  expect(url.searchParams.get('status')).toBe('live');
  expect(url.searchParams.get('limit')).toBe('200');
  expect(url.searchParams.has('token')).toBe(false);
  expect(requests[0].key).toBe(API_KEY);
  expect(requests[0].method).toBe('GET');

  const search = widget.getByPlaceholder('Search players or tournaments');
  await search.fill('Morgan');
  await expect(widget.getByLabel('Tennis match', { exact: true })).toHaveCount(1);
  await expect(widget).toContainText('Morgan Kim');
  await search.fill('Tokyo');
  await expect(widget.getByLabel('Tennis match', { exact: true })).toHaveCount(2);
  expect(requests).toHaveLength(1);
});

test('saves a masked key, cancels draft changes and deletes through settings', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const requests = await mockMatches(context);
  await seedTennisDashboard(page, {
    widgets: [tennisWidget('tennis-1')],
    layouts: { lg: [layoutItem('tennis-1')] },
  }, false);

  const widget = getWidget(page);
  await expect(widget).toBeVisible();
  expect(requests).toHaveLength(0);
  await widget.getByRole('button', { name: 'Open widget settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tennis settings' });
  const keyInput = dialog.getByLabel('API key', { exact: true });
  await expect(keyInput).toHaveAttribute('type', 'password');
  await keyInput.fill(API_KEY);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(widget).toContainText('Alex Rivera');
  await expect.poll(() => page.evaluate(() => {
    const configs = JSON.parse(localStorage.getItem('boxento-widget-configs') || '{}');
    return { title: configs['tennis-1']?.title, apiKey: configs['tennis-1']?.apiKey };
  })).toEqual({ title: 'Tennis', apiKey: undefined });
  const encryptedCredentials = await page.evaluate(() => (
    localStorage.getItem('boxento-shared-credentials') || ''
  ));
  expect(encryptedCredentials).toContain('livetennis-api');
  expect(encryptedCredentials).not.toContain(API_KEY);
  await expect(widget).not.toContainText(API_KEY);
  await page.reload();
  await expect(widget).toContainText('Alex Rivera');

  await widget.getByRole('button', { name: 'Open widget settings' }).click();
  await keyInput.fill('discarded-key');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await widget.getByRole('button', { name: 'Open widget settings' }).click();
  await expect(keyInput).toHaveValue(API_KEY);
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(widget).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('boxento-widgets-personal') || '[]')
      .some((stored: { id: string }) => stored.id === 'tennis-1')
  ))).toBe(false);
  await page.reload();
  await expect(widget).toHaveCount(0);
  expect(requests).toHaveLength(1);
});

test('shares one snapshot and the request floor across widgets, tabs and reloads', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const requests = await mockMatches(context);
  await seedTennisDashboard(page, {
    widgets: [tennisWidget('tennis-1'), tennisWidget('tennis-2')],
    layouts: { lg: [layoutItem('tennis-1'), layoutItem('tennis-2', 3, 3, 3)] },
  });

  await expect(getWidget(page, 'tennis-1')).toContainText('Alex Rivera');
  await expect(getWidget(page, 'tennis-2')).toContainText('Alex Rivera');
  await expect.poll(() => requests.length).toBe(1);
  await getWidget(page).getByRole('button', { name: 'Refresh tennis scores' }).click();
  await expect(getWidget(page)).toContainText('Alex Rivera');
  expect(requests).toHaveLength(1);
  await page.reload();
  await expect(getWidget(page)).toContainText('Alex Rivera');
  const secondTab = await context.newPage();
  await secondTab.goto(page.url());
  await expect(getWidget(secondTab)).toContainText('Alex Rivera');
  await expect(getWidget(secondTab, 'tennis-2')).toContainText('Alex Rivera');
  expect(requests).toHaveLength(1);
  await secondTab.close();
});

test('retains the last score snapshot when a refresh fails and preserves the failure cooldown', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const requests = await mockMatches(context);
  await seedTennisDashboard(page, {
    widgets: [tennisWidget('tennis-1')],
    layouts: { lg: [layoutItem('tennis-1')] },
  });
  const widget = getWidget(page);
  await expect(widget).toContainText('Alex Rivera');
  const attemptedAt = await page.evaluate(() => Date.now());
  await context.unroute(`${MATCHES_URL}?*`);
  const failedRequests = await mockMatches(context, [], 503);
  await context.addInitScript((now) => { Date.now = () => now; }, attemptedAt + REFRESH_INTERVAL + 1_000);
  await page.reload();
  await expect(widget).toContainText('Alex Rivera');
  await expect(widget).toContainText('Last scores');
  await expect.poll(() => failedRequests.length).toBe(1);
  await page.reload();
  await expect(widget).toContainText('Alex Rivera');
  expect(requests).toHaveLength(1);
  expect(failedRequests).toHaveLength(1);
});

test('keeps a failed initial request quiet on reload and displays an empty snapshot', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const requests = await mockMatches(context, [], 401);
  await seedTennisDashboard(page, {
    widgets: [tennisWidget('tennis-1')],
    layouts: { lg: [layoutItem('tennis-1')] },
  });
  const widget = getWidget(page);
  await expect(widget).toContainText(/key|access|connect|load/i);
  await expect.poll(() => requests.length).toBe(1);
  await page.reload();
  await expect(widget).toContainText(/key|access|connect|load/i);
  expect(requests).toHaveLength(1);

  await context.unroute(`${MATCHES_URL}?*`);
  const emptyRequests = await mockMatches(context, []);
  await seedTennisDashboard(page, {
    widgets: [tennisWidget('tennis-1')],
    layouts: { lg: [layoutItem('tennis-1')] },
  });
  await expect(widget).toContainText(/no live matches/i);
  await expect.poll(() => emptyRequests.length).toBe(1);
});

test('hides edit controls on a dashboard owned by another person', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockMatches(context);
  await seedTennisDashboard(page, {
    dashboards: [{
      id: 'personal', name: 'Shared scores', visibility: 'public', sharedWith: [],
      isDefault: true, ownerId: 'other-owner', createdAt: '2026-03-12T00:00:00.000Z',
    }],
    widgets: [tennisWidget('tennis-1')],
    layouts: { lg: [layoutItem('tennis-1', 4, 4)] },
  });
  const widget = getWidget(page);
  await expect(widget).toContainText('Alex Rivera');
  await expect(widget.getByRole('button')).toHaveCount(0);
  await expect(widget.getByPlaceholder('Search players or tournaments')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`keeps the size spectrum legible without overflow in ${theme} mode`, async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 2200 });
    const requests = await mockMatches(context, [{
      ...MATCH,
      players: {
        p1: { id: 'player-1', name: 'Alex Rivera With A Deliberately Long Player Name' },
        p2: { id: 'player-2', name: 'Robin Chen With Another Long Player Name' },
      },
    }]);
    const sizes = [
      ['tiny', 1, 1, 0, 0], ['short', 4, 1, 1, 0], ['narrow', 1, 3, 5, 0],
      ['compact', 2, 2, 6, 0], ['standard', 3, 3, 8, 0],
      ['panel', 4, 4, 0, 3], ['app', 6, 6, 4, 3],
    ] as const;
    await seedTennisDashboard(page, {
      widgets: sizes.map(([size]) => tennisWidget(`tennis-${size}`)),
      layouts: { lg: sizes.map(([size, width, height, x, y]) => ({
        ...layoutItem(`tennis-${size}`, width, height, x), y,
      })) },
    });
    await expect(getWidget(page, 'tennis-standard')).toContainText('6-4');
    if (theme === 'dark') await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', theme);

    for (const [size] of sizes) {
      const widget = getWidget(page, `tennis-${size}`);
      await expect(widget).toBeVisible();
      await expectNoOverflow(widget);
      await widget.screenshot({ path: `output/playwright/tennis-${size}-${theme}.png` });
    }
    await expect(getWidget(page, 'tennis-tiny').getByRole('heading')).toHaveCount(0);
    await expect(getWidget(page, 'tennis-short').getByRole('heading')).toHaveCount(0);
    await expect(getWidget(page, 'tennis-compact').getByLabel('Sets won').first()).toHaveText('1');
    await expect(getWidget(page, 'tennis-panel').getByPlaceholder('Search players or tournaments')).toBeVisible();
    await expect(getWidget(page, 'tennis-app').getByPlaceholder('Search players or tournaments')).toBeVisible();
    expect(requests).toHaveLength(1);
  });
}
