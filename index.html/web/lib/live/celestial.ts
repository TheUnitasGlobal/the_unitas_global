/**
 * REV-42 D-2 -- the celestial engine: sidereal time, the Sun, the Moon,
 * the 24 solar terms, the eight moon phases, the tropical zodiac and the
 * Chinese / Korean lunisolar calendar, computed locally from Jean Meeus'
 * "Astronomical Algorithms" (2nd ed.) with NO network, NO key and NO clock.
 *
 * Every public function takes `nowMs` -- epoch milliseconds -- as an
 * argument. Nothing in this module reads the wall clock: the adapter that
 * calls it (lib/live/discoverySlots.ts, inside `load()`) is the one place a
 * timestamp is taken, and the widgets re-render from a stored `nowMs`
 * (REV-36/40 render doctrine, SPEC 1-A #14). `__tests__/live/celestial.test.ts`
 * scans this source for the forbidden call forms.
 *
 * Time scales. UTC is what the caller hands in. The ephemeris formulas want
 * Terrestrial Time (TT = UTC + dT, ~69 s in the 2020s); sidereal time wants
 * UT1, which UTC tracks to < 0.9 s. So `julianDay()` is the UT Julian Day
 * and `julianEphemerisDay()` adds dT before any orbital polynomial is
 * evaluated. Results that are instants (solar terms, new moons) are handed
 * back in UTC milliseconds again.
 *
 * Accuracy budget (verified by the test vectors in SPEC S5):
 * - GMST (ch.12 eq.12.4): < 0.1 s.
 * - Sun (ch.25 "low accuracy" + ch.22 nutation + aberration): ~0.005 deg in
 *   longitude, i.e. a few minutes of time for an equinox or a solar term.
 * - Moon (ch.47, the full 60 + 60 term tables): ~10 arcsec in longitude,
 *   4 arcsec in latitude, a few km in distance.
 * - New moon (ch.49 with every periodic and planetary correction): < 20 s.
 * - Lunisolar date: exact (cross-checked against ICU's dangi / chinese
 *   calendars for 2024-2027 by the test file).
 *
 * Chapter references below are to Meeus. Angles are degrees unless a name
 * says otherwise (`raHours`, `gmstHours`). Right ascension is in HOURS.
 */

// ---------------------------------------------------------------------------
// Constants and small helpers
// ---------------------------------------------------------------------------

/** Milliseconds in one civil day. */
export const MS_PER_DAY = 86_400_000;
/** Julian Day of the Unix epoch (1970-01-01T00:00Z). */
export const JD_UNIX_EPOCH = 2_440_587.5;
/** Julian Day of J2000.0 (2000-01-01T12:00 TT; treated as UT here, ch.21). */
export const J2000_JD = 2_451_545.0;
/** Epoch milliseconds of J2000.0 -- `Date.UTC(2000, 0, 1, 12)`. */
export const J2000_MS = 946_728_000_000;
/** Days per Julian century. */
export const DAYS_PER_CENTURY = 36_525;
/** Mean synodic month (ch.49). */
export const SYNODIC_MONTH_DAYS = 29.530588861;
/** Mean tropical year -- the mean rate the solar-term root finder starts from. */
export const TROPICAL_YEAR_DAYS = 365.2422;
/** Astronomical unit in kilometres (IAU 2012). */
export const AU_KM = 149_597_870.7;

