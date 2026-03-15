import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { resolve } from 'node:path';

const workspaceSeed = Array.from(process.cwd()).reduce(
  (hash, character) => (hash * 31 + character.charCodeAt(0)) % 10000,
  0
);

const usedPorts = new Set();

try {
  const output = execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  for (const line of output.split('\n')) {
    const match = line.match(/:(\d+)\s+\(LISTEN\)$/);
    if (match) {
      usedPorts.add(Number(match[1]));
    }
  }
} catch {
  // Fall back to the seeded default if lsof is unavailable in the environment.
}

const preferredPort = 45000 + workspaceSeed;
const fallbackRange = 400;
const reuseExistingServer = process.env.PLAYWRIGHT_USE_EXISTING_SERVER === '1';
const skipEnvironmentCheck = process.env.PLAYWRIGHT_SKIP_ENV_CHECK === '1';
const playwrightExtraArgs = (process.env.PLAYWRIGHT_EXTRA_ARGS || '')
  .split(',')
  .map((arg) => arg.trim())
  .filter(Boolean);

const selectPort = () => {
  const overriddenPort = Number(process.env.PLAYWRIGHT_PORT);

  if (Number.isInteger(overriddenPort) && overriddenPort > 0) {
    return overriddenPort;
  }

  for (let offset = 0; offset < fallbackRange; offset += 1) {
    const candidate = 45000 + ((workspaceSeed + offset) % 10000);
    if (!usedPorts.has(candidate)) {
      return candidate;
    }
  }

  return preferredPort;
};

