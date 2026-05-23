import { expect, test, type Page } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

const SERVICES = [
  { id: 'boxento', name: 'Boxento', url: 'https://boxento.test', icon: 'LayoutGrid', description: 'Dashboard', category: 'Utilities' },
  { id: 'paisa', name: 'Paisa', url: 'https://paisa.test', icon: 'PiggyBank', description: 'Personal Finance', category: 'Finance' },
  { id: 'jellyfin', name: 'Jellyfin', url: 'https://jellyfin.test', icon: 'Play', description: 'Media Server', category: 'Media' },
  { id: 'open-webui', name: 'Open WebUI', url: 'https://open-webui.test', icon: 'Bot', description: 'Local AI Chat', category: 'AI' },
] as const;

const readStoredServicesConfig = async (page: Page, widgetId: string) => (
  page.evaluate((currentWidgetId) => {
    const configs = JSON.parse(localStorage.getItem('boxento-widget-configs') || '{}');
    const config = configs[currentWidgetId] || {};
    return {
      title: config.title,
      showStatus: config.showStatus,
      checkInterval: config.checkInterval,
      serviceNames: (config.services ?? []).map((service: { name: string }) => service.name),
    };
  }, widgetId)
);

test('keeps compact services cards within a mobile two-column widget', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'services-mobile',
        type: 'services',
        config: {
          title: 'Pocket Services',
          services: SERVICES,
          showStatus: false,
          checkInterval: 60,
        },
      },
    ],
    layouts: {
      xs: [
        { i: 'services-mobile', x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2, maxW: 2, maxH: 2 },
      ],
      xxs: [
        { i: 'services-mobile', x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2, maxW: 2, maxH: 2 },
      ],
    },
  });

  const widget = page.locator('.mobile-widget-item').filter({
    has: page.getByRole('heading', { name: 'Pocket Services' }),
  }).first();
  await expect(widget).toBeVisible();
  await expect(widget.getByRole('heading', { name: 'Pocket Services' })).toBeVisible();
  await expect(widget.locator('button[title]')).toHaveCount(4);

  const allCardsWithinBounds = await widget.evaluate((element) => {
    const widgetRect = element.getBoundingClientRect();
    const cards = Array.from(element.querySelectorAll('button[title]'));

    return cards.every((card) => {
      if (!(card instanceof HTMLElement)) {
        return false;
      }

      const rect = card.getBoundingClientRect();
      return rect.left >= widgetRect.left - 1 && rect.right <= widgetRect.right + 1;
    });
  });

  expect(allCardsWithinBounds).toBe(true);
});

