import { defineConfig } from '@playwright/test';

const reuseExistingServer = process.env.PLAYWRIGHT_USE_EXISTING_SERVER === '1';
const playwrightPort = Number(process.env.PLAYWRIGHT_PORT || 4417);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${playwrightPort}`;
const shouldStartWebServer = !reuseExistingServer && !baseURL.startsWith('file://');
const playwrightChannel = process.env.PLAYWRIGHT_CHANNEL;
const playwrightExecutablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const playwrightExtraArgs = (process.env.PLAYWRIGHT_EXTRA_ARGS || '')
  .split(',')
  .map((arg) => arg.trim())
  .filter(Boolean);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL,
    ...(playwrightChannel ? { channel: playwrightChannel } : {}),
    ...((playwrightExecutablePath || playwrightExtraArgs.length)
      ? {
          launchOptions: {
            ...(playwrightExecutablePath ? { executablePath: playwrightExecutablePath } : {}),
            ...(playwrightExtraArgs.length ? { args: playwrightExtraArgs } : {}),
          },
        }
      : {}),
    trace: 'on-first-retry',
  },
  webServer: shouldStartWebServer ? {
    command: `bunx --bun vite --host 127.0.0.1 --port ${playwrightPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  } : undefined,
  workers: process.env.CI ? 1 : undefined,
});
