'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Loader2,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search,
  Snowflake,
  Sun,
  Thermometer,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import { geoCache, geoCoordKey, geoQueryKey } from '@/lib/live/geoCache';
import {
  GEOCODE_COUNT,
  GPS_MATCH_KM,
  IP_MATCH_KM,
  MAX_CANDIDATES,
  WIKI_MATCH_KM,
  isLatinQuery,
  mergePlaces,
  nameVariants,
  nearestWithin,
  rankPlaces,
  sameCountry,
  stripEnglishTitle,
  type GeoPlace,
} from '@/lib/live/geoMatch';

/**
 * "실시간 날씨" tab (owner instruction 2026-09-03): live current conditions
 * + a 5-day outlook for a city, from Open-Meteo (keyless, CORS `*`, 0원).
 *
 * Global geo-matching (owner instruction 2026-09-04 round 8 -- every
 * visitor worldwide must land on their REAL region, country / state / city,
 * and same-named cities must split cleanly, e.g. LaGrange GA vs KY):
 *  - First paint: the last place looked at; with no history, the locale
 *    capital renders instantly while a keyless network-address lookup
 *    (GeoJS → ipwho.is) resolves the visitor's own region in the background
 *    and swaps it in, flagged as an estimate.
 *  - "내 위치": browser Geolocation → (denied / unavailable) network-address
 *    fallback → reverse geocode (country / state / city, in English for the
 *    gazetteer AND in the visitor's language for display) → re-resolved
 *    through the SAME forward pipeline the search box uses, restricted to
 *    the reverse-geocoded country and snapped to the nearest record.
 *  - City search: fans out over spelling variants ("LaGrange" / "La
 *    Grange"), 20 rows each, merged by GeoNames id, re-ranked exact-match →
 *    population -- so LaGrange, Georgia leads and every same-named sibling
 *    is listed with its own state + country. Non-Latin queries (라그레인지)
 *    bridge through the locale's Wikipedia search → English titles → the
 *    same gazetteer pipeline. Pure helpers live in lib/live/geoMatch.ts.
 *  - Intelligent Caching (owner instruction 2026-09-04 round 9): every
 *    resolved search and every "내 위치" resolution is parked in
 *    lib/live/geoCache.ts (memory + localStorage, LRU, versioned). The
 *    external round-trips are paid once per device; the second search of
 *    the same place renders in well under 100 ms with zero network -- the
 *    ⚡ line under the search box says so. Zero server cost by construction.
 */

type Condition =
  | 'clear'
  | 'partlyCloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'freezingRain'
  | 'snow'
  | 'showers'
  | 'thunderstorm'
  | 'hail';

type Place = GeoPlace;

interface Forecast {
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    wind: number;
    code: number;
    time: string;
  };
  daily: Array<{ date: string; code: number; max: number; min: number }>;
  timezone: string;
}

interface OpenMeteoResponse {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
}

interface GeocodeResponse {
  results?: Array<{
    id?: number;
    name?: string;
    country?: string;
    country_code?: string;
    admin1?: string;
    /** Open-Meteo/GeoNames feature class -- 'PCLI' = country itself,
     *  'ADM1' = first-order admin division (US state, etc.). Everything
     *  else is an ordinary populated place. */
    feature_code?: string;
    population?: number;
    latitude?: number;
    longitude?: number;
  }>;
}

const STORAGE_KEY = 'unitas.weather.v1';
const TTL_MS = 10 * 60 * 1000;

/** Locale -> its capital / largest city, so the tab is never empty. Country
 *  is the full name (not an ISO code) so the "국가 / 도시" title format
 *  (owner instruction 2026-09-03) reads correctly from first paint --
 *  the background localize effect below overwrites it with the visitor's
 *  own-language form shortly after mount, for non-en locales. */
