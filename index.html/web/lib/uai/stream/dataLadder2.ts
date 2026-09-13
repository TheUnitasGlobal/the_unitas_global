/**
 * REV-21 §5C / SPEC §12.7 -- STAGE 2 of the infinity stream's data ladder
 * (D-37). Eleven more network legs, each keyed on the §2.2 anchor exactly
 * like stage 1: the raw query never reaches a foreign-language engine, and
 * every card names the real operator it came from.
 *
 *   visual      Wikipedia media-list  -> Commons imageinfo (license + author)
 *   graph       Wikidata SPARQL outgoing statements (one hop, labelled)
 *   papers      Crossref, most-cited first
 *   backlinks   Wikipedia linkshere -- who points AT this
 *   extracts    the article's own plain text, paragraph by paragraph
 *   global      langlinks -- the same entity across world editions
 *   siblings    category -> categorymembers (same shelf of the tree)
 *   shelf       Open Library editions, with covers
 *   art         The Met open collection
 *   number      Wikidata quantities (+ World Bank series for a country)
 *   earthEvents NASA EONET bbox + USGS radius (place anchors only)
 *
 * Every leg returns `null` rather than throwing; `buildStreamPage` treats an
 * absent card as an empty leg and the page as thin when all of them are.
 */
import type { DeeperAnchor } from '../deeperAnchor';
import { compactNumber, daysAgo, deeperFetchJson, isoDate, qidOfUri, quoted, sparql, wikiPageUrl, wikidataUrl, type SparqlBindings } from '../deeperFetch';
import type { StreamCard, StreamImage, StreamItem } from './streamTypes';

export interface Stage2Context {
  locale: string;
  lang: string;
  country: string;
  signal?: AbortSignal;
  origin?: string;
}

const plain = (html: string | undefined): string | undefined => {
  const t = (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return t || undefined;
};

/** The title to use on a given edition, and which edition that really is. */
function editionOf(anchor: DeeperAnchor, lang: string): { title: string; lang: string } | null {
  if (anchor.lang === lang && anchor.localeTitle) return { title: anchor.localeTitle, lang };
  if (anchor.enTitle) return { title: anchor.enTitle, lang: 'en' };
  if (anchor.localeTitle) return { title: anchor.localeTitle, lang: anchor.lang };
  return null;
}

const scopeOf = (lang: string): 'global' | 'country' => (lang === 'en' ? 'global' : 'country');

/* ------------------------------------------------------------------ */
/* visual -- Wikipedia media-list -> Commons imageinfo                   */
/* ------------------------------------------------------------------ */

interface MediaListResponse {
  items?: Array<{ type?: string; title?: string; showInGallery?: boolean }>;
}
interface ImageInfoResponse {
  query?: {
    pages?: Array<{
      title?: string;
      imageinfo?: Array<{
        url?: string;
        thumburl?: string;
        thumbwidth?: number;
        thumbheight?: number;
        width?: number;
        height?: number;
        descriptionurl?: string;
        extmetadata?: Record<string, { value?: string }>;
      }>;
    }>;
  };
}

async function commonsImages(files: string[], ctx: Stage2Context): Promise<StreamImage[]> {
  const titles = files.slice(0, 6).map((f) => (f.startsWith('File:') ? f : `File:${f}`));
  if (titles.length === 0) return [];
  const json = await deeperFetchJson<ImageInfoResponse>(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles.join('|'))}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=480&iiextmetadatafilter=LicenseShortName|Artist|ImageDescription&format=json&formatversion=2&origin=*`,
    { signal: ctx.signal },
  );
  return (json?.query?.pages ?? [])
    .map((p) => {
      const ii = p.imageinfo?.[0];
      const src = ii?.thumburl ?? ii?.url;
      if (!src) return null;
      const meta = ii?.extmetadata ?? {};
      const image: StreamImage = {
        src,
        alt: plain(meta.ImageDescription?.value) ?? (p.title ?? '').replace(/^File:/, ''),
        width: ii?.thumbwidth ?? ii?.width,
        height: ii?.thumbheight ?? ii?.height,
        license: plain(meta.LicenseShortName?.value),
        author: plain(meta.Artist?.value),
        pageUrl: ii?.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title ?? '')}`,
      };
      return image;
    })
    .filter((i): i is StreamImage => i !== null);
}

