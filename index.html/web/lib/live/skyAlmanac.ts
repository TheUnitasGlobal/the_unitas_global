/**
 * REV-42 D-2 / D-3 -- the sky almanac: the two shapes the UI reads from the
 * celestial engine (lib/live/celestial.ts).
 *
 * - `moonPhaseWidgetFor(nowMs, locale, tzOffsetMinutes?)` is what the
 *   weather adapter (lib/live/discoverySlots.ts, lane G) attaches to EVERY
 *   weather card, the empty one included: the Moon needs no network. The
 *   Gregorian date is the visitor's civil date (their device offset when
 *   given, else UTC); the lunar date is reckoned on the meridian that the
 *   visitor's language's calendar uses (`lunarMeridianFor`), which is why
 *   the same instant can be lunar 1/1 for a Korean visitor and 1/2 for a
 *   Chinese one (2027-02-06T16:30Z is one such instant).
 * - `skySnapshot(nowMs, lat, lon, locale)` is the tier-3 "precision sky"
 *   view (SkyDetail, lane F; mirrored by CosmosDetail, lane D): sidereal
 *   time, the Sun and the Moon in ecliptic / equatorial / horizontal
 *   coordinates with their zodiac positions, the solar term in force and
 *   the lunar date. The UI recomputes it every second from a stored
 *   `nowMs`; a call costs about a millisecond.
 *
 * Pure: every function takes `nowMs`; nothing here reads a clock or rolls
 * a die (SPEC 1-A #14). The key unions and the 24 / 12 / 8 / 12 key arrays
 * are re-exported so i18n and component lanes import one module.
 */
import {
  ANIMAL_KEYS,
  MOON_PHASE_KEYS,
  MS_PER_DAY,
  SOLAR_TERM_KEYS,
  ZODIAC_KEYS,
  altAz,
  gmstHours,
  julianDay,
  lmstHours,
  lunarDate,
  lunarMeridianFor,
  moonPhase,
  moonPosition,
  solarTermOf,
  sunPosition,
  zodiacOf,
  type AnimalKey,
  type LunarDate,
  type MoonPhase,
  type MoonPhaseKey,
  type SolarTerm,
  type SolarTermKey,
  type ZodiacKey,
  type ZodiacPosition,
} from '@/lib/live/celestial';

export type { AnimalKey, LunarDate, MoonPhase, MoonPhaseKey, SolarTerm, SolarTermKey, ZodiacKey, ZodiacPosition };
export { ANIMAL_KEYS, MOON_PHASE_KEYS, SOLAR_TERM_KEYS, ZODIAC_KEYS, lunarMeridianFor };

/** SPEC S3: the widget the weather card and the weather deep modal render
 *  through `MoonPhasePixel` (lane C). Structurally identical to the copy
 *  declared next to `SlotWidget` in discoverySlots.ts. */
export interface MoonPhaseWidget {
  kind: 'moonPhase';
  nowMs: number;
  /** The visitor's civil date (device offset when known, else UTC). */
  gregorian: { y: number; m: number; d: number };
  /** The lunisolar date on the locale's reference meridian. */
  lunar: { year: number; month: number; day: number; leap: boolean; animalKey: string };
  phaseKey: MoonPhaseKey;
  /** Illuminated fraction 0..1. */
  illumination: number;
  /** Days since the last new moon. */
  ageDays: number;
  waxing: boolean;
  /** Elongation in longitude, degrees [0, 360), 0 = new. */
  phaseAngle: number;
  termKey: SolarTermKey;
  nextTermKey: SolarTermKey;
  /** UTC ms at which the next solar term begins. */
  nextTermMs: number;
  /** Apparent ecliptic longitudes, degrees. */
  sunLon: number;
  moonLon: number;
}

/** Gregorian y/m/d of `nowMs` in the civil zone UTC+tzOffsetMinutes. */
export function civilDateAt(nowMs: number, tzOffsetMinutes = 0): { y: number; m: number; d: number } {
  const civil = new Date(nowMs + tzOffsetMinutes * 60_000);
  return { y: civil.getUTCFullYear(), m: civil.getUTCMonth() + 1, d: civil.getUTCDate() };
}

