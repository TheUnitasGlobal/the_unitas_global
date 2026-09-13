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
 * SPEC §12.3 (M5a anchor plumbing) adds, on the same contract:
 *  (d) a Wikidata label-search fallback for queries the locale wiki has no
 *      page for (label match → own-wiki / en-wiki sitelinks → class gate),
 *      and the page's primary coordinate so a place query yields a place
 *      anchor with zero extra calls;
 *  (f) `sitelinkTitles` -- the same entity's exact title in several
 *      languages at once (the Deeper header "공기 · Air", the keyword panel
 *      after a language switch);
 *  (g) `wikiLinks` -- one page of a page's outgoing links with a
 *      continuation token (the value-cycle theme and the disambiguation
 *      "choose a meaning" chips share it).
 *
 * Isomorphic (no window, no React) -- shared by the browser synthesis edge,
 * the server-side 24h cache engine and the Explore Deeper themes. Pure
 * helpers are exported for unit tests with a mocked `fetch`.
 */

export interface EntityCoord {
  lat: number;
  lon: number;
}

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
  /** The page's primary coordinate when it is a place (SPEC §12.3 d). */
  coord?: EntityCoord;
  /** Which leg produced the anchor: the locale wiki (default) or the
   *  Wikidata label fallback when the wiki had no page at all. */
  origin?: 'wiki' | 'wikidata';
}