/** Reduce any angle to [0, 360). */
export function normalizeDeg(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/** Reduce any angle to [-180, 180): the signed distance "how far ahead". */
export function signedDeg(deg: number): number {
  const r = normalizeDeg(deg);
  return r >= 180 ? r - 360 : r;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

const sinD = (deg: number): number => Math.sin(degToRad(deg));
const cosD = (deg: number): number => Math.cos(degToRad(deg));
const tanD = (deg: number): number => Math.tan(degToRad(deg));
const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

// ---------------------------------------------------------------------------
// Time: Julian Day, dT, sidereal time
// ---------------------------------------------------------------------------

/** UT Julian Day of an epoch-millisecond instant (ch.7). */
export function julianDay(ms: number): number {
  return ms / MS_PER_DAY + JD_UNIX_EPOCH;
}

/** Epoch milliseconds of a Julian Day -- the inverse of `julianDay`. */
export function msFromJulianDay(jd: number): number {
  return (jd - JD_UNIX_EPOCH) * MS_PER_DAY;
}

/** Julian centuries since J2000.0 (ch.12 eq.12.1 / ch.22 eq.22.1). */
export function julianCenturies(jd: number): number {
  return (jd - J2000_JD) / DAYS_PER_CENTURY;
}

/**
 * dT = TT - UT in seconds, as a function of the (fractional) Julian Day.
 *
 * Segments are the Espenak & Meeus (2006) polynomial fits used by NASA's
 * eclipse pages (ch.10 in spirit). Their 2005-2050 fit extrapolated a
 * continuing rise (75 s by 2026) that did not happen: Earth's rotation
 * sped up after 2016 and IERS Bulletin A has held dT at 69.1-69.4 s since
 * 2017. From 2015 the plateau value is used -- the fit already gives 69.0 s
 * at 2015.0, so the join is continuous to 0.2 s. A leap second (or the
 * first negative one) would move this by 1 s, which is far below any
 * tolerance in this engine (a whole minute of dT moves the Sun 0.0007 deg).
 */
export function deltaTSeconds(jd: number): number {
  const y = 2000 + (jd - J2000_JD) / 365.25;
  if (y < 1900) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (y < 1920) {
    const t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (y < 1941) {
    const t = y - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t ** 3;
  }
  if (y < 1961) {
    const t = y - 1950;
    return 29.07 + 0.407 * t - (t * t) / 233 + t ** 3 / 2547;
  }
  if (y < 1986) {
    const t = y - 1975;
    return 45.45 + 1.067 * t - (t * t) / 260 - t ** 3 / 718;
  }
  if (y < 2005) {
    const t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (y < 2015) {
    const t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  if (y < 2050) {
    // Measured plateau (IERS): see the docblock.
    return 69.2;
  }
  if (y < 2150) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u - 0.5628 * (2150 - y);
  }
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}

/** Julian Ephemeris Day (TT) of a UTC instant: the argument every orbital
 *  polynomial below is evaluated at. */
export function julianEphemerisDay(ms: number): number {
  const jd = julianDay(ms);
  return jd + deltaTSeconds(jd) / 86_400;
}

/**
 * Greenwich mean sidereal time in hours (ch.12 eq.12.4, valid for any
 * instant, not only 0h UT). At J2000.0 this is 18h 41m 50.548s =
 * 18.697374558 h, which the test pins to within a second.
 */
export function gmstHours(ms: number): number {
  const jd = julianDay(ms);
  const T = julianCenturies(jd);
  const theta =
    280.46061837 + 360.98564736629 * (jd - J2000_JD) + 0.000387933 * T * T - (T * T * T) / 38_710_000;
  return normalizeDeg(theta) / 15;
}

/** Local mean sidereal time in hours: GMST plus the east longitude. */
export function lmstHours(ms: number, lonDeg: number): number {
  return normalizeDeg(gmstHours(ms) * 15 + lonDeg) / 15;
}

/** `HH:MM:SS` for a value in hours, wrapped into [0, 24). Seconds are
 *  truncated, not rounded, the way a clock face behaves. */
export function formatHms(hours: number): string {
  let h = hours % 24;
  if (h < 0) h += 24;
  let total = Math.floor(h * 3600);
  if (total >= 86_400) total = 0;
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

// ---------------------------------------------------------------------------
// Obliquity and nutation (ch.22)
// ---------------------------------------------------------------------------

/** Mean obliquity of the ecliptic in degrees (ch.22 eq.22.2, Laskar's
 *  first terms; 1 arcsec accuracy over 2000 years). */
export function meanObliquity(T: number): number {
  return 23 + (26 + (21.448 - 46.815 * T - 0.00059 * T * T + 0.001813 * T * T * T) / 60) / 60;
}

/**
 * Nutation in longitude (dPsi) and obliquity (dEps), degrees, from the
 * four-term approximation of ch.22 (0.5 arcsec / 0.1 arcsec accuracy).
 * Omega is the longitude of the Moon's ascending node; L and Lp the mean
 * longitudes of the Sun and Moon.
 */
export function nutation(T: number): { dPsi: number; dEps: number } {
  const omega = normalizeDeg(125.04452 - 1934.136261 * T);
  const L = normalizeDeg(280.4665 + 36000.7698 * T);
  const Lp = normalizeDeg(218.3165 + 481267.8813 * T);
  const dPsi = (-17.2 * sinD(omega) - 1.32 * sinD(2 * L) - 0.23 * sinD(2 * Lp) + 0.21 * sinD(2 * omega)) / 3600;
  const dEps = (9.2 * cosD(omega) + 0.57 * cosD(2 * L) + 0.1 * cosD(2 * Lp) - 0.09 * cosD(2 * omega)) / 3600;
  return { dPsi, dEps };
}

// ---------------------------------------------------------------------------
// The Sun (ch.25)
// ---------------------------------------------------------------------------

export interface SunPosition {
  /** Apparent geocentric ecliptic longitude, degrees [0, 360): the true
   *  longitude corrected for nutation and aberration -- the value the
   *  solar terms and the zodiac read. */
  lon: number;
  /** Apparent right ascension, HOURS [0, 24). */
  ra: number;
  /** Apparent declination, degrees. */
  dec: number;
  /** Earth-Sun distance in astronomical units. */
  distAu: number;
}

/** Apparent equatorial coordinates from apparent ecliptic longitude /
 *  latitude and the true obliquity (ch.13 eq.13.3 / 13.4). */
function equatorialOf(lonDeg: number, latDeg: number, epsDeg: number): { ra: number; dec: number } {
  const ra =
    normalizeDeg(radToDeg(Math.atan2(sinD(lonDeg) * cosD(epsDeg) - tanD(latDeg) * sinD(epsDeg), cosD(lonDeg)))) / 15;
  const dec = radToDeg(Math.asin(clamp(sinD(latDeg) * cosD(epsDeg) + cosD(latDeg) * sinD(epsDeg) * sinD(lonDeg), -1, 1)));
  return { ra, dec };
}

/**
 * The "low accuracy" Sun of ch.25 eq.25.2-25.8: mean longitude L0, mean
 * anomaly M, eccentricity e, the equation of the centre C to the third
 * harmonic, R from the true anomaly, then nutation (ch.22) and the
 * aberration constant -20.4898 arcsec / R applied explicitly rather than
 * through the merged "-0.00569 - 0.00478 sin Omega" shortcut.
 *
 * Stated accuracy 0.01 deg; measured against the almanac equinoxes it is
 * good to ~0.007 deg (10 minutes of time). It is kept as an INDEPENDENT
 * cross-check of the VSOP87 series below -- the test file asserts the two
 * agree to 0.01 deg across five decades, which no transcription slip in a
 * large VSOP87 term could survive -- and as the documented fallback the
 * SPEC (D-2) named.
 */
export function sunPositionLowAccuracy(ms: number): SunPosition {
  const T = julianCenturies(julianEphemerisDay(ms));
  const L0 = normalizeDeg(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = normalizeDeg(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * sinD(M) +
    (0.019993 - 0.000101 * T) * sinD(2 * M) +
    0.000289 * sinD(3 * M);
  const trueLon = L0 + C;
  const nu = M + C;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cosD(nu));
  const { dPsi, dEps } = nutation(T);
  const aberration = -20.4898 / 3600 / R;
  const lon = normalizeDeg(trueLon + dPsi + aberration);
  const eps = meanObliquity(T) + dEps;
  const { ra, dec } = equatorialOf(lon, 0, eps);
  return { lon, ra, dec, distAu: R };
}

/**
 * VSOP87 (Bretagnon & Francou 1988) heliocentric series for the EARTH as
 * truncated in Meeus Appendix III, the "higher accuracy" Sun of ch.25
 * (example 25.b). Each row is [A, B, C] in a term A cos(B + C tau) with A
 * in 1e-8 radians (1e-8 AU for the R series), B in radians and C in
 * radians per Julian MILLENNIUM (tau = T / 10). The truncation keeps every
 * term of 25e-8 rad and above, which bounds the omission error near
 * 1 arcsec in longitude for 2000 +- 50 years -- two seconds of time on a
 * solar term, forty times better than the low-accuracy series.
 */
type VsopTerm = readonly [number, number, number];
const VSOP_EARTH_L0: ReadonlyArray<VsopTerm> = [
  [175347046, 0, 0],
  [3341656, 4.6692568, 6283.07585],
  [34894, 4.6261, 12566.1517],
  [3497, 2.7441, 5753.3849],
  [3418, 2.8289, 3.5231],
  [3136, 3.6277, 77713.7715],
  [2676, 4.4181, 7860.4194],
  [2343, 6.1352, 3930.2097],
  [1324, 0.7425, 11506.7698],
  [1273, 2.0371, 529.691],
  [1199, 1.1096, 1577.3435],
  [990, 5.233, 5884.927],
  [902, 2.045, 26.298],
  [857, 3.508, 398.149],
  [780, 1.179, 5223.694],
  [753, 2.533, 5507.553],
  [505, 4.583, 18849.228],
  [492, 4.205, 775.523],
  [357, 2.92, 0.067],
  [317, 5.849, 11790.629],
  [284, 1.899, 796.298],
  [271, 0.315, 10977.079],
  [243, 0.345, 5486.778],
  [206, 4.806, 2544.314],
  [205, 1.869, 5573.143],
  [202, 2.458, 6069.777],
  [156, 0.833, 213.299],
  [132, 3.411, 2942.463],
  [126, 1.083, 20.775],
  [115, 0.645, 0.98],
  [103, 0.636, 4694.003],
  [102, 0.976, 15720.839],
  [102, 4.267, 7.114],
  [99, 6.21, 2146.17],
  [98, 0.68, 155.42],
  [86, 5.98, 161000.69],
  [85, 1.3, 6275.96],
  [85, 3.67, 71430.7],
  [80, 1.81, 17260.15],
  [79, 3.04, 12036.46],
  [75, 1.76, 5088.63],
  [74, 3.5, 3154.69],
  [74, 4.68, 801.82],
  [70, 0.83, 9437.76],
  [62, 3.98, 8827.39],
  [61, 1.82, 7084.9],
  [57, 2.78, 6286.6],
  [56, 4.39, 14143.5],
  [56, 3.47, 6279.55],
  [52, 0.19, 12139.55],
  [52, 1.33, 1748.02],
  [51, 0.28, 5856.48],
  [49, 0.49, 1194.45],
  [41, 5.37, 8429.24],
  [41, 2.4, 19651.05],
  [39, 6.17, 10447.39],
  [37, 6.04, 10213.29],
  [37, 2.57, 1059.38],
  [36, 1.71, 2352.87],
  [36, 1.78, 6812.77],
  [33, 0.59, 17789.85],
  [30, 0.44, 83996.85],
  [30, 2.74, 1349.87],
  [25, 3.16, 4690.48],
];
const VSOP_EARTH_L1: ReadonlyArray<VsopTerm> = [
  [628331966747, 0, 0],
  [206059, 2.678235, 6283.07585],
  [4303, 2.6351, 12566.1517],
  [425, 1.59, 3.523],
  [119, 5.796, 26.298],
  [109, 2.966, 1577.344],
  [93, 2.59, 18849.23],
  [72, 1.14, 529.69],
  [68, 1.87, 398.15],
  [67, 4.41, 5507.55],
  [59, 2.89, 5223.69],
  [56, 2.17, 155.42],
  [45, 0.4, 796.3],
  [36, 0.47, 775.52],
  [29, 2.65, 7.11],
  [21, 5.34, 0.98],
  [19, 1.85, 5486.78],
  [19, 4.97, 213.3],
  [17, 2.99, 6275.96],
  [16, 0.03, 2544.31],
  [16, 1.43, 2146.17],
  [15, 1.21, 10977.08],
  [12, 2.83, 1748.02],
  [12, 3.26, 5088.63],
  [12, 5.27, 1194.45],
  [12, 2.08, 4694],
  [11, 0.77, 553.57],
  [10, 1.3, 6286.6],
  [10, 4.24, 1349.87],
  [9, 2.7, 242.73],
  [9, 5.64, 951.72],
  [8, 5.3, 2352.87],
  [6, 2.65, 9437.76],
  [6, 4.67, 4690.48],
];
const VSOP_EARTH_L2: ReadonlyArray<VsopTerm> = [
  [52919, 0, 0],
  [8720, 1.0721, 6283.0758],
  [309, 0.867, 12566.152],
  [27, 0.05, 3.52],
  [16, 5.19, 26.3],
  [16, 3.68, 155.42],
  [10, 0.76, 18849.23],
  [9, 2.06, 77713.77],
  [7, 0.83, 775.52],
  [5, 4.66, 1577.34],
  [4, 1.03, 7.11],
  [4, 3.44, 5573.14],
  [3, 5.14, 796.3],
  [3, 6.05, 5507.55],
  [3, 1.19, 242.73],
  [3, 6.12, 529.69],
  [3, 0.31, 398.15],
  [3, 2.28, 553.57],
  [2, 4.38, 5223.69],
  [2, 3.75, 0.98],
];
const VSOP_EARTH_L3: ReadonlyArray<VsopTerm> = [
  [289, 5.844, 6283.076],
  [35, 0, 0],
  [17, 5.49, 12566.15],
  [3, 5.2, 155.42],
  [1, 4.72, 3.52],
  [1, 5.3, 18849.23],
  [1, 5.97, 242.73],
];
const VSOP_EARTH_L4: ReadonlyArray<VsopTerm> = [
  [114, 3.142, 0],
  [8, 4.13, 6283.08],
  [1, 3.84, 12566.15],
];
const VSOP_EARTH_L5: ReadonlyArray<VsopTerm> = [[1, 3.14, 0]];
const VSOP_EARTH_B0: ReadonlyArray<VsopTerm> = [
  [280, 3.199, 84334.662],
  [102, 5.422, 5507.553],
  [80, 3.88, 5223.69],
  [44, 3.7, 2352.87],
  [32, 4, 1577.34],
];
const VSOP_EARTH_B1: ReadonlyArray<VsopTerm> = [
  [9, 3.9, 5507.55],
  [6, 1.73, 5223.69],
];
const VSOP_EARTH_R0: ReadonlyArray<VsopTerm> = [
  [100013989, 0, 0],
  [1670700, 3.0984635, 6283.07585],
  [13956, 3.05525, 12566.1517],
  [3084, 5.1985, 77713.7715],
  [1628, 1.1739, 5753.3849],
  [1576, 2.8469, 7860.4194],
  [925, 5.453, 11506.77],
  [542, 4.564, 3930.21],
  [472, 3.661, 5884.927],
  [346, 0.964, 5507.553],
  [329, 5.9, 5223.694],
  [307, 0.299, 5573.143],
  [243, 4.273, 11790.629],
  [212, 5.847, 1577.344],
  [186, 5.022, 10977.079],
  [175, 3.012, 18849.228],
  [110, 5.055, 5486.778],
  [98, 0.89, 6069.78],
  [86, 5.69, 15720.84],
  [86, 1.27, 161000.69],
  [65, 0.27, 17260.15],
  [63, 0.92, 529.69],
  [57, 2.01, 83996.85],
  [56, 5.24, 71430.7],
  [49, 3.25, 2544.31],
  [47, 2.58, 775.52],
  [45, 5.54, 9437.76],
  [43, 6.01, 6275.96],
  [39, 5.36, 4694],
  [38, 2.39, 8827.39],
  [37, 0.83, 19651.05],
  [37, 4.9, 12139.55],
  [36, 1.67, 12036.46],
  [35, 1.84, 2942.46],
  [33, 0.24, 7084.9],
  [32, 0.18, 5088.63],
  [32, 1.78, 398.15],
  [28, 1.21, 6286.6],
  [28, 1.9, 6279.55],
  [26, 4.59, 10447.39],
];
const VSOP_EARTH_R1: ReadonlyArray<VsopTerm> = [
  [103019, 1.10749, 6283.07585],
  [1721, 1.0644, 12566.1517],
  [702, 3.142, 0],
  [32, 1.02, 18849.23],
  [31, 2.84, 5507.55],
  [25, 1.32, 5223.69],
  [18, 1.42, 1577.34],
  [10, 5.91, 10977.08],
  [9, 1.42, 6275.96],
  [9, 0.27, 5486.78],
];
const VSOP_EARTH_R2: ReadonlyArray<VsopTerm> = [
  [4359, 5.7846, 6283.0758],
  [124, 5.579, 12566.152],
  [12, 3.14, 0],
  [9, 3.63, 77713.77],
  [6, 1.87, 5573.14],
  [3, 5.47, 18849.23],
];
const VSOP_EARTH_R3: ReadonlyArray<VsopTerm> = [
  [145, 4.273, 6283.076],
  [7, 3.92, 12566.15],
];
const VSOP_EARTH_R4: ReadonlyArray<VsopTerm> = [[4, 2.56, 6283.08]];

/** Sum A cos(B + C tau) over one series. */
function vsopSeries(terms: ReadonlyArray<VsopTerm>, tau: number): number {
  let sum = 0;
  for (const [a, b, c] of terms) sum += a * Math.cos(b + c * tau);
  return sum;
}

/** Evaluate the polynomial-in-tau stack of series (eq.32.2), in 1e-8 units. */
function vsopStack(stack: ReadonlyArray<ReadonlyArray<VsopTerm>>, tau: number): number {
  let total = 0;
  let power = 1;
  for (const series of stack) {
    total += vsopSeries(series, tau) * power;
    power *= tau;
  }
  return total;
}

export interface EarthHeliocentric {
  /** Heliocentric ecliptic longitude of the Earth, degrees, dynamical
   *  equinox of date (VSOP87), before the FK5 correction. */
  L: number;
  /** Heliocentric ecliptic latitude, degrees. */
  B: number;
  /** Radius vector, AU. */
  R: number;
}

/** Heliocentric Earth (ch.32 eq.32.2 with the Appendix III Earth tables). */
export function earthHeliocentric(ms: number): EarthHeliocentric {
  const tau = julianCenturies(julianEphemerisDay(ms)) / 10;
  const L = normalizeDeg(
    radToDeg(vsopStack([VSOP_EARTH_L0, VSOP_EARTH_L1, VSOP_EARTH_L2, VSOP_EARTH_L3, VSOP_EARTH_L4, VSOP_EARTH_L5], tau) / 1e8),
  );
  const B = radToDeg(vsopStack([VSOP_EARTH_B0, VSOP_EARTH_B1], tau) / 1e8);
  const R = vsopStack([VSOP_EARTH_R0, VSOP_EARTH_R1, VSOP_EARTH_R2, VSOP_EARTH_R3, VSOP_EARTH_R4], tau) / 1e8;
  return { L, B, R };
}

/**
 * Geocentric apparent position of the Sun -- ch.25 "higher accuracy":
 * the Earth's heliocentric VSOP87 position turned round (Theta = L + 180,
 * beta = -B), the FK5 frame correction of eq.25.9 (-0.09033 arcsec in
 * longitude, +0.03916 (cos - sin) arcsec in latitude), the nutation of
 * ch.22 and the aberration -20.4898 arcsec / R. Apparent RA / Dec follow
 * with the true obliquity. Longitude accuracy ~1 arcsec, which is what
 * the solar-term instants and the lunisolar zhongqi rule inherit.
 */
export function sunPosition(ms: number): SunPosition {
  const T = julianCenturies(julianEphemerisDay(ms));
  const { L, B, R } = earthHeliocentric(ms);
  const theta = normalizeDeg(L + 180);
  const betaVsop = -B;
  // FK5 correction (eq.25.9): lambda' is Theta referred to J2000 -- the
  // 1.397 T term is the precession of the equinox in degrees per century.
  const lambdaPrime = theta - 1.397 * T - 0.00031 * T * T;
  const thetaFk5 = theta - 0.09033 / 3600;
  const beta = betaVsop + (0.03916 / 3600) * (cosD(lambdaPrime) - sinD(lambdaPrime));
  const { dPsi, dEps } = nutation(T);
  const aberration = -20.4898 / 3600 / R;
  const lon = normalizeDeg(thetaFk5 + dPsi + aberration);
  const eps = meanObliquity(T) + dEps;
  const { ra, dec } = equatorialOf(lon, beta, eps);
  return { lon, ra, dec, distAu: R };
}

// ---------------------------------------------------------------------------
// The Moon (ch.47)
// ---------------------------------------------------------------------------

export interface MoonPosition {
  /** Apparent geocentric ecliptic longitude, degrees [0, 360). */
  lon: number;
  /** Geocentric ecliptic latitude, degrees. */
  lat: number;
  /** Earth-Moon distance, kilometres (centre to centre). */
  distKm: number;
  /** Apparent right ascension, HOURS [0, 24). */
  ra: number;
  /** Apparent declination, degrees. */
  dec: number;
}

/**
 * Table 47.A: multiples of D, M, M', F and the coefficients of the sine
 * (longitude, 1e-6 deg) and cosine (distance, metres) terms. Terms whose
 * argument contains M are multiplied by E (|M| = 1) or E^2 (|M| = 2) to
 * account for the secular decrease of Earth's orbital eccentricity.
 */
const MOON_LR: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [0, 0, 1, 0, 6288774, -20905355],
  [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888],
  [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158],
  [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620],
  [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755],
  [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782],
  [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636],
  [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675],
  [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445],
  [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0],
  [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322],
  [2, -2, 0, 0, 2236, -9884],
  [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0],
  [2, -2, -1, 0, 2048, -4950],
  [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0],
  [4, -1, -1, 0, 1215, -3958],
  [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258],
  [2, 1, 1, 0, -810, 2616],
  [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117],
  [2, 2, -1, 0, -700, 2354],
  [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0],
  [4, 0, 1, 0, 549, -1423],
  [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571],
  [1, 0, -2, 0, -487, -1739],
  [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421],
  [1, 1, 1, 0, 351, 0],
  [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0],
  [2, -1, 2, 0, 327, 0],
  [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0],
  [2, 0, 3, 0, 294, 0],
  [2, 0, -1, -2, 0, 8752],
];

/** Table 47.B: multiples of D, M, M', F and the sine coefficient of the
 *  latitude terms (1e-6 deg), same E convention as above. */
const MOON_B: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
  [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065],
  [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828],
  [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749],
  [0, 1, -1, 1, -1565],
  [1, 0, 0, 1, -1491],
  [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410],
  [0, 1, 0, -1, -1344],
  [1, 0, 0, -1, -1335],
  [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021],
  [4, 0, -1, 1, 833],
  [0, 0, 1, -3, 777],
  [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607],
  [2, 0, 2, -1, 596],
  [2, -1, 1, -1, 491],
  [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439],
  [2, 0, 2, 1, 422],
  [2, 0, -3, -1, 421],
  [2, 1, -1, 1, -366],
  [2, 1, 0, 1, -351],
  [4, 0, 0, 1, 331],
  [2, -1, 1, 1, 315],
  [2, -2, 0, -1, 302],
  [0, 0, 1, 3, -283],
  [2, 1, 1, -1, -229],
  [1, 1, 0, -1, 223],
  [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220],
  [2, 1, -1, -1, -220],
  [1, 0, 1, 1, -185],
  [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177],
  [4, 0, -2, -1, 176],
  [4, -1, -1, -1, 166],
  [1, 0, 1, -1, -164],
  [4, 0, 1, -1, 132],
  [1, 0, -1, -1, -119],
  [4, -1, 0, -1, 115],
  [2, -2, 0, 1, 107],
];

/**
 * Geocentric apparent position of the Moon (ch.47, eq.47.1-47.7 and the
 * complete tables 47.A / 47.B plus the three additive terms for the Venus
 * (A1), Jupiter (A2) and flattening (A3) perturbations).
 *
 * L' mean longitude, D mean elongation, M Sun's mean anomaly, M' Moon's
 * mean anomaly, F argument of latitude -- all polynomials in T (TT).
 */
export function moonPosition(ms: number): MoonPosition {
  const T = julianCenturies(julianEphemerisDay(ms));
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  const Lp = normalizeDeg(218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538_841 - T4 / 65_194_000);
  const D = normalizeDeg(297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545_868 - T4 / 113_065_000);
  const M = normalizeDeg(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24_490_000);
  const Mp = normalizeDeg(134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69_699 - T4 / 14_712_000);
  const F = normalizeDeg(93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3_526_000 + T4 / 863_310_000);
  const A1 = normalizeDeg(119.75 + 131.849 * T);
  const A2 = normalizeDeg(53.09 + 479264.29 * T);
  const A3 = normalizeDeg(313.45 + 481266.484 * T);
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const E2 = E * E;

  let sumL = 0;
  let sumR = 0;
  for (const [d, m, mp, f, l, r] of MOON_LR) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const ef = m === 0 ? 1 : m === 1 || m === -1 ? E : E2;
    if (l !== 0) sumL += l * ef * sinD(arg);
    if (r !== 0) sumR += r * ef * cosD(arg);
  }
  let sumB = 0;
  for (const [d, m, mp, f, b] of MOON_B) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const ef = m === 0 ? 1 : m === 1 || m === -1 ? E : E2;
    sumB += b * ef * sinD(arg);
  }
  sumL += 3958 * sinD(A1) + 1962 * sinD(Lp - F) + 318 * sinD(A2);
  sumB +=
    -2235 * sinD(Lp) +
    382 * sinD(A3) +
    175 * sinD(A1 - F) +
    175 * sinD(A1 + F) +
    127 * sinD(Lp - Mp) -
    115 * sinD(Lp + Mp);

  const { dPsi, dEps } = nutation(T);
  const lon = normalizeDeg(Lp + sumL / 1_000_000 + dPsi);
  const lat = sumB / 1_000_000;
  const distKm = 385_000.56 + sumR / 1000;
  const eps = meanObliquity(T) + dEps;
  const { ra, dec } = equatorialOf(lon, lat, eps);
  return { lon, lat, distKm, ra, dec };
}

// ---------------------------------------------------------------------------
// Moon phases (ch.48 for illumination, ch.49 for the new-moon instants)
// ---------------------------------------------------------------------------

export const MOON_PHASE_KEYS = [
  'newMoon',
  'waxingCrescent',
  'firstQuarter',
  'waxingGibbous',
  'fullMoon',
  'waningGibbous',
  'lastQuarter',
  'waningCrescent',
] as const;
export type MoonPhaseKey = (typeof MOON_PHASE_KEYS)[number];

export interface MoonPhase {
  /** Elongation of the Moon from the Sun in ecliptic longitude, degrees
   *  [0, 360): 0 = new, 90 = first quarter, 180 = full, 270 = last. */
  phaseAngle: number;
  /** Illuminated fraction of the disc, 0..1 (ch.48 eq.48.1 with the true
   *  phase angle from eq.48.3, so the Moon's latitude and both distances
   *  are honoured). */
  illumination: number;
  /** Days since the last new moon (an astronomical instant, ch.49). */
  ageDays: number;
  /** True from new to full (elongation below 180). */
  waxing: boolean;
  /** One of the eight names: each quarter owns +-22.5 deg around 0 / 90 /
   *  180 / 270; the crescents and gibbous phases fill the gaps. */
  phaseKey: MoonPhaseKey;
}

/** Approximate lunation number k (ch.49 eq.49.2) of an instant: k = 0 is
 *  the new moon of 2000-01-06; integers are new moons. */
export function lunationNear(ms: number): number {
  const year = 2000 + (julianDay(ms) - J2000_JD) / 365.25;
  return (year - 2000) * 12.3685;
}

/**
 * The instant of new moon number k (ch.49 eq.49.1 mean phase, eq.49.4-49.7
 * arguments, the 25 periodic corrections for the new moon and the 14
 * planetary "additional corrections" of table 49.A). Result: UTC epoch ms
 * (the JDE is converted from TT).
 */
export function newMoonAtK(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  const jde = 2451550.09766 + SYNODIC_MONTH_DAYS * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = normalizeDeg(2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3);
  const Mp = normalizeDeg(201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4);
  const F = normalizeDeg(160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4);
  const omega = normalizeDeg(124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3);

  const periodic =
    -0.4072 * sinD(Mp) +
    0.17241 * E * sinD(M) +
    0.01608 * sinD(2 * Mp) +
    0.01039 * sinD(2 * F) +
    0.00739 * E * sinD(Mp - M) -
    0.00514 * E * sinD(Mp + M) +
    0.00208 * E * E * sinD(2 * M) -
    0.00111 * sinD(Mp - 2 * F) -
    0.00057 * sinD(Mp + 2 * F) +
    0.00056 * E * sinD(2 * Mp + M) -
    0.00042 * sinD(3 * Mp) +
    0.00042 * E * sinD(M + 2 * F) +
    0.00038 * E * sinD(M - 2 * F) -
    0.00024 * E * sinD(2 * Mp - M) -
    0.00017 * sinD(omega) -
    0.00007 * sinD(Mp + 2 * M) +
    0.00004 * sinD(2 * Mp - 2 * F) +
    0.00004 * sinD(3 * M) +
    0.00003 * sinD(Mp + M - 2 * F) +
    0.00003 * sinD(2 * Mp + 2 * F) -
    0.00003 * sinD(Mp + M + 2 * F) +
    0.00003 * sinD(Mp - M + 2 * F) -
    0.00002 * sinD(Mp - M - 2 * F) -
    0.00002 * sinD(3 * Mp + M) +
    0.00002 * sinD(4 * Mp);

  const A1 = 299.77 + 0.107408 * k - 0.009173 * T2;
  const A2 = 251.88 + 0.016321 * k;
  const A3 = 251.83 + 26.651886 * k;
  const A4 = 349.42 + 36.412478 * k;
  const A5 = 84.66 + 18.206239 * k;
  const A6 = 141.74 + 53.303771 * k;
  const A7 = 207.14 + 2.453732 * k;
  const A8 = 154.84 + 7.30686 * k;
  const A9 = 34.52 + 27.261239 * k;
  const A10 = 207.19 + 0.121824 * k;
  const A11 = 291.34 + 1.844379 * k;
  const A12 = 161.72 + 24.198154 * k;
  const A13 = 239.56 + 25.513099 * k;
  const A14 = 331.55 + 3.592518 * k;
  const planetary =
    0.000325 * sinD(A1) +
    0.000165 * sinD(A2) +
    0.000164 * sinD(A3) +
    0.000126 * sinD(A4) +
    0.00011 * sinD(A5) +
    0.000062 * sinD(A6) +
    0.00006 * sinD(A7) +
    0.000056 * sinD(A8) +
    0.000047 * sinD(A9) +
    0.000042 * sinD(A10) +
    0.00004 * sinD(A11) +
    0.000037 * sinD(A12) +
    0.000035 * sinD(A13) +
    0.000023 * sinD(A14);

  const jdeFinal = jde + periodic + planetary;
  return msFromJulianDay(jdeFinal - deltaTSeconds(jdeFinal) / 86_400);
}

/** The new moon nearest to `ms` (either side), UTC ms. */
export function newMoonNear(ms: number): number {
  return newMoonAtK(Math.round(lunationNear(ms)));
}

/** The last new moon at or before `ms` -- the start of the current
 *  lunation, from which the Moon's age is counted. */
export function lastNewMoonAtOrBefore(ms: number): number {
  const k0 = Math.round(lunationNear(ms));
  // The mean-lunation estimate is never off by more than half a month, so
  // one of k0+1, k0, k0-1 is the answer; the loop is bounded and the final
  // fallback (k0-2) is unreachable in practice but keeps the function total.
  for (let k = k0 + 1; k >= k0 - 1; k--) {
    const candidate = newMoonAtK(k);
    if (candidate <= ms) return candidate;
  }
  return newMoonAtK(k0 - 2);
}

/** Every new moon in [fromMs, toMs], ascending. */
export function newMoonsBetween(fromMs: number, toMs: number): number[] {
  if (toMs < fromMs) return [];
  const kA = Math.floor(lunationNear(fromMs)) - 2;
  const kB = Math.ceil(lunationNear(toMs)) + 2;
  const out: number[] = [];
  for (let k = kA; k <= kB; k++) {
    const t = newMoonAtK(k);
    if (t >= fromMs && t <= toMs) out.push(t);
  }
  return out.sort((a, b) => a - b);
}

/**
 * The instant near `nearMs` at which the Moon's elongation in longitude
 * from the Sun equals `targetDeg` (0 new, 90 first quarter, 180 full, 270
 * last quarter). A secant iteration on `moonPosition - sunPosition`,
 * seeded with the mean synodic rate; converges to < 1 s of arithmetic
 * precision (the truth is limited by the truncated lunar theory, ~1 min).
 * Used by the UI for "next full moon" and by the tests to cross-check the
 * lunar tables against the independent ch.49 new-moon series.
 */
export function lunarPhaseInstant(nearMs: number, targetDeg: number): number {
  const elongation = (t: number): number => normalizeDeg(moonPosition(t).lon - sunPosition(t).lon);
  let t = nearMs;
  let rate = 360 / SYNODIC_MONTH_DAYS / MS_PER_DAY; // deg per ms, mean
  let prevT = t;
  let prevDiff = signedDeg(targetDeg - elongation(t));
  for (let i = 0; i < 25; i++) {
    const step = prevDiff / rate;
    t = prevT + step;
    const diff = signedDeg(targetDeg - elongation(t));
    if (Math.abs(step) < 500) break;
    const dt = t - prevT;
    if (Math.abs(dt) > 1000 && diff !== prevDiff) {
      const observed = (prevDiff - diff) / dt;
      if (observed > rate / 4 && observed < rate * 4) rate = observed;
    }
    prevT = t;
    prevDiff = diff;
  }
  return t;
}

/** Phase, illumination, age and the eight-fold name at `ms`. */
export function moonPhase(ms: number): MoonPhase {
  const sun = sunPosition(ms);
  const moon = moonPosition(ms);
  const phaseAngle = normalizeDeg(moon.lon - sun.lon);
  // Geocentric elongation psi (eq.48.2) and the phase angle i (eq.48.3):
  // tan i = R sin psi / (Delta - R cos psi), with R and Delta in km.
  const psi = radToDeg(Math.acos(clamp(cosD(moon.lat) * cosD(moon.lon - sun.lon), -1, 1)));
  const R = sun.distAu * AU_KM;
  const i = radToDeg(Math.atan2(R * sinD(psi), moon.distKm - R * cosD(psi)));
  const illumination = clamp((1 + cosD(i)) / 2, 0, 1);
  const waxing = phaseAngle < 180;
  const phaseKey = MOON_PHASE_KEYS[Math.floor(normalizeDeg(phaseAngle + 22.5) / 45) % 8];
  const ageDays = (ms - lastNewMoonAtOrBefore(ms)) / MS_PER_DAY;
  return { phaseAngle, illumination, ageDays, waxing, phaseKey };
}

// ---------------------------------------------------------------------------
// Horizontal coordinates (ch.13)
// ---------------------------------------------------------------------------

export interface AltAz {
  /** Altitude above the mathematical horizon, degrees [-90, 90]; no
   *  refraction (the engine states geometry, not seeing). */
  alt: number;
  /** Azimuth from north through east, degrees [0, 360). */
  az: number;
}

/**
 * Altitude and azimuth of a body at (raHours, decDeg) seen from latitude /
 * east-longitude at `ms`. The hour angle is LMST - RA; the frame is
 * x = north, y = east, z = up, so `atan2(y, x)` is the azimuth measured
 * from north through east (Meeus' eq.13.5 measures from south; the
 * rotation here removes that convention).
 */
export function altAz(raHours: number, decDeg: number, ms: number, latDeg: number, lonDeg: number): AltAz {
  const H = normalizeDeg(lmstHours(ms, lonDeg) * 15 - raHours * 15);
  const sinLat = sinD(latDeg);
  const cosLat = cosD(latDeg);
  const sinDec = sinD(decDeg);
  const cosDec = cosD(decDeg);
  const x = sinDec * cosLat - cosDec * sinLat * cosD(H);
  const y = -cosDec * sinD(H);
  const z = sinDec * sinLat + cosDec * cosLat * cosD(H);
  const alt = radToDeg(Math.asin(clamp(z, -1, 1)));
  const az = normalizeDeg(radToDeg(Math.atan2(y, x)));
  return { alt, az };
}

// ---------------------------------------------------------------------------
// Tropical zodiac
// ---------------------------------------------------------------------------

export const ZODIAC_KEYS = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const;
export type ZodiacKey = (typeof ZODIAC_KEYS)[number];

export interface ZodiacPosition {
  key: ZodiacKey;
  /** Whole degrees within the sign, 0..29. */
  deg: number;
  /** Whole arcminutes, 0..59. */
  min: number;
}

/** The tropical sign (30-degree slices from the vernal point) and the
 *  position within it. 0 -> aries 0 deg 0', 29.99 -> aries 29 deg 59',
 *  30 -> taurus 0 deg 0'. */
export function zodiacOf(lonDeg: number): ZodiacPosition {
  const lon = normalizeDeg(lonDeg);
  const index = Math.floor(lon / 30) % 12;
  const within = lon - index * 30;
  const deg = Math.min(29, Math.floor(within));
  const min = Math.min(59, Math.floor((within - deg) * 60));
  return { key: ZODIAC_KEYS[index], deg, min };
}

// ---------------------------------------------------------------------------
// The 24 solar terms (jieqi)
// ---------------------------------------------------------------------------

/** Pinyin keys in calendar order, starting at lichun (315 deg). Even
 *  indices are the "sectional" terms (jieqi proper), odd indices the
 *  "principal" terms (zhongqi, multiples of 30 deg) the lunisolar leap
 *  rule reads. */
export const SOLAR_TERM_KEYS = [
  'lichun',
  'yushui',
  'jingzhe',
  'chunfen',
  'qingming',
  'guyu',
  'lixia',
  'xiaoman',
  'mangzhong',
  'xiazhi',
  'xiaoshu',
  'dashu',
  'liqiu',
  'chushu',
  'bailu',
  'qiufen',
  'hanlu',
  'shuangjiang',
  'lidong',
  'xiaoxue',
  'daxue',
  'dongzhi',
  'xiaohan',
  'dahan',
] as const;
export type SolarTermKey = (typeof SOLAR_TERM_KEYS)[number];

/** Apparent solar longitude at which term `index` begins. */
export const SOLAR_TERM_START_LON = 315;
export function solarTermLongitude(index: number): number {
  return normalizeDeg(SOLAR_TERM_START_LON + 15 * index);
}

export interface SolarTerm {
  key: SolarTermKey;
  /** 0..23, lichun = 0. */
  index: number;
  /** The Sun's apparent longitude at `ms`, degrees. */
  lon: number;
  /** When this term began (UTC ms, <= ms). */
  startMs: number;
  nextKey: SolarTermKey;
  /** When the next term begins (UTC ms, > ms). */
  nextStartMs: number;
}

/**
 * The instant, nearest to `nearMs`, at which the Sun's apparent longitude
 * equals `targetLonDeg`. Secant iteration seeded with the mean tropical
 * rate; the signed difference is reduced to [-180, 180) so the search
 * always walks toward the closest crossing (the Sun passes each longitude
 * once a year). Stops when a step is below 0.5 s; the truth is limited by
 * `sunPosition` (a few minutes), never by this arithmetic.
 */
export function solarTermInstant(nearMs: number, targetLonDeg: number): number {
  let rate = 360 / TROPICAL_YEAR_DAYS / MS_PER_DAY; // deg per ms, mean
  let prevT = nearMs;
  let prevDiff = signedDeg(targetLonDeg - sunPosition(prevT).lon);
  let t = prevT;
  for (let i = 0; i < 25; i++) {
    const step = prevDiff / rate;
    t = prevT + step;
    const diff = signedDeg(targetLonDeg - sunPosition(t).lon);
    if (Math.abs(step) < 500) break;
    const dt = t - prevT;
    if (Math.abs(dt) > 1000 && diff !== prevDiff) {
      const observed = (prevDiff - diff) / dt;
      // The true rate is within +-3.4% of the mean; anything wilder is a
      // wrap-around artefact and the mean is kept.
      if (observed > rate * 0.9 && observed < rate * 1.1) rate = observed;
    }
    prevT = t;
    prevDiff = diff;
  }
  return t;
}

/** The solar term in force at `ms`, its start and the next one. */
export function solarTermOf(ms: number): SolarTerm {
  const lon = sunPosition(ms).lon;
  const index = Math.floor(normalizeDeg(lon - SOLAR_TERM_START_LON) / 15) % 24;
  const nextIndex = (index + 1) % 24;
  let startMs = solarTermInstant(ms, solarTermLongitude(index));
  let nextStartMs = solarTermInstant(ms, solarTermLongitude(nextIndex));
  // Millisecond-level arithmetic noise exactly at a boundary must never
  // invert the ordering the UI relies on (start <= now < next).
  if (startMs > ms) startMs = ms;
  if (nextStartMs < ms) nextStartMs = ms;
  return { key: SOLAR_TERM_KEYS[index], index, lon, startMs, nextKey: SOLAR_TERM_KEYS[nextIndex], nextStartMs };
}

// ---------------------------------------------------------------------------
// Civil-day helpers (UTC calendar arithmetic only; no clock)
// ---------------------------------------------------------------------------

/** Days since the Unix epoch of the civil day containing `ms` at the
 *  meridian UTC+offsetHours (local midnight boundaries). */
export function civilDayIndex(ms: number, offsetHours: number): number {
  return Math.floor((ms + offsetHours * 3_600_000) / MS_PER_DAY);
}

export interface CivilDate {
  y: number;
  m: number;
  d: number;
}

/** Gregorian y/m/d of a civil day index (proleptic, via Date.UTC). */
export function civilDateOf(dayIndex: number): CivilDate {
  const date = new Date(dayIndex * MS_PER_DAY);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

// ---------------------------------------------------------------------------
// The Chinese / Korean lunisolar calendar
// ---------------------------------------------------------------------------

export const ANIMAL_KEYS = [
  'rat',
  'ox',
  'tiger',
  'rabbit',
  'dragon',
  'snake',
  'horse',
  'goat',
  'monkey',
  'rooster',
  'dog',
  'pig',
] as const;
export type AnimalKey = (typeof ANIMAL_KEYS)[number];

/** The ten heavenly stems, pinyin, jia = 0. */
export const STEM_KEYS = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'] as const;
/** The twelve earthly branches, pinyin, zi = 0 (rat). */
export const BRANCH_KEYS = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'] as const;

export interface LunarDate {
  /** The lunar year, numbered by the Gregorian year its month 1 began in
   *  (so month 11 and 12 of "2025" run into January 2026). */
  year: number;
  /** 1..12 -- a leap month repeats the number of the month before it. */
  month: number;
  /** 1..30. */
  day: number;
  isLeapMonth: boolean;
  animalKey: AnimalKey;
  /** 0..9 into STEM_KEYS (2026 = 2, bing). */
  stemIndex: number;
  /** 0..11 into BRANCH_KEYS / ANIMAL_KEYS (2026 = 6, wu = horse). */
  branchIndex: number;
}

/** The reference meridian each language's civil lunar calendar is reckoned
 *  on: Korea and Japan UTC+9, China UTC+8, Vietnam UTC+7, the rest UTC+8
 *  (the calendar's home). Accepts BCP-47 tags ("zh-TW", "ko_KR"). */
export function lunarMeridianFor(locale: string): number {
  const lang = String(locale || '')
    .toLowerCase()
    .split(/[-_]/)[0];
  if (lang === 'ko' || lang === 'ja') return 9;
  if (lang === 'zh') return 8;
  if (lang === 'vi') return 7;
  return 8;
}

/** Stem / branch of a lunar year: year 4 CE was jia-zi (0, 0). */
export function sexagenaryOf(year: number): { stemIndex: number; branchIndex: number; animalKey: AnimalKey } {
  const n = year - 4;
  const stemIndex = ((n % 10) + 10) % 10;
  const branchIndex = ((n % 12) + 12) % 12;
  return { stemIndex, branchIndex, animalKey: ANIMAL_KEYS[branchIndex] };
}

interface SuiMonth {
  number: number;
  leap: boolean;
  year: number;
  /** Civil day index of the month's first day. */
  startDay: number;
  /** Civil day index of the next month's first day (exclusive end). */
  endDay: number;
}

/** A "sui": the run of lunar months from one month 11 (the lunation
 *  holding the winter solstice) to the next, with the leap month resolved. */
interface Sui {
  /** Gregorian year of the winter solstice that anchors this sui. */
  anchorYear: number;
  months: SuiMonth[];
}

/** Month-11 anchor: the lunation number and civil first day of the month
 *  containing the winter solstice of `gregorianYear` at the meridian. */
function month11Anchor(gregorianYear: number, meridianHours: number): { k: number; solsticeMs: number; solsticeDay: number } {
  const solsticeMs = solarTermInstant(Date.UTC(gregorianYear, 11, 21), 270);
  const solsticeDay = civilDayIndex(solsticeMs, meridianHours);
  let k = Math.round(lunationNear(solsticeMs));
  // Walk to the last new moon whose CIVIL DAY is on or before the solstice
  // day -- the comparison is by day, not instant: a new moon later on the
  // solstice's own day still starts the month that holds the solstice.
  while (civilDayIndex(newMoonAtK(k), meridianHours) > solsticeDay) k--;
  while (civilDayIndex(newMoonAtK(k + 1), meridianHours) <= solsticeDay) k++;
  return { k, solsticeMs, solsticeDay };
}

/** Pure and deterministic, so the sui structure for a (year, meridian)
 *  pair is memoised: the ICU cross-check evaluates thousands of days and
 *  the widget asks for the same year on every load. Bounded to 64 entries. */
const SUI_CACHE = new Map<string, Sui>();

function suiFor(anchorYear: number, meridianHours: number): Sui {
  const cacheKey = `${anchorYear}:${meridianHours}`;
  const hit = SUI_CACHE.get(cacheKey);
  if (hit) return hit;

  const a = month11Anchor(anchorYear, meridianHours);
  const b = month11Anchor(anchorYear + 1, meridianHours);
  const count = b.k - a.k; // 12 or 13 lunations in the sui
  const starts: number[] = [];
  for (let k = a.k; k <= b.k; k++) starts.push(civilDayIndex(newMoonAtK(k), meridianHours));

  // The twelve principal terms (zhongqi) of the sui: the solstice itself
  // (270) then 300, 330, 0, ... 240, each found near a mean month after the
  // previous one and reduced to its civil day at the meridian.
  const zhongqiDays: number[] = [a.solsticeDay];
  let prev = a.solsticeMs;
  for (let j = 1; j <= 11; j++) {
    const t = solarTermInstant(prev + 30.44 * MS_PER_DAY, normalizeDeg(270 + 30 * j));
    zhongqiDays.push(civilDayIndex(t, meridianHours));
    prev = t;
  }
  const hasZhongqi = (i: number): boolean => zhongqiDays.some((d) => d >= starts[i] && d < starts[i + 1]);

  // Leap rule: only a 13-month sui carries a leap month, and it is the
  // FIRST month after month 11 that contains no principal term. A later
  // term-less month in the same sui (possible, rare) stays an ordinary
  // month, and a term-less month in a 12-month sui is not a leap month.
  let leapIndex = -1;
  if (count === 13) {
    for (let i = 1; i < count; i++) {
      if (!hasZhongqi(i)) {
        leapIndex = i;
        break;
      }
    }
  }

  const months: SuiMonth[] = [];
  let number = 11;
  let year = anchorYear;
  for (let i = 0; i < count; i++) {
    let leap = false;
    if (i === leapIndex) {
      leap = true;
    } else if (i > 0) {
      number = number === 12 ? 1 : number + 1;
      if (number === 1) year = anchorYear + 1;
    }
    months.push({ number, leap, year, startDay: starts[i], endDay: starts[i + 1] });
  }

  const sui: Sui = { anchorYear, months };
  if (SUI_CACHE.size >= 64) {
    const oldest = SUI_CACHE.keys().next().value;
    if (oldest !== undefined) SUI_CACHE.delete(oldest);
  }
  SUI_CACHE.set(cacheKey, sui);
  return sui;
}

/**
 * The Chinese / Korean lunisolar date of `ms`, with civil days reckoned at
 * local midnight of the meridian UTC+meridianHours (9 for KST).
 *
 * Rules (the 1645 Shixian / modern GB-T 33661 and KASI practice):
 * 1. A month begins on the civil day holding the astronomical new moon.
 * 2. The month holding the winter solstice (Sun at 270 deg) is month 11.
 * 3. If 13 months run from one month 11 to the next, the year has a leap
 *    month: the first month after month 11 with no principal term; it
 *    repeats the previous month's number and the following month keeps
 *    counting.
 * 4. The year number advances at month 1; stems, branches and animals
 *    follow the sexagenary cycle (2026 = bing-wu, the horse).
 */
export function lunarDate(ms: number, meridianHours: number): LunarDate {
  const day = civilDayIndex(ms, meridianHours);
  const { y } = civilDateOf(day);
  // A day in Gregorian year y belongs to the sui anchored on y's solstice
  // if it is on or after that month 11, else to the previous sui (month 11
  // never starts before late November, so those are the only two cases).
  let sui = suiFor(y, meridianHours);
  if (day < sui.months[0].startDay) sui = suiFor(y - 1, meridianHours);
  const month = sui.months.find((m) => day >= m.startDay && day < m.endDay) ?? sui.months[sui.months.length - 1];
  const { stemIndex, branchIndex, animalKey } = sexagenaryOf(month.year);
  return {
    year: month.year,
    month: month.number,
    day: day - month.startDay + 1,
    isLeapMonth: month.leap,
    animalKey,
    stemIndex,
    branchIndex,
  };
}
