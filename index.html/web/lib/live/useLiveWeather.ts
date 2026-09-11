'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Snowflake,
  Sun,
  type LucideIcon,
} from 'lucide-react';
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
 * REV-20 §3.3: pure extraction of LiveWeatherPanel.tsx's state/data layer
 * (place resolution, forecast fetch, geocoding, the device cache) into a
 * hook -- UI unchanged, zero new network paths. Two consumers share it now:
 * LiveWeatherPanel itself (unchanged JSX, now reading from this hook instead
 * of local state -- used inside the weather slot's deep modal, `slot:weather`)
 * and the weather adapter in lib/live/discoverySlots.ts (reads the SAME
 * 10-minute device cache this hook writes, so the carousel's slot-0 card
 * costs a network round-trip only on a genuine cache miss -- never a
 * duplicate of what LiveWeatherPanel already fetched).
 */

export type Condition =
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

export type Place = GeoPlace;

export interface Forecast {
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
    feature_code?: string;
    population?: number;
    latitude?: number;
    longitude?: number;
  }>;
}

export const WEATHER_STORAGE_KEY = 'unitas.weather.v1';
export const WEATHER_TTL_MS = 10 * 60 * 1000;

/** Locale -> its capital / largest city, so the tab is never empty. */
export const DEFAULT_PLACE: Record<string, Place> = {
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

export const CONDITION_ICON: Record<Condition, LucideIcon> = {
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
export function conditionOf(code: number): Condition {
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

export function readWeatherCache(): { place: Place; forecast: Forecast; at: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WEATHER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { place?: Place; forecast?: Forecast; at?: number };
    if (!parsed.place || !parsed.forecast || typeof parsed.at !== 'number') return null;
    return { place: parsed.place, forecast: parsed.forecast, at: parsed.at };
  } catch {
    return null;
  }
}

export function writeWeatherCache(place: Place, forecast: Forecast) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify({ place, forecast, at: Date.now() }));
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

export async function fetchForecast(place: Place, signal: AbortSignal): Promise<Forecast> {
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
 *  and re-ranked (exact match → population). */
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

/** Bridges non-Latin-script city queries through the locale's own Wikipedia
 *  SEARCH (see full history in the pre-REV-20 LiveWeatherPanel.tsx). */
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
    const direct = await geocodeOpenMeteo(name, locale, signal, GEOCODE_COUNT).catch(() => [] as Place[]);
    places = direct.length > 0 ? rankPlaces(direct, name) : await geocodeViaWikipedia(name, locale, signal);
  }
  geoCache.set(key, places);
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

async function resolveCoords(
  lat: number,
  lon: number,
  locale: string,
  signal: AbortSignal,
  approx: boolean,
  fallbackName: string,
): Promise<Place> {
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
  return { name: fallbackName, lat, lon, approx };
}

/* ------------------------------------------------------------------ */

export interface UseLiveWeatherOptions {
  /** i18n string for the "my location" label used as a last-resort place
   *  name; UI copy stays owned by the caller (LiveWeatherPanel) so this
   *  hook carries no next-intl dependency of its own. */
  myLocationLabel: string;
  errorLabel: string;
  noCityLabel: string;
  locationDeniedLabel: string;
}

export function useLiveWeather(locale: string, opts: UseLiveWeatherOptions) {
  const [place, setPlace] = useState<Place>(() => DEFAULT_PLACE[locale] ?? DEFAULT_PLACE.en);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [candidates, setCandidates] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [instant, setInstant] = useState(false);
  const [locating, setLocating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const locateAbortRef = useRef<AbortController | null>(null);
  const interactedRef = useRef(false);

  const load = useCallback(
    async (target: Place, force = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!force) {
        const cached = readWeatherCache();
        if (
          cached &&
          Date.now() - cached.at < WEATHER_TTL_MS &&
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
        writeWeatherCache(target, data);
      } catch {
        if (!controller.signal.aborted) setError(opts.errorLabel);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [opts.errorLabel],
  );

  useEffect(() => {
    const cached = readWeatherCache();
    const initial = cached?.place ?? DEFAULT_PLACE[locale] ?? DEFAULT_PLACE.en;
    setPlace(initial);
    void load(initial);
    const background = new AbortController();
    if (!cached) {
      void (async () => {
        const fix = await ipPosition(background.signal);
        if (!fix || background.signal.aborted || interactedRef.current) return;
        const resolved = await resolveCoords(fix.lat, fix.lon, locale, background.signal, true, opts.myLocationLabel);
        if (background.signal.aborted || interactedRef.current) return;
        void load(resolved, true);
      })();
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
        setError(opts.noCityLabel);
        return;
      }
      void load(list[0], true);
      setCandidates(list.length > 1 ? list.slice(0, MAX_CANDIDATES) : []);
      setInstant(fromCache);
    } catch {
      setError(opts.errorLabel);
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
      setError(opts.locationDeniedLabel);
      return;
    }
    const resolved = await resolveCoords(fix.lat, fix.lon, locale, controller.signal, fix.approx, opts.myLocationLabel);
    if (controller.signal.aborted) return;
    setLocating(false);
    void load(resolved, true);
  }

  return {
    place,
    forecast,
    fetchedAt,
    loading,
    error,
    cityQuery,
    setCityQuery,
    candidates,
    setCandidates,
    searching,
    instant,
    locating,
    load,
    runCitySearch,
    pickCandidate,
    locateMe,
  };
}