test('persists services settings changes from the tablet dialog flow', async ({ page }) => {
  const updatedTitle = 'Homelab Services';
  const updatedCheckInterval = 120;
  const serviceToAdd = {
    category: 'Media',
    description: 'Photo backup',
    name: 'Immich',
    url: 'https://immich.test',
  } as const;
  const serviceToDelete = 'Boxento';
  const remainingServiceNames = ['Paisa', 'Jellyfin', serviceToAdd.name];

  await page.route('https://*.test/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.setViewportSize({ width: 834, height: 1112 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'services-tablet',
        type: 'services',
        config: {
          title: 'Services',
          services: SERVICES.slice(0, 3),
          showStatus: false,
          checkInterval: 60,
        },
      },
    ],
    layouts: {
      sm: [
        { i: 'services-tablet', x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
      ],
      lg: [
        { i: 'services-tablet', x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
      ],
    },
  });

  const widget = page.locator('.react-grid-item[data-widget-id="services-tablet"]');
  await expect(widget).toBeVisible();

  await widget.locator('.settings-button').click();

  const settingsDialog = page.getByRole('dialog').filter({ hasText: 'Services Settings' });
  await expect(settingsDialog).toBeVisible();

  await settingsDialog.locator('#title-input').fill(updatedTitle);
  await settingsDialog.locator('#status-toggle').click();
  await settingsDialog.locator('#interval-input').fill(String(updatedCheckInterval));
  await settingsDialog.getByRole('button', { name: 'Add service' }).click();

  await page.locator('#service-name').fill(serviceToAdd.name);
  await page.locator('#service-url').fill(serviceToAdd.url);
  await page.locator('#service-desc').fill(serviceToAdd.description);
  await page.locator('#service-category').fill(serviceToAdd.category);
  await page.getByRole('button', { name: 'Add Service', exact: true }).click();

  await expect(settingsDialog).toContainText(serviceToAdd.name);
  await settingsDialog.getByRole('button', { name: `Delete ${serviceToDelete}` }).click();
  await settingsDialog.getByRole('button', { name: 'Save' }).click();

  await expect(widget.getByRole('heading', { name: updatedTitle })).toBeVisible();
  await expect(widget).toContainText(serviceToAdd.name);
  await expect(widget).not.toContainText(serviceToDelete);

  await expect.poll(async () => readStoredServicesConfig(page, 'services-tablet')).toEqual({
    title: updatedTitle,
    showStatus: true,
    checkInterval: updatedCheckInterval,
    serviceNames: remainingServiceNames,
  });

  await page.reload();
  await expect(widget.getByRole('heading', { name: updatedTitle })).toBeVisible();
  await expect(widget).toContainText(serviceToAdd.name);
  await expect(widget).not.toContainText(serviceToDelete);
});

test('keeps 6x6 services widgets as a simple searchable directory list', async ({ page }) => {
  await page.route('https://*.test/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.setViewportSize({ width: 1512, height: 982 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'services-app',
        type: 'services',
        config: {
          title: 'Services',
          services: SERVICES,
          showStatus: true,
          checkInterval: 60,
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'services-app', x: 0, y: 0, w: 6, h: 6, minW: 1, minH: 1 },
      ],
    },
  });

  const widget = page.locator('.react-grid-item[data-widget-id="services-app"]');
  await expect(widget.getByPlaceholder('Filter...')).toBeVisible();
  await expect(widget.getByRole('button', { name: 'Utilities (1)' })).toBeVisible();
  await expect(widget.getByRole('button', { name: /Boxento/ })).toBeVisible();
  await expect(widget.getByText('boxento.test')).toBeVisible();
  await expect(widget.getByText('Response Time')).toHaveCount(0);
  await expect(widget.getByRole('link', { name: 'https://boxento.test' })).toHaveCount(0);

  await widget.getByRole('button', { name: 'Utilities (1)' }).click();
  await expect(widget.getByText('1 of 4 services')).toBeVisible();
  await expect(widget.getByRole('button', { name: /Paisa/ })).toHaveCount(0);
});

test('reserves the services detail pane for truly wide app sizes', async ({ page }) => {
  await page.route('https://*.test/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.setViewportSize({ width: 1512, height: 982 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'services-wide-app',
        type: 'services',
        config: {
          title: 'Services',
          services: SERVICES,
          showStatus: true,
          checkInterval: 60,
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'services-wide-app', x: 0, y: 0, w: 8, h: 6, minW: 1, minH: 1 },
      ],
    },
  });

  const widget = page.locator('.react-grid-item[data-widget-id="services-wide-app"]');
  await expect(widget.getByRole('button', { name: 'Utilities' })).toBeVisible();
  await expect(widget.getByRole('link', { name: 'https://boxento.test' })).toBeVisible();
  await expect(widget.getByText('Response Time')).toBeVisible();

  const detailFitsWidget = await widget.getByRole('link', { name: 'https://boxento.test' }).evaluate((link) => {
    const widget = link.closest('.react-grid-item');
    if (!(widget instanceof HTMLElement)) return false;
    const widgetRect = widget.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    return linkRect.left >= widgetRect.left && linkRect.right <= widgetRect.right;
  });

  expect(detailFitsWidget).toBe(true);
});
