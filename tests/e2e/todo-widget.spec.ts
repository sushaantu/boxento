import { expect, test } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

test('adds tasks in compact and wide todo layouts without extra submit chrome', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'todo-compact',
        type: 'todo',
        config: {
          title: 'Compact Todo',
          items: [
            { id: 'compact-1', text: 'Pay rent', completed: false, createdAt: '2026-03-12T00:00:00.000Z', sortOrder: 0 },
            { id: 'compact-2', text: 'Send invoice', completed: false, createdAt: '2026-03-12T00:01:00.000Z', sortOrder: 1 },
          ],
          showCompletedItems: true,
          sortOrder: 'created',
        },
      },
      {
        id: 'todo-wide',
        type: 'todo',
        config: {
          title: 'Wide Todo',
          items: [
            { id: 'wide-1', text: 'Book flights', completed: false, createdAt: '2026-03-12T00:02:00.000Z', sortOrder: 0 },
            { id: 'wide-2', text: 'Renew insurance', completed: false, createdAt: '2026-03-12T00:03:00.000Z', sortOrder: 1 },
          ],
          showCompletedItems: true,
          sortOrder: 'created',
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'todo-compact', x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
        { i: 'todo-wide', x: 2, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
      ],
    },
  });

  const compactWidget = page.locator('.react-grid-item[data-widget-id="todo-compact"]');
  const wideWidget = page.locator('.react-grid-item[data-widget-id="todo-wide"]');

  await expect(compactWidget).toBeVisible();
  await expect(wideWidget).toBeVisible();
  await expect(compactWidget.locator('form button[type="submit"]')).toHaveCount(0);
  await expect(wideWidget.locator('form button[type="submit"]')).toHaveCount(0);

  const compactComposer = compactWidget.getByRole('textbox', { name: 'New task' });
  await compactComposer.fill('Buy coffee');
  await compactComposer.press('Enter');
  await expect(compactWidget).toContainText('Buy coffee');

  const wideComposer = wideWidget.getByRole('textbox', { name: 'New task' });
  await wideComposer.fill('Draft roadmap');
  await wideComposer.press('Enter');
  await expect(wideWidget).toContainText('Draft roadmap');

  await expect.poll(async () => {
    return page.evaluate(() => {
      const configs = JSON.parse(localStorage.getItem('boxento-widget-configs') || '{}');

      return {
        compact: configs['todo-compact']?.items?.map((item: { text: string }) => item.text) ?? [],
        wide: configs['todo-wide']?.items?.map((item: { text: string }) => item.text) ?? [],
      };
    });
  }).toEqual({
    compact: ['Pay rent', 'Send invoice', 'Buy coffee'],
    wide: ['Book flights', 'Renew insurance', 'Draft roadmap'],
  });

  await page.reload();
  await expect(compactWidget).toContainText('Buy coffee');
  await expect(wideWidget).toContainText('Draft roadmap');
});
