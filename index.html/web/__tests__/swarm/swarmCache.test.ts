import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SWARM_CACHE_STORAGE_KEY,
  SWARM_CACHE_TTL_MS,
  SWARM_CACHE_VERSION,
  SwarmCache,
  swarmCacheKey,
  type StorageLike,
  type SwarmCachedResult,
} from '@/lib/swarm/swarmCache';
import type { SwarmCard } from '@/lib/swarm/swarmTypes';

// REV-33 M3 -- the persistent tier of the swarm's intelligent cache. Storage
// and clock are injected, so expiry, eviction, hydration, versioning and the
// quota retry are all proven with no browser. No fixtures shared with other
// __tests__/** files (CLAUDE.md "Module-level test isolation").

class FakeStorage implements StorageLike {
  readonly map = new Map<string, string>();
  /** Bytes this fake will accept before throwing, as a real quota would. */
  limit = Number.POSITIVE_INFINITY;
  writes = 0;

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.writes += 1;
    if (value.length > this.limit) {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function card(id: string): SwarmCard {
  return {
    id,
    kind: 'chips',
    field: 'f1',
    items: [{ id: `${id}-a`, title: 'Alpha', qid: 'Q1', url: 'https://www.wikidata.org/wiki/Q1', sourceId: 'wikidata' }],
    sourceId: 'wikidata',
  };
}

function result(id = 'bigtech-P452'): SwarmCachedResult {
  return { cards: [card(id)], sources: ['wikidata'], empty: false };
}

let clock = 1_000_000;
const now = () => clock;

beforeEach(() => {
  clock = 1_000_000;
  vi.useFakeTimers();
});

describe('swarmCacheKey', () => {
  it('makes the language part of the identity -- entries arrive localized', () => {
    expect(swarmCacheKey('Q2283', 'ko')).not.toBe(swarmCacheKey('Q2283', 'ja'));
    expect(swarmCacheKey('Q2283', 'ko')).toBe('Q2283::ko');
  });
});

describe('SwarmCache -- the read path', () => {
  it('answers a walked subject without touching the source again', () => {
    const cache = new SwarmCache(() => new FakeStorage(), now);
    cache.set('Q1::en', result());
    expect(cache.get('Q1::en')?.cards).toHaveLength(1);
    expect(cache.get('Q2::en')).toBeNull();
  });

  /**
   * "Wikidata has nothing for this" is a statement about one moment of one
   * third party. Freezing it for a week would turn a transient outage into a
   * permanently blank field.
   */
  it('never parks an empty result', () => {
    const cache = new SwarmCache(() => new FakeStorage(), now);
    cache.set('Q1::en', { cards: [], sources: ['wikidata'], empty: true });
    cache.set('Q2::en', { cards: [], sources: [], empty: false });
    expect(cache.get('Q1::en')).toBeNull();
    expect(cache.get('Q2::en')).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('expires a row once a company has had a week to change', () => {
    const cache = new SwarmCache(() => new FakeStorage(), now);
    cache.set('Q1::en', result());
    clock += SWARM_CACHE_TTL_MS - 1;
    expect(cache.get('Q1::en')).not.toBeNull();
    clock += 2;
    expect(cache.get('Q1::en')).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('has() answers through the same expiry rule as get()', () => {
    const cache = new SwarmCache(() => new FakeStorage(), now);
    cache.set('Q1::en', result());
    expect(cache.has('Q1::en')).toBe(true);
    clock += SWARM_CACHE_TTL_MS;
    expect(cache.has('Q1::en')).toBe(false);
  });
});

describe('SwarmCache -- eviction', () => {
  it('keeps the most recently used rows and drops the coldest', () => {
    const cache = new SwarmCache(() => new FakeStorage(), now, 3);
    for (const id of ['a', 'b', 'c']) {
      clock += 10;
      cache.set(`${id}::en`, result(id));
    }
    // Touch 'a' so it is no longer the coldest.
    clock += 10;
    expect(cache.get('a::en')).not.toBeNull();
    clock += 10;
    cache.set('d::en', result('d'));

    expect(cache.size).toBe(3);
    expect(cache.get('b::en')).toBeNull(); // coldest, evicted
    expect(cache.get('a::en')).not.toBeNull();
    expect(cache.get('c::en')).not.toBeNull();
    expect(cache.get('d::en')).not.toBeNull();
  });
});

describe('SwarmCache -- the persistent tier', () => {
  it('survives a reload: a second cache reads the first one\'s blob', () => {
    const storage = new FakeStorage();
    const first = new SwarmCache(() => storage, now);
    first.set('Q1::en', result());
    first.flush();
    expect(storage.getItem(SWARM_CACHE_STORAGE_KEY)).toBeTruthy();

    const second = new SwarmCache(() => storage, now);
    expect(second.get('Q1::en')?.cards).toHaveLength(1);
  });

  it('coalesces writes rather than rewriting the blob on every read', () => {
    const storage = new FakeStorage();
    const cache = new SwarmCache(() => storage, now);
    cache.set('Q1::en', result());
    cache.get('Q1::en');
    cache.get('Q1::en');
    expect(storage.writes, 'nothing written before the delay elapses').toBe(0);
    vi.runAllTimers();
    expect(storage.writes, 'one write for the whole burst').toBe(1);
  });

  it('drops a blob written by an older version instead of serving it', () => {
    const storage = new FakeStorage();
    storage.map.set(
      SWARM_CACHE_STORAGE_KEY,
      JSON.stringify({ v: 'sw-v0', entries: { 'Q1::en': { result: result(), born: clock, at: clock, hits: 0 } } }),
    );
    const cache = new SwarmCache(() => storage, now);
    expect(cache.get('Q1::en')).toBeNull();
    expect(storage.getItem(SWARM_CACHE_STORAGE_KEY), 'the stale blob is removed').toBeNull();
  });

  it('drops rows that expired while the tab was closed', () => {
    const storage = new FakeStorage();
    const born = clock;
    storage.map.set(
      SWARM_CACHE_STORAGE_KEY,
      JSON.stringify({
        v: SWARM_CACHE_VERSION,
        entries: {
          'fresh::en': { result: result('fresh'), born, at: born, hits: 0 },
          'stale::en': { result: result('stale'), born: born - SWARM_CACHE_TTL_MS - 1, at: born, hits: 0 },
        },
      }),
    );
    const cache = new SwarmCache(() => storage, now);
    expect(cache.get('fresh::en')).not.toBeNull();
    expect(cache.get('stale::en')).toBeNull();
  });

  it('degrades to memory when storage is absent, corrupt or throws', () => {
    const none = new SwarmCache(() => null, now);
    none.set('Q1::en', result());
    none.flush();
    expect(none.get('Q1::en')).not.toBeNull(); // memory tier still serves

    const corrupt = new FakeStorage();
    corrupt.map.set(SWARM_CACHE_STORAGE_KEY, '{not json');
    const c = new SwarmCache(() => corrupt, now);
    expect(() => c.get('Q1::en')).not.toThrow();
    expect(c.get('Q1::en')).toBeNull();

    const hostile: StorageLike = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      },
    };
    const h = new SwarmCache(() => hostile, now);
    expect(() => {
      h.set('Q1::en', result());
      h.flush();
    }).not.toThrow();
    expect(h.get('Q1::en')).not.toBeNull();
  });

  /** A swarm row is ~6 KB, so quota pressure is likelier here than in geoCache. */
  it('halves the cold tail and retries once when the quota refuses the blob', () => {
    const storage = new FakeStorage();
    const cache = new SwarmCache(() => storage, now);
    for (const id of ['a', 'b', 'c', 'd']) {
      clock += 10;
      cache.set(`${id}::en`, result(id));
    }
    // Refuse anything holding more than two rows, then accept the retry.
    storage.limit = JSON.stringify({ v: SWARM_CACHE_VERSION, entries: {} }).length + 2 * 400;
    expect(() => cache.flush()).not.toThrow();
    expect(cache.size).toBeLessThan(4);
    expect(cache.get('d::en'), 'the newest row survives the trim').not.toBeNull();
  });

  it('clear() empties both tiers', () => {
    const storage = new FakeStorage();
    const cache = new SwarmCache(() => storage, now);
    cache.set('Q1::en', result());
    cache.flush();
    cache.clear();
    expect(cache.get('Q1::en')).toBeNull();
    expect(storage.getItem(SWARM_CACHE_STORAGE_KEY)).toBeNull();
  });
});
