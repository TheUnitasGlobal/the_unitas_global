'use client';

/**
 * REV-21 §5C / SPEC §12.7 -- the infinity stream feed for one submitted
 * query: pages ≥ 1 arrive through `GET /api/u-ai/stream` (CDN-cached, 1 h /
 * swr 24 h) with the isomorphic `buildStreamPage` as the browser fallback,
 * cached on the device (`unitas.uai.stream.v1`, LRU 120, 24 h / news 15 m)
 * and paged by the IO sentinel. The engagement charter (§12.7) is enforced
 * HERE, not in the UI: a soft pause every 10 pages, a hard cap at 60, no
 * paging while the tab is hidden, and depth / engraving kept on the device
 * only (D-30) with no loss warnings.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { anchorKey, type DeeperAnchor } from '../deeperAnchor';
import type { ConstitutionScore } from '../types';
import { INITIAL_LADDER_CURSOR, buildStreamPage, type LadderCursor } from './dataLadder';
import { STREAM_PAGE_CAP, STREAM_SOFT_PAUSE_EVERY, type StreamPage } from './streamTypes';

export const STREAM_STORAGE_KEY = 'unitas.uai.stream.v1';
const MEMORY_MAX = 120;
const PAGE_TTL_MS = 24 * 60 * 60 * 1000;
const NEWS_TTL_MS = 15 * 60 * 1000;
const NAMESPACE_MAX_BYTES = 1.5 * 1024 * 1024;

interface CachedPage {
  page: StreamPage;
  cursor: LadderCursor;
  at: number;
}

const memory = new Map<string, CachedPage>();

function cacheKey(query: string, anchor: DeeperAnchor, locale: string, country: string, page: number): string {
  return `${locale}|${country}|${anchorKey(anchor)}|${query.trim().toLowerCase()}|p${page}`;
}

function ttlFor(page: StreamPage): number {
  return page.cards.some((c) => c.kind === 'news') ? NEWS_TTL_MS : PAGE_TTL_MS;
}

interface Shelf {
  pages?: Record<string, CachedPage>;
  /** D-30: depth (deepest page seen) + engraving tier per query -- device only. */
  depth?: Record<string, { pages: number; at: number }>;
}

function readShelf(): Shelf {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STREAM_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Shelf) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeShelf(shelf: Shelf): void {
  if (typeof window === 'undefined') return;
  try {
    let entries = Object.entries(shelf.pages ?? {}).sort((a, b) => b[1].at - a[1].at).slice(0, MEMORY_MAX);
    let json = JSON.stringify({ ...shelf, pages: Object.fromEntries(entries) });
    while (json.length > NAMESPACE_MAX_BYTES && entries.length > 1) {
      entries = entries.slice(0, Math.max(1, Math.floor(entries.length * 0.7)));
      json = JSON.stringify({ ...shelf, pages: Object.fromEntries(entries) });
    }
    window.localStorage.setItem(STREAM_STORAGE_KEY, json);
  } catch {
    // quota / private mode: memory only
  }
}

function cacheGet(key: string): CachedPage | null {
  const now = Date.now();
  const hit = memory.get(key) ?? readShelf().pages?.[key];
  if (hit && now - hit.at < ttlFor(hit.page)) {
    memory.set(key, hit);
    return hit;
  }
  return null;
}

function cacheSet(key: string, value: CachedPage): void {
  memory.set(key, value);
  while (memory.size > MEMORY_MAX) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
  const shelf = readShelf();
  shelf.pages = { ...(shelf.pages ?? {}), [key]: value };
  writeShelf(shelf);
}

/** Engraving tiers by depth (device-local, cosmetic, free -- charter ③). */
export type EngraveTier = 'spark' | 'orbit' | 'nexus' | 'singularity';
export function engraveTier(pages: number): EngraveTier {
  if (pages >= 40) return 'singularity';
  if (pages >= 20) return 'nexus';
  if (pages >= 8) return 'orbit';
  return 'spark';
}

function readDepth(query: string): number {
  return readShelf().depth?.[query.trim().toLowerCase()]?.pages ?? 0;
}

function writeDepth(query: string, pages: number): void {
  const shelf = readShelf();
  const key = query.trim().toLowerCase();
  const prev = shelf.depth?.[key]?.pages ?? 0;
  if (pages <= prev) return;
  shelf.depth = { ...(shelf.depth ?? {}), [key]: { pages, at: Date.now() } };
  // keep the depth ledger small
  const entries = Object.entries(shelf.depth).sort((a, b) => b[1].at - a[1].at).slice(0, 200);
  shelf.depth = Object.fromEntries(entries);
  writeShelf(shelf);
}

export interface HyperStreamState {
  pages: StreamPage[];
  loading: boolean;
  /** Three thin pages in a row -- the UI offers retry / widen. */
  stalled: boolean;
  /** Soft pause (D-29): the visitor taps '계속 탐색' to go on. */
  paused: boolean;
  /** Page cap reached (§12.7 p60). */
  capped: boolean;
  /** Deepest page ever reached for this query on this device. */
  depth: number;
  tier: EngraveTier;
  loadMore: () => void;
  resume: () => void;
  retry: () => void;
}

