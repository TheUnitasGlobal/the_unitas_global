/**
 * REV-42 D-6 (founder directive 2026-09-18, mission 2) -- the macro-cosmos
 * telemetry behind the `cosmos` discovery slot: a bundled catalogue of 24
 * deep-sky objects ranged from the visitor's own point by the celestial
 * engine (lib/live/celestial.ts), the Earth's motions since the observer's
 * local midnight, and the tier-3 constants (epoch bands, the body's
 * elemental lineage, the supercluster ladder, latitude gravity).
 *
 * Pure by contract (SPEC 1-A #14): no clock read, no random source;
 * every function takes `nowMs` (or a day index derived from it in the
 * adapter's `load()`) and returns the same answer for the same input, so
 * the card, the deep modal and the tier-3 view never disagree about one
 * sky. No fetch either -- `SLOT_SOURCES.cosmos` names Wikipedia for the
 * OUTBOUND links only (SPEC D-1).
 *
 * The four-state truth contract (REV-40): every number here is either a
 * catalogue constant (cited below) or a computation from `nowMs` and the
 * observer's coordinates; nothing is estimated to fill a gap.
 */
import { altAz, moonPosition, sunPosition } from '@/lib/live/celestial';
import type { DeepCursor, SlotCard, SlotContext, SlotFact, SlotItem } from '@/lib/live/discoverySlots';
import { readGeoIpFix } from '@/lib/live/geoIp';
import { readWeatherCache } from '@/lib/live/useLiveWeather';
import { windDirLabel } from '@/lib/live/weatherDeep';
import { resolveDeeperPlace } from '@/lib/uai/deeperAnchor';

/* ------------------------------------------------------------------ */
/* Widget contract (SPEC §3 -- re-exported by discoverySlots)            */
/* ------------------------------------------------------------------ */

export interface CosmosScopeWidget {
  kind: 'cosmosScope';
  nowMs: number;
  observer: { lat: number; lon: number; name: string };
  featuredKey: string;
  objects: Array<{ key: string; alt: number; az: number; visible: boolean }>;
  sun: { alt: number; az: number };
  moon: { alt: number; az: number };
  galacticCenter: { alt: number; az: number };
}

/* ------------------------------------------------------------------ */
/* Catalogue (SPEC §4-A, verbatim)                                       */
/* ------------------------------------------------------------------ */

export const COSMOS_TYPE_KEYS = [
  'galaxy',
  'nebula',
  'openCluster',
  'globularCluster',
  'blackHole',
  'pulsar',
  'quasar',
  'star',
  'supernovaRemnant',
  'planetaryNebula',
] as const;
export type CosmosTypeKey = (typeof COSMOS_TYPE_KEYS)[number];

export const CONSTELLATION_KEYS = [
  'andromeda',
  'canesVenatici',
  'virgo',
  'dorado',
  'centaurus',
  'orion',
  'taurus',
  'lyra',
  'aquarius',
  'carina',
  'serpens',
  'hercules',
  'sagittarius',
  'cygnus',
  'vela',
  'canisMajor',
] as const;
export type ConstellationKey = (typeof CONSTELLATION_KEYS)[number];

export interface CosmosObject {
  key: string;
  /** The catalogue designation -- shown verbatim in every locale. */
  designation: string;
  typeKey: CosmosTypeKey;
  constellationKey: ConstellationKey;
  /** J2000 right ascension, HOURS [0, 24). */
  raHours: number;
  /** J2000 declination, degrees [-90, 90]. */
  decDeg: number;
  /** Light-years; for the light's travel time 1 ly == 1 year by definition. */
  distanceLy: number;
  /** Apparent visual magnitude; null where the catalogue has none (Sgr A*
   *  is not an optical source). */
  magnitude: number | null;
}

/** The 24 rows of SPEC §4-A in table order (J2000 coordinates from the
 *  Messier / NGC / SIMBAD catalogues, distances as the SPEC fixed them). */