export async function visualLeg(anchor: DeeperAnchor, ctx: Stage2Context, page: number, offset: number): Promise<{ card: StreamCard | null; next: number; done: boolean }> {
  const ed = editionOf(anchor, ctx.lang);
  if (!ed) return { card: null, next: offset, done: true };
  const list = await deeperFetchJson<MediaListResponse>(
    `https://${ed.lang}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(ed.title.replace(/ /g, '_'))}`,
    { signal: ctx.signal },
  );
  const files = (list?.items ?? []).filter((i) => i.type === 'image' && i.title && i.showInGallery !== false).map((i) => i.title!);
  const slice = files.slice(offset, offset + 6);
  const images = await commonsImages(slice, ctx);
  if (images.length === 0) return { card: null, next: offset + 6, done: offset + 6 >= files.length };
  return {
    card: {
      id: `visual-${page}`,
      kind: 'visual',
      page,
      scope: scopeOf(ed.lang),
      sourceId: 'wikimediaCommons',
      sourceUrl: wikiPageUrl(ed.lang, ed.title),
      images,
    },
    next: offset + 6,
    done: offset + 6 >= files.length,
  };
}

/* ------------------------------------------------------------------ */
/* graph -- Wikidata SPARQL, one labelled hop out                        */
/* ------------------------------------------------------------------ */

export async function graphLeg(anchor: DeeperAnchor, ctx: Stage2Context, page: number, offset: number): Promise<{ card: StreamCard | null; next: number; done: boolean }> {
  if (!anchor.qid) return { card: null, next: offset, done: true };
  // Direct claims only (no transitive P279*) -- the measured 8 s cliff.
  const query = `SELECT ?prop ?propLabel ?o ?oLabel WHERE {
  wd:${anchor.qid} ?pred ?o .
  ?prop wikibase:directClaim ?pred .
  FILTER(STRSTARTS(STR(?o), "http://www.wikidata.org/entity/Q"))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${ctx.lang},en". }
} ORDER BY ?prop LIMIT 12 OFFSET ${offset}`;
  const json = await sparql<SparqlBindings>(query, { signal: ctx.signal });
  const rows = json?.results?.bindings ?? [];
  const items: StreamItem[] = rows
    .map((r) => {
      const qid = qidOfUri(r.o?.value);
      const label = r.oLabel?.value;
      const prop = r.propLabel?.value;
      if (!qid || !label || label === qid) return null;
      const item: StreamItem = { id: `g-${qid}-${prop ?? ''}`, title: label, meta: prop, qid, query: label, url: wikidataUrl(qid), sourceId: 'wikidataQuery' };
      return item;
    })
    .filter((i): i is StreamItem => i !== null);
  if (items.length === 0) return { card: null, next: offset + 12, done: rows.length < 12 };
  return {
    card: { id: `graph-${page}`, kind: 'graph', page, scope: 'global', sourceId: 'wikidataQuery', sourceUrl: wikidataUrl(anchor.qid), items },
    next: offset + 12,
    done: rows.length < 12,
  };
}

/* ------------------------------------------------------------------ */
/* papers -- Crossref                                                    */
/* ------------------------------------------------------------------ */

interface CrossrefList {
  message?: {
    'total-results'?: number;
    items?: Array<{ title?: string[]; DOI?: string; URL?: string; 'is-referenced-by-count'?: number; issued?: { 'date-parts'?: number[][] }; 'container-title'?: string[] }>;
  };
}

