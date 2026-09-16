import { WEATHER_TTL_MS, type Place } from '@/lib/live/useLiveWeather';

/**
 * REV-34 M1-A (founder directive 2026-09-16) -- the weather slot's DEEP data
 * layer. The shallow popup only had what `fetchForecast` asks Open-Meteo for
 * (current + a 5-day daily); the deep popup needs the hourly curve, a 7-day
 * outlook with sunrise / sunset / UV / rain chance, wind direction and gusts,
 * and the air-quality row. All of that is one extra Open-Meteo request plus
 * the keyless air-quality endpoint the `air` slot already uses -- both CORS
 * `*`, both 0원 (Codex ch.1 한계 비용 0원).
 *
 * The existing `Forecast` shape and its `unitas.weather.v1` device cache are
 * NOT touched: the carousel card, `knownPlace` and every visitor's stored
 * blob read that shape. The deep payload lives under its own versioned key
 * (`unitas.weather.deep.v1`, same 10-minute TTL) so a shape change here can
 * never invalidate the shallow cache, and vice versa.
 *
 * Everything below the fetch is pure and unit-tested (vitest runs in node):
 * the parser, the "from now" hourly slice, the UV band, the compass label
 * and the AQI band. The slice compares ISO strings by prefix on purpose --
 * Open-Meteo returns LOCAL times without an offset when `timezone=auto`, and
 * WebKit parses an offset-less ISO string as UTC, so `new Date()` would shift
 * the window by the visitor's offset on iOS.
 */

export interface DeepCurrent {
  temp: number;
  feelsLike: number;
  humidity: number;
  /** km/h */
  wind: number;
  /** Meteorological degrees (the direction the wind blows FROM). */
  windDir: number;
  /** km/h */
  gust: number;
  uv: number;
  /** mm over the current hour. */
  precip: number;
  /** WMO weather interpretation code. */
  code: number;
  /** Local ISO minute (`YYYY-MM-DDTHH:mm`), no offset. */
  time: string;
}

export interface DeepHour {
  /** Local ISO hour (`YYYY-MM-DDTHH:00`), no offset. */
  time: string;
  temp: number;
  code: number;
  /** 0-100 */
  precipProb: number;
  /** mm */
  precip: number;
  wind: number;
  uv: number;
}

export interface DeepDay {
  /** `YYYY-MM-DD` */
  date: string;
  code: number;
  max: number;
  min: number;
  /** Local ISO minute, no offset. */
  sunrise: string;
  sunset: string;
  uvMax: number;
  precipProbMax: number;
  windMax: number;
  windDir: number;
}

export interface DeepAir {
  /** European AQI (0-100+). */
  eu: number;
  pm25: number | null;
  pm10: number | null;
}

export interface DeepForecast {
  current: DeepCurrent;
  hourly: DeepHour[];
  daily: DeepDay[];
  /** Absent when the air-quality request failed -- the row is simply skipped. */
  aqi?: DeepAir;
  timezone: string;
}

/** Open-Meteo `/v1/forecast` with the deep parameter set (all optional: a
 *  missing series is defaulted, never thrown on). */
export interface OpenMeteoDeepResponse {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wind_gusts_10m?: number;
    uv_index?: number;
    precipitation?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    weather_code?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    precipitation?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    uv_index?: Array<number | null>;
  };
  daily?: {
    time?: string[];
    weather_code?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    sunrise?: string[];
    sunset?: string[];
    uv_index_max?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
    wind_speed_10m_max?: Array<number | null>;
    wind_direction_10m_dominant?: Array<number | null>;
  };
}

/** air-quality-api.open-meteo.com `current=european_aqi,pm2_5,pm10`. */
export interface OpenMeteoAirResponse {
  current?: { european_aqi?: number | null; pm2_5?: number | null; pm10?: number | null };
}

export const WEATHER_DEEP_STORAGE_KEY = 'unitas.weather.deep.v1';
export const WEATHER_DEEP_VERSION = 'wd-v1';
export const WEATHER_DEEP_TTL_MS = WEATHER_TTL_MS;
/** Hourly cells the rail shows -- one day from the current hour. */
export const DEEP_HOURLY_COUNT = 24;
export const DEEP_FORECAST_DAYS = 7;

/* ------------------------------------------------------------------ */
/* Pure helpers                                                         */
/* ------------------------------------------------------------------ */

