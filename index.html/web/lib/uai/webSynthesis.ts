'use client';

import type { WebSynthesis, WebSource } from './types';

/**
 * Zero-cost "live web synthesis" for the FREE Phase-1 search.
 *
 * DATA-VOLUME MANDATE (owner instruction 2026-08-30 / 2026-08-31 — "글로벌
 * 메타-서치 엣지 통합 · 빅테크 90% + 유니타스 10%"): the free tier casts a wide,
 * big-tech-search-grade net over the open knowledge graph before the
 * 100-doctrine redesign runs on top of it. Every source is keyless + CORS-only
 * so the cost stays exactly 0원 and not one byte is stored server-side:
 *  - DuckDuckGo Instant Answer API (api.duckduckgo.com, CORS `*`) — a real
 *    open meta-search edge: abstract + related-topic spread across the whole
 *    open web, not just an encyclopedia
 *  - <lang>.wikipedia.org REST search (broad, up to 10 hits)
 *  - en.wikipedia.org REST search cross-pass (when the UI locale isn't English)
 *    so a non-English query still reaches the far larger English corpus
 *  - wikidata.org wbsearchentities (entity graph — labels + one-line descriptions)
 *  - REST page summaries for the top hits (real extract + canonical URL)
 *  - optional self-hosted SearXNG JSON (NEXT_PUBLIC_UAI_SEARXNG=<instance url>) —
 *    off by default: public instances almost universally omit CORS headers, so
 *    a browser fetch fails; wire your own instance to light it up. Fail-open.
 *
 * Constraints held:
 *  - API 비용 0원: only keyless, CORS-enabled public endpoints. No API key,
 *    no server route, no LLM call.
 *  - 제로백엔드: every call is made from the visitor's browser.
 *  - 로우메모리 아머: one short burst per query (two small parallel batches),
 *    hard 3s abort, results cached in localStorage (24h TTL) so a repeated
 *    query never re-fetches.
 *  - Fail-open: any disablement / timeout / network error returns a
 *    `sourced: false` synthesis and Phase 1 continues on pure local
 *    heuristics -- the user never sees an error.
 *
 * Gated by NEXT_PUBLIC_UAI_WEB_SYNTHESIS: unset/"0"/"false" => never fetches.
 */

const FLAG = process.env.NEXT_PUBLIC_UAI_WEB_SYNTHESIS;
const ENABLED = FLAG === '1' || FLAG === 'true';

const SEARXNG = (process.env.NEXT_PUBLIC_UAI_SEARXNG || '').replace(/\/+$/, '');

