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
  type LucideIcon,
} from 'lucide-react';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { wikiLangFor } from '@/lib/uai/liveSuggest';

/**
 * "실시간 날씨" tab (owner instruction 2026-09-03): live current conditions
 * + a 5-day outlook for a city, from Open-Meteo (keyless, CORS `*`, 0원).
 * Opens on the visitor's locale capital, offers one-tap "my location"
 * (browser geolocation, reverse-labelled best-effort) and a city search
 * (Open-Meteo geocoding, localized names). Last place + payload sit in
 * localStorage for 10 minutes so flicking tabs never refetches.
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

interface Place {
  name: string;
  country?: string;
  /** First-order administrative division (US state, etc.) -- kept separate
   *  from `name` so a state-level result ("Georgia", feature_code ADM1)
   *  never collides on-screen with the identically-named country. */
  admin1?: string;
  /** feature_code === 'ADM1' -- this result IS a state/province, not a city. */
  isState?: boolean;
  /** feature_code === 'PCLI' -- this result IS a whole country. */
  isCountry?: boolean;
  lat: number;
  lon: number;
}

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
    name?: string;
    country?: string;
    admin1?: string;
    /** Open-Meteo/GeoNames feature class -- 'PCLI' = country itself,
     *  'ADM1' = first-order admin division (US state, etc.). Everything
     *  else is an ordinary populated place. */
    feature_code?: string;
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
  en: { name: 'New York', country: 'United States', lat: 40.7128, lon: -74.006 },
  ko: { name: 'Seoul', country: 'South Korea', lat: 37.5665, lon: 126.978 },
  et: { name: 'Tallinn', country: 'Estonia', lat: 59.437, lon: 24.7536 },
  ja: { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  zh: { name: 'Beijing', country: 'China', lat: 39.9042, lon: 116.4074 },
  es: { name: 'Madrid', country: 'Spain', lat: 40.4168, lon: -3.7038 },
  km: { name: 'Phnom Penh', country: 'Cambodia', lat: 11.5564, lon: 104.9282 },
  fr: { name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
  de: { name: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 },
  pt: { name: 'Lisbon', country: 'Portugal', lat: 38.7223, lon: -9.1393 },
  vi: { name: 'Hanoi', country: 'Vietnam', lat: 21.0278, lon: 105.8342 },
  id: { name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lon: 106.8456 },
  ru: { name: 'Moscow', country: 'Russia', lat: 55.7558, lon: 37.6173 },
  hi: { name: 'New Delhi', country: 'India', lat: 28.6139, lon: 77.209 },
  it: { name: 'Rome', country: 'Italy', lat: 41.9028, lon: 12.4964 },
  tr: { name: 'Istanbul', country: 'Turkey', lat: 41.0082, lon: 28.9784 },
  th: { name: 'Bangkok', country: 'Thailand', lat: 13.7563, lon: 100.5018 },
  pl: { name: 'Warsaw', country: 'Poland', lat: 52.2297, lon: 21.0122 },
  nl: { name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lon: 4.9041 },
  tl: { name: 'Manila', country: 'Philippines', lat: 14.5995, lon: 120.9842 },
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

interface WikiCoordResponse {
  query?: {
    pages?: Array<{
      title?: string;
      langlinks?: Array<{ title?: string }>;
      coordinates?: Array<{ lat?: number; lon?: number; primary?: boolean }>;
    }>;
  };
}

async function geocodeOpenMeteo(name: string, locale: string, signal: AbortSignal, count: number): Promise<Place[]> {
  const params = new URLSearchParams({ name, count: String(count), language: locale, format: 'json' });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, { signal });
  const json = res.ok ? ((await res.json()) as GeocodeResponse) : {};
  return (json.results ?? [])
    .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number' && r.name)
    .map((r) => ({
      // Bare name only -- never baked into one string with admin1, so a
      // state-level "Georgia" (feature_code ADM1) never renders identically
      // to the country "Georgia" (PCLI): the UI disambiguates them with
      // admin1 + isState/isCountry instead (owner instruction 2026-09-03).
      name: r.name as string,
      admin1: r.admin1 && r.admin1 !== r.name ? r.admin1 : undefined,
      country: r.country,
      isState: r.feature_code === 'ADM1',
      isCountry: r.feature_code === 'PCLI',
      lat: r.latitude as number,
      lon: r.longitude as number,
    }));
}

/**
 * Open-Meteo's gazetteer only indexes Latin-script names ('Seoul' resolves,
 * '서울' / '東京' return nothing), so a native-script query falls through to
 * the locale's own Wikipedia: the article's English interlanguage title is
 * re-geocoded (→ proper city record, localized label), and failing that the
 * article's own primary coordinate is the city.
 */
async function geocodeViaWikipedia(name: string, locale: string, signal: AbortSignal, count: number): Promise<Place[]> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'coordinates|langlinks',
    lllang: 'en',
    lllimit: '1',
    coprimary: 'all',
    colimit: '5',
    titles: name,
    redirects: '1',
    format: 'json',
    formatversion: '2',
    origin: '*',
  });
  const res = await fetch(`https://${wikiLangFor(locale)}.wikipedia.org/w/api.php?${params.toString()}`, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as WikiCoordResponse;
  const page = json.query?.pages?.[0];
  if (!page?.title) return [];

  const en = page.langlinks?.[0]?.title;
  if (en) {
    // 'Tokyo Proper' / 'Paris (city)' -> also try the bare place name.
    const variants = Array.from(
      new Set([en, en.replace(/\s*\(.*\)\s*$/, ''), en.replace(/\s+(Proper|City|Metropolis|Municipality)\s*$/i, '')]),
    ).filter(Boolean);
    for (const v of variants) {
      const hit = await geocodeOpenMeteo(v, locale, signal, count);
      if (hit.length > 0) return hit;
    }
  }

  const coords = page.coordinates ?? [];
  const primary = coords.find((c) => c.primary) ?? coords[0];
  if (primary && typeof primary.lat === 'number' && typeof primary.lon === 'number') {
    return [{ name: page.title, lat: primary.lat, lon: primary.lon }];
  }
  return [];
}

