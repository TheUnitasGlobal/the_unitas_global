/**
 * Explore Deeper adapters on the Wikimedia family (SPEC §3.3 #3 valueCycle,
 * #4 omniWave, #6 hologramField, R1 fractalDim, R2 chronosGate). Every
 * page is reached by the anchor's EXACT sitelink title (never a search),
 * Wikimedia calls are serialized by deeperFetch, and every image carries
 * its own license + author (Commons imageinfo) before it is shown.
 */
import { deeperFetchJson, daysAgo, isoDate, quoted, wikiPageUrl, compactNumber } from '../deeperFetch';
import { parseWikiLinks, sitelinkTitles } from '../entityResolve';
import { EMPTY_DEEPER_PAGE, type DeeperAdapter, type DeeperCard, type DeeperContext, type DeeperImage, type DeeperItem, type DeeperPage } from '../deeperThemes';
import type { DeeperAnchor } from '../deeperAnchor';

/** The anchor's title on the visitor's wiki: the localeTitle when the
 *  anchor already speaks the visitor's language, else its sitelink. One
 *  Wikidata call, only on a language mismatch. */
async function titleOn(anchor: DeeperAnchor, lang: string, ctx: DeeperContext): Promise<string | null> {
  if (anchor.lang === lang && anchor.localeTitle) return anchor.localeTitle;
  if (lang === 'en' && anchor.enTitle) return anchor.enTitle;
  if (!anchor.qid) return anchor.lang === lang ? anchor.term : null;
  const titles = await sitelinkTitles(anchor.qid, [lang], ctx.signal ?? new AbortController().signal);
  return titles[lang] ?? null;
}

interface ActionQuery<T> {
  continue?: Record<string, string>;
  query?: T;
}

/* ------------------------------------------------------------------ */
/* #3 valueCycle -- 탈희소성 가치 순환                                    */
/* ------------------------------------------------------------------ */

const CYCLE_LIMIT = 20;

export const valueCycleAdapter: DeeperAdapter = {
  key: 'valueCycle',
  async load(anchor, ctx, cursor) {
    const title = await titleOn(anchor, ctx.lang, ctx);
    if (!title) return EMPTY_DEEPER_PAGE();
    const leg = cursor?.leg === 'out' ? 'out' : 'in';
    const cont = typeof cursor?.cont === 'string' ? cursor.cont : '';
    const pageUrl = wikiPageUrl(ctx.lang, title);
    if (leg === 'in') {
      const json = await deeperFetchJson<ActionQuery<{ pages?: Array<{ linkshere?: Array<{ title?: string; pageid?: number }> }> }>>(
        `https://${ctx.lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=linkshere&lhnamespace=0&lhshow=!redirect&lhlimit=${CYCLE_LIMIT}` +
          `${cont ? `&lhcontinue=${encodeURIComponent(cont)}` : ''}&redirects=1&format=json&formatversion=2&origin=*`,
        { signal: ctx.signal },
      );
      const links = (json?.query?.pages?.[0]?.linkshere ?? []).filter((l) => l.title);
      const items: DeeperItem[] = links.map((l) => ({ id: `in-${l.pageid ?? l.title}`, title: l.title!, url: wikiPageUrl(ctx.lang, l.title!), lang: ctx.lang }));
      const next = json?.continue?.lhcontinue ? { leg: 'in', cont: json.continue.lhcontinue } : { leg: 'out', cont: '' };
      const cards: DeeperCard[] = items.length > 0 ? [{ id: `cycle-in-${cont || 0}`, kind: 'list', scope: 'country', field: 'f1', items, sourceId: 'wikipedia', sourceUrl: pageUrl }] : [];
      return { cards, cursor: next, fetchedAt: Date.now(), sources: ['wikipedia'], empty: cards.length === 0 && !json?.continue };
    }
    const json = await deeperFetchJson<ActionQuery<{ pages?: Array<{ links?: Array<{ title?: string }> }> }>>(
      `https://${ctx.lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=links&plnamespace=0&pllimit=${CYCLE_LIMIT}` +
        `${cont ? `&plcontinue=${encodeURIComponent(cont)}` : ''}&redirects=1&format=json&formatversion=2&origin=*`,
      { signal: ctx.signal },
    );
    const parsed = parseWikiLinks(json as Parameters<typeof parseWikiLinks>[0]);
    const items: DeeperItem[] = parsed.links.map((t) => ({ id: `out-${t}`, title: t, url: wikiPageUrl(ctx.lang, t), lang: ctx.lang }));
    const cards: DeeperCard[] = items.length > 0 ? [{ id: `cycle-out-${cont || 0}`, kind: 'list', scope: 'country', field: 'f2', items, sourceId: 'wikipedia', sourceUrl: pageUrl }] : [];
    return { cards, cursor: parsed.next ? { leg: 'out', cont: parsed.next } : null, fetchedAt: Date.now(), sources: ['wikipedia'], empty: cards.length === 0 };
  },
};

