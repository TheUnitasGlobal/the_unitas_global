'use client';

import type { WebSynthesis } from './types';
import { EMPTY_SYNTHESIS, WIKI_LANG, collectWebSynthesis } from './webSynthesisCore';

/**
 * Zero-cost "live web synthesis" for the FREE Phase-1 search -- the BROWSER
 * edge. The fetch-and-fold pass itself lives in webSynthesisCore.ts (shared
 * with the server-side 24h sovereign caching engine, lib/uai/shortcutCache.ts);
 * this file adds only what is browser-specific:
 *
 *  - the NEXT_PUBLIC_UAI_WEB_SYNTHESIS gate (unset/"0"/"false" => never fetches)
 *  - the optional NEXT_PUBLIC_UAI_SEARXNG self-hosted instance url
 *  - a 24h localStorage cache so a repeated query never re-fetches
 *    (로우메모리 아머: one short burst per query, hard 3s abort)
 *
 * DATA-VOLUME MANDATE (owner instruction 2026-08-30 / 2026-08-31 — "글로벌
 * 메타-서치 엣지 통합 · 빅테크 90% + 유니타스 10%") and the constraints held
 * (API 비용 0원 · 제로백엔드 · fail-open) are documented on the core.
 */

const FLAG = process.env.NEXT_PUBLIC_UAI_WEB_SYNTHESIS;
const ENABLED = FLAG === '1' || FLAG === 'true';

const SEARXNG = (process.env.NEXT_PUBLIC_UAI_SEARXNG || '').replace(/\/+$/, '');

const CACHE_KEY = 'unitas.uai.websynth.v3';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 40;
const ABORT_MS = 3000;

type CacheShape = Record<string, { data: WebSynthesis; ts: number }>;

function readCache(): CacheShape {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CacheShape;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(next: CacheShape): void {
  try {
    const entries = Object.entries(next).sort((a, b) => b[1].ts - a[1].ts).slice(0, CACHE_MAX);
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* private mode / quota -- synthesis is best-effort */
  }
}

/**
 * Collect a wide slice of real online references for `query` and fold them into
 * one control-stripped digest. Returns `sourced: false` (never throws) when
 * disabled or on any failure.
 */
export async function synthesizeWeb(query: string, locale: string): Promise<WebSynthesis> {
  const lang = WIKI_LANG[locale] ?? 'en';
  const trimmed = query.trim();
  if (!ENABLED || !trimmed || typeof window === 'undefined') return EMPTY_SYNTHESIS(ENABLED ? lang : null);

  const cacheId = `${lang}::${trimmed.toLowerCase().slice(0, 160)}`;
  const cache = readCache();
  const hit = cache[cacheId];
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return { ...hit.data, fetchedAt: hit.ts };
  }

  const result = await collectWebSynthesis(trimmed, lang, { abortMs: ABORT_MS, searx: SEARXNG });
  // Only a sourced pass is worth pinning for 24h -- an abort / offline blip
  // must not lock a query into the empty fallback for a whole day.
  if (result.sourced) writeCache({ ...cache, [cacheId]: { data: result, ts: Date.now() } });
  return result;
}

export const WEB_SYNTHESIS_ENABLED = ENABLED;
