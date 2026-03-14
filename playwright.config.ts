import { defineConfig } from '@playwright/test';

const reuseExistingServer = process.env.PLAYWRIGHT_USE_EXISTING_SERVER === '1';
// Keep each workspace on its own port range and vary by process so stale local
// dev servers do not block repeated Playwright runs in parallel workspaces.
const workspacePortSeed = Array.from(process.cwd()).reduce(
  (hash, character) => (hash * 31 + character.charCodeAt(0)) % 1000,
  0
);
const defaultPlaywrightPort = 45000 + ((workspacePortSeed + process.pid) % 10000);
const playwrightPort = Number(process.env.PLAYWRIGHT_PORT || defaultPlaywrightPort);
const baseURL = `http://127.0.0.1:${playwrightPort}`;
const playwrightChannel = process.env.PLAYWRIGHT_CHANNEL;
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
    ...(playwrightExtraArgs.length ? { launchOptions: { args: playwrightExtraArgs } } : {}),
    trace: 'on-first-retry',
  },
  webServer: reuseExistingServer ? undefined : {
    command: `bunx --bun vite --host 127.0.0.1 --port ${playwrightPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  workers: process.env.CI ? 1 : undefined,
});