/* ------------------------------------------------------------------ */
/* #4 omniWave -- 옴니웨이브 관심 파동                                     */
/* ------------------------------------------------------------------ */

interface PageviewsResponse {
  items?: Array<{ timestamp?: string; views?: number }>;
}

const WAVE_DAYS = 30;
const PAGEVIEWS_FLOOR = '2015-07-01';

function stamp(d: Date): string {
  return isoDate(d).replace(/-/g, '');
}

async function perArticle(lang: string, title: string, end: Date, ctx: DeeperContext): Promise<{ dates: string[]; points: number[] }> {
  const start = daysAgo(WAVE_DAYS - 1, end.getTime());
  const json = await deeperFetchJson<PageviewsResponse>(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, '_'))}/daily/${stamp(start)}/${stamp(end)}`,
    { signal: ctx.signal },
  );
  const items = (json?.items ?? []).filter((i) => typeof i.views === 'number' && i.timestamp);
  return {
    dates: items.map((i) => `${i.timestamp!.slice(0, 4)}-${i.timestamp!.slice(4, 6)}-${i.timestamp!.slice(6, 8)}`),
    points: items.map((i) => i.views as number),
  };
}

function trendPct(points: number[]): number | null {
  if (points.length < 8) return null;
  const half = Math.floor(points.length / 2);
  const a = points.slice(0, half).reduce((s, n) => s + n, 0) / half;
  const b = points.slice(half).reduce((s, n) => s + n, 0) / (points.length - half);
  return a > 0 ? Math.round(((b - a) / a) * 100) : null;
}

export const omniWaveAdapter: DeeperAdapter = {
  key: 'omniWave',
  async load(anchor, ctx, cursor) {
    const end = typeof cursor?.end === 'string' ? new Date(cursor.end) : daysAgo(1);
    if (isoDate(end) < PAGEVIEWS_FLOOR) return EMPTY_DEEPER_PAGE(['wikimediaPageviews']);
    const enTitle = await titleOn(anchor, 'en', ctx);
    const ownTitle = ctx.lang === 'en' ? null : await titleOn(anchor, ctx.lang, ctx);
    const cards: DeeperCard[] = [];
    if (enTitle) {
      const g = await perArticle('en', enTitle, end, ctx);
      if (g.points.length > 0) {
        const total = g.points.reduce((s, n) => s + n, 0);
        const peak = g.points.indexOf(Math.max(...g.points));
        const trend = trendPct(g.points);
        cards.push({
          id: `wave-en-${isoDate(end)}`,
          kind: 'spark',
          scope: 'global',
          field: 'f4',
          series: { label: 'f1', points: g.points, dates: g.dates },
          facts: [
            { label: 'f1', value: compactNumber(total, ctx.locale), emphasis: true },
            ...(trend !== null ? [{ label: 'f2', value: `${trend > 0 ? '+' : ''}${trend}%` }] : []),
            ...(peak >= 0 ? [{ label: 'f3', value: g.dates[peak] }] : []),
          ],
          sourceId: 'wikimediaPageviews',
          sourceUrl: `https://pageviews.wmcloud.org/?project=en.wikipedia.org&pages=${encodeURIComponent(enTitle)}`,
        });
      }
    }
    if (ownTitle) {
      const o = await perArticle(ctx.lang, ownTitle, end, ctx);
      if (o.points.length > 0) {
        const total = o.points.reduce((s, n) => s + n, 0);
        const trend = trendPct(o.points);
        cards.push({
          id: `wave-${ctx.lang}-${isoDate(end)}`,
          kind: 'spark',
          scope: 'country',
          field: 'f5',
          series: { label: 'f1', points: o.points, dates: o.dates },
          facts: [{ label: 'f1', value: compactNumber(total, ctx.locale), emphasis: true }, ...(trend !== null ? [{ label: 'f2', value: `${trend > 0 ? '+' : ''}${trend}%` }] : [])],
          sourceId: 'wikimediaPageviews',
          sourceUrl: `https://pageviews.wmcloud.org/?project=${ctx.lang}.wikipedia.org&pages=${encodeURIComponent(ownTitle)}`,
        });
      }
    }
    const nextEnd = daysAgo(WAVE_DAYS, end.getTime());
    return { cards, cursor: isoDate(nextEnd) >= PAGEVIEWS_FLOOR ? { end: isoDate(nextEnd) } : null, fetchedAt: Date.now(), sources: ['wikimediaPageviews'], empty: cards.length === 0 };
  },
};

