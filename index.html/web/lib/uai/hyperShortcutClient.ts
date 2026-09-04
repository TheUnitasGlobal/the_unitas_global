'use client';

import { useEffect, useState } from 'react';
import type { HyperEngineKey } from '../hyperSovereign';
import type { HyperReport, HyperReportApiResponse } from './hyperShortcut';

/**
 * Client half of the Hyper-Sovereign oracle (see lib/uai/hyperShortcut.ts).
 * One in-memory cache per browser session on top of the server's permanent
 * genesis_memory cache and the route's week-long CDN header -- re-running
 * the same seed/variant in the same session never refetches. A *pooled*
 * report (the server's deterministic fail-safe while the daily cap or the
 * provider is out) is only memoised briefly, so the real narration takes
 * its place as soon as the route can forge again.
 */

const cache = new Map<string, { report: HyperReport; at: number }>();
const POOL_TTL_MS = 5 * 60_000;

function cacheKey(locale: string, engine: HyperEngineKey, seed: string, variant: string): string {
  return `${locale}::${engine}::${seed}::${variant}`;
}

function fresh(entry: { report: HyperReport; at: number } | undefined): HyperReport | null {
  if (!entry) return null;
  if (entry.report.pooled && Date.now() - entry.at > POOL_TTL_MS) return null;
  return entry.report;
}

/**
 * Fetches the localized narration for one engine result once `seed` and
 * `variant` are set (pass an empty seed to skip). Fail-open: on any error
 * `report` simply stays null and the caller keeps its deterministic
 * rendering -- no error state is surfaced.
 */
export function useHyperReport(
  engine: HyperEngineKey,
  seed: string,
  variant: string,
  locale: string,
  enabled: boolean,
): { report: HyperReport | null; loading: boolean } {
  const [report, setReport] = useState<HyperReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !seed.trim() || !variant) {
      setReport(null);
      setLoading(false);
      return;
    }
    const key = cacheKey(locale, engine, seed, variant);
    const hit = fresh(cache.get(key));
    if (hit) {
      setReport(hit);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setReport(null);
    setLoading(true);
    const params = new URLSearchParams({ engine, seed, variant, locale });
    fetch(`/api/u-ai/hyper-shortcut?${params.toString()}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then((res) => (res.ok ? (res.json() as Promise<HyperReportApiResponse>) : Promise.reject(new Error(String(res.status)))))
      .then((json) => {
        if (controller.signal.aborted) return;
        if (json.ok && json.report) {
          cache.set(key, { report: json.report, at: Date.now() });
          setReport(json.report);
        }
      })
      .catch(() => {
        // fail-open -- the deterministic engine result stays on screen.
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [engine, seed, variant, locale, enabled]);

  return { report, loading };
}
