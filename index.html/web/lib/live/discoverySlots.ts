/**
 * The unified discovery carousel's data layer.
 *
 * REV-23 M3.1 (founder directive 2026-09-13): the nine REV-19 "news themes"
 * (game · sports · movie · bestseller · shopping · stock · webtoon · fashion
 * · food) are GONE from this rail. Every one of them was a Google/Bing news
 * RSS wire -- the same kind of content, from the same engines, as the
 * 실시간 뉴스 rail sitting directly beneath it. That is the 0% overlap the
 * founder ordered: the shortcut rail is live DATA and utility, the news rail
 * is news, and neither carries the other's material. Their replacement at
 * the head of the rotation is the new `awards` theme (M3.4).
 *
 * Every slot implements the SAME `DiscoverySlot.load()` contract and returns
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
  Award,
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
import { resolveDeeperPlace } from '@/lib/uai/deeperAnchor';
import { sourceById, type SourceId } from '@/lib/uai/sourceRegistry';
import { DEFAULT_PLACE, conditionOf, fetchForecast, readWeatherCache, writeWeatherCache, type Place } from '@/lib/live/useLiveWeather';
import { AWARD_CARD_ITEMS, awardOfDay, loadAwardRoll } from '@/lib/live/awardsThemes';

/** Rows a ranking slot shows on the inline card. */
const RANKING_CARD_ITEMS = 4;

/** Auto-rotation cadence of the discovery rail (ms). Lived in hubThemes.ts
 *  until REV-23 M3.1 deleted that module with the news wires it served. */
export const DISCOVERY_ROTATE_MS = 7000;
import { GLOBAL_RANKING_THEMES, type GlobalRankingThemeKey } from '@/lib/globalRankings';
import { MODULE_REGISTRY, moduleTitleNamespace, unitasRankingFor } from '@/lib/unitasRankings';
import { fxCountryQuote, withSlotSections } from '@/lib/live/slotSections';

/* ------------------------------------------------------------------ */
/* Contract                                                             */
/* ------------------------------------------------------------------ */

/** `ranking` holds the two ranking widgets ("실시간 세계 랭킹", "실시간
 *  유니타스 랭킹") absorbed as slots of this carousel. REV-23 M3.1 retired
 *  the `news` kind: no slot on this rail carries a news wire any more. */
export type SlotKind = 'weather' | 'feed' | 'ranking';

export type RankingSlotKey = 'worldRanking' | 'unitasRanking';

export type FeedSlotKey =
  | 'awards'
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

export type SlotKey = 'weather' | FeedSlotKey | RankingSlotKey;

/** REV-21 §2.1(§2A.3): the two output scopes a card renders in, global
 *  first and the visitor's country second. */
export type SlotScope = 'global' | 'country';

