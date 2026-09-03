'use client';

import { WIKI_LANG, stripControl } from './webSynthesisCore';

/**
 * Live "글자 조합별" web suggestions for the U-AI search bar (owner
 * instruction 2026-09-03): every intermediate keystroke shape is prefix-
 * searched against the visitor's own-language Wikipedia (keyless, CORS
 * `origin=*`, 0원) and folded into the dropdown as title + one-line
 * description + category. Nothing here touches the server -- the in-memory
 * LRU means a query the visitor backspaces into and retypes is served for
 * free, and an AbortController on the caller side keeps a stale keystroke
 * from ever overtaking a newer one.
 *
 * Fail-open: any network/parse failure resolves to [] so the local index
 * (liveSearchIndex.ts) keeps the list populated on its own.
 */

export interface LiveSuggestion {
  /** Stable key -- the wiki page title. */
  title: string;
  /** Short description (Wikidata short-desc first, else the intro's first sentence). */
  description: string;
  url: string;
}

interface PrefixSearchResponse {
  query?: {
    pages?: Array<{
      title?: string;
      index?: number;
      description?: string;
      extract?: string;
    }>;
  };
}

const CACHE_LIMIT = 120;
const MAX_DESCRIPTION = 160;
const cache = new Map<string, LiveSuggestion[]>();

function remember(key: string, value: LiveSuggestion[]) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function clip(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

export function wikiLangFor(locale: string): string {
  return WIKI_LANG[locale] ?? 'en';
}

/**
 * Prefix-search `query` on the locale's Wikipedia. Resolves to at most
 * `limit` suggestions, in the wiki's own relevance order.
 */
export async function fetchLiveSuggestions(
  query: string,
  locale: string,
  signal?: AbortSignal,
  limit = 8,
): Promise<LiveSuggestion[]> {
  const q = query.trim();
  if (!q) return [];
  const lang = wikiLangFor(locale);
  const key = `${lang}::${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const params = new URLSearchParams({
    action: 'query',
    generator: 'prefixsearch',
    gpssearch: q,
    gpslimit: String(limit),
    prop: 'description|extracts',
    exintro: '1',
    explaintext: '1',
    exsentences: '1',
    exlimit: String(limit),
    format: 'json',
    formatversion: '2',
    origin: '*',
  });
  const url = `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`;

  try {
    const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const json = (await res.json()) as PrefixSearchResponse;
    const pages = json.query?.pages ?? [];
    const list = pages
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((p) => {
        const title = stripControl(p.title ?? '');
        if (!title) return null;
        const description = clip(stripControl(p.description ?? p.extract ?? ''), MAX_DESCRIPTION);
        return {
          title,
          description,
          url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        } satisfies LiveSuggestion;
      })
      .filter((s): s is LiveSuggestion => s !== null);
    remember(key, list);
    return list;
  } catch {
    // Aborted (a newer keystroke won) or offline -- the caller keeps whatever
    // it already shows; never surface an error for a free suggestion.
    return [];
  }
}
