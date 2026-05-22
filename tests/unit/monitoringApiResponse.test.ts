import { describe, expect, it } from 'vitest';

import { readMonitoringJson } from '@/components/widgets/common/monitoringApiResponse';

describe('readMonitoringJson', () => {
  it('returns parsed JSON for successful monitoring responses', async () => {
    const response = new Response(JSON.stringify({ monitors: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    await expect(readMonitoringJson<{ monitors: unknown[] }>(response, 'Uptime Kuma')).resolves.toEqual({
      monitors: [],
    });
  });

  it('uses JSON error payloads from failed responses', async () => {
    const response = new Response(JSON.stringify({ error: 'Monitoring is not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });

    await expect(readMonitoringJson(response, 'Healthchecks')).rejects.toThrow('Monitoring is not configured');
  });

  it('explains when a frontend HTML page is returned instead of widget API JSON', async () => {
    const response = new Response('<!doctype html><html><body>Boxento</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });

    await expect(readMonitoringJson(response, 'Uptime Kuma')).rejects.toThrow(
      'Uptime Kuma endpoint returned HTML instead of JSON',
    );
  });
});