const DEFAULT_PLACE: Record<string, Place> = {
  en: { name: 'New York', country: 'United States', countryCode: 'US', lat: 40.7128, lon: -74.006 },
  ko: { name: 'Seoul', country: 'South Korea', countryCode: 'KR', lat: 37.5665, lon: 126.978 },
  et: { name: 'Tallinn', country: 'Estonia', countryCode: 'EE', lat: 59.437, lon: 24.7536 },
  ja: { name: 'Tokyo', country: 'Japan', countryCode: 'JP', lat: 35.6762, lon: 139.6503 },
  zh: { name: 'Beijing', country: 'China', countryCode: 'CN', lat: 39.9042, lon: 116.4074 },
  es: { name: 'Madrid', country: 'Spain', countryCode: 'ES', lat: 40.4168, lon: -3.7038 },
  km: { name: 'Phnom Penh', country: 'Cambodia', countryCode: 'KH', lat: 11.5564, lon: 104.9282 },
  fr: { name: 'Paris', country: 'France', countryCode: 'FR', lat: 48.8566, lon: 2.3522 },
  de: { name: 'Berlin', country: 'Germany', countryCode: 'DE', lat: 52.52, lon: 13.405 },
  pt: { name: 'Lisbon', country: 'Portugal', countryCode: 'PT', lat: 38.7223, lon: -9.1393 },
  vi: { name: 'Hanoi', country: 'Vietnam', countryCode: 'VN', lat: 21.0278, lon: 105.8342 },
  id: { name: 'Jakarta', country: 'Indonesia', countryCode: 'ID', lat: -6.2088, lon: 106.8456 },
  ru: { name: 'Moscow', country: 'Russia', countryCode: 'RU', lat: 55.7558, lon: 37.6173 },
  hi: { name: 'New Delhi', country: 'India', countryCode: 'IN', lat: 28.6139, lon: 77.209 },
  it: { name: 'Rome', country: 'Italy', countryCode: 'IT', lat: 41.9028, lon: 12.4964 },
  tr: { name: 'Istanbul', country: 'Turkey', countryCode: 'TR', lat: 41.0082, lon: 28.9784 },
  th: { name: 'Bangkok', country: 'Thailand', countryCode: 'TH', lat: 13.7563, lon: 100.5018 },
  pl: { name: 'Warsaw', country: 'Poland', countryCode: 'PL', lat: 52.2297, lon: 21.0122 },
  nl: { name: 'Amsterdam', country: 'Netherlands', countryCode: 'NL', lat: 52.3676, lon: 4.9041 },
  tl: { name: 'Manila', country: 'Philippines', countryCode: 'PH', lat: 14.5995, lon: 120.9842 },
};

const CONDITION_ICON: Record<Condition, LucideIcon> = {
  clear: Sun,
  partlyCloudy: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  freezingRain: Snowflake,
  snow: CloudSnow,
  showers: CloudRain,
  thunderstorm: CloudLightning,
  hail: CloudHail,
};

/** WMO weather interpretation code -> condition bucket. */
function conditionOf(code: number): Condition {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partlyCloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code === 66 || code === 67) return 'freezingRain';
  if (code >= 61 && code <= 65) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code === 85 || code === 86) return 'snow';
  if (code === 95) return 'thunderstorm';
  if (code >= 96) return 'hail';
  return 'cloudy';
}

function readCache(): { place: Place; forecast: Forecast; at: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { place?: Place; forecast?: Forecast; at?: number };
    if (!parsed.place || !parsed.forecast || typeof parsed.at !== 'number') return null;
    return { place: parsed.place, forecast: parsed.forecast, at: parsed.at };
  } catch {
    return null;
  }
}

function writeCache(place: Place, forecast: Forecast) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ place, forecast, at: Date.now() }));
  } catch {
    // storage unavailable -- the tab simply refetches next time.
  }
}

/** A child signal that aborts on its own deadline OR when the parent does. */
function withTimeout(parent: AbortSignal, ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onParent = () => {
    clearTimeout(timer);
    controller.abort();
  };
  if (parent.aborted) onParent();
  else parent.addEventListener('abort', onParent, { once: true });
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return controller.signal;
}

