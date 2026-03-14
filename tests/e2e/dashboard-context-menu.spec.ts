import { expect, test, type Locator, type Page } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

const SERVICES = [
  { id: 'boxento', name: 'Boxento', url: 'https://boxento.test', icon: 'LayoutGrid', description: 'Dashboard', category: 'Utilities' },
  { id: 'paisa', name: 'Paisa', url: 'https://paisa.test', icon: 'PiggyBank', description: 'Personal Finance', category: 'Finance' },
] as const;

const rightClickInsideWidget = async (widget: Locator): Promise<void> => {
  await widget.click({
    button: 'right',
    position: { x: 48, y: 72 },
  });
};

const findEmptyGridPoint = async (page: Page) => (
  page.locator('.react-grid-layout').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const point = {
      x: Math.max(Math.floor(rect.width) - 40, 40),
      y: Math.min(120, Math.max(Math.floor(rect.height / 2), 40)),
    };
    const target = document.elementFromPoint(rect.left + point.x, rect.top + point.y);

    if (target instanceof Element && target.closest('.react-grid-item')) {
      throw new Error('Expected an empty dashboard background point');
    }

    return point;
  })
);

test('opens the dashboard context menu only on the empty dashboard background', async ({ page }) => {
  await page.route('https://*.test/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.setViewportSize({ width: 1440, height: 960 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'quick-links-1',
        type: 'quick-links',
        config: {
          customTitle: 'Quick Links',
          links: [
            { id: 1, title: 'Docs', url: 'https://docs.test', favicon: '', category: 'Work' },
          ],
        },
      },
      {
        id: 'services-1',
        type: 'services',
        config: {
          title: 'Services',
          services: SERVICES,
          showStatus: false,
          checkInterval: 60,
        },
      },
      {
        id: 'todo-1',
        type: 'todo',
        config: {
          title: 'Todo',
          items: [
            { id: 'todo-1-a', text: 'Review release PR', completed: false, createdAt: '2026-03-12T00:00:00.000Z', sortOrder: 0 },
            { id: 'todo-1-b', text: 'Ship dashboard fix', completed: false, createdAt: '2026-03-12T00:01:00.000Z', sortOrder: 1 },
          ],
          showCompletedItems: true,
          sortOrder: 'created',
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'quick-links-1', x: 0, y: 0, w: 3, h: 4, minW: 1, minH: 1 },
        { i: 'services-1', x: 3, y: 0, w: 3, h: 4, minW: 1, minH: 1 },
        { i: 'todo-1', x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 2 },
      ],
    },
  });

  const dashboardMenuItem = page.getByRole('menuitem', { name: 'Add Widget' });
  const grid = page.locator('.react-grid-layout');
  const quickLinksWidget = page.locator('.react-grid-item[data-widget-id="quick-links-1"]');
  const servicesWidget = page.locator('.react-grid-item[data-widget-id="services-1"]');
  const todoWidget = page.locator('.react-grid-item[data-widget-id="todo-1"]');

  await expect(quickLinksWidget).toBeVisible();
  await expect(servicesWidget).toBeVisible();
  await expect(todoWidget).toBeVisible();

  const backgroundPoint = await findEmptyGridPoint(page);
  await grid.click({ button: 'right', position: backgroundPoint });
  await expect(dashboardMenuItem).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dashboardMenuItem).toHaveCount(0);

  await rightClickInsideWidget(quickLinksWidget);
  await expect(dashboardMenuItem).toHaveCount(0);

  await rightClickInsideWidget(servicesWidget);
  await expect(dashboardMenuItem).toHaveCount(0);

  await rightClickInsideWidget(todoWidget);
  await expect(dashboardMenuItem).toHaveCount(0);
});
