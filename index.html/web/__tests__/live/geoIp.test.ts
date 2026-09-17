import { describe, expect, it } from 'vitest';
import {
  GEOJS_URL,
  GEO_IP_STORAGE_KEY,
  GEO_IP_TTL_MS,
  IPWHOIS_URL,
  parseGeoJs,
  parseIpWhoIs,
  readGeoIpFix,
  refreshGeoIpFix,
  writeGeoIpFix,
  type FetchLike,
  type GeoIpFix,
} from '@/lib/live/geoIp';
import type { StorageLike } from '@/lib/live/geoCache';

// REV-41 SPEC.md D-4 -- the Geo-IP fix's storage contract (key, shape, TTL,
// fail-open reads and writes) and the two-provider refresh, pinned with a
// fake storage and a fake fetch so nothing here touches the network.

const NOW = 1_800_000_000_000;
const FIX: GeoIpFix = { country: 'PT', lat: 38.7223, lon: -9.1393, city: 'Lisbon', at: NOW - 1000 };

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string>; writes: number } {
  const store = {
    data: { ...initial },
    writes: 0,
    getItem: (k: string) => (k in store.data ? store.data[k] : null),
    setItem: (k: string, v: string) => {
      store.writes += 1;
      store.data[k] = v;
    },
    removeItem: (k: string) => {
      delete store.data[k];
    },
  };
  return store;
}

function fakeFetch(answers: Record<string, { ok: boolean; body?: unknown; throws?: boolean }>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (input: string) => {
    calls.push(input);
    const a = answers[input];
    if (!a) return { ok: false, json: async () => null };
    if (a.throws) throw new Error('network');
    return { ok: a.ok, json: async () => a.body };
  }) as FetchLike & { calls: string[] };
  fn.calls = calls;
  return fn;
}

describe('readGeoIpFix / writeGeoIpFix', () => {
  it('round-trips a fix through the versioned key', () => {
    const s = fakeStorage();
    writeGeoIpFix(FIX, s);
    expect(Object.keys(s.data)).toEqual([GEO_IP_STORAGE_KEY]);
    expect(GEO_IP_STORAGE_KEY).toBe('unitas.geo.ip.v1');
    expect(readGeoIpFix(s, NOW)).toEqual(FIX);
  });

  it('honours the 24 h TTL: a fix a millisecond inside is served, one at the boundary is not', () => {
    expect(GEO_IP_TTL_MS).toBe(24 * 60 * 60 * 1000);
    const s = fakeStorage();
    writeGeoIpFix({ ...FIX, at: NOW - GEO_IP_TTL_MS + 1 }, s);
    expect(readGeoIpFix(s, NOW)?.country).toBe('PT');
    writeGeoIpFix({ ...FIX, at: NOW - GEO_IP_TTL_MS }, s);
    expect(readGeoIpFix(s, NOW)).toBeNull();
  });

  it('reads null on the server, on an empty store, on corrupt JSON, on a wrong shape and on a throwing store', () => {
    expect(readGeoIpFix(null, NOW)).toBeNull();
    expect(readGeoIpFix(fakeStorage(), NOW)).toBeNull();
    expect(readGeoIpFix(fakeStorage({ [GEO_IP_STORAGE_KEY]: '{not json' }), NOW)).toBeNull();
    expect(readGeoIpFix(fakeStorage({ [GEO_IP_STORAGE_KEY]: JSON.stringify({ country: 'Portugal', lat: 1, lon: 2, city: '', at: NOW }) }), NOW)).toBeNull();
    expect(readGeoIpFix(fakeStorage({ [GEO_IP_STORAGE_KEY]: JSON.stringify({ country: 'PT', lat: 'x', lon: 2, city: '', at: NOW }) }), NOW)).toBeNull();
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    expect(readGeoIpFix(throwing, NOW)).toBeNull();
    expect(() => writeGeoIpFix(FIX, throwing)).not.toThrow();
    expect(() => writeGeoIpFix(FIX, null)).not.toThrow();
  });
});