export const COSMOS_OBJECTS: readonly CosmosObject[] = [
  { key: 'm31', designation: 'M31', typeKey: 'galaxy', constellationKey: 'andromeda', raHours: 0.712, decDeg: 41.27, distanceLy: 2_537_000, magnitude: 3.4 },
  { key: 'm51', designation: 'M51', typeKey: 'galaxy', constellationKey: 'canesVenatici', raHours: 13.498, decDeg: 47.2, distanceLy: 23_000_000, magnitude: 8.4 },
  { key: 'm104', designation: 'M104', typeKey: 'galaxy', constellationKey: 'virgo', raHours: 12.667, decDeg: -11.62, distanceLy: 29_300_000, magnitude: 8.0 },
  { key: 'm87', designation: 'M87', typeKey: 'galaxy', constellationKey: 'virgo', raHours: 12.514, decDeg: 12.39, distanceLy: 53_500_000, magnitude: 8.6 },
  { key: 'lmc', designation: 'LMC', typeKey: 'galaxy', constellationKey: 'dorado', raHours: 5.393, decDeg: -69.76, distanceLy: 163_000, magnitude: 0.9 },
  { key: 'centaurusA', designation: 'NGC 5128', typeKey: 'galaxy', constellationKey: 'centaurus', raHours: 13.425, decDeg: -43.02, distanceLy: 12_000_000, magnitude: 6.8 },
  { key: 'm42', designation: 'M42', typeKey: 'nebula', constellationKey: 'orion', raHours: 5.588, decDeg: -5.39, distanceLy: 1344, magnitude: 4.0 },
  { key: 'm1', designation: 'M1', typeKey: 'supernovaRemnant', constellationKey: 'taurus', raHours: 5.575, decDeg: 22.02, distanceLy: 6500, magnitude: 8.4 },
  { key: 'm57', designation: 'M57', typeKey: 'planetaryNebula', constellationKey: 'lyra', raHours: 18.893, decDeg: 33.03, distanceLy: 2570, magnitude: 8.8 },
  { key: 'ngc7293', designation: 'NGC 7293', typeKey: 'planetaryNebula', constellationKey: 'aquarius', raHours: 22.493, decDeg: -20.84, distanceLy: 655, magnitude: 7.6 },
  { key: 'carina', designation: 'NGC 3372', typeKey: 'nebula', constellationKey: 'carina', raHours: 10.752, decDeg: -59.87, distanceLy: 8500, magnitude: 1.0 },
  { key: 'm16', designation: 'M16', typeKey: 'nebula', constellationKey: 'serpens', raHours: 18.313, decDeg: -13.82, distanceLy: 7000, magnitude: 6.0 },
  { key: 'm45', designation: 'M45', typeKey: 'openCluster', constellationKey: 'taurus', raHours: 3.79, decDeg: 24.12, distanceLy: 444, magnitude: 1.6 },
  { key: 'm13', designation: 'M13', typeKey: 'globularCluster', constellationKey: 'hercules', raHours: 16.695, decDeg: 36.46, distanceLy: 22_200, magnitude: 5.8 },
  { key: 'omegaCentauri', designation: 'NGC 5139', typeKey: 'globularCluster', constellationKey: 'centaurus', raHours: 13.447, decDeg: -47.48, distanceLy: 15_800, magnitude: 3.9 },
  { key: 'hyades', designation: 'Mel 25', typeKey: 'openCluster', constellationKey: 'taurus', raHours: 4.45, decDeg: 15.87, distanceLy: 153, magnitude: 0.5 },
  { key: 'sgrA', designation: 'Sgr A*', typeKey: 'blackHole', constellationKey: 'sagittarius', raHours: 17.761, decDeg: -29.01, distanceLy: 26_670, magnitude: null },
  { key: 'cygnusX1', designation: 'Cyg X-1', typeKey: 'blackHole', constellationKey: 'cygnus', raHours: 19.973, decDeg: 35.2, distanceLy: 7200, magnitude: 8.9 },
  { key: 'velaPulsar', designation: 'PSR B0833−45', typeKey: 'pulsar', constellationKey: 'vela', raHours: 8.588, decDeg: -45.18, distanceLy: 959, magnitude: 23.6 },
  { key: 'quasar3c273', designation: '3C 273', typeKey: 'quasar', constellationKey: 'virgo', raHours: 12.485, decDeg: 2.05, distanceLy: 2_443_000_000, magnitude: 12.9 },
  { key: 'betelgeuse', designation: 'α Ori', typeKey: 'star', constellationKey: 'orion', raHours: 5.919, decDeg: 7.41, distanceLy: 548, magnitude: 0.5 },
  { key: 'proxima', designation: 'α Cen C', typeKey: 'star', constellationKey: 'centaurus', raHours: 14.495, decDeg: -62.68, distanceLy: 4.246, magnitude: 11.1 },
  { key: 'vega', designation: 'α Lyr', typeKey: 'star', constellationKey: 'lyra', raHours: 18.616, decDeg: 38.78, distanceLy: 25.04, magnitude: 0.03 },
  { key: 'sirius', designation: 'α CMa', typeKey: 'star', constellationKey: 'canisMajor', raHours: 6.752, decDeg: -16.72, distanceLy: 8.6, magnitude: -1.46 },
];