/* ------------------------------------------------------------------ */
/* #6 hologramField -- 초실감 홀로그램 시각장                              */
/* ------------------------------------------------------------------ */

interface ImageInfo {
  url?: string;
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  width?: number;
  height?: number;
  descriptionurl?: string;
  extmetadata?: Record<string, { value?: string }>;
}
interface ImageInfoResponse {
  query?: { pages?: Array<{ title?: string; imageinfo?: ImageInfo[] }> };
}
interface MediaListResponse {
  items?: Array<{ title?: string; type?: string; showInGallery?: boolean }>;
}
interface CommonsSearchResponse {
  continue?: { gsroffset?: number };
  query?: { pages?: Array<{ title?: string; index?: number }> };
}

function plain(html: string | undefined): string | undefined {
  const t = (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return t || undefined;
}

/** Commons imageinfo for up to 8 files -- the license + author pairing
 *  every image needs before display (media-list has no license field). */
async function imageInfo(files: string[], ctx: DeeperContext): Promise<DeeperImage[]> {
  const titles = files.slice(0, 8).map((f) => (f.startsWith('File:') ? f : `File:${f}`));
  if (titles.length === 0) return [];
  const json = await deeperFetchJson<ImageInfoResponse>(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles.join('|'))}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=640&iiextmetadatafilter=LicenseShortName|Artist|ImageDescription&format=json&formatversion=2&origin=*`,
    { signal: ctx.signal },
  );
  return (json?.query?.pages ?? [])
    .map((p) => {
      const ii = p.imageinfo?.[0];
      if (!ii?.thumburl && !ii?.url) return null;
      const meta = ii.extmetadata ?? {};
      return {
        src: ii.thumburl ?? ii.url!,
        alt: plain(meta.ImageDescription?.value) ?? (p.title ?? '').replace(/^File:/, ''),
        width: ii.thumbwidth ?? ii.width,
        height: ii.thumbheight ?? ii.height,
        license: plain(meta.LicenseShortName?.value),
        author: plain(meta.Artist?.value),
        pageUrl: ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title ?? '')}`,
      } as DeeperImage;
    })
    .filter((i): i is DeeperImage => i !== null);
}