export async function papersLeg(anchor: DeeperAnchor, ctx: Stage2Context, page: number, offset: number): Promise<{ card: StreamCard | null; next: number; done: boolean }> {
  if (!anchor.enTitle) return { card: null, next: offset, done: true };
  const json = await deeperFetchJson<CrossrefList>(
    `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(anchor.enTitle)}&rows=6&offset=${offset}&sort=is-referenced-by-count&order=desc&select=title,DOI,is-referenced-by-count,issued,URL,container-title`,
    { signal: ctx.signal },
  );
  const rows = json?.message?.items ?? [];
  const items: StreamItem[] = rows
    .map((w) => {
      const title = w.title?.[0];
      if (!title) return null;
      const year = w.issued?.['date-parts']?.[0]?.[0];
      const cited = w['is-referenced-by-count'];
      const item: StreamItem = {
        id: w.DOI ?? title,
        title,
        meta: [w['container-title']?.[0], year, cited ? `${compactNumber(cited, ctx.locale)} cit.` : undefined].filter(Boolean).join(' · '),
        url: w.DOI ? `https://doi.org/${w.DOI}` : w.URL,
        sourceId: 'crossref',
      };
      return item;
    })
    .filter((i): i is StreamItem => i !== null);
  const total = json?.message?.['total-results'] ?? 0;
  if (items.length === 0) return { card: null, next: offset + 6, done: true };
  return {
    card: {
      id: `papers-${page}`,
      kind: 'papers',
      page,
      scope: 'global',
      sourceId: 'crossref',
      sourceUrl: `https://search.crossref.org/?q=${encodeURIComponent(anchor.enTitle)}`,
      items,
    },
    next: offset + 6,
    done: offset + 6 >= total,
  };
}

/* ------------------------------------------------------------------ */
/* backlinks -- who points AT this article                               */
/* ------------------------------------------------------------------ */

interface LinksHereResponse {
  continue?: { lhcontinue?: string };
  query?: { pages?: Array<{ linkshere?: Array<{ title?: string }> }> };
}

export async function backlinksLeg(anchor: DeeperAnchor, ctx: Stage2Context, page: number, cont: string | undefined): Promise<{ card: StreamCard | null; next?: string; done: boolean }> {
  const ed = editionOf(anchor, ctx.lang);
  if (!ed) return { card: null, done: true };
  const json = await deeperFetchJson<LinksHereResponse>(
    `https://${ed.lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(ed.title)}&prop=linkshere&lhnamespace=0&lhshow=!redirect&lhlimit=16${cont ? `&lhcontinue=${encodeURIComponent(cont)}` : ''}&redirects=1&format=json&formatversion=2&origin=*`,
    { signal: ctx.signal },
  );
  const rows = json?.query?.pages?.[0]?.linkshere ?? [];
  const items: StreamItem[] = rows
    .map((l) => l.title)
    .filter((t): t is string => Boolean(t))
    .slice(0, 14)
    .map((t) => ({ id: `bl-${t}`, title: t, query: t, url: wikiPageUrl(ed.lang, t), sourceId: 'wikipedia' as const }));
  const next = json?.continue?.lhcontinue;
  if (items.length === 0) return { card: null, next, done: !next };
  return {
    card: { id: `backlinks-${page}`, kind: 'backlinks', page, scope: scopeOf(ed.lang), sourceId: 'wikipedia', sourceUrl: `${wikiPageUrl(ed.lang, ed.title)}`, items },
    next,
    done: !next,
  };
}

/* ------------------------------------------------------------------ */
/* extracts -- the article's own prose, paragraph by paragraph            */
/* ------------------------------------------------------------------ */

interface ExtractResponse {
  query?: { pages?: Array<{ extract?: string }> };
}

export async function extractsLeg(anchor: DeeperAnchor, ctx: Stage2Context, page: number, para: number): Promise<{ card: StreamCard | null; next: number; done: boolean }> {
  const ed = editionOf(anchor, ctx.lang);
  if (!ed) return { card: null, next: para, done: true };
  const json = await deeperFetchJson<ExtractResponse>(
    `https://${ed.lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(ed.title)}&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&format=json&formatversion=2&origin=*`,
    { signal: ctx.signal },
  );
  const text = json?.query?.pages?.[0]?.extract ?? '';
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 120 && !/^=+.*=+$/.test(p));
  const slice = paragraphs.slice(para, para + 2);
  if (slice.length === 0) return { card: null, next: para + 2, done: true };
  return {
    card: {
      id: `extracts-${page}`,
      kind: 'extracts',
      page,
      scope: scopeOf(ed.lang),
      sourceId: 'wikipedia',
      sourceUrl: wikiPageUrl(ed.lang, ed.title),
      text: slice.join('\n\n'),
      facts: [{ label: 'passage', value: `${para + 1}–${para + slice.length} / ${paragraphs.length}` }],
    },
    next: para + 2,
    done: para + 2 >= paragraphs.length,
  };
}

