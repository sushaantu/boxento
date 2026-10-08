import type { TennisMatch, TennisScore, TennisSnapshot } from './types';

// A shared 15 minute floor allows at most 96 attempts per day on the 100 request free tier.
export const TENNIS_REFRESH_MS = 15 * 60 * 1000;

const ENDPOINT = 'https://api.livetennisapi.com/api/public/v1/matches?status=live&limit=200';
const CACHE_PREFIX = 'boxento:tennis:v1:';
const MAX_RESPONSE_BYTES = 512 * 1024;
const inflight = new Map<string, Promise<TennisSnapshot>>();
const observedAttempts = new Map<string, number>();

interface CacheRecord {
  version: 1;
  lastAttempt: number;
  snapshot: TennisSnapshot;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1000;
}

function isCountList(value: unknown, maxLength: number): value is number[] {
  return Array.isArray(value) && value.length <= maxLength && value.every(isCount);
}

function readScore(value: unknown): TennisScore | null {
  if (value === null || value === undefined) return null;
  if (!isObject(value)) throw new Error('The tennis service returned an invalid score.');
  const sets = value.sets ?? [];
  const games = value.games ?? null;
  const points = value.points ?? [null, null];
  const server = value.server ?? null;
  const isTiebreak = value.is_tiebreak ?? false;
  if (!isCountList(sets, 2)
    || (games !== null && (!Array.isArray(games) || (games.length !== 0 && games.length !== 2)
      || !games.every((row) => isCountList(row, 5))
      || (games.length === 2 && games[0].length !== games[1].length)))
    || !Array.isArray(points) || points.length !== 2
    || !points.every((point) => point === null || (typeof point === 'string' && point.length <= 16))
    || (server !== null && server !== 1 && server !== 2)
    || typeof isTiebreak !== 'boolean') {
    throw new Error('The tennis service returned an invalid score.');
  }
  return { sets, games, points, server, is_tiebreak: isTiebreak };
}

function readMatches(value: unknown): TennisMatch[] {
  if (!Array.isArray(value) || value.length > 200) {
    throw new Error('The tennis service returned an invalid match list.');
  }
  return value.map((match) => {
    if (!isObject(match) || !Number.isSafeInteger(match.id) || Number(match.id) < 1
      || typeof match.tournament !== 'string' || match.tournament.length > 512
      || !isObject(match.players) || !isObject(match.players.p1) || !isObject(match.players.p2)) {
      throw new Error('The tennis service returned an invalid match.');
    }
    const p1 = match.players.p1.name;
    const p2 = match.players.p2.name;
    if (typeof p1 !== 'string' || !p1.trim() || p1.length > 256
      || typeof p2 !== 'string' || !p2.trim() || p2.length > 256) {
      throw new Error('The tennis service returned an invalid player.');
    }
    return {
      id: Number(match.id), tournament: match.tournament,
      players: { p1: { name: p1 }, p2: { name: p2 } }, score: readScore(match.score),
    };
  });
}

function readTimestamp(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error('Saved tennis request timing is unavailable.');
  }
  return Number(value);
}

function readRecord(raw: string): CacheRecord {
  if (raw.length > MAX_RESPONSE_BYTES) throw new Error('Saved tennis data is invalid.');
  const value: unknown = JSON.parse(raw);
  if (!isObject(value) || value.version !== 1 || !isObject(value.snapshot)) {
    throw new Error('Saved tennis data is invalid.');
  }
  const updatedAt = value.snapshot.updatedAt === null ? null : readTimestamp(value.snapshot.updatedAt);
  const error = value.snapshot.error;
  if (error !== undefined && (typeof error !== 'string' || error.length > 256)) {
    throw new Error('Saved tennis data is invalid.');
  }
  return {
    version: 1, lastAttempt: readTimestamp(value.lastAttempt),
    snapshot: { matches: readMatches(value.snapshot.matches), updatedAt, ...(error ? { error } : {}) },
  };
}

async function readResponse(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('The tennis service returned an empty response.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('The tennis service returned too much data.');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    reader.releaseLock();
  }
}

function unavailable(error: string, previous?: TennisSnapshot): TennisSnapshot {
  return { matches: previous?.matches ?? [], updatedAt: previous?.updatedAt ?? null, error };
}

