/**
 * REV-20 §3 -- the unified 22-slot discovery carousel's data layer.
 *
 * Every slot (weather, the nine REV-19 news themes, twelve new REV-20 feed
 * themes) implements the SAME `DiscoverySlot.load()` contract and returns
 * the SAME `SlotCard` shape, so the carousel component renders one card
 * shell regardless of kind -- the founder's requirement that weather be
 * visually indistinguishable from any other theme. All twelve new feed
 * adapters call keyless, CORS `*`, zero-cost public APIs verified live in
 * docs/rev20/measure/sources.md; nothing here spends a U-COIN or touches a
 * paid endpoint. Every adapter is fail-open: a network error or empty
 * response yields a valid (if sparse) SlotCard, never a throw.
 */
import {
  Activity,
  ArrowLeftRight,
  Bitcoin,
  CloudSun,
  Eye,
  FlaskConical,
  Hourglass,
  Landmark,
  Library,
  MapPinned,
  Palette,
  Terminal,
  Trophy,
  UsersRound,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import { DEFAULT_PLACE, conditionOf, fetchForecast, readWeatherCache, writeWeatherCache, type Place } from '@/lib/live/useLiveWeather';
import { HUB_CARD_ITEMS, HUB_THEMES, findHubTheme, type HubThemeKey } from '@/lib/live/hubThemes';
import { loadHubNews } from '@/lib/live/hubNewsClient';
import { GLOBAL_RANKING_THEMES, type GlobalRankingThemeKey } from '@/lib/globalRankings';
import { MODULE_REGISTRY, moduleTitleNamespace, unitasRankingFor } from '@/lib/unitasRankings';

/* ------------------------------------------------------------------ */
/* Contract                                                             */
/* ------------------------------------------------------------------ */

/** REV-21 §1.3 adds `ranking` -- the two REV-19 ranking widgets ("실시간
 *  세계 랭킹", "실시간 유니타스 랭킹") absorbed as slots of this carousel. */
export type SlotKind = 'weather' | 'news' | 'feed' | 'ranking';

export type RankingSlotKey = 'worldRanking' | 'unitasRanking';

export type FeedSlotKey =
  | 'history'
  | 'quake'
  | 'mostRead'
  | 'fx'
  | 'crypto'
  | 'devPulse'
  | 'paper'
  | 'library'
  | 'art'
  | 'air'
  | 'nation'
  | 'nearby';

export type SlotKey = 'weather' | HubThemeKey | FeedSlotKey | RankingSlotKey;

export interface SlotFact {
  /** Rev20.slots.facts.* (or Rev21.slots.facts.*) dot-path -- the component
   *  owns translation. */
  labelKey: string;
  value: string;
  unit?: string;
  /** At most one fact per card should be emphasised (rendered large). */
  emphasis?: boolean;
}

/** REV-21 §1.3: what tapping an item does when it has no outbound URL --
 *  a ranking row opens its detail inside the slot's deep modal. */
export type SlotItemAction =
  | { kind: 'rankingDetail'; theme: GlobalRankingThemeKey; rank: number }
  | { kind: 'unitasProfile'; moduleKey: string; rank: number };

export interface SlotItem {
  id: string;
  title: string;
  domain?: string;
  url?: string;
  /** Short secondary line (points, distance, price...). */
  meta?: string;
  action?: SlotItemAction;
  rank?: number;
  color?: string;
}

/** REV-21 §1.3: a sub-tab inside a card (ranking theme / module). */
export interface SlotTab {
  key: string;
  /** Fully-qualified message path the component resolves with the root `t`. */
  labelKey: string;
  color: string;
}

/** REV-21 §2.2 / §3.1: the entity a card is ABOUT, carried as an identifier
 *  so outbound links and Explore Deeper never re-search a translated title. */
export interface SlotSubject {
  term: string;
  wikiTitle?: string;
  qid?: string;
  lang?: string;
}

/** Opaque continuation token an adapter understands on its own next call.
 *  `null` means "no further page" -- the deep-dive pagination stop signal. */
export type DeepCursor = Record<string, string | number> | null;

export interface SlotCard {
  facts: SlotFact[];
  items: SlotItem[];
  updatedAt: number;
  cursor: DeepCursor;
  tabs?: SlotTab[];
  activeTab?: string;
  subject?: SlotSubject;
}

export interface SlotContext {
  locale: string;
  /** REV-21 §2.1: the visitor's selected country (ISO 3166-1 alpha-2) --
   *  the SECOND output scope after global. Optional only for callers that
   *  predate REV-21; adapters fall back to the locale's default place. */
  country?: string;
  signal?: AbortSignal;
}

export interface DiscoverySlot {
  key: SlotKey;
  kind: SlotKind;
  icon: LucideIcon;
  color: string;
  /** `cursor` omitted/undefined = first page. */
  load(ctx: SlotContext, cursor?: DeepCursor): Promise<SlotCard>;
}

const EMPTY_CARD: SlotCard = { facts: [], items: [], updatedAt: Date.now(), cursor: null };

async function safeJson<T>(url: string, signal?: AbortSignal, timeoutMs = 6000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function dayOfYear(): number {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 1);
  return Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - start) / 86_400_000);
}