async function fetchForecast(place: Place, signal: AbortSignal): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '5',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(String(res.status));
  const json = (await res.json()) as OpenMeteoResponse;
  const c = json.current ?? {};
  const d = json.daily ?? {};
  const days = (d.time ?? []).map((date, i) => ({
    date,
    code: d.weather_code?.[i] ?? 3,
    max: d.temperature_2m_max?.[i] ?? 0,
    min: d.temperature_2m_min?.[i] ?? 0,
  }));
  return {
    current: {
      temp: c.temperature_2m ?? 0,
      feelsLike: c.apparent_temperature ?? c.temperature_2m ?? 0,
      humidity: c.relative_humidity_2m ?? 0,
      wind: c.wind_speed_10m ?? 0,
      code: c.weather_code ?? 3,
      time: c.time ?? '',
    },
    daily: days,
    timezone: json.timezone ?? 'UTC',
  };
}

/* ------------------------------------------------------------------ */
/* Forward geocoding                                                    */
/* ------------------------------------------------------------------ */

async function geocodeOpenMeteo(name: string, locale: string, signal: AbortSignal, count: number): Promise<Place[]> {
  const params = new URLSearchParams({ name, count: String(count), language: locale, format: 'json' });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, { signal });
  const json = res.ok ? ((await res.json()) as GeocodeResponse) : {};
  return (json.results ?? [])
    .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number' && r.name)
    .map((r) => ({
      id: r.id,
      // Bare name only -- never baked into one string with admin1, so a
      // state-level "Georgia" (feature_code ADM1) never renders identically
      // to the country "Georgia" (PCLI): the UI disambiguates them with
      // admin1 + isState/isCountry instead (owner instruction 2026-09-03).
      name: r.name as string,
      admin1: r.admin1 && r.admin1 !== r.name ? r.admin1 : undefined,
      country: r.country,
      countryCode: r.country_code?.toUpperCase(),
      isState: r.feature_code === 'ADM1',
      isCountry: r.feature_code === 'PCLI',
      population: typeof r.population === 'number' ? r.population : undefined,
      lat: r.latitude as number,
      lon: r.longitude as number,
    }));
}

/** Every spelling variant, GEOCODE_COUNT rows each, merged by GeoNames id
 *  and re-ranked (exact match → population) -- the fix for LaGrange, GA
 *  never surfacing under `count=5` (see lib/live/geoMatch.ts header). */
async function geocodeLatin(name: string, locale: string, signal: AbortSignal): Promise<Place[]> {
  const variants = nameVariants(name);
  const lists = await Promise.all(
    variants.map((v) => geocodeOpenMeteo(v, locale, signal, GEOCODE_COUNT).catch(() => [] as Place[])),
  );
  return rankPlaces(mergePlaces(lists), name);
}

interface WikiSearchResponse {
  query?: {
    pages?: Array<{
      title?: string;
      langlinks?: Array<{ title?: string }>;
      coordinates?: Array<{ lat?: number; lon?: number; primary?: boolean }>;
      pageprops?: { wikibase_item?: string };
    }>;
  };
}

interface WikidataClaimsResponse {
  claims?: {
    P625?: Array<{ mainsnak?: { datavalue?: { value?: { latitude?: number; longitude?: number } } } }>;
  };
}

interface WikiGeoPage {
  title: string;
  en?: string;
  lat: number;
  lon: number;
}

/** Wikidata P625 (coordinate location) for one item -- keyless, CORS
 *  (`origin=*`), ~300 bytes. A missing P625 means the item is not a place. */
async function wikidataCoordinate(qid: string, signal: AbortSignal): Promise<{ lat: number; lon: number } | null> {
  try {
    const params = new URLSearchParams({ action: 'wbgetclaims', entity: qid, property: 'P625', format: 'json', origin: '*' });
    const res = await fetch(`https://www.wikidata.org/w/api.php?${params.toString()}`, { signal: withTimeout(signal, 5000) });
    if (!res.ok) return null;
    const json = (await res.json()) as WikidataClaimsResponse;
    const v = json.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    return typeof v?.latitude === 'number' && typeof v?.longitude === 'number' ? { lat: v.latitude, lon: v.longitude } : null;
  } catch {
    return null;
  }
}