/* ------------------------------------------------------------------ */
/* global -- the same entity across world editions                       */
/* ------------------------------------------------------------------ */

interface LangLinksResponse {
  query?: { pages?: Array<{ langlinks?: Array<{ lang?: string; title?: string; langname?: string }> }> };
}

export async function globalLeg(anchor: DeeperAnchor, ctx: Stage2Context, page: number, offset: number): Promise<{ card: StreamCard | null; next: number; done: boolean }> {
  const ed = editionOf(anchor, ctx.lang);
  if (!ed) return { card: null, next: offset, done: true };
  const json = await deeperFetchJson<LangLinksResponse>(
    `https://${ed.lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(ed.title)}&prop=langlinks&lllimit=400&llprop=langname&llinlanguagecode=${ctx.lang}&redirects=1&format=json&formatversion=2&origin=*`,
    { signal: ctx.signal },
  );
  const rows = json?.query?.pages?.[0]?.langlinks ?? [];
  const slice = rows.slice(offset, offset + 14);
  const items: StreamItem[] = slice
    .filter((l) => l.lang && l.title)
    .map((l) => ({
      id: `gl-${l.lang}`,
      title: l.title!,
      meta: l.langname ?? l.lang,
      url: wikiPageUrl(l.lang!, l.title!),
      sourceId: 'wikipedia' as const,
    }));
  if (items.length === 0) return { card: null, next: offset + 14, done: true };
  return {
    card: {
      id: `global-${page}`,
      kind: 'global',
      page,
      scope: 'global',
      sourceId: 'wikipedia',
      sourceUrl: wikiPageUrl(ed.lang, ed.title),
      facts: [{ label: 'editions', value: String(rows.length + 1), emphasis: true }],
      items,
    },
    next: offset + 14,
    done: offset + 14 >= rows.length,
  };
}

/* ------------------------------------------------------------------ */
/* siblings -- the same shelf of the tree (category members)             */
/* ------------------------------------------------------------------ */

interface CategoriesResponse {
  query?: { pages?: Array<{ categories?: Array<{ title?: string }> }> };
}
interface MembersResponse {
  continue?: { cmcontinue?: string };
  query?: { categorymembers?: Array<{ title?: string }> };
}

export async function siblingsLeg(
  anchor: DeeperAnchor,
  ctx: Stage2Context,
  page: number,
  state: { category?: string; cont?: string },
): Promise<{ card: StreamCard | null; next: { category?: string; cont?: string }; done: boolean }> {
  const ed = editionOf(anchor, ctx.lang);
  if (!ed) return { card: null, next: state, done: true };
  let category = state.category;
  if (!category) {
    const cats = await deeperFetchJson<CategoriesResponse>(
      `https://${ed.lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(ed.title)}&prop=categories&clshow=!hidden&cllimit=12&redirects=1&format=json&formatversion=2&origin=*`,
      { signal: ctx.signal },
    );
    category = (cats?.query?.pages?.[0]?.categories ?? []).map((c) => c.title).find((t): t is string => Boolean(t));
  }
  if (!category) return { card: null, next: state, done: true };
  const json = await deeperFetchJson<MembersResponse>(
    `https://${ed.lang}.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(category)}&cmnamespace=0&cmlimit=14${state.cont ? `&cmcontinue=${encodeURIComponent(state.cont)}` : ''}&format=json&formatversion=2&origin=*`,
    { signal: ctx.signal },
  );
  const items: StreamItem[] = (json?.query?.categorymembers ?? [])
    .map((m) => m.title)
    .filter((t): t is string => Boolean(t) && t !== ed.title)
    .map((t) => ({ id: `sib-${t}`, title: t, query: t, url: wikiPageUrl(ed.lang, t), sourceId: 'wikipedia' as const }));
  const cont = json?.continue?.cmcontinue;
  const next = { category, cont };
  if (items.length === 0) return { card: null, next, done: !cont };
  return {
    card: {
      id: `siblings-${page}`,
      kind: 'siblings',
      page,
      scope: scopeOf(ed.lang),
      sourceId: 'wikipedia',
      sourceUrl: `https://${ed.lang}.wikipedia.org/wiki/${encodeURIComponent(category)}`,
      facts: [{ label: category.replace(/^[^:]+:/, ''), literal: true, value: '' }],
      items,
    },
    next,
    done: !cont,
  };
}