export interface HyperStreamOptions {
  query: string | null;
  anchor: DeeperAnchor | null;
  locale: string;
  lang: string;
  country: string;
  constitution: readonly ConstitutionScore[];
  /** Prefer the same-origin route (CDN cache) before the browser fallback. */
  useRoute?: boolean;
}

interface RouteResponse {
  ok: boolean;
  page?: StreamPage;
  cursor?: LadderCursor;
}

async function fetchPage(query: string, page: number, anchor: DeeperAnchor, opts: HyperStreamOptions, cursor: LadderCursor, signal: AbortSignal): Promise<{ page: StreamPage; cursor: LadderCursor } | null> {
  if (opts.useRoute !== false && anchor.qid) {
    try {
      const q = new URLSearchParams({ q: query, locale: opts.locale, country: opts.country, page: String(page), qid: anchor.qid });
      if (anchor.enTitle) q.set('enTitle', anchor.enTitle);
      if (anchor.localeTitle) q.set('localeTitle', anchor.localeTitle);
      q.set('cursor', JSON.stringify(cursor));
      const res = await fetch(`/api/u-ai/stream?${q.toString()}`, { signal });
      if (res.ok) {
        const json = (await res.json()) as RouteResponse;
        if (json.ok && json.page && json.cursor) return { page: json.page, cursor: json.cursor };
      }
    } catch {
      // fall through to the browser fallback
    }
  }
  if (signal.aborted) return null;
  const built = await buildStreamPage(query, page, anchor, { locale: opts.locale, lang: opts.lang, country: opts.country, constitution: opts.constitution, signal }, cursor);
  return { page: built.page, cursor: built.cursor };
}

export function useHyperStream(opts: HyperStreamOptions): HyperStreamState {
  const { query, anchor, locale, country } = opts;
  const [pages, setPages] = useState<StreamPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [capped, setCapped] = useState(false);
  const [depth, setDepth] = useState(0);
  const cursorRef = useRef<LadderCursor>(INITIAL_LADDER_CURSOR);
  const thinRunRef = useRef(0);
  const busyRef = useRef(false);
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const key = query && anchor ? `${query}|${anchorKey(anchor)}|${locale}|${country}` : null;

  // New query -> reset everything (page 0 is rendered by the component).
  useEffect(() => {
    seqRef.current += 1;
    abortRef.current?.abort();
    busyRef.current = false;
    cursorRef.current = INITIAL_LADDER_CURSOR;
    thinRunRef.current = 0;
    setPages([]);
    setLoading(false);
    setStalled(false);
    setPaused(false);
    setCapped(false);
    setDepth(query ? readDepth(query) : 0);
    return () => abortRef.current?.abort();
  }, [key, query]);

  const load = useCallback(
    async (nextPage: number) => {
      const o = optsRef.current;
      if (!o.query || !o.anchor || busyRef.current) return;
      if (nextPage > STREAM_PAGE_CAP) {
        setCapped(true);
        return;
      }
      busyRef.current = true;
      const seq = seqRef.current;
      const cacheId = cacheKey(o.query, o.anchor, o.locale, o.country, nextPage);
      const cached = cacheGet(cacheId);
      let result: { page: StreamPage; cursor: LadderCursor } | null = cached ? { page: cached.page, cursor: cached.cursor } : null;
      if (!result) {
        setLoading(true);
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          result = await fetchPage(o.query, nextPage, o.anchor, o, cursorRef.current, controller.signal);
        } catch {
          result = null;
        }
        if (controller.signal.aborted || seq !== seqRef.current) {
          busyRef.current = false;
          return;
        }
        if (result) cacheSet(cacheId, { page: result.page, cursor: result.cursor, at: Date.now() });
      }
      busyRef.current = false;
      setLoading(false);
      if (!result) {
        setStalled(true);
        return;
      }
      cursorRef.current = result.cursor;
      thinRunRef.current = result.page.thin ? thinRunRef.current + 1 : 0;
      setStalled(thinRunRef.current >= 3);
      setPages((prev) => [...prev, result!.page]);
      writeDepth(o.query, nextPage);
      setDepth((d) => Math.max(d, nextPage));
      if (nextPage % STREAM_SOFT_PAUSE_EVERY === 0) setPaused(true);
      if (nextPage >= STREAM_PAGE_CAP) setCapped(true);
    },
    [],
  );

  const loadMore = useCallback(() => {
    if (loading || paused || capped || stalled || typeof document !== 'undefined' && document.hidden) return;
    const nextPage = (pages[pages.length - 1]?.page ?? 0) + 1;
    void load(nextPage);
  }, [loading, paused, capped, stalled, pages, load]);

  const resume = useCallback(() => {
    setPaused(false);
  }, []);

  const retry = useCallback(() => {
    thinRunRef.current = 0;
    setStalled(false);
    const nextPage = (pages[pages.length - 1]?.page ?? 0) + 1;
    void load(nextPage);
  }, [pages, load]);

  return { pages, loading, stalled, paused, capped, depth, tier: engraveTier(depth), loadMore, resume, retry };
}
