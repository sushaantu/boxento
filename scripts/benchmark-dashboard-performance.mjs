import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { chromium } from 'playwright';

const BREAKPOINTS = ['xxxl', 'xxl', 'xl', 'lg', 'md', 'sm', 'xs', 'xxs'];
const COLS = {
  xxxl: 24,
  xxl: 18,
  xl: 14,
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
};

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  })
);

const counts = (args.counts || '100,500,1000,2000')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);
const widgetType = args.widget || 'notes';
const shouldBuild = args.build !== 'false' && !args['base-url'];
const shouldMeasureAdd = args['add-widget'] !== 'false';
const viewportWidth = Number(args.width || 1440);
const viewportHeight = Number(args.height || 900);

const formatMs = (value) => value === null || value === undefined ? '-' : `${Math.round(value)}ms`;
const formatMb = (bytes) => bytes === null || bytes === undefined ? '-' : `${Math.round(bytes / 1024 / 1024)}MB`;
const formatKb = (bytes) => `${Math.round(bytes / 1024)}KB`;

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: options.stdio || 'inherit',
      env: { ...process.env, ...options.env },
      shell: process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${commandArgs.join(' ')} exited with ${code}`));
      }
    });
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the preview server is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function createLayouts(count) {
  const layouts = {};

  for (const breakpoint of BREAKPOINTS) {
    const columnCount = COLS[breakpoint];
    const isMobile = breakpoint === 'xs' || breakpoint === 'xxs';
    const width = isMobile ? 2 : 3;
    const height = isMobile ? 2 : 3;
    const perRow = Math.max(1, Math.floor(columnCount / width));

    layouts[breakpoint] = Array.from({ length: count }, (_, index) => ({
      i: `${widgetType}-${index}`,
      x: (index % perRow) * width,
      y: Math.floor(index / perRow) * height,
      w: width,
      h: height,
      minW: 1,
      minH: 1,
    }));
  }

  return layouts;
}

function createWidgets(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${widgetType}-${index}`,
    type: widgetType,
    config: {
      title: `Benchmark ${index}`,
      content: 'Benchmark fixture',
    },
  }));
}

async function seedDashboard(page, count) {
  const widgets = createWidgets(count);
  const layouts = createLayouts(count);
  const storageBytes = Buffer.byteLength(JSON.stringify({ widgets, layouts }));

  await page.evaluate(({ seededWidgets, seededLayouts }) => {
    localStorage.clear();
    localStorage.setItem('theme', 'light');
    localStorage.setItem('boxento-current-dashboard', 'personal');
    localStorage.setItem('boxento-dashboards', JSON.stringify([
      {
        id: 'personal',
        name: 'Personal',
        visibility: 'private',
        sharedWith: [],
        isDefault: true,
        createdAt: '2026-05-22T00:00:00.000Z',
      },
    ]));
    localStorage.setItem('boxento-widgets-personal', JSON.stringify(seededWidgets));
    localStorage.setItem('boxento-layouts-personal', JSON.stringify(seededLayouts));
    localStorage.setItem('boxento-widgets', JSON.stringify(seededWidgets));
    localStorage.setItem('boxento-layouts', JSON.stringify(seededLayouts));
    localStorage.setItem('boxento-widget-configs', JSON.stringify({}));
  }, {
    seededWidgets: widgets,
    seededLayouts: layouts,
  });

  return storageBytes;
}

async function waitForDashboardReady(page, count) {
  await page.waitForFunction((expectedCount) => {
    const appWidgets = document.querySelectorAll('.app-widget').length;
    const layoutLoading = Boolean(document.querySelector('.layout-loading'));
    return appWidgets === expectedCount && !layoutLoading;
  }, count, { timeout: 90_000 });
}

async function collectStats(page) {
  return page.evaluate(() => ({
    nodeCount: document.getElementsByTagName('*').length,
    appWidgetCount: document.querySelectorAll('.app-widget').length,
    widgetContainerCount: document.querySelectorAll('.widget-container').length,
    deferredPlaceholderCount: document.querySelectorAll('[data-deferred-widget-placeholder]').length,
    gridItemCount: document.querySelectorAll('.react-grid-item').length,
    heapBytes: performance.memory ? performance.memory.usedJSHeapSize : null,
  }));
}

