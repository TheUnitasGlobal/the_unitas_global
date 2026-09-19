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
 *
 * REV-41 (founder directive 2026-09-17): fifteen slots -- weather plus
 * fourteen feed themes. D-7 retired the `uRanking` slot REV-35 M1 had
 * transplanted from U-Square (the 유랭킹 rail lives on in the hub; this rail
 * no longer mirrors it), so the `SlotKind` union is back to two kinds and
 * `SlotItem.action` is gone with the only item that ever carried one. D-2
 * marks the single-target slots (`oneTarget`), D-3 rebuilds the fx adapter
 * as the compass (lib/live/fxCompass.ts), D-4 seats the Geo-IP fix under
 * `knownPlace`, D-5 rebuilds the nearby adapter as the omni-radar
 * (lib/live/omniRadar.ts), and a card may now carry a typed `widget` for
 * those two (D-8 renders it).
 *
 * REV-42 (founder directive 2026-09-18): sixteen slots -- weather plus
 * fifteen feed themes. D-1 retires the `air` slot outright (its Open-Meteo
 * air-quality reading is folded into the weather deep panel, D-4) and seats
 * two new flagships directly after the visitor's own sky: `cosmos` (the
 * deep-space telemetry, lib/live/cosmos.ts) and `gastronomy` (the world's
 * table, lib/live/gastronomy.ts). Both are pure catalogues ranged from the
 * visitor's point with ZERO network on the card -- API dependency 0, the
 * founder's mission 4. D-3 makes the weather card carry the moon-phase
 * widget (lib/live/skyAlmanac.ts) on EVERY load, the empty card included,
 * so the moon rises even when the forecast cannot be read.
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
  PackageOpen,
  Palette,
  Telescope,
  Terminal,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import { resolveDeeperPlace } from '@/lib/uai/deeperAnchor';
import { sourceById, type SourceId } from '@/lib/uai/sourceRegistry';
import { DEFAULT_PLACE, conditionOf, fetchForecast, readWeatherCache, writeWeatherCache, type Place } from '@/lib/live/useLiveWeather';
import { AWARD_CARD_ITEMS, awardOfDay, loadAwardRoll } from '@/lib/live/awardsThemes';
import { PRODUCT_CARD_ITEMS, PRODUCT_DEEP_ITEMS, PRODUCT_FAMILIES, familyOfDay, isProductFamilyKey, loadProductRoll, productFamily } from '@/lib/live/newProducts';
import { fxCountryQuote, withSlotSections } from '@/lib/live/slotSections';
import { localeCountry } from '@/lib/live/slotContext';
import {
  DXY_BASKET,
  FX_BASE,
  FX_MAJORS,
  FX_WINDOW_DAYS,
  coinGeckoPriceUrl,
  dollarIndexFrom,
  formatFxRate,
  formatMoney,
  formatSignedPct,
  frankfurterWindowUrl,
  pairQuoteFrom,
  parityRowsFrom,
  parseFrankfurterWindow,
  pickHomeCurrency,
} from '@/lib/live/fxCompass';
import {
  NEARBY_RADII,
  NEARBY_RADIUS_COLORS,
  RADAR_SPARSE_FLOOR,
  buildRadar,
  formatDistance,
  geoSearchBeamUrl,
  globalRadar,
  mergeRadarLegs,
  offsetPoint,
  parseGeoSearchPages,
  radarBeams,
  radiusByKey,
  type RadarRawHit,
} from '@/lib/live/omniRadar';
import { readGeoIpFix } from '@/lib/live/geoIp';
// REV-42 D-3 / D-6 / D-7: the three flagship engines. Only the type and the
// one factory are imported from the almanac (lane A); the cosmos and
// gastronomy modules import this module's TYPES back (erased at runtime),
// so there is no evaluation-time cycle.
import { moonPhaseWidgetFor, type MoonPhaseWidget } from '@/lib/live/skyAlmanac';
import { buildCosmosCard, type CosmosScopeWidget } from '@/lib/live/cosmos';
import { buildGastronomyCard } from '@/lib/live/gastronomy';

