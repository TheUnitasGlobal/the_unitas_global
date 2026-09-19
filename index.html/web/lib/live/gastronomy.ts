/**
 * REV-42 D-7 (founder directive 2026-09-18, mission 3) -- 글로벌 미식·식문화:
 * the world's table, ranged from the visitor's own hour.
 *
 * The card is a BUNDLED catalogue and spends no network at all: which dish
 * the world is eating right now is a function of the diner's local hour
 * (`mealSlotOf`) and the UTC day index (`trendingPick`), so the same visitor
 * sees the same plate for a whole day and a different one tomorrow -- a
 * rotation, never a "trend index" nobody measured (REV-40 4-state truth
 * contract, SPEC 1-A #9). The deep popup adds the visitor's country's two
 * traditional dishes (30 countries x 2, bundled) and ONE optional Wikipedia
 * geosearch beam -- the "hidden local eats" leg, 10 km around the diner,
 * filtered to documented food places, nearest first, cached 24 h on the
 * device (`unitas.gastronomy.local.v1`, SPEC 1-A #13). Beam failure and a
 * zero-hit beam are reported as `unreadable` / `empty`, never padded.
 *
 * Pure by construction except that one beam: no React, no clock read, no
 * randomness -- `nowMs` is handed in by the registry's `load()` (SPEC 1-A
 * #14) and every derived clock value flows from it. Tier 3
 * (components/home/detail/GastronomyDetail.tsx) reads the same catalogue:
 * the day's pick names its ingredient, and `FOOD_SCIENCE` carries the
 * photosynthetic pathway and the energy density behind the three sections.
 *
 * i18n convention (binding for the carousel, SPEC §4): this module cannot
 * translate, so translated names ride as VALUE-LESS facts (`labelKey` +
 * `value: ''`, the weather-condition pattern) and translated rows as
 * `i18n:<dotted path>` strings the carousel resolves with `t()`. Everything
 * else here is plain: distances, symbols, Wikipedia titles and country
 * display names (Intl.DisplayNames).
 *
 * The observer rule is a COPY of discoverySlots.knownPlace (weather cache ->
 * Geo-IP fix -> resolveDeeperPlace) because importing the registry at
 * runtime would be circular (the registry imports this module); only its
 * types are imported, and they are erased.
 */
import type { DeepCursor, SlotCard, SlotFact, SlotItem, SlotContext } from '@/lib/live/discoverySlots';
import { distanceKm, formatDistance, geoSearchBeamUrl, parseGeoSearchPages } from '@/lib/live/omniRadar';
import { browserStorage, readDeviceEntry, writeDeviceEntry, type StorageLike } from '@/lib/live/weatherDeep';
import { localeCountry } from '@/lib/live/slotContext';
import { readWeatherCache, type Place } from '@/lib/live/useLiveWeather';
import { readGeoIpFix } from '@/lib/live/geoIp';
import { resolveDeeperPlace } from '@/lib/uai/deeperAnchor';
import { wikiLangFor } from '@/lib/uai/liveSuggest';

/** A SlotItem string that starts with this prefix is a dotted message path
 *  the carousel resolves through `t()` (REV-42 i18n convention). */
export const I18N_ITEM_PREFIX = 'i18n:';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/* ------------------------------------------------------------------ */
/* Catalogue keys (SPEC §4-A -- the single key list content lanes share) */
/* ------------------------------------------------------------------ */

export type MealSlot = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';
export const MEAL_SLOTS: readonly MealSlot[] = ['morning', 'noon', 'afternoon', 'evening', 'night'];

export type FlavorKey = 'umami' | 'spicy' | 'sweet' | 'sour' | 'bitter' | 'smoky' | 'fresh' | 'rich' | 'fermented' | 'herbal';
export const FLAVOR_KEYS: readonly FlavorKey[] = ['umami', 'spicy', 'sweet', 'sour', 'bitter', 'smoky', 'fresh', 'rich', 'fermented', 'herbal'];

export type IngredientKey = 'rice' | 'wheat' | 'maize' | 'coffee' | 'cacao' | 'chili' | 'tomato' | 'cabbageFerment';

