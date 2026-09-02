import type { WebSynthesis, WebSource } from './types';

/**
 * Isomorphic core of the zero-cost "live web synthesis" -- the pure
 * fetch-and-fold pass shared by the browser edge (webSynthesis.ts: flag +
 * localStorage cache) and the 24h sovereign caching engine on the server
 * (shortcutCache.ts: batch-synthesizes every shortcut tier once a day and
 * parks the result in Postgres so visitors never trigger a fetch at all).
 *
 * No `window`, no `localStorage`, no env flag in here -- only keyless,
 * CORS-enabled public endpoints (DuckDuckGo IA, <lang>.wikipedia REST, the
 * en.wikipedia cross-pass, Wikidata entity search, optional self-hosted
 * SearXNG). Cost stays exactly 0원 on either side of the wire. Never throws:
 * every failure path returns `sourced: false` with the identical shape.
 */

/** next-intl locale -> Wikipedia language subdomain (all of these exist). */
export const WIKI_LANG: Record<string, string> = {
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
  ru: 'ru',
  hi: 'hi',
  it: 'it',
  tr: 'tr',
  th: 'th',
  pl: 'pl',
  nl: 'nl',
  tl: 'tl',
};

export const MAX_DIGEST = 2800;
const MAX_SNIPPET = 260;
const MAX_SOURCES = 8;

export const EMPTY_SYNTHESIS = (lang: string | null): WebSynthesis => ({
  sourced: false,
  sources: [],
  digest: '',
  lang,
  fetchedAt: Date.now(),
});

export function stripControl(s: string): string {
  return Array.from(s)
    .filter((ch) => ch === '\n' || ch === '\t' || (ch >= ' ' && ch !== ''))
    .join('')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

/** Identifies the server-side batch synthesizer to the public endpoints,
 *  per Wikimedia's User-Agent policy (browsers set their own UA). */
const SERVER_UA = 'UNITAS-ShortcutCache/1.0 (https://www.theunitas.global; ceo@theunitas.global)';

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (typeof window === 'undefined') headers['user-agent'] = SERVER_UA;
    const res = await fetch(url, { signal, headers });
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

/** Optional self-hosted SearXNG JSON search — only when an instance URL that
 *  returns CORS headers is supplied. Fail-open. */
function searxSearch(searx: string, query: string, lang: string, signal: AbortSignal) {
  if (!searx) return Promise.resolve<SearxResponse | null>(null);
  return fetchJson<SearxResponse>(
    `${searx}/search?q=${encodeURIComponent(query)}&format=json&safesearch=1&language=${encodeURIComponent(lang)}`,
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

export interface CollectOptions {
  /** hard abort for the whole pass (both batches). */
  abortMs: number;
  /** self-hosted SearXNG base url ('' = off). */
  searx?: string;
}

/**
 * Collect a wide slice of real online references for `query` in `lang` and
 * fold them into one control-stripped digest. Returns `sourced: false`
 * (never throws) on any failure or when nothing was found.
 */
export async function collectWebSynthesis(
  query: string,
  lang: string,
  { abortMs, searx = '' }: CollectOptions,
): Promise<WebSynthesis> {
  const trimmed = query.trim();
  if (!trimmed) return EMPTY_SYNTHESIS(lang);
  const searxBase = searx.replace(/\/+$/, '');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), abortMs);

  try {
    // ---- Batch 1: wide net (parallel) --------------------------------------
    const [primary, cross, wikidata, ddg, searxRes] = await Promise.all([
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
      searxSearch(searxBase, trimmed, lang, controller.signal),
    ]);

    const pages = (primary?.pages ?? []).filter((p) => p.title);
    const crossPages = (cross?.pages ?? []).filter((p) => p.title);
    const entities = (wikidata?.search ?? []).filter((e) => e.label);
    const ddgTopics = flattenDdgTopics(ddg?.RelatedTopics);
    const ddgAbstract = stripControl(ddg?.AbstractText || ddg?.Abstract || ddg?.Answer || ddg?.Definition || '');
    const searxResults = (searxRes?.results ?? []).filter((r) => r.title && r.content);

    if (
      pages.length === 0 &&
      crossPages.length === 0 &&
      entities.length === 0 &&
      ddgTopics.length === 0 &&
      !ddgAbstract &&
      searxResults.length === 0
    ) {
      clearTimeout(timer);
      return EMPTY_SYNTHESIS(lang);
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
    return {
      sourced: sources.length > 0,
      sources: sources.slice(0, MAX_SOURCES),
      digest,
      lang,
      fetchedAt: Date.now(),
    };
  } catch {
    clearTimeout(timer);
    return EMPTY_SYNTHESIS(lang);
  }
}