async function fetchSnapshot(apiKey: string, previous: TennisSnapshot): Promise<TennisSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(ENDPOINT, { headers: { 'X-API-Key': apiKey }, signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel();
      return unavailable(response.status === 401 || response.status === 403
        ? 'The tennis service rejected this API key.'
        : response.status === 429 ? 'The tennis request limit was reached. Try again after 15 minutes.'
          : 'The tennis service is unavailable. Try again after 15 minutes.', previous);
    }
    const payload = await readResponse(response);
    if (!isObject(payload)) throw new Error('The tennis service returned an invalid response.');
    return { matches: readMatches(payload.data), updatedAt: Date.now() };
  } catch {
    return unavailable('Tennis scores could not be refreshed. Try again after 15 minutes.', previous);
  } finally {
    clearTimeout(timeout);
  }
}

async function underLock(apiKey: string, hash: string): Promise<TennisSnapshot> {
  let previous: TennisSnapshot | undefined;
  try {
    const storage = globalThis.localStorage;
    const cacheKey = `${CACHE_PREFIX}${hash}`;
    const guardKey = `${cacheKey}:attempt`;
    const raw = storage.getItem(cacheKey);
    const guard = storage.getItem(guardKey);
    const record = raw === null ? undefined : readRecord(raw);
    previous = record?.snapshot;
    const guardAttempt = guard === null ? undefined : readTimestamp(JSON.parse(guard));
    const observed = observedAttempts.get(hash);
    if ((record && guardAttempt === undefined) || (observed !== undefined && guardAttempt === undefined)
      || (record && guardAttempt !== record.lastAttempt)
      || (observed !== undefined && guardAttempt !== undefined && guardAttempt < observed)) {
      return unavailable('Saved tennis request timing changed. Requests are paused.', previous);
    }
    const lastAttempt = guardAttempt ?? observed;
    const now = Date.now();
    if (lastAttempt !== undefined && now - lastAttempt < TENNIS_REFRESH_MS) {
      return previous ?? unavailable('Saved tennis scores are unavailable. Try again after 15 minutes.');
    }

    const pending: CacheRecord = {
      version: 1, lastAttempt: now,
      snapshot: previous ?? unavailable('Tennis scores could not be refreshed. Try again after 15 minutes.'),
    };
    // Record the attempt before fetching, so failures and reloads also consume the request slot.
    storage.setItem(guardKey, JSON.stringify(now));
    observedAttempts.set(hash, now);
    storage.setItem(cacheKey, JSON.stringify(pending));
    const snapshot = await fetchSnapshot(apiKey, pending.snapshot);
    pending.snapshot = snapshot;
    storage.setItem(cacheKey, JSON.stringify(pending));
    return snapshot;
  } catch {
    return unavailable('Browser storage is unavailable or invalid. Tennis requests are paused.', previous);
  }
}

export async function getTennisSnapshot(apiKey: string): Promise<TennisSnapshot> {
  const key = apiKey.trim();
  if (!key || key.length > 512) return unavailable('Add a tennis API key in settings.');
  try {
    if (!globalThis.crypto?.subtle || typeof navigator === 'undefined' || !navigator.locks?.request) {
      return unavailable('Tennis scores require a secure browser with Web Locks.');
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const existing = inflight.get(hash);
    if (existing) return existing;
    const promise = navigator.locks.request(`${CACHE_PREFIX}${hash}`, () => underLock(key, hash));
    inflight.set(hash, promise);
    try {
      return await promise;
    } finally {
      inflight.delete(hash);
    }
  } catch {
    return unavailable('Tennis scores could not access the shared request lock.');
  }
}

export function getTennisSets(score: TennisScore | null): [number, number][] {
  if (!score?.games || score.games.length !== 2) return [];
  return score.games[0].map((games, index) => [games, score.games![1][index]]);
}

export function formatTennisScore(score: TennisScore | null): string {
  if (!score || score.games === null) return 'Score unavailable';
  const sets = getTennisSets(score);
  return sets.map(([p1, p2], index) => {
    const matchTiebreak = score.is_tiebreak && index === sets.length - 1
      && index >= 2 && (p1 !== 6 || p2 !== 6);
    return matchTiebreak ? `[${p1}-${p2}]` : `${p1}-${p2}`;
  }).join(' ') || 'Score unavailable';
}
