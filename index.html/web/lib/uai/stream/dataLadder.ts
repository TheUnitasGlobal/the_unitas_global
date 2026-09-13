/**
 * REV-21 §5C / SPEC §12.7 -- the stream's data ladder: one isomorphic
 * `buildStreamPage(query, page, anchor, ctx)` that the browser fallback and
 * `GET /api/u-ai/stream` both run. Every network leg is keyed on the
 * §2.2 anchor (QID / exact titles) -- the raw query never reaches a
 * foreign-language engine -- and every card names its real source.
 *
 * Page 0 needs no network at all (it is rendered from the surface report
 * in the component); this module produces the NETWORK cards of pages ≥ 1
 * plus the deterministic COGS card. Wikimedia legs are serialized by
 * deeperFetch (≤ 2 per page by construction of the recipe).
 */
import type { DeeperAnchor } from '../deeperAnchor';
import { compactNumber, daysAgo, deeperFetchJson, isoDate, quoted, wikiPageUrl, wikidataUrl } from '../deeperFetch';
import { parseWikiLinks, wikiLinksUrl } from '../entityResolve';
import type { ConstitutionScore } from '../types';
import { cogsCardFor } from './cogsMatrix';
import { STREAM_PAGE_CAP, streamRecipe, type StreamCard, type StreamCardKind, type StreamItem, type StreamPage } from './streamTypes';

export interface StreamContext {
  locale: string;
  lang: string;
  country: string;
  constitution: readonly ConstitutionScore[];
  signal?: AbortSignal;
  /** Absolute origin for the same-origin routes when running server-side. */
  origin?: string;
}

/* ------------------------------------------------------------------ */
/* Legs                                                                 */
/* ------------------------------------------------------------------ */

interface WdEntity {
  labels?: Record<string, { value?: string }>;
  descriptions?: Record<string, { value?: string }>;
  sitelinks?: Record<string, { title?: string }>;
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;
}

async function identityLeg(anchor: DeeperAnchor, ctx: StreamContext, page: number): Promise<StreamCard | null> {
  if (!anchor.qid) return null;
  const json = await deeperFetchJson<{ entities?: Record<string, WdEntity> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${anchor.qid}&props=labels|descriptions|sitelinks|claims&languages=${ctx.lang}|en&format=json&origin=*`,
    { signal: ctx.signal },
  );
  const e = json?.entities?.[anchor.qid];
  if (!e) return null;
  const p31 = (e.claims?.P31 ?? []).map((c) => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id).filter((id): id is string => Boolean(id)).slice(0, 4);
  const labels = p31.length > 0
    ? await deeperFetchJson<{ entities?: Record<string, WdEntity> }>(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${p31.join('|')}&props=labels&languages=${ctx.lang}|en&format=json&origin=*`, { signal: ctx.signal })
    : null;
  const classNames = p31.map((id) => labels?.entities?.[id]?.labels?.[ctx.lang]?.value ?? labels?.entities?.[id]?.labels?.en?.value).filter((v): v is string => Boolean(v));
  const editions = Object.keys(e.sitelinks ?? {}).filter((k) => /wiki$/.test(k) && !/^(commons|species|wikidata|meta)wiki$/.test(k)).length;
  const description = e.descriptions?.[ctx.lang]?.value ?? e.descriptions?.en?.value;
  return {
    id: `identity-${page}`,
    kind: 'identity',
    page,
    scope: 'global',
    sourceId: 'wikidata',
    sourceUrl: wikidataUrl(anchor.qid),
    text: description,
    facts: [
      { label: 'editions', value: String(editions), emphasis: true },
      ...(classNames.length > 0 ? [{ label: 'instanceOf', value: classNames.join(' · ') }] : []),
      { label: 'entity', value: anchor.qid },
    ],
    items: classNames.length > 0 ? p31.map((id, i) => ({ id, title: classNames[i] ?? id, qid: id, query: classNames[i], url: wikidataUrl(id) })).filter((it) => it.title !== it.id).slice(0, 4) : undefined,
  };
}

