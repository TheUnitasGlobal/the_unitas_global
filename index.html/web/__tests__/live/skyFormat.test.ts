import { describe, expect, it } from 'vitest';
import {
  COMPASS_16,
  compassPoint16,
  formatAu,
  formatCoord,
  formatDeg,
  formatDegMin,
  formatDistanceKm,
  formatFixed,
  formatFullDate,
  formatIlluminationPct,
  formatInstant,
  formatJd,
  formatMoonAge,
  formatRaHm,
  formatSignedDeg,
  formatUtcOffset,
  ringPoint,
  ringSegmentPath,
} from '@/lib/live/skyFormat';

// REV-42 D-5 (lane F) -- the pure formatters the tier-3 sky view prints
// through. Every value is pinned as a string so a locale regression (a
// grouping separator inside a longitude, a rounded arcminute, a "-" where
// Intl's minus belongs) is caught here and not on a screen.

/** Intl's minus sign for `en` is U+2212; the fallback path uses U+002D. */
const MINUS = new Intl.NumberFormat('en', { signDisplay: 'always' }).format(-1).charAt(0);

describe('formatFixed', () => {
  it('groups with the locale and keeps exactly the digits asked for', () => {
    expect(formatFixed(384400, 'en', 0)).toBe('384,400');
    expect(formatFixed(384400, 'de', 0)).toBe('384.400');
    expect(formatFixed(1.5, 'en', 3)).toBe('1.500');
  });
  it('returns an empty string for a non-finite value', () => {
    expect(formatFixed(Number.NaN, 'en', 2)).toBe('');
    expect(formatFixed(Number.POSITIVE_INFINITY, 'en', 2)).toBe('');
  });
});

describe('angles', () => {
  it('formatDeg never groups a longitude', () => {
    expect(formatDeg(165.2345, 'en')).toBe('165.23°');
    expect(formatDeg(1234.5, 'en', 1)).toBe('1234.5°');
    expect(formatDeg(0, 'en')).toBe('0.00°');
  });
  it('formatSignedDeg always carries a sign', () => {
    expect(formatSignedDeg(23.4392, 'en')).toBe('+23.44°');
    expect(formatSignedDeg(-5.123, 'en')).toBe(`${MINUS}5.12°`);
    expect(formatSignedDeg(0, 'en')).toBe('+0.00°');
  });
  it('formatDegMin truncates the arcminutes and pads them', () => {
    expect(formatDegMin(23.4392, 'en')).toBe('+23° 26′');
    expect(formatDegMin(29.9999, 'en')).toBe('+29° 59′');
    expect(formatDegMin(-5.05, 'en')).toBe(`${MINUS}5° 02′`);
    expect(formatDegMin(0, 'en')).toBe('+0° 00′');
  });
});

describe('formatRaHm', () => {
  it('prints hours and minutes, seconds on request, truncating like a clock', () => {
    expect(formatRaHm(5.5881)).toBe('05h 35m');
    expect(formatRaHm(5.5881, true)).toBe('05h 35m 17s');
    expect(formatRaHm(0)).toBe('00h 00m');
  });
  it('wraps into [0, 24)', () => {
    expect(formatRaHm(24)).toBe('00h 00m');
    expect(formatRaHm(-1)).toBe('23h 00m');
    expect(formatRaHm(23.99999, true)).toBe('23h 59m 59s');
  });
});

describe('distances', () => {
  it('formatDistanceKm rounds to whole kilometres with grouping', () => {
    expect(formatDistanceKm(384399.6, 'en')).toBe('384,400 km');
    expect(formatDistanceKm(384399.6, 'fr')).toMatch(/^384.400 km$/);
  });
  it('formatAu prints four decimals, ungrouped', () => {
    expect(formatAu(1.00341, 'en')).toBe('1.0034 AU');
    expect(formatAu(0.98329, 'en')).toBe('0.9833 AU');
  });
});

