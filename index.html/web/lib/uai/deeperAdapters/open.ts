/**
 * Explore Deeper adapters on the open scholarly / community / earth data
 * sources (SPEC §3.3 #7 evolutionArc, #8 ventureSignal, #10 timeFlux and
 * the two omni-tech themes of §12.5: #13 omniPress, #14 terraPulse).
 * Text-search legs (Hacker News, Crossref) are fed the exact English
 * phrase only; the news wires go through our own route so the RSS feeds
 * (no CORS) are read server-side, headlines only.
 */
import { compactNumber, daysAgo, deeperFetchJson, isoDate, median, quoted, wordCount } from '../deeperFetch';
import { EMPTY_DEEPER_PAGE, type DeeperAdapter, type DeeperCard, type DeeperContext, type DeeperItem, type DeeperPage } from '../deeperThemes';
import type { SourceId } from '../sourceRegistry';

/* ------------------------------------------------------------------ */
/* #7 evolutionArc -- 진화 가속 학술 궤적                                  */
/* ------------------------------------------------------------------ */

interface OpenAlexConcept {
  id?: string;
  display_name?: string;
  wikidata?: string;
  works_count?: number;
}
interface OpenAlexGroup {
  key?: string;
  count?: number;
}
interface OpenAlexWork {
  id?: string;
  display_name?: string;
  publication_year?: number;
  cited_by_count?: number;
  open_access?: { is_oa?: boolean };
  authorships?: Array<{ author?: { display_name?: string } }>;
  doi?: string;
  primary_location?: { landing_page_url?: string };
}
interface OpenAlexList<T> {
  results?: T[];
  group_by?: OpenAlexGroup[];
  meta?: { count?: number; next_cursor?: string | null };
}
interface CrossrefResponse {
  message?: { items?: Array<{ title?: string[]; DOI?: string; 'is-referenced-by-count'?: number; issued?: { 'date-parts'?: number[][] }; URL?: string }> };
}

const ARC_PER_PAGE = 6;

