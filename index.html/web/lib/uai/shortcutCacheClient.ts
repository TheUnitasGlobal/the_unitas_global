'use client';

import {
  SHORTCUT_CACHE_TTL_MS,
  analyzeShortcut,
  derivePulse,
  type AnalyticsLabels,
  type ShortcutAnalysis,
  type ShortcutCacheApiResponse,
} from './shortcutAnalytics';

/** Upper bound on one cache round-trip. A miss synthesizes inline server-side
 *  (~5s worst case); a hit is a CDN answer in milliseconds. */
const CACHE_TIMEOUT_MS = 12_000;

export interface LoadOptions {
  /** the manual 갱신 런처 -- bypasses the CDN and asks the origin to
   *  re-synthesize if the parked snapshot is past its cooldown. */
  refresh?: boolean;
}

export interface LoadedShortcut {
  analysis: ShortcutAnalysis;
  /** when the next nightly synthesis of this tier is due (null = local). */
  nextRefreshAt: number | null;
  /** the manual refresh was inside the cooldown -> the cache was served. */
  cooldown: boolean;
}

/**
 * Load one ladder tier from the 24h sovereign cache. This is THE normal path
 * of the shortcut engine now: one GET, answered by the Vercel CDN or the
 * parked Postgres snapshot -- no browser-side synthesis, no external fetch,
 * no LLM. Fail-open: any transport failure falls back to the local engine
 * pass (`source: 'local'`) so a popup never renders empty.
 */
export async function loadShortcutAnalysis(
  query: string,
  locale: string,
  labels: AnalyticsLabels,
  { refresh = false }: LoadOptions = {},
): Promise<LoadedShortcut> {
  const trimmed = query.trim();
  const params = new URLSearchParams({ q: trimmed, locale });
  if (refresh) {
    params.set('refresh', '1');
    params.set('t', String(Date.now()));
  }

  const ctrl = new AbortController();
  const abortTimer = window.setTimeout(() => ctrl.abort(), CACHE_TIMEOUT_MS);
  let payload: ShortcutCacheApiResponse | null = null;
  try {
    const res = await fetch(`/api/u-ai/shortcut-cache?${params.toString()}`, {
      signal: ctrl.signal,
      cache: refresh ? 'no-store' : 'default',
    });
    payload = res.ok ? ((await res.json()) as ShortcutCacheApiResponse) : null;
  } catch {
    payload = null;
  } finally {
    window.clearTimeout(abortTimer);
  }

  if (payload?.ok && payload.snapshot) {
    const { snapshot } = payload;
    return {
      analysis: {
        query: snapshot.query,
        report: snapshot.report,
        web: snapshot.web,
        keywords: snapshot.keywords,
        pulse: derivePulse(snapshot.query, snapshot.report, snapshot.web, payload.hits),
        generatedAt: Date.now(),
        deep: payload.deep,
        hits: payload.hits,
        synthesizedAt: payload.synthesizedAt,
        source: payload.source,
      },
      nextRefreshAt: payload.nextRefreshAt ?? snapshot.synthesizedAt + SHORTCUT_CACHE_TTL_MS,
      cooldown: payload.source === 'cooldown',
    };
  }

  const analysis = await analyzeShortcut(trimmed, locale, labels, 0);
  return { analysis, nextRefreshAt: null, cooldown: false };
}
