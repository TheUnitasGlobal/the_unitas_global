'use client';

import type { WebSynthesis, WebSource } from './types';

/**
 * Zero-cost "live web synthesis" for the FREE Phase-1 search.
 *
 * Constraints held (owner instruction 2026-08-30):
 *  - API 비용 0원: only keyless, CORS-enabled public endpoints
 *    (Wikipedia / Wikimedia REST). No API key, no server route, no LLM call.
 *  - 제로백엔드: every call is made from the visitor's browser.
 *  - 로우메모리 아머: one short burst per query, hard 2.5s abort, results
 *    cached in localStorage (24h TTL) so a repeated query never re-fetches.
 *  - Fail-open: any disablement / timeout / network error returns a
 *    `sourced: false` synthesis and Phase 1 continues on pure local
 *    heuristics -- the user never sees an error.
 *
 * Gated by NEXT_PUBLIC_UAI_WEB_SYNTHESIS: unset/"0"/"false" => never fetches.
 */

const FLAG = process.env.NEXT_PUBLIC_UAI_WEB_SYNTHESIS;
const ENABLED = FLAG === '1' || FLAG === 'true';

const CACHE_KEY = 'unitas.uai.websynth.v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 40;
const ABORT_MS = 2500;
const MAX_DIGEST = 1400;
const MAX_SNIPPET = 240;

/** next-intl locale -> Wikipedia language subdomain (all of these exist). */
const WIKI_LANG: Record<string, string> = {
  en: 'en',
  ko: 'ko',
  ja: 'ja',
  zh: 'zh',
  es: 'es',
  et: 'et',
  km: 'km',
  fr: 'fr',
  de: 'de',
  pt: 'pt',
  vi: 'vi',
  id: 'id',
};

const EMPTY = (lang: string | null): WebSynthesis => ({
  sourced: false,
  sources: [],
  digest: '',
  lang,
  fetchedAt: Date.now(),
});

function stripControl(s: string): string {
  return Array.from(s)
    .filter((ch) => ch === '\n' || ch === '\t' || (ch >= ' ' && ch !== ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

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

interface RestSearchResponse {
  pages?: Array<{ key?: string; title?: string; excerpt?: string; description?: string }>;
}
interface RestSummaryResponse {
  title?: string;
  extract?: string;
  description?: string;
  content_urls?: { desktop?: { page?: string } };
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Collect a handful of real online references for `query` and fold them into
 * one control-stripped digest. Returns `sourced: false` (never throws) when
 * disabled or on any failure.
 */
export async function synthesizeWeb(query: string, locale: string): Promise<WebSynthesis> {
  const lang = WIKI_LANG[locale] ?? 'en';
  const trimmed = query.trim();
  if (!ENABLED || !trimmed || typeof window === 'undefined') return EMPTY(ENABLED ? lang : null);

  const cacheId = `${lang}::${trimmed.toLowerCase().slice(0, 160)}`;
  const cache = readCache();
  const hit = cache[cacheId];
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return { ...hit.data, fetchedAt: hit.ts };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ABORT_MS);

  try {
    const base = `https://${lang}.wikipedia.org`;
    const search = await fetchJson<RestSearchResponse>(
      `${base}/w/rest.php/v1/search/page?q=${encodeURIComponent(trimmed)}&limit=5`,
      controller.signal,
    );
    const pages = (search?.pages ?? []).filter((p) => p.title);
    if (pages.length === 0) {
      clearTimeout(timer);
      const empty = EMPTY(lang);
      writeCache({ ...cache, [cacheId]: { data: empty, ts: Date.now() } });
      return empty;
    }

    // Enrich the top 2 hits with their REST summary (extract + canonical URL).
    const summaries = await Promise.all(
      pages.slice(0, 2).map((p) =>
        fetchJson<RestSummaryResponse>(
          `${base}/api/rest_v1/page/summary/${encodeURIComponent((p.key ?? p.title!).replace(/ /g, '_'))}`,
          controller.signal,
        ),
      ),
    );

    const sources: WebSource[] = [];
    const digestParts: string[] = [];

    pages.slice(0, 2).forEach((p, i) => {
      const sum = summaries[i];
      const snippetRaw =
        sum?.extract || stripControl(p.excerpt ?? '').replace(/<[^>]+>/g, '') || p.description || '';
      const snippet = stripControl(snippetRaw).slice(0, MAX_SNIPPET);
      const url =
        sum?.content_urls?.desktop?.page ||
        `${base}/wiki/${encodeURIComponent((p.key ?? p.title!).replace(/ /g, '_'))}`;
      if (snippet) {
        sources.push({ title: stripControl(sum?.title || p.title || ''), url, snippet });
        digestParts.push(snippet);
      }
    });

    // The remaining hits contribute title + one-line description to the digest
    // only (no extra round-trips -- Low-Memory Armor).
    pages.slice(2, 5).forEach((p) => {
      const line = stripControl(`${p.title ?? ''} ${p.description ?? ''}`);
      if (line) digestParts.push(line);
    });

    clearTimeout(timer);

    const digest = stripControl(digestParts.join('  ')).slice(0, MAX_DIGEST);
    const result: WebSynthesis = {
      sourced: sources.length > 0,
      sources,
      digest,
      lang,
      fetchedAt: Date.now(),
    };
    writeCache({ ...cache, [cacheId]: { data: result, ts: Date.now() } });
    return result;
  } catch {
    clearTimeout(timer);
    return EMPTY(lang);
  }
}

export const WEB_SYNTHESIS_ENABLED = ENABLED;