describe('provider parsers', () => {
  it('normalises GeoJS strings and ipwho.is numbers into one fix and refuses the null island', () => {
    expect(parseGeoJs({ country_code: 'kr', latitude: '37.5665', longitude: '126.978', city: 'Seoul' }, NOW)).toEqual({
      country: 'KR',
      lat: 37.5665,
      lon: 126.978,
      city: 'Seoul',
      at: NOW,
    });
    expect(parseGeoJs({ country_code: 'KR', latitude: '0', longitude: '0' }, NOW)).toBeNull();
    expect(parseGeoJs({ latitude: '1', longitude: '1' }, NOW)).toBeNull();
    expect(parseGeoJs(null, NOW)).toBeNull();
    expect(parseIpWhoIs({ success: true, country_code: 'PT', latitude: 38.7223, longitude: -9.1393, city: 'Lisbon' }, NOW)).toEqual(FIX_AT(NOW));
    expect(parseIpWhoIs({ success: false, country_code: 'PT', latitude: 38.7, longitude: -9.1 }, NOW)).toBeNull();
    expect(parseIpWhoIs({ success: true, country_code: 'PT', latitude: 91, longitude: 0 }, NOW)).toBeNull();
    expect(parseIpWhoIs({ success: true, country_code: 'PT' }, NOW)?.city).toBeUndefined();
  });
});

const FIX_AT = (at: number): GeoIpFix => ({ ...FIX, at });

describe('refreshGeoIpFix', () => {
  const geoJs = { country_code: 'PT', latitude: '38.7223', longitude: '-9.1393', city: 'Lisbon' };
  const ipWho = { success: true, country_code: 'PT', latitude: 38.7223, longitude: -9.1393, city: 'Lisbon' };

  it('takes GeoJS first and persists the fix', async () => {
    const s = fakeStorage();
    const fetchImpl = fakeFetch({ [GEOJS_URL]: { ok: true, body: geoJs } });
    const fix = await refreshGeoIpFix(undefined, { storage: s, fetchImpl, now: () => NOW });
    expect(fix).toEqual(FIX_AT(NOW));
    expect(fetchImpl.calls).toEqual([GEOJS_URL]);
    expect(readGeoIpFix(s, NOW)).toEqual(FIX_AT(NOW));
  });

  it('falls back to ipwho.is when GeoJS is down, rate-limited or answers garbage', async () => {
    for (const geoJsAnswer of [{ ok: false }, { ok: true, body: { country_code: 'PT', latitude: '0', longitude: '0' } }, { ok: true, throws: true }]) {
      const s = fakeStorage();
      const fetchImpl = fakeFetch({ [GEOJS_URL]: geoJsAnswer, [IPWHOIS_URL]: { ok: true, body: ipWho } });
      const fix = await refreshGeoIpFix(undefined, { storage: s, fetchImpl, now: () => NOW });
      expect(fix?.city).toBe('Lisbon');
      expect(fetchImpl.calls).toEqual([GEOJS_URL, IPWHOIS_URL]);
      expect(s.writes).toBe(1);
    }
  });

  it('yields null and writes nothing when both providers fail, and never calls out once aborted', async () => {
    const s = fakeStorage();
    const fetchImpl = fakeFetch({ [GEOJS_URL]: { ok: false }, [IPWHOIS_URL]: { ok: true, body: { success: false } } });
    expect(await refreshGeoIpFix(undefined, { storage: s, fetchImpl, now: () => NOW })).toBeNull();
    expect(s.writes).toBe(0);
    const controller = new AbortController();
    controller.abort();
    const idle = fakeFetch({ [GEOJS_URL]: { ok: true, body: geoJs } });
    expect(await refreshGeoIpFix(controller.signal, { storage: s, fetchImpl: idle })).toBeNull();
    expect(idle.calls).toEqual([]);
  });
});