export type Pathway = 'c3' | 'c4' | 'cam';

export interface TrendingDish {
  /** `Rev42.gastronomy.trending.<key>.{name,why}` */
  key: string;
  /** English label for `SlotSubject.term` (outbound search anchor; never shown translated). */
  label: string;
  /** ISO 3166-1 alpha-2, upper-case -- the origin fact via Intl.DisplayNames. */
  originCc: string;
  /** The hours of the day this plate belongs to. */
  mealSlots: readonly MealSlot[];
  flavorKey: FlavorKey;
  /** The `FOOD_SCIENCE` row tier 3 opens on. */
  ingredientKey: IngredientKey;
}

/** The 24 plates of the day, exactly SPEC §4-A. */
export const TRENDING_POOL: readonly TrendingDish[] = [
  { key: 'bibimbap', label: 'Bibimbap', originCc: 'KR', mealSlots: ['noon', 'evening'], flavorKey: 'umami', ingredientKey: 'rice' },
  { key: 'kimchiJjigae', label: 'Kimchi jjigae', originCc: 'KR', mealSlots: ['noon', 'evening', 'night'], flavorKey: 'fermented', ingredientKey: 'cabbageFerment' },
  { key: 'tteokbokki', label: 'Tteokbokki', originCc: 'KR', mealSlots: ['afternoon', 'night'], flavorKey: 'spicy', ingredientKey: 'rice' },
  { key: 'ramen', label: 'Ramen', originCc: 'JP', mealSlots: ['noon', 'night'], flavorKey: 'umami', ingredientKey: 'wheat' },
  { key: 'sushi', label: 'Sushi', originCc: 'JP', mealSlots: ['noon', 'evening'], flavorKey: 'fresh', ingredientKey: 'rice' },
  { key: 'onigiri', label: 'Onigiri', originCc: 'JP', mealSlots: ['morning', 'afternoon'], flavorKey: 'fresh', ingredientKey: 'rice' },
  { key: 'dimSum', label: 'Dim sum', originCc: 'CN', mealSlots: ['morning', 'noon'], flavorKey: 'umami', ingredientKey: 'wheat' },
  { key: 'mapoTofu', label: 'Mapo tofu', originCc: 'CN', mealSlots: ['noon', 'evening'], flavorKey: 'spicy', ingredientKey: 'chili' },
  { key: 'pho', label: 'Pho', originCc: 'VN', mealSlots: ['morning', 'noon'], flavorKey: 'herbal', ingredientKey: 'rice' },
  { key: 'banhMi', label: 'Banh mi', originCc: 'VN', mealSlots: ['morning', 'noon'], flavorKey: 'fresh', ingredientKey: 'wheat' },
  { key: 'padThai', label: 'Pad thai', originCc: 'TH', mealSlots: ['noon', 'evening'], flavorKey: 'sweet', ingredientKey: 'rice' },
  { key: 'tomYum', label: 'Tom yum', originCc: 'TH', mealSlots: ['evening', 'night'], flavorKey: 'sour', ingredientKey: 'chili' },
  { key: 'nasiGoreng', label: 'Nasi goreng', originCc: 'ID', mealSlots: ['morning', 'noon'], flavorKey: 'smoky', ingredientKey: 'rice' },
  { key: 'tacosAlPastor', label: 'Tacos al pastor', originCc: 'MX', mealSlots: ['evening', 'night'], flavorKey: 'smoky', ingredientKey: 'maize' },
  { key: 'neapolitanPizza', label: 'Neapolitan pizza', originCc: 'IT', mealSlots: ['evening', 'night'], flavorKey: 'rich', ingredientKey: 'wheat' },
  { key: 'cacioEPepe', label: 'Cacio e pepe', originCc: 'IT', mealSlots: ['evening'], flavorKey: 'rich', ingredientKey: 'wheat' },
  { key: 'croissant', label: 'Croissant', originCc: 'FR', mealSlots: ['morning'], flavorKey: 'rich', ingredientKey: 'wheat' },
  { key: 'shakshuka', label: 'Shakshuka', originCc: 'TN', mealSlots: ['morning', 'noon'], flavorKey: 'sour', ingredientKey: 'tomato' },
  { key: 'avocadoToast', label: 'Avocado toast', originCc: 'AU', mealSlots: ['morning'], flavorKey: 'fresh', ingredientKey: 'wheat' },
  { key: 'flatWhite', label: 'Flat white', originCc: 'AU', mealSlots: ['morning', 'afternoon'], flavorKey: 'bitter', ingredientKey: 'coffee' },
  { key: 'pourOverCoffee', label: 'Pour-over coffee', originCc: 'ET', mealSlots: ['afternoon'], flavorKey: 'bitter', ingredientKey: 'coffee' },
  { key: 'darkChocolate', label: 'Dark chocolate', originCc: 'EC', mealSlots: ['afternoon'], flavorKey: 'bitter', ingredientKey: 'cacao' },
  { key: 'greekSalad', label: 'Greek salad', originCc: 'GR', mealSlots: ['noon', 'evening'], flavorKey: 'fresh', ingredientKey: 'tomato' },
  { key: 'birria', label: 'Birria', originCc: 'MX', mealSlots: ['noon', 'night'], flavorKey: 'rich', ingredientKey: 'chili' },
];