/** The galactic centre, i.e. Sgr A*'s J2000 coordinates. */
export const GALACTIC_CENTER = { raHours: 17.761, decDeg: -29.01 } as const;

export function cosmosObjectByKey(key: string): CosmosObject | undefined {
  return COSMOS_OBJECTS.find((o) => o.key === key);
}

/** The object of the day: the UTC day index (`Math.floor(nowMs /
 *  86_400_000)`, computed once in `load()`) modulo the catalogue -- the
 *  awardOfDay pattern, so every visitor on Earth sees the same object on
 *  the same UTC day and the pick never resets at a year boundary. */
export function objectOfDay(dayIndex: number): CosmosObject {
  const n = COSMOS_OBJECTS.length;
  const i = ((Math.floor(dayIndex) % n) + n) % n;
  return COSMOS_OBJECTS[i];
}

/* ------------------------------------------------------------------ */
/* Light's departure and the epoch bands                                 */
/* ------------------------------------------------------------------ */

export type LightLeftMode = 'ago' | 'bce' | 'ce';

export interface LightLeft {
  mode: LightLeftMode;
  /** `ce` / `bce`: the calendar year (positive, no year zero); `ago`: the
   *  number of years the light has travelled. */
  n: number;
}

/** Earlier than this BCE year a calendar label stops meaning anything to a
 *  reader (written history is ~5,500 years deep), so the light's departure
 *  is stated as "n years ago" instead. */
export const CALENDAR_BCE_LIMIT = 10_000;

/** When the light now arriving set out: light-years ARE years of travel,
 *  so the departure year is `nowYear - distanceLy` (rounded to a whole
 *  year). Positive years are CE; zero or negative years are BCE with the
 *  astronomical-year shift (year 0 == 1 BCE) as far back as
 *  CALENDAR_BCE_LIMIT; anything earlier reads as "n years ago". */
export function lightLeft(distanceLy: number, nowYear: number): LightLeft {
  const years = Math.max(0, Math.round(distanceLy));
  const departure = nowYear - years;
  if (departure >= 1) return { mode: 'ce', n: departure };
  const bce = 1 - departure;
  if (bce <= CALENDAR_BCE_LIMIT) return { mode: 'bce', n: bce };
  return { mode: 'ago', n: years };
}

export const EPOCH_KEYS = [
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
] as const;
export type EpochKey = (typeof EPOCH_KEYS)[number];

/** Upper bound (years before now, inclusive) of each band but the last --
 *  SPEC §4-A: thisLife ≤120 · writtenHistory ≤5500 · agriculture ≤12000 ·
 *  homoSapiens ≤300000 · earlyHumans ≤2800000 · greatApes ≤25000000 ·
 *  dinosaursEnd ≤66000000 · dinosaurs ≤230000000 · complexLife ≤600000000
 *  · earlyEarth beyond. */