async function conceptsLeg(anchor: DeeperAnchor, ctx: StreamContext, page: number, offset: string | undefined): Promise<{ card: StreamCard | null; next?: string }> {
  const title = anchor.lang === ctx.lang ? anchor.localeTitle : undefined;
  if (!title) return { card: null };
  const json = await deeperFetchJson<Parameters<typeof parseWikiLinks>[0]>(wikiLinksUrl(ctx.lang, title, offset, 24), { signal: ctx.signal });
  const parsed = parseWikiLinks(json);
  if (parsed.links.length === 0) return { card: null };
  const items: StreamItem[] = parsed.links.slice(0, 16).map((t) => ({ id: `c-${t}`, title: t, query: t, url: wikiPageUrl(ctx.lang, t) }));
  return {
    card: { id: `concepts-${page}`, kind: 'concepts', page, scope: 'country', sourceId: 'wikipedia', sourceUrl: wikiPageUrl(ctx.lang, title), items },
    next: parsed.next,
  };
}

interface ExtLinksResponse {
  continue?: { eloffset?: number };
  query?: { pages?: Array<{ extlinks?: Array<{ url?: string }> }> };
}

async function sitesLeg(anchor: DeeperAnchor, ctx: StreamContext, page: number, offset: number): Promise<{ card: StreamCard | null; next?: number }> {
  const title = anchor.lang === ctx.lang ? anchor.localeTitle : anchor.enTitle;
  const lang = anchor.lang === ctx.lang ? ctx.lang : 'en';
  if (!title) return { card: null };
  const json = await deeperFetchJson<ExtLinksResponse>(
    `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extlinks&ellimit=12&eloffset=${offset}&redirects=1&format=json&formatversion=2&origin=*`,
    { signal: ctx.signal },
  );
  const urls = (json?.query?.pages?.[0]?.extlinks ?? []).map((l) => l.url).filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u));
  const items: StreamItem[] = urls
    .filter((u) => !/wikipedia\.org|wikidata\.org|wikimedia\.org|archive\.org\/web/.test(u))
    .slice(0, 10)
    .map((u) => {
      let host = u;
      try {
        host = new URL(u).hostname.replace(/^www\./, '');
      } catch {
        // keep the raw url
      }
      return { id: `s-${u}`, title: host, meta: u.length > 80 ? `${u.slice(0, 77)}…` : u, url: u };
    });
  if (items.length === 0) return { card: null, next: json?.continue?.eloffset };
  return {
    card: { id: `sites-${page}`, kind: 'sites', page, scope: 'global', sourceId: 'wikipedia', sourceUrl: wikiPageUrl(lang, title), items },
    next: json?.continue?.eloffset,
  };
}

interface EntityNews {
  items?: Array<{ id: string; title: string; url: string; domain?: string; publishedAt?: string; wire: 'gnews' | 'bing' }>;
  hasMore?: boolean;
}

async function newsLeg(anchor: DeeperAnchor, ctx: StreamContext, page: number, newsPage: number, leg: 'global' | 'country'): Promise<StreamCard | null> {
  const q = new URLSearchParams({ locale: ctx.locale, country: ctx.country, leg, page: String(newsPage) });
  if (anchor.qid) q.set('qid', anchor.qid);
  if (anchor.enTitle) q.set('enTitle', anchor.enTitle);
  q.set('localeTitle', anchor.localeTitle ?? anchor.term);
  const json = await deeperFetchJson<EntityNews>(`${ctx.origin ?? ''}/api/live/entity-news?${q.toString()}`, { signal: ctx.signal, timeoutMs: 12_000 });
  const items = json?.items ?? [];
  if (items.length === 0) return null;
  return {
    id: `news-${leg}-${page}`,
    kind: 'news',
    page,
    scope: leg,
    sourceId: items[0].wire === 'bing' ? 'bingNews' : 'googleNews',
    items: items.slice(0, 8).map((it) => ({ id: it.id, title: it.title, meta: [it.domain, (it.publishedAt ?? '').slice(0, 10)].filter(Boolean).join(' · '), url: it.url, date: it.publishedAt, sourceId: it.wire === 'bing' ? 'bingNews' : 'googleNews' })),
  };
}