/** The ten global food-culture trends (`Rev42.gastronomy.trends.<key>`),
 *  rotated by the day index on the card (3) and the deep popup (10). */
export const FOOD_TRENDS: readonly string[] = [
  'fermentation',
  'plantForward',
  'hyperLocal',
  'zeroWaste',
  'koreanWave',
  'regenerative',
  'functionalDrinks',
  'fireCooking',
  'thirdWaveCoffee',
  'nightMarkets',
];

/** 30 countries x 2 traditional dishes (`Rev42.gastronomy.dishes.<cc>.<key>`):
 *  the twenty locale countries plus GB MX BR AR GR EG MA ET PE AU. */
export const COUNTRY_DISHES: Readonly<Record<string, readonly [string, string]>> = {
  KR: ['kimchi', 'samgyetang'],
  JP: ['okonomiyaki', 'tempura'],
  CN: ['pekingDuck', 'xiaolongbao'],
  US: ['hamburger', 'gumbo'],
  EE: ['mulgikapsad', 'kama'],
  ES: ['paella', 'gazpacho'],
  KH: ['fishAmok', 'numBanhChok'],
  FR: ['coqAuVin', 'ratatouille'],
  DE: ['sauerbraten', 'spaetzle'],
  PT: ['bacalhauABras', 'pastelDeNata'],
  VN: ['bunCha', 'banhXeo'],
  ID: ['rendang', 'satay'],
  RU: ['borscht', 'pelmeni'],
  IN: ['biryani', 'masalaDosa'],
  IT: ['risottoAllaMilanese', 'lasagna'],
  TR: ['kebap', 'baklava'],
  TH: ['greenCurry', 'somTam'],
  PL: ['pierogi', 'bigos'],
  NL: ['stamppot', 'stroopwafel'],
  PH: ['adobo', 'sinigang'],
  GB: ['fishAndChips', 'sundayRoast'],
  MX: ['moleNegro', 'pozole'],
  BR: ['feijoada', 'moqueca'],
  AR: ['asado', 'empanadas'],
  GR: ['moussaka', 'souvlaki'],
  EG: ['koshari', 'fulMedames'],
  MA: ['tagine', 'couscous'],
  ET: ['injera', 'doroWat'],
  PE: ['ceviche', 'lomoSaltado'],
  AU: ['meatPie', 'lamington'],
};

/** Country order of the catalogue -- the day-seeded global picks walk it. */
const DISH_COUNTRIES: readonly string[] = Object.keys(COUNTRY_DISHES);

export interface FoodScience {
  /** `Rev42.gastronomy.science.<key>.{ingredient,solar,chemistry,pairing}` */
  key: IngredientKey;
  /** Carbon-fixation pathway the crop runs (`Rev42.gastronomy.pathway.<pathway>`). */
  pathway: Pathway;
  /** Reference energy density, kcal per 100 g (SPEC §4-A; coffee = brewed
   *  cup, cacao = 70 % dark chocolate, cabbageFerment = kimchi). */
  kcalPer100g: number;
}

