import type { SourceId } from '@/lib/uai/sourceRegistry';
import type { SwarmCard } from './swarmTypes';

/**
 * REV-33 M3 (founder directive 2026-09-15) -- INTELLIGENT CACHING for the
 * omni-tech swarm.
 *
 * WHAT IT COSTS TODAY, AND WHY THAT IS NOT ZERO. REV-32 made the door free:
 * the portal card on a U-AI result draws nothing and fetches nothing until
 * someone walks through it. But walking through costs four Wikidata calls,
 * and the absorption loop means a visitor walks through repeatedly --
 * Microsoft, then OpenAI, then back to Microsoft to try another branch. The
 * module-level Map in `useOmniSwarm` already made that second Microsoft free
 * FOR THAT TAB. A reload, a new tab, or tomorrow paid full price again.
 *
 * So this is the third tier, and it is the one the founder asked for:
 * `localStorage`, so a walked path stays walked. 한계 비용 0원 (Codex §2 #160,
 * #309, #409) -- not "cheap", zero, because the second visit issues no
 * request at all.
 *
 * WHY A TTL WHEN geoCache HAS NONE. A city's coordinates do not change; a
 * company's subsidiaries and chief executive do. Seven days is the same
 * clock REV-25's anchor bridge used for a resolved identity: long enough
 * that a week of exploring is free, short enough that an acquisition shows
 * up without the visitor clearing anything.
 *
 * Two tiers below this one still matter and are NOT replaced: the module Map
 * in `useOmniSwarm` answers in microseconds without parsing JSON, and the
 * in-flight map stops two entrances opening the same subject from spending
 * two resolutions. This tier is what survives the page.
 *
 * Fail-open throughout, exactly like `lib/live/geoCache.ts` which this is
 * modelled on: an unavailable, full or corrupt storage degrades to the
 * in-memory tier, never to an error. Pure and injectable (storage + clock)
 * so eviction, expiry, hydration and versioning are unit-tested with no
 * browser.
 */

export const SWARM_CACHE_VERSION = 'sw-v1';
export const SWARM_CACHE_STORAGE_KEY = 'unitas.swarm.cache.v1';
/**
 * Rows kept at most. A subject holds up to ~40 entities across six
 * dimensions at roughly 150 bytes each, so a row is ~6 KB and the blob stays
 * near a quarter of a megabyte -- an order of magnitude under the 5 MB
 * localStorage quota, with room for every other `unitas.*` key beside it.
 */
export const SWARM_CACHE_MAX_ENTRIES = 40;
/** A company's structure changes; a week is the founder's free-exploring window. */
export const SWARM_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Coalescing delay before a changed cache is rewritten to storage. */
export const SWARM_CACHE_PERSIST_DELAY_MS = 500;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** What one walked subject is worth keeping. */
export interface SwarmCachedResult {
  cards: SwarmCard[];
  sources: SourceId[];
  empty: boolean;
}

export interface SwarmCacheEntry {
  result: SwarmCachedResult;
  /** Write time -- the expiry clock. */
  born: number;
  /** Last use (read or write) -- the LRU clock. */
  at: number;
  hits: number;
}

interface SwarmCacheBlob {
  v: string;
  entries: Record<string, SwarmCacheEntry>;
}

/** One subject, in one language. The language is part of the identity
 *  because the dimension entries arrive already localized. */
export function swarmCacheKey(qid: string, lang: string): string {
  return `${qid}::${lang}`;
}

export class SwarmCache {
  private readonly memory = new Map<string, SwarmCacheEntry>();
  private hydrated = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly storage: () => StorageLike | null,
    private readonly now: () => number = () => Date.now(),
    private readonly maxEntries: number = SWARM_CACHE_MAX_ENTRIES,
    private readonly ttlMs: number = SWARM_CACHE_TTL_MS,
    private readonly persistDelayMs: number = SWARM_CACHE_PERSIST_DELAY_MS,
  ) {}

  get size(): number {
    this.hydrate();
    return this.memory.size;
  }

  /** A walked subject, or null on a miss. Bumps the LRU clock. */
  get(key: string): SwarmCachedResult | null {
    this.hydrate();
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (this.expired(entry)) {
      this.memory.delete(key);
      this.schedulePersist();
      return null;
    }
    entry.at = this.now();
    entry.hits += 1;
    this.schedulePersist();
    return entry.result;
  }

  /**
   * Park a walked subject.
   *
   * An EMPTY result is never cached. "Wikidata has no modules for this" is a
   * statement about one moment of one third party, not about the subject, and
   * freezing it for a week would turn a transient outage into a permanent
   * blank field. Same rule geoCache applies to an empty place list.
   */
  set(key: string, result: SwarmCachedResult): void {
    if (!result || result.empty || result.cards.length === 0) return;
    this.hydrate();
    const at = this.now();
    this.memory.set(key, { result, born: at, at, hits: 0 });
    this.evict();
    this.schedulePersist();
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.memory.clear();
    this.hydrated = true;
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    try {
      this.storage()?.removeItem(SWARM_CACHE_STORAGE_KEY);
    } catch {
      // storage unavailable -- the memory tier is already cleared.
    }
  }

  /** Write pending changes now (tests / beforeunload). */
  flush(): void {
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persist();
  }

  private expired(entry: SwarmCacheEntry): boolean {
    return this.now() - entry.born >= this.ttlMs;
  }

  private hydrate(): void {
    if (this.hydrated) return;
    this.hydrated = true;
    try {
      const raw = this.storage()?.getItem(SWARM_CACHE_STORAGE_KEY);
      if (!raw) return;
      const blob = JSON.parse(raw) as Partial<SwarmCacheBlob>;
      if (blob.v !== SWARM_CACHE_VERSION || !blob.entries || typeof blob.entries !== 'object') {
        // Older row shape or a changed decomposition -- drop it rather than
        // draw a field from rows this version cannot vouch for.
        this.storage()?.removeItem(SWARM_CACHE_STORAGE_KEY);
        return;
      }
      for (const [key, entry] of Object.entries(blob.entries)) {
        if (!entry || !entry.result || !Array.isArray(entry.result.cards) || entry.result.cards.length === 0) continue;
        if (this.memory.has(key)) continue; // rows written before hydration win
        const born = typeof entry.born === 'number' ? entry.born : 0;
        const candidate: SwarmCacheEntry = {
          result: {
            cards: entry.result.cards,
            sources: Array.isArray(entry.result.sources) ? entry.result.sources : [],
            empty: false,
          },
          born,
          at: typeof entry.at === 'number' ? entry.at : born,
          hits: typeof entry.hits === 'number' ? entry.hits : 0,
        };
        if (this.expired(candidate)) continue;
        this.memory.set(key, candidate);
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
      const blob: SwarmCacheBlob = { v: SWARM_CACHE_VERSION, entries: Object.fromEntries(this.memory) };
      storage.setItem(SWARM_CACHE_STORAGE_KEY, JSON.stringify(blob));
    };
    try {
      write();
    } catch {
      // Quota exceeded (or storage refused): halve the LRU tail and retry
      // once. A swarm row is large, so this is likelier here than in
      // geoCache -- and still never an error the visitor can see.
      const byAge = Array.from(this.memory.entries()).sort((a, b) => a[1].at - b[1].at);
      for (let i = 0; i < Math.floor(byAge.length / 2); i++) this.memory.delete(byAge[i][0]);
      try {
        write();
      } catch {
        // give up silently -- this session still serves from memory.
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

/** The app-wide swarm cache (browser storage, real clock). */
export const swarmCache = new SwarmCache(browserStorage);
