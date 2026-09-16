import { browserStorage, readDeviceEntry, writeDeviceEntry, type CachedEntry, type StorageLike } from '@/lib/live/weatherDeep';

/**
 * REV-34 M1-A (founder directive 2026-09-16) -- the rain radar behind the
 * weather deep popup, as plain image tiles.
 *
 * Why tiles and not an embed: a Windy / map-library iframe is several MB of
 * third-party JavaScript inside a dialog, carries foreign branding, and is
 * exactly the kind of frame an in-app WebView (Kakao, LINE, Facebook) refuses
 * or mangles. RainViewer's public radar tiles and CARTO's OSM basemap tiles
 * are keyless 256px PNGs; nine of each make a 3x3 map around the place with
 * no script, no key, no cost -- and they degrade to "unavailable" text, not
 * to a broken frame.
 *
 * `weather-maps.json` lists the radar frames of the last two hours plus a
 * ~30-minute nowcast and refreshes roughly every 10 minutes. It is fetched
 * only while the popup is mounted, and cached on the device for 5 minutes
 * (`unitas.radar.v1`) so an open / close / reopen costs zero calls.
 * Slippy-map maths and URL composition are pure and unit-tested.
 */

export const RAINVIEWER_MAPS_URL = 'https://api.rainviewer.com/public/weather-maps.json';
export const RADAR_STORAGE_KEY = 'unitas.radar.v1';
export const RADAR_CACHE_VERSION = 'rv-v1';
export const RADAR_CACHE_TTL_MS = 5 * 60 * 1000;
/** While the popup stays open, the frame list is re-read this often. */
export const RADAR_REFRESH_MS = 10 * 60 * 1000;
/** Past frames kept (10-minute steps -> the last hour), plus every nowcast. */
export const RADAR_PAST_FRAMES = 6;
/** Zoom levels the toggle walks (~600 km / ~300 km / ~150 km across 3x3). */
export const RADAR_ZOOMS = [6, 7, 8] as const;
export type RadarZoom = (typeof RADAR_ZOOMS)[number];
export const RADAR_DEFAULT_ZOOM: RadarZoom = 7;
/** Tile size the URLs request. */
export const RADAR_TILE_PX = 256;
/** Mandatory credit for the basemap (ODbL) and the radar provider. */
export const RADAR_ATTRIBUTION = '© OpenStreetMap contributors · © CARTO · RainViewer';

export type RadarFrameKind = 'past' | 'now' | 'nowcast';

export interface RadarFrame {
  /** Unix seconds of the frame. */
  time: number;
  /** Path segment RainViewer hands back (`/v2/radar/1694860800`). */
  path: string;
  kind: RadarFrameKind;
}

export interface RadarFrames {
  /** Tile host (`https://tilecache.rainviewer.com`). */
  host: string;
  /** Oldest past frame first, the latest observation, then the nowcast. */
  frames: RadarFrame[];
  /** Index of the latest observed frame (`kind === 'now'`). */
  nowIndex: number;
}

/** The subset of `weather-maps.json` this module reads. */
export interface RainViewerMapsResponse {
  host?: string;
  radar?: {
    past?: Array<{ time?: number; path?: string }>;
    nowcast?: Array<{ time?: number; path?: string }>;
  };
}

/* ------------------------------------------------------------------ */
/* Pure helpers                                                         */
/* ------------------------------------------------------------------ */

function validFrames(list: Array<{ time?: number; path?: string }> | undefined): Array<{ time: number; path: string }> {
  return (list ?? []).filter((f): f is { time: number; path: string } => typeof f.time === 'number' && typeof f.path === 'string' && f.path.length > 0);
}

/** Last `RADAR_PAST_FRAMES` observations + every nowcast frame; null when
 *  the body has no host or no observed frame at all (fail-closed). */