const readConnectEndpoint = () => {
  if (process.env.PLAYWRIGHT_CONNECT_WS_ENDPOINT) {
    return process.env.PLAYWRIGHT_CONNECT_WS_ENDPOINT;
  }

  const endpointFile = process.env.PLAYWRIGHT_CONNECT_WS_ENDPOINT_FILE;

  if (!endpointFile) {
    return undefined;
  }

  const resolvedEndpointFile = resolve(endpointFile);

  try {
    const endpoint = readFileSync(resolvedEndpointFile, 'utf8').trim();

    if (!endpoint) {
      throw new Error('is empty');
    }

    return endpoint;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to read PLAYWRIGHT_CONNECT_WS_ENDPOINT_FILE at ${resolvedEndpointFile}: ${reason}.`
    );
  }
};

const parseConnectEndpoint = (connectEndpoint) => {
  try {
    const url = new URL(connectEndpoint);

    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      return null;
    }

    return {
      endpoint: connectEndpoint,
      host: url.hostname,
      port: Number(url.port || (url.protocol === 'wss:' ? 443 : 80)),
    };
  } catch {
    return null;
  }
};

const listenOnLoopback = () => new Promise((resolveListen, rejectListen) => {
  const server = createServer();

  server.once('error', rejectListen);
  server.listen(0, '127.0.0.1', () => {
    server.close((closeError) => {
      if (closeError) {
        rejectListen(closeError);
        return;
      }

      resolveListen();
    });
  });
});

const connectToTcpEndpoint = ({ host, port }) => new Promise((resolveConnect, rejectConnect) => {
  const socket = createConnection({ host, port });

  const settle = (error) => {
    socket.removeAllListeners();
    socket.destroy();

    if (error) {
      rejectConnect(error);
      return;
    }

    resolveConnect();
  };

  socket.setTimeout(3_000, () => {
    const timeoutError = new Error(`Timed out connecting to ${host}:${port}.`);
    timeoutError.code = 'ETIMEDOUT';
    settle(timeoutError);
  });
  socket.once('connect', () => {
    settle();
  });
  socket.once('error', (error) => {
    settle(error);
  });
});

const loadPlaywright = async () => {
  try {
    return await import('@playwright/test');
  } catch (error) {
    if (
      error instanceof Error
      && ('code' in error ? error.code === 'ERR_MODULE_NOT_FOUND' : false)
    ) {
      return null;
    }

    throw error;
  }
};

const formatPreflightFailure = (title, detail, nextSteps) => [
  `${title}`,
  '',
  detail,
  '',
  'Next steps:',
  ...nextSteps.map((step) => `- ${step}`),
].join('\n');

const isLoopbackHost = (host) => (
  host === '127.0.0.1'
  || host === 'localhost'
  || host === '::1'
);

const probeLocalBrowserLaunch = async (playwright) => {
  const browserType = playwright.chromium;
  const headedMode = process.argv.includes('--headed');
  const browser = await browserType.launch({
    headless: !headedMode && process.env.PLAYWRIGHT_HEADLESS !== '0',
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
    ...(playwrightExtraArgs.length ? { args: playwrightExtraArgs } : {}),
  });

  await browser.close();
};

const assertPlaywrightEnvironment = async (playwrightBaseURL, connectEndpoint) => {
  if (skipEnvironmentCheck) {
    return;
  }

  const shouldStartWebServer = !reuseExistingServer && !playwrightBaseURL.startsWith('file://');

  if (shouldStartWebServer) {
    try {
      await listenOnLoopback();
    } catch (error) {
      const detail = error instanceof Error
        ? `This session cannot bind a loopback web server for Playwright (${error.message}).`
        : `This session cannot bind a loopback web server for Playwright (${String(error)}).`;
      throw new Error(formatPreflightFailure(
        'Playwright E2E preflight failed.',
        detail,
        [
          'Run against an existing server or static build with PLAYWRIGHT_USE_EXISTING_SERVER=1.',
          'Use PLAYWRIGHT_BASE_URL=file:///absolute/path/to/dist/ to avoid localhost entirely.',
          'See docs/E2E_SANDBOX.md for the current environment requirements.',
        ]
      ));
    }
  }

  if (connectEndpoint) {
    const connectTarget = parseConnectEndpoint(connectEndpoint);

    if (connectTarget) {
      try {
        await connectToTcpEndpoint(connectTarget);
      } catch (error) {
        const errorCode = error instanceof Error && 'code' in error ? error.code : undefined;
        const reason = error instanceof Error ? error.message : String(error);
        const loopbackNote = isLoopbackHost(connectTarget.host)
          ? ' On this machine\'s current Codex/macOS sandbox, loopback websocket connections also fail with EPERM, so a browser server bound only to localhost is not a viable workaround.'
          : '';

        throw new Error(formatPreflightFailure(
          'Playwright E2E preflight failed.',
          `This session cannot reach the configured Playwright browser endpoint at ${connectTarget.endpoint} (${reason}).${loopbackNote}`,
          [
            errorCode === 'EPERM'
              ? 'Use a less restrictive session that allows outbound TCP connections, or run the full browser suite outside the sandbox.'
              : 'Ensure the browser server is already listening on the configured host and port.',
            isLoopbackHost(connectTarget.host)
              ? 'If you keep using browserType.connect, expose the browser server on a non-loopback address that this session can reach.'
              : 'If the endpoint host is correct but still blocked, this sandbox profile needs to allow outbound socket connections.',
            'See docs/E2E_SANDBOX.md for the current environment requirements.',
          ]
        ));
      }
    }

    return;
  }

  const playwright = await loadPlaywright();

  if (!playwright) {
    return;
  }

  try {
    await probeLocalBrowserLaunch(playwright);
  } catch (error) {
    const detail = error instanceof Error
      ? `Local browser launch failed during preflight. In this macOS Codex sandbox that usually surfaces later as SIGABRT/SIGTRAP before Playwright creates a context.\n\n${error.message}`
      : `Local browser launch failed during preflight: ${String(error)}`;
    throw new Error(formatPreflightFailure(
      'Playwright E2E preflight failed.',
      detail,
      [
        'Start a Playwright browser server outside the sandbox and set PLAYWRIGHT_CONNECT_WS_ENDPOINT or PLAYWRIGHT_CONNECT_WS_ENDPOINT_FILE.',
        'Or run the full E2E command outside the sandbox.',
        'See docs/E2E_SANDBOX.md for examples.',
      ]
    ));
  }
};

const playwrightPort = selectPort();
const playwrightBaseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${playwrightPort}`;

try {
  const connectEndpoint = readConnectEndpoint();

  await assertPlaywrightEnvironment(playwrightBaseURL, connectEndpoint);

  const child = spawn(
    'npx',
    ['--no-install', 'playwright', 'test', ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_PORT: String(playwrightPort),
        ...(connectEndpoint ? { PLAYWRIGHT_CONNECT_WS_ENDPOINT: connectEndpoint } : {}),
      },
      shell: process.platform === 'win32',
    }
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
