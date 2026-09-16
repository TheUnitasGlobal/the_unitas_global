import { describe, expect, it } from 'vitest';
import {
  RADAR_ATTRIBUTION,
  RADAR_CACHE_TTL_MS,
  RADAR_CACHE_VERSION,
  RADAR_DEFAULT_ZOOM,
  RADAR_PAST_FRAMES,
  RADAR_STORAGE_KEY,
  RADAR_ZOOMS,
  basemapTileUrl,
  grid3x3,
  parseRadarFrames,
  radarTileUrl,
  readRadarCache,
  tileXY,
  writeRadarCache,
  type RainViewerMapsResponse,
} from '@/lib/live/rainviewer';
import type { StorageLike } from '@/lib/live/weatherDeep';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const store = {
    data: { ...initial },
    getItem: (k: string) => (k in store.data ? store.data[k] : null),
    setItem: (k: string, v: string) => {
      store.data[k] = v;
    },
    removeItem: (k: string) => {
      delete store.data[k];
    },
  };
  return store;
}

const MAPS: RainViewerMapsResponse = {
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: Array.from({ length: 13 }, (_, i) => ({ time: 1_700_000_000 + i * 600, path: `/v2/radar/${1_700_000_000 + i * 600}` })),
    nowcast: Array.from({ length: 3 }, (_, i) => ({ time: 1_700_007_800 + i * 600, path: `/v2/radar/nowcast_${i}` })),
  },
};

describe('rainviewer · slippy maths', () => {
  it('tileXY places Seoul at z6 on tile 54/24 and wraps / clamps the edges', () => {
    expect(tileXY(37.5665, 126.978, 6)).toEqual({ x: 54, y: 24 });
    expect(tileXY(0, 0, 1)).toEqual({ x: 1, y: 1 });
    expect(tileXY(0, -180, 2)).toEqual({ x: 0, y: 2 });
    expect(tileXY(0, 180, 2)).toEqual({ x: 0, y: 2 }); // +180 wraps onto column 0
    expect(tileXY(89.9, 0, 3)).toEqual({ x: 4, y: 0 }); // polar latitude clamps into the mercator range
    expect(tileXY(-89.9, 0, 3)).toEqual({ x: 4, y: 7 });
  });

  it('grid3x3 returns nine row-major cells around the centre, wrapping columns and clamping rows', () => {
    const cells = grid3x3(37.5665, 126.978, 6);
    expect(cells).toHaveLength(9);
    expect(cells[0]).toEqual({ x: 53, y: 23, dx: -1, dy: -1 });
    expect(cells[4]).toEqual({ x: 54, y: 24, dx: 0, dy: 0 });
    expect(cells[8]).toEqual({ x: 55, y: 25, dx: 1, dy: 1 });
    expect(cells.map((c) => `${c.dx},${c.dy}`)).toEqual(['-1,-1', '0,-1', '1,-1', '-1,0', '0,0', '1,0', '-1,1', '0,1', '1,1']);

    const wrapped = grid3x3(0, -179.9, 2); // centre column 0 -> left neighbour is column 3
    expect(wrapped[3].x).toBe(3);
    expect(wrapped[5].x).toBe(1);
    const polar = grid3x3(85, 0, 2); // centre row 0 -> the row above clamps to 0
    expect(polar[1].y).toBe(0);
    expect(polar[7].y).toBe(1);
  });

  it('exposes the zoom ladder the toggle walks', () => {
    expect(RADAR_ZOOMS).toEqual([6, 7, 8]);
    expect(RADAR_DEFAULT_ZOOM).toBe(7);
  });
});

