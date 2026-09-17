import { describe, expect, it } from 'vitest';
import {
  BEAM_RADIUS_M,
  NEARBY_RADII,
  NEARBY_RADIUS_COLORS,
  NOMAD_NEXUS_HUBS,
  RADAR_SPARSE_FLOOR,
  bearingDeg,
  buildRadar,
  classifyLens,
  distanceKm,
  formatDistance,
  geoSearchBeamUrl,
  globalRadar,
  mergeRadarLegs,
  offsetPoint,
  parseGeoSearchPages,
  radarBeams,
  radiusByKey,
} from '@/lib/live/omniRadar';

// REV-41 SPEC.md D-5 -- the omni-radar geometry, pinned without a network:
// the four radii and their sweeps, the great-circle round trips, the strict
// radius filter (the 0 % error definition), the constellation, the lens
// table across languages and the one distance format.

const SEOUL = { lat: 37.5665, lon: 126.978 };

/** Smallest signed angle between two bearings, so 359.999 ≈ 0. */
const angleDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

describe('radii', () => {
  it('declares 10 / 50 / 100 km and Global in chip order, each with its own colour', () => {
    expect(NEARBY_RADII.map((r) => [r.key, r.km])).toEqual([
      ['r10', 10],
      ['r50', 50],
      ['r100', 100],
      ['global', null],
    ]);
    expect(new Set(Object.values(NEARBY_RADIUS_COLORS)).size).toBe(4);
    expect(radiusByKey('r50').km).toBe(50);
    expect(radiusByKey(undefined).key).toBe('r10');
    expect(radiusByKey('no-such-radius').key).toBe('r10');
  });

  it('sweeps 1 / 7 / 13 beams of the API ceiling, laid out by bearing', () => {
    expect(BEAM_RADIUS_M).toBe(10_000);
    expect(radarBeams(10)).toEqual([{ bearing: 0, offsetKm: 0, limit: 50 }]);
    const r50 = radarBeams(50);
    expect(r50).toHaveLength(7);
    expect(r50[0]).toEqual({ bearing: 0, offsetKm: 0, limit: 25 });
    expect(r50.slice(1).map((b) => b.bearing)).toEqual([0, 60, 120, 180, 240, 300]);
    expect(r50.slice(1).every((b) => b.offsetKm === 32 && b.limit === 25)).toBe(true);
    const r100 = radarBeams(100);
    expect(r100).toHaveLength(13);
    expect(r100.filter((b) => b.offsetKm === 40).map((b) => b.bearing)).toEqual([0, 60, 120, 180, 240, 300]);
    expect(r100.filter((b) => b.offsetKm === 80).map((b) => b.bearing)).toEqual([30, 90, 150, 210, 270, 330]);
    // Every beam centre of a sweep sits inside its radius with its 10 km
    // circle -- the sweep never asks the API about ground outside the tier.
    for (const [km, beams] of [[50, r50], [100, r100]] as const) {
      for (const b of beams) expect(b.offsetKm + 10).toBeLessThanOrEqual(km);
    }
  });
});

describe('great-circle helpers', () => {
  it('offsetPoint / distanceKm / bearingDeg round-trip within a millimetre and a micro-degree', () => {
    for (const bearing of [0, 30, 90, 137.5, 180, 270, 359]) {
      for (const km of [0.5, 10, 32, 80, 1500]) {
        const p = offsetPoint(SEOUL.lat, SEOUL.lon, bearing, km);
        expect(distanceKm(SEOUL.lat, SEOUL.lon, p.lat, p.lon)).toBeCloseTo(km, 6);
        expect(Math.abs(angleDiff(bearingDeg(SEOUL.lat, SEOUL.lon, p.lat, p.lon), bearing))).toBeLessThan(1e-6);
      }
    }
  });

  it('keeps longitudes on [-180, 180] across the antimeridian and bearings on [0, 360)', () => {
    const p = offsetPoint(0, 179.9, 90, 50);
    expect(p.lon).toBeLessThan(-179);
    expect(p.lon).toBeGreaterThanOrEqual(-180);
    expect(bearingDeg(0, 0, -1, 0)).toBeCloseTo(180, 9);
    expect(bearingDeg(0, 0, 0, -1)).toBeCloseTo(270, 9);
    expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 9);
  });
});