interface OpenAlexList {
  results?: Array<{ id?: string; display_name?: string; publication_year?: number; cited_by_count?: number; doi?: string; authorships?: Array<{ author?: { display_name?: string } }> }>;
}
interface OpenLibraryList {
  docs?: Array<{ key?: string; title?: string; author_name?: string[]; first_publish_year?: number }>;
}

async function derivedLeg(anchor: DeeperAnchor, ctx: StreamContext, page: number, offset: number): Promise<StreamCard | null> {
  if (!anchor.enTitle) return null;
  const [alex, library] = await Promise.all([
    deeperFetchJson<OpenAlexList>(
      `https://api.openalex.org/works?search=${encodeURIComponent(quoted(anchor.enTitle))}&sort=cited_by_count:desc&per-page=5&page=${offset + 1}&select=id,display_name,publication_year,cited_by_count,doi,authorships`,
      { signal: ctx.signal },
    ),
    offset === 0
      ? deeperFetchJson<OpenLibraryList>(`https://openlibrary.org/search.json?q=${encodeURIComponent(anchor.enTitle)}&limit=4&fields=key,title,author_name,first_publish_year`, { signal: ctx.signal })
      : Promise.resolve<OpenLibraryList | null>(null),
  ]);
  const works: StreamItem[] = (alex?.results ?? [])
    .filter((w) => w.display_name)
    .map((w) => ({ id: w.id ?? w.display_name!, title: w.display_name!, meta: [w.authorships?.[0]?.author?.display_name, w.publication_year, w.cited_by_count ? `${compactNumber(w.cited_by_count, ctx.locale)} cit.` : undefined].filter(Boolean).join(' · '), url: w.doi ?? w.id, sourceId: 'openAlex' as const }));
  const books: StreamItem[] = (library?.docs ?? [])
    .filter((d) => d.title)
    .map((d) => ({ id: d.key ?? d.title!, title: d.title!, meta: [d.author_name?.[0], d.first_publish_year].filter(Boolean).join(' · '), url: d.key ? `https://openlibrary.org${d.key}` : undefined, sourceId: 'openLibrary' as const }));
  const items = [...works, ...books];
  if (items.length === 0) return null;
  return { id: `derived-${page}`, kind: 'derived', page, scope: 'global', sourceId: 'openAlex', sourceUrl: `https://openalex.org/works?search=${encodeURIComponent(anchor.enTitle)}`, items };
}

interface Pageviews {
  items?: Array<{ timestamp?: string; views?: number }>;
}

async function attentionLeg(anchor: DeeperAnchor, ctx: StreamContext, page: number, monthsBack: number): Promise<StreamCard | null> {
  const title = anchor.enTitle ?? (anchor.lang === 'en' ? anchor.localeTitle : undefined);
  if (!title) return null;
  const end = daysAgo(1 + monthsBack * 30);
  const start = daysAgo(30 + monthsBack * 30);
  const stamp = (d: Date) => isoDate(d).replace(/-/g, '');
  const json = await deeperFetchJson<Pageviews>(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, '_'))}/daily/${stamp(start)}/${stamp(end)}`,
    { signal: ctx.signal },
  );
  const rows = (json?.items ?? []).filter((i) => typeof i.views === 'number');
  if (rows.length === 0) return null;
  const points = rows.map((i) => i.views as number);
  const total = points.reduce((s, n) => s + n, 0);
  const half = Math.floor(points.length / 2);
  const a = points.slice(0, half).reduce((s, n) => s + n, 0) / Math.max(1, half);
  const b = points.slice(half).reduce((s, n) => s + n, 0) / Math.max(1, points.length - half);
  const trend = a > 0 ? Math.round(((b - a) / a) * 100) : 0;
  return {
    id: `attention-${page}`,
    kind: 'attention',
    page,
    scope: 'global',
    sourceId: 'wikimediaPageviews',
    sourceUrl: `https://pageviews.wmcloud.org/?project=en.wikipedia.org&pages=${encodeURIComponent(title)}`,
    series: { points, dates: rows.map((i) => `${i.timestamp!.slice(0, 4)}-${i.timestamp!.slice(4, 6)}-${i.timestamp!.slice(6, 8)}`) },
    facts: [
      { label: 'views30', value: compactNumber(total, ctx.locale), emphasis: true },
      { label: 'trend', value: `${trend > 0 ? '+' : ''}${trend}%` },
      { label: 'window', value: `${isoDate(start)} → ${isoDate(end)}` },
    ],
  };
}

