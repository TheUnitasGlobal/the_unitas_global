/**
 * STAGE 2 of the infinity stream's data ladder. Every leg is keyed on the
 * anchored entity exactly like stage 1: the raw query never reaches a
 * foreign-language engine, and every card names the real operator it came
 * from.
 *
 *   graph     Wikidata SPARQL outgoing statements (one hop, labelled)
 *   extracts  the article's own plain text, paragraph by paragraph
 *   global    langlinks -- the same entity across world editions
 *
 * REV-23 M2.2 (founder directive 2026-09-13): the other eight legs -- visual,
 * papers, backlinks, siblings, shelf, art, number, earthEvents -- are deleted
 * along with the card kinds they fed. Their Commons / Crossref / Open Library
 * / Met / World Bank / EONET / USGS calls are gone from the bundle entirely,
 * which is also why a stream page now costs strictly fewer requests than it
 * did.
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