/** REV-42 §3: the two flagship widget types travel with the card contract,
 *  so a consumer of `SlotWidget` never has to know which module owns them. */
export type { MoonPhaseWidget, CosmosScopeWidget };

/** The fx base lives with the compass maths now (REV-41 D-3); re-exported
 *  so every pre-REV-41 importer of this module keeps compiling. */
export { FX_BASE };

/** Auto-rotation cadence of the discovery rail (ms). Lived in hubThemes.ts
 *  until REV-23 M3.1 deleted that module with the news wires it served. */
export const DISCOVERY_ROTATE_MS = 7000;

/* ------------------------------------------------------------------ */
/* Contract                                                             */
/* ------------------------------------------------------------------ */

/** Two kinds. REV-23 M3.1 retired `news`; REV-35 M1 swapped the two
 *  `ranking` widgets for one `uRanking` kind; REV-41 D-7 (founder directive
 *  2026-09-17, 1-F) retired that in turn -- the rail carries data and
 *  utility, the leaderboard belongs to U-Square. */
export type SlotKind = 'weather' | 'feed';

export type FeedSlotKey =
  | 'awards'
  | 'newProducts'
  | 'history'
  | 'quake'
  | 'mostRead'
  | 'fx'
  | 'crypto'
  | 'devPulse'
  | 'paper'
  | 'library'
  | 'art'
  | 'nation'
  | 'nearby'
  // REV-42 D-1: the two flagships that took the retired `air` seat's place
  // at the head of the rotation.
  | 'cosmos'
  | 'gastronomy';

export type SlotKey = 'weather' | FeedSlotKey;

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

/** An item without a `url` opens the slot's deep modal (REV-21 §1.3);
 *  REV-41 D-7 deleted the in-app `action` field with the only item kind
 *  that ever carried one (the U-Ranking entry). */