export function parseRadarFrames(json: RainViewerMapsResponse | null | undefined): RadarFrames | null {
  if (!json || typeof json.host !== 'string' || !json.host) return null;
  const past = validFrames(json.radar?.past).slice(-RADAR_PAST_FRAMES);
  if (past.length === 0) return null;
  const nowcast = validFrames(json.radar?.nowcast);
  const frames: RadarFrame[] = [
    ...past.map((f, i) => ({ ...f, kind: (i === past.length - 1 ? 'now' : 'past') as RadarFrameKind })),
    ...nowcast.map((f) => ({ ...f, kind: 'nowcast' as RadarFrameKind })),
  ];
  return { host: json.host, frames, nowIndex: past.length - 1 };
}

export interface TileXY {
  x: number;
  y: number;
}

/** Slippy-map tile of a coordinate at zoom `z` (Web Mercator, EPSG:3857). */
export function tileXY(lat: number, lon: number, z: number): TileXY {
  const n = 2 ** z;
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x: ((x % n) + n) % n, y: Math.max(0, Math.min(n - 1, y)) };
}

/** RainViewer tile: `{host}{path}/256/{z}/{x}/{y}/{color}/{smooth}_{snow}.png`
 *  -- colour scheme 2 (the "Universal Blue" scale), smoothed, snow shown. */
export function radarTileUrl(host: string, path: string, z: number, x: number, y: number): string {
  return `${host}${path}/${RADAR_TILE_PX}/${z}/${x}/${y}/2/1_1.png`;
}

export type BasemapVariant = 'light_all' | 'dark_all';

/** CARTO's keyless OSM basemap (light for the white surface, dark for the
 *  void); attribution is mandatory and rendered by WeatherRadar. */
export function basemapTileUrl(z: number, x: number, y: number, variant: BasemapVariant = 'light_all'): string {
  return `https://basemaps.cartocdn.com/${variant}/${z}/${x}/${y}.png`;
}

export interface GridCell extends TileXY {
  /** -1 / 0 / +1 column offset from the centre tile. */
  dx: -1 | 0 | 1;
  /** -1 / 0 / +1 row offset from the centre tile. */
  dy: -1 | 0 | 1;
}

/** The 3x3 tiles around a coordinate, row-major from the top-left. Columns
 *  wrap around the antimeridian; rows clamp at the poles (a duplicate edge
 *  tile is preferable to a hole). */
export function grid3x3(lat: number, lon: number, z: number): GridCell[] {
  const n = 2 ** z;
  const centre = tileXY(lat, lon, z);
  const cells: GridCell[] = [];
  for (const dy of [-1, 0, 1] as const) {
    for (const dx of [-1, 0, 1] as const) {
      cells.push({
        x: (((centre.x + dx) % n) + n) % n,
        y: Math.max(0, Math.min(n - 1, centre.y + dy)),
        dx,
        dy,
      });
    }
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/* Device cache + network                                               */
/* ------------------------------------------------------------------ */

/** The frame list is global (not per place), so the entry key is constant. */
const RADAR_ENTRY_KEY = 'global';

export function readRadarCache(storage: StorageLike | null = browserStorage(), now: number = Date.now()): CachedEntry<RadarFrames> | null {
  return readDeviceEntry<RadarFrames>(storage, RADAR_STORAGE_KEY, RADAR_CACHE_VERSION, RADAR_ENTRY_KEY, RADAR_CACHE_TTL_MS, now);
}

export function writeRadarCache(frames: RadarFrames, storage: StorageLike | null = browserStorage(), now: number = Date.now()): void {
  writeDeviceEntry(storage, RADAR_STORAGE_KEY, RADAR_CACHE_VERSION, RADAR_ENTRY_KEY, frames, now);
}

/** Cache-first frame list; null on any failure (the radar block then shows
 *  its "unavailable" line over the basemap instead of throwing). */
export async function fetchRadarFrames(signal: AbortSignal): Promise<RadarFrames | null> {
  const hit = readRadarCache();
  if (hit) return hit.data;
  try {
    const res = await fetch(RAINVIEWER_MAPS_URL, { signal });
    if (!res.ok) return null;
    const frames = parseRadarFrames((await res.json()) as RainViewerMapsResponse);
    if (frames) writeRadarCache(frames);
    return frames;
  } catch {
    return null;
  }
}
