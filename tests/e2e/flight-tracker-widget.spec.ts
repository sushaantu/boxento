import { expect, test } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

const FLIGHT_TRACKER_WIDGET = {
  id: 'flight-tracker-1',
  type: 'flight-tracker',
  config: {
    title: 'Flight Tracker',
    trackedFlights: [],
  },
};

const FLIGHT_TRACKER_LAYOUT = {
  lg: [
    { i: 'flight-tracker-1', x: 0, y: 0, w: 4, h: 3, minW: 1, minH: 1 },
  ],
};

test('shows setup guidance when the flight data proxy is not configured', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/api/flights', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Failed to fetch flight data',
        message: 'API key not configured',
      }),
    });
  });

  await seedDashboard(page, {
    widgets: [FLIGHT_TRACKER_WIDGET],
    layouts: FLIGHT_TRACKER_LAYOUT,
  });

  const widget = page.locator('.react-grid-item[data-widget-id="flight-tracker-1"]');
  await expect(widget).toContainText('Finish flight data setup first');
  await expect(
    widget.getByRole('button', { name: 'View Setup Requirements' })
  ).toBeVisible();
  await widget.screenshot({
    path: 'output/playwright/flight-tracker-setup-after-unconfigured.png',
  });

  await widget.getByRole('button', { name: 'View Setup Requirements' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Flight data setup required');
  await expect(dialog.getByRole('button', { name: 'Add Flight' })).toBeDisabled();
});

test('keeps the add-flight onboarding path for configured widgets without flights', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/api/flights', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Flight number is required',
      }),
    });
  });

  await seedDashboard(page, {
    widgets: [FLIGHT_TRACKER_WIDGET],
    layouts: FLIGHT_TRACKER_LAYOUT,
  });

  const widget = page.locator('.react-grid-item[data-widget-id="flight-tracker-1"]');
  await expect(widget).toContainText('No flights tracked yet');
  await expect(widget.getByRole('button', { name: 'Add Flight' })).toBeVisible();
  await widget.screenshot({
    path: 'output/playwright/flight-tracker-setup-after-configured.png',
  });

  await widget.getByRole('button', { name: 'Add Flight' }).click();

  const dialog = page.getByRole('dialog');
  const flightNumberInput = dialog.getByPlaceholder('e.g. AA100, LA621');
  await expect(flightNumberInput).toBeEnabled();
  await flightNumberInput.fill('LA621');
  await expect(dialog.getByRole('button', { name: 'Add Flight' })).toBeEnabled();
});

test('shows a retry state when setup status cannot be checked', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/api/flights', async (route) => {
    await route.abort('failed');
  });

  await seedDashboard(page, {
    widgets: [FLIGHT_TRACKER_WIDGET],
    layouts: FLIGHT_TRACKER_LAYOUT,
  });

  const widget = page.locator('.react-grid-item[data-widget-id="flight-tracker-1"]');
  await expect(widget).toContainText("Couldn't verify flight data setup");
  await expect(widget.getByRole('button', { name: 'Retry Check' })).toBeVisible();

  await widget.getByRole('button', { name: 'Open Settings' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Setup status unavailable');
  await expect(dialog.getByPlaceholder('e.g. AA100, LA621')).toBeDisabled();
});