/** The eight ingredients tier 3 explains, exactly SPEC §4-A. */
export const FOOD_SCIENCE: readonly FoodScience[] = [
  { key: 'rice', pathway: 'c3', kcalPer100g: 130 },
  { key: 'wheat', pathway: 'c3', kcalPer100g: 265 },
  { key: 'maize', pathway: 'c4', kcalPer100g: 218 },
  { key: 'coffee', pathway: 'c3', kcalPer100g: 2 },
  { key: 'cacao', pathway: 'c3', kcalPer100g: 598 },
  { key: 'chili', pathway: 'c3', kcalPer100g: 40 },
  { key: 'tomato', pathway: 'c3', kcalPer100g: 18 },
  { key: 'cabbageFerment', pathway: 'c3', kcalPer100g: 15 },
];

/** The science row behind an ingredient key; undefined for a key the
 *  catalogue does not carry (the caller decides how honest to be). */
export function foodScienceOf(key: string): FoodScience | undefined {
  return FOOD_SCIENCE.find((row) => row.key === key);
}

/* ------------------------------------------------------------------ */
/* Sunlight behind a plate                                              */
/* ------------------------------------------------------------------ */

/** 1 kcal = 4.184 kJ (thermochemical calorie). */
export const KJ_PER_KCAL = 4.184;
/** Assumed daily irradiance on the crop: 1 kWh/m²/day = 3600 kJ/m²/day.
 *  A round global-average figure for a cloudy temperate field, chosen so
 *  the estimate reads as an order of magnitude, not a measurement. */
export const IRRADIANCE_KJ_PER_M2_DAY = 3600;
/** Assumed photosynthetic conversion efficiency, sunlight to stored energy
 *  in the harvested part: 1 % (field crops sit at roughly 0.5-2 %). */
export const PHOTOSYNTHETIC_EFFICIENCY = 0.01;

/**
 * How many square-metre-days of sunlight it takes to grow 100 g of a food
 * at `kcal` per 100 g, under the two stated assumptions:
 *   area·days = kcal x 4.184 kJ / (3600 kJ/m²/day x 0.01)
 * Rounded to one decimal; 130 kcal (rice) -> 15.1 m²·day. Both constants
 * are also spelled out in the visitor-facing note (`Rev42.gastronomy.energyNote`).
 */
