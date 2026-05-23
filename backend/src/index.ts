import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { getDatabase, closeDatabase } from './db/connection.js';

// Database row types for type safety
interface DashboardRow {
  id: string;
  name: string;
  visibility: 'private' | 'public' | 'team';
  shared_with: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

interface LayoutRow {
  dashboard_id: string;
  breakpoint: string;
  layout_data: string;
  updated_at: string;
}

interface WidgetRow {
  id: string;
  dashboard_id: string;
  type: string;
  sort_order: number;
  created_at: string;
}

interface WidgetConfigRow {
  widget_id: string;
  config_data: string;
  updated_at: string;
}

interface AppSettingsRow {
  id: string;
  settings_data: string;
  updated_at: string;
}

// Input types for API requests
interface WidgetInput {
  id: string;
  type: string;
}

interface KumaStatusPageConfig {
  slug: string;
  title: string;
}

interface KumaStatusPageMonitor {
  id: number;
  name: string;
  type: string;
}

interface KumaStatusPageGroup {
  id: number;
  name: string;
  monitorList: KumaStatusPageMonitor[];
}

interface KumaStatusPageResponse {
  config: KumaStatusPageConfig;
  publicGroupList: KumaStatusPageGroup[];
}

interface KumaHeartbeat {
  status: number;
  time: string;
  msg: string;
  ping: number | null;
}

interface KumaHeartbeatResponse {
  heartbeatList: Record<string, KumaHeartbeat[]>;
  uptimeList: Record<string, number>;
}

interface HealthchecksApiCheck {
  name: string;
  slug: string;
  tags: string;
  desc: string;
  status: string;
  started: boolean;
  last_ping: string | null;
  next_ping: string | null;
  last_duration?: number;
  grace: number;
  timeout: number;
}

interface HealthchecksApiResponse {
  checks: HealthchecksApiCheck[];
}

interface KumaRequestBody {
  statusPageUrl?: string;
}

interface HealthchecksRequestBody {
  baseUrl?: string;
  apiKey?: string;
}

interface TailscaleServeHandler {
  Proxy?: string;
  Text?: string;
  Path?: string;
}

interface TailscaleServeWebHost {
  Handlers?: Record<string, TailscaleServeHandler>;
}

interface TailscaleServeTcpConfig {
  HTTP?: boolean;
  HTTPS?: boolean;
  TCP?: boolean;
  ['TLS-terminated TCP']?: boolean;
}

interface TailscaleServeStatus {
  TCP?: Record<string, TailscaleServeTcpConfig>;
  Web?: Record<string, TailscaleServeWebHost>;
}

interface NormalizedTailscaleServeRoute {
  id: string;
  host: string;
  hostPort: string;
  port: number | null;
  path: string;
  protocol: 'http' | 'https' | 'tcp';
  publicUrl: string;
  target: string;
  targetHost: string | null;
  targetPort: number | null;
  targetProtocol: string | null;
  targetType: 'local' | 'lan' | 'tailnet' | 'orb' | 'remote' | 'text' | 'unknown';
}

const app = new Hono();

class BadRequestError extends Error {}
class ServiceUnavailableError extends Error {}

const execFileAsync = promisify(execFile);

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const parseOptionalJsonBody = async <T>(c: Context): Promise<T> => {
  const rawBody = await c.req.text();

  if (!rawBody.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new BadRequestError('Malformed JSON request body');
  }
};

const normalizeHttpUrl = (value: string, label: string): string => {
  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error();
    }
    return parsed.href.replace(/\/$/, '');
  } catch {
    throw new BadRequestError(`Invalid ${label}`);
  }
};

const parseKumaStatusPageUrl = (statusPageUrl: string): { baseUrl: string; slug: string; dashboardUrl: string } => {
  const normalizedUrl = normalizeHttpUrl(statusPageUrl, 'Uptime Kuma status page URL');
  const parsed = new URL(normalizedUrl);
  const segments = parsed.pathname.split('/').filter(Boolean);
  const statusIndex = segments.findIndex((segment) => segment === 'status');
  const slug = statusIndex >= 0 ? segments[statusIndex + 1] : '';

  if (!slug) {
    throw new BadRequestError('Expected a Uptime Kuma status page URL like https://kuma.example.com/status/your-page');
  }

  const basePath = segments.slice(0, statusIndex).join('/');

  return {
    baseUrl: `${parsed.origin}${basePath ? `/${basePath}` : ''}`,
    slug,
    dashboardUrl: normalizedUrl,
  };
};