async function geocode(name: string, locale: string, signal: AbortSignal, count = 5): Promise<Place[]> {
  const places = await geocodeOpenMeteo(name, locale, signal, count);
  if (places.length > 0 || /^[\x00-\x7F]*$/.test(name)) return places;
  return geocodeViaWikipedia(name, locale, signal, count);
}

interface ReverseLabel {
  name: string;
  admin1?: string;
  country?: string;
}

/** Best-effort reverse label for "my location" (keyless, CORS). Returns the
 *  city/state and country as separate fields (not baked into one string) so
 *  the "국가 / 도시(주)" title format renders identically to a searched
 *  place (owner instruction 2026-09-03). */
async function reverseLabel(lat: number, lon: number, locale: string, signal: AbortSignal): Promise<ReverseLabel | null> {
  try {
    const params = new URLSearchParams({ latitude: String(lat), longitude: String(lon), localityLanguage: locale });
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { city?: string; locality?: string; principalSubdivision?: string; countryName?: string };
    const city = json.city || json.locality || json.principalSubdivision;
    if (!city) return null;
    const admin1 = json.principalSubdivision && json.principalSubdivision !== city ? json.principalSubdivision : undefined;
    return { name: city, admin1, country: json.countryName };
  } catch {
    return null;
  }
}

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
  const [locating, setLocating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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

  // First paint: the last place the visitor looked at (if still fresh), else
  // the locale capital.
  useEffect(() => {
    const cached = readCache();
    const initial = cached?.place ?? DEFAULT_PLACE[locale] ?? DEFAULT_PLACE.en;
    setPlace(initial);
    void load(initial);
    // Localize the capital's label ('Seoul' -> '서울특별시') in the background;
    // coordinates stay the hard-coded ones, so a gazetteer miss changes nothing.
    const labelController = new AbortController();
    if (!cached && locale !== 'en') {
      geocode(initial.name, locale, labelController.signal, 1)
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
    return () => {
      abortRef.current?.abort();
      labelController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCitySearch() {
    const q = cityQuery.trim();
    if (!q) return;
    setSearching(true);
    setCandidates([]);
    const controller = new AbortController();
    try {
      const list = await geocode(q, locale, controller.signal);
      setCandidates(list);
      if (list.length === 1) void load(list[0], true);
      if (list.length === 0) setError(t('noCity'));
    } catch {
      setError(t('error'));
    } finally {
      setSearching(false);
    }
  }

  function pickCandidate(p: Place) {
    setCandidates([]);
    setCityQuery('');
    void load(p, true);
  }

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setError(t('locationDenied'));
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        const controller = new AbortController();
        const reverse = await reverseLabel(lat, lon, locale, controller.signal);
        setLocating(false);
        void load(
          reverse
            ? { name: reverse.name, admin1: reverse.admin1, country: reverse.country, lat, lon }
            : { name: t('myLocation'), lat, lon },
          true,
        );
      },
      () => {
        setLocating(false);
        setError(t('locationDenied'));
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
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
          </span>
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onMouseEnter={() => playHoverSfx()}
            onClick={locateMe}
            disabled={locating}
            title={t('myLocation')}
            aria-label={t('myLocation')}
            className="flex h-8 items-center gap-1.5 border border-accent/40 px-2.5 text-[11px] font-bold uppercase tracking-widest text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {locating ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <LocateFixed size={12} aria-hidden="true" />}
            <span className="hidden sm:inline">{t('myLocation')}</span>
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
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 border border-white/15 bg-quantum shadow-xl">
            {candidates.map((p) => (
              <li key={`${p.lat},${p.lon}`}>
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
        )}
      </div>

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
