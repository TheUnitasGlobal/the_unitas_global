'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useWallet } from '@/components/wallet/WalletProvider';
import { analyzeSurface } from './heuristics';
import { synthesizeWeb } from './webSynthesis';
import { recordBrainGrid, loadBrainGrid, clearBrainGrid, type BrainGridEntry } from './brainGrid';
import type { DeepInsightApiResponse, DeepInsightError, DeepReport, SurfaceReport } from './types';

export type UaiPhase = 'idle' | 'surface-loading' | 'surface' | 'deep-loading' | 'deep';

export type UaiError = 'signin' | DeepInsightError;

interface RunSurfaceOptions {
  tEcosystems: (key: string) => string;
  context?: string;
}

/**
 * Orchestrates the U-AI two-tier flow: instant client-side surface analysis
 * (free), then the coin-burning deep insight (Phase 2-4) via
 * POST /api/u-ai/insight (the route does the server-side Micro-Burn).
 */
export function useUai() {
  const locale = useLocale();
  const { session } = useWallet();

  const [phase, setPhase] = useState<UaiPhase>('idle');
  const [surface, setSurface] = useState<SurfaceReport | null>(null);
  const [deep, setDeep] = useState<DeepReport | null>(null);
  const [error, setError] = useState<UaiError | null>(null);
  const [deepAvailable, setDeepAvailable] = useState(false);
  const [history, setHistory] = useState<BrainGridEntry[]>([]);
  const surfaceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** the most recent query runSurface was called with -- guards against a
   *  slow web-synthesis fetch resolving after a newer query started. */
  const queryRef = useRef('');

  useEffect(() => {
    setHistory(loadBrainGrid());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/u-ai/insight')
      .then((r) => r.json())
      .then((d: { available?: boolean }) => {
        if (!cancelled) setDeepAvailable(Boolean(d.available));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (surfaceTimer.current) clearTimeout(surfaceTimer.current);
    },
    [],
  );

  const runSurface = useCallback(
    (query: string, { tEcosystems, context = '' }: RunSurfaceOptions) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      if (surfaceTimer.current) clearTimeout(surfaceTimer.current);
      queryRef.current = trimmed;
      setError(null);
      setDeep(null);
      setSurface(null);
      setPhase('surface-loading');
      const startedFor = trimmed;
      surfaceTimer.current = setTimeout(() => {
        // Live web synthesis (keyless Wikipedia/Wikimedia REST, client-side,
        // behind NEXT_PUBLIC_UAI_WEB_SYNTHESIS + localStorage cache). Resolves
        // to a `sourced: false` synthesis when disabled / timed out / failed
        // -- analyzeSurface then runs on the query alone, no error surfaced.
        void synthesizeWeb(trimmed, locale)
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
          });
      }, 900);
    },
    [session, locale],
  );

  const runDeep = useCallback(async () => {
    if (!surface || phase === 'deep-loading') return;
    if (!session) {
      setError('signin');
      return;
    }
    setError(null);
    setPhase('deep-loading');
    try {
      // The U-COIN Micro-Burn happens server-side, inside the route, exactly
      // once per request (see app/api/u-ai/insight/route.ts) -- the client
      // never calls spend_coins for U-AI, so a burn can't be replayed.
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? session.access_token;
      const res = await fetch('/api/u-ai/insight', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: surface.query, locale, shieldScore: surface.shield.score }),
      });
      const json = (await res.json()) as DeepInsightApiResponse;
      if (!json.ok) {
        setError(json.error);
        setPhase('surface');
        return;
      }
      setDeep({
        chronos: json.chronos,
        binary: json.binary,
        redPen: json.redPen,
        voidInsight: json.voidInsight,
        efficiencyPath: json.efficiencyPath,
        model: json.model,
        cached: json.cached,
      });
      setPhase('deep');
      setHistory(
        recordBrainGrid(
          { q: surface.query, ts: Date.now(), shield: surface.shield.score, depth: 'deep' },
          session,
        ),
      );
    } catch {
      setError('generation_failed');
      setPhase('surface');
    }
  }, [surface, phase, session, locale]);

  const reset = useCallback(() => {
    if (surfaceTimer.current) clearTimeout(surfaceTimer.current);
    queryRef.current = '';
    setPhase('idle');
    setSurface(null);
    setDeep(null);
    setError(null);
  }, []);

  const wipeHistory = useCallback(() => setHistory(clearBrainGrid()), []);

  return {
    phase,
    surface,
    deep,
    error,
    deepAvailable,
    history,
    canDeep: Boolean(session) && deepAvailable,
    runSurface,
    runDeep,
    reset,
    wipeHistory,
  };
}