const parseMaybePrivateIp = (hostname: string): boolean => {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const [a, b] = match.slice(1).map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

const parseHostPort = (hostPort: string): { host: string; port: number | null } => {
  const bracketedIpv6 = hostPort.match(/^\[([^\]]+)]:(\d+)$/);
  if (bracketedIpv6) {
    return {
      host: bracketedIpv6[1],
      port: Number(bracketedIpv6[2]),
    };
  }

  const colonCount = (hostPort.match(/:/g) ?? []).length;
  if (colonCount === 1) {
    const lastColonIndex = hostPort.lastIndexOf(':');
    const possiblePort = Number(hostPort.slice(lastColonIndex + 1));
    if (Number.isFinite(possiblePort)) {
      return {
        host: hostPort.slice(0, lastColonIndex),
        port: possiblePort,
      };
    }
  }

  try {
    const parsed = new URL(`https://${hostPort}`);
    const port = parsed.port ? Number(parsed.port) : null;
    return {
      host: parsed.hostname,
      port: Number.isFinite(port) ? port : null,
    };
  } catch {
    return { host: hostPort, port: null };
  }
};

const normalizeServePath = (path: string): string => {
  if (!path || path === '/') return '/';
  const prefixed = path.startsWith('/') ? path : `/${path}`;
  return prefixed.endsWith('/') ? prefixed.slice(0, -1) : prefixed;
};

const classifyTarget = (target: string): Pick<NormalizedTailscaleServeRoute, 'targetHost' | 'targetPort' | 'targetProtocol' | 'targetType'> => {
  if (!target) {
    return {
      targetHost: null,
      targetPort: null,
      targetProtocol: null,
      targetType: 'unknown',
    };
  }

  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    return {
      targetHost: null,
      targetPort: null,
      targetProtocol: null,
      targetType: target.startsWith('text:') ? 'text' : 'unknown',
    };
  }

  try {
    const parsed = new URL(target);
    const hostname = parsed.hostname;
    const port = parsed.port ? Number(parsed.port) : null;
    const targetType: NormalizedTailscaleServeRoute['targetType'] =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
        ? 'local'
        : hostname.endsWith('.orb.local')
          ? 'orb'
          : hostname.endsWith('.ts.net')
            ? 'tailnet'
            : parseMaybePrivateIp(hostname)
              ? 'lan'
              : 'remote';

    return {
      targetHost: hostname,
      targetPort: Number.isFinite(port) ? port : null,
      targetProtocol: parsed.protocol.replace(':', ''),
      targetType,
    };
  } catch {
    return {
      targetHost: null,
      targetPort: null,
      targetProtocol: null,
      targetType: 'unknown',
    };
  }
};

const normalizeTailscaleServeStatus = (status: TailscaleServeStatus): NormalizedTailscaleServeRoute[] => {
  const webEntries = Object.entries(status.Web ?? {});

  return webEntries.flatMap(([hostPort, hostConfig]) => {
    const { host, port } = parseHostPort(hostPort);
    const tcpConfig = port != null ? status.TCP?.[String(port)] : undefined;
    const protocol: NormalizedTailscaleServeRoute['protocol'] = tcpConfig?.HTTPS
      ? 'https'
      : tcpConfig?.HTTP
        ? 'http'
        : 'tcp';
    const handlers = Object.entries(hostConfig.Handlers ?? {});

    return handlers.map(([handlerPath, handler]) => {
      const path = normalizeServePath(handlerPath);
      const target = handler.Proxy ?? (handler.Text ? 'text:static-response' : handler.Path ?? '');
      const targetDetails = classifyTarget(target);
      const publicUrl = `${protocol === 'tcp' ? 'https' : protocol}://${hostPort}${path === '/' ? '/' : path}`;

      return {
        id: `${hostPort}${path}`,
        host,
        hostPort,
        port,
        path,
        protocol: protocol === 'tcp' ? 'https' : protocol,
        publicUrl,
        target,
        ...targetDetails,
      };
    });
  }).sort((a, b) => {
    const portDiff = (a.port ?? 0) - (b.port ?? 0);
    return portDiff !== 0 ? portDiff : a.publicUrl.localeCompare(b.publicUrl);
  });
};