function num(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Maps the two JSON bodies to `DeepForecast`. Every missing series becomes
 *  a safe default (a 0, a WMO 3 "overcast", an empty string) so one absent
 *  variable can never blank the whole popup. */
export function parseDeepForecast(json: OpenMeteoDeepResponse, air: OpenMeteoAirResponse | null): DeepForecast {
  const c = json.current ?? {};
  const h = json.hourly ?? {};
  const d = json.daily ?? {};
  const temp = num(c.temperature_2m, 0);
  const hourly: DeepHour[] = (h.time ?? []).map((time, i) => ({
    time,
    temp: num(h.temperature_2m?.[i], 0),
    code: num(h.weather_code?.[i], 3),
    precipProb: num(h.precipitation_probability?.[i], 0),
    precip: num(h.precipitation?.[i], 0),
    wind: num(h.wind_speed_10m?.[i], 0),
    uv: num(h.uv_index?.[i], 0),
  }));
  const daily: DeepDay[] = (d.time ?? []).map((date, i) => ({
    date,
    code: num(d.weather_code?.[i], 3),
    max: num(d.temperature_2m_max?.[i], 0),
    min: num(d.temperature_2m_min?.[i], 0),
    sunrise: d.sunrise?.[i] ?? '',
    sunset: d.sunset?.[i] ?? '',
    uvMax: num(d.uv_index_max?.[i], 0),
    precipProbMax: num(d.precipitation_probability_max?.[i], 0),
    windMax: num(d.wind_speed_10m_max?.[i], 0),
    windDir: num(d.wind_direction_10m_dominant?.[i], 0),
  }));
  const eu = air?.current?.european_aqi;
  const aqi: DeepAir | undefined =
    typeof eu === 'number' && Number.isFinite(eu)
      ? {
          eu,
          pm25: typeof air?.current?.pm2_5 === 'number' ? air.current.pm2_5 : null,
          pm10: typeof air?.current?.pm10 === 'number' ? air.current.pm10 : null,
        }
      : undefined;
  return {
    current: {
      temp,
      feelsLike: num(c.apparent_temperature, temp),
      humidity: num(c.relative_humidity_2m, 0),
      wind: num(c.wind_speed_10m, 0),
      windDir: num(c.wind_direction_10m, 0),
      gust: num(c.wind_gusts_10m, 0),
      uv: num(c.uv_index, 0),
      precip: num(c.precipitation, 0),
      code: num(c.weather_code, 3),
      time: c.time ?? '',
    },
    hourly,
    daily,
    ...(aqi ? { aqi } : null),
    timezone: json.timezone ?? 'UTC',
  };
}

/** The hour cell `currentTime` falls in: `YYYY-MM-DDTHH`. */
function hourPrefix(isoMinute: string): string {
  return isoMinute.slice(0, 13);
}

/** The next `count` hours starting at the hour that contains `currentTime`,
 *  by STRING comparison on the local ISO stamps (see the file comment: no
 *  `Date` parsing of offset-less ISO). When the current hour is not in the
 *  series (a stale cache crossing midnight, a clock skew) the first hour at
 *  or after it is used; when every hour is already past, the tail. */
export function sliceHourlyFromNow<T extends { time: string }>(hourly: T[], currentTime: string, count = DEEP_HOURLY_COUNT): T[] {
  if (hourly.length === 0 || count <= 0) return [];
  const prefix = hourPrefix(currentTime);
  let start = hourly.findIndex((h) => hourPrefix(h.time) === prefix);
  if (start < 0) start = hourly.findIndex((h) => h.time >= currentTime);
  if (start < 0) start = Math.max(0, hourly.length - count);
  return hourly.slice(start, start + count);
}

export type UvBand = 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme';

/** WHO UV index bands (the value is rounded first, as the WHO scale is). */
export function uvBand(uv: number): UvBand {
  const n = Math.round(Math.max(0, uv));
  if (n <= 2) return 'low';
  if (n <= 5) return 'moderate';
  if (n <= 7) return 'high';
  if (n <= 10) return 'veryHigh';
  return 'extreme';
}

const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'] as const;

export type CompassLabel = (typeof COMPASS_16)[number];

/** Meteorological degrees -> the 16-point compass abbreviation. The Latin
 *  abbreviations are the international convention (aviation, marine, every
 *  weather service), so they are rendered as-is in every locale. */
export function windDirLabel(degrees: number): CompassLabel {
  const deg = ((Number.isFinite(degrees) ? degrees : 0) % 360 + 360) % 360;
  return COMPASS_16[Math.round(deg / 22.5) % 16];
}

export type AqiBand = 'good' | 'fair' | 'moderate' | 'poor' | 'veryPoor' | 'extreme';

/** European AQI bands -- the same thresholds the `air` discovery slot uses,
 *  so the deep popup and the air card never disagree about one reading. */
export function aqiBandOf(eu: number): AqiBand {
  if (eu <= 20) return 'good';
  if (eu <= 40) return 'fair';
  if (eu <= 60) return 'moderate';
  if (eu <= 80) return 'poor';
  if (eu <= 100) return 'veryPoor';
  return 'extreme';
}

/** `YYYY-MM-DD` -> a local-midday Date built from its parts (never from the
 *  string), so `Intl.DateTimeFormat` prints the right weekday on WebKit too. */
export function localDateOf(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(Number.isFinite(y) ? y : 1970, Number.isFinite(m) ? m - 1 : 0, Number.isFinite(d) ? d : 1, 12, 0, 0, 0);
}

/** `HH:mm` out of a local ISO minute stamp; a dash when the stamp is empty. */
export function clockOf(isoMinute: string): string {
  return isoMinute.length >= 16 ? isoMinute.slice(11, 16) : '—';
}

/* ------------------------------------------------------------------ */
/* Versioned single-entry device cache (shared with rainviewer.ts)      */
/* ------------------------------------------------------------------ */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface DeviceEntry<T> {
  v: string;
  key: string;
  at: number;
  data: T;
}

export interface CachedEntry<T> {
  data: T;
  /** Epoch ms of the fetch that produced `data` (the meta line's stamp). */
  at: number;
}

/** The browser's localStorage, or null where it is blocked / absent (SSR,
 *  strict privacy modes throw on access). */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Reads the one entry under `storageKey` when it carries `version`, was
 *  written for `matchKey` and is younger than `ttlMs`. Fail-open: corrupt,
 *  missing or blocked storage is a miss, never an error. */
export function readDeviceEntry<T>(
  storage: StorageLike | null,
  storageKey: string,
  version: string,
  matchKey: string,
  ttlMs: number,
  now: number,
): CachedEntry<T> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<DeviceEntry<T>>;
    if (entry.v !== version || entry.key !== matchKey || typeof entry.at !== 'number' || entry.data === undefined) return null;
    if (now - entry.at > ttlMs) return null;
    return { data: entry.data as T, at: entry.at };
  } catch {
    return null;
  }
}

