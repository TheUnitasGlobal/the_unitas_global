import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BODY_ELEMENTS,
  CONSTELLATION_KEYS,
  COSMOS_OBJECTS,
  COSMOS_TYPE_KEYS,
  EPOCH_KEYS,
  GALACTIC_CENTER,
  SCALE_LADDER,
  buildCosmosCard,
  cosmosTelemetry,
  epochOf,
  formatLightYears,
  formatScale,
  latitudeGravity,
  lightLeft,
  objectOfDay,
  rotationSpeedMs,
  secondsSinceLocalMidnight,
  travelledSinceMidnightKm,
  visibilityOf,
  type CosmosScopeWidget,
} from '../../lib/live/cosmos';
import { GEO_IP_STORAGE_KEY } from '../../lib/live/geoIp';

// REV-42 SPEC.md D-6 / §4-A -- the macro-cosmos slot's pure module: the
// bundled catalogue, the object-of-the-day pick, the light's departure,
// the epoch bands, the telemetry from the celestial engine, the observer's
// gravity / rotation, the tier-3 ladder and the card builder. Everything
// takes `nowMs`; the source-scan case asserts the module holds no clock
// and no randomness (1-A #14).

const SEOUL = { lat: 37.5665, lon: 126.978, name: 'Seoul' };
const T_2026_09_18_03Z = Date.UTC(2026, 8, 18, 3, 0, 0);

describe('COSMOS_OBJECTS catalogue integrity (§4-A)', () => {
  it('holds 24 rows with unique keys', () => {
    expect(COSMOS_OBJECTS).toHaveLength(24);
    expect(new Set(COSMOS_OBJECTS.map((o) => o.key)).size).toBe(24);
  });

  it('keeps every RA in [0, 24), every Dec in [-90, 90], every distance > 0', () => {
    for (const o of COSMOS_OBJECTS) {
      expect(o.raHours, o.key).toBeGreaterThanOrEqual(0);
      expect(o.raHours, o.key).toBeLessThan(24);
      expect(o.decDeg, o.key).toBeGreaterThanOrEqual(-90);
      expect(o.decDeg, o.key).toBeLessThanOrEqual(90);
      expect(o.distanceLy, o.key).toBeGreaterThan(0);
      expect(o.designation.length, o.key).toBeGreaterThan(0);
      if (o.magnitude !== null) expect(Number.isFinite(o.magnitude), o.key).toBe(true);
    }
  });

  it('uses exactly the 16 constellation keys and the 10 type keys of §4-A', () => {
    expect(CONSTELLATION_KEYS).toHaveLength(16);
    expect(COSMOS_TYPE_KEYS).toHaveLength(10);
    const usedConstellations = new Set(COSMOS_OBJECTS.map((o) => o.constellationKey));
    const usedTypes = new Set(COSMOS_OBJECTS.map((o) => o.typeKey));
    expect([...usedConstellations].sort()).toEqual([...CONSTELLATION_KEYS].sort());
    expect([...usedTypes].sort()).toEqual([...COSMOS_TYPE_KEYS].sort());
  });

  it('pins the anchors: M31, Sgr A* (== the galactic centre) and Sirius', () => {
    const m31 = COSMOS_OBJECTS.find((o) => o.key === 'm31')!;
    expect(m31).toMatchObject({ designation: 'M31', typeKey: 'galaxy', constellationKey: 'andromeda', distanceLy: 2_537_000 });
    const sgrA = COSMOS_OBJECTS.find((o) => o.key === 'sgrA')!;
    expect(sgrA.magnitude).toBeNull();
    expect(GALACTIC_CENTER).toEqual({ raHours: sgrA.raHours, decDeg: sgrA.decDeg });
    const sirius = COSMOS_OBJECTS.find((o) => o.key === 'sirius')!;
    expect(sirius.magnitude).toBeCloseTo(-1.46, 2);
    expect(sirius.distanceLy).toBeCloseTo(8.6, 5);
  });
});