describe('buildRadar -- the 0 % radius error', () => {
  const at = (bearing: number, km: number, id: string, title = id) => ({ id, title, ...offsetPoint(SEOUL.lat, SEOUL.lon, bearing, km) });

  it('keeps a hit 1 m inside the radius, drops a hit 1 m outside, sorts nearest first', () => {
    const blips = buildRadar(SEOUL, 10, [at(0, 10.001, 'out'), at(90, 9.999, 'edge'), at(180, 2, 'near'), at(270, 10.2, 'out2')]);
    expect(blips.map((b) => b.id)).toEqual(['near', 'edge']);
    for (const b of blips) expect(b.distKm).toBeLessThanOrEqual(10);
    expect(blips[1].distKm).toBeCloseTo(9.999, 6);
    expect(blips[0].bearing).toBeCloseTo(180, 6);
  });

  it('de-duplicates by id (overlapping beams return the same article) and skips unrangeable hits', () => {
    const twice = at(45, 3, 'dup');
    const blips = buildRadar(SEOUL, 10, [twice, { ...twice }, { id: '', title: 'no id', lat: 1, lon: 1 }, { id: 'nan', title: 'nan', lat: Number.NaN, lon: 1 }]);
    expect(blips.map((b) => b.id)).toEqual(['dup']);
  });

  it('applies no cut for a null radius and honours a pre-classified lens', () => {
    const blips = buildRadar(SEOUL, null, [{ ...at(0, 5000, 'far'), lens: 'nomad' as const }, { ...at(0, 1, 'cafe'), description: 'coffee shop' }]);
    expect(blips.map((b) => b.id)).toEqual(['cafe', 'far']);
    expect(blips[1].lens).toBe('nomad');
    expect(blips[0].lens).toBe('nomad');
  });
});

