'use client';

/**
 * REV-21 §3.4 -- the Explore Deeper page feed for one (theme, anchor):
 * cursor-paged forever, cached twice (module LRU + localStorage
 * `unitas.deeper.v1`) under the theme's own TTL, at most two adapter loads
 * in flight across the whole app (Wikimedia calls are additionally
 * serialized inside deeperFetch), aborted on unmount / anchor change.
 * Never throws: a failed page flips `failed` and offers `retry`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { anchorKey, type DeeperAnchor } from './deeperAnchor';
import { loadDeeperPage } from './deeperAdapters';
import { deeperPageKey, deeperTheme, type DeeperContext, type DeeperCursor, type DeeperPage, type DeeperThemeKey } from './deeperThemes';

export const DEEPER_STORAGE_KEY = 'unitas.deeper.v1';
const MEMORY_MAX = 120;
/** localStorage budget (SPEC §12.5): 32 KB per item, 1.5 MB for the namespace. */
const ITEM_MAX_BYTES = 32 * 1024;
const NAMESPACE_MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_CONCURRENT = 2;

interface CachedPage {
  page: DeeperPage;
  at: number;
}

const memory = new Map<string, CachedPage>();

function memoryGet(key: string): CachedPage | undefined {
  const hit = memory.get(key);
  if (hit) {
    // LRU touch.
    memory.delete(key);
    memory.set(key, hit);
  }
  return hit;
}

function memorySet(key: string, value: CachedPage): void {
  memory.set(key, value);
  while (memory.size > MEMORY_MAX) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
}

type Shelf = Record<string, CachedPage>;

function readShelf(): Shelf {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DEEPER_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Shelf) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeShelf(shelf: Shelf): void {
  if (typeof window === 'undefined') return;
  try {
    let entries = Object.entries(shelf).sort((a, b) => b[1].at - a[1].at);
    let json = JSON.stringify(Object.fromEntries(entries));
    // Trim oldest until the namespace fits its budget.
    while (json.length > NAMESPACE_MAX_BYTES && entries.length > 1) {
      entries = entries.slice(0, Math.max(1, Math.floor(entries.length * 0.7)));
      json = JSON.stringify(Object.fromEntries(entries));
    }
    window.localStorage.setItem(DEEPER_STORAGE_KEY, json);
  } catch {
    // QuotaExceededError / private mode: memory LRU only.
  }
}

function cacheGet(key: string, ttlMs: number): DeeperPage | null {
  const now = Date.now();
  const inMemory = memoryGet(key);
  if (inMemory && now - inMemory.at < ttlMs) return inMemory.page;
  const shelf = readShelf();
  const stored = shelf[key];
  if (stored && now - stored.at < ttlMs) {
    memorySet(key, stored);
    return stored.page;
  }
  return null;
}

function cacheSet(key: string, page: DeeperPage): void {
  const entry = { page, at: Date.now() };
  memorySet(key, entry);
  if (JSON.stringify(entry).length > ITEM_MAX_BYTES) return;
  const shelf = readShelf();
  shelf[key] = entry;
  writeShelf(shelf);
}

/* Global concurrency gate (two adapter loads at a time). */
let inFlight = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<() => void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight += 1;
  } else {
    await new Promise<void>((resolve) => waiters.push(resolve));
    inFlight += 1;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    inFlight -= 1;
    const next = waiters.shift();
    if (next) next();
  };
}

export interface DeeperFeedState {
  pages: DeeperPage[];
  loading: boolean;
  failed: boolean;
  /** No further page (the last cursor was null). */
  done: boolean;
  loadMore: () => void;
  retry: () => void;
}

export function useDeeperPage(theme: DeeperThemeKey | null, anchor: DeeperAnchor | null, ctx: Pick<DeeperContext, 'locale' | 'lang' | 'country'>): DeeperFeedState {
  const [pages, setPages] = useState<DeeperPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const cursorRef = useRef<DeeperCursor>(null);
  const busyRef = useRef(false);
  const key = anchor ? anchorKey(anchor) : null;

  const load = useCallback(
    async (cursor: DeeperCursor, seq: number) => {
      if (!theme || !anchor || busyRef.current) return;
      busyRef.current = true;
      const ttl = deeperTheme(theme).ttlMs;
      const cacheKey = deeperPageKey(theme, anchorKey(anchor), ctx, cursor);
      const cached = cacheGet(cacheKey, ttl);
      if (cached) {
        busyRef.current = false;
        if (seq !== seqRef.current) return;
        setPages((prev) => [...prev, cached]);
        cursorRef.current = cached.cursor;
        setDone(cached.cursor === null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setFailed(false);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const release = await acquire();
      try {
        if (controller.signal.aborted || seq !== seqRef.current) return;
        const page = await loadDeeperPage(theme, anchor, { ...ctx, signal: controller.signal }, cursor);
        if (controller.signal.aborted || seq !== seqRef.current) return;
        const failedPage = page.empty && page.cards.length === 0 && page.cursor === null && page.sources.length === 0;
        if (failedPage) {
          setFailed(true);
        } else {
          cacheSet(cacheKey, page);
          setPages((prev) => [...prev, page]);
          cursorRef.current = page.cursor;
          setDone(page.cursor === null);
        }
      } finally {
        release();
        busyRef.current = false;
        if (!controller.signal.aborted && seq === seqRef.current) setLoading(false);
      }
    },
    // ctx is an object literal from the caller; its three strings are the identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, key, ctx.locale, ctx.lang, ctx.country],
  );

  // New (theme, anchor, context) -> reset and load page 1.
  useEffect(() => {
    seqRef.current += 1;
    const seq = seqRef.current;
    abortRef.current?.abort();
    busyRef.current = false;
    cursorRef.current = null;
    setPages([]);
    setLoading(false);
    setFailed(false);
    setDone(false);
    if (!theme || !anchor) return;
    void load(null, seq);
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, key, ctx.locale, ctx.lang, ctx.country]);

  const loadMore = useCallback(() => {
    if (loading || failed || done || cursorRef.current === null) return;
    void load(cursorRef.current, seqRef.current);
  }, [load, loading, failed, done]);

  const retry = useCallback(() => {
    setFailed(false);
    void load(cursorRef.current, seqRef.current);
  }, [load]);

  return { pages, loading, failed, done, loadMore, retry };
}
