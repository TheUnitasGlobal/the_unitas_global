/**
 * REV-42 D-5 (lane F) -- the pure string formatters of the tier-3 sky view
 * (components/home/detail/SkyDetail.tsx, mirrored by CosmosDetail).
 *
 * Every function takes a number (and a locale) and returns a string; none
 * reads a clock, none rolls a die (SPEC 1-A #14), and every `Intl` call is
 * fenced by a plain-digit fallback so an unknown locale tag can never blank
 * a row. Right ascension is in HOURS (the engine's contract), every other
 * angle in degrees. The minus sign is the locale's own (`Intl` emits U+2212
 * for most tags) -- a hand-rolled "-" would disagree with the grouping
 * separator on the same line.
 */

/** Locale-grouped fixed-point number; plain `toFixed` when Intl rejects. */
export function formatFixed(value: number, locale: string, digits: number, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) return '';
  try {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, ...options }).format(value);
  } catch {
    return value.toFixed(digits);
  }
}

/** A signed angle: "+23.44°" / "−5.12°" (signDisplay always, so a
 *  declination on the equator still reads "+0.00°"). */
export function formatSignedDeg(deg: number, locale: string, digits = 2): string {
  if (!Number.isFinite(deg)) return '';
  return `${formatFixed(deg, locale, digits, { signDisplay: 'always', useGrouping: false })}°`;
}

/** An unsigned angle in degrees: "165.23°". Longitudes never carry a group
 *  separator (there is no "1,65.23°"). */
export function formatDeg(deg: number, locale: string, digits = 2): string {
  if (!Number.isFinite(deg)) return '';
  return `${formatFixed(deg, locale, digits, { useGrouping: false })}°`;
}

/** Degrees and arcminutes of a signed angle: "+23° 26′". The minutes are
 *  truncated, not rounded, so 29.999° never reads as "30° 00′". */
export function formatDegMin(deg: number, locale: string): string {
  if (!Number.isFinite(deg)) return '';
  const sign = deg < 0 ? '-' : '+';
  const abs = Math.abs(deg);
  const whole = Math.floor(abs);
  const min = Math.floor((abs - whole) * 60);
  const signed = formatFixed(sign === '-' ? -whole : whole, locale, 0, { signDisplay: 'always', useGrouping: false });
  return `${signed}° ${pad2(min)}′`;
}

/** Right ascension in hours -> "05h 35m" (or "05h 35m 17s" with
 *  `seconds`), wrapped into [0, 24). Seconds truncate like a clock. */
export function formatRaHm(hours: number, seconds = false): string {
  if (!Number.isFinite(hours)) return '';
  let h = hours % 24;
  if (h < 0) h += 24;
  let total = Math.floor(h * 3600);
  if (total >= 86_400) total = 0;
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return seconds ? `${pad2(hh)}h ${pad2(mm)}m ${pad2(ss)}s` : `${pad2(hh)}h ${pad2(mm)}m`;
}

/** Kilometres with the locale's grouping, no decimals: "384,400 km". */
export function formatDistanceKm(km: number, locale: string): string {
  if (!Number.isFinite(km)) return '';
  return `${formatFixed(Math.round(km), locale, 0)} km`;
}

/** Astronomical units to four decimals: "1.0034 AU". */
export function formatAu(au: number, locale: string): string {
  if (!Number.isFinite(au)) return '';
  return `${formatFixed(au, locale, 4, { useGrouping: false })} AU`;
}

/** A Julian Day to five decimals, ungrouped ("2461302.12345") -- the way
 *  an almanac prints it. */
export function formatJd(jd: number, locale: string): string {
  if (!Number.isFinite(jd)) return '';
  return formatFixed(jd, locale, 5, { useGrouping: false });
}

/** A geographic coordinate to two decimals, signed only when negative
 *  ("37.57", "−122.42") -- the `{lat}` / `{lon}` of Rev42.sky.observerLine. */
export function formatCoord(deg: number, locale: string): string {
  if (!Number.isFinite(deg)) return '';
  return formatFixed(deg, locale, 2, { useGrouping: false });
}

/** Illuminated fraction 0..1 -> a whole percent number ("63"), the `{pct}`
 *  of Rev42.sky.illumination. Clamped: the engine's rounding may sit a hair
 *  outside [0, 1] at syzygy. */
export function formatIlluminationPct(fraction: number, locale: string): string {
  if (!Number.isFinite(fraction)) return '';
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return formatFixed(pct, locale, 0);
}

/** Moon age in days to one decimal ("12.4"), the `{age}` of Rev42.sky.moonAge. */
export function formatMoonAge(ageDays: number, locale: string): string {
  if (!Number.isFinite(ageDays)) return '';
  return formatFixed(Math.max(0, ageDays), locale, 1, { useGrouping: false });
}

/** A UTC offset in minutes (JavaScript's `-getTimezoneOffset()` sign) ->
 *  "+09:00" / "−03:30" / "+00:00" -- the `{offset}` of Rev42.sky.utcOffset. */
export function formatUtcOffset(offsetMinutes: number): string {
  if (!Number.isFinite(offsetMinutes)) return '+00:00';
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(Math.round(offsetMinutes));
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

/** The sixteen compass points, from north through east. Each point owns a
 *  22.5° sector centred on its bearing: 348.75°..11.25° is N. */
export const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'] as const;
export type CompassPoint = (typeof COMPASS_16)[number];

export function compassPoint16(azDeg: number): CompassPoint {
  if (!Number.isFinite(azDeg)) return 'N';
  let az = azDeg % 360;
  if (az < 0) az += 360;
  const index = Math.round(az / 22.5) % 16;
  return COMPASS_16[index];
}

/** An instant as the locale's short date + time ("Sep 23, 09:05"), in the
 *  device zone unless `timeZone` is given (tests pin 'UTC'). Plain ISO
 *  minutes when Intl rejects the tag. */
export function formatInstant(ms: number, locale: string, timeZone?: string): string {
  if (!Number.isFinite(ms)) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : null),
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** The visitor's full civil date ("Friday, September 18, 2026"). */
export function formatFullDate(ms: number, locale: string, timeZone?: string): string {
  if (!Number.isFinite(ms)) return '';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'full', ...(timeZone ? { timeZone } : null) }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/**
 * Where an ecliptic longitude lands on a ring drawn in an SVG whose y axis
 * points down: 0° (the vernal point) at the right, longitude increasing
 * counter-clockwise as on a star chart. Returns the SVG point.
 */
export function ringPoint(lonDeg: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const rad = (lonDeg * Math.PI) / 180;
  return { x: round3(cx + r * Math.cos(rad)), y: round3(cy - r * Math.sin(rad)) };
}

/** The SVG path of one ring segment [fromDeg, toDeg) between radii r0 < r1
 *  (an annular sector), same orientation as `ringPoint`. Segments are at
 *  most 30° here, so the large-arc flag is always 0. */
export function ringSegmentPath(fromDeg: number, toDeg: number, cx: number, cy: number, r0: number, r1: number): string {
  const a = ringPoint(fromDeg, cx, cy, r1);
  const b = ringPoint(toDeg, cx, cy, r1);
  const c = ringPoint(toDeg, cx, cy, r0);
  const d = ringPoint(fromDeg, cx, cy, r0);
  // Counter-clockwise on screen (sweep-flag 0) along the outer arc, back
  // clockwise (sweep-flag 1) along the inner one.
  return `M ${a.x} ${a.y} A ${r1} ${r1} 0 0 0 ${b.x} ${b.y} L ${c.x} ${c.y} A ${r0} ${r0} 0 0 1 ${d.x} ${d.y} Z`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