describe('globalRadar -- the nomad constellation', () => {
  it('holds sixteen real hubs with unique ids, ISO countries and sane coordinates', () => {
    expect(NOMAD_NEXUS_HUBS).toHaveLength(16);
    expect(new Set(NOMAD_NEXUS_HUBS.map((h) => h.id)).size).toBe(16);
    for (const h of NOMAD_NEXUS_HUBS) {
      expect(h.country).toMatch(/^[A-Z]{2}$/);
      expect(Math.abs(h.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(h.lon)).toBeLessThanOrEqual(180);
      expect(h.url).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
    }
    expect(NOMAD_NEXUS_HUBS.map((h) => h.name)).toEqual(
      expect.arrayContaining(['Tallinn', 'Lisbon', 'Canggu', 'Chiang Mai', 'Medellín', 'Mexico City', 'Buenos Aires', 'Cape Town', 'Dubai', 'Singapore', 'Tokyo', 'Seoul', 'Taipei', 'Bangkok', 'Tbilisi', 'Austin']),
    );
  });

  it('ranges all sixteen from the visitor, nearest first, with zero network', () => {
    const blips = globalRadar(SEOUL);
    expect(blips).toHaveLength(16);
    expect(blips[0].title).toBe('Seoul');
    expect(blips[0].distKm).toBeLessThan(1);
    expect(blips[1].title).toBe('Tokyo');
    expect(blips[1].distKm).toBeGreaterThan(1100);
    expect(blips[1].distKm).toBeLessThan(1200);
    for (let i = 1; i < blips.length; i += 1) expect(blips[i].distKm).toBeGreaterThanOrEqual(blips[i - 1].distKm);
    const lisbon = globalRadar({ lat: 38.7223, lon: -9.1393 });
    expect(lisbon[0].title).toBe('Lisbon');
    expect(lisbon[1].title).toBe('Tallinn'); // 3,400 km beats Medellín / Cape Town
  });
});

describe('classifyLens across languages', () => {
  it('reads titles and descriptions in en / ko / ja / zh / de / fr / es / pt / ru / it', () => {
    const cases: Array<[string, string | undefined, string]> = [
      ['Second Home Coworking Space', undefined, 'nomad'],
      ['Science Museum', 'museum in London', 'inspiration'],
      ['Seoul National University', undefined, 'factory'],
      ['Main Street', 'street', 'signal'],
      ['Foo', 'coffee shop in Lisbon', 'nomad'],
      ['스타벅스 강남점', '카페', 'nomad'],
      ['국립중앙박물관', undefined, 'inspiration'],
      ['서울대학교', undefined, 'factory'],
      ['강남역', '지하철역', 'signal'],
      ['東京大学', undefined, 'factory'],
      ['浅草寺', undefined, 'inspiration'],
      ['清华大学', undefined, 'factory'],
      ['故宫博物院', undefined, 'inspiration'],
      ['Deutsches Museum', undefined, 'inspiration'],
      ['Technische Universität Berlin', undefined, 'factory'],
      ['Musée du Louvre', undefined, 'inspiration'],
      ['Universidad de Buenos Aires', undefined, 'factory'],
      ['Museu Nacional de Arte Antiga', undefined, 'inspiration'],
      ['Московский государственный университет', undefined, 'factory'],
      ['Politecnico di Milano', undefined, 'factory'],
      ['Praça do Comércio', undefined, 'nomad'],
      ['Chatuchak', 'weekend market in Bangkok', 'nomad'],
    ];
    for (const [title, description, lens] of cases) expect(classifyLens(title, description), title).toBe(lens);
  });

  it('prefers inspiration over factory over nomad when a hit matches several', () => {
    expect(classifyLens('University Museum Café')).toBe('inspiration');
    expect(classifyLens('Campus Coworking Hub')).toBe('factory');
  });
});

describe('formatDistance -- one unit rule', () => {
  it('prints metres under a kilometre and one-decimal kilometres above, digits in the locale', () => {
    expect(formatDistance(0.48, 'en')).toBe('480m');
    expect(formatDistance(4.87, 'en')).toBe('4.9km');
    expect(formatDistance(4.87, 'ko')).toBe('4.9km');
    expect(formatDistance(4.87, 'de')).toBe('4,9km');
    expect(formatDistance(8532.14, 'en')).toBe('8,532.1km');
    expect(formatDistance(1, 'en')).toBe('1.0km');
    expect(formatDistance(0, 'en')).toBe('0m');
    expect(formatDistance(Number.NaN, 'en')).toBe('0m');
    expect(formatDistance(-3, 'en')).toBe('0m');
  });
});

describe('Wikipedia beam request / response', () => {
  it('asks the locale wiki for a generator geosearch with descriptions and every coordinate', () => {
    const url = geoSearchBeamUrl('ko', { lat: 37.5, lon: 127 }, 25);
    expect(url.startsWith('https://ko.wikipedia.org/w/api.php?')).toBe(true);
    const p = new URL(url).searchParams;
    expect(p.get('generator')).toBe('geosearch');
    expect(p.get('ggscoord')).toBe('37.5|127');
    expect(p.get('ggsradius')).toBe('10000');
    expect(p.get('ggslimit')).toBe('25');
    expect(p.get('prop')).toBe('description|coordinates');
    expect(p.get('colimit')).toBe('max');
    expect(p.get('origin')).toBe('*');
    expect(p.get('format')).toBe('json');
  });

  it('turns the pages object (or array) into raw hits and skips pages without a coordinate', () => {
    const json = {
      query: {
        pages: {
          '10': { pageid: 10, title: 'Han River', description: 'river', coordinates: [{ lat: 37.52, lon: 126.93 }] },
          '11': { pageid: 11, title: 'No Coord' },
          '12': { pageid: 12, title: 'Bad Coord', coordinates: [{ lat: 'x' }] },
        },
      },
    };
    const hits = parseGeoSearchPages(json, 'en');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({ id: 'wiki:en:10', title: 'Han River', lat: 37.52, lon: 126.93, url: 'https://en.wikipedia.org/wiki/Han_River', description: 'river' });
    const asArray = parseGeoSearchPages({ query: { pages: [{ pageid: 1, title: 'A B', coordinates: [{ lat: 1, lon: 2 }] }] } }, 'ko');
    expect(asArray[0].url).toBe('https://ko.wikipedia.org/wiki/A_B');
    expect(parseGeoSearchPages(null, 'en')).toEqual([]);
    expect(parseGeoSearchPages({ error: 'x' }, 'en')).toEqual([]);
  });
});

describe('sparse-region relief (mergeRadarLegs)', () => {
  const at = (bearing: number, km: number) => offsetPoint(SEOUL.lat, SEOUL.lon, bearing, km);
  const primary = [
    { id: 'wiki:ko:1', title: '국립중앙박물관', ...at(90, 2) },
    { id: 'wiki:ko:2', title: '카페 거리', ...at(180, 9.9) },
  ];

  it('keeps every primary hit and adds only secondary hits farther than 50 m from all of them', () => {
    const twin = { id: 'wiki:en:1', title: 'National Museum of Korea', ...at(90, 2.03) }; // 30 m from the ko page
    const fresh = { id: 'wiki:en:9', title: 'Hidden Garden', ...at(45, 4) };
    const merged = mergeRadarLegs(primary, [twin, fresh]);
    expect(merged.map((h) => h.id)).toEqual(['wiki:ko:1', 'wiki:ko:2', 'wiki:en:9']);
  });

  it('honours a custom separation, skips unranged secondaries and never mutates its inputs', () => {
    const near = { id: 'wiki:en:1', title: 'x', ...at(90, 2.2) }; // 200 m off
    expect(mergeRadarLegs(primary, [near]).map((h) => h.id)).toEqual(['wiki:ko:1', 'wiki:ko:2', 'wiki:en:1']);
    expect(mergeRadarLegs(primary, [near], 0.5).map((h) => h.id)).toEqual(['wiki:ko:1', 'wiki:ko:2']);
    expect(mergeRadarLegs(primary, [{ id: 'wiki:en:2', title: 'no coord', lat: Number.NaN, lon: 1 }])).toHaveLength(2);
    expect(mergeRadarLegs([], [near])).toHaveLength(1);
    expect(primary).toHaveLength(2);
  });

  it('the floor is eight blips', () => {
    expect(RADAR_SPARSE_FLOOR).toBe(8);
  });
});
