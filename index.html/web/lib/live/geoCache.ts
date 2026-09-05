import type { GeoPlace } from './geoMatch';

/**
 * Intelligent Caching for geo-matching (owner instruction 2026-09-04 round
 * 9): a native-script city search ("라그레인지") costs a Wikipedia search +
 * up to 8 Wikidata P625 look-ups + the gazetteer fan-out -- 5-7 s of
 * external round-trips. That price is paid ONCE per (locale, query) on a
 * device: the resolved rows (localized name, state, country, ISO code,
 * coordinates, population, GeoNames id) are parked in memory AND in
 * localStorage, so every later search of the same place -- this session or
 * any later visit -- renders from this cache in well under 100 ms, with
 * zero network, zero server and zero U-COIN burn. "내 위치" resolutions are
 * cached the same way, keyed on the rounded fix, so a returning visitor's
 * region also snaps in instantly.
 *
 * Two tiers: a module-level Map answers reads in microseconds; the
 * localStorage blob (`unitas.geo.cache.v1`) is hydrated lazily on the first
 * read of a page load and rewritten (coalesced, 500 ms) after changes. LRU
 * eviction on last-use time keeps the blob ≤ GEO_CACHE_MAX_ENTRIES rows;
 * a version bump in GEO_CACHE_VERSION invalidates every stored row at once
 * when the row shape or the resolution pipeline changes. Fail-open
 * throughout: an unavailable / full / corrupt storage degrades to the
 * in-memory tier, never to an error.
 *
 * Pure and injectable (storage + clock) so the eviction / hydration /
 * versioning rules are unit-testable without a browser.
 */

export const GEO_CACHE_VERSION = 'gc-v1';
export const GEO_CACHE_STORAGE_KEY = 'unitas.geo.cache.v1';
/** Rows kept at most -- ~1-2 KB each, so the blob stays far below quota. */
export const GEO_CACHE_MAX_ENTRIES = 240;
/** Coalescing delay before a changed cache is rewritten to storage. */
export const GEO_CACHE_PERSIST_DELAY_MS = 500;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface GeoCacheEntry {
  places: GeoPlace[];
  /** Last use (read or write) -- the LRU clock. */
  at: number;
  hits: number;
}

interface GeoCacheBlob {
  v: string;
  entries: Record<string, GeoCacheEntry>;
}

/** NFKC-folded, whitespace-collapsed, case-insensitive query identity:
 *  "라그레인지 " / "라그레인지" / "LaGrange" / "lagrange" share one row. */
export function canonicalGeoQuery(query: string): string {
  return query.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function geoQueryKey(locale: string, query: string): string {
  return `q::${locale}::${canonicalGeoQuery(query)}`;
}

/** ~1 km cells: two fixes inside the same cell resolve to the same place. */
export function geoCoordKey(locale: string, lat: number, lon: number, approx: boolean): string {
  return `c::${locale}::${lat.toFixed(2)},${lon.toFixed(2)}::${approx ? 'ip' : 'gps'}`;
}

export class GeoCache {
  private readonly memory = new Map<string, GeoCacheEntry>();
  private hydrated = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly storage: () => StorageLike | null,
    private readonly now: () => number = () => Date.now(),
    private readonly maxEntries: number = GEO_CACHE_MAX_ENTRIES,
    private readonly persistDelayMs: number = GEO_CACHE_PERSIST_DELAY_MS,
  ) {}

  /** Rows currently held (after hydration). */
  get size(): number {
    this.hydrate();
    return this.memory.size;
  }

  /** Cached rows for a key, or null on a miss. Bumps the LRU clock. */
  get(key: string): GeoPlace[] | null {
    this.hydrate();
    const entry = this.memory.get(key);
    if (!entry) return null;
    entry.at = this.now();
    entry.hits += 1;
    this.schedulePersist();
    return entry.places;
  }

  /** Parks rows for a key (empty lists are never cached -- a miss must stay
   *  retryable once the network is back). */
  set(key: string, places: GeoPlace[]): void {
    if (places.length === 0) return;
    this.hydrate();
    this.memory.set(key, { places, at: this.now(), hits: 0 });
    this.evict();
    this.schedulePersist();
  }

  has(key: string): boolean {
    this.hydrate();
    return this.memory.has(key);
  }

  clear(): void {
    this.memory.clear();
    this.hydrated = true;
    try {
      this.storage()?.removeItem(GEO_CACHE_STORAGE_KEY);
    } catch {
      // storage unavailable -- memory tier already cleared.
    }
  }

  /** Writes pending changes now (tests / beforeunload). */
  flush(): void {
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persist();
  }

  private hydrate(): void {
    if (this.hydrated) return;
    this.hydrated = true;
    try {
      const raw = this.storage()?.getItem(GEO_CACHE_STORAGE_KEY);
      if (!raw) return;
      const blob = JSON.parse(raw) as Partial<GeoCacheBlob>;
      if (blob.v !== GEO_CACHE_VERSION || !blob.entries || typeof blob.entries !== 'object') {
        // Older row shape / pipeline -- drop it rather than serve stale rows.
        this.storage()?.removeItem(GEO_CACHE_STORAGE_KEY);
        return;
      }
      for (const [key, entry] of Object.entries(blob.entries)) {
        if (!entry || !Array.isArray(entry.places) || entry.places.length === 0) continue;
        if (this.memory.has(key)) continue; // rows written before hydration win
        this.memory.set(key, {
          places: entry.places,
          at: typeof entry.at === 'number' ? entry.at : 0,
          hits: typeof entry.hits === 'number' ? entry.hits : 0,
        });
      }
      this.evict();
    } catch {
      // corrupt / unavailable storage -- memory tier only.
    }
  }

  private evict(): void {
    if (this.memory.size <= this.maxEntries) return;
    const byAge = Array.from(this.memory.entries()).sort((a, b) => a[1].at - b[1].at || a[1].hits - b[1].hits);
    const excess = this.memory.size - this.maxEntries;
    for (let i = 0; i < excess; i++) this.memory.delete(byAge[i][0]);
  }

  private schedulePersist(): void {
    if (this.persistTimer !== null) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persist();
    }, this.persistDelayMs);
  }

  private persist(): void {
    const storage = this.storage();
    if (!storage) return;
    const write = () => {
      const blob: GeoCacheBlob = { v: GEO_CACHE_VERSION, entries: Object.fromEntries(this.memory) };
      storage.setItem(GEO_CACHE_STORAGE_KEY, JSON.stringify(blob));
    };
    try {
      write();
    } catch {
      // Quota exceeded (or storage refused): halve the LRU tail and retry once;
      // if that fails too the memory tier keeps serving this session.
      const byAge = Array.from(this.memory.entries()).sort((a, b) => a[1].at - b[1].at);
      for (let i = 0; i < Math.floor(byAge.length / 2); i++) this.memory.delete(byAge[i][0]);
      try {
        write();
      } catch {
        // give up silently
      }
    }
  }
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    // Accessing localStorage itself throws under some privacy settings.
    return null;
  }
}

/** The app-wide cache instance (browser storage, real clock). */
export const geoCache = new GeoCache(browserStorage);
