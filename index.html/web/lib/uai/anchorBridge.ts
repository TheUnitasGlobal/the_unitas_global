/**
 * REV-25 MISSION 1 -- THE ANCHOR BRIDGE (founder directive 2026-09-13).
 *
 * THE DEFECT IT CLOSES. Every "더 깊이 탐색" lens takes an ANCHOR, and
 * `themesFor()` drops any theme whose `needs` the anchor cannot feed. Thirteen
 * of the fifteen themes -- `bigTechPulse` and the whole omni-tech swarm field
 * among them -- declare `needs: 'entity'`, which means one thing: the anchor
 * must carry a Wikidata QID.
 *
 * The U-AI tower builds its anchor as
 *   `surface.web.anchor ? entityAnchor(...) : textAnchor(surface.query, lang)`
 * (components/uai/UaiHyperStream.tsx). Live web synthesis is a best-effort,
 * keyless, CORS-only pass: when it times out, is disabled, or simply resolves
 * no item for the query, `surface.web.anchor` is undefined and the tower falls
 * to a TEXT anchor. Measured on the deployed REV-24 build:
 * `data-anchor-kind="text"`, zero theme tiles, "아직 연결된 존재가 없습니다" --
 * the swarm existed and was unreachable. The same hole sits under the module
 * rankings (`UnitasModuleRankings` hands a literal `textAnchor`), the global
 * ranking fallback, and any keyword tier whose analysis came back anchorless.
 *
 * WHAT THIS IS. A bridge, not a second resolver. The identity pipeline stays
 * exactly the one REV-21 §2.2 hardened -- `resolveEntity()` on the VISITOR's
 * own-language Wikipedia, with the Wikidata label fallback and its
 * excluded-class gate behind it -- because that pipeline is what closed the
 * '공기 → Thai film' drift and a parallel path would reopen it. This module
 * decides WHEN that resolution is worth spending, caches the answer so it is
 * spent at most once per (term, language) per device, and turns the result
 * back into an anchor the theme registry accepts.
 *
 * 한계비용 0원 (Codex §2 #160, #309, #409). Three tiers guard the network:
 *  1. a module-level in-flight map, because the tower mounts up to
 *     STREAM_DOM_PAGES ExploreDeeper blocks on the SAME anchor -- without it
 *     one keyword would fire a dozen identical resolutions;
 *  2. a module-level Map, answering repeats in microseconds;
 *  3. a localStorage blob (`unitas.anchor.bridge.v1`), so a returning visitor
 *     pays nothing at all. MISSES ARE CACHED TOO -- a term Wikipedia has no
 *     page for must not re-ask on every render -- on a shorter clock, since a
 *     miss is a statement about today's corpus, not about identity.
 *
 * Pure and injectable (storage, clock, resolver): every rule here is unit
 * tested with no browser and no fetch. Fail-open throughout -- an unavailable,
 * full or corrupt storage degrades to the memory tier, never to an error, and
 * a failed resolution simply leaves the text anchor standing.
 */
import { entityAnchor, type DeeperAnchor } from './deeperAnchor';
import { isQid, resolveEntity, type EntityCoord, type ResolvedEntity } from './entityResolve';

export const ANCHOR_BRIDGE_VERSION = 'ab-v1';
export const ANCHOR_BRIDGE_STORAGE_KEY = 'unitas.anchor.bridge.v1';
/** Rows kept at most (~120 bytes each) -- the blob stays far below quota. */
export const ANCHOR_BRIDGE_MAX_ENTRIES = 200;
/** A resolved identity is stable: hold it for a week. */
export const ANCHOR_BRIDGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A miss is a statement about the corpus today, not about identity. */
export const ANCHOR_BRIDGE_MISS_TTL_MS = 6 * 60 * 60 * 1000;
/** Coalescing delay before a changed cache is rewritten to storage. */
export const ANCHOR_BRIDGE_PERSIST_DELAY_MS = 500;
/** Longer than this is a sentence, not a subject. */
export const ANCHOR_BRIDGE_MAX_TERM_CHARS = 100;
export const ANCHOR_BRIDGE_MAX_TERM_WORDS = 12;

export interface BridgeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The identity a bridged term carries -- exactly what an anchor needs. */
export interface AnchorBridgeHit {
  qid: string;
  localeTitle: string;
  enTitle?: string;
  lang: string;
  coord?: EntityCoord;
}

export interface AnchorBridgeRow {
  /** `null` = a cached MISS (resolved to nothing, or to a disambiguation). */
  hit: AnchorBridgeHit | null;
  /** Write time -- the TTL and LRU clock. */
  at: number;
}

interface AnchorBridgeBlob {
  v: string;
  entries: Record<string, AnchorBridgeRow>;
}

/* ------------------------------------------------------------------ */
/* Pure rules                                                          */
/* ------------------------------------------------------------------ */

