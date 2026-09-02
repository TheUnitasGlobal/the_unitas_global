'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FEED_REFRESH_MS,
  analyzeShortcut,
  derivePulse,
  type AnalyticsLabels,
  type ShortcutAnalysis,
} from './shortcutAnalytics';
import type { ConstitutionRedesignReport, TrendApiResponse } from './types';

/** Upper bound on one trend round-trip (the 3rd-hit LLM forge can take a
 *  while server-side; the next poll picks its report up regardless). */
const TREND_TIMEOUT_MS = 12_000;

export interface ShortcutFeedState {
  /** the engine pass for the focused query (null until the first pass lands). */
  analysis: ShortcutAnalysis | null;
  /** cumulative global search_trends count for (locale, query). */
  hits: number;
  /** the LLM-forged 6-axis UNITAS deep analysis, once it exists (0원 served). */
  report: ConstitutionRedesignReport | null;
  /** hits crossed the threshold but the forge hasn't landed yet. */
  pending: boolean;
  /** a sync (engine pass + feed poll) is in flight. */
  refreshing: boolean;
  lastSyncAt: number | null;
  /** seconds until the next automatic sync (0 while hidden/paused). */
  nextSyncIn: number;
  refreshNow: () => void;
}

const TICK_MS = 1000;

/**
 * The auto-refresh loop of the shortcut analytics engine, scoped to the
 * ladder tier currently in focus (always the newest tier of the popup).
 *
 * - On a new query: one engine pass + one POST /api/u-ai/trend. Opening a
 *   shortcut IS a free surface search, so it takes part in threshold
 *   assetization exactly like the main search bar does (3rd global open ->
 *   the deep analysis is forged once and served to everyone after, 0원).
 * - Every FEED_REFRESH_MS while the page is visible: a read-only GET poll
 *   (never bumps the counter) + a fresh engine pass, so hits, pulse trend
 *   and the deep report all update in place without a reload.
 * - Hidden tab: the countdown pauses (no wasted network / CPU, per the
 *   low-memory armor) and one sync fires the moment the tab is visible
 *   again if its window elapsed.
 *
 * A monotonic sequence guards every async landing so a tier that was
 * stepped past while its pass was in flight never overwrites the newer one.
 */
export function useShortcutFeed(query: string | null, locale: string, labels: AnalyticsLabels): ShortcutFeedState {
  const [analysis, setAnalysis] = useState<ShortcutAnalysis | null>(null);
  const [hits, setHits] = useState(0);
  const [report, setReport] = useState<ConstitutionRedesignReport | null>(null);
  const [pending, setPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [nextSyncIn, setNextSyncIn] = useState(0);

  const seqRef = useRef(0);
  const hitsRef = useRef(0);
  const dueAtRef = useRef(0);
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  const sync = useCallback(
    async (target: string, mode: 'open' | 'poll') => {
      const seq = ++seqRef.current;
      setRefreshing(true);

      // The trend round-trip and the engine pass run side by side: the
      // offline-deterministic doctrine analysis must land the instant it is
      // ready, never queued behind Postgres / a cold serverless route / an
      // in-flight LLM forge on the 3rd global hit. A hard abort bounds the
      // trend leg so a stalled network can never pin the HUD on "syncing".
      const ctrl = new AbortController();
      const abortTimer = window.setTimeout(() => ctrl.abort(), TREND_TIMEOUT_MS);
      const trendPromise: Promise<TrendApiResponse | null> = (
        mode === 'open'
          ? fetch('/api/u-ai/trend', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ query: target, locale }),
              signal: ctrl.signal,
            })
          : fetch(`/api/u-ai/trend?q=${encodeURIComponent(target)}&locale=${encodeURIComponent(locale)}`, {
              signal: ctrl.signal,
            })
      )
        .then((r) => (r.ok ? (r.json() as Promise<TrendApiResponse>) : null))
        .catch(() => null)
        .finally(() => window.clearTimeout(abortTimer));

      const next = await analyzeShortcut(target, locale, labelsRef.current, hitsRef.current);
      if (seq !== seqRef.current) return;
      setAnalysis(next);
      setRefreshing(false);
      setLastSyncAt(Date.now());
      dueAtRef.current = Date.now() + FEED_REFRESH_MS;
      setNextSyncIn(Math.round(FEED_REFRESH_MS / 1000));

      const trend = await trendPromise;
      if (seq !== seqRef.current || !trend) return;
      const landedHits = typeof trend.hits === 'number' ? trend.hits : hitsRef.current;
      if (landedHits !== hitsRef.current) {
        hitsRef.current = landedHits;
        setHits(landedHits);
        // Re-read the pulse against the global count that just landed.
        setAnalysis({ ...next, pulse: derivePulse(next.query, next.report, next.web, landedHits) });
      }
      if (trend.report) setReport(trend.report);
      setPending(Boolean(trend.pending) && !trend.report);
    },
    [locale],
  );

  // New focus query -> reset and open.
  useEffect(() => {
    seqRef.current += 1;
    setAnalysis(null);
    setHits(0);
    hitsRef.current = 0;
    setReport(null);
    setPending(false);
    setLastSyncAt(null);
    setNextSyncIn(0);
    dueAtRef.current = 0;
    if (!query || query.trim().length < 2) {
      setRefreshing(false);
      return;
    }
    void sync(query, 'open');
  }, [query, sync]);

  // Countdown + auto-refresh loop, paused while the tab is hidden.
  useEffect(() => {
    if (!query || query.trim().length < 2) return;
    const target = query;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        setNextSyncIn(0);
        return;
      }
      if (!dueAtRef.current) return;
      const remaining = Math.max(0, Math.ceil((dueAtRef.current - Date.now()) / 1000));
      setNextSyncIn(remaining);
      if (remaining === 0) {
        dueAtRef.current = 0;
        void sync(target, 'poll');
      }
    };
    const timer = window.setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [query, sync]);

  const refreshNow = useCallback(() => {
    if (!query || query.trim().length < 2) return;
    dueAtRef.current = 0;
    void sync(query, 'poll');
  }, [query, sync]);

  return { analysis, hits, report, pending, refreshing, lastSyncAt, nextSyncIn, refreshNow };
}