export const hologramFieldAdapter: DeeperAdapter = {
  key: 'hologramField',
  async load(anchor, ctx, cursor) {
    const stage = cursor?.stage === 'search' ? 'search' : 'article';
    const offset = typeof cursor?.offset === 'number' ? cursor.offset : 0;
    const cards: DeeperCard[] = [];
    if (stage === 'article') {
      // p1: the article's own media, in article order (REST media-list) --
      // the visitor's language edition first, English as the fallback.
      const title = (await titleOn(anchor, ctx.lang, ctx)) ?? (await titleOn(anchor, 'en', ctx));
      const lang = title && title === anchor.enTitle && ctx.lang !== 'en' ? 'en' : ctx.lang;
      if (title) {
        const list = await deeperFetchJson<MediaListResponse>(`https://${lang}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title.replace(/ /g, '_'))}`, { signal: ctx.signal });
        const files = (list?.items ?? []).filter((i) => i.type === 'image' && i.title && i.showInGallery !== false).map((i) => i.title!);
        const images = await imageInfo(files.slice(offset, offset + 6), ctx);
        images.forEach((img, i) => cards.push({ id: `holo-${lang}-${offset + i}`, kind: 'image', scope: lang === 'en' ? 'global' : 'country', field: 'f1', image: img, sourceId: 'wikimediaCommons', sourceUrl: img.pageUrl }));
        const more = offset + 6 < files.length;
        return { cards, cursor: more ? { stage: 'article', offset: offset + 6 } : { stage: 'search', offset: 0 }, fetchedAt: Date.now(), sources: ['wikipedia', 'wikimediaCommons'], empty: cards.length === 0 && !more };
      }
      return { cards, cursor: { stage: 'search', offset: 0 }, fetchedAt: Date.now(), sources: ['wikipedia'], empty: true };
    }
    // p2+: Commons full-text search on the exact English phrase (ns=6).
    if (!anchor.enTitle) return EMPTY_DEEPER_PAGE(['wikimediaCommons']);
    const json = await deeperFetchJson<CommonsSearchResponse>(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(quoted(anchor.enTitle))}&gsrnamespace=6&gsrlimit=6&gsroffset=${offset}&format=json&formatversion=2&origin=*`,
      { signal: ctx.signal },
    );
    const files = (json?.query?.pages ?? [])
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((p) => p.title)
      .filter((t): t is string => Boolean(t));
    const images = await imageInfo(files, ctx);
    images.forEach((img, i) => cards.push({ id: `holo-search-${offset + i}`, kind: 'image', scope: 'global', field: 'f5', image: img, sourceId: 'wikimediaCommons', sourceUrl: img.pageUrl }));
    const next = typeof json?.continue?.gsroffset === 'number' ? { stage: 'search', offset: json.continue.gsroffset } : null;
    return { cards, cursor: next, fetchedAt: Date.now(), sources: ['wikimediaCommons'], empty: cards.length === 0 };
  },
};

/* ------------------------------------------------------------------ */
/* R1 fractalDim -- 다차원 프랙탈                                          */
/* ------------------------------------------------------------------ */

interface CategoriesResponse {
  query?: { pages?: Array<{ categories?: Array<{ title?: string }> }> };
}
interface MembersResponse {
  continue?: { cmcontinue?: string };
  query?: { categorymembers?: Array<{ title?: string; pageid?: number }> };
}
interface MoreLikeResponse {
  query?: { search?: Array<{ title?: string; pageid?: number }> };
}

export const fractalDimAdapter: DeeperAdapter = {
  key: 'fractalDim',
  async load(anchor, ctx, cursor) {
    const title = await titleOn(anchor, ctx.lang, ctx);
    if (!title) return EMPTY_DEEPER_PAGE();
    const catIndex = typeof cursor?.catIndex === 'number' ? cursor.catIndex : 0;
    const cmcontinue = typeof cursor?.cmcontinue === 'string' ? cursor.cmcontinue : '';
    const pageUrl = wikiPageUrl(ctx.lang, title);
    const cats = await deeperFetchJson<CategoriesResponse>(
      `https://${ctx.lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=categories&clshow=!hidden&cllimit=12&redirects=1&format=json&formatversion=2&origin=*`,
      { signal: ctx.signal },
    );
    const categories = (cats?.query?.pages?.[0]?.categories ?? []).map((c) => c.title).filter((t): t is string => Boolean(t));
    const cards: DeeperCard[] = [];
    if (categories.length === 0) {
      // No categories: the wiki's own "more like this" ranking on the exact title.
      const like = await deeperFetchJson<MoreLikeResponse>(
        `https://${ctx.lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`morelike:${title}`)}&srlimit=12&srnamespace=0&format=json&formatversion=2&origin=*`,
        { signal: ctx.signal },
      );
      const items = (like?.query?.search ?? []).filter((s) => s.title).map((s) => ({ id: `like-${s.pageid ?? s.title}`, title: s.title!, url: wikiPageUrl(ctx.lang, s.title!), lang: ctx.lang }));
      if (items.length > 0) cards.push({ id: 'fractal-like', kind: 'list', scope: 'country', field: 'f3', items, sourceId: 'wikipedia', sourceUrl: pageUrl });
      return { cards, cursor: null, fetchedAt: Date.now(), sources: ['wikipedia'], empty: cards.length === 0 };
    }
    if (catIndex === 0 && !cmcontinue) {
      cards.push({
        id: 'fractal-cats',
        kind: 'chips',
        scope: 'country',
        field: 'f1',
        items: categories.map((c) => ({ id: c, title: c.replace(/^[^:]+:/, ''), url: wikiPageUrl(ctx.lang, c), lang: ctx.lang })),
        sourceId: 'wikipedia',
        sourceUrl: pageUrl,
      });
    }
    const cat = categories[Math.min(catIndex, categories.length - 1)];
    const members = await deeperFetchJson<MembersResponse>(
      `https://${ctx.lang}.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(cat)}&cmnamespace=0&cmlimit=12${cmcontinue ? `&cmcontinue=${encodeURIComponent(cmcontinue)}` : ''}&format=json&formatversion=2&origin=*`,
      { signal: ctx.signal },
    );
    const siblings = (members?.query?.categorymembers ?? []).filter((m) => m.title && m.title !== title);
    if (siblings.length > 0) {
      cards.push({
        id: `fractal-${catIndex}-${cmcontinue || 0}`,
        kind: 'list',
        scope: 'country',
        field: 'f2',
        text: cat.replace(/^[^:]+:/, ''),
        items: siblings.map((m) => ({ id: `sib-${m.pageid ?? m.title}`, title: m.title!, url: wikiPageUrl(ctx.lang, m.title!), lang: ctx.lang })),
        sourceId: 'wikipedia',
        sourceUrl: wikiPageUrl(ctx.lang, cat),
      });
    }
    const next = members?.continue?.cmcontinue ? { catIndex, cmcontinue: members.continue.cmcontinue } : catIndex + 1 < categories.length ? { catIndex: catIndex + 1, cmcontinue: '' } : null;
    return { cards, cursor: next, fetchedAt: Date.now(), sources: ['wikipedia'], empty: cards.length === 0 && next === null };
  },
};