export interface SlotItem {
  id: string;
  title: string;
  domain?: string;
  url?: string;
  /** Short secondary line (points, distance, price...). */
  meta?: string;
  /** REV-29 M3: a one-line description under the title (product intro). */
  description?: string;
  /** REV-29 M3: a small thumbnail (product photo) beside the title. */
  image?: string;
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
 *  so outbound links and omni-open never re-search a translated title. */
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

/* ---- REV-41 D-8: typed widgets a card may carry beside its rows ------ */

/** REV-41 D-5: the 1000-codex lens on a radar hit -- a nomad meetup spot,
 *  an AI-factory workspace, an inspiration hideout, or a plain signal. */
export type RadarLens = 'nomad' | 'factory' | 'inspiration' | 'signal';

export interface RadarBlip {
  id: string;
  title: string;
  url?: string;
  /** Haversine from the visitor's point -- never the API's own figure. */
  distKm: number;
  /** Degrees clockwise from north, [0, 360). */
  bearing: number;
  lens: RadarLens;
}

export type NearbyRadiusKey = 'r10' | 'r50' | 'r100' | 'global';

export interface OmniRadarWidget {
  kind: 'omniRadar';
  radiusKey: NearbyRadiusKey;
  /** `null` = the global constellation. */
  radiusKm: number | null;
  center: { lat: number; lon: number; name: string };
  /** Nearest first, every one inside `radiusKm` (lib/live/omniRadar.ts). */
  blips: RadarBlip[];
  /** Sweep beams requested / that failed -- `blips.length === 0 &&
   *  failedBeams === beams` is the widget's honest "unreadable". */
  beams: number;
  failedBeams: number;
}

export interface FxSeriesPoint {
  date: string;
  rate: number;
}

/** One quote against the base, with its window. `change24h` is the signed
 *  percentage move against the previous PUBLISHED row (ECB data has no
 *  weekend rows), `change30d` against the first row of the window; either
 *  is null when the window is too short to measure it. */
export interface FxPairQuote {
  code: string;
  rate: number;
  change24h: number | null;
  change30d: number | null;
  series: FxSeriesPoint[];
}

export interface FxParityRow {
  id: string;
  symbol: string;
  name: string;
  usd: number;
  /** Priced in the home currency; null when CoinGecko does not quote it. */
  home: number | null;
  change24h: number | null;
}

export interface FxCompassWidget {
  kind: 'fxCompass';
  base: string;
  /** The hero pair's quote currency (lib/live/fxCompass.ts pickHomeCurrency). */
  home: string;
  /** Newest ECB publishing date in the window. */
  date: string;
  hero: FxPairQuote;
  majors: FxPairQuote[];
  /** Geometric DXY-weighted approximation, first day of the window = 100. */
  dollarIndex: { value: number; series: FxSeriesPoint[] } | null;
  parity: FxParityRow[];
}

/** REV-42 D-3 / D-6: the moon-phase pixel (weather) and the cosmos scope
 *  (cosmos) join the two REV-41 widgets. */
export type SlotWidget = OmniRadarWidget | FxCompassWidget | MoonPhaseWidget | CosmosScopeWidget;

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
  /** REV-41 D-8: a typed widget the card renders above its rows (the fx
   *  compass hero, the omni-radar). Carried even on an empty card so the
   *  widget can tell "empty" from "unreadable". */
  widget?: SlotWidget;
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
  /** REV-41 D-2 (1-C): the card holds ONE piece of information and no item
   *  routes anywhere, so a tap anywhere on it opens the same deep modal.
   *  The carousel stamps `data-one-target="1"` and a container onClick. */
  oneTarget?: true;
  /** REV-41 D-6 (1-E): the card's sub-tabs advance on the rotation clock
   *  (SlotTabRail autoplay) -- only the launch wire wants this. */
  tabAutoplay?: true;
  /** REV-41 (integration fix): a slot whose sub-tabs are a FIXED set
   *  declares them here, so the rail never depends on a loaded card -- a
   *  tab pick that missed the cache used to unmount the chips for the
   *  whole fetch. Adapters still echo the same list on every card. */
  tabs?: readonly SlotTab[];
  /** `cursor` omitted/undefined = first page. */
  load(ctx: SlotContext, cursor?: DeepCursor): Promise<SlotCard>;
}

/** REV-41 D-2: every slot whose items carry no outbound URL -- the contract
 *  the carousel and the E2E sweep read; each listed slot object also sets
 *  `oneTarget: true` (discoverySlots.test pins the two in agreement). */
export const SLOT_ONE_TARGET: readonly SlotKey[] = ['weather', 'cosmos', 'gastronomy', 'fx', 'crypto', 'quake', 'paper', 'library', 'nation', 'nearby'];

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

/** The visitor's place for the place-anchored slots (`nation`, `nearby`,
 *  and REV-42's `cosmos` observer / `gastronomy` local beam): the weather
 *  slot's own cache first, so those slots cost zero
 *  extra geolocation; else (REV-41 D-4) the Geo-IP fix the session already
 *  resolved for `resolveCountry` -- the visitor's REAL point of access, city
 *  name and all, instead of the language's capital; else the locale
 *  default. All three pass through the SELECTED country filter (REV-21
 *  §2.1, SPEC §12.3 c) so a profile country is honoured over a stale
 *  search or a VPN exit. */
export function knownPlace(ctx: SlotContext): Place {
  const cached = readWeatherCache()?.place;
  if (cached) return resolveDeeperPlace(ctx, cached);
  const fix = readGeoIpFix();
  if (fix) {
    return resolveDeeperPlace(ctx, { name: fix.city || fix.country, countryCode: fix.country, lat: fix.lat, lon: fix.lon, approx: true });
  }
  return resolveDeeperPlace(ctx, null);
}

/* ------------------------------------------------------------------ */
/* Slot 0: weather                                                      */
/* ------------------------------------------------------------------ */