export function writeDeviceEntry<T>(storage: StorageLike | null, storageKey: string, version: string, key: string, data: T, now: number): void {
  if (!storage) return;
  try {
    const entry: DeviceEntry<T> = { v: version, key, at: now, data };
    storage.setItem(storageKey, JSON.stringify(entry));
  } catch {
    // Quota / privacy mode -- the popup simply refetches next time.
  }
}

/** ~11 m cells: the same place searched twice shares one entry. */
export function deepPlaceKey(place: Pick<Place, 'lat' | 'lon'>): string {
  return `${place.lat.toFixed(4)},${place.lon.toFixed(4)}`;
}

export function readDeepForecastCache(place: Pick<Place, 'lat' | 'lon'>, storage: StorageLike | null = browserStorage(), now: number = Date.now()): CachedEntry<DeepForecast> | null {
  return readDeviceEntry<DeepForecast>(storage, WEATHER_DEEP_STORAGE_KEY, WEATHER_DEEP_VERSION, deepPlaceKey(place), WEATHER_DEEP_TTL_MS, now);
}

export function writeDeepForecastCache(place: Pick<Place, 'lat' | 'lon'>, data: DeepForecast, storage: StorageLike | null = browserStorage(), now: number = Date.now()): void {
  writeDeviceEntry(storage, WEATHER_DEEP_STORAGE_KEY, WEATHER_DEEP_VERSION, deepPlaceKey(place), data, now);
}

/* ------------------------------------------------------------------ */
/* Network                                                              */
/* ------------------------------------------------------------------ */

const CURRENT_VARS = 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,precipitation';
const HOURLY_VARS = 'temperature_2m,weather_code,precipitation_probability,precipitation,wind_speed_10m,uv_index';
const DAILY_VARS = 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant';

/** The two request URLs, exported so the E2E lane can route them precisely. */
export function deepForecastUrl(place: Pick<Place, 'lat' | 'lon'>): string {
  const params = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: CURRENT_VARS,
    hourly: HOURLY_VARS,
    daily: DAILY_VARS,
    timezone: 'auto',
    forecast_days: String(DEEP_FORECAST_DAYS),
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function airQualityUrl(place: Pick<Place, 'lat' | 'lon'>): string {
  const params = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: 'european_aqi,pm2_5,pm10',
  });
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`;
}

/** The forecast request decides the outcome; the air-quality request rides
 *  alongside under `allSettled` so a hiccup there costs the AQI row only. */
export async function fetchDeepForecast(place: Pick<Place, 'lat' | 'lon'>, signal: AbortSignal): Promise<DeepForecast> {
  const [forecast, air] = await Promise.allSettled([
    fetch(deepForecastUrl(place), { signal }).then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as OpenMeteoDeepResponse;
    }),
    fetch(airQualityUrl(place), { signal }).then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as OpenMeteoAirResponse;
    }),
  ]);
  if (forecast.status === 'rejected') throw forecast.reason instanceof Error ? forecast.reason : new Error('deep-forecast');
  return parseDeepForecast(forecast.value, air.status === 'fulfilled' ? air.value : null);
}

/** Cache-first load: the device entry within its TTL costs nothing; a miss
 *  fetches and parks the result. `at` is the stamp the meta line shows. */
export async function loadDeepForecast(place: Pick<Place, 'lat' | 'lon'>, signal: AbortSignal): Promise<CachedEntry<DeepForecast>> {
  const hit = readDeepForecastCache(place);
  if (hit) return hit;
  const data = await fetchDeepForecast(place, signal);
  const at = Date.now();
  writeDeepForecastCache(place, data, browserStorage(), at);
  return { data, at };
}
