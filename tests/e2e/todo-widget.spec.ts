import { expect, test, type Locator, type Page } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

const readStoredTodoTexts = async (page: Page, widgetId: string) => (
  page.evaluate((currentWidgetId) => {
    const configs = JSON.parse(localStorage.getItem('boxento-widget-configs') || '{}');
    return (configs[currentWidgetId]?.items ?? []).map((item: { text: string }) => item.text);
  }, widgetId)
);

const findTodoRow = (widget: Locator, text: string) => (
  widget.locator('li').filter({ hasText: text }).first()
);

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

test('adds, edits, reorders, and deletes todo items in the app layout', async ({ page }) => {
  const taskToAdd = 'Call supplier';
  const taskToEdit = 'Review PR';
  const editedTaskText = 'Review release PR';
  const taskToDelete = 'Plan trip';
  const reorderedTaskTexts = [taskToAdd, 'Pay rent', editedTaskText];

  await page.setViewportSize({ width: 1440, height: 960 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'todo-app',
        type: 'todo',
        config: {
          title: 'Operations Todo',
          items: [
            { id: 'todo-1', text: 'Pay rent', completed: false, createdAt: '2026-03-12T00:00:00.000Z', sortOrder: 0 },
            { id: 'todo-2', text: 'Review PR', completed: false, createdAt: '2026-03-12T00:01:00.000Z', sortOrder: 1 },
            { id: 'todo-3', text: 'Plan trip', completed: false, createdAt: '2026-03-12T00:02:00.000Z', sortOrder: 2 },
          ],
          showCompletedItems: true,
          sortOrder: 'manual',
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'todo-app', x: 0, y: 0, w: 6, h: 6, minW: 2, minH: 2 },
      ],
    },
  });

  const widget = page.locator('.react-grid-item[data-widget-id="todo-app"]');
  await expect(widget).toBeVisible();
  await expect(widget.getByRole('heading', { name: 'Operations Todo' })).toBeVisible();

  const composer = widget.getByRole('textbox', { name: 'New task' });
  await composer.fill(taskToAdd);
  await widget.getByRole('button', { name: 'Add' }).click();
  await expect(widget).toContainText(taskToAdd);

  const reviewRow = findTodoRow(widget, taskToEdit);
  await reviewRow.hover();
  await reviewRow.getByRole('button', { name: 'Edit task' }).click();

  const reviewEditor = widget.locator('li').getByRole('textbox').first();
  await reviewEditor.fill(editedTaskText);
  await reviewEditor.press('Enter');
  await expect(widget).toContainText(editedTaskText);

  const sourceRow = findTodoRow(widget, taskToAdd);
  const targetRow = findTodoRow(widget, 'Pay rent');
  await sourceRow.dragTo(targetRow, {
    targetPosition: { x: 24, y: 6 },
  });

  const deleteRow = findTodoRow(widget, taskToDelete);
  await deleteRow.hover();
  await deleteRow.getByRole('button', { name: 'Delete task' }).click();
  await expect(widget).not.toContainText(taskToDelete);

  await expect.poll(async () => readStoredTodoTexts(page, 'todo-app')).toEqual(reorderedTaskTexts);

  await page.reload();
  await expect(widget.getByRole('heading', { name: 'Operations Todo' })).toBeVisible();
  await expect(widget).toContainText(taskToAdd);
  await expect(widget).toContainText(editedTaskText);
  await expect(widget).not.toContainText(taskToDelete);
});