const weatherSlot: DiscoverySlot = {
  key: 'weather',
  kind: 'weather',
  icon: CloudSun,
  color: '#4a90d9',
  oneTarget: true,
  async load({ locale, signal }) {
    // REV-42 D-3: the moon is computed BEFORE the forecast is asked for and
    // rides on every outcome -- the empty card included -- because the
    // almanac needs no network: a visitor whose forecast cannot be read
    // still sees tonight's moon, the lunar date and the solar term. One
    // `Date.now()` per load (allowed in load(); never in render), handed
    // to the pure almanac with the device's UTC offset for the civil date.
    const nowMs = Date.now();
    const widget: MoonPhaseWidget = moonPhaseWidgetFor(nowMs, locale, -new Date(nowMs).getTimezoneOffset());
    const cached = readWeatherCache();
    const fresh = cached && nowMs - cached.at < 10 * 60 * 1000;
    const place = cached?.place ?? DEFAULT_PLACE[locale] ?? DEFAULT_PLACE.en;
    const forecast = fresh ? cached!.forecast : await fetchForecast(place, signal ?? new AbortController().signal).catch(() => null);
    if (!forecast) return { ...EMPTY_CARD, widget };
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
      updatedAt: fresh ? cached!.at : nowMs,
      cursor: null,
      widget,
    };
  },
};

/* ------------------------------------------------------------------ */
/* REV-42 D-6 / D-7: the two flagships after the sky                    */
/* ------------------------------------------------------------------ */

/**
 * Slot 1 -- 거시 우주 텔레메트리. A bundled catalogue of 24 deep-sky objects
 * ranged from the visitor's own point by the celestial engine: no request
 * on the card, none in the deep modal (`SLOT_SOURCES.cosmos` names Wikipedia
 * for the OUTBOUND links only). The one `Date.now()` per load is handed to
 * the pure builder so lib/live/cosmos.ts stays clock-free (1-A #14).
 */
const cosmosSlot: DiscoverySlot = {
  key: 'cosmos',
  kind: 'feed',
  icon: Telescope,
  color: '#8b5cf6',
  oneTarget: true,
  load: (ctx, cursor) => Promise.resolve(buildCosmosCard(ctx, cursor, Date.now())),
};

/**
 * Slot 2 -- 글로벌 미식·식문화. The card is a bundled catalogue (the trending
 * pick for this hour, no network); only the deep modal's "hidden local
 * eats" leg spends one Wikipedia geosearch beam, cached 24 h on the device
 * (`unitas.gastronomy.local.v1`). Same clock handover as the cosmos slot.
 */