/* ------------------------------------------------------------------ */
/* R2 chronosGate -- 크로노스 게이트                                       */
/* ------------------------------------------------------------------ */

interface Revision {
  timestamp?: string;
  user?: string;
  size?: number;
  comment?: string;
  anon?: boolean;
  temp?: boolean;
}
interface RevisionsResponse {
  continue?: { rvcontinue?: string };
  query?: { pages?: Array<{ revisions?: Revision[] }> };
}

/** IP and temporary accounts are masked (SPEC §3.3 R2). */
function maskUser(r: Revision): string {
  if (!r.user) return '—';
  if (r.anon || r.temp || /^~/.test(r.user) || /^\d{1,3}(\.\d{1,3}){3}$/.test(r.user) || /:/.test(r.user)) return '·····';
  return r.user;
}

function isBot(r: Revision): boolean {
  return /bot$/i.test(r.user ?? '');
}

export const chronosGateAdapter: DeeperAdapter = {
  key: 'chronosGate',
  async load(anchor, ctx, cursor) {
    const lang = typeof cursor?.lang === 'string' ? cursor.lang : ctx.lang;
    const title = await titleOn(anchor, lang, ctx);
    if (!title) return EMPTY_DEEPER_PAGE();
    const rvcontinue = typeof cursor?.rvcontinue === 'string' ? cursor.rvcontinue : '';
    const pageUrl = wikiPageUrl(lang, title);
    const base = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=revisions&rvprop=timestamp|user|size|comment|flags&rvslots=main&redirects=1&format=json&formatversion=2&origin=*`;
    const cards: DeeperCard[] = [];
    if (!rvcontinue) {
      const first = await deeperFetchJson<RevisionsResponse>(`${base}&rvlimit=1&rvdir=newer`, { signal: ctx.signal });
      const r0 = first?.query?.pages?.[0]?.revisions?.[0];
      const latest = await deeperFetchJson<RevisionsResponse>(`${base}&rvlimit=20`, { signal: ctx.signal });
      const revs = latest?.query?.pages?.[0]?.revisions ?? [];
      if (r0?.timestamp || revs.length > 0) {
        const span = revs.length > 1 ? (Date.parse(revs[0].timestamp ?? '') - Date.parse(revs[revs.length - 1].timestamp ?? '')) / 86_400_000 : 0;
        const perWeek = span > 0 ? (revs.length / span) * 7 : revs.length;
        const bots = revs.filter(isBot).length;
        const growth = r0?.size && revs[0]?.size ? revs[0].size / r0.size : null;
        cards.push({
          id: `chronos-head-${lang}`,
          kind: 'facts',
          scope: lang === 'en' ? 'global' : 'country',
          field: 'f1',
          facts: [
            ...(r0?.timestamp ? [{ label: 'f1', value: r0.timestamp.slice(0, 10), emphasis: true }, { label: 'f2', value: maskUser(r0) }] : []),
            { label: 'f4', value: perWeek.toFixed(1), unit: '/w' },
            { label: 'f5', value: revs.length > 0 ? `${Math.round((bots / revs.length) * 100)}%` : '—' },
            ...(growth ? [{ label: 'f6', value: `×${growth.toFixed(1)}` }] : []),
          ],
          sourceId: 'wikipedia',
          sourceUrl: `${pageUrl}?action=history`,
        });
        if (revs.length > 0) {
          cards.push({
            id: `chronos-recent-${lang}`,
            kind: 'list',
            scope: lang === 'en' ? 'global' : 'country',
            field: 'f3',
            items: revs.map((r, i) => ({ id: `rev-${lang}-${i}`, title: (r.comment ?? '').replace(/\/\*.*?\*\//g, '').trim() || '—', meta: `${(r.timestamp ?? '').slice(0, 10)} · ${maskUser(r)}${isBot(r) ? ' 🤖' : ''}`, date: r.timestamp })),
            sourceId: 'wikipedia',
            sourceUrl: `${pageUrl}?action=history`,
          });
        }
      }
      const next = latest?.continue?.rvcontinue ? { lang, rvcontinue: latest.continue.rvcontinue } : lang !== 'en' && anchor.enTitle ? { lang: 'en', rvcontinue: '' } : null;
      return { cards, cursor: next, fetchedAt: Date.now(), sources: ['wikipedia'], empty: cards.length === 0 };
    }
    const more = await deeperFetchJson<RevisionsResponse>(`${base}&rvlimit=20&rvcontinue=${encodeURIComponent(rvcontinue)}`, { signal: ctx.signal });
    const revs = more?.query?.pages?.[0]?.revisions ?? [];
    if (revs.length > 0) {
      cards.push({
        id: `chronos-${lang}-${rvcontinue}`,
        kind: 'list',
        scope: lang === 'en' ? 'global' : 'country',
        field: 'f3',
        items: revs.map((r, i) => ({ id: `rev-${lang}-${rvcontinue}-${i}`, title: (r.comment ?? '').replace(/\/\*.*?\*\//g, '').trim() || '—', meta: `${(r.timestamp ?? '').slice(0, 10)} · ${maskUser(r)}${isBot(r) ? ' 🤖' : ''}`, date: r.timestamp })),
        sourceId: 'wikipedia',
        sourceUrl: `${pageUrl}?action=history`,
      });
    }
    const next = more?.continue?.rvcontinue ? { lang, rvcontinue: more.continue.rvcontinue } : lang !== 'en' && anchor.enTitle ? { lang: 'en', rvcontinue: '' } : null;
    return { cards, cursor: next, fetchedAt: Date.now(), sources: ['wikipedia'], empty: cards.length === 0 };
  },
};

export type { DeeperPage as WikipediaDeeperPage };