export const evolutionArcAdapter: DeeperAdapter = {
  key: 'evolutionArc',
  async load(anchor, ctx, cursor) {
    if (!anchor.qid || !anchor.enTitle) return EMPTY_DEEPER_PAGE();
    let conceptId = typeof cursor?.conceptId === 'string' ? cursor.conceptId : '';
    const sort = cursor?.sort === 'recent' ? 'recent' : 'cited';
    const page = typeof cursor?.page === 'number' ? cursor.page : 0;
    const next = typeof cursor?.next === 'string' ? cursor.next : '*';
    const cards: DeeperCard[] = [];
    const sources: SourceId[] = ['openAlex'];
    if (!conceptId) {
      const concepts = await deeperFetchJson<OpenAlexList<OpenAlexConcept>>(
        `https://api.openalex.org/concepts?search=${encodeURIComponent(anchor.enTitle)}&per-page=10&select=id,display_name,wikidata,works_count`,
        { signal: ctx.signal },
      );
      const hit = (concepts?.results ?? []).find((c) => (c.wikidata ?? '').endsWith(`/${anchor.qid}`));
      if (!hit?.id) return EMPTY_DEEPER_PAGE(['openAlex']);
      conceptId = hit.id.replace(/^https?:\/\/openalex\.org\//, '');
      const hist = await deeperFetchJson<OpenAlexList<OpenAlexWork>>(`https://api.openalex.org/works?filter=concepts.id:${conceptId}&group_by=publication_year&per-page=1`, { signal: ctx.signal });
      const year = new Date().getUTCFullYear();
      const groups = (hist?.group_by ?? [])
        .map((g) => ({ y: Number(g.key), n: g.count ?? 0 }))
        .filter((g) => Number.isFinite(g.y) && g.y >= 1950 && g.y <= year + 1)
        .sort((a, b) => a.y - b.y);
      if (groups.length > 0) {
        const peak = groups.reduce((m, g) => (g.n > m.n ? g : m), groups[0]);
        cards.push({
          id: 'arc-hist',
          kind: 'spark',
          scope: 'global',
          field: 'f1',
          series: { label: 'f1', points: groups.map((g) => g.n), dates: groups.map((g) => String(g.y)) },
          facts: [
            { label: 'f4', value: compactNumber(hit.works_count ?? groups.reduce((s, g) => s + g.n, 0), ctx.locale), emphasis: true },
            { label: 'f5', value: String(peak.y) },
          ],
          sourceId: 'openAlex',
          sourceUrl: `https://openalex.org/${conceptId}`,
        });
      }
    }
    const url =
      sort === 'cited'
        ? `https://api.openalex.org/works?filter=concepts.id:${conceptId}&sort=cited_by_count:desc&per-page=${ARC_PER_PAGE}&page=${page + 1}&select=id,display_name,publication_year,cited_by_count,open_access,authorships,doi,primary_location`
        : `https://api.openalex.org/works?filter=concepts.id:${conceptId}&sort=publication_date:desc&per-page=${ARC_PER_PAGE}&cursor=${encodeURIComponent(next)}&select=id,display_name,publication_year,cited_by_count,open_access,authorships,doi,primary_location`;
    const works = await deeperFetchJson<OpenAlexList<OpenAlexWork>>(url, { signal: ctx.signal });
    const list = (works?.results ?? []).filter((w) => w.display_name);
    if (list.length > 0) {
      const oa = list.filter((w) => w.open_access?.is_oa).length;
      cards.push({
        id: `arc-${sort}-${page}-${next}`,
        kind: 'list',
        scope: 'global',
        field: sort === 'cited' ? 'f2' : 'f3',
        items: list.map((w) => ({
          id: w.id ?? w.display_name!,
          title: w.display_name!,
          meta: [w.authorships?.[0]?.author?.display_name, w.publication_year, w.cited_by_count ? `${compactNumber(w.cited_by_count, ctx.locale)} cit.` : undefined].filter(Boolean).join(' · '),
          url: w.doi ?? w.primary_location?.landing_page_url ?? (w.id ? w.id : undefined),
        })),
        facts: [{ label: 'f6', value: `${Math.round((oa / list.length) * 100)}%` }],
        sourceId: 'openAlex',
        sourceUrl: `https://openalex.org/${conceptId}`,
      });
    }
    // Secondary leg (first page only): Crossref's most-referenced works on
    // the exact phrase -- 1 req/s public pool, so never more than one call.
    if (page === 0 && sort === 'cited') {
      const cr = await deeperFetchJson<CrossrefResponse>(
        `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(quoted(anchor.enTitle))}&rows=5&sort=is-referenced-by-count&order=desc&select=title,DOI,is-referenced-by-count,issued,URL`,
        { signal: ctx.signal },
      );
      const items: DeeperItem[] = (cr?.message?.items ?? [])
        .filter((it) => it.title?.[0])
        .map((it) => ({
          id: it.DOI ?? it.title![0],
          title: it.title![0],
          meta: [it.issued?.['date-parts']?.[0]?.[0], it['is-referenced-by-count'] ? `${it['is-referenced-by-count']} ref.` : undefined].filter(Boolean).join(' · '),
          url: it.URL ?? (it.DOI ? `https://doi.org/${it.DOI}` : undefined),
        }));
      if (items.length > 0) {
        sources.push('crossref');
        cards.push({ id: 'arc-crossref', kind: 'list', scope: 'global', field: 'f2', items, sourceId: 'crossref', sourceUrl: `https://search.crossref.org/?q=${encodeURIComponent(anchor.enTitle)}` });
      }
    }
    let nextCursor: DeeperPage['cursor'] = null;
    if (sort === 'cited') nextCursor = page + 1 < 4 && list.length === ARC_PER_PAGE ? { conceptId, sort: 'cited', page: page + 1 } : { conceptId, sort: 'recent', next: '*' };
    else if (works?.meta?.next_cursor && list.length > 0) nextCursor = { conceptId, sort: 'recent', next: works.meta.next_cursor };
    return { cards, cursor: nextCursor, fetchedAt: Date.now(), sources, empty: cards.length === 0 };
  },
};

/* ------------------------------------------------------------------ */
/* #8 ventureSignal -- 실시간 사업 발굴                                     */
/* ------------------------------------------------------------------ */

interface HnHit {
  objectID: string;
  title?: string;
  url?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
}
interface HnResponse {
  hits?: HnHit[];
  nbPages?: number;
  page?: number;
}

function hnItems(hits: HnHit[], prefix: string): DeeperItem[] {
  return hits
    .filter((h) => h.title)
    .map((h) => ({
      id: `${prefix}-${h.objectID}`,
      title: h.title!,
      meta: `${h.points ?? 0} pt · ${h.num_comments ?? 0} 💬 · ${(h.created_at ?? '').slice(0, 10)}`,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      date: h.created_at,
    }));
}

export const ventureSignalAdapter: DeeperAdapter = {
  key: 'ventureSignal',
  async load(anchor, ctx, cursor) {
    if (!anchor.enTitle) return EMPTY_DEEPER_PAGE();
    const leg = cursor?.leg === 'discuss' ? 'discuss' : 'launch';
    const page = typeof cursor?.page === 'number' ? cursor.page : 0;
    const q = encodeURIComponent(quoted(anchor.enTitle));
    const url =
      leg === 'launch'
        ? `https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=show_hn&hitsPerPage=8&page=${page}`
        : `https://hn.algolia.com/api/v1/search?query=${q}&tags=story&numericFilters=points%3E50&hitsPerPage=8&page=${page}`;
    const json = await deeperFetchJson<HnResponse>(url, { signal: ctx.signal });
    const hits = json?.hits ?? [];
    const cards: DeeperCard[] = [];
    if (page === 0 && leg === 'launch') {
      // The blue-ocean index needs both legs' totals: one extra call, once.
      const discuss = await deeperFetchJson<HnResponse>(`https://hn.algolia.com/api/v1/search?query=${q}&tags=story&numericFilters=points%3E50&hitsPerPage=1`, { signal: ctx.signal });
      const launches = hits.length;
      const discussions = (discuss?.nbPages ?? 0) > 0 ? Math.max(1, (discuss?.nbPages ?? 0) * 1) : 0;
      cards.push({
        id: 'venture-index',
        kind: 'facts',
        scope: 'global',
        field: 'f3',
        facts: [
          { label: 'f3', value: discussions > 0 ? (launches / Math.max(1, discussions)).toFixed(2) : launches > 0 ? '∞' : '0', emphasis: true },
          { label: 'f1', value: String(launches) },
          { label: 'f2', value: String(discuss?.hits?.length ? `${discussions}+` : 0) },
        ],
        sourceId: 'hackerNews',
        sourceUrl: `https://hn.algolia.com/?q=${q}`,
      });
    }
    const items = hnItems(hits, leg);
    if (items.length > 0) cards.push({ id: `venture-${leg}-${page}`, kind: 'list', scope: 'global', field: leg === 'launch' ? 'f1' : 'f2', items, sourceId: 'hackerNews', sourceUrl: `https://hn.algolia.com/?q=${q}` });
    const nbPages = json?.nbPages ?? 0;
    const next = page + 1 < nbPages ? { leg, page: page + 1 } : leg === 'launch' ? { leg: 'discuss', page: 0 } : null;
    return { cards, cursor: next, fetchedAt: Date.now(), sources: ['hackerNews'], empty: cards.length === 0 && next === null };
  },
};

/* ------------------------------------------------------------------ */
/* #13 omniPress -- 옴니 프레스 (Google 뉴스 + Bing 뉴스, 서버 레그)         */
/* ------------------------------------------------------------------ */

export interface EntityNewsItem {
  id: string;
  title: string;
  url: string;
  domain?: string;
  publishedAt?: string;
  lang?: string;
  wire: 'gnews' | 'bing';
}
export interface EntityNewsResponse {
  ok: boolean;
  leg: 'global' | 'country';
  page: number;
  items: EntityNewsItem[];
  hasMore: boolean;
  fetchedAt: number;
}

export function entityNewsUrl(params: { qid?: string; enTitle?: string; localeTitle?: string; locale: string; country: string; leg: 'global' | 'country'; page: number }): string {
  const q = new URLSearchParams({ locale: params.locale, country: params.country, leg: params.leg, page: String(params.page) });
  if (params.qid) q.set('qid', params.qid);
  if (params.enTitle) q.set('enTitle', params.enTitle);
  if (params.localeTitle) q.set('localeTitle', params.localeTitle);
  return `/api/live/entity-news?${q.toString()}`;
}

export const omniPressAdapter: DeeperAdapter = {
  key: 'omniPress',
  async load(anchor, ctx, cursor) {
    if (!anchor.enTitle && !anchor.localeTitle) return EMPTY_DEEPER_PAGE();
    const leg = cursor?.leg === 'country' ? 'country' : 'global';
    const page = typeof cursor?.page === 'number' ? cursor.page : 0;
    const json = await deeperFetchJson<EntityNewsResponse>(
      entityNewsUrl({ qid: anchor.qid, enTitle: anchor.enTitle, localeTitle: anchor.localeTitle ?? anchor.term, locale: ctx.locale, country: ctx.country, leg, page }),
      { signal: ctx.signal, timeoutMs: 12_000 },
    );
    const items = json?.items ?? [];
    const cards: DeeperCard[] = [];
    const sources: SourceId[] = [];
    for (const wire of ['gnews', 'bing'] as const) {
      const rows = items.filter((it) => it.wire === wire);
      if (rows.length === 0) continue;
      const sourceId: SourceId = wire === 'gnews' ? 'googleNews' : 'bingNews';
      sources.push(sourceId);
      cards.push({
        id: `press-${leg}-${wire}-${page}`,
        kind: 'list',
        scope: leg,
        field: leg === 'global' ? 'f1' : 'f2',
        items: rows.map((it) => ({ id: it.id, title: it.title, meta: [it.domain, (it.publishedAt ?? '').slice(0, 10)].filter(Boolean).join(' · '), url: it.url, date: it.publishedAt, sourceId })),
        sourceId,
        sourceUrl: wire === 'gnews' ? `https://news.google.com/search?q=${encodeURIComponent(anchor.enTitle ?? anchor.term)}` : `https://www.bing.com/news/search?q=${encodeURIComponent(anchor.enTitle ?? anchor.term)}`,
      });
    }
    const next = json?.hasMore ? { leg, page: page + 1 } : leg === 'global' ? { leg: 'country', page: 0 } : null;
    return { cards, cursor: next, fetchedAt: Date.now(), sources, empty: cards.length === 0 && next === null };
  },
};

/* ------------------------------------------------------------------ */
/* #10 timeFlux -- 타임플럭스 시공간 기후                                   */
/* ------------------------------------------------------------------ */

interface MeteoDaily {
  daily?: { time?: string[]; temperature_2m_max?: Array<number | null>; temperature_2m_min?: Array<number | null>; precipitation_sum?: Array<number | null> };
}
interface ClimateDaily {
  daily?: Record<string, Array<number | null> | string[] | undefined>;
}

const PAST_STEPS = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80];
const FUTURE_YEARS = [2030, 2040, 2050];
const CLIMATE_MODELS = ['CMCC_CM2_VHR4', 'FGOALS_f3_H', 'HiRAM_SIT_HR', 'MRI_AGCM3_2_S', 'EC_Earth3P_HR', 'MPI_ESM1_2_XR', 'NICAM16_8S'];

