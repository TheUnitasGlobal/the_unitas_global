'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useWallet } from '@/components/wallet/WalletProvider';
import { analyzeSurface } from './heuristics';
import { recordBrainGrid, loadBrainGrid, clearBrainGrid, type BrainGridEntry } from './brainGrid';
import {
  UAI_DEEP_INSIGHT_COST,
  UAI_MODULE,
  type DeepInsightApiResponse,
  type DeepReport,
  type SurfaceReport,
} from './types';

export type UaiPhase = 'idle' | 'surface-loading' | 'surface' | 'deep-loading' | 'deep';

export type UaiError =
  | 'signin'
  | 'phone'
  | 'insufficient'
  | 'burn_required'
  | 'deep_unavailable'
  | 'generation_failed'
  | 'bad_request'
  | 'unauthenticated';

function mapSpendError(message: string | undefined): UaiError {
  const m = (message ?? '').toLowerCase();
  if (m.includes('insufficient')) return 'insufficient';
  if (m.includes('phone')) return 'phone';
  if (m.includes('wallet not found')) return 'insufficient';
  if (m.includes('authenticat')) return 'signin';
  return 'generation_failed';
}

interface RunSurfaceOptions {
  tEcosystems: (key: string) => string;
  context?: string;
}

/**
 * Orchestrates the U-AI two-tier flow: instant client-side surface analysis
 * (free), then the coin-burning deep insight (Phase 2-4) via
 * spend_coins('u-ai', N) + POST /api/u-ai/insight.
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
      setError(null);
      setDeep(null);
      setSurface(null);
      setPhase('surface-loading');
      surfaceTimer.current = setTimeout(() => {
        const report = analyzeSurface(trimmed, tEcosystems, context);
        setSurface(report);
        setPhase('surface');
        setHistory(
          recordBrainGrid(
            { q: report.query, ts: Date.now(), shield: report.shield.score, depth: 'surface' },
            session,
          ),
        );
      }, 900);
    },
    [session],
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
      const supabase = getSupabaseBrowserClient();
      const { error: spendError } = await supabase.rpc('spend_coins', {
        p_module: UAI_MODULE,
        p_amount: UAI_DEEP_INSIGHT_COST,
      });
      if (spendError) {
        setError(mapSpendError(spendError.message));
        setPhase('surface');
        return;
      }

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