async function measureAddWidget(page, expectedCount) {
  await page.evaluate(() => {
    window.__boxentoStorageStats = { get: 0, set: 0, bytes: 0 };
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function getItemWithStats(key) {
      window.__boxentoStorageStats.get += 1;
      return originalGetItem.call(this, key);
    };
    Storage.prototype.setItem = function setItemWithStats(key, value) {
      window.__boxentoStorageStats.set += 1;
      window.__boxentoStorageStats.bytes += String(value).length;
      return originalSetItem.call(this, key, value);
    };
  });

  const start = performance.now();
  await page.getByRole('button', { name: 'Add widget' }).click();
  await page.getByRole('button', { name: 'Add Notes widget' }).click();
  await page.waitForFunction((count) => document.querySelectorAll('.app-widget').length === count, expectedCount, {
    timeout: 90_000,
  });
  const addWidgetMs = performance.now() - start;

  const storageStats = await page.evaluate(() => window.__boxentoStorageStats);
  return { addWidgetMs, storageStats };
}

function findChromeExecutable() {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  }

  const candidates = process.platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/microsoft-edge',
      ];

  return candidates.find((candidate) => existsSync(candidate));
}

async function launchBrowser() {
  const executablePath = findChromeExecutable();

  try {
    return await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ['--disable-extensions', '--no-first-run'],
    });
  } catch (error) {
    throw new Error([
      'Unable to launch Chromium for the benchmark.',
      executablePath ? `Tried executable: ${executablePath}` : 'No system Chrome/Chromium executable was found.',
      'Install Playwright browsers with: npx playwright install chromium',
      `Original error: ${error instanceof Error ? error.message : String(error)}`,
    ].join('\n'));
  }
}

function printResults(results) {
  console.log('\nDashboard performance results');
  console.log(`Widget type: ${widgetType}`);
  console.table(results.map((result) => ({
    widgets: result.count,
    storage: formatKb(result.storageBytes),
    ready: formatMs(result.readyMs),
    add: formatMs(result.addWidgetMs),
    nodes: result.nodeCount,
    mounted: result.widgetContainerCount,
    deferred: result.deferredPlaceholderCount,
    heap: formatMb(result.heapBytes),
    storageGets: result.storageStats?.get ?? '-',
    storageSets: result.storageStats?.set ?? '-',
  })));
  console.log('\nTargets: 1,000 saved widgets usable <2s; add widget <300ms; no single storage/layout task >100ms.');
}

async function main() {
  if (!counts.length) {
    throw new Error('Provide at least one positive count, for example --counts=100,500,1000');
  }

  let baseUrl = args['base-url'];
  let previewProcess;
  let outputDir;

  if (!baseUrl) {
    outputDir = path.join(await mkdtemp(path.join(tmpdir(), 'boxento-dashboard-perf-')), 'dist');

    if (shouldBuild) {
      await run('bunx', ['--bun', 'vite', 'build', '--outDir', outputDir, '--emptyOutDir']);
    }

    const port = Number(args.port || await getFreePort());
    baseUrl = `http://127.0.0.1:${port}/`;
    previewProcess = spawn('bunx', [
      '--bun',
      'vite',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
      '--outDir',
      outputDir,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    await waitForUrl(baseUrl);
  }

  const browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
    },
  });
  page.setDefaultTimeout(90_000);

  const results = [];

  for (const count of counts) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const storageBytes = await seedDashboard(page, count);
    const start = performance.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForDashboardReady(page, count);
    const readyMs = performance.now() - start;
    await page.waitForTimeout(250);
    const stats = await collectStats(page);
    const addStats = shouldMeasureAdd
      ? await measureAddWidget(page, count + 1)
      : { addWidgetMs: null, storageStats: null };

    results.push({
      count,
      storageBytes,
      readyMs,
      addWidgetMs: addStats.addWidgetMs,
      storageStats: addStats.storageStats,
      ...stats,
    });
  }

  await browser.close();

  if (previewProcess) {
    previewProcess.kill();
  }

  if (outputDir && args.keep !== 'true') {
    rmSync(path.dirname(outputDir), { recursive: true, force: true });
  }

  printResults(results);

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