/** The visitor's last-known place from the weather slot's own cache -- reused
 *  by `air` and `nation` so those two slots cost zero extra geolocation. */
function knownPlace(locale: string): Place {
  return readWeatherCache()?.place ?? DEFAULT_PLACE[locale] ?? DEFAULT_PLACE.en;
}

/* ------------------------------------------------------------------ */
/* Slot 0: weather                                                      */
/* ------------------------------------------------------------------ */

const weatherSlot: DiscoverySlot = {
  key: 'weather',
  kind: 'weather',
  icon: CloudSun,
  color: '#4a90d9',
  async load({ locale, signal }) {
    const cached = readWeatherCache();
    const fresh = cached && Date.now() - cached.at < 10 * 60 * 1000;
    const place = cached?.place ?? DEFAULT_PLACE[locale] ?? DEFAULT_PLACE.en;
    const forecast = fresh ? cached!.forecast : await fetchForecast(place, signal ?? new AbortController().signal).catch(() => null);
    if (!forecast) return EMPTY_CARD;
    if (!fresh) writeWeatherCache(place, forecast);
    const cond = conditionOf(forecast.current.code);
    const cityValue = [place.country, place.name].filter(Boolean).join(' / ');
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.city', value: cityValue || place.name },
        { labelKey: 'Rev20.slots.facts.tempNow', value: String(Math.round(forecast.current.temp)), unit: '°', emphasis: true },
        { labelKey: `Weather.condition.${cond}`, value: '' },
        {
          labelKey: 'Rev20.slots.facts.hiLo',
          value: `${Math.round(forecast.daily[0]?.max ?? forecast.current.temp)}° / ${Math.round(forecast.daily[0]?.min ?? forecast.current.temp)}°`,
        },
        { labelKey: 'Rev20.slots.facts.feelsLike', value: String(Math.round(forecast.current.feelsLike)), unit: '°' },
      ],
      items: [],
      updatedAt: fresh ? cached!.at : Date.now(),
      cursor: null,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Slots 1-9: the REV-19 news themes (unchanged data source)            */
/* ------------------------------------------------------------------ */

function newsSlotFor(theme: HubThemeKey): DiscoverySlot {
  const meta = findHubTheme(theme);
  return {
    key: theme,
    kind: 'news',
    icon: meta.icon,
    color: meta.color,
    async load({ locale }) {
      const news = await loadHubNews(locale, theme, false).catch(() => null);
      if (!news || news.items.length === 0) return EMPTY_CARD;
      const top = news.items[0];
      return {
        facts: [
          { labelKey: 'Rev20.slots.facts.topHeadline', value: top.title, emphasis: true },
          { labelKey: 'Rev20.slots.facts.headlineCount', value: String(news.items.length) },
        ],
        items: news.items.slice(0, HUB_CARD_ITEMS).map((it) => ({ id: it.id, title: it.title, domain: it.domain, url: it.url })),
        updatedAt: news.fetchedAt,
        cursor: null,
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Slots 10-21: the twelve REV-20 feed themes                           */
/* ------------------------------------------------------------------ */

interface WikiExtractResponse {
  query?: { pages?: Record<string, { title?: string; extract?: string }> };
}

/** `Intl` month/day formatting already matches Wikipedia's per-language date
 *  article title convention for every locale verified in sources.md (ko/ja/et/en);
 *  the rest ride the same CLDR "day+month" calendar pattern. */
function todayWikiDateTitle(locale: string): string {
  const now = new Date();
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(now);
  }
}

const historySlot: DiscoverySlot = {
  key: 'history',
  kind: 'feed',
  icon: Hourglass,
  color: '#a1785a',
  async load({ locale, signal }) {
    const lang = wikiLangFor(locale);
    const title = todayWikiDateTitle(locale);
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=1&format=json&origin=*`;
    const json = await safeJson<WikiExtractResponse>(url, signal);
    const page = Object.values(json?.query?.pages ?? {})[0];
    const extract = page?.extract ?? '';
    const lines = extract
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 8 && l.length < 220 && !/^=+.*=+$/.test(l));
    const pageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const items: SlotItem[] = lines.slice(0, 6).map((l, i) => ({ id: `history-${i}`, title: l, url: pageUrl }));
    if (items.length === 0) return EMPTY_CARD;
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.todayDate', value: title },
        { labelKey: 'Rev20.slots.facts.firstEvent', value: items[0].title, emphasis: true },
        { labelKey: 'Rev20.slots.facts.eventCount', value: String(lines.length) },
      ],
      items,
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

interface UsgsResponse {
  features?: Array<{
    properties?: { mag?: number; place?: string; time?: number };
    geometry?: { coordinates?: [number, number, number] };
  }>;
}

const quakeSlot: DiscoverySlot = {
  key: 'quake',
  kind: 'feed',
  icon: Activity,
  color: '#b4452e',
  async load({ signal }) {
    const json = await safeJson<UsgsResponse>(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
      signal,
    );
    const features = (json?.features ?? []).filter((f) => typeof f.properties?.mag === 'number' && f.properties.place);
    if (features.length === 0) return EMPTY_CARD;
    const sorted = [...features].sort((a, b) => (b.properties?.mag ?? 0) - (a.properties?.mag ?? 0));
    const top = sorted[0];
    const items: SlotItem[] = sorted.slice(0, 4).map((f, i) => ({
      id: `quake-${i}`,
      title: `M${(f.properties?.mag ?? 0).toFixed(1)} · ${f.properties?.place ?? ''}`,
      meta: typeof f.geometry?.coordinates?.[2] === 'number' ? `${Math.round(f.geometry.coordinates[2])}km` : undefined,
    }));
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.maxMag', value: (top.properties?.mag ?? 0).toFixed(1), emphasis: true },
        { labelKey: 'Rev20.slots.facts.quakePlace', value: top.properties?.place ?? '' },
        { labelKey: 'Rev20.slots.facts.quakeCount', value: String(features.length) },
      ],
      items,
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

interface PageviewsResponse {
  items?: Array<{ articles?: Array<{ article?: string; views?: number; rank?: number }> }>;
}

function isNoiseArticle(a: string): boolean {
  return /^(Special:|Main_Page|위키백과:|首页|トップページ)/.test(a);
}

const mostReadSlot: DiscoverySlot = {
  key: 'mostRead',
  kind: 'feed',
  icon: Eye,
  color: '#4b5bbf',
  async load({ locale, signal }) {
    const lang = wikiLangFor(locale);
    const y = new Date(Date.now() - 86_400_000);
    const yyyy = y.getUTCFullYear();
    const mm = String(y.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(y.getUTCDate()).padStart(2, '0');
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${lang}.wikipedia/all-access/${yyyy}/${mm}/${dd}`;
    const json = await safeJson<PageviewsResponse>(url, signal);
    const articles = (json?.items?.[0]?.articles ?? []).filter((a) => a.article && !isNoiseArticle(a.article));
    if (articles.length === 0) return EMPTY_CARD;
    const items: SlotItem[] = articles.slice(0, 4).map((a, i) => ({
      id: `mostread-${i}`,
      title: (a.article ?? '').replace(/_/g, ' '),
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(a.article ?? '')}`,
      meta: typeof a.views === 'number' ? a.views.toLocaleString() : undefined,
    }));
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.rank1', value: items[0].title, emphasis: true },
        { labelKey: 'Rev20.slots.facts.rank1Views', value: items[0].meta ?? '' },
      ],
      items,
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

interface FrankfurterResponse {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

const fxSlot: DiscoverySlot = {
  key: 'fx',
  kind: 'feed',
  icon: ArrowLeftRight,
  color: '#6b7a8f',
  async load({ signal }) {
    const json = await safeJson<FrankfurterResponse>('https://api.frankfurter.app/latest?from=USD&to=EUR,JPY,GBP,KRW', signal);
    const rates = json?.rates;
    if (!rates) return EMPTY_CARD;
    const pairs = Object.entries(rates);
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.fxBase', value: json?.base ?? 'USD' },
        ...pairs.map(([code, rate]) => ({
          labelKey: `Rev20.slots.facts.fxRate`,
          value: `${code} ${rate.toFixed(2)}`,
          emphasis: code === pairs[0][0],
        })),
        { labelKey: 'Rev20.slots.facts.fxDate', value: json?.date ?? '' },
      ],
      items: [],
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h?: number;
  market_cap_rank?: number;
}

const cryptoSlot: DiscoverySlot = {
  key: 'crypto',
  kind: 'feed',
  icon: Bitcoin,
  color: '#3fa34d',
  async load({ signal }) {
    const json = await safeJson<CoinGeckoMarket[]>(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=5&page=1',
      signal,
    );
    if (!json || json.length === 0) return EMPTY_CARD;
    const btc = json.find((c) => c.symbol === 'btc') ?? json[0];
    const items: SlotItem[] = json.slice(0, 5).map((c) => ({
      id: c.id,
      title: `${c.name} (${c.symbol.toUpperCase()})`,
      meta: `$${c.current_price.toLocaleString()} ${c.price_change_percentage_24h ? (c.price_change_percentage_24h > 0 ? '+' : '') + c.price_change_percentage_24h.toFixed(1) + '%' : ''}`,
    }));
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.btcPrice', value: `$${btc.current_price.toLocaleString()}`, emphasis: true },
        {
          labelKey: 'Rev20.slots.facts.btc24h',
          value: `${(btc.price_change_percentage_24h ?? 0) > 0 ? '+' : ''}${(btc.price_change_percentage_24h ?? 0).toFixed(1)}%`,
        },
      ],
      items,
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

interface HnHit {
  objectID: string;
  title?: string;
  url?: string;
  points?: number;
  num_comments?: number;
}
interface HnResponse {
  hits?: HnHit[];
}

const devPulseSlot: DiscoverySlot = {
  key: 'devPulse',
  kind: 'feed',
  icon: Terminal,
  color: '#2f3640',
  async load({ signal }) {
    const json = await safeJson<HnResponse>('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=6', signal);
    const hits = (json?.hits ?? []).filter((h) => h.title);
    if (hits.length === 0) return EMPTY_CARD;
    const top = hits[0];
    const items: SlotItem[] = hits.slice(0, 4).map((h) => ({
      id: h.objectID,
      title: h.title ?? '',
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      meta: `${h.points ?? 0}pt · ${h.num_comments ?? 0}💬`,
    }));
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.topStory', value: top.title ?? '', emphasis: true },
        { labelKey: 'Rev20.slots.facts.storyPoints', value: String(top.points ?? 0) },
      ],
      items,
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

interface OpenAlexWork {
  id: string;
  display_name?: string;
  publication_year?: number;
  cited_by_count?: number;
  open_access?: { is_oa?: boolean };
  authorships?: Array<{ author?: { display_name?: string } }>;
}
interface OpenAlexResponse {
  results?: OpenAlexWork[];
  meta?: { count?: number };
}

const paperSlot: DiscoverySlot = {
  key: 'paper',
  kind: 'feed',
  icon: FlaskConical,
  color: '#8a6d14',
  async load({ signal }) {
    const json = await safeJson<OpenAlexResponse>(
      'https://api.openalex.org/works?sort=publication_date:desc&per-page=5&filter=has_abstract:true',
      signal,
    );
    const results = (json?.results ?? []).filter((w) => w.display_name);
    if (results.length === 0) return EMPTY_CARD;
    const top = results[0];
    const items: SlotItem[] = results.slice(0, 4).map((w) => ({
      id: w.id,
      title: w.display_name ?? '',
      meta: `${w.authorships?.[0]?.author?.display_name ?? ''} · ${w.publication_year ?? ''}`,
    }));
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.paperTitle', value: top.display_name ?? '', emphasis: true },
        { labelKey: 'Rev20.slots.facts.paperCitations', value: String(top.cited_by_count ?? 0) },
        { labelKey: 'Rev20.slots.facts.paperOa', value: top.open_access?.is_oa ? 'OA' : '—' },
      ],
      items,
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  edition_count?: number;
}
interface OpenLibraryResponse {
  docs?: OpenLibraryDoc[];
  numFound?: number;
}

/** D-5 (founder-delegated resolution): rather than merge `library` into the
 *  existing `bestseller` news theme (which would require restructuring the
 *  9-theme hub registry), `library` rotates through a distinct subject each
 *  day so the two never read as the same content -- `bestseller` stays
 *  RSS-driven "what's trending in the news right now", `library` is a
 *  browsable shelf of real OpenLibrary catalog data. */
const LIBRARY_SUBJECTS = ['classic literature', 'science fiction', 'history', 'biography', 'poetry', 'philosophy', 'mystery novel'];

const librarySlot: DiscoverySlot = {
  key: 'library',
  kind: 'feed',
  icon: Library,
  color: '#7b4f2e',
  async load({ signal }) {
    const subject = LIBRARY_SUBJECTS[dayOfYear() % LIBRARY_SUBJECTS.length];
    const json = await safeJson<OpenLibraryResponse>(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(subject)}&page=1&limit=5&fields=title,author_name,first_publish_year,edition_count`,
      signal,
    );
    const docs = (json?.docs ?? []).filter((d) => d.title);
    if (docs.length === 0) return EMPTY_CARD;
    const top = docs[0];
    const items: SlotItem[] = docs.slice(0, 4).map((d, i) => ({
      id: `lib-${i}`,
      title: d.title ?? '',
      meta: `${d.author_name?.[0] ?? ''} · ${d.first_publish_year ?? ''}`,
    }));
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.shelfSubject', value: subject },
        { labelKey: 'Rev20.slots.facts.bookTitle', value: top.title ?? '', emphasis: true },
        { labelKey: 'Rev20.slots.facts.bookEditions', value: String(top.edition_count ?? 1) },
      ],
      items,
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

const ART_TERMS = ['moon', 'ocean', 'portrait', 'garden', 'river', 'mountain', 'dream', 'lion'];

interface MetSearchResponse {
  objectIDs?: number[];
  total?: number;
}
interface MetObjectResponse {
  title?: string;
  artistDisplayName?: string;
  objectDate?: string;
  department?: string;
  objectURL?: string;
}

const artSlot: DiscoverySlot = {
  key: 'art',
  kind: 'feed',
  icon: Palette,
  color: '#7b2d8e',
  async load({ signal }) {
    const term = ART_TERMS[dayOfYear() % ART_TERMS.length];
    const search = await safeJson<MetSearchResponse>(
      `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(term)}&hasImages=true`,
      signal,
    );
    const ids = search?.objectIDs ?? [];
    if (ids.length === 0) return EMPTY_CARD;
    const id = ids[dayOfYear() % Math.min(ids.length, 50)];
    const obj = await safeJson<MetObjectResponse>(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, signal);
    if (!obj?.title) return EMPTY_CARD;
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.artTitle', value: obj.title, emphasis: true },
        { labelKey: 'Rev20.slots.facts.artArtist', value: obj.artistDisplayName || '—' },
        { labelKey: 'Rev20.slots.facts.artDate', value: obj.objectDate || '—' },
        { labelKey: 'Rev20.slots.facts.artDept', value: obj.department || '—' },
      ],
      items: obj.objectURL ? [{ id: String(id), title: obj.title, url: obj.objectURL, domain: 'Met Museum' }] : [],
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

interface AirQualityResponse {
  current?: { pm10?: number; pm2_5?: number; european_aqi?: number };
}

function aqiBand(aqi: number): string {
  if (aqi <= 20) return 'good';
  if (aqi <= 40) return 'fair';
  if (aqi <= 60) return 'moderate';
  if (aqi <= 80) return 'poor';
  if (aqi <= 100) return 'veryPoor';
  return 'extreme';
}

const airSlot: DiscoverySlot = {
  key: 'air',
  kind: 'feed',
  icon: Wind,
  color: '#63b3ed',
  async load({ locale, signal }) {
    const place = knownPlace(locale);
    const json = await safeJson<AirQualityResponse>(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${place.lat}&longitude=${place.lon}&current=pm10,pm2_5,european_aqi`,
      signal,
    );
    const c = json?.current;
    if (!c || typeof c.european_aqi !== 'number') return EMPTY_CARD;
    return {
      facts: [
        { labelKey: `Rev20.slots.facts.aqi.${aqiBand(c.european_aqi)}`, value: '', emphasis: true },
        { labelKey: 'Rev20.slots.facts.aqiValue', value: String(Math.round(c.european_aqi)) },
        { labelKey: 'Rev20.slots.facts.pm25', value: c.pm2_5 !== undefined ? c.pm2_5.toFixed(1) : '—' },
        { labelKey: 'Rev20.slots.facts.pm10', value: c.pm10 !== undefined ? c.pm10.toFixed(1) : '—' },
        { labelKey: 'Rev20.slots.facts.city', value: place.name },
      ],
      items: [],
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

interface WorldBankPoint {
  date?: string;
  value?: number | null;
  country?: { value?: string };
}
type WorldBankResponse = [unknown, WorldBankPoint[] | undefined] | undefined;

async function latestIndicator(iso2: string, code: string, signal?: AbortSignal): Promise<WorldBankPoint | null> {
  const json = await safeJson<WorldBankResponse>(
    `https://api.worldbank.org/v2/country/${iso2}/indicator/${code}?format=json&per_page=20`,
    signal,
  );
  const points = Array.isArray(json) ? json[1] ?? [] : [];
  return points.find((p) => typeof p.value === 'number') ?? null;
}

const nationSlot: DiscoverySlot = {
  key: 'nation',
  kind: 'feed',
  icon: Landmark,
  color: '#2d6a4f',
  async load({ locale, signal }) {
    const place = knownPlace(locale);
    const iso2 = place.countryCode;
    if (!iso2) return EMPTY_CARD;
    const [gdp, pop, net] = await Promise.all([
      latestIndicator(iso2, 'NY.GDP.MKTP.CD', signal),
      latestIndicator(iso2, 'SP.POP.TOTL', signal),
      latestIndicator(iso2, 'IT.NET.USER.ZS', signal),
    ]);
    if (!gdp && !pop) return EMPTY_CARD;
    const fmtUsd = (v: number) => `$${(v / 1e9).toFixed(1)}B`;
    const fmtPop = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v.toLocaleString());
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.nationCountry', value: gdp?.country?.value || pop?.country?.value || place.country || iso2 },
        ...(gdp && typeof gdp.value === 'number'
          ? [{ labelKey: 'Rev20.slots.facts.nationGdp', value: fmtUsd(gdp.value), emphasis: true }]
          : []),
        ...(pop && typeof pop.value === 'number' ? [{ labelKey: 'Rev20.slots.facts.nationPop', value: fmtPop(pop.value) }] : []),
        ...(net && typeof net.value === 'number' ? [{ labelKey: 'Rev20.slots.facts.nationNet', value: `${net.value.toFixed(0)}%` }] : []),
      ],
      items: [],
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

interface GeoSearchResponse {
  query?: { geosearch?: Array<{ pageid?: number; title?: string; dist?: number }> };
}

const nearbySlot: DiscoverySlot = {
  key: 'nearby',
  kind: 'feed',
  icon: MapPinned,
  color: '#c05621',
  async load({ locale, signal }) {
    const place = knownPlace(locale);
    const lang = wikiLangFor(locale);
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${place.lat}|${place.lon}&gsradius=10000&gslimit=10&format=json&origin=*`;
    const json = await safeJson<GeoSearchResponse>(url, signal);
    const hits = (json?.query?.geosearch ?? []).filter((h) => h.title);
    if (hits.length === 0) return EMPTY_CARD;
    const items: SlotItem[] = hits.slice(0, 4).map((h) => ({
      id: String(h.pageid ?? h.title),
      title: h.title ?? '',
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent((h.title ?? '').replace(/ /g, '_'))}`,
      meta: typeof h.dist === 'number' ? `${Math.round(h.dist)}m` : undefined,
    }));
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.nearbyTitle', value: items[0].title, emphasis: true },
        { labelKey: 'Rev20.slots.facts.nearbyDist', value: items[0].meta ?? '' },
        { labelKey: 'Rev20.slots.facts.nearbyCount', value: String(hits.length) },
      ],
      items,
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Slots 22-23: the two REV-19 ranking widgets, absorbed (REV-21 §1.3)   */
/* ------------------------------------------------------------------ */

/** Ranking data is curated / deterministic -- no network, so a card is
 *  instant. The cursor's `tab` selects the theme (world) or module
 *  (UNITAS); the deep modal owns the full lists and the rank-detail
 *  popups (which DO reach the encyclopedic detail route on demand -- never
 *  from the rotating card). */
const worldRankingSlot: DiscoverySlot = {
  key: 'worldRanking',
  kind: 'ranking',
  icon: Trophy,
  color: '#facc15',
  async load(_ctx, cursor) {
    const requested = typeof cursor?.tab === 'string' ? cursor.tab : undefined;
    const theme = GLOBAL_RANKING_THEMES.find((t) => t.key === requested) ?? GLOBAL_RANKING_THEMES[0];
    const top = theme.entries[0];
    return {
      facts: [
        { labelKey: 'Rev21.slots.facts.topRank', value: top ? top.name : '', emphasis: true },
        { labelKey: 'Rev21.slots.facts.rankedEntries', value: String(theme.entries.length) },
      ],
      items: theme.entries.slice(0, HUB_CARD_ITEMS).map((entry) => ({
        id: `${theme.key}:${entry.rank}`,
        title: entry.name,
        meta: entry.note,
        rank: entry.rank,
        color: theme.color,
        action: { kind: 'rankingDetail', theme: theme.key, rank: entry.rank },
      })),
      updatedAt: Date.now(),
      cursor: null,
      tabs: GLOBAL_RANKING_THEMES.map((t) => ({ key: t.key, labelKey: `GlobalRankings.themes.${t.key}.title`, color: t.color })),
      activeTab: theme.key,
      subject: top ? { term: top.name, lang: 'en' } : undefined,
    };
  },
};

const unitasRankingSlot: DiscoverySlot = {
  key: 'unitasRanking',
  kind: 'ranking',
  icon: UsersRound,
  color: '#d4af37',
  async load(_ctx, cursor) {
    const requested = typeof cursor?.tab === 'string' ? cursor.tab : undefined;
    const module = MODULE_REGISTRY.find((m) => m.key === requested) ?? MODULE_REGISTRY[0];
    const rows = unitasRankingFor(module);
    return {
      facts: [
        { labelKey: 'Rev21.slots.facts.topOperator', value: rows[0]?.handle ?? '', emphasis: true },
        { labelKey: 'Rev21.slots.facts.moduleCount', value: String(MODULE_REGISTRY.length) },
      ],
      items: rows.slice(0, HUB_CARD_ITEMS).map((entry) => ({
        id: `${module.key}:${entry.rank}`,
        title: entry.handle,
        meta: entry.score.toLocaleString(),
        rank: entry.rank,
        color: '#d4af37',
        action: { kind: 'unitasProfile', moduleKey: module.key, rank: entry.rank },
      })),
      updatedAt: Date.now(),
      cursor: null,
      tabs: MODULE_REGISTRY.map((m) => ({ key: m.key, labelKey: `${moduleTitleNamespace(m)}.${m.messageKey}.title`, color: '#d4af37' })),
      activeTab: module.key,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Registry + rotation order                                            */
/* ------------------------------------------------------------------ */

const feedSlots: readonly DiscoverySlot[] = [
  historySlot,
  quakeSlot,
  mostReadSlot,
  fxSlot,
  cryptoSlot,
  devPulseSlot,
  paperSlot,
  librarySlot,
  artSlot,
  airSlot,
  nationSlot,
  nearbySlot,
];

const newsSlots: readonly DiscoverySlot[] = HUB_THEMES.map((t) => newsSlotFor(t.key));

const rankingSlots: readonly DiscoverySlot[] = [worldRankingSlot, unitasRankingSlot];

const SLOT_BY_KEY = new Map<SlotKey, DiscoverySlot>([
  [weatherSlot.key, weatherSlot],
  ...newsSlots.map((s): [SlotKey, DiscoverySlot] => [s.key, s]),
  ...feedSlots.map((s): [SlotKey, DiscoverySlot] => [s.key, s]),
  ...rankingSlots.map((s): [SlotKey, DiscoverySlot] => [s.key, s]),
]);

/** REV-20 §3.4/§3.5: weather first, then the 9 news + 12 feed themes
 *  interleaved so two "newsy" or two "data" slots never sit back to back
 *  (colour-wheel adjacency is handled by the component, order here only
 *  guards content-kind adjacency). REV-21 §1.3: the two ranking slots join
 *  at the two natural "data" seams (after nation, after nearby). 24 slots. */
export const DISCOVERY_ROTATION: readonly SlotKey[] = [
  'weather',
  'mostRead',
  'stock',
  'history',
  'sports',
  'crypto',
  'movie',
  'quake',
  'shopping',
  'paper',
  'game',
  'fx',
  'food',
  'art',
  'webtoon',
  'devPulse',
  'fashion',
  'nation',
  'worldRanking',
  'bestseller',
  'air',
  'library',
  'nearby',
  'unitasRanking',
];

/** REV-21 §3.2: the REAL name of the engine behind each slot, for the
 *  source-attribution row. Static -- `load()` is untouched. */
export const SLOT_PROVIDER: Record<SlotKey, { name: string; url: string }> = {
  weather: { name: 'Open-Meteo', url: 'https://open-meteo.com/' },
  game: { name: 'Google News · Bing News', url: 'https://news.google.com/' },
  sports: { name: 'Google News · Bing News', url: 'https://news.google.com/' },
  movie: { name: 'Google News · Bing News', url: 'https://news.google.com/' },
  bestseller: { name: 'Google News · Bing News', url: 'https://news.google.com/' },
  shopping: { name: 'Google News · Bing News', url: 'https://news.google.com/' },
  stock: { name: 'Google News · Bing News', url: 'https://news.google.com/' },
  webtoon: { name: 'Google News · Bing News', url: 'https://news.google.com/' },
  fashion: { name: 'Google News · Bing News', url: 'https://news.google.com/' },
  food: { name: 'Google News · Bing News', url: 'https://news.google.com/' },
  history: { name: 'Wikipedia', url: 'https://www.wikipedia.org/' },
  quake: { name: 'USGS Earthquake Hazards Program', url: 'https://earthquake.usgs.gov/' },
  mostRead: { name: 'Wikimedia Pageviews', url: 'https://wikimedia.org/api/rest_v1/' },
  fx: { name: 'Frankfurter (ECB reference rates)', url: 'https://www.frankfurter.app/' },
  crypto: { name: 'CoinGecko', url: 'https://www.coingecko.com/' },
  devPulse: { name: 'Hacker News (Algolia)', url: 'https://hn.algolia.com/' },
  paper: { name: 'OpenAlex', url: 'https://openalex.org/' },
  library: { name: 'Open Library', url: 'https://openlibrary.org/' },
  art: { name: 'The Met Collection', url: 'https://www.metmuseum.org/art/collection' },
  air: { name: 'Open-Meteo Air Quality', url: 'https://open-meteo.com/en/docs/air-quality-api' },
  nation: { name: 'World Bank Open Data', url: 'https://data.worldbank.org/' },
  nearby: { name: 'Wikipedia', url: 'https://www.wikipedia.org/' },
  worldRanking: { name: 'UNITAS curated dataset', url: 'https://www.theunitas.global/' },
  unitasRanking: { name: 'UNITAS activity index (pseudonymous)', url: 'https://www.theunitas.global/' },
};

/** REV-21 §2.2 (H-9) / §3.1: the Wikidata item each slot is ABOUT -- the
 *  anchor Explore Deeper and the outbound wiki link use instead of the
 *  slot's translated title (which is how '공기' became a string search). */
export const SLOT_QID: Partial<Record<SlotKey, string>> = {
  weather: 'Q11663', // weather
  game: 'Q7889', // video game
  sports: 'Q349', // sport
  movie: 'Q11424', // film
  bestseller: 'Q571', // book
  shopping: 'Q830036', // shopping
  stock: 'Q11691', // stock exchange
  webtoon: 'Q1211714', // webtoon
  fashion: 'Q12684', // fashion
  food: 'Q2095', // food
  quake: 'Q7944', // earthquake
  fx: 'Q8142', // currency
  crypto: 'Q13479982', // cryptocurrency
  devPulse: 'Q11660', // artificial intelligence -- the pulse's centre of gravity
  paper: 'Q13442814', // scholarly article
  library: 'Q571', // book
  art: 'Q838948', // work of art
  air: 'Q7391292', // air
  nation: 'Q6256', // country
};

export const DISCOVERY_SLOTS: readonly DiscoverySlot[] = DISCOVERY_ROTATION.map((k) => SLOT_BY_KEY.get(k)!).filter(Boolean);

export function discoverySlotAt(index: number): DiscoverySlot {
  const n = DISCOVERY_SLOTS.length;
  return DISCOVERY_SLOTS[((index % n) + n) % n];
}

export function findDiscoverySlot(key: SlotKey): DiscoverySlot | undefined {
  return SLOT_BY_KEY.get(key);
}

/** Cache TTL per slot kind (ms) -- REV-20 §3.3: "회전 진입 시 하위 정보 동적
 *  갱신" honours the same per-kind freshness weather already used. */
export function slotTtlMs(kind: SlotKind): number {
  if (kind === 'weather') return 10 * 60 * 1000;
  if (kind === 'news') return 10 * 60 * 1000;
  if (kind === 'ranking') return 6 * 60 * 60 * 1000; // curated / deterministic data
  return 15 * 60 * 1000;
}
