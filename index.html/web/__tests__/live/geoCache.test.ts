import { describe, expect, it } from 'vitest';
import {
  GEO_CACHE_STORAGE_KEY,
  GEO_CACHE_VERSION,
  GeoCache,
  canonicalGeoQuery,
  geoCoordKey,
  geoQueryKey,
  type StorageLike,
} from '@/lib/live/geoCache';
import type { GeoPlace } from '@/lib/live/geoMatch';

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

const GA: GeoPlace = { id: 4204230, name: 'LaGrange', admin1: '조지아', country: '미국', countryCode: 'US', population: 29588, lat: 33.03929, lon: -85.03133 };
const KY: GeoPlace = { id: 4297238, name: 'La Grange', admin1: '켄터키주', country: '미국', countryCode: 'US', population: 8619, lat: 38.40757, lon: -85.37885 };

describe('geoCache · keys', () => {
  it('folds spacing, case and NFKC width into one query identity', () => {
    expect(canonicalGeoQuery('  라그레인지 ')).toBe('라그레인지');
    expect(canonicalGeoQuery('La  Grange')).toBe('la grange');
    expect(canonicalGeoQuery('ＬａＧｒａｎｇｅ')).toBe('lagrange');
    expect(geoQueryKey('ko', 'LaGrange')).toBe('q::ko::lagrange');
  });

  it('keys coordinate resolutions on ~1 km cells and the fix kind', () => {
    expect(geoCoordKey('ko', 33.0362, -85.0322, false)).toBe('c::ko::33.04,-85.03::gps');
    expect(geoCoordKey('ko', 33.0391, -85.0313, false)).toBe('c::ko::33.04,-85.03::gps');
    expect(geoCoordKey('ko', 33.0362, -85.0322, true)).toBe('c::ko::33.04,-85.03::ip');
  });
});

describe('geoCache · memory + storage tiers', () => {
  it('serves a parked search instantly and persists it for the next visit', () => {
    const storage = fakeStorage();
    let clock = 1_000;
    const cache = new GeoCache(() => storage, () => clock, 240, 0);
    const key = geoQueryKey('ko', '라그레인지');

    expect(cache.get(key)).toBeNull();
    cache.set(key, [GA, KY]);
    clock = 2_000;
    expect(cache.get(key)).toEqual([GA, KY]);
    cache.flush();

    const blob = JSON.parse(storage.data[GEO_CACHE_STORAGE_KEY]);
    expect(blob.v).toBe(GEO_CACHE_VERSION);
    expect(blob.entries[key].places).toHaveLength(2);
    expect(blob.entries[key].hits).toBe(1);
    expect(blob.entries[key].at).toBe(2_000);

    // a fresh page load hydrates from storage -- no network needed
    const next = new GeoCache(() => storage, () => 3_000, 240, 0);
    expect(next.get(key)?.[0]).toMatchObject({ admin1: '조지아' });
    expect(next.size).toBe(1);
  });

  it('never caches an empty result, so a transient miss stays retryable', () => {
    const cache = new GeoCache(() => fakeStorage(), () => 1, 240, 0);
    cache.set('q::ko::nowhere', []);
    expect(cache.has('q::ko::nowhere')).toBe(false);
  });

  it('drops a stored blob from an older cache version instead of serving it', () => {
    const storage = fakeStorage({
      [GEO_CACHE_STORAGE_KEY]: JSON.stringify({ v: 'gc-v0', entries: { 'q::ko::x': { places: [GA], at: 1, hits: 0 } } }),
    });
    const cache = new GeoCache(() => storage, () => 1, 240, 0);
    expect(cache.get('q::ko::x')).toBeNull();
    expect(storage.data[GEO_CACHE_STORAGE_KEY]).toBeUndefined();
  });

  it('survives corrupt storage and a storage that throws', () => {
    const corrupt = fakeStorage({ [GEO_CACHE_STORAGE_KEY]: '{not json' });
    const cache = new GeoCache(() => corrupt, () => 1, 240, 0);
    cache.set('q::ko::a', [GA]);
    expect(cache.get('q::ko::a')).toEqual([GA]);

    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    const blocked = new GeoCache(() => throwing, () => 1, 240, 0);
    blocked.set('q::ko::b', [KY]);
    blocked.flush();
    expect(blocked.get('q::ko::b')).toEqual([KY]);

    const none = new GeoCache(() => null, () => 1, 240, 0);
    none.set('q::ko::c', [GA]);
    none.flush();
    expect(none.get('q::ko::c')).toEqual([GA]);
  });

  it('evicts the least-recently-used rows past the cap, keeping the ones still in use', () => {
    let clock = 0;
    const cache = new GeoCache(() => fakeStorage(), () => clock, 3, 0);
    cache.set('a', [GA]); // at 0
    clock = 1;
    cache.set('b', [GA]);
    clock = 2;
    cache.set('c', [GA]);
    clock = 3;
    cache.get('a'); // a becomes the most recent
    clock = 4;
    cache.set('d', [GA]); // over the cap -> b (oldest) goes
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
    expect(cache.size).toBe(3);
  });

  it('halves the LRU tail and retries when storage rejects the write', () => {
    let clock = 0;
    let quotaLeft = 1;
    const storage = fakeStorage();
    const strict: StorageLike = {
      getItem: storage.getItem,
      removeItem: storage.removeItem,
      setItem: (k, v) => {
        if (quotaLeft-- > 0) throw new Error('QuotaExceededError');
        storage.setItem(k, v);
      },
    };
    const cache = new GeoCache(() => strict, () => clock++, 240, 0);
    for (const k of ['a', 'b', 'c', 'd']) cache.set(k, [GA]);
    cache.flush();
    expect(cache.size).toBe(2);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
    expect(JSON.parse(storage.data[GEO_CACHE_STORAGE_KEY]).entries).toHaveProperty('d');
  });
});