export function sunAreaDays(kcal: number): number {
  if (!Number.isFinite(kcal) || kcal <= 0) return 0;
  const kj = kcal * KJ_PER_KCAL;
  return Math.round((kj / (IRRADIANCE_KJ_PER_M2_DAY * PHOTOSYNTHETIC_EFFICIENCY)) * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* The diner's hour                                                     */
/* ------------------------------------------------------------------ */

/**
 * The diner's local hour from UTC and longitude alone: solar time, one hour
 * per 15° of longitude east of Greenwich. This is an APPROXIMATION of the
 * civil clock -- it ignores political time zones and summer time, so it can
 * sit up to ~1-2 h off the wall clock at a zone's edge -- but it needs no
 * timezone database, works for any point on Earth from the same inputs the
 * observer already carries, and "which meal is it" tolerates that error.
 * (The tier-3 component, which runs in the browser, uses the device clock.)
 */
export function localHourAt(nowMs: number, lonDeg: number): number {
  const lon = Number.isFinite(lonDeg) ? lonDeg : 0;
  return Math.floor((((nowMs / MS_PER_HOUR + lon / 15) % 24) + 24) % 24);
}

/** morning 5-10 / noon 10-14 / afternoon 14-17 / evening 17-21 / night 21-5
 *  (each bound belongs to the later slot; out-of-range hours wrap). */
export function mealSlotOf(localHour: number): MealSlot {
  const h = ((Math.floor(Number.isFinite(localHour) ? localHour : 0) % 24) + 24) % 24;
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 14) return 'noon';
  if (h >= 14 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/** Non-negative modulo for the day-seeded rotations. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * The plate of the day for a meal slot: the pool filtered to that slot,
 * then the UTC day index picks one by modulo -- deterministic for a whole
 * day, different tomorrow, the same for every diner in the same slot. An
 * empty filter (impossible with the shipped pool, but the catalogue is
 * data) falls back to the whole pool rather than to nothing.
 */
export function trendingPick(dayIndex: number, slot: MealSlot): TrendingDish {
  const inSlot = TRENDING_POOL.filter((d) => d.mealSlots.includes(slot));
  const pool = inSlot.length > 0 ? inSlot : TRENDING_POOL;
  const index = mod(Math.floor(Number.isFinite(dayIndex) ? dayIndex : 0), pool.length);
  return pool[index];
}

/** The first `count` trends starting at the day's offset, wrapping. */
export function trendsForDay(dayIndex: number, count: number): string[] {
  const n = FOOD_TRENDS.length;
  const start = mod(Math.floor(Number.isFinite(dayIndex) ? dayIndex : 0), n);
  const take = Math.max(0, Math.min(count, n));
  const out: string[] = [];
  for (let i = 0; i < take; i += 1) out.push(FOOD_TRENDS[(start + i) % n]);
  return out;
}

export interface CountryDishes {
  cc: string;
  keys: readonly [string, string];
}

/**
 * Which country's traditional dishes the deep popup shows: the visitor's
 * SELECTED country when the catalogue covers it, else the country the locale
 * implies (lib/live/slotContext.localeCountry), else null -- and null means
 * the caller falls back to `globalDishPicks`, never to an invented entry.
 */
export function dishesFor(country: string | null | undefined, locale: string): CountryDishes | null {
  const selected = (country ?? '').trim().toUpperCase();
  if (selected && COUNTRY_DISHES[selected]) return { cc: selected, keys: COUNTRY_DISHES[selected] };
  const implied = localeCountry(locale).toUpperCase();
  if (COUNTRY_DISHES[implied]) return { cc: implied, keys: COUNTRY_DISHES[implied] };
  return null;
}

/** Three (country, dish) pairs from three DIFFERENT countries, seeded by the
 *  day: the catalogue is walked at thirds so the trio always spans it. */
export function globalDishPicks(dayIndex: number): Array<{ cc: string; key: string }> {
  const n = DISH_COUNTRIES.length;
  const day = Math.floor(Number.isFinite(dayIndex) ? dayIndex : 0);
  const step = Math.floor(n / 3);
  const out: Array<{ cc: string; key: string }> = [];
  for (let k = 0; k < 3; k += 1) {
    const cc = DISH_COUNTRIES[mod(day + k * step, n)];
    const keys = COUNTRY_DISHES[cc];
    out.push({ cc, key: keys[mod(day + k, 2)] });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Hidden local eats (the one Wikipedia beam)                           */
/* ------------------------------------------------------------------ */

/** Latin / spaced-script words: matched at a word START (so "supermarket"
 *  does not become a market and "Turgenev" is not an Estonian market, while
 *  inflections like "ресторана" / "restaurantes" still hit). */
const FOOD_WORDS_BOUNDED: readonly string[] = [
  // en
  'market', 'restaurant', 'food', 'cuisine', 'café', 'cafe', 'coffee', 'bakery', 'street food', 'brewery', 'distillery', 'tea house', 'teahouse',
  'bistro', 'brasserie', 'diner', 'eatery', 'pizzeria', 'trattoria', 'osteria', 'ristorante', 'taverna', 'izakaya', 'sushi', 'ramen', 'winery',
  'vineyard', 'patisserie', 'pâtisserie', 'confectionery', 'delicatessen', 'steakhouse', 'noodle', 'dumpling', 'kitchen', 'canteen', 'gastropub',
  // es / pt
  'mercado', 'restaurante', 'taquería', 'taqueria', 'cantina', 'panadería', 'panaderia', 'padaria', 'churrascaria', 'marisquería', 'pastelería',
  'cervecería', 'cervejaria', 'bodega',
  // fr
  'marché', 'halles', 'boulangerie', 'fromagerie', 'bistrot', 'brûlerie',
  // de / nl / et
  'markt', 'bäckerei', 'brauerei', 'gasthaus', 'gasthof', 'weingut', 'konditorei', 'metzgerei', 'biergarten', 'bakkerij', 'brouwerij', 'koffiehuis',
  'turg', 'restoran', 'kohvik', 'pagar', 'söökla',
  // it
  'mercato', 'pasticceria', 'gelateria', 'enoteca', 'caffè',
  // pl / ru
  'restauracja', 'piekarnia', 'browar', 'cukiernia', 'bar mleczny', 'рынок', 'ресторан', 'кафе', 'пекарня', 'столовая', 'кофейня',
  // tr
  'pazar', 'çarşı', 'lokanta', 'fırın', 'kahvehane', 'kebap', 'kebab', 'meyhane',
  // id / tl / vi
  'pasar', 'warung', 'kedai', 'rumah makan', 'palengke', 'karinderya', 'kainan', 'nhà hàng', 'quán', 'chợ', 'cà phê', 'tiệm', 'bún', 'phở',
  // hi
  'बाज़ार', 'बाजार', 'ढाबा', 'रेस्तरां', 'भोजनालय', 'मंडी',
  // misc
  'bazar', 'bazaar', 'souk', 'souq',
];

/** Unspaced scripts (CJK, Thai, Khmer): matched anywhere in the text. */
const FOOD_WORDS_SUBSTRING: readonly string[] = [
  // ko
  '시장', '맛집', '식당', '카페', '제과', '양조', '빵집', '횟집', '국밥', '냉면', '면옥', '떡집', '주막', '전통주', '막걸리', '한정식', '요리', '먹자골목',
  // ja
  '市場', '料理', '食堂', '居酒屋', '寿司', 'ラーメン', '喫茶', 'カフェ', 'パン屋', '酒造', '醸造', '蕎麦', 'うどん', '割烹', '料亭', '焼肉',
  // zh
  '餐厅', '餐廳', '美食', '菜市场', '菜市場', '小吃', '茶楼', '茶樓', '茶馆', '茶館', '酒楼', '酒樓', '面馆', '麵館', '夜市', '烤鸭', '烤鴨', '火锅', '火鍋', '咖啡',
  // th
  'ตลาด', 'ร้านอาหาร', 'คาเฟ่', 'ร้านกาแฟ', 'ก๋วยเตี๋ยว',
  // km
  'ផ្សារ', 'ភោជនីយដ្ឋាន', 'ហាងកាហ្វេ',
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word START boundary, then at most two trailing letters (plural / case
 *  inflections: "restaurantes", "ресторана", "markets") before a non-letter
 *  or the end -- so "marketing", "Marktplatz" and "Turgenev" stay out. */
const FOOD_BOUNDED_RE = new RegExp(`(?:^|[^\\p{L}])(?:${FOOD_WORDS_BOUNDED.map(escapeRegExp).join('|')})\\p{L}{0,2}(?:[^\\p{L}]|$)`, 'iu');
const FOOD_SUBSTRING_LOWER = FOOD_WORDS_SUBSTRING.map((w) => w.toLowerCase());

/** Whether a Wikipedia hit (title + short description) is a documented
 *  FOOD place -- a market, restaurant, café, bakery, brewery... in any of
 *  the twenty locales' scripts. A museum, park, station or university with
 *  no food word is not one, so it is not claimed. */
export function isFoodPlace(title: string, description?: string | null): boolean {
  const haystack = `${title ?? ''} ${description ?? ''}`.toLowerCase();
  if (!haystack.trim()) return false;
  if (FOOD_BOUNDED_RE.test(haystack)) return true;
  return FOOD_SUBSTRING_LOWER.some((w) => haystack.includes(w));
}

export const GASTRO_LOCAL_STORAGE_KEY = 'unitas.gastronomy.local.v1';
export const GASTRO_LOCAL_VERSION = 'gl-v1';
export const GASTRO_LOCAL_TTL_MS = 24 * 60 * 60 * 1000;
/** One beam at the geosearch ceiling; the filter thins it to food places. */
export const GASTRO_BEAM_LIMIT = 50;
export const GASTRO_LOCAL_MAX_ITEMS = 6;
const GASTRO_BEAM_TIMEOUT_MS = 8000;

/** ~11 m cells (four decimals): the same diner asked twice shares one entry. */
export function gastroPlaceKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

export type LocalEatsState = 'data' | 'empty' | 'unreadable';

export interface LocalEats {
  items: SlotItem[];
  /** `data` = food places found; `empty` = the wiki answered with none in
   *  10 km; `unreadable` = the beam did not answer (never cached). */
  state: LocalEatsState;
}

export interface LocalEatsOptions {
  /** The load clock -- required for the 24 h cache to be consulted or
   *  written; without it the beam is simply asked (no clock, no TTL). */
  nowMs?: number;
  /** Defaults to the browser's localStorage (null on the server / blocked). */
  storage?: StorageLike | null;
}

interface LocalEatsRecord {
  state: Exclude<LocalEatsState, 'unreadable'>;
  items: SlotItem[];
}

/**
 * The hidden local eats around the diner: ONE Wikipedia geosearch beam
 * (10 km, the locale wiki, `generator=geosearch` with descriptions and
 * coordinates -- lib/live/omniRadar's URL and parser reused, no new API),
 * kept to documented food places, ranged by haversine from the diner
 * (never the API's own figure), nearest six. Cached 24 h per ~11 m cell
 * under `unitas.gastronomy.local.v1`; `unreadable` is never cached so the
 * next open retries. Never throws.
 */
export async function loadLocalEats(
  place: { lat: number; lon: number },
  locale: string,
  signal?: AbortSignal,
  options: LocalEatsOptions = {},
): Promise<LocalEats> {
  const lang = wikiLangFor(locale);
  const cacheKey = `${lang}:${gastroPlaceKey(place.lat, place.lon)}`;
  const nowMs = options.nowMs;
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  if (nowMs !== undefined) {
    const hit = readDeviceEntry<LocalEatsRecord>(storage, GASTRO_LOCAL_STORAGE_KEY, GASTRO_LOCAL_VERSION, cacheKey, GASTRO_LOCAL_TTL_MS, nowMs);
    if (hit && Array.isArray(hit.data?.items) && (hit.data.state === 'data' || hit.data.state === 'empty')) {
      return { items: hit.data.items, state: hit.data.state };
    }
  }

  let json: unknown;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GASTRO_BEAM_TIMEOUT_MS);
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    const res = await fetch(geoSearchBeamUrl(lang, { lat: place.lat, lon: place.lon }, GASTRO_BEAM_LIMIT), { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { items: [], state: 'unreadable' };
    json = await res.json();
  } catch {
    return { items: [], state: 'unreadable' };
  }
  if (!json || typeof json !== 'object') return { items: [], state: 'unreadable' };

  const items: SlotItem[] = parseGeoSearchPages(json, lang)
    .filter((hit) => isFoodPlace(hit.title, hit.description))
    .map((hit) => ({ hit, km: distanceKm(place.lat, place.lon, hit.lat, hit.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, GASTRO_LOCAL_MAX_ITEMS)
    .map(({ hit, km }) => ({
      id: `local:${hit.id.slice(hit.id.lastIndexOf(':') + 1)}`,
      title: hit.title,
      url: hit.url,
      meta: `${formatDistance(km, locale)} · Wikipedia`,
      scope: 'country' as const,
    }));
  const state: LocalEatsRecord['state'] = items.length > 0 ? 'data' : 'empty';
  if (nowMs !== undefined) {
    writeDeviceEntry<LocalEatsRecord>(storage, GASTRO_LOCAL_STORAGE_KEY, GASTRO_LOCAL_VERSION, cacheKey, { state, items }, nowMs);
  }
  return { items, state };
}

/* ------------------------------------------------------------------ */
/* Observer                                                             */
/* ------------------------------------------------------------------ */

/**
 * Where the diner is. A COPY of lib/live/discoverySlots.knownPlace (REV-41
 * D-4 three-step rule) because that module imports this one at runtime and
 * the reverse import would be a cycle:
 *  1. the place the visitor searched / located in the weather panel;
 *  2. the Geo-IP fix (their real city, flagged approximate);
 *  3. the selected country's capital, else the locale's default place
 *     (lib/uai/deeperAnchor.resolveDeeperPlace, which also keeps a cached
 *     place only when it sits inside the selected country).
 */
export function resolveObserver(ctx: Pick<SlotContext, 'locale' | 'country'>): Place {
  const cached = readWeatherCache()?.place;
  if (cached) return resolveDeeperPlace(ctx, cached);
  const fix = readGeoIpFix();
  if (fix) {
    return resolveDeeperPlace(ctx, { name: fix.city || fix.country, countryCode: fix.country, lat: fix.lat, lon: fix.lon, approx: true });
  }
  return resolveDeeperPlace(ctx, null);
}

/** The locale's display name for a country code, or the code itself when
 *  Intl cannot say (an unknown tag never breaks the card). */
export function regionName(locale: string, cc: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/* ------------------------------------------------------------------ */
/* The card                                                             */
/* ------------------------------------------------------------------ */

const CARD_TRENDS = 3;
const DEEP_TRENDS = 10;

/**
 * The gastronomy card (SPEC §3 contract, called by the registry with its
 * one clock read): four facts -- the plate of the day (emphasis), its
 * meal slot, its flavour, its origin -- and the day's trends (3 on the
 * card, 10 deep). With a deep cursor the country scope follows: the
 * visitor's traditional dishes (or three global picks when the catalogue
 * has no row for them) and then the local-eats beam, whose `empty` /
 * `unreadable` outcome is ONE honest marker row the popup translates
 * (`Rev42.gastronomy.sections.localEatsFallback`). Never throws; the
 * card without a cursor spends no network at all.
 */
export async function buildGastronomyCard(ctx: SlotContext, cursor: DeepCursor | undefined, nowMs: number): Promise<SlotCard> {
  const deep = cursor?.deep === 1 || cursor?.deep === '1';
  const dayIndex = Math.floor(nowMs / MS_PER_DAY);
  const observer = resolveObserver(ctx);
  const slot = mealSlotOf(localHourAt(nowMs, observer.lon));
  const pick = trendingPick(dayIndex, slot);

  const facts: SlotFact[] = [
    { labelKey: `Rev42.gastronomy.trending.${pick.key}.name`, value: '', emphasis: true },
    { labelKey: `Rev42.gastronomy.mealSlots.${slot}`, value: '' },
    { labelKey: `Rev42.gastronomy.flavors.${pick.flavorKey}`, value: '' },
    { labelKey: 'Rev42.gastronomy.facts.origin', value: regionName(ctx.locale, pick.originCc) },
  ];

  const items: SlotItem[] = trendsForDay(dayIndex, deep ? DEEP_TRENDS : CARD_TRENDS).map((key) => ({
    id: `trend:${key}`,
    title: `${I18N_ITEM_PREFIX}Rev42.gastronomy.trends.${key}.title`,
    description: `${I18N_ITEM_PREFIX}Rev42.gastronomy.trends.${key}.line`,
    meta: `${I18N_ITEM_PREFIX}Rev42.gastronomy.trendMeta`,
    scope: 'global',
  }));

  if (deep) {
    const own = dishesFor(ctx.country, ctx.locale);
    const dishes = own ? own.keys.map((key) => ({ cc: own.cc, key })) : globalDishPicks(dayIndex);
    for (const { cc, key } of dishes) {
      items.push({
        id: `dish:${cc}:${key}`,
        title: `${I18N_ITEM_PREFIX}Rev42.gastronomy.dishes.${cc}.${key}.name`,
        description: `${I18N_ITEM_PREFIX}Rev42.gastronomy.dishes.${cc}.${key}.origin`,
        meta: regionName(ctx.locale, cc),
        scope: 'country',
      });
    }
    const local = await loadLocalEats({ lat: observer.lat, lon: observer.lon }, ctx.locale, ctx.signal, { nowMs });
    if (local.state === 'data') items.push(...local.items);
    else items.push({ id: `local:${local.state}`, title: `${I18N_ITEM_PREFIX}Rev42.gastronomy.sections.localEatsFallback`, scope: 'country' });
  }

  return { facts, items, updatedAt: nowMs, cursor: null, subject: { term: pick.label } };
}
