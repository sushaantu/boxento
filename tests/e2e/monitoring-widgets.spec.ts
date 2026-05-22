import { expect, test } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

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