function sameDay(year: number, now = new Date()): string {
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(Math.min(now.getUTCDate(), 28)).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export const timeFluxAdapter: DeeperAdapter = {
  key: 'timeFlux',
  async load(anchor, ctx, cursor) {
    if (!anchor.coord) return EMPTY_DEEPER_PAGE();
    const { lat, lon } = anchor.coord;
    const mode = cursor?.mode === 'future' ? 'future' : 'past';
    const step = typeof cursor?.step === 'number' ? cursor.step : 0;
    const nowYear = new Date().getUTCFullYear();
    const cards: DeeperCard[] = [];
    if (mode === 'past') {
      const years = PAST_STEPS[step];
      if (years === undefined) return { cards, cursor: { mode: 'future', step: 0 }, fetchedAt: Date.now(), sources: ['openMeteo'] };
      const day = sameDay(nowYear - years);
      const json = await deeperFetchJson<MeteoDaily>(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${day}&end_date=${day}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`,
        { signal: ctx.signal },
      );
      const max = json?.daily?.temperature_2m_max?.[0];
      const min = json?.daily?.temperature_2m_min?.[0];
      const rain = json?.daily?.precipitation_sum?.[0];
      if (typeof max === 'number' && typeof min === 'number') {
        cards.push({
          id: `flux-past-${years}`,
          kind: 'facts',
          scope: 'country',
          field: 'f1',
          text: day,
          facts: [
            { label: 'f2', value: `${Math.round(max)}° / ${Math.round(min)}°`, emphasis: true },
            ...(typeof rain === 'number' ? [{ label: 'f3', value: `${rain.toFixed(1)} mm` }] : []),
          ],
          sourceId: 'openMeteo',
          sourceUrl: 'https://open-meteo.com/en/docs/historical-weather-api',
        });
      }
      const next = step + 1 < PAST_STEPS.length && nowYear - PAST_STEPS[step + 1] >= 1940 ? { mode: 'past', step: step + 1 } : { mode: 'future', step: 0 };
      return { cards, cursor: next, fetchedAt: Date.now(), sources: ['openMeteo'], empty: cards.length === 0 && false };
    }
    const year = FUTURE_YEARS[step];
    if (year === undefined) return { cards, cursor: null, fetchedAt: Date.now(), sources: ['openMeteo'], empty: true };
    const day = sameDay(year);
    const json = await deeperFetchJson<ClimateDaily>(
      `https://climate-api.open-meteo.com/v1/climate?latitude=${lat}&longitude=${lon}&start_date=${day}&end_date=${day}&models=${CLIMATE_MODELS.join(',')}&daily=temperature_2m_max,temperature_2m_min`,
      { signal: ctx.signal, timeoutMs: 12_000 },
    );
    const daily = json?.daily ?? {};
    const pick = (prefix: string) =>
      Object.entries(daily)
        .filter(([k, v]) => k.startsWith(prefix) && Array.isArray(v))
        .map(([, v]) => (v as Array<number | null>)[0])
        .filter((n): n is number => typeof n === 'number');
    const maxMed = median(pick('temperature_2m_max'));
    const minMed = median(pick('temperature_2m_min'));
    if (maxMed !== null && minMed !== null) {
      cards.push({
        id: `flux-future-${year}`,
        kind: 'facts',
        scope: 'country',
        field: 'f4',
        text: day,
        facts: [
          { label: 'f2', value: `${Math.round(maxMed)}° / ${Math.round(minMed)}°`, emphasis: true },
          { label: 'f6', value: String(pick('temperature_2m_max').length) },
        ],
        sourceId: 'openMeteo',
        sourceUrl: 'https://open-meteo.com/en/docs/climate-api',
      });
    }
    return { cards, cursor: step + 1 < FUTURE_YEARS.length ? { mode: 'future', step: step + 1 } : null, fetchedAt: Date.now(), sources: ['openMeteo'], empty: cards.length === 0 };
  },
};

/* ------------------------------------------------------------------ */
/* #14 terraPulse -- 테라 펄스                                             */
/* ------------------------------------------------------------------ */

interface EonetResponse {
  events?: Array<{ id?: string; title?: string; link?: string; categories?: Array<{ title?: string }>; geometry?: Array<{ date?: string; coordinates?: unknown }> }>;
}
interface UsgsResponse {
  features?: Array<{ id?: string; properties?: { mag?: number; place?: string; time?: number; url?: string } }>;
}
interface FloodResponse {
  daily?: { time?: string[]; river_discharge?: Array<number | null> };
}
interface MarineResponse {
  daily?: { time?: string[]; wave_height_max?: Array<number | null> };
}
interface NwsResponse {
  features?: Array<{ id?: string; properties?: { headline?: string; event?: string; severity?: string; effective?: string; web?: string } }>;
}

const EONET_BOX_DEG = 3;
const USGS_RADIUS_KM = 800;
const PULSE_LEGS = ['events', 'quakes', 'water', 'alerts'] as const;

export const terraPulseAdapter: DeeperAdapter = {
  key: 'terraPulse',
  async load(anchor, ctx, cursor) {
    if (!anchor.coord) return EMPTY_DEEPER_PAGE();
    const { lat, lon } = anchor.coord;
    const legIndex = typeof cursor?.leg === 'number' ? cursor.leg : 0;
    const offset = typeof cursor?.offset === 'number' ? cursor.offset : 0;
    const leg = PULSE_LEGS[legIndex];
    const cards: DeeperCard[] = [];
    const sources: SourceId[] = [];
    let more = false;
    if (leg === 'events') {
      const bbox = `${(lon - EONET_BOX_DEG).toFixed(2)},${(lat + EONET_BOX_DEG).toFixed(2)},${(lon + EONET_BOX_DEG).toFixed(2)},${(lat - EONET_BOX_DEG).toFixed(2)}`;
      const url = offset === 0 ? `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&bbox=${bbox}` : `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=12`;
      const json = await deeperFetchJson<EonetResponse>(url, { signal: ctx.signal, text: true });
      const events = (json?.events ?? []).filter((e) => e.title);
      sources.push('nasaEonet');
      if (events.length > 0) {
        cards.push({
          id: `pulse-events-${offset}`,
          kind: 'list',
          scope: offset === 0 ? 'country' : 'global',
          field: 'f1',
          items: events.slice(0, 12).map((e) => ({ id: e.id ?? e.title!, title: e.title!, meta: [e.categories?.[0]?.title, (e.geometry?.[e.geometry.length - 1]?.date ?? '').slice(0, 10)].filter(Boolean).join(' · '), url: e.link, date: e.geometry?.[0]?.date })),
          sourceId: 'nasaEonet',
          sourceUrl: 'https://eonet.gsfc.nasa.gov/',
        });
      }
      more = offset === 0; // one global page after the local box
    } else if (leg === 'quakes') {
      const end = offset === 0 ? new Date() : daysAgo(offset * 30);
      const start = daysAgo(30, end.getTime());
      const json = await deeperFetchJson<UsgsResponse>(
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=${USGS_RADIUS_KM}&starttime=${isoDate(start)}&endtime=${isoDate(end)}&orderby=time&limit=10&minmagnitude=2.5`,
        { signal: ctx.signal },
      );
      const quakes = (json?.features ?? []).filter((f) => typeof f.properties?.mag === 'number');
      sources.push('usgs');
      if (quakes.length > 0) {
        cards.push({
          id: `pulse-quakes-${offset}`,
          kind: 'list',
          scope: 'country',
          field: 'f2',
          text: `${isoDate(start)} → ${isoDate(end)}`,
          items: quakes.map((f) => ({ id: f.id ?? String(f.properties?.time), title: `M${f.properties!.mag!.toFixed(1)} · ${f.properties?.place ?? ''}`, meta: f.properties?.time ? new Date(f.properties.time).toISOString().slice(0, 10) : undefined, url: f.properties?.url })),
          sourceId: 'usgs',
          sourceUrl: 'https://earthquake.usgs.gov/earthquakes/map/',
        });
      }
      more = offset + 1 < 12; // a year of 30-day windows, backwards
    } else if (leg === 'water') {
      const [flood, marine] = await Promise.all([
        deeperFetchJson<FloodResponse>(`https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge&forecast_days=7`, { signal: ctx.signal }),
        deeperFetchJson<MarineResponse>(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&daily=wave_height_max&forecast_days=7`, { signal: ctx.signal }),
      ]);
      sources.push('openMeteo');
      const discharge = (flood?.daily?.river_discharge ?? []).filter((n): n is number => typeof n === 'number');
      if (discharge.length > 0) {
        cards.push({
          id: 'pulse-flood',
          kind: 'spark',
          scope: 'country',
          field: 'f3',
          series: { label: 'f3', points: discharge, dates: flood?.daily?.time, unit: 'm³/s' },
          facts: [{ label: 'f3', value: `${Math.round(discharge[0])} m³/s`, emphasis: true }],
          sourceId: 'openMeteo',
          sourceUrl: 'https://open-meteo.com/en/docs/flood-api',
        });
      }
      const waves = (marine?.daily?.wave_height_max ?? []).filter((n): n is number => typeof n === 'number');
      if (waves.length > 0) {
        cards.push({
          id: 'pulse-marine',
          kind: 'spark',
          scope: 'country',
          field: 'f4',
          series: { label: 'f4', points: waves, dates: marine?.daily?.time, unit: 'm' },
          facts: [{ label: 'f4', value: `${waves[0].toFixed(1)} m`, emphasis: true }],
          sourceId: 'openMeteo',
          sourceUrl: 'https://open-meteo.com/en/docs/marine-weather-api',
        });
      }
    } else if (leg === 'alerts') {
      if (anchor.countryCode === 'US' || ctx.country === 'US') {
        const json = await deeperFetchJson<NwsResponse>(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, { signal: ctx.signal, headers: { accept: 'application/geo+json' } });
        const alerts = (json?.features ?? []).filter((f) => f.properties?.headline || f.properties?.event);
        sources.push('noaaNws');
        if (alerts.length > 0) {
          cards.push({
            id: 'pulse-alerts',
            kind: 'list',
            scope: 'country',
            field: 'f5',
            items: alerts.slice(0, 8).map((f) => ({ id: f.id ?? f.properties!.event!, title: f.properties?.headline ?? f.properties?.event ?? '', meta: [f.properties?.severity, (f.properties?.effective ?? '').slice(0, 10)].filter(Boolean).join(' · '), url: f.properties?.web })),
            sourceId: 'noaaNws',
            sourceUrl: 'https://www.weather.gov/',
          });
        }
      }
    }
    let next: DeeperPage['cursor'] = null;
    if (more) next = { leg: legIndex, offset: offset + 1 };
    else if (legIndex + 1 < PULSE_LEGS.length) next = { leg: legIndex + 1, offset: 0 };
    return { cards, cursor: next, fetchedAt: Date.now(), sources, empty: cards.length === 0 && next === null };
  },
};

export { wordCount as pressWordCount };
export type { DeeperContext as OpenDeeperContext };
