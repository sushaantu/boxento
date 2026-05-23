import { expect, test } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

const MOCK_KUMA_RESPONSE = {
  dashboardUrl: 'https://kuma.test/status/homelab',
  monitors: [
    {
      id: 1,
      name: 'Fava backend (localhost)',
      group: 'Mac Mini Services',
      type: 'port',
      status: 'up',
      ping: 3,
      message: 'OK',
      lastChecked: '2026-05-22T22:34:00.000Z',
      uptime24: 1,
    },
    {
      id: 2,
      name: 'OpenClaw backup',
      group: 'Mac Mini Services',
      type: 'http',
      status: 'down',
      ping: null,
      message: 'HTTP 503 from upstream',
      lastChecked: '2026-05-22T22:31:00.000Z',
      uptime24: 0.92,
    },
    {
      id: 3,
      name: 'Paisa backend (localhost)',
      group: 'Mac Mini Services',
      type: 'port',
      status: 'up',
      ping: 30,
      message: 'OK',
      lastChecked: '2026-05-22T22:35:00.000Z',
      uptime24: 1,
    },
  ],
  summary: {
    total: 3,
    up: 2,
    down: 1,
    pending: 0,
    maintenance: 0,
  },
  updatedAt: '2026-05-22T22:35:00.000Z',
};

const MOCK_HEALTHCHECKS_RESPONSE = {
  dashboardUrl: 'https://healthchecks.test/projects/demo/checks',
  checks: [
    {
      name: 'finance-sync',
      slug: 'finance-sync',
      tags: 'mac-mini finance nightly',
      description: 'Syncs finance data every night.',
      status: 'down',
      started: false,
      lastPing: '2026-05-22T02:00:00.000Z',
      nextPing: '2026-05-23T02:00:00.000Z',
      lastDuration: 134,
      graceSeconds: 7200,
      timeoutSeconds: 86400,
    },
    {
      name: 'openclaw-backup',
      slug: 'openclaw-backup',
      tags: 'mac-mini backup',
      description: 'Runs the OpenClaw backup.',
      status: 'up',
      started: false,
      lastPing: '2026-05-22T21:00:00.000Z',
      nextPing: '2026-05-23T21:00:00.000Z',
      lastDuration: 32,
      graceSeconds: 7200,
      timeoutSeconds: 86400,
    },
    {
      name: 'openclaw-backup-sync',
      slug: 'openclaw-backup-sync',
      tags: 'mac-mini backup sync',
      description: 'Publishes backup sync status.',
      status: 'up',
      started: false,
      lastPing: '2026-05-22T20:00:00.000Z',
      nextPing: '2026-05-23T20:00:00.000Z',
      lastDuration: 16,
      graceSeconds: 7200,
      timeoutSeconds: 86400,
    },
  ],
  summary: {
    total: 3,
    up: 2,
    down: 1,
    grace: 0,
    late: 0,
    new: 0,
    paused: 0,
  },
  updatedAt: '2026-05-22T22:35:00.000Z',
};

test('monitoring widgets explain HTML API responses and keep settings reachable', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.route('**/api/monitoring/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><body>Boxento app shell</body></html>',
    });
  });
  await page.route('**/api/cron-health-html', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><body>Boxento app shell</body></html>',
    });
  });

  await seedDashboard(page, {
    widgets: [
      { id: 'kuma-1', type: 'kuma', config: { title: 'Service Monitoring' } },
      { id: 'healthchecks-1', type: 'healthchecks', config: { title: 'Job Monitoring' } },
      { id: 'cron-health-1', type: 'cron-health', config: { title: 'System Health', apiUrl: '/api/cron-health-html' } },
    ],
    layouts: {
      lg: [
        { i: 'kuma-1', x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 2 },
        { i: 'healthchecks-1', x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 2 },
        { i: 'cron-health-1', x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 2 },
      ],
    },
  });

  const kuma = page.locator('.react-grid-item[data-widget-id="kuma-1"]');
  await expect(kuma.getByText('Uptime Kuma endpoint returned HTML instead of JSON')).toBeVisible();
  await kuma.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Service Monitoring Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Widget' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  const healthchecks = page.locator('.react-grid-item[data-widget-id="healthchecks-1"]');
  await expect(healthchecks.getByText('Healthchecks endpoint returned HTML instead of JSON')).toBeVisible();
  await healthchecks.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Job Monitoring Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Widget' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  const cronHealth = page.locator('.react-grid-item[data-widget-id="cron-health-1"]');
  await expect(cronHealth.getByText('The API endpoint returned HTML instead of JSON')).toBeVisible();
});

test('keeps tall monitoring widgets simple and list-focused', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.route('**/api/monitoring/kuma', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_KUMA_RESPONSE),
    });
  });
  await page.route('**/api/monitoring/healthchecks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_HEALTHCHECKS_RESPONSE),
    });
  });

  await seedDashboard(page, {
    widgets: [
      { id: 'kuma-tall', type: 'kuma', config: { title: 'Service Monitoring' } },
      { id: 'healthchecks-tall', type: 'healthchecks', config: { title: 'Job Monitoring' } },
    ],
    layouts: {
      lg: [
        { i: 'kuma-tall', x: 0, y: 0, w: 3, h: 6, minW: 1, minH: 1 },
        { i: 'healthchecks-tall', x: 3, y: 0, w: 3, h: 6, minW: 1, minH: 1 },
      ],
    },
  });

  const kuma = page.locator('.react-grid-item[data-widget-id="kuma-tall"]');
  await expect(kuma.getByText('OpenClaw backup')).toBeVisible();
  await expect(kuma.getByText('HTTP 503 from upstream')).toBeVisible();
  await expect(kuma.getByText('Updated')).toBeVisible();
  await expect(kuma.getByPlaceholder('Search monitors')).toHaveCount(0);
  await expect(kuma.getByText('Response time')).toHaveCount(0);

  const healthchecks = page.locator('.react-grid-item[data-widget-id="healthchecks-tall"]');
  await expect(healthchecks.getByRole('button', { name: /finance-sync/ }).first()).toBeVisible();
  await expect(healthchecks.getByText('134s ·')).toBeVisible();
  await expect(healthchecks.getByText('Updated')).toBeVisible();
  await expect(healthchecks.getByPlaceholder('Search checks')).toHaveCount(0);
  await expect(healthchecks.getByText('Last run')).toHaveCount(0);
});