/* ------------------------------------------------------------------ */
/* shelf -- Open Library                                                 */
/* ------------------------------------------------------------------ */

interface OpenLibraryList {
  numFound?: number;
  docs?: Array<{ key?: string; title?: string; author_name?: string[]; first_publish_year?: number; cover_i?: number }>;
}

export async function shelfLeg(anchor: DeeperAnchor, ctx: Stage2Context, page: number, offset: number): Promise<{ card: StreamCard | null; next: number; done: boolean }> {
  if (!anchor.enTitle) return { card: null, next: offset, done: true };
  const json = await deeperFetchJson<OpenLibraryList>(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(quoted(anchor.enTitle))}&limit=8&offset=${offset}&fields=key,title,author_name,first_publish_year,cover_i`,
    { signal: ctx.signal },
  );
  const docs = json?.docs ?? [];
  const items: StreamItem[] = docs
    .filter((d) => d.title)
    .map((d) => ({
      id: d.key ?? d.title!,
      title: d.title!,
      meta: [d.author_name?.[0], d.first_publish_year].filter(Boolean).join(' · '),
      url: d.key ? `https://openlibrary.org${d.key}` : undefined,
      sourceId: 'openLibrary' as const,
    }));
  if (items.length === 0) return { card: null, next: offset + 8, done: true };
  const images: StreamImage[] = docs
    .filter((d) => typeof d.cover_i === 'number')
    .slice(0, 6)
    .map((d) => ({
      src: `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`,
      alt: d.title ?? '',
      pageUrl: d.key ? `https://openlibrary.org${d.key}` : undefined,
    }));
  return {
    card: {
      id: `shelf-${page}`,
      kind: 'shelf',
      page,
      scope: 'global',
      sourceId: 'openLibrary',
      sourceUrl: `https://openlibrary.org/search?q=${encodeURIComponent(anchor.enTitle)}`,
      items,
      images: images.length > 0 ? images : undefined,
    },
    next: offset + 8,
    done: offset + 8 >= (json?.numFound ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/* art -- The Met open collection                                        */
/* ------------------------------------------------------------------ */

interface MetSearch {
  total?: number;
  objectIDs?: number[] | null;
}
interface MetObject {
  objectID?: number;
  title?: string;
  artistDisplayName?: string;
  objectDate?: string;
  primaryImageSmall?: string;
  objectURL?: string;
  medium?: string;
}

export async function artLeg(
  anchor: DeeperAnchor,
  ctx: Stage2Context,
  page: number,
  state: { ids?: number[]; offset: number },
): Promise<{ card: StreamCard | null; next: { ids?: number[]; offset: number }; done: boolean }> {
  const term = anchor.enTitle ?? anchor.term;
  if (!term) return { card: null, next: state, done: true };
  let ids = state.ids;
  if (!ids) {
    const search = await deeperFetchJson<MetSearch>(
      `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(term)}&hasImages=true`,
      { signal: ctx.signal },
    );
    ids = (search?.objectIDs ?? []).slice(0, 60);
  }
  const slice = ids.slice(state.offset, state.offset + 4);
  if (slice.length === 0) return { card: null, next: { ids, offset: state.offset + 4 }, done: true };
  const objects = (
    await Promise.all(
      slice.map((id) =>
        deeperFetchJson<MetObject>(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, { signal: ctx.signal }),
      ),
    )
  ).filter((o): o is MetObject => Boolean(o?.title));
  if (objects.length === 0) return { card: null, next: { ids, offset: state.offset + 4 }, done: state.offset + 4 >= ids.length };
  const items: StreamItem[] = objects.map((o) => ({
    id: String(o.objectID ?? o.title),
    title: o.title!,
    meta: [o.artistDisplayName, o.objectDate, o.medium].filter(Boolean).join(' · '),
    url: o.objectURL,
    sourceId: 'theMet' as const,
  }));
  const images: StreamImage[] = objects
    .filter((o) => o.primaryImageSmall)
    .map((o) => ({ src: o.primaryImageSmall!, alt: o.title ?? '', pageUrl: o.objectURL, author: o.artistDisplayName || undefined }));
  return {
    card: {
      id: `art-${page}`,
      kind: 'art',
      page,
      scope: 'global',
      sourceId: 'theMet',
      sourceUrl: `https://www.metmuseum.org/art/collection/search?q=${encodeURIComponent(term)}`,
      items,
      images: images.length > 0 ? images : undefined,
    },
    next: { ids, offset: state.offset + 4 },
    done: state.offset + 4 >= ids.length,
  };
}

/* ------------------------------------------------------------------ */
/* number -- Wikidata quantities, World Bank series for a country        */
/* ------------------------------------------------------------------ */

const WB_INDICATORS: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'SP.POP.TOTL', label: 'population' },
  { code: 'NY.GDP.MKTP.CD', label: 'gdp' },
  { code: 'NY.GDP.PCAP.CD', label: 'gdpPerCapita' },
  { code: 'SP.DYN.LE00.IN', label: 'lifeExpectancy' },
  { code: 'IT.NET.USER.ZS', label: 'internetUsers' },
];