/** Punctuation-only input ("...", "??", "· ·") is never a subject. */
const PUNCT_ONLY = /^[\s!-/:-@[-`{-~·…—–「」『』【】《》、。，．？！]+$/;

/**
 * Is this term worth one Wikipedia resolution? A single CJK character is a
 * real subject -- the shortcut ladder already admits one (lib/uai/shortcutCore)
 * -- so length alone cannot be the gate; what disqualifies a term is carrying
 * no word characters at all, or being a sentence rather than a name.
 */
export function bridgeableTerm(term: string): boolean {
  const t = term.trim();
  if (!t || t.length > ANCHOR_BRIDGE_MAX_TERM_CHARS) return false;
  if (PUNCT_ONLY.test(t)) return false;
  return t.split(/\s+/).length <= ANCHOR_BRIDGE_MAX_TERM_WORDS;
}

/**
 * Should this anchor be bridged at all? Gated on the CAPABILITY, not on the
 * label: an `entity` anchor that never got a QID is exactly as unable to feed
 * `bigTechPulse` as a `text` one, and both must be repaired. A place or
 * country anchor already carries its own identifier for the themes it feeds,
 * and a disambiguation belongs to the meaning chooser -- guessing there is the
 * drift REV-21 §2.2 closed.
 */
export function needsAnchorBridge(anchor: DeeperAnchor | null | undefined): boolean {
  if (!anchor || anchor.qid || anchor.disambiguation) return false;
  if (anchor.kind === 'place' || anchor.kind === 'country') return false;
  return bridgeableTerm(anchor.term);
}

/** NFKC-folded, whitespace-collapsed, case-insensitive term identity. */
export function canonicalBridgeTerm(term: string): string {
  return term.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function bridgeKey(term: string, lang: string): string {
  return `${lang}|${canonicalBridgeTerm(term)}`;
}

/** A resolution is usable only when it carries a QID and is not a meaning list. */
export function bridgeHitOf(entity: ResolvedEntity | null | undefined): AnchorBridgeHit | null {
  if (!entity || entity.disambiguation || !isQid(entity.qid)) return null;
  return {
    qid: entity.qid,
    localeTitle: entity.localeTitle,
    ...(entity.enTitle ? { enTitle: entity.enTitle } : {}),
    lang: entity.lang,
    ...(entity.coord ? { coord: entity.coord } : {}),
  };
}

/**
 * The upgraded anchor. The visitor's own wording stays the `term` -- it is
 * what the outbound row searches and what they typed -- while the identity
 * (QID, exact titles, coordinate) rides underneath, which is all the theme
 * registry reads. A hit that carries a coordinate becomes a PLACE anchor, so
 * a bridged city gains the weather lenses too; `entityAnchor` already makes
 * that call and re-deciding it here would be a second opinion on one rule.
 */
export function applyAnchorBridge(anchor: DeeperAnchor, hit: AnchorBridgeHit): DeeperAnchor {
  const upgraded = entityAnchor(
    {
      localeTitle: hit.localeTitle,
      enTitle: hit.enTitle,
      qid: hit.qid,
      disambiguation: false,
      lang: hit.lang,
      ...(hit.coord ? { coord: hit.coord } : {}),
    },
    anchor.lang,
    anchor.term,
  );
  return anchor.countryCode ? { ...upgraded, countryCode: anchor.countryCode } : upgraded;
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

export class AnchorBridgeCache {
  private entries = new Map<string, AnchorBridgeRow>();
  private hydrated = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private storage: BridgeStorageLike | null,
    private now: () => number = () => Date.now(),
  ) {}

  private hydrate(): void {
    if (this.hydrated) return;
    this.hydrated = true;
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(ANCHOR_BRIDGE_STORAGE_KEY);
      if (!raw) return;
      const blob = JSON.parse(raw) as AnchorBridgeBlob;
      if (!blob || blob.v !== ANCHOR_BRIDGE_VERSION || typeof blob.entries !== 'object') {
        this.storage.removeItem(ANCHOR_BRIDGE_STORAGE_KEY);
        return;
      }
      for (const [k, row] of Object.entries(blob.entries)) {
        if (row && typeof row.at === 'number') this.entries.set(k, { hit: row.hit ?? null, at: row.at });
      }
    } catch {
      try {
        this.storage.removeItem(ANCHOR_BRIDGE_STORAGE_KEY);
      } catch {
        /* fail-open: the memory tier still serves this session */
      }
    }
  }

  private fresh(row: AnchorBridgeRow): boolean {
    return this.now() - row.at < (row.hit ? ANCHOR_BRIDGE_TTL_MS : ANCHOR_BRIDGE_MISS_TTL_MS);
  }

  /** `undefined` = unknown (go and resolve); `null` = a cached miss. */
  get(term: string, lang: string): AnchorBridgeHit | null | undefined {
    this.hydrate();
    const key = bridgeKey(term, lang);
    const row = this.entries.get(key);
    if (!row) return undefined;
    if (!this.fresh(row)) {
      this.entries.delete(key);
      return undefined;
    }
    return row.hit;
  }

  set(term: string, lang: string, hit: AnchorBridgeHit | null): void {
    this.hydrate();
    this.entries.set(bridgeKey(term, lang), { hit, at: this.now() });
    this.evict();
    this.schedulePersist();
  }

  private evict(): void {
    if (this.entries.size <= ANCHOR_BRIDGE_MAX_ENTRIES) return;
    const rows = Array.from(this.entries.entries()).sort((a, b) => a[1].at - b[1].at);
    for (const [key] of rows.slice(0, this.entries.size - ANCHOR_BRIDGE_MAX_ENTRIES)) this.entries.delete(key);
  }

  private schedulePersist(): void {
    if (!this.storage || this.timer !== null) return;
    const write = () => {
      this.timer = null;
      this.flush();
    };
    if (typeof setTimeout === 'function') this.timer = setTimeout(write, ANCHOR_BRIDGE_PERSIST_DELAY_MS);
    else write();
  }

  /** Write the blob now (the coalesced timer, and tests). */
  flush(): void {
    if (!this.storage) return;
    try {
      const entries: Record<string, AnchorBridgeRow> = {};
      for (const [k, v] of this.entries) entries[k] = v;
      this.storage.setItem(ANCHOR_BRIDGE_STORAGE_KEY, JSON.stringify({ v: ANCHOR_BRIDGE_VERSION, entries } as AnchorBridgeBlob));
    } catch {
      /* quota / private mode: the memory tier still serves this session */
    }
  }

  /** Test seam. */
  clear(): void {
    this.entries.clear();
    this.hydrated = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  get size(): number {
    this.hydrate();
    return this.entries.size;
  }
}

function browserStorage(): BridgeStorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const anchorBridgeCache = new AnchorBridgeCache(browserStorage());

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

/** In-flight de-duplication: the tower mounts one ExploreDeeper PER PAGE. */
const inflight = new Map<string, Promise<AnchorBridgeHit | null>>();

/** A resolution that has not answered by now is not going to. */
export const ANCHOR_BRIDGE_TIMEOUT_MS = 8000;

export interface AnchorBridgeOptions {
  cache?: AnchorBridgeCache;
  /** Injected for tests; defaults to the REV-21 §2.2 resolver. */
  resolve?: (term: string, lang: string, signal: AbortSignal) => Promise<ResolvedEntity | null>;
  timeoutMs?: number;
}

/**
 * Resolve one term to an identity, at most once per (term, language) per
 * device -- and at most once at a time per process. Returns `null` for a term
 * with no usable entity, which is cached exactly as a hit is.
 *
 * The resolution owns its OWN abort controller and is deliberately NOT
 * cancellable by a caller: the in-flight promise is shared across every
 * ExploreDeeper block mounted on the same anchor, so one block unmounting
 * must not abort the work the other eleven are still waiting on. Callers
 * stop listening; the shared resolution finishes and fills the cache.
 */
export async function bridgeTerm(
  term: string,
  lang: string,
  { cache = anchorBridgeCache, resolve = resolveEntity, timeoutMs = ANCHOR_BRIDGE_TIMEOUT_MS }: AnchorBridgeOptions = {},
): Promise<AnchorBridgeHit | null> {
  if (!bridgeableTerm(term)) return null;
  const cached = cache.get(term, lang);
  if (cached !== undefined) return cached;
  const key = bridgeKey(term, lang);
  const pending = inflight.get(key);
  if (pending) return pending;
  const run = (async () => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const hit = bridgeHitOf(await resolve(term.trim(), lang, controller.signal));
      // A timeout is not an answer: caching it would poison the term.
      if (!timedOut) cache.set(term, lang, hit);
      return hit;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      inflight.delete(key);
    }
  })();
  inflight.set(key, run);
  return run;
}

/**
 * The bridge in one call: hand it an anchor, get back an ENTITY anchor when
 * the term resolves, or `null` when nothing changes. Never throws.
 */
export async function bridgeAnchor(anchor: DeeperAnchor | null | undefined, opts: AnchorBridgeOptions = {}): Promise<DeeperAnchor | null> {
  if (!anchor || !needsAnchorBridge(anchor)) return null;
  const hit = await bridgeTerm(anchor.term, anchor.lang, opts);
  return hit ? applyAnchorBridge(anchor, hit) : null;
}

/** Test seam: drop every in-flight promise. */
export function __resetAnchorBridgeInflight(): void {
  inflight.clear();
}