describe('objectOfDay', () => {
  it('walks the catalogue in order and wraps at 24', () => {
    expect(objectOfDay(0).key).toBe(COSMOS_OBJECTS[0].key);
    expect(objectOfDay(23).key).toBe(COSMOS_OBJECTS[23].key);
    expect(objectOfDay(24).key).toBe(COSMOS_OBJECTS[0].key);
    expect(objectOfDay(20_714).key).toBe(COSMOS_OBJECTS[20_714 % 24].key);
  });

  it('never throws on a negative or fractional index', () => {
    expect(objectOfDay(-1).key).toBe(COSMOS_OBJECTS[23].key);
    expect(objectOfDay(2.9).key).toBe(COSMOS_OBJECTS[2].key);
  });
});

describe('epochOf thresholds (§4-A)', () => {
  it('has the ten epoch keys in band order', () => {
    expect(EPOCH_KEYS).toEqual([
      'thisLife',
      'writtenHistory',
      'agriculture',
      'homoSapiens',
      'earlyHumans',
      'greatApes',
      'dinosaursEnd',
      'dinosaurs',
      'complexLife',
      'earlyEarth',
    ]);
  });

  it.each([
    [0, 'thisLife'],
    [120, 'thisLife'],
    [121, 'writtenHistory'],
    [5500, 'writtenHistory'],
    [5501, 'agriculture'],
    [12_000, 'agriculture'],
    [12_001, 'homoSapiens'],
    [300_000, 'homoSapiens'],
    [300_001, 'earlyHumans'],
    [2_800_000, 'earlyHumans'],
    [2_800_001, 'greatApes'],
    [25_000_000, 'greatApes'],
    [25_000_001, 'dinosaursEnd'],
    [66_000_000, 'dinosaursEnd'],
    [66_000_001, 'dinosaurs'],
    [230_000_000, 'dinosaurs'],
    [230_000_001, 'complexLife'],
    [600_000_000, 'complexLife'],
    [600_000_001, 'earlyEarth'],
    [2_443_000_000, 'earlyEarth'],
  ])('%i years -> %s', (years, key) => {
    expect(epochOf(years)).toBe(key);
  });
});

describe('lightLeft', () => {
  it('M31 (2.5 Mly) is "n years ago", Sirius (8.6 ly) is a CE year, a 3000-ly object is BCE', () => {
    expect(lightLeft(2_537_000, 2026)).toEqual({ mode: 'ago', n: 2_537_000 });
    expect(lightLeft(8.6, 2026)).toEqual({ mode: 'ce', n: 2017 });
    expect(lightLeft(3000, 2026)).toEqual({ mode: 'bce', n: 975 });
  });

  it('has no year zero: a departure exactly at the year of the era boundary is 1 BCE', () => {
    expect(lightLeft(2026, 2026)).toEqual({ mode: 'bce', n: 1 });
    expect(lightLeft(2025, 2026)).toEqual({ mode: 'ce', n: 1 });
  });

  it('switches from a BCE year to "years ago" past 10,000 BCE', () => {
    expect(lightLeft(12_025, 2026).mode).toBe('bce');
    expect(lightLeft(12_026, 2026)).toEqual({ mode: 'ago', n: 12_026 });
  });
});

describe('visibilityOf', () => {
  it('below the horizon wins over daylight; above it, daylight hides; otherwise visible', () => {
    expect(visibilityOf(-5, true)).toBe('belowHorizon');
    expect(visibilityOf(-5, false)).toBe('belowHorizon');
    expect(visibilityOf(0, false)).toBe('belowHorizon');
    expect(visibilityOf(30, true)).toBe('daylight');
    expect(visibilityOf(30, false)).toBe('visible');
  });
});

