'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useWallet } from '@/components/wallet/WalletProvider';
import { analyzeSurface } from './heuristics';
import { synthesizeWeb } from './webSynthesis';
import { recordBrainGrid, loadBrainGrid, clearBrainGrid, type BrainGridEntry } from './brainGrid';
import type { SurfaceReport } from './types';

export type UaiPhase = 'idle' | 'surface-loading' | 'surface';

interface RunSurfaceOptions {
  tEcosystems: (key: string) => string;
  context?: string;
  /** REV-21 §5B / §12.6: the entity behind a ladder row the visitor tapped
   *  -- pins the synthesis anchor so a homonym title never drifts. */
  qid?: string;
}

/**
 * Orchestrates the U-AI search: an instant client-side surface analysis,
 * free, and nothing else.
 *
 * REV-23 M2.2 (founder directive 2026-09-13): the second, coin-burning tier
 * -- "심층 통찰" / The VOID -- is deleted, along with its route, its prompt
 * builder and its report types. `runDeep`, `deep`, `deepAvailable`,
 * `canDeep` and the `deep-loading` / `deep` phases are gone with it.
 *
 * The POST to /api/u-ai/trend stays: it is NOT part of the deleted tier. It
 * bumps the search_trends counter that primes Genesis Memory, which the
 * shortcut engine (a surface the founder kept) reads from. Its response is
 * no longer rendered anywhere, so it is now fire-and-forget.
 */
export function useUai() {
  const locale = useLocale();
  const { session } = useWallet();

  const [phase, setPhase] = useState<UaiPhase>('idle');
  const [surface, setSurface] = useState<SurfaceReport | null>(null);
  const [history, setHistory] = useState<BrainGridEntry[]>([]);
  /** REV-21 §12.7 (SR-2): the query the result surface is showing -- kept
   *  apart from the search bar's live text so editing the bar never tears
   *  the open result down. */
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [submittedQid, setSubmittedQid] = useState<string | null>(null);
  /** Increments on every submit -- the stream's remount key. */
  const [surfaceEpoch, setSurfaceEpoch] = useState(0);
  const surfaceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** the most recent query runSurface was called with -- guards against a
   *  slow web-synthesis fetch resolving after a newer query started. */
  const queryRef = useRef('');

  useEffect(() => {
    setHistory(loadBrainGrid());
  }, []);

  useEffect(
    () => () => {
      if (surfaceTimer.current) clearTimeout(surfaceTimer.current);
    },
    [],
  );

  const runSurface = useCallback(
    (query: string, { tEcosystems, context = '', qid }: RunSurfaceOptions) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      if (surfaceTimer.current) clearTimeout(surfaceTimer.current);
      queryRef.current = trimmed;
      setSurface(null);
      setPhase('surface-loading');
      setSubmittedQuery(trimmed);
      setSubmittedQid(qid ?? null);
      setSurfaceEpoch((n) => n + 1);
      const startedFor = trimmed;
      surfaceTimer.current = setTimeout(() => {
        // Live web synthesis (keyless Wikipedia/Wikimedia REST, client-side,
        // behind NEXT_PUBLIC_UAI_WEB_SYNTHESIS + localStorage cache). Resolves
        // to a `sourced: false` synthesis when disabled / timed out / failed
        // -- analyzeSurface then runs on the query alone, no error surfaced.
        void synthesizeWeb(trimmed, locale, qid)
          .then(
            (web) => analyzeSurface(trimmed, tEcosystems, context, web),
            () => analyzeSurface(trimmed, tEcosystems, context),
          )
          .then((report) => {
            // A newer query started while we were fetching -- drop this result.
            if (queryRef.current !== startedFor) return;
            setSurface(report);
            setPhase('surface');
            setHistory(
              recordBrainGrid(
                { q: report.query, ts: Date.now(), shield: report.shield.score, depth: 'surface' },
                session,
              ),
            );

            // Threshold assetization: POST the query to /api/u-ai/trend so
            // the search_trends counter -- and through it Genesis Memory,
            // which the shortcut engine reads -- keeps accumulating. The
            // response is no longer rendered (M2.2), so this is
            // fire-and-forget and fully fail-open.
            void fetch('/api/u-ai/trend', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ query: startedFor, locale }),
            }).catch(() => undefined);
          });
      }, 900);
    },
    [session, locale],
  );

  const reset = useCallback(() => {
    if (surfaceTimer.current) clearTimeout(surfaceTimer.current);
    queryRef.current = '';
    setPhase('idle');
    setSurface(null);
    setSubmittedQuery(null);
    setSubmittedQid(null);
  }, []);

  const wipeHistory = useCallback(() => setHistory(clearBrainGrid()), []);

  return {
    phase,
    surface,
    history,
    submittedQuery,
    submittedQid,
    surfaceEpoch,
    runSurface,
    reset,
    wipeHistory,
  };
}