/** The moon-phase widget for an instant, a language and the visitor's UTC
 *  offset in minutes (JavaScript's `-getTimezoneOffset()` sign: +540 for
 *  Seoul). Omit the offset to reckon the Gregorian date in UTC. */
export function moonPhaseWidgetFor(nowMs: number, locale: string, tzOffsetMinutes?: number): MoonPhaseWidget {
  const gregorian = civilDateAt(nowMs, tzOffsetMinutes ?? 0);
  const lunar = lunarDate(nowMs, lunarMeridianFor(locale));
  const phase = moonPhase(nowMs);
  const term = solarTermOf(nowMs);
  const moonLon = moonPosition(nowMs).lon;
  return {
    kind: 'moonPhase',
    nowMs,
    gregorian,
    lunar: {
      year: lunar.year,
      month: lunar.month,
      day: lunar.day,
      leap: lunar.isLeapMonth,
      animalKey: lunar.animalKey,
    },
    phaseKey: phase.phaseKey,
    illumination: phase.illumination,
    ageDays: phase.ageDays,
    waxing: phase.waxing,
    phaseAngle: phase.phaseAngle,
    termKey: term.key,
    nextTermKey: term.nextKey,
    nextTermMs: term.nextStartMs,
    sunLon: term.lon,
    moonLon,
  };
}

export interface SkyBody {
  /** Apparent ecliptic longitude, degrees [0, 360). */
  lon: number;
  /** Apparent right ascension, HOURS [0, 24). */
  ra: number;
  /** Apparent declination, degrees. */
  dec: number;
  /** Altitude above the mathematical horizon, degrees (no refraction). */
  alt: number;
  /** Azimuth from north through east, degrees [0, 360). */
  az: number;
  zodiac: ZodiacPosition;
}

export interface SkySnapshot {
  nowMs: number;
  observer: { lat: number; lon: number };
  /** UT Julian Day. */
  jd: number;
  gmstHours: number;
  lmstHours: number;
  sun: SkyBody & { distAu: number };
  moon: SkyBody & { lat: number; distKm: number; phase: MoonPhase };
  term: SolarTerm;
  lunar: LunarDate;
}

/** Everything the tier-3 sky view prints, for an observer at latDeg /
 *  east-longitude lonDeg and the lunar meridian of `locale`. */
export function skySnapshot(nowMs: number, latDeg: number, lonDeg: number, locale: string): SkySnapshot {
  const sun = sunPosition(nowMs);
  const moon = moonPosition(nowMs);
  const sunHorizon = altAz(sun.ra, sun.dec, nowMs, latDeg, lonDeg);
  const moonHorizon = altAz(moon.ra, moon.dec, nowMs, latDeg, lonDeg);
  return {
    nowMs,
    observer: { lat: latDeg, lon: lonDeg },
    jd: julianDay(nowMs),
    gmstHours: gmstHours(nowMs),
    lmstHours: lmstHours(nowMs, lonDeg),
    sun: {
      lon: sun.lon,
      ra: sun.ra,
      dec: sun.dec,
      alt: sunHorizon.alt,
      az: sunHorizon.az,
      distAu: sun.distAu,
      zodiac: zodiacOf(sun.lon),
    },
    moon: {
      lon: moon.lon,
      lat: moon.lat,
      ra: moon.ra,
      dec: moon.dec,
      alt: moonHorizon.alt,
      az: moonHorizon.az,
      distKm: moon.distKm,
      zodiac: zodiacOf(moon.lon),
      phase: moonPhase(nowMs),
    },
    term: solarTermOf(nowMs),
    lunar: lunarDate(nowMs, lunarMeridianFor(locale)),
  };
}

/** Whole days and remaining hours until `targetMs`, floored at zero -- the
 *  arguments of the `Rev42.sky.termIn` ICU message ("{days}일 {hours}시간 후"). */
export function countdownParts(nowMs: number, targetMs: number): { days: number; hours: number } {
  const delta = Math.max(0, targetMs - nowMs);
  const days = Math.floor(delta / MS_PER_DAY);
  const hours = Math.floor((delta - days * MS_PER_DAY) / 3_600_000);
  return { days, hours };
}