const CACHE_KEY = 'unitas.uai.websynth.v3';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 40;
const ABORT_MS = 3000;
const MAX_DIGEST = 2800;
const MAX_SNIPPET = 260;
const MAX_SOURCES = 8;

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
    .filter((ch) => ch === '\n' || ch === '\t' || (ch >= ' ' && ch !== ''))
    .join('')
    .replace(/<[^>]+>/g, ' ')
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
interface WikidataResponse {
  search?: Array<{ label?: string; description?: string; concepturi?: string }>;
}
interface DdgRelatedTopic {
  Text?: string;
  FirstURL?: string;
  Name?: string;
  Topics?: DdgRelatedTopic[];
}
interface DdgResponse {
  Heading?: string;
  AbstractText?: string;
  Abstract?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  Answer?: string;
  Definition?: string;
  DefinitionURL?: string;
  RelatedTopics?: DdgRelatedTopic[];
}
interface SearxResponse {
  results?: Array<{ title?: string; url?: string; content?: string }>;
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

function wikiSearch(lang: string, query: string, limit: number, signal: AbortSignal) {
  return fetchJson<RestSearchResponse>(
    `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=${limit}`,
    signal,
  );
}

/** DuckDuckGo Instant Answer API — keyless, CORS `*`. A real open-web meta
 *  search edge (abstract + related topics span the whole web, not one wiki). */
function ddgSearch(query: string, signal: AbortSignal) {
  return fetchJson<DdgResponse>(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1&skip_disambig=1&t=unitas`,
    signal,
  );
}

/** Optional self-hosted SearXNG JSON search — only when NEXT_PUBLIC_UAI_SEARXNG
 *  points at an instance that returns CORS headers. Fail-open. */
function searxSearch(query: string, lang: string, signal: AbortSignal) {
  if (!SEARXNG) return Promise.resolve<SearxResponse | null>(null);
  return fetchJson<SearxResponse>(
    `${SEARXNG}/search?q=${encodeURIComponent(query)}&format=json&safesearch=1&language=${encodeURIComponent(lang)}`,
    signal,
  );
}

/** Flatten DDG RelatedTopics (one level of nesting) into {text,url} rows. */
function flattenDdgTopics(topics: DdgRelatedTopic[] | undefined): Array<{ text: string; url?: string }> {
  const out: Array<{ text: string; url?: string }> = [];
  (topics ?? []).forEach((t) => {
    if (t.Text) out.push({ text: stripControl(t.Text), url: t.FirstURL });
    (t.Topics ?? []).forEach((s) => {
      if (s.Text) out.push({ text: stripControl(s.Text), url: s.FirstURL });
    });
  });
  return out.filter((r) => r.text);
}

/**
 * Collect a wide slice of real online references for `query` and fold them into
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
    // ---- Batch 1: wide net (parallel) --------------------------------------
    const [primary, cross, wikidata, ddg, searx] = await Promise.all([
      wikiSearch(lang, trimmed, 10, controller.signal),
      lang === 'en'
        ? Promise.resolve<RestSearchResponse | null>(null)
        : wikiSearch('en', trimmed, 6, controller.signal),
      fetchJson<WikidataResponse>(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
          trimmed,
        )}&language=${lang}&uselang=${lang}&format=json&origin=*&limit=7`,
        controller.signal,
      ),
      ddgSearch(trimmed, controller.signal),
      searxSearch(trimmed, lang, controller.signal),
    ]);

    const pages = (primary?.pages ?? []).filter((p) => p.title);
    const crossPages = (cross?.pages ?? []).filter((p) => p.title);
    const entities = (wikidata?.search ?? []).filter((e) => e.label);
    const ddgTopics = flattenDdgTopics(ddg?.RelatedTopics);
    const ddgAbstract = stripControl(ddg?.AbstractText || ddg?.Abstract || ddg?.Answer || ddg?.Definition || '');
    const searxResults = (searx?.results ?? []).filter((r) => r.title && r.content);

    if (
      pages.length === 0 &&
      crossPages.length === 0 &&
      entities.length === 0 &&
      ddgTopics.length === 0 &&
      !ddgAbstract &&
      searxResults.length === 0
    ) {
      clearTimeout(timer);
      const empty = EMPTY(lang);
      writeCache({ ...cache, [cacheId]: { data: empty, ts: Date.now() } });
      return empty;
    }

    // ---- Batch 2: enrich the top primary hits with their REST summary -----
    const summaries = await Promise.all(
      pages.slice(0, 3).map((p) =>
        fetchJson<RestSummaryResponse>(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
            (p.key ?? p.title!).replace(/ /g, '_'),
          )}`,
          controller.signal,
        ),
      ),
    );
    clearTimeout(timer);

    const sources: WebSource[] = [];
    const digestParts: string[] = [];

    pages.slice(0, 3).forEach((p, i) => {
      const sum = summaries[i];
      const snippetRaw = sum?.extract || stripControl(p.excerpt ?? '') || p.description || '';
      const snippet = stripControl(snippetRaw).slice(0, MAX_SNIPPET);
      const url =
        sum?.content_urls?.desktop?.page ||
        `https://${lang}.wikipedia.org/wiki/${encodeURIComponent((p.key ?? p.title!).replace(/ /g, '_'))}`;
      if (snippet) {
        sources.push({ title: stripControl(sum?.title || p.title || ''), url, snippet });
        digestParts.push(snippet);
      }
    });

    // Wikidata entities: label + one-line description -> a source + digest line.
    entities.slice(0, 3).forEach((e) => {
      const line = stripControl(`${e.label ?? ''} — ${e.description ?? ''}`);
      if (!e.description) return;
      digestParts.push(line);
      if (e.concepturi && sources.length < MAX_SOURCES) {
        sources.push({
          title: stripControl(e.label ?? ''),
          url: e.concepturi,
          snippet: stripControl(e.description ?? ''),
        });
      }
    });

    // Remaining primary hits + the English cross-pass hits contribute
    // title + one-line description to the digest only (no extra round-trips).
    pages.slice(3, 10).forEach((p) => {
      const line = stripControl(`${p.title ?? ''} ${p.description ?? p.excerpt ?? ''}`);
      if (line) digestParts.push(line);
    });
    crossPages.slice(0, 6).forEach((p) => {
      const line = stripControl(`${p.title ?? ''} ${p.description ?? p.excerpt ?? ''}`);
      if (line) digestParts.push(line);
      if (p.title && sources.length < MAX_SOURCES) {
        sources.push({
          title: stripControl(p.title),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
          snippet: stripControl(p.description ?? p.excerpt ?? ''),
        });
      }
    });

    // DuckDuckGo: the instant-answer abstract becomes a lead source, related
    // topics widen the digest (and fill remaining source slots).
    if (ddgAbstract) {
      digestParts.unshift(ddgAbstract.slice(0, MAX_SNIPPET));
      if (ddg?.AbstractURL && sources.length < MAX_SOURCES) {
        sources.unshift({
          title: stripControl(ddg.Heading || trimmed),
          url: ddg.AbstractURL,
          snippet: ddgAbstract.slice(0, MAX_SNIPPET),
        });
      }
    }
    ddgTopics.slice(0, 8).forEach((topic) => {
      digestParts.push(topic.text);
      if (topic.url && sources.length < MAX_SOURCES) {
        sources.push({
          title: topic.text.split(' - ')[0].slice(0, 90),
          url: topic.url,
          snippet: topic.text.slice(0, MAX_SNIPPET),
        });
      }
    });

    // SearXNG (optional self-hosted): title + content snippet per result.
    searxResults.slice(0, 6).forEach((r) => {
      const snippet = stripControl(r.content ?? '').slice(0, MAX_SNIPPET);
      if (snippet) digestParts.push(`${stripControl(r.title ?? '')} ${snippet}`);
      if (r.url && sources.length < MAX_SOURCES) {
        sources.push({ title: stripControl(r.title ?? ''), url: r.url, snippet });
      }
    });

    const digest = stripControl(digestParts.join('  ')).slice(0, MAX_DIGEST);
    const result: WebSynthesis = {
      sourced: sources.length > 0,
      sources: sources.slice(0, MAX_SOURCES),
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
