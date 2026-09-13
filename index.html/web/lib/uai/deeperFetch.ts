/**
 * REV-21 §3 -- the shared network layer of the Explore Deeper adapters.
 *
 *  - keyless, CORS-`*` public endpoints only; every failure returns null
 *    (adapters are fail-open, a page is never a throw);
 *  - Wikimedia hosts share ONE serial queue with a 1.2 s spacing (their
 *    etiquette for anonymous clients) and carry `Api-User-Agent`;
 *  - one hard timeout per call, chained to the caller's AbortSignal;
 *  - JSON by default, `text` for endpoints that mislabel their content
 *    type (NASA EONET answers JSON under `application/rss+xml`).
 *
 * Isomorphic: no window, no React. Node 18+ `fetch` on the server.
 */

export const DEEPER_UA = 'UNITAS-ExploreDeeper/1.0 (https://www.theunitas.global; ceo@theunitas.global)';

const WIKIMEDIA_HOST = /(^|\.)(wikipedia|wikidata|wikimedia|wiktionary)\.org$/i;
/** Minimum spacing between two Wikimedia calls from this device. */
export const WIKIMEDIA_SPACING_MS = 1200;

let wikimediaChain: Promise<void> = Promise.resolve();
let lastWikimediaAt = 0;
let spacingMs = WIKIMEDIA_SPACING_MS;

/** Test seam: shorten the spacing so fixture suites don't wait 1.2 s/call. */
export function __setWikimediaSpacing(ms: number): void {
  spacingMs = ms;
}

function isWikimedia(url: string): boolean {
  try {
    return WIKIMEDIA_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Serialize Wikimedia calls: each waits for the previous one AND for the
 *  spacing since it started. Non-Wikimedia calls run at once. */
function schedule(url: string): Promise<void> {
  if (!isWikimedia(url)) return Promise.resolve();
  const turn = wikimediaChain.then(async () => {
    const wait = lastWikimediaAt + spacingMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastWikimediaAt = Date.now();
  });
  wikimediaChain = turn.catch(() => undefined);
  return turn;
}

/** Test seam: reset the queue clock between tests. */
export function __resetWikimediaQueue(): void {
  wikimediaChain = Promise.resolve();
  lastWikimediaAt = 0;
}

export interface DeeperFetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Read the body as text and JSON.parse it (mislabeled content types). */
  text?: boolean;
  headers?: Record<string, string>;
}

function linkedSignal(parent: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParent = () => controller.abort();
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener('abort', onParent, { once: true });
  }
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onParent);
    },
  };
}

/** GET a JSON document; null on any failure (never throws). */
export async function deeperFetchJson<T>(url: string, { signal, timeoutMs = 8000, text = false, headers = {} }: DeeperFetchOptions = {}): Promise<T | null> {
  try {
    await schedule(url);
    if (signal?.aborted) return null;
    const link = linkedSignal(signal, timeoutMs);
    try {
      const h: Record<string, string> = { accept: 'application/json', ...headers };
      if (isWikimedia(url)) h['Api-User-Agent'] = DEEPER_UA;
      if (typeof window === 'undefined') h['user-agent'] = DEEPER_UA;
      const res = await fetch(url, { signal: link.signal, headers: h });
      if (!res.ok) return null;
      if (text) {
        const body = await res.text();
        return JSON.parse(body) as T;
      }
      return (await res.json()) as T;
    } finally {
      link.done();
    }
  } catch {
    return null;
  }
}

/** Wikidata SPARQL (query.wikidata.org) -- GET with the query in the URL,
 *  JSON results. Aborted at 8 s (the review's measured cliff for
 *  `P31/P279*` transitive queries, which the adapters therefore avoid). */
export async function sparql<T = SparqlBindings>(query: string, opts: DeeperFetchOptions = {}): Promise<T | null> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  return deeperFetchJson<T>(url, { ...opts, timeoutMs: opts.timeoutMs ?? 8000, headers: { accept: 'application/sparql-results+json', ...(opts.headers ?? {}) } });
}

export interface SparqlBindings {
  results?: { bindings?: Array<Record<string, { type?: string; value?: string; 'xml:lang'?: string }>> };
}

/** 'http://www.wikidata.org/entity/Q42' -> 'Q42'. */
export function qidOfUri(uri: string | undefined): string | undefined {
  const m = /\/(Q\d+)$/.exec(uri ?? '');
  return m ? m[1] : undefined;
}

export function wikiPageUrl(lang: string, title: string): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function wikidataUrl(qid: string): string {
  return `https://www.wikidata.org/wiki/${encodeURIComponent(qid)}`;
}

/** `"Atmosphere of Earth"` -- the exact-phrase form for text-search legs
 *  (HN, Commons, Crossref). Only ever fed the English title (§3.3 rule). */
export function quoted(term: string): string {
  return `"${term.replace(/"/g, '').trim()}"`;
}

export function wordCount(term: string): number {
  return term.trim().split(/\s+/).filter(Boolean).length;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(days: number, now = Date.now()): Date {
  return new Date(now - days * 86_400_000);
}

/** Median of a numeric list (ensemble climate models). */
export function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Compact number for facts: 1.2M / 34.5K / 812. */
export function compactNumber(n: number, locale = 'en'): string {
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}
