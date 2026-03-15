import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const browserName = process.env.PLAYWRIGHT_BROWSER || 'chromium';
const playwrightChannel = process.env.PLAYWRIGHT_CHANNEL;
const playwrightExecutablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const playwrightServerHost = process.env.PLAYWRIGHT_SERVER_HOST || '127.0.0.1';
const playwrightServerPort = Number(process.env.PLAYWRIGHT_SERVER_PORT || 0);
const endpointFile = process.env.PLAYWRIGHT_WS_ENDPOINT_FILE;
const playwrightExtraArgs = (process.env.PLAYWRIGHT_EXTRA_ARGS || '')
  .split(',')
  .map((arg) => arg.trim())
  .filter(Boolean);

const loadPlaywright = async () => {
  try {
    return await import('@playwright/test');
  } catch (error) {
    if (
      error instanceof Error
      && ('code' in error ? error.code === 'ERR_MODULE_NOT_FOUND' : false)
    ) {
      console.error('Unable to import @playwright/test. Install project dependencies before starting a browser server.');
      process.exit(1);
    }

    throw error;
  }
};

const selectBrowserType = (playwright) => {
  switch (browserName) {
    case 'chromium':
      return playwright.chromium;
    case 'firefox':
      return playwright.firefox;
    case 'webkit':
      return playwright.webkit;
    default:
      throw new Error(`Unsupported PLAYWRIGHT_BROWSER "${browserName}". Expected chromium, firefox, or webkit.`);
  }
};

const persistEndpoint = async (wsEndpoint) => {
  if (!endpointFile) {
    return undefined;
  }

  const resolvedEndpointFile = resolve(endpointFile);
  await mkdir(dirname(resolvedEndpointFile), { recursive: true });
  await writeFile(resolvedEndpointFile, `${wsEndpoint}\n`, 'utf8');
  return resolvedEndpointFile;
};

const registerShutdown = (browserServer) => {
  let shuttingDown = false;

  const closeServer = async (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    try {
      await browserServer.close();
    } finally {
      process.exit(signal ? 0 : 1);
    }
  };

  process.on('SIGINT', () => {
    void closeServer('SIGINT');
  });
  process.on('SIGTERM', () => {
    void closeServer('SIGTERM');
  });

  browserServer.on('close', () => {
    if (!shuttingDown) {
      process.exit(0);
    }
  });
};

const playwright = await loadPlaywright();
const browserType = selectBrowserType(playwright);
const browserServer = await browserType.launchServer({
  headless: process.env.PLAYWRIGHT_HEADLESS !== '0',
  ...(browserName === 'chromium' && playwrightChannel ? { channel: playwrightChannel } : {}),
  ...(playwrightExecutablePath ? { executablePath: playwrightExecutablePath } : {}),
  ...(playwrightExtraArgs.length ? { args: playwrightExtraArgs } : {}),
  host: playwrightServerHost,
  ...(playwrightServerPort > 0 ? { port: playwrightServerPort } : {}),
});
const wsEndpoint = browserServer.wsEndpoint();
const resolvedEndpointFile = await persistEndpoint(wsEndpoint);

registerShutdown(browserServer);

console.log(`Playwright browser server is ready for ${browserName}.`);
console.log(`WS endpoint: ${wsEndpoint}`);

if (resolvedEndpointFile) {
  console.log(`Endpoint file: ${resolvedEndpointFile}`);
}

console.log('Keep this process running while the sandboxed test runner connects to it.');