interface WbRow {
  date?: string;
  value?: number | null;
}

interface WdQuantities {
  entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> }>;
}

const WD_QUANTITY_PROPS: ReadonlyArray<{ pid: string; label: string; unit?: string }> = [
  { pid: 'P1082', label: 'population' },
  { pid: 'P2046', label: 'area', unit: 'km²' },
  { pid: 'P2044', label: 'elevation', unit: 'm' },
  { pid: 'P1081', label: 'hdi' },
  { pid: 'P2131', label: 'gdp' },
];

export async function numberLeg(anchor: DeeperAnchor, ctx: Stage2Context, page: number, indicator: number): Promise<{ card: StreamCard | null; next: number; done: boolean }> {
  // A country anchor gets a real World Bank series (one indicator per visit).
  if (anchor.countryCode) {
    const pick = WB_INDICATORS[indicator % WB_INDICATORS.length];
    const json = await deeperFetchJson<[unknown, WbRow[] | null]>(
      `https://api.worldbank.org/v2/country/${anchor.countryCode.toLowerCase()}/indicator/${pick.code}?format=json&per_page=12&source=2`,
      { signal: ctx.signal },
    );
    const rows = (Array.isArray(json) ? json[1] : null) ?? [];
    const usable = rows.filter((r) => typeof r.value === 'number' && r.date).reverse();
    if (usable.length >= 2) {
      const points = usable.map((r) => r.value as number);
      const latest = points[points.length - 1];
      return {
        card: {
          id: `number-${page}`,
          kind: 'number',
          page,
          scope: 'country',
          sourceId: 'worldBank',
          sourceUrl: `https://data.worldbank.org/country/${anchor.countryCode.toLowerCase()}`,
          series: { points, dates: usable.map((r) => r.date!) },
          facts: [
            { label: pick.label, value: compactNumber(latest, ctx.locale), emphasis: true },
            { label: 'window', value: `${usable[0].date} → ${usable[usable.length - 1].date}` },
          ],
        },
        next: indicator + 1,
        done: false,
      };
    }
  }
  // Otherwise: the entity's own numeric claims.
  if (!anchor.qid) return { card: null, next: indicator + 1, done: true };
  const json = await deeperFetchJson<WdQuantities>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${anchor.qid}&props=claims&format=json&origin=*`,
    { signal: ctx.signal },
  );
  const claims = json?.entities?.[anchor.qid]?.claims ?? {};
  const facts = WD_QUANTITY_PROPS.map(({ pid, label, unit }) => {
    const raw = (claims[pid] ?? [])[0]?.mainsnak?.datavalue?.value as { amount?: string } | undefined;
    const amount = raw?.amount ? Number(raw.amount.replace(/^\+/, '')) : NaN;
    if (!Number.isFinite(amount)) return null;
    return { label, value: compactNumber(amount, ctx.locale), unit, emphasis: label === 'population' };
  }).filter((f): f is NonNullable<typeof f> => f !== null);
  if (facts.length === 0) return { card: null, next: indicator + 1, done: true };
  return {
    card: { id: `number-${page}`, kind: 'number', page, scope: 'global', sourceId: 'wikidata', sourceUrl: wikidataUrl(anchor.qid), facts },
    next: indicator + 1,
    done: true,
  };
}

/* ------------------------------------------------------------------ */
/* earthEvents -- NASA EONET bbox + USGS radius (place anchors)          */
/* ------------------------------------------------------------------ */

interface EonetResponse {
  events?: Array<{
    id?: string;
    title?: string;
    categories?: Array<{ title?: string }>;
    geometry?: Array<{ date?: string }>;
    sources?: Array<{ url?: string }>;
    link?: string;
  }>;
}
interface UsgsResponse {
  features?: Array<{ id?: string; properties?: { mag?: number; place?: string; time?: number; url?: string } }>;
}

export async function earthEventsLeg(anchor: DeeperAnchor, ctx: Stage2Context, page: number): Promise<StreamCard | null> {
  const coord = anchor.coord;
  if (!coord || typeof coord.lat !== 'number' || typeof coord.lon !== 'number') return null;
  const { lat, lon } = coord;
  const bbox = [lon - 3, lat + 3, lon + 3, lat - 3].map((n) => n.toFixed(2)).join(',');
  const end = new Date();
  const start = daysAgo(30);
  const [eonet, usgs] = await Promise.all([
    deeperFetchJson<EonetResponse>(`https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&bbox=${bbox}`, { signal: ctx.signal }),
    deeperFetchJson<UsgsResponse>(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=800&starttime=${isoDate(start)}&endtime=${isoDate(end)}&orderby=time&limit=6&minmagnitude=2.5`,
      { signal: ctx.signal },
    ),
  ]);
  const events: StreamItem[] = (eonet?.events ?? []).slice(0, 6).map((e) => ({
    id: `eonet-${e.id ?? e.title}`,
    title: e.title ?? '—',
    meta: [e.categories?.[0]?.title, (e.geometry?.[0]?.date ?? '').slice(0, 10)].filter(Boolean).join(' · '),
    url: e.sources?.[0]?.url ?? e.link,
    sourceId: 'nasaEonet' as const,
  }));
  const quakes: StreamItem[] = (usgs?.features ?? []).slice(0, 6).map((f) => ({
    id: `usgs-${f.id}`,
    title: `M ${f.properties?.mag ?? '?'} · ${f.properties?.place ?? ''}`.trim(),
    meta: f.properties?.time ? isoDate(new Date(f.properties.time)) : undefined,
    url: f.properties?.url,
    sourceId: 'usgs' as const,
  }));
  const items = [...events, ...quakes];
  if (items.length === 0) return null;
  return {
    id: `earthEvents-${page}`,
    kind: 'earthEvents',
    page,
    scope: 'country',
    sourceId: events.length > 0 ? 'nasaEonet' : 'usgs',
    sourceUrl: events.length > 0 ? 'https://eonet.gsfc.nasa.gov/' : 'https://earthquake.usgs.gov/earthquakes/map/',
    facts: [
      { label: 'events', value: String(events.length) },
      { label: 'quakes', value: String(quakes.length) },
      { label: 'window', value: `${isoDate(start)} → ${isoDate(end)}` },
    ],
    items,
  };
}