describe('rainviewer · URLs', () => {
  it('composes the radar tile as host + path + /256/z/x/y/2/1_1.png', () => {
    expect(radarTileUrl('https://tilecache.rainviewer.com', '/v2/radar/1700000000', 7, 109, 49)).toBe(
      'https://tilecache.rainviewer.com/v2/radar/1700000000/256/7/109/49/2/1_1.png',
    );
  });

  it('composes the CARTO basemap in the light variant by default and the dark one on request', () => {
    expect(basemapTileUrl(7, 109, 49)).toBe('https://basemaps.cartocdn.com/light_all/7/109/49.png');
    expect(basemapTileUrl(7, 109, 49, 'dark_all')).toBe('https://basemaps.cartocdn.com/dark_all/7/109/49.png');
  });

  it('carries the mandatory OSM / CARTO / RainViewer credit', () => {
    expect(RADAR_ATTRIBUTION).toContain('OpenStreetMap');
    expect(RADAR_ATTRIBUTION).toContain('CARTO');
    expect(RADAR_ATTRIBUTION).toContain('RainViewer');
  });
});

describe('rainviewer · parseRadarFrames', () => {
  it('keeps the last six observations (the latest marked now) and every nowcast frame, in order', () => {
    const parsed = parseRadarFrames(MAPS);
    expect(parsed?.host).toBe('https://tilecache.rainviewer.com');
    expect(parsed?.frames).toHaveLength(RADAR_PAST_FRAMES + 3);
    expect(parsed?.nowIndex).toBe(RADAR_PAST_FRAMES - 1);
    expect(parsed?.frames[0]).toEqual({ time: 1_700_004_200, path: '/v2/radar/1700004200', kind: 'past' });
    expect(parsed?.frames[5]).toMatchObject({ time: 1_700_007_200, kind: 'now' });
    expect(parsed?.frames[6]).toMatchObject({ path: '/v2/radar/nowcast_0', kind: 'nowcast' });
    expect(parsed?.frames[8]).toMatchObject({ path: '/v2/radar/nowcast_2', kind: 'nowcast' });
  });

  it('marks the only observation as now when fewer than six exist, and drops malformed frames', () => {
    const parsed = parseRadarFrames({
      host: 'https://h',
      radar: { past: [{ time: 1, path: '/a' }, { time: 2 }, { path: '/c' }], nowcast: [{ time: 3, path: '' }] },
    });
    expect(parsed?.frames).toEqual([{ time: 1, path: '/a', kind: 'now' }]);
    expect(parsed?.nowIndex).toBe(0);
  });

  it('fails closed to null on a missing host, an empty past, or no body at all', () => {
    expect(parseRadarFrames(null)).toBeNull();
    expect(parseRadarFrames(undefined)).toBeNull();
    expect(parseRadarFrames({})).toBeNull();
    expect(parseRadarFrames({ host: '', radar: MAPS.radar })).toBeNull();
    expect(parseRadarFrames({ host: 'https://h', radar: { past: [], nowcast: [{ time: 1, path: '/n' }] } })).toBeNull();
  });
});

describe('rainviewer · device cache', () => {
  it('serves the frame list within five minutes and misses after, on another version, or on corrupt storage', () => {
    const frames = parseRadarFrames(MAPS);
    if (!frames) throw new Error('fixture must parse');
    const storage = fakeStorage();
    writeRadarCache(frames, storage, 10_000);
    expect(JSON.parse(storage.data[RADAR_STORAGE_KEY]).v).toBe(RADAR_CACHE_VERSION);
    expect(readRadarCache(storage, 10_000 + RADAR_CACHE_TTL_MS)?.data.frames).toHaveLength(9);
    expect(readRadarCache(storage, 10_000 + RADAR_CACHE_TTL_MS)?.at).toBe(10_000);
    expect(readRadarCache(storage, 10_000 + RADAR_CACHE_TTL_MS + 1)).toBeNull();

    const stale = fakeStorage({ [RADAR_STORAGE_KEY]: JSON.stringify({ v: 'rv-v0', key: 'global', at: 10_000, data: frames }) });
    expect(readRadarCache(stale, 10_001)).toBeNull();
    expect(readRadarCache(fakeStorage({ [RADAR_STORAGE_KEY]: 'not json' }), 1)).toBeNull();
    expect(readRadarCache(null, 1)).toBeNull();
  });
});