interface HnResponse {
  hits?: Array<{ objectID: string; title?: string; url?: string; points?: number; num_comments?: number; created_at?: string }>;
  nbPages?: number;
}

async function communityLeg(anchor: DeeperAnchor, ctx: StreamContext, page: number, hnPage: number): Promise<{ card: StreamCard | null; more: boolean }> {
  if (!anchor.enTitle) return { card: null, more: false };
  const json = await deeperFetchJson<HnResponse>(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(quoted(anchor.enTitle))}&tags=story&numericFilters=points%3E20&hitsPerPage=8&page=${hnPage}`,
    { signal: ctx.signal },
  );
  const hits = (json?.hits ?? []).filter((h) => h.title);
  if (hits.length === 0) return { card: null, more: false };
  return {
    card: {
      id: `community-${page}`,
      kind: 'community',
      page,
      scope: 'global',
      sourceId: 'hackerNews',
      sourceUrl: `https://hn.algolia.com/?q=${encodeURIComponent(anchor.enTitle)}`,
      items: hits.map((h) => ({ id: h.objectID, title: h.title!, meta: `${h.points ?? 0} pt · ${h.num_comments ?? 0} 💬 · ${(h.created_at ?? '').slice(0, 10)}`, url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`, date: h.created_at })),
    },
    more: hnPage + 1 < (json?.nbPages ?? 0),
  };
}

interface Revisions {
  continue?: { rvcontinue?: string };
  query?: { pages?: Array<{ revisions?: Array<{ timestamp?: string; user?: string; comment?: string; anon?: boolean }> }> };
}

async function timelineLeg(anchor: DeeperAnchor, ctx: StreamContext, page: number, rvcontinue: string | undefined): Promise<{ card: StreamCard | null; next?: string }> {
  const title = anchor.lang === ctx.lang ? anchor.localeTitle : anchor.enTitle;
  const lang = anchor.lang === ctx.lang ? ctx.lang : 'en';
  if (!title) return { card: null };
  const json = await deeperFetchJson<Revisions>(
    `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=revisions&rvprop=timestamp|user|comment|flags&rvlimit=10${rvcontinue ? `&rvcontinue=${encodeURIComponent(rvcontinue)}` : ''}&redirects=1&format=json&formatversion=2&origin=*`,
    { signal: ctx.signal },
  );
  const revs = json?.query?.pages?.[0]?.revisions ?? [];
  if (revs.length === 0) return { card: null };
  const mask = (u: string | undefined, anon?: boolean) => (!u || anon || /^\d{1,3}(\.\d{1,3}){3}$/.test(u) || /:/.test(u) || /^~/.test(u) ? '·····' : u);
  return {
    card: {
      id: `timeline-${page}`,
      kind: 'timeline',
      page,
      scope: lang === 'en' ? 'global' : 'country',
      sourceId: 'wikipedia',
      sourceUrl: `${wikiPageUrl(lang, title)}?action=history`,
      items: revs.map((r, i) => ({ id: `rev-${page}-${i}`, title: (r.comment ?? '').replace(/\/\*.*?\*\//g, '').trim() || '—', meta: `${(r.timestamp ?? '').slice(0, 10)} · ${mask(r.user, r.anon)}`, date: r.timestamp })),
    },
    next: json?.continue?.rvcontinue,
  };
}

/* ------------------------------------------------------------------ */
/* Cursor + page                                                        */
/* ------------------------------------------------------------------ */

export interface LadderCursor {
  concepts?: string;
  sitesOffset: number;
  newsGlobal: number;
  newsCountry: number;
  derived: number;
  attentionMonths: number;
  hn: number;
  hnMore: boolean;
  timeline?: string;
  timelineDone: boolean;
  conceptsDone: boolean;
}

export const INITIAL_LADDER_CURSOR: LadderCursor = { sitesOffset: 0, newsGlobal: 0, newsCountry: 0, derived: 0, attentionMonths: 0, hn: 0, hnMore: true, timelineDone: false, conceptsDone: false };

export interface BuiltPage {
  page: StreamPage;
  cursor: LadderCursor;
}

/**
 * Build the NETWORK cards of page N (≥ 1) plus the COGS card. Cards that
 * came back empty are simply absent; a page with no network card at all is
 * `thin` (three thin pages in a row -> the component shows the retry /
 * widen card). Never throws.
 */
export async function buildStreamPage(query: string, page: number, anchor: DeeperAnchor, ctx: StreamContext, cursor: LadderCursor = INITIAL_LADDER_CURSOR): Promise<BuiltPage> {
  const next: LadderCursor = { ...cursor };
  const cards: StreamCard[] = [];
  if (page < 1 || page > STREAM_PAGE_CAP) return { page: { page, cards, thin: true, fetchedAt: Date.now() }, cursor: next };
  const recipe = streamRecipe(page);
  const wants = (k: StreamCardKind) => recipe.includes(k);
  let networkCards = 0;
  const push = (card: StreamCard | null) => {
    if (!card) return;
    cards.push(card);
    networkCards += 1;
  };
  try {
    // Sequential inside a page: Wikimedia legs are serialized anyway and
    // the page budget is two of them.
    if (wants('identity')) push(await identityLeg(anchor, ctx, page));
    if (wants('concepts') && !next.conceptsDone) {
      const r = await conceptsLeg(anchor, ctx, page, next.concepts);
      push(r.card);
      if (r.next) next.concepts = r.next;
      else next.conceptsDone = true;
    }
    if (wants('sites')) {
      const r = await sitesLeg(anchor, ctx, page, next.sitesOffset);
      push(r.card);
      next.sitesOffset = r.next ?? next.sitesOffset + 12;
    }
    if (wants('news')) {
      const global = await newsLeg(anchor, ctx, page, next.newsGlobal, 'global');
      push(global);
      if (global) next.newsGlobal += 1;
      const country = await newsLeg(anchor, ctx, page, next.newsCountry, 'country');
      push(country);
      if (country) next.newsCountry += 1;
    }
    if (wants('derived')) {
      push(await derivedLeg(anchor, ctx, page, next.derived));
      next.derived += 1;
    }
    if (wants('attention')) {
      push(await attentionLeg(anchor, ctx, page, next.attentionMonths));
      next.attentionMonths += 1;
    }
    if (wants('community') && next.hnMore) {
      const r = await communityLeg(anchor, ctx, page, next.hn);
      push(r.card);
      next.hn += 1;
      next.hnMore = r.more;
    }
    if (wants('timeline') && !next.timelineDone) {
      const r = await timelineLeg(anchor, ctx, page, next.timeline);
      push(r.card);
      if (r.next) next.timeline = r.next;
      else next.timelineDone = true;
    }
  } catch {
    // fail-open: whatever landed is the page
  }
  if (wants('cogs')) {
    const cogs = cogsCardFor(query, page, ctx.constitution);
    cards.push({ id: `cogs-${page}`, kind: 'cogs', page, scope: 'global', cogs, rare: cogs.rare });
  }
  const thin = networkCards === 0;
  return { page: { page, cards, thin, fetchedAt: Date.now() }, cursor: next };
}