describe('cosmosTelemetry', () => {
  it('Seoul at 2026-09-18T03:00Z (12:00 KST) is daylight with every altitude finite and every azimuth in [0, 360)', () => {
    const tele = cosmosTelemetry(SEOUL, T_2026_09_18_03Z);
    expect(tele.daylight).toBe(true);
    expect(tele.sun.alt).toBeGreaterThan(30);
    expect(tele.objects).toHaveLength(24);
    for (const o of [...tele.objects, tele.sun, tele.moon, tele.galacticCenter]) {
      expect(Number.isFinite(o.alt)).toBe(true);
      expect(o.alt).toBeGreaterThanOrEqual(-90);
      expect(o.alt).toBeLessThanOrEqual(90);
      expect(o.az).toBeGreaterThanOrEqual(0);
      expect(o.az).toBeLessThan(360);
    }
    // In daylight nothing but the Sun is "visible".
    expect(tele.objects.every((o) => !o.visible)).toBe(true);
    // The galactic centre IS Sgr A*.
    const sgrA = tele.objects.find((o) => o.key === 'sgrA')!;
    expect(sgrA.alt).toBeCloseTo(tele.galacticCenter.alt, 9);
    expect(sgrA.az).toBeCloseTo(tele.galacticCenter.az, 9);
  });

  it('at local midnight in Seoul the Sun is far below the horizon and some object is visible', () => {
    const midnightKst = Date.UTC(2026, 8, 17, 15, 0, 0);
    const tele = cosmosTelemetry(SEOUL, midnightKst);
    expect(tele.daylight).toBe(false);
    expect(tele.sun.alt).toBeLessThan(-30);
    expect(tele.objects.some((o) => o.visible)).toBe(true);
    for (const o of tele.objects) expect(o.visible).toBe(o.alt > 0);
  });

  it('a circumpolar object never sets for a high-latitude observer', () => {
    // M31 (Dec +41.27) from Tromsø (69.65 N): alt >= 41.27 - (90 - 69.65) > 0 always.
    for (let h = 0; h < 24; h += 3) {
      const tele = cosmosTelemetry({ lat: 69.65, lon: 18.96, name: 'Tromsø' }, Date.UTC(2026, 8, 18, h));
      expect(tele.objects.find((o) => o.key === 'm31')!.alt).toBeGreaterThan(0);
    }
  });
});

describe('travelled since local midnight', () => {
  it('local midnight is UTC + lon / 15 h: Seoul (126.978 E) restarts at 15:32:05 UTC', () => {
    // 126.978 / 15 h = 8.4652 h = 30,474.7 s east of Greenwich.
    const utcMidnight = Date.UTC(2026, 8, 18, 0, 0, 0);
    const seoulMidnightUtc = utcMidnight + (24 * 3600 - 126.978 * 240) * 1000;
    expect(secondsSinceLocalMidnight(seoulMidnightUtc, 126.978)).toBeCloseTo(0, 3);
    expect(secondsSinceLocalMidnight(seoulMidnightUtc + 3_600_000, 126.978)).toBeCloseTo(3600, 3);
    expect(secondsSinceLocalMidnight(seoulMidnightUtc - 1000, 126.978)).toBeCloseTo(86_399, 3);
  });

  it('is 29.78 km/s × seconds and grows monotonically through a day', () => {
    // Seoul's mean-solar midnight of 2026-09-18 falls at 15:32:05 UTC on the 17th; start one second after it.
    const start = Date.UTC(2026, 8, 17, 0, 0, 0) + (86_400 - SEOUL.lon * 240) * 1000 + 1_000;
    let previous = -1;
    for (let s = 0; s < 86_000; s += 600) {
      const km = travelledSinceMidnightKm(start + s * 1000, SEOUL.lon);
      expect(km).toBeGreaterThan(previous);
      previous = km;
    }
    expect(travelledSinceMidnightKm(start + 3600 * 1000, SEOUL.lon) - travelledSinceMidnightKm(start, SEOUL.lon)).toBeCloseTo(29.78 * 3600, 3);
    expect(previous).toBeLessThan(29.78 * 86_400);
  });
});

describe('latitude gravity and rotation', () => {
  it('WGS84 gravity: 9.780 at the equator, 9.832 at the pole, ~9.80 at 45°', () => {
    expect(latitudeGravity(0)).toBeCloseTo(9.780, 3);
    expect(latitudeGravity(90)).toBeCloseTo(9.832, 3);
    expect(latitudeGravity(45)).toBeCloseTo(9.806, 2);
    expect(latitudeGravity(-45)).toBeCloseTo(latitudeGravity(45), 9);
  });

  it('rotation speed: 465 m/s at the equator, 0 at the pole, cos-scaled between', () => {
    expect(rotationSpeedMs(0)).toBeCloseTo(465.1, 1);
    expect(rotationSpeedMs(90)).toBeCloseTo(0, 6);
    expect(rotationSpeedMs(60)).toBeCloseTo(232.55, 1);
  });
});