export interface WikiEntityPage {
  title?: string;
  index?: number;
  langlinks?: Array<{ lang?: string; title?: string; '*'?: string }>;
  pageprops?: { wikibase_item?: string; disambiguation?: string };
  coordinates?: Array<{ lat?: number; lon?: number; primary?: boolean | string }>;
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

/** Loose QID shape guard for query parameters and stored descriptors. */
export function isQid(value: unknown): value is string {
  return typeof value === 'string' && /^Q\d{1,12}$/.test(value);
}

/** The generator=search + langlinks|pageprops|coordinates leg, as one URL.
 *  Shared with the synthesis core so the anchor costs zero extra
 *  round-trips there. `extra` is appended to the prop list (it may start
 *  with `|extracts&exintro=1...`), which is why the coordinate options sit
 *  after it. */
export function entitySearchUrl(lang: string, query: string, limit = 3, extra = ''): string {
  return (
    `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}` +
    `&gsrlimit=${limit}&gsrnamespace=0&prop=langlinks|pageprops|coordinates${extra}&coprimary=primary&colimit=max&lllang=en&lllimit=max` +
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

function primaryCoord(p: WikiEntityPage): EntityCoord | undefined {
  const list = p.coordinates ?? [];
  const pick = list.find((c) => c.primary !== undefined && c.primary !== false) ?? list[0];
  return pick && typeof pick.lat === 'number' && typeof pick.lon === 'number' ? { lat: pick.lat, lon: pick.lon } : undefined;
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
  const coord = primaryCoord(pick);
  return {
    localeTitle: title,
    enTitle,
    qid: pick.pageprops?.wikibase_item,
    disambiguation: pick.pageprops?.disambiguation !== undefined,
    lang,
    ...(coord ? { coord } : {}),
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

export interface ResolveEntityOptions {
  /** SPEC §12.3 (d): when the locale wiki has no page, fall back to a
   *  Wikidata label search (default true). */
  wikidataFallback?: boolean;
}

/** Resolve `query` on the `lang` Wikipedia. One keyless CORS call; a
 *  Wikidata label fallback (three small calls) only when the wiki has
 *  nothing at all. */
export async function resolveEntity(
  query: string,
  lang: string,
  signal: AbortSignal,
  { wikidataFallback = true }: ResolveEntityOptions = {},
): Promise<ResolvedEntity | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const json = await fetchJson<WikiEntityResponse>(entitySearchUrl(lang, trimmed), signal);
  const fromWiki = parseEntityPages(json, lang);
  if (fromWiki || !wikidataFallback) return fromWiki;
  return resolveViaWikidata(trimmed, lang, signal);
}

/* ------------------------------------------------------------------ */
/* Wikidata legs                                                        */
/* ------------------------------------------------------------------ */

export interface WikidataLabelHit {
  id?: string;
  label?: string;
  description?: string;
  match?: { type?: string; language?: string };
}
export interface WikidataSearchResponse {
  search?: WikidataLabelHit[];
}
export interface WikidataEntitiesResponse {
  entities?: Record<
    string,
    {
      sitelinks?: Record<string, { title?: string }>;
      labels?: Record<string, { value?: string }>;
      descriptions?: Record<string, { value?: string }>;
    }
  >;
}

/** Label matches only -- alias hits ('공기업' for '공기') are the stray
 *  vector this revision closes. */
export function labelHitsOf(json: WikidataSearchResponse | null): WikidataLabelHit[] {
  return (json?.search ?? []).filter((e) => e.id && e.label && (e.match?.type ?? 'label') === 'label');
}

function wikidataSearchUrl(query: string, lang: string, limit: number): string {
  return `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=${lang}&uselang=${lang}&type=item&format=json&origin=*&limit=${limit}`;
}

function wikidataEntitiesUrl(ids: readonly string[], sites: readonly string[], langs: readonly string[]): string {
  return (
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.map(encodeURIComponent).join('|')}` +
    `&props=sitelinks|labels|descriptions&sitefilter=${sites.join('|')}&languages=${langs.join('|')}&format=json&origin=*`
  );
}

/**
 * SPEC §12.3 (d): the query has no page on the locale wiki. Ask Wikidata
 * for LABEL matches in that language, then keep the first candidate that
 * has a page on the locale wiki (else on the English wiki) and is not an
 * excluded same-label class. At most three candidates are class-checked.
 */
export async function resolveViaWikidata(query: string, lang: string, signal: AbortSignal): Promise<ResolvedEntity | null> {
  const search = await fetchJson<WikidataSearchResponse>(wikidataSearchUrl(query, lang, 5), signal);
  const hits = labelHitsOf(search);
  if (hits.length === 0) return null;
  const ids = hits.map((h) => h.id!);
  const own = `${lang}wiki`;
  const entities = await fetchJson<WikidataEntitiesResponse>(wikidataEntitiesUrl(ids, [own, 'enwiki'], [lang, 'en']), signal);
  const ranked = ids
    .map((id) => ({ id, e: entities?.entities?.[id] }))
    .filter((c) => c.e)
    .sort((a, b) => Number(Boolean(b.e!.sitelinks?.[own]?.title)) - Number(Boolean(a.e!.sitelinks?.[own]?.title)));
  let checks = 0;
  for (const c of ranked) {
    const ownTitle = c.e!.sitelinks?.[own]?.title;
    const enTitle = c.e!.sitelinks?.enwiki?.title;
    if (!ownTitle && !enTitle) continue;
    if (checks++ >= 3) break;
    const p31 = await wikidataInstanceOf(c.id, signal);
    if (p31.length > 0 && isExcludedCrossClass(p31)) continue;
    return {
      localeTitle: ownTitle ?? c.e!.labels?.[lang]?.value ?? query,
      enTitle: enTitle ? stripSectionAnchor(enTitle) : c.e!.labels?.en?.value,
      qid: c.id,
      disambiguation: false,
      lang,
      origin: 'wikidata',
    };
  }
  return null;
}

/** REV-21 §2.1/§2.2: on a language switch the SAME entity's title in the
 *  new language comes from its Wikidata sitelinks -- never from re-searching
 *  the old string in the new wiki. */
export async function sitelinkTitle(qid: string, lang: string, signal: AbortSignal): Promise<string | null> {
  const titles = await sitelinkTitles(qid, [lang], signal);
  return titles[lang] ?? null;
}

/** SPEC §12.3 (f): the entity's exact page title in several languages at
 *  once (one call) -- `{ ko: '공기', en: 'Air' }`. Missing editions are
 *  simply absent from the result. */
export async function sitelinkTitles(qid: string, langs: readonly string[], signal: AbortSignal): Promise<Record<string, string>> {
  const unique = Array.from(new Set(langs.filter(Boolean)));
  if (unique.length === 0 || !isQid(qid)) return {};
  const json = await fetchJson<WikidataEntitiesResponse>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=sitelinks&sitefilter=${unique
      .map((l) => `${l}wiki`)
      .join('|')}&format=json&origin=*`,
    signal,
  );
  const links = json?.entities?.[qid]?.sitelinks ?? {};
  const out: Record<string, string> = {};
  for (const l of unique) {
    const title = links[`${l}wiki`]?.title;
    if (title) out[l] = stripSectionAnchor(title);
  }
  return out;
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

/* ------------------------------------------------------------------ */
/* Outgoing links leg (SPEC §12.3 g)                                    */
/* ------------------------------------------------------------------ */

export interface WikiLinksPage {
  links: string[];
  /** Continuation token for the next page of links; absent at the end. */
  next?: string;
}

interface WikiLinksResponse {
  continue?: { plcontinue?: string };
  query?: { pages?: Array<{ title?: string; links?: Array<{ title?: string }> }> | Record<string, { links?: Array<{ title?: string }> }> };
}

export function parseWikiLinks(json: WikiLinksResponse | null): WikiLinksPage {
  const raw = json?.query?.pages;
  const pages = Array.isArray(raw) ? raw : Object.values(raw ?? {});
  const links = (pages[0]?.links ?? []).map((l) => l.title).filter((t): t is string => typeof t === 'string' && t.length > 0);
  const next = json?.continue?.plcontinue;
  return next ? { links, next } : { links };
}

export function wikiLinksUrl(lang: string, title: string, plcontinue?: string, limit = 50): string {
  return (
    `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=links&plnamespace=0&pllimit=${limit}` +
    `${plcontinue ? `&plcontinue=${encodeURIComponent(plcontinue)}` : ''}&redirects=1&format=json&formatversion=2&origin=*`
  );
}

/** One page of a page's outgoing article links (main namespace), with the
 *  continuation token for the next page. Keyless, CORS `*`. */
export async function wikiLinks(lang: string, title: string, signal: AbortSignal, plcontinue?: string): Promise<WikiLinksPage> {
  return parseWikiLinks(await fetchJson<WikiLinksResponse>(wikiLinksUrl(lang, title, plcontinue), signal));
}
