/**
 * REV-21 §5B / SPEC §12.6 -- the "context-matched infinite keyword ladder"
 * behind the typing dropdown, with the founder's v2 rule "글로벌 1순위":
 *
 *  tier 1  product corpus     -- the localized axis / app index (local, 0 ms)
 *  tier 2  GLOBAL entities    -- Wikidata items whose LABEL in the visitor's
 *                                language starts with the typed prefix,
 *                                ranked by how many language editions carry
 *                                them (language-independent prominence);
 *  tier 3  own-language pages -- the locale wiki's prefixsearch, then
 *                                `morelike:` neighbours of the top hit.
 *
 * Pages continue forever through an opaque cursor (`recipeFor` says which
 * legs page N runs): prefixsearch `gpsoffset`, wbsearchentities `continue`,
 * search `sroffset`; three empty legs in a row end the ladder. The raw CJK
 * query is only ever sent to the visitor's OWN language endpoints (§2.2 --
 * `language=<locale>` on Wikidata, `<lang>.wikipedia` for pages); English
 * is reached through the entity's sitelink, never through the string.
 *
 * Pure fetch layer (no React); the dropdown owns the IO sentinel.
 */
import { wikiLangFor } from './liveSuggest';
import { stripControl } from './webSynthesisCore';

export type LadderScope = 'global' | 'local' | 'related';

export interface LadderRow {
  scope: LadderScope;
  /** Stable id (`g:Q42`, `l:<title>`, `r:<title>`). */
  id: string;
  title: string;
  description: string;
  url: string;
  qid?: string;
  /** Language editions carrying the entity (global rows). */
  sitelinks?: number;
  lang: string;
}

export interface SuggestCursor {
  /** prefixsearch offset for the next local page. */
  gps: number;
  /** wbsearchentities continue offset for the next global page (null = done). */
  wd: number | null;
  /** `morelike:` seed title + offset for related pages (null = not started). */
  morelike: { title: string; sroffset: number } | null;
  /** Consecutive legs that returned nothing -- three end the ladder. */
  dry: number;
}

export const LADDER_PAGE = 8;
export const LADDER_DRY_LIMIT = 3;
export const SUGGEST_STORAGE_KEY = 'unitas.uai.suggest.v1';
const SUGGEST_TTL_MS = 24 * 60 * 60 * 1000;
const MEMORY_MAX = 240;
const MAX_DESCRIPTION = 140;

export const INITIAL_SUGGEST_CURSOR: SuggestCursor = { gps: 0, wd: 0, morelike: null, dry: 0 };

/** Which legs page N runs (SPEC §5.2 SI-5). */
export function recipeFor(page: number): { local: boolean; global: boolean; related: boolean } {
  if (page === 0) return { local: true, global: true, related: false };
  if (page === 1) return { local: true, global: true, related: false };
  if (page === 2) return { local: false, global: true, related: true };
  // p3+: round-robin -- local, global, related.
  const k = page % 3;
  return { local: k === 0, global: k === 1, related: k === 2 };
}

/* ------------------------------------------------------------------ */
/* Cache: memory LRU + localStorage (24 h)                              */
/* ------------------------------------------------------------------ */

interface Cached {
  rows: LadderRow[];
  cursor: SuggestCursor;
  at: number;
}

const memory = new Map<string, Cached>();

function cacheKey(lang: string, query: string, page: number): string {
  return `${lang}::${query.toLowerCase()}::p${page}`;
}

function readShelf(): Record<string, Cached> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SUGGEST_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Cached>) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function cacheGet(key: string, now = Date.now()): Cached | null {
  const hit = memory.get(key);
  if (hit && now - hit.at < SUGGEST_TTL_MS) {
    memory.delete(key);
    memory.set(key, hit);
    return hit;
  }
  const stored = readShelf()[key];
  if (stored && now - stored.at < SUGGEST_TTL_MS) {
    memory.set(key, stored);
    return stored;
  }
  return null;
}

function cacheSet(key: string, value: Cached): void {
  memory.set(key, value);
  while (memory.size > MEMORY_MAX) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
  if (typeof window === 'undefined') return;
  try {
    const shelf = readShelf();
    shelf[key] = value;
    const entries = Object.entries(shelf)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MEMORY_MAX);
    window.localStorage.setItem(SUGGEST_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // quota / private mode -- memory only.
  }
}

/** Test seam. */
export function __clearSuggestCache(): void {
  memory.clear();
}

/* ------------------------------------------------------------------ */
/* Legs                                                                 */
/* ------------------------------------------------------------------ */