const EPOCH_BOUNDS: ReadonlyArray<[EpochKey, number]> = [
  ['thisLife', 120],
  ['writtenHistory', 5500],
  ['agriculture', 12_000],
  ['homoSapiens', 300_000],
  ['earlyHumans', 2_800_000],
  ['greatApes', 25_000_000],
  ['dinosaursEnd', 66_000_000],
  ['dinosaurs', 230_000_000],
  ['complexLife', 600_000_000],
];

export function epochOf(years: number): EpochKey {
  const y = Math.max(0, years);
  for (const [key, bound] of EPOCH_BOUNDS) if (y <= bound) return key;
  return 'earlyEarth';
}

/* ------------------------------------------------------------------ */
/* Telemetry                                                             */
/* ------------------------------------------------------------------ */

export type CosmosVisibility = 'visible' | 'belowHorizon' | 'daylight';

/** Below the mathematical horizon wins over daylight (the object is not
 *  in the sky at all); above it, daylight hides everything but the Sun
 *  and the Moon; otherwise it is up and the sky is dark. */
export function visibilityOf(alt: number, daylight: boolean): CosmosVisibility {
  if (!(alt > 0)) return 'belowHorizon';
  return daylight ? 'daylight' : 'visible';
}

/** Earth's mean orbital speed around the Sun, km/s. */
export const EARTH_ORBIT_KM_S = 29.78;
/** The Solar System's orbital speed around the galactic centre, km/s. */
export const GALACTIC_ORBIT_KM_S = 230;
/** The Solar System's motion against the cosmic microwave background
 *  (the CMB dipole), km/s. */
export const CMB_DIPOLE_KM_S = 370;

/** The Sun's altitude below which the sky counts as dark for deep-sky
 *  objects (civil dusk, -6°). */
export const DAYLIGHT_SUN_ALT = -6;

export interface CosmosObserver {
  lat: number;
  lon: number;
  name: string;
}

export interface CosmosBodyPosition {
  alt: number;
  az: number;
}

export interface CosmosTelemetry {
  objects: Array<{ key: string; alt: number; az: number; visible: boolean }>;
  sun: CosmosBodyPosition;
  moon: CosmosBodyPosition;
  galacticCenter: CosmosBodyPosition;
  /** Sun altitude > DAYLIGHT_SUN_ALT. */
  daylight: boolean;
  /** EARTH_ORBIT_KM_S × seconds since the observer's local midnight. */
  travelledSinceMidnightKm: number;
}

const SECONDS_PER_DAY = 86_400;

/** Seconds elapsed since the observer's most recent local midnight, where
 *  local time is approximated as UTC + lon / 15 h (mean solar time of the
 *  meridian -- no zone table, so a zone's political offset can differ from
 *  this by up to about an hour; the figure is a physics reading, not a
 *  clock). */
