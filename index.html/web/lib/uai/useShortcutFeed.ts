'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadShortcutAnalysis } from './shortcutCacheClient';
import { isViableShortcutQuery } from './shortcutCore';
import type { AnalyticsLabels, ShortcutAnalysis, ShortcutAnalysisSource } from './shortcutAnalytics';
import type { ConstitutionRedesignReport } from './types';

export interface ShortcutFeedState {
  /** the served tier (null until the first load lands). */
  analysis: ShortcutAnalysis | null;
  /** sampled global open count for (locale, query). */
  hits: number;
  /** the LLM-forged 6-axis UNITAS deep analysis, once the batch parked it (0원). */
  report: ConstitutionRedesignReport | null;
  /** no deep analysis yet -- it is queued for the nightly forge. */
  pending: boolean;
  /** a load (cache read or manual refresh) is in flight. */
  refreshing: boolean;
  lastSyncAt: number | null;
  /** where the served tier came from. */
  source: ShortcutAnalysisSource | null;
  /** when the served snapshot was synthesized (null for a local pass). */
  synthesizedAt: number | null;
  /** seconds until the next nightly synthesis of this tier (0 = unknown). */
  nextSyncIn: number;
  /** the last manual refresh hit the cooldown -> the cache was served. */
  cooldown: boolean;
  /** the manual 갱신 런처. */
  refreshNow: () => void;
}

/** The countdown is a day-scale figure; a 30s tick is plenty. */
const TICK_MS = 30_000;

/**
 * Feed state of one ladder tier under the 24h sovereign caching engine.
 *
 * - On a new query: ONE GET to /api/u-ai/shortcut-cache. The Vercel CDN or
 *   the parked Postgres snapshot answers -- no polling, no browser-side
 *   synthesis, no external fetch, no LLM. Cost per visit: 0원.
 * - `refreshNow` is the manual refresh launcher: it bypasses the CDN and
 *   lets the origin re-synthesize the tier if the snapshot is past its
 *   10-min cooldown (otherwise the cache is served and `cooldown` flips on).
 * - `nextSyncIn` counts down to the tier's next nightly synthesis so the
 *   HUD can say when the batch will refresh it, ticking every 30s.
 *
 * A monotonic sequence guards every async landing so a tier that was
 * stepped past while its load was in flight never overwrites the newer one.
 */
export function useShortcutFeed(query: string | null, locale: string, labels: AnalyticsLabels): ShortcutFeedState {
  const [analysis, setAnalysis] = useState<ShortcutAnalysis | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [nextSyncIn, setNextSyncIn] = useState(0);
  const [cooldown, setCooldown] = useState(false);

  const seqRef = useRef(0);
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  const load = useCallback(
    async (target: string, refresh: boolean) => {
      const seq = ++seqRef.current;
      setRefreshing(true);
      const loaded = await loadShortcutAnalysis(target, locale, labelsRef.current, { refresh });
      if (seq !== seqRef.current) return;
      setAnalysis(loaded.analysis);
      setNextRefreshAt(loaded.nextRefreshAt);
      setCooldown(loaded.cooldown);
      setRefreshing(false);
      setLastSyncAt(Date.now());
    },
    [locale],
  );

  // New focus query -> reset and load from the cache.
  useEffect(() => {
    seqRef.current += 1;
    setAnalysis(null);
    setLastSyncAt(null);
    setNextRefreshAt(null);
    setNextSyncIn(0);
    setCooldown(false);
    if (!query || !isViableShortcutQuery(query)) {
      setRefreshing(false);
      return;
    }
    void load(query, false);
  }, [query, load]);

  // Countdown to the next nightly synthesis (display only -- nothing fires).
  useEffect(() => {
    if (!nextRefreshAt) {
      setNextSyncIn(0);
      return;
    }
    const tick = () => setNextSyncIn(Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [nextRefreshAt]);

  const refreshNow = useCallback(() => {
    if (!query || !isViableShortcutQuery(query)) return;
    void load(query, true);
  }, [query, load]);

  return {
    analysis,
    hits: analysis?.hits ?? 0,
    report: analysis?.deep ?? null,
    pending: analysis ? analysis.source !== 'local' && !analysis.deep : false,
    refreshing,
    lastSyncAt,
    source: analysis?.source ?? null,
    synthesizedAt: analysis?.synthesizedAt ?? null,
    nextSyncIn,
    cooldown,
    refreshNow,
  };
}