interface WdSearchResponse {
  search?: Array<{ id?: string; label?: string; description?: string; match?: { type?: string; text?: string } }>;
  'search-continue'?: number;
}
interface WdEntitiesResponse {
  entities?: Record<string, { sitelinks?: Record<string, { title?: string }>; labels?: Record<string, { value?: string }>; descriptions?: Record<string, { value?: string }> }>;
}
interface PrefixResponse {
  continue?: { gpsoffset?: number };
  query?: { pages?: Array<{ title?: string; index?: number; description?: string; extract?: string; pageprops?: { wikibase_item?: string; disambiguation?: string } }> };
}
interface SearchResponse {
  continue?: { sroffset?: number };
  query?: { search?: Array<{ title?: string; snippet?: string }> };
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function clip(s: string): string {
  const chars = Array.from(stripControl(s));
  return chars.length <= MAX_DESCRIPTION ? chars.join('') : `${chars.slice(0, MAX_DESCRIPTION - 1).join('').trimEnd()}…`;
}

function wikiUrl(lang: string, title: string): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

/** Pure: the label-prefix candidates of a wbsearchentities answer (alias
 *  hits and non-prefix label hits are strays). */
export function globalCandidates(json: WdSearchResponse | null, query: string): Array<{ id: string; label: string; description: string }> {
  const q = query.trim().toLowerCase();
  return (json?.search ?? [])
    .filter((e) => e.id && e.label && (e.match?.type ?? 'label') === 'label' && e.label.toLowerCase().startsWith(q))
    .map((e) => ({ id: e.id!, label: e.label!, description: e.description ?? '' }));
}

/** Pure: rank by language-edition count (commons / wikidata / species
 *  projects excluded), stable for ties. */
export function rankBySitelinks<T extends { id: string }>(candidates: T[], entities: WdEntitiesResponse | null): Array<T & { sitelinks: number; localeTitle?: string }> {
  return candidates
    .map((c) => {
      const links = entities?.entities?.[c.id]?.sitelinks ?? {};
      const sitelinks = Object.keys(links).filter((k) => /wiki$/.test(k) && !/^(commons|species|wikidata|meta)wiki$/.test(k)).length;
      return { ...c, sitelinks };
    })
    .sort((a, b) => b.sitelinks - a.sitelinks);
}

/** Tier 2: global entities for a prefix in the visitor's language. */
export async function fetchGlobalTier(query: string, locale: string, signal?: AbortSignal, offset = 0): Promise<{ rows: LadderRow[]; next: number | null }> {
  const q = query.trim();
  const lang = wikiLangFor(locale);
  if (!q) return { rows: [], next: null };
  const search = await getJson<WdSearchResponse>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=${lang}&uselang=${lang}&type=item&limit=${LADDER_PAGE}&continue=${offset}&format=json&origin=*`,
    signal,
  );
  const candidates = globalCandidates(search, q);
  if (candidates.length === 0) return { rows: [], next: null };
  const entities = await getJson<WdEntitiesResponse>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${candidates.map((c) => c.id).join('|')}&props=sitelinks|labels&languages=${lang}&format=json&origin=*`,
    signal,
  );
  const ranked = rankBySitelinks(candidates, entities);
  const rows: LadderRow[] = ranked.map((c) => {
    const ownTitle = entities?.entities?.[c.id]?.sitelinks?.[`${lang}wiki`]?.title;
    return {
      scope: 'global',
      id: `g:${c.id}`,
      title: ownTitle ?? c.label,
      description: clip(c.description),
      url: ownTitle ? wikiUrl(lang, ownTitle) : `https://www.wikidata.org/wiki/${c.id}`,
      qid: c.id,
      sitelinks: c.sitelinks,
      lang,
    };
  });
  const next = typeof search?.['search-continue'] === 'number' ? search['search-continue'] : null;
  return { rows, next };
}