const gastronomySlot: DiscoverySlot = {
  key: 'gastronomy',
  kind: 'feed',
  icon: UtensilsCrossed,
  color: '#f59e0b',
  oneTarget: true,
  load: (ctx, cursor) => buildGastronomyCard(ctx, cursor, Date.now()),
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
/* REV-29 M3: 글로벌 신상품                                             */
/* ------------------------------------------------------------------ */

/**
 * The products the world has just released -- one family a day on the
 * rotating card (cars / smartphones / mobility / gadgets / games), every
 * family as a tab inside the deep modal, each entry with a thumbnail, a
 * one-sentence intro and a link to the article in the visitor's own
 * language when that edition has it. English Wikipedia's launch-year
 * category trees, newest page first, 0원 -- see lib/live/newProducts.ts.
 */
/** REV-41: the family chips are a fixed set, one per family, declared on
 *  the slot so the rail is mounted before (and across) every load. */
const PRODUCT_TABS: readonly SlotTab[] = PRODUCT_FAMILIES.map((f) => ({ key: f.key, labelKey: `Rev29.newProducts.families.${f.key}`, color: f.color }));

const newProductsSlot: DiscoverySlot = {
  key: 'newProducts',
  kind: 'feed',
  icon: PackageOpen,
  color: '#0ea5e9',
  // REV-41 D-6 (1-E): the family chips rotate on the clock like the main
  // rail; the deep modal's chips do not (the rail owns that distinction).
  tabAutoplay: true,
  tabs: PRODUCT_TABS,
  async load({ locale, signal }, cursor) {
    const requested = typeof cursor?.tab === 'string' && isProductFamilyKey(cursor.tab) ? cursor.tab : undefined;
    const family = requested ? productFamily(requested) : familyOfDay(dayOfYear());
    const deep = cursor?.deep === 1 || cursor?.deep === '1';
    const tabs: SlotTab[] = [...PRODUCT_TABS];
    const roll = await loadProductRoll(family, wikiLangFor(locale), signal).catch(() => null);
    if (!roll || roll.entries.length === 0) return { ...EMPTY_CARD, updatedAt: Date.now(), tabs, activeTab: family.key };
    const cap = deep ? PRODUCT_DEEP_ITEMS : PRODUCT_CARD_ITEMS;
    return {
      facts: [
        // The family is the fact LABEL and the launch year the value, so the
        // card leads with "스마트폰 · 2026" rather than a generic header.
        { labelKey: `Rev29.newProducts.families.${family.key}`, value: String(roll.year), emphasis: true },
        { labelKey: 'Rev29.newProducts.facts.count', value: String(roll.entries.length) },
      ],
      items: roll.entries.slice(0, cap).map((e) => ({
        id: e.id,
        title: e.localTitle ?? e.title,
        description: e.description || undefined,
        meta: e.localTitle && e.localTitle !== e.title ? e.title : undefined,
        image: e.image,
        url: e.url,
        scope: 'global' as const,
      })),
      updatedAt: Date.now(),
      cursor: null,
      tabs,
      activeTab: family.key,
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
  oneTarget: true,
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

/** The pre-REV-41 board (kept for `fetchFxSeries` callers and the v2
 *  parser's tests); the compass reads `FX_MAJORS` + `DXY_BASKET` instead. */
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

/**
 * REV-41 D-3 -- the fx compass. ONE Frankfurter v2 window request carries
 * the majors, the DXY basket and the visitor's home currency for the last
 * 30 days, so the latest rate, the previous-day and 30-day moves, every
 * sparkline and the dollar-strength index come from a single body; one
 * fail-open CoinGecko call adds BTC / ETH / PAXG in USD and in the home
 * currency. The card's rows are the pairs themselves (the "0건" meta line
 * of the facts-only card is gone), the home pair being the country section
 * when it really is the visitor's own currency; the big figure is the
 * widget's job (D-8), so no fact is emphasised any more.
 */
const fxSlot: DiscoverySlot = {
  key: 'fx',
  kind: 'feed',
  icon: ArrowLeftRight,
  color: '#6b7a8f',
  oneTarget: true,
  async load({ signal, country, locale }) {
    const home = pickHomeCurrency(country, locale);
    // Own = the currency the visitor's country or language actually uses;
    // the EUR fallback for a USD visitor is a hero, not a "your country" row.
    const own = fxCountryQuote(country, FX_BASE) ?? fxCountryQuote(localeCountry(locale), FX_BASE);
    const quotes = Array.from(new Set<string>([...FX_MAJORS, ...DXY_BASKET.map((b) => b.code), home]));
    const [fxJson, cgJson] = await Promise.all([
      safeJson<unknown>(frankfurterWindowUrl(quotes, isoDaysAgo(FX_WINDOW_DAYS)), signal),
      safeJson<unknown>(coinGeckoPriceUrl(home), signal),
    ]);
    const window = parseFrankfurterWindow(fxJson, quotes);
    if (!window) return EMPTY_CARD;
    const quoteOf = (code: string): FxPairQuote | null => {
      const series = window.byQuote.get(code);
      return series && series.length > 0 ? pairQuoteFrom(code, series) : null;
    };
    const hero = quoteOf(home) ?? quoteOf('EUR');
    if (!hero) return EMPTY_CARD;
    const majors = FX_MAJORS.map(quoteOf).filter((q): q is FxPairQuote => q !== null);
    const parity = parityRowsFrom(cgJson, hero.code);
    const widget: FxCompassWidget = {
      kind: 'fxCompass',
      base: window.base,
      home: hero.code,
      date: window.date,
      hero,
      majors,
      dollarIndex: dollarIndexFrom(window.byQuote),
      parity,
    };
    const pairItem = (q: FxPairQuote, scope: SlotScope): SlotItem => ({
      id: `fx:${window.base}/${q.code}`,
      title: `${window.base}/${q.code} ${formatFxRate(q.rate)}`,
      meta: q.change24h === null ? undefined : formatSignedPct(q.change24h),
      scope,
    });
    const board = majors.filter((q) => q.code !== hero.code).map((q) => pairItem(q, 'global'));
    const heroItem = pairItem(hero, own === hero.code ? 'country' : 'global');
    const parityItems: SlotItem[] = parity.map((row) => ({
      id: `fx:parity:${row.id}`,
      title: `${row.symbol} ${formatMoney(row.usd, 'USD', locale)}`,
      meta: row.home === null ? undefined : formatMoney(row.home, hero.code, locale),
      scope: 'global' as const,
    }));
    return {
      facts: [
        { labelKey: 'Rev41.fx.facts.home', value: hero.code },
        { labelKey: 'Rev41.fx.facts.pairs', value: String(board.length + 1) },
      ],
      items: [heroItem, ...board, ...parityItems],
      updatedAt: Date.now(),
      cursor: null,
      widget,
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
  oneTarget: true,
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
  oneTarget: true,
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
  oneTarget: true,
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

// REV-42 D-1: the `air` adapter (Open-Meteo air-quality, REV-20) that lived
// here is retired outright; its reading is fused into the weather deep
// panel's air block (D-4, lib/live/weatherDeep.ts), where `Rev20.slots.facts
// .{aqi.*,aqiValue,pm25,pm10}` are still read.

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
  oneTarget: true,
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

/** Rows on the rotating card / in the deep modal (REV-41 D-5). */
const NEARBY_CARD_ITEMS = 6;
const NEARBY_DEEP_ITEMS = 24;

/**
 * REV-41 D-5 -- the omni-radar. The radius chip (`cursor.tab`, default
 * 10 km) picks a sweep of 10 km Wikipedia geosearch beams (the API's own
 * ceiling; every wider keyless source timed out or hallucinated when
 * measured -- SPEC §1-6), fetched in parallel on the locale wiki with the
 * short description and coordinate of every page. Each beam fails open on
 * its own; `buildRadar` then measures every hit from the visitor with the
 * haversine and drops anything past the radius, so the chip's promise and
 * the list can never disagree. The Global chip is the sixteen-hub nomad
 * constellation, ranged from the visitor with no network at all. An empty
 * card still carries the widget so the renderer can tell "nothing inside
 * this radius" (some beams answered) from "unreadable" (every beam failed).
 */
/** REV-41 D-5: the four radius chips, a fixed set declared on the slot so
 *  a radius pick that misses the cache never unmounts the rail. */
const NEARBY_TABS: readonly SlotTab[] = NEARBY_RADII.map((r) => ({ key: r.key, labelKey: `Rev41.nearby.radius.${r.key}`, color: NEARBY_RADIUS_COLORS[r.key] }));

const nearbySlot: DiscoverySlot = {
  key: 'nearby',
  kind: 'feed',
  icon: MapPinned,
  color: '#c05621',
  oneTarget: true,
  tabs: NEARBY_TABS,
  async load(ctx, cursor) {
    const { locale, signal } = ctx;
    const place = knownPlace(ctx);
    const lang = wikiLangFor(locale);
    const radius = radiusByKey(typeof cursor?.tab === 'string' ? cursor.tab : undefined);
    const deep = cursor?.deep === 1 || cursor?.deep === '1';
    const tabs: SlotTab[] = [...NEARBY_TABS];
    const center = { lat: place.lat, lon: place.lon, name: place.name };
    let blips: RadarBlip[];
    let beams = 0;
    let failedBeams = 0;
    if (radius.km === null) {
      blips = globalRadar(center);
    } else {
      const specs = radarBeams(radius.km);
      const sweep = async (wikiLang: string): Promise<{ raw: RadarRawHit[]; failed: number }> => {
        const settled = await Promise.allSettled(
          specs.map(async (spec): Promise<RadarRawHit[] | null> => {
            const point = spec.offsetKm === 0 ? center : offsetPoint(center.lat, center.lon, spec.bearing, spec.offsetKm);
            const json = await safeJson<unknown>(geoSearchBeamUrl(wikiLang, point, spec.limit), signal);
            return json === null ? null : parseGeoSearchPages(json, wikiLang);
          }),
        );
        const raw: RadarRawHit[] = [];
        let failed = 0;
        for (const beam of settled) {
          if (beam.status === 'fulfilled' && beam.value !== null) raw.push(...beam.value);
          else failed += 1;
        }
        return { raw, failed };
      };
      const local = await sweep(lang);
      beams = specs.length;
      failedBeams = local.failed;
      let raw = local.raw;
      blips = buildRadar(center, radius.km, raw);
      // Sparse-region relief (measured 2026-09-17: a ko reader on a Georgia
      // IP got ONE blip at 10 km from ko.wikipedia): a thin locale wiki is
      // topped up from English Wikipedia with the same beams -- only when
      // the network is demonstrably up (at least one local beam answered)
      // and the sweep came back under the floor, so a cut-off runner never
      // doubles its failures and a dense home city never pays the extra leg.
      // The beam count is reported honestly as the sum of both sweeps.
      if (lang !== 'en' && local.failed < specs.length && blips.length < RADAR_SPARSE_FLOOR) {
        const relief = await sweep('en');
        beams += specs.length;
        failedBeams += relief.failed;
        raw = mergeRadarLegs(raw, relief.raw);
        blips = buildRadar(center, radius.km, raw);
      }
    }
    const widget: OmniRadarWidget = { kind: 'omniRadar', radiusKey: radius.key, radiusKm: radius.km, center, blips, beams, failedBeams };
    if (blips.length === 0) return { ...EMPTY_CARD, updatedAt: Date.now(), cursor: null, tabs, activeTab: radius.key, widget };
    const items: SlotItem[] = blips.slice(0, deep ? NEARBY_DEEP_ITEMS : NEARBY_CARD_ITEMS).map((b) => ({
      id: b.id,
      title: b.title,
      url: b.url,
      meta: formatDistance(b.distKm, locale),
    }));
    return {
      facts: [
        // The radius fact reads "10km" for a tier; the Global chip has no
        // number, so its own label IS the fact (label-as-value, the weather
        // condition pattern) rather than an invented figure.
        radius.km === null
          ? { labelKey: 'Rev41.nearby.radius.global', value: '' }
          : { labelKey: 'Rev41.nearby.facts.radius', value: `${radius.km}km` },
        { labelKey: 'Rev41.nearby.facts.detected', value: String(blips.length) },
        { labelKey: 'Rev41.nearby.facts.nearest', value: formatDistance(blips[0].distKm, locale) },
        ...(beams > 0 ? [{ labelKey: 'Rev41.nearby.facts.beams', value: String(beams) }] : []),
      ],
      items,
      updatedAt: Date.now(),
      cursor: null,
      tabs,
      activeTab: radius.key,
      widget,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Registry + rotation order                                            */
/* ------------------------------------------------------------------ */

const feedSlots: readonly DiscoverySlot[] = [
  // REV-42 D-1: the two flagships register here; `airSlot` is gone.
  cosmosSlot,
  gastronomySlot,
  historySlot,
  quakeSlot,
  mostReadSlot,
  fxSlot,
  cryptoSlot,
  devPulseSlot,
  paperSlot,
  librarySlot,
  artSlot,
  nationSlot,
  nearbySlot,
];

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
  [weatherSlot, awardsSlot, newProductsSlot, ...feedSlots]
    .map(withScopeSections)
    .map((s): [SlotKey, DiscoverySlot] => [s.key, s]),
);

/** REV-20 §3.4/§3.5: weather first, then the 9 news + 12 feed themes
 *  interleaved so two slots of the same texture never sit back to back
 *  (colour-wheel adjacency is handled by the component, order here only
 *  guards content-kind adjacency). REV-23 M3.1: 24 slots -> 16, the nine
 *  news wires out and `awards` in. REV-29 M3: 16 -> 17, `newProducts` in.
 *  REV-35 M1 (D-1): 17 -> 16 -- `uRanking` took the world ranking's seat at
 *  index 12. REV-41 D-7: 16 -> 15 -- `uRanking` retired outright, `air`
 *  moves up into index 12 and nothing else shifts. REV-42 D-1 (founder
 *  directive 2026-09-18): 15 -> 16 -- `air` retired outright and the three
 *  flagships lead: the visitor's own sky (weather, with the moon), the
 *  deep-space telemetry (cosmos) and the world's table (gastronomy) at
 *  0 / 1 / 2; the REV-29 launch wire follows at 3 and the other twelve
 *  keep their relative order. */
export const DISCOVERY_ROTATION: readonly SlotKey[] = [
  'weather',
  'cosmos',
  'gastronomy',
  // REV-29 M3: the launch wire sits right after the flagships -- the first
  // wire slot, where the founder asked for maximum exposure.
  'newProducts',
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
  'library',
  'nearby',
];

/** REV-21 §3.2 / SPEC §12.4: the REAL engines behind each slot, by registry
 *  id -- the source-attribution row, the omni-open sources row and
 *  the privacy page all derive from lib/uai/sourceRegistry.ts, so the
 *  synthetic 'Google News · Bing News' label of the first cut is now two
 *  individually named sources. Static -- `load()` is untouched. */
export const SLOT_SOURCES: Record<SlotKey, readonly SourceId[]> = {
  weather: ['openMeteo'],
  awards: ['wikidata'],
  newProducts: ['wikipedia'],
  history: ['wikipedia'],
  quake: ['usgs'],
  mostRead: ['wikimediaPageviews'],
  // REV-41 D-3: the compass adds CoinGecko for the crypto parity rows.
  fx: ['frankfurter', 'coinGecko'],
  crypto: ['coinGecko'],
  devPulse: ['hackerNews'],
  paper: ['openAlex'],
  library: ['openLibrary'],
  art: ['theMet'],
  nation: ['worldBank'],
  nearby: ['wikipedia'],
  // REV-42 D-1: both catalogues are bundled and ranged locally; Wikipedia is
  // the OUTBOUND corpus (and gastronomy's one local-eats beam), so the meta
  // line names the local engine first (1-A #12: Rev42.<slot>.source).
  cosmos: ['wikipedia'],
  gastronomy: ['wikipedia'],
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
 *  anchor omni-open and the outbound wiki link use instead of the
 *  slot's translated title (which is how '공기' became a string search). */
export const SLOT_QID: Partial<Record<SlotKey, string>> = {
  weather: 'Q11663', // weather
  awards: 'Q618779', // award
  newProducts: 'Q2424752', // product
  quake: 'Q7944', // earthquake
  fx: 'Q8142', // currency
  crypto: 'Q13479982', // cryptocurrency
  devPulse: 'Q11660', // artificial intelligence -- the pulse's centre of gravity
  paper: 'Q13442814', // scholarly article
  library: 'Q571', // book
  art: 'Q838948', // work of art
  nation: 'Q6256', // country
  // REV-42 D-1: the `air` anchor (Q7391292) retired with its slot.
  cosmos: 'Q1', // universe
  gastronomy: 'Q2095', // food
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
  return 15 * 60 * 1000;
}