export interface SlotFact {
  /** Rev20.slots.facts.* (or Rev21.slots.facts.*) dot-path -- the component
   *  owns translation. */
  labelKey: string;
  value: string;
  unit?: string;
  /** At most one fact per card should be emphasised (rendered large). */
  emphasis?: boolean;
  /** REV-21 §2.1: which section this fact belongs to. Unmarked = the slot's
   *  first scope (lib/live/slotSections.ts). */
  scope?: SlotScope;
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
  /** REV-21 §2.1: which section this item belongs to. */
  scope?: SlotScope;
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

/** REV-21 §2.1(§2A.3): one scope's slice of a card. The component renders
 *  these in array order with `data-scope` on each group. */
export interface SlotSection {
  scope: SlotScope;
  facts: SlotFact[];
  items: SlotItem[];
}

export interface SlotCard {
  facts: SlotFact[];
  items: SlotItem[];
  updatedAt: number;
  cursor: DeepCursor;
  tabs?: SlotTab[];
  activeTab?: string;
  subject?: SlotSubject;
  /** REV-21 §2.1: attached by the registry (withSlotSections) on every
   *  `load`, so no adapter and no consumer has to assemble them. */
  sections?: SlotSection[];
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

/** The visitor's place for the country-scoped slots (`air`, `nation`,
 *  `nearby`): the weather slot's own cache first, so those slots cost zero
 *  extra geolocation -- filtered through the SELECTED country (REV-21 §2.1,
 *  SPEC §12.3 c) so a profile country is honoured over a stale search. */
function knownPlace(ctx: SlotContext): Place {
  return resolveDeeperPlace(ctx, readWeatherCache()?.place);
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
/* REV-23 M3.4: 전 세계 최고 수상                                        */
/* ------------------------------------------------------------------ */

/**
 * One world-class prize a day, with its most recent laureates. Replaces the
 * nine news wires this rail used to carry (M3.1) with something the news
 * rail structurally cannot duplicate: an award roll is a record, not a
 * headline. Two keyless Wikidata API calls, 0원 -- see
 * lib/live/awardsThemes.ts for why this cannot use SPARQL.
 */
const awardsSlot: DiscoverySlot = {
  key: 'awards',
  kind: 'feed',
  icon: Award,
  color: '#d4af37',
  async load({ locale, signal }) {
    const award = awardOfDay(dayOfYear());
    const roll = await loadAwardRoll(award, wikiLangFor(locale), signal).catch(() => null);
    if (!roll) return EMPTY_CARD;
    return {
      facts: [
        // The award's own name is the fact LABEL and its most recent year the
        // value, so the card leads with "노벨 물리학상 · 2022" rather than a
        // generic header the visitor has to read past.
        { labelKey: `Rev23.awards.names.${award.key}`, value: roll.latestYear ?? '', emphasis: true },
        { labelKey: 'Rev23.awards.facts.laureateCount', value: String(roll.laureates.length) },
      ],
      items: roll.laureates.slice(0, AWARD_CARD_ITEMS).map((l) => ({
        id: `award:${award.key}:${l.qid}`,
        title: l.name,
        meta: l.year,
        url: l.url,
        scope: 'global' as const,
      })),
      updatedAt: Date.now(),
      cursor: null,
    };
  },
};

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

/** Frankfurter v2 (`api.frankfurter.dev/v2/rates`, REV-21 D-26): the v1
 *  host `api.frankfurter.app` now answers with a `Deprecation` header and a
 *  301, so the slot moved to v2, whose shape is a flat array of
 *  `{ date, base, quote, rate }` rows -- one per quote for the latest day,
 *  one per day for a `from`/`to` window. */
export interface FrankfurterV2Row {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
}

export const FX_BASE = 'USD';
export const FX_QUOTES = ['EUR', 'JPY', 'GBP', 'KRW'] as const;

export function frankfurterRatesUrl(base: string, quotes: readonly string[], from?: string, to?: string): string {
  const params = new URLSearchParams({ base, quotes: quotes.join(',') });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return `https://api.frankfurter.dev/v2/rates?${params.toString()}`;
}

/** Pure: the latest rate per requested quote, in the REQUESTED order (the
 *  API answers alphabetically), plus the newest date across them. */
export function parseFrankfurterV2(
  json: unknown,
  quotes: readonly string[],
): { base: string; date: string; pairs: Array<{ code: string; rate: number; date: string }> } | null {
  if (!Array.isArray(json)) return null;
  const rows = (json as FrankfurterV2Row[]).filter((r) => typeof r.quote === 'string' && typeof r.rate === 'number' && Number.isFinite(r.rate));
  if (rows.length === 0) return null;
  const latestByQuote = new Map<string, FrankfurterV2Row>();
  for (const r of rows) {
    const prev = latestByQuote.get(r.quote!);
    if (!prev || (r.date ?? '') > (prev.date ?? '')) latestByQuote.set(r.quote!, r);
  }
  const pairs = quotes
    .map((code) => latestByQuote.get(code))
    .filter((r): r is FrankfurterV2Row => Boolean(r))
    .map((r) => ({ code: r.quote!, rate: r.rate!, date: r.date ?? '' }));
  if (pairs.length === 0) return null;
  const date = pairs.reduce((max, p) => (p.date > max ? p.date : max), '');
  return { base: rows[0].base ?? FX_BASE, date, pairs };
}

/** Pure: a `from`/`to` window for one quote as a date-ordered series (the
 *  sparkline leg of the fx theme / `number` stream card). */
export function parseFrankfurterSeries(json: unknown, quote: string): Array<{ date: string; rate: number }> {
  if (!Array.isArray(json)) return [];
  return (json as FrankfurterV2Row[])
    .filter((r) => r.quote === quote && typeof r.date === 'string' && typeof r.rate === 'number')
    .map((r) => ({ date: r.date!, rate: r.rate! }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** ISO date `days` days ago (UTC), for the series window. */
export function isoDaysAgo(days: number, now = Date.now()): string {
  return new Date(now - days * 86_400_000).toISOString().slice(0, 10);
}

export async function fetchFxSeries(quote: string, days: number, signal?: AbortSignal, base = FX_BASE): Promise<Array<{ date: string; rate: number }>> {
  const json = await safeJson<unknown>(frankfurterRatesUrl(base, [quote], isoDaysAgo(days)), signal);
  return parseFrankfurterSeries(json, quote);
}

const fxSlot: DiscoverySlot = {
  key: 'fx',
  kind: 'feed',
  icon: ArrowLeftRight,
  color: '#6b7a8f',
  async load({ signal, country }) {
    // REV-21 §2.1: the visitor's own currency rides the SAME request as a
    // quote (zero extra round trips) and renders as the country section.
    const own = fxCountryQuote(country, FX_BASE);
    const quotes = own && !FX_QUOTES.includes(own as (typeof FX_QUOTES)[number]) ? [...FX_QUOTES, own] : [...FX_QUOTES];
    const json = await safeJson<unknown>(frankfurterRatesUrl(FX_BASE, quotes), signal);
    const parsed = parseFrankfurterV2(json, quotes);
    if (!parsed) return EMPTY_CARD;
    const world = parsed.pairs.filter((p) => p.code !== own);
    const mine = own ? parsed.pairs.filter((p) => p.code === own) : [];
    return {
      facts: [
        { labelKey: 'Rev20.slots.facts.fxBase', value: parsed.base },
        ...world.map((p, i) => ({
          labelKey: `Rev20.slots.facts.fxRate`,
          value: `${p.code} ${p.rate.toFixed(2)}`,
          emphasis: i === 0,
        })),
        { labelKey: 'Rev20.slots.facts.fxDate', value: parsed.date },
        ...mine.map((p) => ({
          labelKey: `Rev20.slots.facts.fxRate`,
          value: `${p.code} ${p.rate.toFixed(2)}`,
          emphasis: true,
          scope: 'country' as const,
        })),
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
  async load(ctx) {
    const { signal } = ctx;
    const place = knownPlace(ctx);
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
  async load(ctx) {
    const { signal } = ctx;
    const place = knownPlace(ctx);
    const iso2 = ctx.country ?? place.countryCode;
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
  async load(ctx) {
    const { locale, signal } = ctx;
    const place = knownPlace(ctx);
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
      items: theme.entries.slice(0, RANKING_CARD_ITEMS).map((entry) => ({
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
      items: rows.slice(0, RANKING_CARD_ITEMS).map((entry) => ({
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


const rankingSlots: readonly DiscoverySlot[] = [worldRankingSlot, unitasRankingSlot];

/** REV-21 §2.1(§2A.3): one wrapper at the registry means every adapter --
 *  and every future adapter -- answers with its scope sections attached,
 *  and no consumer has to remember to build them. */
function withScopeSections(slot: DiscoverySlot): DiscoverySlot {
  return {
    ...slot,
    load: async (ctx, cursor) => withSlotSections(slot.key, await slot.load(ctx, cursor)),
  };
}

const SLOT_BY_KEY = new Map<SlotKey, DiscoverySlot>(
  [weatherSlot, awardsSlot, ...feedSlots, ...rankingSlots]
    .map(withScopeSections)
    .map((s): [SlotKey, DiscoverySlot] => [s.key, s]),
);

/** REV-20 §3.4/§3.5: weather first, then the 9 news + 12 feed themes
 *  interleaved so two slots of the same texture never sit back to back
 *  (colour-wheel adjacency is handled by the component, order here only
 *  guards content-kind adjacency). The two ranking slots join at the two
 *  natural "data" seams. REV-23 M3.1: 24 slots -> 16, the nine news wires
 *  out and `awards` in. */
export const DISCOVERY_ROTATION: readonly SlotKey[] = [
  'weather',
  'mostRead',
  'awards',
  'history',
  'crypto',
  'quake',
  'paper',
  'fx',
  'art',
  'devPulse',
  'nation',
  'worldRanking',
  'air',
  'library',
  'nearby',
  'unitasRanking',
];

/** REV-21 §3.2 / SPEC §12.4: the REAL engines behind each slot, by registry
 *  id -- the source-attribution row, the Explore Deeper sources block and
 *  the privacy page all derive from lib/uai/sourceRegistry.ts, so the
 *  synthetic 'Google News · Bing News' label of the first cut is now two
 *  individually named sources. Static -- `load()` is untouched. */
export const SLOT_SOURCES: Record<SlotKey, readonly SourceId[]> = {
  weather: ['openMeteo'],
  awards: ['wikidata'],
  history: ['wikipedia'],
  quake: ['usgs'],
  mostRead: ['wikimediaPageviews'],
  fx: ['frankfurter'],
  crypto: ['coinGecko'],
  devPulse: ['hackerNews'],
  paper: ['openAlex'],
  library: ['openLibrary'],
  art: ['theMet'],
  air: ['openMeteo'],
  nation: ['worldBank'],
  nearby: ['wikipedia'],
  worldRanking: ['unitasCurated'],
  unitasRanking: ['unitasIndex'],
};

export interface SlotProvider {
  /** Real names joined with ' · ' (en proper nouns). */
  name: string;
  /** Homepage of the leading source. */
  url: string;
  sources: readonly SourceId[];
}

export const SLOT_PROVIDER: Record<SlotKey, SlotProvider> = Object.fromEntries(
  (Object.keys(SLOT_SOURCES) as SlotKey[]).map((key) => {
    const sources = SLOT_SOURCES[key];
    return [
      key,
      {
        name: sources.map((id) => sourceById(id).displayName.en).join(' · '),
        url: sourceById(sources[0]).homepage,
        sources,
      },
    ];
  }),
) as Record<SlotKey, SlotProvider>;

/** REV-21 §2.2 (H-9) / §3.1: the Wikidata item each slot is ABOUT -- the
 *  anchor Explore Deeper and the outbound wiki link use instead of the
 *  slot's translated title (which is how '공기' became a string search). */
export const SLOT_QID: Partial<Record<SlotKey, string>> = {
  weather: 'Q11663', // weather
  awards: 'Q618779', // award
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
  if (kind === 'ranking') return 6 * 60 * 60 * 1000; // curated / deterministic data
  return 15 * 60 * 1000;
}