const getTailscaleServeStatusJson = async (): Promise<TailscaleServeStatus> => {
  const statusUrl = process.env.TAILSCALE_SERVE_STATUS_URL?.trim();
  if (statusUrl) {
    return fetchJson<TailscaleServeStatus>(statusUrl);
  }

  const statusFile = process.env.TAILSCALE_SERVE_STATUS_FILE?.trim();
  if (statusFile) {
    const fileContents = await readFile(statusFile, 'utf8');
    return JSON.parse(fileContents) as TailscaleServeStatus;
  }

  const inlineStatus = process.env.TAILSCALE_SERVE_STATUS_JSON?.trim();
  if (inlineStatus) {
    return JSON.parse(inlineStatus) as TailscaleServeStatus;
  }

  try {
    const cliPath = process.env.TAILSCALE_CLI_PATH?.trim() || 'tailscale';
    const { stdout } = await execFileAsync(cliPath, ['serve', 'status', '--json'], {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    return JSON.parse(stdout) as TailscaleServeStatus;
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
    throw new ServiceUnavailableError(`Tailscale Serve status is not available to the Boxento backend.${detail}`);
  }
};

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// Initialize database on startup
const db = getDatabase();

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/tailscale/serve', async (c) => {
  try {
    const status = await getTailscaleServeStatusJson();
    const routes = normalizeTailscaleServeStatus(status);
    const summary = routes.reduce(
      (acc, route) => {
        acc.total += 1;
        if (route.protocol === 'https') acc.https += 1;
        if (route.protocol === 'http') acc.http += 1;
        if (route.targetType === 'local') acc.local += 1;
        if (route.targetType === 'lan') acc.lan += 1;
        if (route.targetType === 'tailnet') acc.tailnet += 1;
        if (route.targetType === 'orb') acc.orb += 1;
        return acc;
      },
      { total: 0, https: 0, http: 0, local: 0, lan: 0, tailnet: 0, orb: 0 },
    );

    return c.json({
      routes,
      summary,
      source: process.env.TAILSCALE_SERVE_STATUS_URL
        ? 'url'
        : process.env.TAILSCALE_SERVE_STATUS_FILE
          ? 'file'
          : process.env.TAILSCALE_SERVE_STATUS_JSON
            ? 'env'
            : 'cli',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return c.json({
        error: error.message,
        setupHint: 'Run the Boxento backend on a host with the Tailscale CLI, or set TAILSCALE_SERVE_STATUS_URL, TAILSCALE_SERVE_STATUS_FILE, or TAILSCALE_SERVE_STATUS_JSON.',
      }, 503);
    }

    return c.json({
      error: error instanceof Error ? error.message : 'Failed to read Tailscale Serve status',
    }, 502);
  }
});

app.on(['GET', 'POST'], '/api/monitoring/kuma', async (c) => {
  let baseUrl = process.env.UPTIME_KUMA_BASE_URL;
  let slug = process.env.UPTIME_KUMA_STATUS_PAGE_SLUG;
  let dashboardUrl = baseUrl && slug ? `${baseUrl.replace(/\/$/, '')}/status/${slug}` : '';

  try {
    if (c.req.method === 'POST') {
      const body = await parseOptionalJsonBody<KumaRequestBody>(c);
      if (body.statusPageUrl?.trim()) {
        const parsed = parseKumaStatusPageUrl(body.statusPageUrl.trim());
        baseUrl = parsed.baseUrl;
        slug = parsed.slug;
        dashboardUrl = parsed.dashboardUrl;
      }
    }

    if (!baseUrl || !slug) {
      return c.json({ error: 'Kuma monitoring is not configured' }, 503);
    }

    const normalizedBase = baseUrl.replace(/\/$/, '');
    const [statusPage, heartbeats] = await Promise.all([
      fetchJson<KumaStatusPageResponse>(`${normalizedBase}/api/status-page/${slug}`),
      fetchJson<KumaHeartbeatResponse>(`${normalizedBase}/api/status-page/heartbeat/${slug}`),
    ]);

    const monitors = statusPage.publicGroupList.flatMap((group) =>
      group.monitorList.map((monitor) => {
        const history = heartbeats.heartbeatList[String(monitor.id)] ?? [];
        const latest = history.at(-1) ?? null;
        const status = latest?.status === 1
          ? 'up'
          : latest?.status === 0
            ? 'down'
            : latest?.status === 2
              ? 'pending'
              : latest?.status === 3
                ? 'maintenance'
                : 'unknown';

        return {
          id: monitor.id,
          name: monitor.name,
          group: group.name,
          type: monitor.type,
          status,
          ping: latest?.ping ?? null,
          message: latest?.msg || null,
          lastChecked: latest?.time ? new Date(latest.time.replace(' ', 'T') + 'Z').toISOString() : null,
          uptime24: heartbeats.uptimeList[`${monitor.id}_24`] ?? null,
        };
      }),
    );

    const summary = monitors.reduce(
      (acc, monitor) => {
        acc.total += 1;
        if (monitor.status === 'up') acc.up += 1;
        if (monitor.status === 'down') acc.down += 1;
        if (monitor.status === 'pending') acc.pending += 1;
        if (monitor.status === 'maintenance') acc.maintenance += 1;
        return acc;
      },
      { total: 0, up: 0, down: 0, pending: 0, maintenance: 0 },
    );

    return c.json({
      dashboardUrl: dashboardUrl || `${normalizedBase}/status/${slug}`,
      monitors,
      summary,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch Kuma data' }, 502);
  }
});

app.on(['GET', 'POST'], '/api/monitoring/healthchecks', async (c) => {
  let baseUrl = process.env.HEALTHCHECKS_BASE_URL;
  let apiKey = process.env.HEALTHCHECKS_READONLY_API_KEY;

  try {
    if (c.req.method === 'POST') {
      const body = await parseOptionalJsonBody<HealthchecksRequestBody>(c);
      const baseUrlOverride = body.baseUrl?.trim();
      const apiKeyOverride = body.apiKey?.trim();

      if ((baseUrlOverride && !apiKeyOverride) || (!baseUrlOverride && apiKeyOverride)) {
        throw new BadRequestError('Healthchecks URL and read-only API key must be provided together');
      }

      if (baseUrlOverride && apiKeyOverride) {
        baseUrl = normalizeHttpUrl(baseUrlOverride, 'Healthchecks URL');
        apiKey = apiKeyOverride;
      }
    }

    if (!baseUrl || !apiKey) {
      return c.json({ error: 'Healthchecks monitoring is not configured' }, 503);
    }

    const normalizedBase = baseUrl.replace(/\/$/, '');
    const payload = await fetchJson<HealthchecksApiResponse>(`${normalizedBase}/api/v3/checks/`, {
      headers: {
        'X-Api-Key': apiKey,
      },
    });

    const checks = payload.checks.map((check) => ({
      name: check.name,
      slug: check.slug,
      tags: check.tags,
      description: check.desc,
      status: check.status,
      started: check.started,
      lastPing: check.last_ping,
      nextPing: check.next_ping,
      lastDuration: check.last_duration ?? null,
      graceSeconds: check.grace,
      timeoutSeconds: check.timeout,
    }));

    const summary = checks.reduce(
      (acc, check) => {
        acc.total += 1;
        if (check.status === 'up') acc.up += 1;
        if (check.status === 'down') acc.down += 1;
        if (check.status === 'grace') acc.grace += 1;
        if (check.status === 'late') acc.late += 1;
        if (check.status === 'new') acc.new += 1;
        if (check.status === 'paused') acc.paused += 1;
        return acc;
      },
      { total: 0, up: 0, down: 0, grace: 0, late: 0, new: 0, paused: 0 },
    );

    return c.json({
      dashboardUrl: normalizedBase,
      checks,
      summary,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch Healthchecks data' }, 502);
  }
});

// ============ Dashboard Routes ============

// Get all dashboards
app.get('/api/dashboards', (c) => {
  const dashboards = db.prepare(`
    SELECT id, name, visibility, shared_with, is_default, created_at, updated_at
    FROM dashboards
    ORDER BY is_default DESC, created_at ASC
  `).all();

  return c.json((dashboards as DashboardRow[]).map((d) => ({
    ...d,
    sharedWith: d.shared_with ? JSON.parse(d.shared_with) : [],
    isDefault: Boolean(d.is_default),
  })));
});

// Get single dashboard
app.get('/api/dashboards/:id', (c) => {
  const { id } = c.req.param();
  const dashboard = db.prepare(`
    SELECT id, name, visibility, shared_with, is_default, created_at, updated_at
    FROM dashboards WHERE id = ?
  `).get(id) as DashboardRow | undefined;

  if (!dashboard) {
    return c.json({ error: 'Dashboard not found' }, 404);
  }

  return c.json({
    ...dashboard,
    sharedWith: dashboard.shared_with ? JSON.parse(dashboard.shared_with) : [],
    isDefault: Boolean(dashboard.is_default),
  });
});

// Create dashboard
app.post('/api/dashboards', async (c) => {
  const body = await c.req.json();
  const { id, name, visibility = 'private', sharedWith = [] } = body;

  if (!id || !name) {
    return c.json({ error: 'id and name are required' }, 400);
  }

  try {
    db.prepare(`
      INSERT INTO dashboards (id, name, visibility, shared_with)
      VALUES (?, ?, ?, ?)
    `).run(id, name, visibility, JSON.stringify(sharedWith));

    return c.json({ id, name, visibility, sharedWith });
  } catch (err) {
    if (err instanceof Error && (err as Error & { code?: string }).code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return c.json({ error: 'Dashboard already exists' }, 409);
    }
    throw err;
  }
});

// Update dashboard
app.put('/api/dashboards/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const { name, visibility, sharedWith } = body;

  const updates: string[] = [];
  const params: (string | null)[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (visibility !== undefined) {
    updates.push('visibility = ?');
    params.push(visibility);
  }
  if (sharedWith !== undefined) {
    updates.push('shared_with = ?');
    params.push(JSON.stringify(sharedWith));
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  const result = db.prepare(`
    UPDATE dashboards SET ${updates.join(', ')} WHERE id = ?
  `).run(...params);

  if (result.changes === 0) {
    return c.json({ error: 'Dashboard not found' }, 404);
  }

  return c.json({ success: true });
});

// Delete dashboard
app.delete('/api/dashboards/:id', (c) => {
  const { id } = c.req.param();

  // Don't allow deleting the default dashboard
  const dashboard = db.prepare('SELECT is_default FROM dashboards WHERE id = ?').get(id) as Pick<DashboardRow, 'is_default'> | undefined;
  if (dashboard?.is_default) {
    return c.json({ error: 'Cannot delete default dashboard' }, 400);
  }

  const result = db.prepare('DELETE FROM dashboards WHERE id = ?').run(id);

  if (result.changes === 0) {
    return c.json({ error: 'Dashboard not found' }, 404);
  }

  return c.json({ success: true });
});

// ============ Layout Routes ============

// Get all layouts for a dashboard
app.get('/api/dashboards/:id/layouts', (c) => {
  const { id } = c.req.param();

  const layouts = db.prepare(`
    SELECT breakpoint, layout_data FROM layouts WHERE dashboard_id = ?
  `).all(id) as Pick<LayoutRow, 'breakpoint' | 'layout_data'>[];

  const result: Record<string, unknown[]> = {};
  for (const layout of layouts) {
    result[layout.breakpoint] = JSON.parse(layout.layout_data);
  }

  return c.json(result);
});

// Save all layouts for a dashboard
app.put('/api/dashboards/:id/layouts', async (c) => {
  const { id } = c.req.param();
  const layouts = await c.req.json();

  // Ensure dashboard exists
  const dashboard = db.prepare('SELECT id FROM dashboards WHERE id = ?').get(id);
  if (!dashboard) {
    // Auto-create dashboard if it doesn't exist
    db.prepare(`
      INSERT INTO dashboards (id, name, visibility)
      VALUES (?, ?, ?)
    `).run(id, id, 'private');
  }

  const upsert = db.prepare(`
    INSERT INTO layouts (dashboard_id, breakpoint, layout_data, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(dashboard_id, breakpoint) DO UPDATE SET
      layout_data = excluded.layout_data,
      updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = db.transaction(() => {
    for (const [breakpoint, layoutData] of Object.entries(layouts)) {
      upsert.run(id, breakpoint, JSON.stringify(layoutData));
    }
  });

  transaction();

  return c.json({ success: true });
});

// ============ Widget Routes ============

// Get widgets for a dashboard
app.get('/api/dashboards/:id/widgets', (c) => {
  const { id } = c.req.param();

  const widgets = db.prepare(`
    SELECT id, type, sort_order FROM widgets
    WHERE dashboard_id = ?
    ORDER BY sort_order ASC
  `).all(id) as Pick<WidgetRow, 'id' | 'type' | 'sort_order'>[];

  return c.json(widgets.map(w => ({ id: w.id, type: w.type })));
});

// Save widgets for a dashboard (replace all)
app.put('/api/dashboards/:id/widgets', async (c) => {
  const { id } = c.req.param();
  const widgets = await c.req.json();

  // Ensure dashboard exists
  const dashboard = db.prepare('SELECT id FROM dashboards WHERE id = ?').get(id);
  if (!dashboard) {
    db.prepare(`
      INSERT INTO dashboards (id, name, visibility)
      VALUES (?, ?, ?)
    `).run(id, id, 'private');
  }

  const transaction = db.transaction(() => {
    // Delete existing widgets for this dashboard
    db.prepare('DELETE FROM widgets WHERE dashboard_id = ?').run(id);

    // Insert new widgets
    const insert = db.prepare(`
      INSERT INTO widgets (id, dashboard_id, type, sort_order)
      VALUES (?, ?, ?, ?)
    `);

    widgets.forEach((widget: WidgetInput, index: number) => {
      insert.run(widget.id, id, widget.type, index);
    });
  });

  transaction();

  return c.json({ success: true });
});

// ============ Widget Config Routes ============

// Get all configs
app.get('/api/configs', (c) => {
  const configs = db.prepare(`
    SELECT widget_id, config_data FROM widget_configs
  `).all() as Pick<WidgetConfigRow, 'widget_id' | 'config_data'>[];

  const result: Record<string, unknown> = {};
  for (const config of configs) {
    result[config.widget_id] = JSON.parse(config.config_data);
  }

  return c.json(result);
});

// Get single config
app.get('/api/configs/:widgetId', (c) => {
  const { widgetId } = c.req.param();

  const config = db.prepare(`
    SELECT config_data FROM widget_configs WHERE widget_id = ?
  `).get(widgetId) as Pick<WidgetConfigRow, 'config_data'> | undefined;

  if (!config) {
    return c.json({ error: 'Config not found' }, 404);
  }

  return c.json(JSON.parse(config.config_data));
});

// Save config
app.put('/api/configs/:widgetId', async (c) => {
  const { widgetId } = c.req.param();
  const configData = await c.req.json();

  // Upsert config - no foreign key constraint, configs can exist independently
  db.prepare(`
    INSERT INTO widget_configs (widget_id, config_data, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(widget_id) DO UPDATE SET
      config_data = excluded.config_data,
      updated_at = CURRENT_TIMESTAMP
  `).run(widgetId, JSON.stringify(configData));

  return c.json({ success: true });
});

// Delete config
app.delete('/api/configs/:widgetId', (c) => {
  const { widgetId } = c.req.param();

  const result = db.prepare('DELETE FROM widget_configs WHERE widget_id = ?').run(widgetId);

  if (result.changes === 0) {
    return c.json({ error: 'Config not found' }, 404);
  }

  return c.json({ success: true });
});

// ============ App Settings Routes ============

// Get settings
app.get('/api/settings', (c) => {
  const settings = db.prepare(`
    SELECT settings_data FROM app_settings WHERE id = 'default'
  `).get() as Pick<AppSettingsRow, 'settings_data'> | undefined;

  if (!settings) {
    return c.json({});
  }

  return c.json(JSON.parse(settings.settings_data));
});

// Save settings
app.put('/api/settings', async (c) => {
  const settingsData = await c.req.json();

  db.prepare(`
    INSERT INTO app_settings (id, settings_data, updated_at)
    VALUES ('default', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      settings_data = excluded.settings_data,
      updated_at = CURRENT_TIMESTAMP
  `).run(JSON.stringify(settingsData));

  return c.json({ success: true });
});

// ============ Server Startup ============

import { serve } from '@hono/node-server';

const PORT = parseInt(process.env.PORT || '3001', 10);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  closeDatabase();
  process.exit(0);
});

console.log(`Starting Boxento Backend on port ${PORT}...`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: '0.0.0.0',  // Listen on all interfaces for Tailscale access
}, (info) => {
  console.log(`Server running at http://0.0.0.0:${info.port}`);
});
