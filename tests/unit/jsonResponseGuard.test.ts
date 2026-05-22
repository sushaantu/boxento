import { describe, expect, it } from 'vitest';

import {
  getJsonResponseParseErrorMessage,
  installJsonResponseGuard,
  parseJsonResponseText,
} from '@/lib/jsonResponseGuard';

describe('jsonResponseGuard', () => {
  it('parses valid JSON text', () => {
    expect(parseJsonResponseText<{ ok: boolean }>('{"ok":true}')).toEqual({ ok: true });
  });

  it('identifies HTML responses without exposing query strings', () => {
    const response = new Response('<!doctype html><html><body>Login</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

    expect(getJsonResponseParseErrorMessage('<!doctype html>', response, 'Widget API')).toBe(
      'Widget API returned HTML instead of JSON (HTTP 200). Check the API URL, backend proxy, or authentication.',
    );
  });

  it('makes response.json failures readable app-wide', async () => {
    installJsonResponseGuard();

    const response = new Response('<html><body>Not JSON</body></html>', {
      status: 404,
      headers: { 'content-type': 'text/html' },
    });

    await expect(response.json()).rejects.toThrow(
      'The API endpoint returned HTML instead of JSON (HTTP 404). Check the API URL, backend proxy, or authentication.',
    );
  });
});
