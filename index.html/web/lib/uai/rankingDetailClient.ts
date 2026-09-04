'use client';

import { useEffect, useState } from 'react';
import type { GlobalRankingThemeKey } from '../globalRankings';
import type { RankingDetailApiResponse, RankingDetailReport } from './rankingDetail';

/**
 * Client half of the FREE encyclopedic ranking-detail popup (see
 * lib/uai/rankingDetail.ts for the full design note). One in-memory cache
 * per browser session on top of the server's permanent genesis_memory cache
 * and the route's day-long CDN header -- re-opening the same rank in the
 * same session never refetches.
 */

const cache = new Map<string, RankingDetailReport>();

function cacheKey(locale: string, theme: string, rank: number): string {
  return `${locale}::${theme}::${rank}`;
}

/**
 * Fetches the localized encyclopedic write-up for one ranking entry once
 * `theme`/`rank` are set (pass null to skip). Fail-open: on any error
 * `report` simply stays null and the caller keeps showing its static
 * curated one-liner -- no error state is surfaced.
 */
export function useRankingDetail(
  theme: GlobalRankingThemeKey | null,
  rank: number | null,
  locale: string,
): { report: RankingDetailReport | null; loading: boolean } {
  const [report, setReport] = useState<RankingDetailReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!theme || !rank) {
      setReport(null);
      setLoading(false);
      return;
    }
    const key = cacheKey(locale, theme, rank);
    const hit = cache.get(key);
    if (hit) {
      setReport(hit);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setReport(null);
    setLoading(true);
    fetch(
      `/api/u-ai/ranking-detail?theme=${encodeURIComponent(theme)}&rank=${rank}&locale=${encodeURIComponent(locale)}`,
      { signal: controller.signal, headers: { accept: 'application/json' } },
    )
      .then((res) => (res.ok ? (res.json() as Promise<RankingDetailApiResponse>) : Promise.reject(new Error(String(res.status)))))
      .then((json) => {
        if (controller.signal.aborted) return;
        if (json.ok && json.report) {
          cache.set(key, json.report);
          setReport(json.report);
        }
      })
      .catch(() => {
        // fail-open -- caller falls back to the static entry.detail/note
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [theme, rank, locale]);

  return { report, loading };
}