/**
 * Open-Meteo's gazetteer only indexes Latin-script names ('Seoul' resolves,
 * '서울' / '라그레인지' return nothing), so a native-script query bridges
 * through the locale's own Wikipedia SEARCH (not an exact title -- "라그레인지"
 * alone is a disambiguation page, while the search returns "라그레인지
 * (조지아주)" / "(켄터키주)" / "(텍사스주)" / "(일리노이주)"). Measured
 * 2026-09-04: those ko stub articles carry an English interlanguage link
 * and a Wikidata item but NO local coordinate tag, and `lllimit` / `colimit`
 * cap the whole batch (not per page) -- so both are `max`, and any hit
 * without its own coordinate is completed from Wikidata P625. A hit whose
 * item has no P625 (a person, a chip, the disambiguation page itself) is
 * not a place and drops out. Every geo hit's English title is stripped to
 * its bare name, the unique spellings are geocoded once through the same
 * variant pipeline, and each article snaps to the gazetteer record nearest
 * its coordinate -- yielding proper localized city / state / country rows.
 * An article with no gazetteer twin still lands as its own coordinate +
 * native title.
 */
async function geocodeViaWikipedia(name: string, locale: string, signal: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: name,
    gsrlimit: '8',
    gsrnamespace: '0',
    prop: 'coordinates|langlinks|pageprops',
    lllang: 'en',
    lllimit: 'max',
    coprimary: 'all',
    colimit: 'max',
    ppprop: 'wikibase_item',
    redirects: '1',
    format: 'json',
    formatversion: '2',
    origin: '*',
  });
  const res = await fetch(`https://${wikiLangFor(locale)}.wikipedia.org/w/api.php?${params.toString()}`, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as WikiSearchResponse;
  const resolved = await Promise.all(
    (json.query?.pages ?? []).map(async (p): Promise<WikiGeoPage | null> => {
      if (!p.title) return null;
      const coords = p.coordinates ?? [];
      const primary = coords.find((c) => c.primary) ?? coords[0];
      const en = p.langlinks?.[0]?.title;
      if (primary && typeof primary.lat === 'number' && typeof primary.lon === 'number') {
        return { title: p.title, en, lat: primary.lat, lon: primary.lon };
      }
      const qid = p.pageprops?.wikibase_item;
      if (!qid) return null;
      const fromWikidata = await wikidataCoordinate(qid, signal);
      return fromWikidata ? { title: p.title, en, lat: fromWikidata.lat, lon: fromWikidata.lon } : null;
    }),
  );
  const pages = resolved.filter((p): p is WikiGeoPage => p !== null);
  if (pages.length === 0) return [];

  const spellings = new Set<string>();
  for (const p of pages) {
    if (!p.en) continue;
    for (const v of nameVariants(stripEnglishTitle(p.en))) {
      if (spellings.size < 4) spellings.add(v);
    }
  }
  const lists = await Promise.all(
    Array.from(spellings).map((v) => geocodeOpenMeteo(v, locale, signal, GEOCODE_COUNT).catch(() => [] as Place[])),
  );
  const pool = mergePlaces(lists);

  return mergePlaces([
    pages.map((p) => nearestWithin(pool, p.lat, p.lon, WIKI_MATCH_KM) ?? { name: p.title, lat: p.lat, lon: p.lon }),
  ]);
}

interface GeocodeResult {
  places: Place[];
  /** Served from the device cache -- no network round-trip was made. */
  instant: boolean;
}

async function geocode(name: string, locale: string, signal: AbortSignal): Promise<GeocodeResult> {
  const key = geoQueryKey(locale, name);
  const cached = geoCache.get(key);
  if (cached) return { places: cached, instant: true };

  let places: Place[];
  if (isLatinQuery(name)) {
    places = await geocodeLatin(name, locale, signal);
  } else {
    // Some non-Latin alternate names do resolve directly (Cyrillic etc.) --
    // try the gazetteer first, bridge through Wikipedia only on a miss.
    const direct = await geocodeOpenMeteo(name, locale, signal, GEOCODE_COUNT).catch(() => [] as Place[]);
    places = direct.length > 0 ? rankPlaces(direct, name) : await geocodeViaWikipedia(name, locale, signal);
  }
  geoCache.set(key, places); // no-op for an empty list -- a miss stays retryable
  return { places, instant: false };
}

/* ------------------------------------------------------------------ */
/* Reverse geocoding + network-address positioning                     */
/* ------------------------------------------------------------------ */

