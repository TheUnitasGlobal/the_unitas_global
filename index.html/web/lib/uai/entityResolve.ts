/**
 * REV-21 §2.2 -- entity context resolution: "검색어를 던지지 않는다".
 *
 * The founder-reported "공기 → Thai film" drift had one root cause: the
 * synthesis core sent the visitor's raw locale string ('공기') to the ENGLISH
 * Wikipedia full-text search, which ranks whatever English article happens
 * to quote that string (a children's game, a singer, a TV series). This
 * module is the fix: resolve the query ONCE on the visitor's own-language
 * Wikipedia, read the page's Wikidata item (QID) and its English langlink,
 * and let every cross-language leg use ONLY that exact title / QID.
 *
 * Isomorphic (no window, no React) -- shared by the browser synthesis edge,
 * the server-side 24h cache engine and the Explore Deeper themes. Pure
 * helpers are exported for unit tests with a mocked `fetch`.
 */

export interface ResolvedEntity {
  /** Exact page title on the locale wiki (e.g. '공기'). */
  localeTitle: string;
  /** English page title from the langlink, `#section` anchor stripped
   *  (e.g. 'Air'; ja '空気' links to 'Atmosphere of Earth#Composition'). */
  enTitle?: string;
  /** Wikidata item (e.g. 'Q7391292'). */
  qid?: string;
  /** True when the best hit is a disambiguation page -- callers must then
   *  offer a meaning choice instead of guessing. */
  disambiguation: boolean;
  lang: string;
}

export interface WikiEntityPage {
  title?: string;
  index?: number;
  langlinks?: Array<{ lang?: string; title?: string; '*'?: string }>;
  pageprops?: { wikibase_item?: string; disambiguation?: string };
}

export interface WikiEntityResponse {
  query?: { pages?: WikiEntityPage[] | Record<string, WikiEntityPage> };
}

/** Wikidata classes (P31) a CROSS candidate is never allowed to be when it
 *  merely shares a label with the anchor: films, series, albums, songs,
 *  people, artworks, sculptures, literary works, fictional characters. The
 *  locale wiki's own top hit is exempt -- a visitor who typed a film's name
 *  gets the film. */
export const EXCLUDED_CROSS_P31 = new Set([
  'Q11424', // film
  'Q5398426', // television series
  'Q482994', // album
  'Q7366', // song
  'Q5', // human
  'Q838948', // work of art
  'Q860861', // sculpture
  'Q7725634', // literary work
  'Q95074', // fictional character
]);

export function isExcludedCrossClass(p31: readonly string[]): boolean {
  return p31.length === 0 || p31.some((q) => EXCLUDED_CROSS_P31.has(q));
}

/** 'Atmosphere of Earth#Composition' -> 'Atmosphere of Earth'. */
export function stripSectionAnchor(title: string): string {
  const i = title.indexOf('#');
  return (i >= 0 ? title.slice(0, i) : title).trim();
}

/** The generator=search + langlinks|pageprops leg, as one URL. Shared with
 *  the synthesis core so the anchor costs zero extra round-trips there. */
export function entitySearchUrl(lang: string, query: string, limit = 3, extra = ''): string {
  return (
    `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}` +
    `&gsrlimit=${limit}&gsrnamespace=0&prop=langlinks|pageprops${extra}&lllang=en&lllimit=max` +
    `&ppprop=wikibase_item|disambiguation&redirects=1&format=json&formatversion=2&origin=*`
  );
}

function pagesOf(json: WikiEntityResponse | null): WikiEntityPage[] {
  const raw = json?.query?.pages;
  const list = Array.isArray(raw) ? raw : Object.values(raw ?? {});
  return list
    .filter((p): p is WikiEntityPage => Boolean(p && p.title))
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

function langlinkTitle(p: WikiEntityPage): string | undefined {
  const ll = (p.langlinks ?? []).find((l) => !l.lang || l.lang === 'en');
  const raw = ll?.title ?? ll?.['*'];
  return raw ? stripSectionAnchor(raw) : undefined;
}

/**
 * Pure: pick the anchor out of a generator=search response. The first
 * non-disambiguation hit wins; if every hit is a disambiguation page the
 * first one is returned flagged, so the caller can ask for a meaning.
 */
export function parseEntityPages(json: WikiEntityResponse | null, lang: string): ResolvedEntity | null {
  const pages = pagesOf(json);
  if (pages.length === 0) return null;
  const pick = pages.find((p) => p.pageprops?.disambiguation === undefined) ?? pages[0];
  const title = pick.title!;
  const enTitle = lang === 'en' ? title : langlinkTitle(pick);
  return {
    localeTitle: title,
    enTitle,
    qid: pick.pageprops?.wikibase_item,
    disambiguation: pick.pageprops?.disambiguation !== undefined,
    lang,
  };
}

const SERVER_UA = 'UNITAS-EntityResolve/1.0 (https://www.theunitas.global; ceo@theunitas.global)';

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

/** Resolve `query` on the `lang` Wikipedia. One keyless CORS call. */
export async function resolveEntity(query: string, lang: string, signal: AbortSignal): Promise<ResolvedEntity | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const json = await fetchJson<WikiEntityResponse>(entitySearchUrl(lang, trimmed), signal);
  return parseEntityPages(json, lang);
}

interface SitelinkResponse {
  entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }>;
}

/** REV-21 §2.1/§2.2: on a language switch the SAME entity's title in the
 *  new language comes from its Wikidata sitelinks -- never from re-searching
 *  the old string in the new wiki. */
export async function sitelinkTitle(qid: string, lang: string, signal: AbortSignal): Promise<string | null> {
  const site = `${lang}wiki`;
  const json = await fetchJson<SitelinkResponse>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=sitelinks&sitefilter=${site}&format=json&origin=*`,
    signal,
  );
  return json?.entities?.[qid]?.sitelinks?.[site]?.title ?? null;
}

interface ClaimsResponse {
  claims?: { P31?: Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }> };
}

/** P31 (instance of) ids for one item -- ~300 bytes, keyless. */
export async function wikidataInstanceOf(qid: string, signal: AbortSignal): Promise<string[]> {
  const json = await fetchJson<ClaimsResponse>(
    `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${encodeURIComponent(qid)}&property=P31&format=json&origin=*`,
    signal,
  );
  return (json?.claims?.P31 ?? [])
    .map((c) => c.mainsnak?.datavalue?.value?.id)
    .filter((id): id is string => typeof id === 'string');
}