describe('tier-3 constants', () => {
  it('SCALE_LADDER has the eleven rungs in order and formats with the locale grouping', () => {
    expect(SCALE_LADDER.map((r) => r.key)).toEqual([
      'you',
      'earth',
      'sunEarth',
      'heliopause',
      'oort',
      'proxima',
      'milkyWay',
      'localGroup',
      'virgo',
      'laniakea',
      'observable',
    ]);
    expect(formatScale(SCALE_LADDER[0], 'en')).toBe('1.7 m');
    expect(formatScale(SCALE_LADDER[1], 'en')).toBe('12,742 km');
    expect(formatScale(SCALE_LADDER[2], 'en')).toBe('1 AU = 149,597,870 km');
    expect(formatScale(SCALE_LADDER[3], 'en')).toBe('≈ 120 AU');
    expect(formatScale(SCALE_LADDER[6], 'de')).toBe('≈ 105.700 ly');
    expect(formatScale(SCALE_LADDER[10], 'ko')).toBe('≈ 93 Gly');
  });

  it('BODY_ELEMENTS: eight rows, the accepted origins, shares summing to ~97.7 % (the rest is trace)', () => {
    expect(BODY_ELEMENTS.map((e) => e.key)).toEqual(['oxygen', 'carbon', 'hydrogen', 'nitrogen', 'calcium', 'phosphorus', 'iron', 'gold']);
    const origin = Object.fromEntries(BODY_ELEMENTS.map((e) => [e.key, e.originKey]));
    expect(origin.hydrogen).toBe('bigBang');
    expect(origin.carbon).toBe('stellarFusion');
    expect(origin.nitrogen).toBe('stellarFusion');
    expect(origin.oxygen).toBe('stellarFusion');
    expect(origin.calcium).toBe('supernova');
    expect(origin.phosphorus).toBe('supernova');
    expect(origin.iron).toBe('supernova');
    expect(origin.gold).toBe('neutronMerger');
    const total = BODY_ELEMENTS.reduce((sum, e) => sum + e.bodyPct, 0);
    expect(total).toBeGreaterThan(97);
    expect(total).toBeLessThan(100);
  });

  it('formatLightYears keeps two decimals under 100 ly and whole numbers above', () => {
    expect(formatLightYears(4.246, 'en')).toBe('4.25');
    expect(formatLightYears(8.6, 'en')).toBe('8.6');
    expect(formatLightYears(2_537_000, 'en')).toBe('2,537,000');
    expect(formatLightYears(2_537_000, 'de')).toBe('2.537.000');
  });
});