interface ReverseLabel {
  name: string;
  admin1?: string;
  country?: string;
  countryCode?: string;
}

/** Best-effort reverse label (keyless, CORS). City / state / country come
 *  back as separate fields (never baked into one string) so the "국가 /
 *  도시(주)" title format renders identically to a searched place. */
async function reverseLabel(lat: number, lon: number, lang: string, signal: AbortSignal): Promise<ReverseLabel | null> {
  try {
    const params = new URLSearchParams({ latitude: String(lat), longitude: String(lon), localityLanguage: lang });
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`, {
      signal: withTimeout(signal, 6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
      countryCode?: string;
    };
    const city = json.city || json.locality || json.principalSubdivision;
    if (!city) return null;
    const admin1 = json.principalSubdivision && json.principalSubdivision !== city ? json.principalSubdivision : undefined;
    return { name: city, admin1, country: json.countryName, countryCode: json.countryCode?.toUpperCase() };
  } catch {
    return null;
  }
}

interface IpFix {
  lat: number;
  lon: number;
}

/** Keyless, CORS-enabled network-address position: GeoJS first, ipwho.is
 *  as the fallback. City-centroid accuracy at best -- always flagged
 *  `approx` downstream. */
async function ipPosition(signal: AbortSignal): Promise<IpFix | null> {
  try {
    const res = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: withTimeout(signal, 4000) });
    if (res.ok) {
      const json = (await res.json()) as { latitude?: string | number; longitude?: string | number };
      const lat = Number(json.latitude);
      const lon = Number(json.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)) return { lat, lon };
    }
  } catch {
    // fall through to the second provider
  }
  try {
    const res = await fetch('https://ipwho.is/', { signal: withTimeout(signal, 4000) });
    if (res.ok) {
      const json = (await res.json()) as { success?: boolean; latitude?: number; longitude?: number };
      if (json.success !== false && typeof json.latitude === 'number' && typeof json.longitude === 'number') {
        return { lat: json.latitude, lon: json.longitude };
      }
    }
  } catch {
    // both providers unreachable
  }
  return null;
}

function browserPosition(): Promise<IpFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: Number(pos.coords.latitude.toFixed(4)), lon: Number(pos.coords.longitude.toFixed(4)) }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/**
 * Coordinates → the visitor's real place record. Reverse-geocodes in
 * English (what the gazetteer is keyed on) AND in the visitor's language
 * (display fallback), re-resolves the English city through the SAME
 * forward pipeline the search box uses, keeps only candidates inside the
 * reverse-geocoded country and snaps to the nearest one -- so a fix in
 * LaGrange, GA lands on "미국 / LaGrange (조지아)" and never on Kentucky.
 * The fix's own coordinates stay authoritative for the forecast.
 */
async function resolveCoords(
  lat: number,
  lon: number,
  locale: string,
  signal: AbortSignal,
  approx: boolean,
  fallbackName: string,
): Promise<Place> {
  // Intelligent Caching: a fix inside an already-resolved ~1 km cell needs
  // no reverse geocoding at all -- the parked record is re-stamped with the
  // exact coordinates and returned at once.
  const key = geoCoordKey(locale, lat, lon, approx);
  const cached = geoCache.get(key)?.[0];
  if (cached) return { ...cached, lat, lon, approx };

  const [local, english] = await Promise.all([
    reverseLabel(lat, lon, locale, signal),
    locale === 'en' ? Promise.resolve<ReverseLabel | null>(null) : reverseLabel(lat, lon, 'en', signal),
  ]);
  const keyed = english ?? local;
  if (keyed?.name) {
    try {
      const candidates = sameCountry(await geocodeLatin(keyed.name, locale, signal), keyed.countryCode);
      const best = nearestWithin(candidates, lat, lon, approx ? IP_MATCH_KM : GPS_MATCH_KM);
      if (best) {
        const place = { ...best, lat, lon, approx };
        geoCache.set(key, [place]);
        return place;
      }
    } catch {
      // fall through to the raw reverse label below
    }
  }
  const label = local ?? english;
  if (label) {
    const place = { name: label.name, admin1: label.admin1, country: label.country, countryCode: label.countryCode, lat, lon, approx };
    geoCache.set(key, [place]);
    return place;
  }
  // Nothing resolved (both reverse providers unreachable) -- never cached,
  // so the next attempt resolves properly once the network is back.
  return { name: fallbackName, lat, lon, approx };
}

/* ------------------------------------------------------------------ */

export function LiveWeatherPanel() {
  const t = useTranslations('Weather');
  const locale = useLocale();
  const { playHoverSfx } = useSpatialAudio();

  const [place, setPlace] = useState<Place>(() => DEFAULT_PLACE[locale] ?? DEFAULT_PLACE.en);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [candidates, setCandidates] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  /** The last city search was answered from the device cache (⚡ line). */
  const [instant, setInstant] = useState(false);
  const [locating, setLocating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const locateAbortRef = useRef<AbortController | null>(null);
  /** Once the visitor searched or located explicitly, the background
   *  network-address auto-detect must never override their choice. */
  const interactedRef = useRef(false);

  const load = useCallback(
    async (target: Place, force = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!force) {
        const cached = readCache();
        if (
          cached &&
          Date.now() - cached.at < TTL_MS &&
          Math.abs(cached.place.lat - target.lat) < 1e-4 &&
          Math.abs(cached.place.lon - target.lon) < 1e-4
        ) {
          setPlace(cached.place);
          setForecast(cached.forecast);
          setFetchedAt(cached.at);
          setError(null);
          return;
        }
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchForecast(target, controller.signal);
        if (controller.signal.aborted) return;
        setPlace(target);
        setForecast(data);
        setFetchedAt(Date.now());
        writeCache(target, data);
      } catch {
        if (!controller.signal.aborted) setError(t('error'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [t],
  );

  // First paint: the last place the visitor looked at, else the locale
  // capital immediately -- and, with no history at all, the visitor's own
  // region from their network address swapped in as soon as it resolves.
  useEffect(() => {
    const cached = readCache();
    const initial = cached?.place ?? DEFAULT_PLACE[locale] ?? DEFAULT_PLACE.en;
    setPlace(initial);
    void load(initial);
    const background = new AbortController();
    if (!cached) {
      void (async () => {
        const fix = await ipPosition(background.signal);
        if (!fix || background.signal.aborted || interactedRef.current) return;
        const resolved = await resolveCoords(fix.lat, fix.lon, locale, background.signal, true, t('myLocation'));
        if (background.signal.aborted || interactedRef.current) return;
        void load(resolved, true);
      })();
      // Localize the capital's label ('Seoul' -> '서울특별시') in the
      // background; coordinates stay the hard-coded ones, so a gazetteer
      // miss changes nothing -- and the guard below leaves an already
      // auto-detected region untouched.
      if (locale !== 'en') {
        geocodeOpenMeteo(initial.name, locale, background.signal, 1)
          .then((list) => {
            const hit = list[0];
            if (!hit || Math.abs(hit.lat - initial.lat) > 1.5 || Math.abs(hit.lon - initial.lon) > 1.5) return;
            setPlace((p) =>
              p.lat === initial.lat && p.lon === initial.lon
                ? { ...p, name: hit.name, country: hit.country ?? p.country, admin1: hit.admin1 }
                : p,
            );
          })
          .catch(() => {
            // label stays English -- purely cosmetic.
          });
      }
    }
    return () => {
      abortRef.current?.abort();
      locateAbortRef.current?.abort();
      background.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCitySearch() {
    const q = cityQuery.trim();
    if (!q) return;
    interactedRef.current = true;
    // Instant path: a cached query is answered synchronously inside the click
    // task itself -- no await, no "searching" spinner frame, one React commit
    // -- so the list is on screen before the next paint (<100 ms even on a
    // low-spec device). Zero network, zero server, zero burn.
    const cachedHit = geoCache.get(geoQueryKey(locale, q));
    if (cachedHit) {
      setError(null);
      setCandidates(cachedHit.length > 1 ? cachedHit.slice(0, MAX_CANDIDATES) : []);
      setInstant(true);
      void load(cachedHit[0], true);
      return;
    }
    setSearching(true);
    setError(null);
    setInstant(false);
    setCandidates([]);
    const controller = new AbortController();
    try {
      const { places: list, instant: fromCache } = await geocode(q, locale, controller.signal);
      if (list.length === 0) {
        setError(t('noCity'));
        return;
      }
      // The top-ranked match loads at once; every same-named sibling stays
      // listed (own state + country) so the visitor can switch in one tap.
      void load(list[0], true);
      setCandidates(list.length > 1 ? list.slice(0, MAX_CANDIDATES) : []);
      setInstant(fromCache);
    } catch {
      setError(t('error'));
    } finally {
      setSearching(false);
    }
  }

  function pickCandidate(p: Place) {
    interactedRef.current = true;
    setCandidates([]);
    setCityQuery('');
    void load(p, true);
  }

  async function locateMe() {
    interactedRef.current = true;
    locateAbortRef.current?.abort();
    const controller = new AbortController();
    locateAbortRef.current = controller;
    setLocating(true);
    setError(null);
    setInstant(false);
    setCandidates([]);

    let fix: (IpFix & { approx: boolean }) | null = await browserPosition()
      .then((p) => ({ ...p, approx: false }))
      .catch(() => null);
    if (!fix && !controller.signal.aborted) {
      const ip = await ipPosition(controller.signal);
      if (ip) fix = { ...ip, approx: true };
    }
    if (controller.signal.aborted) return;
    if (!fix) {
      setLocating(false);
      setError(t('locationDenied'));
      return;
    }
    const resolved = await resolveCoords(fix.lat, fix.lon, locale, controller.signal, fix.approx, t('myLocation'));
    if (controller.signal.aborted) return;
    setLocating(false);
    void load(resolved, true);
  }

  function onCityKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void runCitySearch();
    }
  }

  const cond = forecast ? conditionOf(forecast.current.code) : null;
  const CondIcon = cond ? CONDITION_ICON[cond] : Cloud;
  const dayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'numeric', day: 'numeric' });
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-full">
      {/* Place + controls row -- "국가 / 도시(주)" title format (owner
          instruction 2026-09-03), so a US state result ("Georgia") never
          reads identically to the country of the same name: the admin1
          qualifier and the country are both always visible. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[14px] font-bold text-white sm:text-[15px]">
          <MapPin size={14} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="truncate">
            {place.country && <span className="text-gray-400">{place.country} / </span>}
            {place.name}
            {place.admin1 && <span className="text-gray-500">({place.admin1})</span>}
            {place.isState && <span className="ml-1.5 text-gray-600">· {t('stateBadge')}</span>}
            {place.isCountry && <span className="ml-1.5 text-gray-600">· {t('countryBadge')}</span>}
            {place.approx && <span className="ml-1.5 text-gray-600">· ≈ {t('approx')}</span>}
          </span>
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => void locateMe()}
            disabled={locating}
            title={t('myLocation')}
            aria-label={t('myLocation')}
            className="flex h-8 items-center gap-1.5 border border-accent/40 px-2.5 text-[11px] font-bold uppercase tracking-widest text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {locating ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <LocateFixed size={12} aria-hidden="true" />}
            <span className="hidden sm:inline">{locating ? t('detecting') : t('myLocation')}</span>
          </button>
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => void load(place, true)}
            disabled={loading}
            title={t('refresh')}
            aria-label={t('refresh')}
            className="flex h-8 w-8 items-center justify-center border border-accent/40 text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* City search -- mousedown must reach the input (the dropdown and
          strip wrappers swallow mousedown to protect the search bar's
          focus), so it stops propagation and takes focus itself; the bar's
          root-level blur logic keeps the popup open while focus is here. */}
      <div className="relative mb-3">
        <div className="flex items-center gap-2 border border-white/15 bg-void/50 px-3 py-2">
          <Search size={14} className="shrink-0 text-gray-500" aria-hidden="true" />
          <input
            type="text"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            onKeyDown={onCityKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="w-full bg-transparent text-[14px] text-white placeholder:text-gray-500 focus:outline-none"
          />
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={() => void runCitySearch()}
            disabled={searching || !cityQuery.trim()}
            className="shrink-0 border border-white/20 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-gray-300 transition-colors hover:border-white/40 hover:text-white disabled:opacity-40"
          >
            {searching ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : t('search')}
          </button>
        </div>
        {candidates.length > 1 && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 border border-white/15 bg-quantum shadow-xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
              <p className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-widest text-accent/80">
                {t('pickRegion')}
              </p>
              <button
                type="button"
                onMouseEnter={() => playHoverSfx()}
                onClick={() => setCandidates([])}
                aria-label={t('dismiss')}
                title={t('dismiss')}
                className="flex h-6 w-6 shrink-0 items-center justify-center border border-white/15 text-gray-400 transition-colors hover:border-accent/50 hover:text-accent"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
            <ul className="max-h-72 overflow-y-auto">
              {candidates.map((p) => (
                <li key={p.id ?? `${p.lat},${p.lon}`}>
                  <button
                    type="button"
                    onMouseEnter={() => playHoverSfx()}
                    onClick={() => pickCandidate(p)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-gray-200 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <MapPin size={12} className="shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      {p.name}
                      {p.admin1 && <span className="text-gray-500"> ({p.admin1})</span>}
                    </span>
                    {p.country && <span className="shrink-0 text-gray-500">· {p.country}</span>}
                    {p.isState && (
                      <span className="shrink-0 border border-amber-400/40 px-1 text-[10px] font-bold uppercase text-amber-300">
                        {t('stateBadge')}
                      </span>
                    )}
                    {p.isCountry && (
                      <span className="shrink-0 border border-accent/40 px-1 text-[10px] font-bold uppercase text-accent">
                        {t('countryBadge')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {instant && (
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-accent/80" aria-live="polite">
          <Zap size={11} aria-hidden="true" />
          {t('instant')}
        </p>
      )}

      {error && <p className="mb-3 text-[12px] font-bold text-amber-300">{error}</p>}

      {loading && !forecast && (
        <p className="flex items-center gap-2 py-4 text-[13px] text-gray-400">
          <Loader2 size={14} className="animate-spin text-accent" aria-hidden="true" />
          {t('loading')}
        </p>
      )}

      {forecast && cond && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
          {/* Current */}
          <div className="flex items-center gap-4 border border-white/10 bg-void/50 px-4 py-4">
            <CondIcon size={52} className="shrink-0 text-accent" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-3xl font-bold leading-none text-white sm:text-4xl">
                {Math.round(forecast.current.temp)}°
              </p>
              <p className="mt-1 text-[13px] font-bold text-gray-200">{t(`condition.${cond}`)}</p>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <Thermometer size={11} aria-hidden="true" />
                  {t('feelsLike')} {Math.round(forecast.current.feelsLike)}°
                </span>
                <span className="flex items-center gap-1">
                  <Droplets size={11} aria-hidden="true" />
                  {t('humidity')} {Math.round(forecast.current.humidity)}%
                </span>
                <span className="flex items-center gap-1">
                  <Wind size={11} aria-hidden="true" />
                  {t('wind')} {Math.round(forecast.current.wind)} km/h
                </span>
              </p>
            </div>
          </div>

          {/* 5-day outlook */}
          <div className="border border-white/10 bg-void/50 px-3 py-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">{t('forecastLabel')}</p>
            <ul className="grid grid-cols-5 gap-1.5">
              {forecast.daily.map((d) => {
                const c = conditionOf(d.code);
                const Icon = CONDITION_ICON[c];
                return (
                  <li key={d.date} className="flex flex-col items-center gap-1 text-center" title={t(`condition.${c}`)}>
                    <span className="text-[10px] text-gray-400">{dayFormatter.format(new Date(`${d.date}T12:00:00`))}</span>
                    <Icon size={20} className="text-accent" aria-hidden="true" />
                    <span className="text-[12px] font-bold text-white">{Math.round(d.max)}°</span>
                    <span className="text-[11px] text-gray-500">{Math.round(d.min)}°</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {fetchedAt && (
        <p className="mt-2 text-[10px] text-gray-500">
          {t('updated')} {timeFormatter.format(new Date(fetchedAt))} · {t('source')}
        </p>
      )}
    </div>
  );
}
