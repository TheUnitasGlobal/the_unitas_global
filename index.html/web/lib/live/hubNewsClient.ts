'use client';

import { useEffect, useState } from 'react';
import type { HotNewsItem } from '@/lib/live/hotNews';
import type { HubNewsResponse } from '@/lib/live/hubNews';
import type { HubThemeKey } from '@/lib/live/hubThemes';

/** Client-side memo per (locale, theme) so the rotating strip, the deep
 *  modal and the search-suggestion discovery chips never fetch the same
 *  theme twice inside the CDN window. */
const CLIENT_TTL_MS = 10 * 60 * 1000;

interface Cached {
  items: HotNewsItem[];
  term: string;
  fetchedAt: number;
}

const cache = new Map<string, Cached>();
const inflight = new Map<string, Promise<Cached>>();

export interface HubHeadlines {
  items: HotNewsItem[];
  term: string;
  fetchedAt: number | null;
  loading: boolean;
  refresh: () => void;
}

async function load(locale: string, theme: HubThemeKey, force: boolean): Promise<Cached> {
  const key = `${locale}:${theme}`;
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.fetchedAt < CLIENT_TTL_MS) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    try {
      const res = await fetch(`/api/live/hub-news?locale=${encodeURIComponent(locale)}&theme=${theme}`, {
        cache: force ? 'no-store' : 'default',
      });
      const body = (await res.json()) as HubNewsResponse;
      const next: Cached = { items: body.items ?? [], term: body.term ?? '', fetchedAt: Date.now() };
      // Keep the previous list rather than blanking the card on a bad hop.
      if (next.items.length === 0 && hit) return { ...hit, fetchedAt: Date.now() };
      cache.set(key, next);
      return next;
    } catch {
      return hit ?? { items: [], term: '', fetchedAt: Date.now() };
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Headlines for one hub theme. `refreshMs` (optional) re-fetches on an
 *  interval while the consumer is mounted -- the deep modal's live pulse. */
export function useHubHeadlines(theme: HubThemeKey | null, locale: string, refreshMs?: number): HubHeadlines {
  const key = theme ? `${locale}:${theme}` : null;
  const [state, setState] = useState<Cached | null>(() => (key ? cache.get(key) ?? null : null));
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!theme) return;
    let cancelled = false;
    const cached = cache.get(`${locale}:${theme}`);
    if (cached) setState(cached);
    setLoading(!cached);
    void load(locale, theme, tick > 0).then((next) => {
      if (cancelled) return;
      setState(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [theme, locale, tick]);

  useEffect(() => {
    if (!theme || !refreshMs) return;
    const id = window.setInterval(() => setTick((n) => n + 1), refreshMs);
    return () => window.clearInterval(id);
  }, [theme, refreshMs]);

  return {
    items: state?.items ?? [],
    term: state?.term ?? '',
    fetchedAt: state?.fetchedAt ?? null,
    loading,
    refresh: () => setTick((n) => n + 1),
  };
}