describe('buildCosmosCard', () => {
  const store: Record<string, string> = {};
  afterEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.unstubAllGlobals();
  });

  function stubStorage() {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
  }

  it('card: 8 facts (hero name value-less + emphasis), 4 rows by altitude, the cosmosScope widget, no URL, cursor null', () => {
    stubStorage();
    const card = buildCosmosCard({ locale: 'ko', country: 'KR' }, undefined, T_2026_09_18_03Z);
    expect(card.facts).toHaveLength(8);
    const featured = objectOfDay(Math.floor(T_2026_09_18_03Z / 86_400_000));
    expect(card.facts[0]).toEqual({ labelKey: `Rev42.cosmos.objects.${featured.key}.name`, value: '', emphasis: true });
    expect(card.facts.filter((f) => f.emphasis)).toHaveLength(1);
    expect(card.facts[1].labelKey).toBe(`Rev42.cosmos.types.${featured.typeKey}`);
    expect(card.facts[2].labelKey).toBe(`Rev42.cosmos.constellations.${featured.constellationKey}`);
    expect(card.facts[3]).toMatchObject({ labelKey: 'Rev42.cosmos.facts.distance', unit: ' ly' });
    expect(card.facts[4]).toMatchObject({ labelKey: 'Rev42.cosmos.facts.altitude', unit: '°' });
    expect(card.facts[5].labelKey).toMatch(/^Rev42\.cosmos\.visibility\.(visible|belowHorizon|daylight)$/);
    expect(card.facts[6]).toMatchObject({ labelKey: 'Rev42.cosmos.facts.observer', value: 'Seoul' });
    expect(card.facts[7]).toMatchObject({ labelKey: 'Rev42.cosmos.facts.travelledToday', unit: ' km' });
    expect(card.facts[7].value).toMatch(/^[\d,]+$/);

    expect(card.items).toHaveLength(4);
    const alts = card.items.map((i) => Number.parseInt(i.meta!, 10));
    expect([...alts].sort((a, b) => b - a)).toEqual(alts);
    for (const item of card.items) {
      expect(item.url).toBeUndefined();
      expect(item.title).toMatch(/^i18n:Rev42\.cosmos\.objects\.[A-Za-z0-9]+\.name$/);
      expect(item.meta).toMatch(/^-?\d+° · [NESW]{1,3} · [\d,.]+ ly$/);
      expect(item.color).toBe('#8b5cf6');
    }
    expect(card.items.map((i) => i.rank)).toEqual([1, 2, 3, 4]);

    expect(card.subject).toEqual({ term: featured.designation });
    expect(card.updatedAt).toBe(T_2026_09_18_03Z);
    expect(card.cursor).toBeNull();

    const widget = card.widget as CosmosScopeWidget;
    expect(widget.kind).toBe('cosmosScope');
    expect(widget.nowMs).toBe(T_2026_09_18_03Z);
    expect(widget.featuredKey).toBe(featured.key);
    expect(widget.objects).toHaveLength(24);
    expect(widget.observer).toEqual({ lat: 37.5665, lon: 126.978, name: 'Seoul' });
    expect(Number.isFinite(widget.sun.alt) && Number.isFinite(widget.moon.az) && Number.isFinite(widget.galacticCenter.alt)).toBe(true);
  });

  it('deep: the whole catalogue as rows, still ranked by altitude', () => {
    stubStorage();
    const deep = buildCosmosCard({ locale: 'en', country: 'US' }, { deep: 1 }, T_2026_09_18_03Z);
    expect(deep.items).toHaveLength(24);
    expect(new Set(deep.items.map((i) => i.id)).size).toBe(24);
    const alts = deep.items.map((i) => Number.parseInt(i.meta!, 10));
    expect([...alts].sort((a, b) => b - a)).toEqual(alts);
    expect(deep.facts[6].value).toBe('New York');
  });

  it('observer resolution copies knownPlace: the Geo-IP fix wins over the locale default, filtered by the selected country', () => {
    stubStorage();
    store[GEO_IP_STORAGE_KEY] = JSON.stringify({ country: 'PT', lat: 38.7223, lon: -9.1393, city: 'Lisbon', at: T_2026_09_18_03Z });
    const lisbon = buildCosmosCard({ locale: 'ko', country: 'PT' }, undefined, T_2026_09_18_03Z);
    expect((lisbon.widget as CosmosScopeWidget).observer).toEqual({ lat: 38.7223, lon: -9.1393, name: 'Lisbon' });
    const seoul = buildCosmosCard({ locale: 'ko', country: 'KR' }, undefined, T_2026_09_18_03Z);
    expect((seoul.widget as CosmosScopeWidget).observer.name).not.toBe('Lisbon');
  });

  it('is deterministic: the same instant and place yields the same card twice', () => {
    stubStorage();
    const a = buildCosmosCard({ locale: 'ja', country: 'JP' }, undefined, T_2026_09_18_03Z);
    const b = buildCosmosCard({ locale: 'ja', country: 'JP' }, undefined, T_2026_09_18_03Z);
    expect(a).toEqual(b);
  });
});

describe('source scan (1-A #14)', () => {
  it('lib/live/cosmos.ts contains neither Math.random( nor Date.now(', () => {
    const src = readFileSync(resolve(__dirname, '../../lib/live/cosmos.ts'), 'utf8');
    expect(src.includes('Math.random(')).toBe(false);
    expect(src.includes('Date.now(')).toBe(false);
    expect(src).not.toMatch(/new Date\(\)/);
  });
});