export function secondsSinceLocalMidnight(nowMs: number, lonDeg: number): number {
  const localSeconds = nowMs / 1000 + (lonDeg / 15) * 3600;
  return ((localSeconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
}

export function travelledSinceMidnightKm(nowMs: number, lonDeg: number): number {
  return EARTH_ORBIT_KM_S * secondsSinceLocalMidnight(nowMs, lonDeg);
}

export function cosmosTelemetry(observer: CosmosObserver, nowMs: number): CosmosTelemetry {
  const { lat, lon } = observer;
  const sunEq = sunPosition(nowMs);
  const moonEq = moonPosition(nowMs);
  const sun = altAz(sunEq.ra, sunEq.dec, nowMs, lat, lon);
  const moon = altAz(moonEq.ra, moonEq.dec, nowMs, lat, lon);
  const galacticCenter = altAz(GALACTIC_CENTER.raHours, GALACTIC_CENTER.decDeg, nowMs, lat, lon);
  const daylight = sun.alt > DAYLIGHT_SUN_ALT;
  const objects = COSMOS_OBJECTS.map((o) => {
    const h = altAz(o.raHours, o.decDeg, nowMs, lat, lon);
    return { key: o.key, alt: h.alt, az: h.az, visible: visibilityOf(h.alt, daylight) === 'visible' };
  });
  return {
    objects,
    sun: { alt: sun.alt, az: sun.az },
    moon: { alt: moon.alt, az: moon.az },
    galacticCenter: { alt: galacticCenter.alt, az: galacticCenter.az },
    daylight,
    travelledSinceMidnightKm: travelledSinceMidnightKm(nowMs, lon),
  };
}

/* ------------------------------------------------------------------ */
/* Gravity and rotation at the observer's latitude                       */
/* ------------------------------------------------------------------ */

/** WGS84 international gravity formula (Somigliana form as published by
 *  NGA): g(φ) = 9.780327 × (1 + 0.0053024 sin²φ − 0.0000058 sin²2φ) m/s²
 *  at sea level. */
export function latitudeGravity(latDeg: number): number {
  const phi = (latDeg * Math.PI) / 180;
  const s1 = Math.sin(phi);
  const s2 = Math.sin(2 * phi);
  return 9.780327 * (1 + 0.0053024 * s1 * s1 - 0.0000058 * s2 * s2);
}

/** Equatorial rotational speed of the Earth's surface, m/s
 *  (2π × 6,378,137 m / 86,164.1 s sidereal day). */
export const EQUATORIAL_ROTATION_M_S = 465.1;

/** Surface speed from the Earth's rotation at latitude φ: 465.1 × cos φ. */
export function rotationSpeedMs(latDeg: number): number {
  return EQUATORIAL_ROTATION_M_S * Math.cos((latDeg * Math.PI) / 180);
}

/* ------------------------------------------------------------------ */
/* Tier-3 constants: the supercluster ladder and the body's lineage       */
/* ------------------------------------------------------------------ */

export type ScaleRungKey =
  | 'you'
  | 'earth'
  | 'sunEarth'
  | 'heliopause'
  | 'oort'
  | 'proxima'
  | 'milkyWay'
  | 'localGroup'
  | 'virgo'
  | 'laniakea'
  | 'observable';

export interface ScaleRung {
  key: ScaleRungKey;
  value: number;
  /** A unit symbol, rendered as-is in every locale. */
  unit: 'm' | 'km' | 'AU' | 'ly' | 'Mly' | 'Gly';
  /** A rounded, order-of-magnitude figure (rendered with "≈"). */
  approx?: true;
  /** A leading equivalence ("1 AU = "), rendered as-is. */
  prefix?: string;
}

/** The eleven rungs of SPEC D-6: a person, the Earth (mean diameter),
 *  the astronomical unit, the heliopause (~120 AU, Voyager 1's crossing),
 *  the Oort cloud's outer edge (~1.5 ly), Proxima Centauri, the Milky
 *  Way's stellar disc (~105,700 ly), the Local Group (~10 Mly), the Virgo
 *  Supercluster (~110 Mly), Laniakea (~520 Mly) and the observable
 *  universe (~93 Gly diameter). */
export const SCALE_LADDER: readonly ScaleRung[] = [
  { key: 'you', value: 1.7, unit: 'm' },
  { key: 'earth', value: 12_742, unit: 'km' },
  { key: 'sunEarth', value: 149_597_870, unit: 'km', prefix: '1 AU = ' },
  { key: 'heliopause', value: 120, unit: 'AU', approx: true },
  { key: 'oort', value: 1.5, unit: 'ly', approx: true },
  { key: 'proxima', value: 4.246, unit: 'ly' },
  { key: 'milkyWay', value: 105_700, unit: 'ly', approx: true },
  { key: 'localGroup', value: 10, unit: 'Mly', approx: true },
  { key: 'virgo', value: 110, unit: 'Mly', approx: true },
  { key: 'laniakea', value: 520, unit: 'Mly', approx: true },
  { key: 'observable', value: 93, unit: 'Gly', approx: true },
];

function numberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat | null {
  try {
    return new Intl.NumberFormat(locale, options);
  } catch {
    try {
      return new Intl.NumberFormat('en', options);
    } catch {
      return null;
    }
  }
}

/** "≈ 105,700 ly" / "1 AU = 149,597,870 km" with the locale's grouping
 *  and the rung's own decimals (never more than three). */
export function formatScale(rung: ScaleRung, locale: string): string {
  const fmt = numberFormat(locale, { maximumFractionDigits: 3 });
  const digits = fmt ? fmt.format(rung.value) : String(rung.value);
  return `${rung.approx ? '≈ ' : ''}${rung.prefix ?? ''}${digits} ${rung.unit}`;
}

export type ElementOriginKey = 'bigBang' | 'stellarFusion' | 'supernova' | 'neutronMerger' | 'cosmicRay';

export interface BodyElement {
  key: 'oxygen' | 'carbon' | 'hydrogen' | 'nitrogen' | 'calcium' | 'phosphorus' | 'iron' | 'gold';
  /** Percent of adult body mass (the conventional composition table:
   *  O 65, C 18.5, H 9.5, N 3.2, Ca 1.5, P 1.0; iron ~4 g / 70 kg =
   *  0.006 %; gold ~0.2 mg / 70 kg ≈ 0.00002 %). */
  bodyPct: number;
  /** The dominant nucleosynthesis channel by the accepted attribution:
   *  hydrogen from Big Bang nucleosynthesis; carbon, nitrogen and oxygen
   *  from stellar fusion (the CNO cycle and helium burning, returned by
   *  AGB winds and supernovae); calcium, phosphorus and iron from
   *  core-collapse and thermonuclear supernovae; gold from the rapid
   *  neutron-capture process in neutron-star mergers (GW170817). */
  originKey: ElementOriginKey;
}

export const BODY_ELEMENTS: readonly BodyElement[] = [
  { key: 'oxygen', bodyPct: 65, originKey: 'stellarFusion' },
  { key: 'carbon', bodyPct: 18.5, originKey: 'stellarFusion' },
  { key: 'hydrogen', bodyPct: 9.5, originKey: 'bigBang' },
  { key: 'nitrogen', bodyPct: 3.2, originKey: 'stellarFusion' },
  { key: 'calcium', bodyPct: 1.5, originKey: 'supernova' },
  { key: 'phosphorus', bodyPct: 1.0, originKey: 'supernova' },
  { key: 'iron', bodyPct: 0.006, originKey: 'supernova' },
  { key: 'gold', bodyPct: 0.00002, originKey: 'neutronMerger' },
];

/* ------------------------------------------------------------------ */
/* Formatting shared by the card and the components                      */
/* ------------------------------------------------------------------ */

/** Light-years with the locale's grouping: two decimals under 100 ly
 *  (Proxima 4.25, Sirius 8.6, Vega 25.04), whole numbers above. */
export function formatLightYears(distanceLy: number, locale: string): string {
  const fmt = numberFormat(locale, { maximumFractionDigits: distanceLy < 100 ? 2 : 0 });
  return fmt ? fmt.format(distanceLy) : String(Math.round(distanceLy));
}

export function formatWhole(value: number, locale: string): string {
  const fmt = numberFormat(locale, { maximumFractionDigits: 0 });
  return fmt ? fmt.format(value) : String(Math.round(value));
}

/* ------------------------------------------------------------------ */
/* Observer resolution and the card                                      */
/* ------------------------------------------------------------------ */

/**
 * The observer's point -- a copy of `knownPlace` in lib/live/discoverySlots
 * .ts (REV-41 D-4), which this module cannot import at runtime because the
 * registry imports `buildCosmosCard` (a cycle): the weather slot's own
 * cache first (zero extra geolocation), else the Geo-IP fix the session
 * already resolved (the visitor's real city), else the locale default; all
 * three filtered through the SELECTED country (REV-21 §2.1) so a profile
 * country wins over a stale search or a VPN exit. Runs inside `load()`, so
 * reading the device store here is allowed (1-A #9).
 */
export function resolveObserver(ctx: SlotContext): CosmosObserver {
  const cached = readWeatherCache()?.place;
  if (cached) {
    const p = resolveDeeperPlace(ctx, cached);
    return { lat: p.lat, lon: p.lon, name: p.name };
  }
  const fix = readGeoIpFix();
  if (fix) {
    const p = resolveDeeperPlace(ctx, { name: fix.city || fix.country, countryCode: fix.country, lat: fix.lat, lon: fix.lon, approx: true });
    return { lat: p.lat, lon: p.lon, name: p.name };
  }
  const p = resolveDeeperPlace(ctx, null);
  return { lat: p.lat, lon: p.lon, name: p.name };
}

export const COSMOS_ACCENT = '#8b5cf6';
export const COSMOS_CARD_ROWS = 4;

/** The card's / deep modal's rows: every object by altitude, highest
 *  first (4 on the card, the whole catalogue in the deep modal). No URL --
 *  the slot is one-target and the row opens the deep modal (REV-41 D-2). */
export function cosmosItems(tele: CosmosTelemetry, locale: string, limit: number): SlotItem[] {
  const ranked = [...tele.objects].sort((a, b) => b.alt - a.alt).slice(0, limit);
  return ranked.map((o, i) => {
    const obj = cosmosObjectByKey(o.key);
    return {
      id: o.key,
      title: `i18n:Rev42.cosmos.objects.${o.key}.name`,
      description: obj?.designation ?? o.key,
      meta: `${o.alt.toFixed(0)}° · ${windDirLabel(o.az)} · ${formatLightYears(obj?.distanceLy ?? 0, locale)} ly`,
      rank: i + 1,
      color: COSMOS_ACCENT,
    };
  });
}

/**
 * The cosmos card (SPEC D-6): the object of the UTC day as the hero, its
 * type, constellation, distance, altitude and visibility from the
 * observer's point, the observer, and the Earth's orbital travel since
 * local midnight; rows by altitude; the horizon-dial widget. Translated
 * names travel as value-less facts / `i18n:` item titles (the carousel
 * resolves them); numbers, units and designations stay plain.
 */
export function buildCosmosCard(ctx: SlotContext, cursor: DeepCursor | undefined, nowMs: number): SlotCard {
  const locale = ctx.locale;
  const deep = cursor?.deep === 1 || cursor?.deep === '1';
  const dayIndex = Math.floor(nowMs / 86_400_000);
  const featured = objectOfDay(dayIndex);
  const observer = resolveObserver(ctx);
  const tele = cosmosTelemetry(observer, nowMs);
  const hero = tele.objects.find((o) => o.key === featured.key) ?? { key: featured.key, alt: 0, az: 0, visible: false };
  const state = visibilityOf(hero.alt, tele.daylight);

  const facts: SlotFact[] = [
    { labelKey: `Rev42.cosmos.objects.${featured.key}.name`, value: '', emphasis: true },
    { labelKey: `Rev42.cosmos.types.${featured.typeKey}`, value: '' },
    { labelKey: `Rev42.cosmos.constellations.${featured.constellationKey}`, value: '' },
    { labelKey: 'Rev42.cosmos.facts.distance', value: formatLightYears(featured.distanceLy, locale), unit: ' ly' },
    { labelKey: 'Rev42.cosmos.facts.altitude', value: hero.alt.toFixed(0), unit: '°' },
    { labelKey: `Rev42.cosmos.visibility.${state}`, value: '' },
    { labelKey: 'Rev42.cosmos.facts.observer', value: observer.name },
    { labelKey: 'Rev42.cosmos.facts.travelledToday', value: formatWhole(tele.travelledSinceMidnightKm, locale), unit: ' km' },
  ];

  const items = cosmosItems(tele, locale, deep ? COSMOS_OBJECTS.length : COSMOS_CARD_ROWS);

  const widget: CosmosScopeWidget = {
    kind: 'cosmosScope',
    nowMs,
    observer,
    featuredKey: featured.key,
    objects: tele.objects,
    sun: tele.sun,
    moon: tele.moon,
    galacticCenter: tele.galacticCenter,
  };

  return {
    facts,
    items,
    subject: { term: featured.designation },
    widget,
    updatedAt: nowMs,
    cursor: null,
  };
}