describe('almanac numbers', () => {
  it('formatJd prints five decimals without grouping', () => {
    expect(formatJd(2461302.123456, 'en')).toBe('2461302.12346');
    expect(formatJd(2451545, 'en')).toBe('2451545.00000');
  });
  it('formatCoord prints two decimals, signed only when negative', () => {
    expect(formatCoord(37.5665, 'en')).toBe('37.57');
    expect(formatCoord(-122.4194, 'en')).toBe(`${MINUS}122.42`);
  });
  it('formatIlluminationPct clamps and rounds to a whole percent', () => {
    expect(formatIlluminationPct(0.634, 'en')).toBe('63');
    expect(formatIlluminationPct(1.0000001, 'en')).toBe('100');
    expect(formatIlluminationPct(-0.0001, 'en')).toBe('0');
  });
  it('formatMoonAge prints one decimal and never a negative age', () => {
    expect(formatMoonAge(12.44, 'en')).toBe('12.4');
    expect(formatMoonAge(-0.2, 'en')).toBe('0.0');
  });
});

describe('formatUtcOffset', () => {
  it('prints the visitor offset in the -getTimezoneOffset() sign', () => {
    expect(formatUtcOffset(540)).toBe('+09:00');
    expect(formatUtcOffset(-210)).toBe('-03:30');
    expect(formatUtcOffset(0)).toBe('+00:00');
    expect(formatUtcOffset(Number.NaN)).toBe('+00:00');
  });
});

describe('compassPoint16', () => {
  it('lists the sixteen points from north through east', () => {
    expect(COMPASS_16).toHaveLength(16);
    expect(COMPASS_16[0]).toBe('N');
    expect(COMPASS_16[4]).toBe('E');
    expect(COMPASS_16[8]).toBe('S');
    expect(COMPASS_16[12]).toBe('W');
  });
  it('gives each point a 22.5° sector centred on its bearing', () => {
    expect(compassPoint16(0)).toBe('N');
    expect(compassPoint16(11.24)).toBe('N');
    expect(compassPoint16(11.26)).toBe('NNE');
    expect(compassPoint16(45)).toBe('NE');
    expect(compassPoint16(90)).toBe('E');
    expect(compassPoint16(180)).toBe('S');
    expect(compassPoint16(270)).toBe('W');
    expect(compassPoint16(348.76)).toBe('N');
    expect(compassPoint16(359.9)).toBe('N');
  });
  it('wraps negative and oversized azimuths', () => {
    expect(compassPoint16(-90)).toBe('W');
    expect(compassPoint16(450)).toBe('E');
    expect(compassPoint16(Number.NaN)).toBe('N');
  });
});

describe('instants', () => {
  const ms = Date.UTC(2026, 8, 23, 0, 5); // 2026-09-23T00:05Z (the autumn equinox, SPEC §5)
  it('formatInstant prints a short date + time in the zone asked for', () => {
    const out = formatInstant(ms, 'en', 'UTC');
    expect(out).toMatch(/Sep/);
    expect(out).toMatch(/23/);
    expect(out).toMatch(/12:05|00:05/);
    expect(formatInstant(ms, 'en', 'Asia/Seoul')).toMatch(/09:05/);
  });
  it('formatFullDate prints the full civil date', () => {
    expect(formatFullDate(ms, 'en', 'UTC')).toBe('Wednesday, September 23, 2026');
    expect(formatFullDate(ms, 'ko', 'Asia/Seoul')).toContain('2026');
  });
  it('returns an empty string for a non-finite instant', () => {
    expect(formatInstant(Number.NaN, 'en')).toBe('');
    expect(formatFullDate(Number.NaN, 'en')).toBe('');
  });
});

describe('ring geometry', () => {
  it('puts 0° at the right and walks counter-clockwise on screen', () => {
    expect(ringPoint(0, 100, 100, 80)).toEqual({ x: 180, y: 100 });
    expect(ringPoint(90, 100, 100, 80)).toEqual({ x: 100, y: 20 });
    expect(ringPoint(180, 100, 100, 80)).toEqual({ x: 20, y: 100 });
    expect(ringPoint(270, 100, 100, 80)).toEqual({ x: 100, y: 180 });
  });
  it('draws an annular sector that closes on itself', () => {
    const d = ringSegmentPath(0, 30, 100, 100, 60, 80);
    expect(d.startsWith('M 180 100 A 80 80 0 0 0 ')).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
    expect(d).toContain('A 60 60 0 0 1 ');
    // Four vertices, two arcs, one close: no NaN anywhere.
    expect(d).not.toMatch(/NaN/);
  });
});