/** Tier 3a: own-language prefixsearch page (with the page's QID). */
export async function fetchLocalTier(query: string, locale: string, signal?: AbortSignal, offset = 0): Promise<{ rows: LadderRow[]; next: number | null }> {
  const q = query.trim();
  const lang = wikiLangFor(locale);
  if (!q) return { rows: [], next: null };
  const params = new URLSearchParams({
    action: 'query',
    generator: 'prefixsearch',
    gpssearch: q,
    gpslimit: String(LADDER_PAGE),
    gpsoffset: String(offset),
    prop: 'description|extracts|pageprops',
    ppprop: 'wikibase_item|disambiguation',
    exintro: '1',
    explaintext: '1',
    exsentences: '1',
    exlimit: String(LADDER_PAGE),
    format: 'json',
    formatversion: '2',
    origin: '*',
  });
  const json = await getJson<PrefixResponse>(`https://${lang}.wikipedia.org/w/api.php?${params.toString()}`, signal);
  const rows: LadderRow[] = (json?.query?.pages ?? [])
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .filter((p) => p.title && p.pageprops?.disambiguation === undefined)
    .map((p) => ({
      scope: 'local' as const,
      id: `l:${p.title}`,
      title: stripControl(p.title!),
      description: clip(p.description ?? p.extract ?? ''),
      url: wikiUrl(lang, p.title!),
      qid: p.pageprops?.wikibase_item,
      lang,
    }));
  return { rows, next: typeof json?.continue?.gpsoffset === 'number' ? json.continue.gpsoffset : null };
}

/** Tier 3b: `morelike:` neighbours of the ladder's top own-language hit. */
export async function fetchRelatedTier(seedTitle: string, locale: string, signal?: AbortSignal, offset = 0): Promise<{ rows: LadderRow[]; next: number | null }> {
  const lang = wikiLangFor(locale);
  const json = await getJson<SearchResponse>(
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`morelike:${seedTitle}`)}&srlimit=${LADDER_PAGE}&sroffset=${offset}&srnamespace=0&srprop=snippet&format=json&formatversion=2&origin=*`,
    signal,
  );
  const rows: LadderRow[] = (json?.query?.search ?? [])
    .filter((s) => s.title)
    .map((s) => ({
      scope: 'related' as const,
      id: `r:${s.title}`,
      title: stripControl(s.title!),
      description: clip((s.snippet ?? '').replace(/<[^>]+>/g, '')),
      url: wikiUrl(lang, s.title!),
      lang,
    }));
  return { rows, next: typeof json?.continue?.sroffset === 'number' ? json.continue.sroffset : null };
}

/**
 * One ladder page. Rows are returned in tier order (global → local →
 * related); the caller dedupes across pages by normalised title. The
 * cursor advances every leg the recipe ran; `dry` counts empty legs.
 */
export async function loadLadderPage(
  query: string,
  locale: string,
  page: number,
  cursor: SuggestCursor = INITIAL_SUGGEST_CURSOR,
  signal?: AbortSignal,
): Promise<{ rows: LadderRow[]; cursor: SuggestCursor; done: boolean }> {
  const q = query.trim();
  const lang = wikiLangFor(locale);
  const key = cacheKey(lang, q, page);
  const cached = cacheGet(key);
  if (cached) return { rows: cached.rows, cursor: cached.cursor, done: cached.cursor.dry >= LADDER_DRY_LIMIT };
  const recipe = recipeFor(page);
  const next: SuggestCursor = { ...cursor };
  const rows: LadderRow[] = [];
  let emptyLegs = 0;
  let ranLegs = 0;
  if (recipe.global && next.wd !== null) {
    ranLegs += 1;
    const g = await fetchGlobalTier(q, locale, signal, next.wd);
    rows.push(...g.rows);
    if (g.rows.length === 0) emptyLegs += 1;
    next.wd = g.next;
  }
  if (recipe.local) {
    ranLegs += 1;
    const l = await fetchLocalTier(q, locale, signal, next.gps);
    rows.push(...l.rows);
    if (l.rows.length === 0) emptyLegs += 1;
    else if (!next.morelike) next.morelike = { title: l.rows[0].title, sroffset: 0 };
    next.gps = l.next ?? next.gps + LADDER_PAGE;
  }
  if (recipe.related && next.morelike) {
    ranLegs += 1;
    const r = await fetchRelatedTier(next.morelike.title, locale, signal, next.morelike.sroffset);
    rows.push(...r.rows);
    if (r.rows.length === 0) emptyLegs += 1;
    next.morelike = { title: next.morelike.title, sroffset: r.next ?? next.morelike.sroffset + LADDER_PAGE };
  }
  next.dry = rows.length === 0 ? cursor.dry + Math.max(1, emptyLegs) : 0;
  const done = next.dry >= LADDER_DRY_LIMIT || (ranLegs === 0 && rows.length === 0);
  if (!signal?.aborted && (rows.length > 0 || done)) cacheSet(key, { rows, cursor: next, at: Date.now() });
  return { rows, cursor: next, done };
}

/** Normalised dedupe key across tiers and pages. */
export function ladderRowKey(row: Pick<LadderRow, 'title'>): string {
  return row.title.trim().toLowerCase().replace(/\s+/g, ' ');
}
