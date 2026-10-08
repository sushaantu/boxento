import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TennisMatch, TennisScore } from '@/components/widgets/TennisWidget/types';

const START = 1_790_000_000_000;
const KEY = 'test-tennis-key';
const INTERVAL = 900_000;
const match: TennisMatch = {
  id: 101, tournament: 'Tokyo', players: { p1: { name: 'Player One' }, p2: { name: 'Player Two' } },
  score: { sets: [1, 0], games: [[6, 3], [4, 4]], points: ['30', '40'], server: 1, is_tiebreak: false },
};

function storageMock() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn((key: string) => { data.delete(key); }),
    clear: vi.fn(() => { data.clear(); }),
  };
}

function sharedLocks() {
  const tails = new Map<string, Promise<unknown>>();
  return {
    request: vi.fn((name: string, callback: () => Promise<unknown>) => {
      const previous = tails.get(name) ?? Promise.resolve();
      const result = previous.then(callback);
      tails.set(name, result.catch(() => undefined));
      return result;
    }),
  };
}

function response(data: unknown = [match]) {
  return new Response(JSON.stringify({ data, meta: { has_more: true, next_cursor: 'another-page' } }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function client() {
  return import('@/components/widgets/TennisWidget/api');
}

async function cacheKeys() {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(KEY));
  const hash = Buffer.from(digest).toString('hex');
  const cache = `boxento:tennis:v1:${hash}`;
  return { cache, guard: `${cache}:attempt` };
}

let storage: ReturnType<typeof storageMock>;
let locks: ReturnType<typeof sharedLocks>;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(START);
  storage = storageMock();
  locks = sharedLocks();
  fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => response());
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('navigator', { locks });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('tennis score snapshots', () => {
  it('requests one free live page with the header key and preserves the published schema', async () => {
    const { getTennisSnapshot, TENNIS_REFRESH_MS } = await client();
    expect(TENNIS_REFRESH_MS).toBe(INTERVAL);
    await expect(getTennisSnapshot(` ${KEY} `)).resolves.toEqual({ matches: [match], updatedAt: START });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.livetennisapi.com/api/public/v1/matches?status=live&limit=200');
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ 'X-API-Key': KEY });
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    const saved = JSON.stringify([...storage.data]);
    expect(saved).not.toContain(KEY);
    expect(storage.data.size).toBe(2);
  });

  it('shares the pending request across simultaneous widget copies', async () => {
    let finish!: (value: Response) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { getTennisSnapshot } = await client();
    const first = getTennisSnapshot(KEY);
    const second = getTennisSnapshot(KEY);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    finish(response());
    expect(await first).toEqual(await second);
    expect(locks.request).toHaveBeenCalledTimes(1);
  });

  it('shares the persisted request slot across separate module instances and reloads', async () => {
    const first = await client();
    vi.resetModules();
    const second = await client();
    const snapshots = await Promise.all([first.getTennisSnapshot(KEY), second.getTennisSnapshot(KEY)]);
    expect(snapshots[0]).toEqual(snapshots[1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.resetModules();
    await (await client()).getTennisSnapshot(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(locks.request).toHaveBeenCalledTimes(3);
  });

  it('records the request slot before calling the network', async () => {
    const { cache, guard } = await cacheKeys();
    fetchMock.mockImplementation(async () => {
      expect(JSON.parse(storage.data.get(guard)!)).toBe(START);
      expect(JSON.parse(storage.data.get(cache)!).lastAttempt).toBe(START);
      return response();
    });
    await (await client()).getTennisSnapshot(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('waits a full 900 seconds before accepting another request', async () => {
    const { getTennisSnapshot } = await client();
    await getTennisSnapshot(KEY);
    vi.setSystemTime(START + INTERVAL - 1);
    await getTennisSnapshot(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(START + INTERVAL);
    await getTennisSnapshot(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('makes at most 96 requests during a full day even when every request fails', async () => {
    fetchMock.mockRejectedValue(new Error(KEY));
    const { getTennisSnapshot } = await client();
    for (let attempt = 0; attempt < 96; attempt++) {
      vi.setSystemTime(START + attempt * INTERVAL);
      await getTennisSnapshot(KEY);
      vi.setSystemTime(START + attempt * INTERVAL + INTERVAL - 1);
      await getTennisSnapshot(KEY);
    }
    expect(fetchMock).toHaveBeenCalledTimes(96);
    const result = await getTennisSnapshot(KEY);
    expect(result.error).not.toContain(KEY);
  });

  it('keeps independent request slots for different API keys', async () => {
    const { getTennisSnapshot } = await client();
    await getTennisSnapshot(KEY);
    await getTennisSnapshot('another-key');
    await getTennisSnapshot(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storage.data.size).toBe(4);
    expect(JSON.stringify([...storage.data])).not.toContain('another-key');
  });

  it('preserves stale successful scores and the failure across a reload', async () => {
    const { getTennisSnapshot } = await client();
    await getTennisSnapshot(KEY);
    vi.setSystemTime(START + INTERVAL);
    fetchMock.mockRejectedValue(new Error('Offline'));
    const failed = await getTennisSnapshot(KEY);
    expect(failed.matches).toEqual([match]);
    expect(failed.updatedAt).toBe(START);
    expect(failed.error).toContain('could not be refreshed');
    vi.resetModules();
    expect(await (await client()).getTennisSnapshot(KEY)).toEqual(failed);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.setSystemTime(START + 2 * INTERVAL);
    fetchMock.mockImplementation(async () => response([]));
    await expect((await client()).getTennisSnapshot(KEY)).resolves.toEqual({
      matches: [], updatedAt: START + 2 * INTERVAL,
    });
  });

  it.each([401, 403, 429, 500])('persists the cooldown for HTTP %s errors', async (status) => {
    fetchMock.mockImplementation(async () => new Response(KEY, { status }));
    const { getTennisSnapshot } = await client();
    const result = await getTennisSnapshot(KEY);
    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain(KEY);
    vi.resetModules();
    expect(await (await client()).getTennisSnapshot(KEY)).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts a stalled network request after 30 seconds and keeps its cooldown', async () => {
    fetchMock.mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('Timeout')));
    }));
    const { getTennisSnapshot } = await client();
    const pending = getTennisSnapshot(KEY);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await pending).error).toContain('could not be refreshed');
    await getTennisSnapshot(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed when browser locks are unavailable', async () => {
    vi.stubGlobal('navigator', {});
    expect((await (await client()).getTennisSnapshot(KEY)).error).toContain('Web Locks');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the lock request is rejected', async () => {
    locks.request.mockRejectedValue(new Error('Denied'));
    expect((await (await client()).getTennisSnapshot(KEY)).error).toContain('shared request lock');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when hashing is unavailable', async () => {
    vi.stubGlobal('crypto', {});
    expect((await (await client()).getTennisSnapshot(KEY)).error).toContain('secure browser');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores empty or oversized credentials', async () => {
    const { getTennisSnapshot } = await client();
    await getTennisSnapshot(' ');
    await getTennisSnapshot('x'.repeat(513));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when storage reads are blocked', async () => {
    storage.getItem.mockImplementation(() => { throw new Error('Blocked'); });
    expect((await (await client()).getTennisSnapshot(KEY)).error).toContain('requests are paused');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([1, 2])('fails closed when pre-request storage write %s fails', async (write) => {
    storage.setItem.mockImplementation((key, value) => {
      if (storage.setItem.mock.calls.length === write) throw new Error('Quota exceeded');
      storage.data.set(key, value);
    });
    expect((await (await client()).getTennisSnapshot(KEY)).error).toContain('requests are paused');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the pre-request guard when saving the fetched result fails', async () => {
    storage.setItem.mockImplementation((key, value) => {
      if (storage.setItem.mock.calls.length === 3) throw new Error('Quota exceeded');
      storage.data.set(key, value);
    });
    const { getTennisSnapshot } = await client();
    expect((await getTennisSnapshot(KEY)).error).toContain('requests are paused');
    vi.resetModules();
    await (await client()).getTennisSnapshot(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fetch after the cache was removed until the independent guard expires', async () => {
    await (await client()).getTennisSnapshot(KEY);
    const { cache } = await cacheKeys();
    storage.data.delete(cache);
    vi.resetModules();
    const next = await client();
    expect((await next.getTennisSnapshot(KEY)).error).toContain('Saved tennis scores');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(START + INTERVAL);
    await next.getTennisSnapshot(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['cache', 'guard'])('fails closed for a corrupt %s record', async (kind) => {
    await (await client()).getTennisSnapshot(KEY);
    const keys = await cacheKeys();
    storage.data.set(keys[kind as keyof typeof keys], '{bad-json');
    vi.resetModules();
    vi.setSystemTime(START + INTERVAL);
    expect((await (await client()).getTennisSnapshot(KEY)).error).toContain('requests are paused');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the independent request guard was removed', async () => {
    await (await client()).getTennisSnapshot(KEY);
    const { guard } = await cacheKeys();
    storage.data.delete(guard);
    vi.resetModules();
    vi.setSystemTime(START + INTERVAL);
    expect((await (await client()).getTennisSnapshot(KEY)).error).toContain('timing changed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('detects removal of both records within the running page', async () => {
    const { getTennisSnapshot } = await client();
    await getTennisSnapshot(KEY);
    storage.data.clear();
    vi.setSystemTime(START + INTERVAL);
    expect((await getTennisSnapshot(KEY)).error).toContain('timing changed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps its floor when the local clock moves backwards', async () => {
    const { getTennisSnapshot } = await client();
    await getTennisSnapshot(KEY);
    vi.setSystemTime(START - 1000);
    await getTennisSnapshot(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts null scores, withheld games, and null point values', async () => {
    const withheld = { ...match, id: 102, score: { ...match.score!, games: null, points: [null, null], server: null } };
    const unscored = { ...match, id: 103, score: null };
    const empty = { ...match, id: 104, score: { ...match.score!, games: [] } };
    fetchMock.mockImplementation(async () => response([withheld, unscored, empty]));
    expect((await (await client()).getTennisSnapshot(KEY)).matches).toEqual([withheld, unscored, empty]);
  });

  it.each([
    [{ ...match, players: undefined, player1: { name: 'Wrong schema' } }],
    [{ ...match, score: { ...match.score!, games: [[6], [4, 4]] } }],
    [{ ...match, score: { ...match.score!, server: 3 } }],
    [{ ...match, score: { ...match.score!, points: ['30'] } }],
    [{ ...match, players: { ...match.players, p1: { name: 'x'.repeat(257) } } }],
    Array.from({ length: 201 }, () => match),
  ])('rejects malformed or oversized match data without using another request', async (data) => {
    fetchMock.mockImplementation(async () => response(data));
    const { getTennisSnapshot } = await client();
    expect((await getTennisSnapshot(KEY)).error).toBeTruthy();
    await getTennisSnapshot(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bounds the response body and preserves the request cooldown', async () => {
    fetchMock.mockImplementation(async () => new Response('x'.repeat(512 * 1024 + 1)));
    const { getTennisSnapshot } = await client();
    expect((await getTennisSnapshot(KEY)).error).toBeTruthy();
    await getTennisSnapshot(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('tennis score display', () => {
  it('reads games by player and pairs corresponding set columns', async () => {
    const { getTennisSets, formatTennisScore } = await client();
    expect(getTennisSets(match.score)).toEqual([[6, 4], [3, 4]]);
    expect(formatTennisScore(match.score)).toBe('6-4 3-4');
  });

  it('marks a deciding match tiebreak without treating it as a ten-game set', async () => {
    const { formatTennisScore } = await client();
    const score: TennisScore = { ...match.score!, games: [[6, 3, 10], [4, 6, 5]], is_tiebreak: true };
    expect(formatTennisScore(score)).toBe('6-4 3-6 [10-5]');
    expect(formatTennisScore({ ...score, games: [[6, 3, 3], [4, 6, 2]] })).toBe('6-4 3-6 [3-2]');
    expect(formatTennisScore({ ...score, games: [[6, 3, 0], [4, 6, 0]] })).toBe('6-4 3-6 [0-0]');
    expect(formatTennisScore({ ...score, games: [[6, 3, 6], [4, 6, 6]] })).toBe('6-4 3-6 6-6');
  });

  it('reports unavailable scores for null or empty game data', async () => {
    const { getTennisSets, formatTennisScore } = await client();
    expect(getTennisSets(null)).toEqual([]);
    expect(formatTennisScore(null)).toBe('Score unavailable');
    expect(formatTennisScore({ ...match.score!, games: null })).toBe('Score unavailable');
    expect(formatTennisScore({ ...match.score!, games: [] })).toBe('Score unavailable');
  });
});
