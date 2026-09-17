/**
 * REV-41 D-4 -- the visitor's network-address fix as a first-class, cached
 * context input.
 *
 * Until REV-41 the Geo-IP providers (GeoJS, then ipwho.is) were called only
 * by the weather panel's "my location" button, so a visitor who never
 * pressed it was placed by LANGUAGE alone: a Korean reader in Lisbon got
 * Seoul's air, Korea's indicators and Seoul's surroundings. The fx compass
 * (D-3) and the omni-radar (D-5) both need the real point of access, so the
 * fix is now resolved once per session, parked in localStorage for a day
 * and fed to `resolveCountry` between the weather cache and the locale
 * default (lib/live/contextPriority.ts).
 *
 * Pure and injectable (storage, clock, fetch) so the TTL / parse / fallback
 * rules are unit-testable in node; the React hook lives in useGeoIp.ts.
 * Fail-open throughout: unavailable storage, a blocked provider, a rate
 * limit or a malformed body all degrade to `null`, never to a throw.
 */
import type { StorageLike } from '@/lib/live/geoCache';

export const GEO_IP_STORAGE_KEY = 'unitas.geo.ip.v1';
/** A network fix is city-centroid accurate at best; a day is plenty, and it
 *  keeps a returning visitor at zero Geo-IP requests. */
export const GEO_IP_TTL_MS = 24 * 60 * 60 * 1000;
/** Per-provider budget -- the same 4 s the weather panel's fallback spends. */
export const GEO_IP_TIMEOUT_MS = 4000;

export const GEOJS_URL = 'https://get.geojs.io/v1/ip/geo.json';
export const IPWHOIS_URL = 'https://ipwho.is/';

export interface GeoIpFix {
  /** ISO 3166-1 alpha-2, upper-case. */
  country: string;
  lat: number;
  lon: number;
  /** The provider's city label, `''` when it gave none. */
  city: string;
  /** Epoch ms of the resolution -- the TTL clock. */
  at: number;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    // Accessing localStorage itself throws under some privacy settings.
    return null;
  }
}

function isFix(value: unknown): value is GeoIpFix {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.country === 'string' &&
    /^[A-Z]{2}$/.test(v.country) &&
    typeof v.lat === 'number' &&
    Number.isFinite(v.lat) &&
    typeof v.lon === 'number' &&
    Number.isFinite(v.lon) &&
    typeof v.city === 'string' &&
    typeof v.at === 'number' &&
    Number.isFinite(v.at)
  );
}

/** The stored fix when it exists, parses and is younger than the TTL;
 *  `null` otherwise -- and always on the server, where there is no storage. */
export function readGeoIpFix(storage: StorageLike | null = defaultStorage(), now = Date.now()): GeoIpFix | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(GEO_IP_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isFix(parsed)) return null;
    if (now - parsed.at >= GEO_IP_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeGeoIpFix(fix: GeoIpFix, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(GEO_IP_STORAGE_KEY, JSON.stringify(fix));
  } catch {
    // Quota exceeded / privacy mode: the in-memory value still serves this
    // session; the next page load simply resolves again.
  }
}

/** One provider row normalised into a fix, or null when the country is not
 *  a two-letter code or the coordinate is missing / the (0, 0) null island
 *  GeoJS answers for unknown addresses. */
function normaliseFix(country: unknown, lat: unknown, lon: unknown, city: unknown, at: number): GeoIpFix | null {
  const cc = typeof country === 'string' ? country.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const la = typeof lat === 'number' || typeof lat === 'string' ? Number(lat) : NaN;
  const lo = typeof lon === 'number' || typeof lon === 'string' ? Number(lon) : NaN;
  if (!Number.isFinite(la) || !Number.isFinite(lo) || (la === 0 && lo === 0)) return null;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return { country: cc, lat: la, lon: lo, city: typeof city === 'string' ? city.trim() : '', at };
}

/** GeoJS answers lat/lon as STRINGS and the country as `country_code`. */
export function parseGeoJs(json: unknown, at: number): GeoIpFix | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, unknown>;
  return normaliseFix(j.country_code, j.latitude, j.longitude, j.city, at);
}

/** ipwho.is answers numbers, plus `success: false` on a rate limit. */
export function parseIpWhoIs(json: unknown, at: number): GeoIpFix | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, unknown>;
  if (j.success === false) return null;
  return normaliseFix(j.country_code, j.latitude, j.longitude, j.city, at);
}

export type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export interface GeoIpRefreshOptions {
  /** `null` = do not persist (the caller keeps the value in memory). */
  storage?: StorageLike | null;
  /** Injected for tests; the global `fetch`, resolved at call time, otherwise. */
  fetchImpl?: FetchLike;
  now?: () => number;
  timeoutMs?: number;
}

async function fetchJson(fetchImpl: FetchLike, url: string, signal: AbortSignal | undefined, timeoutMs: number): Promise<unknown> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
    const res = await fetchImpl(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Resolve the fix from the network: GeoJS first, ipwho.is when GeoJS is
 * unreachable, rate-limited or answers the null island. A usable answer is
 * written to storage and returned; both providers failing yields `null`
 * and writes nothing, so a stale-but-parseable fix is never overwritten
 * with garbage.
 */
export async function refreshGeoIpFix(signal?: AbortSignal, options: GeoIpRefreshOptions = {}): Promise<GeoIpFix | null> {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const fetchImpl: FetchLike | null =
    options.fetchImpl ?? (typeof fetch === 'function' ? (input, init) => fetch(input, init) : null);
  if (!fetchImpl) return null;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? GEO_IP_TIMEOUT_MS;
  const providers: ReadonlyArray<{ url: string; parse: (json: unknown, at: number) => GeoIpFix | null }> = [
    { url: GEOJS_URL, parse: parseGeoJs },
    { url: IPWHOIS_URL, parse: parseIpWhoIs },
  ];
  for (const provider of providers) {
    if (signal?.aborted) return null;
    const json = await fetchJson(fetchImpl, provider.url, signal, timeoutMs);
    const fix = provider.parse(json, now());
    if (fix) {
      writeGeoIpFix(fix, storage);
      return fix;
    }
  }
  return null;
}
