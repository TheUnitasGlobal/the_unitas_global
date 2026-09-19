import { describe, expect, it } from 'vitest';
import {
  ANIMAL_KEYS,
  MOON_PHASE_KEYS,
  SOLAR_TERM_KEYS,
  ZODIAC_KEYS,
  civilDateAt,
  countdownParts,
  lunarMeridianFor,
  moonPhaseWidgetFor,
  skySnapshot,
  type MoonPhaseWidget,
  type SkySnapshot,
} from '@/lib/live/skyAlmanac';
import {
  MS_PER_DAY,
  altAz,
  gmstHours,
  julianDay,
  lmstHours,
  lunarDate,
  moonPhase,
  moonPosition,
  solarTermOf,
  sunPosition,
  zodiacOf,
} from '@/lib/live/celestial';

// REV-42 SPEC.md D-2 / D-3 / S3 -- the two almanac shapes the UI consumes,
// pinned to the engine they wrap and to the visitor-facing rules (civil
// date by device offset, lunar date by the locale's meridian).

const NOW = Date.UTC(2026, 8, 18, 12); // 2026-09-18T12:00Z, bailu, lunar 8/8
const SEOUL = { lat: 37.5665, lon: 126.978 };

describe('skyAlmanac · key arrays', () => {
  it('re-exports the 24 / 12 / 8 / 12 key arrays, unique and in canonical order', () => {
    expect(SOLAR_TERM_KEYS).toHaveLength(24);
    expect(ZODIAC_KEYS).toHaveLength(12);
    expect(MOON_PHASE_KEYS).toHaveLength(8);
    expect(ANIMAL_KEYS).toHaveLength(12);
    for (const arr of [SOLAR_TERM_KEYS, ZODIAC_KEYS, MOON_PHASE_KEYS, ANIMAL_KEYS]) {
      expect(new Set(arr).size).toBe(arr.length);
      for (const key of arr) expect(key).toMatch(/^[a-z][A-Za-z]*$/);
    }
    expect(SOLAR_TERM_KEYS[0]).toBe('lichun');
    expect(SOLAR_TERM_KEYS[21]).toBe('dongzhi');
    expect(ZODIAC_KEYS[0]).toBe('aries');
    expect(ZODIAC_KEYS[11]).toBe('pisces');
    expect(MOON_PHASE_KEYS[0]).toBe('newMoon');
    expect(MOON_PHASE_KEYS[4]).toBe('fullMoon');
    expect(ANIMAL_KEYS[0]).toBe('rat');
    expect(ANIMAL_KEYS[6]).toBe('horse');
    expect(lunarMeridianFor('ko')).toBe(9);
  });
});

describe('skyAlmanac · moonPhaseWidgetFor', () => {
  it('builds the SPEC S3 shape from the engine for 2026-09-18T12:00Z (ko, +540)', () => {
    const w: MoonPhaseWidget = moonPhaseWidgetFor(NOW, 'ko', 540);
    expect(w.kind).toBe('moonPhase');
    expect(w.nowMs).toBe(NOW);
    expect(w.gregorian).toEqual({ y: 2026, m: 9, d: 18 });
    expect(w.lunar).toEqual({ year: 2026, month: 8, day: 8, leap: false, animalKey: 'horse' });
    expect(w.termKey).toBe('bailu');
    expect(w.nextTermKey).toBe('qiufen');
    expect(w.nextTermMs).toBeGreaterThan(NOW);
    expect(w.nextTermMs).toBe(solarTermOf(NOW).nextStartMs);
    expect(w.sunLon).toBe(sunPosition(NOW).lon);
    expect(w.moonLon).toBe(moonPosition(NOW).lon);
    expect(w.sunLon).toBeGreaterThanOrEqual(165);
    expect(w.sunLon).toBeLessThan(180);
    const phase = moonPhase(NOW);
    expect(w.phaseKey).toBe(phase.phaseKey);
    expect(w.illumination).toBe(phase.illumination);
    expect(w.ageDays).toBe(phase.ageDays);
    expect(w.waxing).toBe(phase.waxing);
    expect(w.phaseAngle).toBe(phase.phaseAngle);
    // Lunar 8/8 is a first-quarter-ish waxing moon, age ~7 days.
    expect(w.waxing).toBe(true);
    expect(w.phaseKey).toBe('firstQuarter');
    expect(w.ageDays).toBeGreaterThan(6.5);
    expect(w.ageDays).toBeLessThan(8);
    expect(w.illumination).toBeGreaterThan(0.35);
    expect(w.illumination).toBeLessThan(0.65);
    expect(Object.keys(w).sort()).toEqual(
      [
        'kind',
        'nowMs',
        'gregorian',
        'lunar',
        'phaseKey',
        'illumination',
        'ageDays',
        'waxing',
        'phaseAngle',
        'termKey',
        'nextTermKey',
        'nextTermMs',
        'sunLon',
        'moonLon',
      ].sort(),
    );
  });

  it('reckons the Gregorian date in the device offset when given, else UTC', () => {
    const late = Date.UTC(2026, 8, 18, 20); // 20:00Z = 05:00 KST next day, 10:00 HST same day
    expect(moonPhaseWidgetFor(late, 'en').gregorian).toEqual({ y: 2026, m: 9, d: 18 });
    expect(moonPhaseWidgetFor(late, 'en', 0).gregorian).toEqual({ y: 2026, m: 9, d: 18 });
    expect(moonPhaseWidgetFor(late, 'ko', 540).gregorian).toEqual({ y: 2026, m: 9, d: 19 });
    expect(moonPhaseWidgetFor(late, 'en', -600).gregorian).toEqual({ y: 2026, m: 9, d: 18 });
    expect(moonPhaseWidgetFor(Date.UTC(2026, 11, 31, 23, 30), 'de', 60).gregorian).toEqual({ y: 2027, m: 1, d: 1 });
    expect(civilDateAt(Date.UTC(2026, 0, 1, 0, 30), -60)).toEqual({ y: 2025, m: 12, d: 31 });
  });

  it('reckons the lunar date on the locale meridian: 2027-02-06T16:30Z is 1/1 for ko and 1/2 for zh / en', () => {
    const ms = Date.UTC(2027, 1, 6, 16, 30);
    expect(moonPhaseWidgetFor(ms, 'ko', 540).lunar).toEqual({ year: 2027, month: 1, day: 1, leap: false, animalKey: 'goat' });
    expect(moonPhaseWidgetFor(ms, 'ja', 540).lunar.day).toBe(1);
    expect(moonPhaseWidgetFor(ms, 'zh', 480).lunar).toEqual({ year: 2027, month: 1, day: 2, leap: false, animalKey: 'goat' });
    expect(moonPhaseWidgetFor(ms, 'en', 0).lunar.day).toBe(2);
    expect(moonPhaseWidgetFor(ms, 'vi', 420).lunar.day).toBe(1);
    // The device offset never leaks into the lunar date: same locale, any
    // offset, same lunar day.
    expect(moonPhaseWidgetFor(ms, 'ko', -300).lunar.day).toBe(1);
    expect(moonPhaseWidgetFor(ms, 'zh', 540).lunar.day).toBe(2);
    // Leap month flag travels through: 2025-07-25 is leap-6 day 1.
    expect(moonPhaseWidgetFor(Date.UTC(2025, 6, 25, 3), 'ko', 540).lunar).toEqual({ year: 2025, month: 6, day: 1, leap: true, animalKey: 'snake' });
  });

  it('is deterministic for a fixed nowMs (no clock, no dice)', () => {
    const a = moonPhaseWidgetFor(NOW, 'ko', 540);
    const b = moonPhaseWidgetFor(NOW, 'ko', 540);
    expect(a).toEqual(b);
  });
});

describe('skyAlmanac · skySnapshot', () => {
  it('assembles the tier-3 shape for Seoul at 2026-09-18T12:00Z from the same engine calls', () => {
    const s: SkySnapshot = skySnapshot(NOW, SEOUL.lat, SEOUL.lon, 'ko');
    expect(s.nowMs).toBe(NOW);
    expect(s.observer).toEqual({ lat: SEOUL.lat, lon: SEOUL.lon });
    expect(s.jd).toBe(julianDay(NOW));
    expect(s.gmstHours).toBe(gmstHours(NOW));
    expect(s.lmstHours).toBe(lmstHours(NOW, SEOUL.lon));
    const sun = sunPosition(NOW);
    const moon = moonPosition(NOW);
    expect(s.sun.lon).toBe(sun.lon);
    expect(s.sun.ra).toBe(sun.ra);
    expect(s.sun.dec).toBe(sun.dec);
    expect(s.sun.distAu).toBe(sun.distAu);
    expect(s.sun.zodiac).toEqual(zodiacOf(sun.lon));
    expect(s.sun.zodiac.key).toBe('virgo');
    expect({ alt: s.sun.alt, az: s.sun.az }).toEqual(altAz(sun.ra, sun.dec, NOW, SEOUL.lat, SEOUL.lon));
    expect(s.moon.lon).toBe(moon.lon);
    expect(s.moon.lat).toBe(moon.lat);
    expect(s.moon.ra).toBe(moon.ra);
    expect(s.moon.dec).toBe(moon.dec);
    expect(s.moon.distKm).toBe(moon.distKm);
    expect(s.moon.zodiac).toEqual(zodiacOf(moon.lon));
    expect({ alt: s.moon.alt, az: s.moon.az }).toEqual(altAz(moon.ra, moon.dec, NOW, SEOUL.lat, SEOUL.lon));
    expect(s.moon.phase).toEqual(moonPhase(NOW));
    expect(s.term).toEqual(solarTermOf(NOW));
    expect(s.term.key).toBe('bailu');
    expect(s.lunar).toEqual(lunarDate(NOW, 9));
    expect(s.lunar.month).toBe(8);
    expect(s.lunar.day).toBe(8);
  });

  it('keeps every horizontal / sidereal value in range and the meridian follows the locale', () => {
    for (const [i, ms] of [NOW, NOW + 6 * 3_600_000, NOW + 100 * MS_PER_DAY, Date.UTC(2027, 1, 6, 16, 30)].entries()) {
      const s = skySnapshot(ms, SEOUL.lat, SEOUL.lon, i % 2 === 0 ? 'ko' : 'zh');
      for (const body of [s.sun, s.moon]) {
        expect(Math.abs(body.alt)).toBeLessThanOrEqual(90);
        expect(body.az).toBeGreaterThanOrEqual(0);
        expect(body.az).toBeLessThan(360);
        expect(body.ra).toBeGreaterThanOrEqual(0);
        expect(body.ra).toBeLessThan(24);
        expect(body.lon).toBeGreaterThanOrEqual(0);
        expect(body.lon).toBeLessThan(360);
        expect(body.zodiac.deg).toBeGreaterThanOrEqual(0);
        expect(body.zodiac.deg).toBeLessThanOrEqual(29);
        expect(body.zodiac.min).toBeGreaterThanOrEqual(0);
        expect(body.zodiac.min).toBeLessThanOrEqual(59);
      }
      expect(s.gmstHours).toBeGreaterThanOrEqual(0);
      expect(s.gmstHours).toBeLessThan(24);
      expect(s.lmstHours).toBeGreaterThanOrEqual(0);
      expect(s.lmstHours).toBeLessThan(24);
      expect(s.term.startMs).toBeLessThanOrEqual(ms);
      expect(s.term.nextStartMs).toBeGreaterThan(ms);
    }
    const split = Date.UTC(2027, 1, 6, 16, 30);
    expect(skySnapshot(split, SEOUL.lat, SEOUL.lon, 'ko').lunar.day).toBe(1);
    expect(skySnapshot(split, SEOUL.lat, SEOUL.lon, 'zh').lunar.day).toBe(2);
  });

  it('the Sun is up at Seoul noon and down at Seoul midnight; sidereal time advances 1 s per second', () => {
    const noon = Date.UTC(2026, 8, 18, 3, 26);
    const midnight = Date.UTC(2026, 8, 18, 15);
    expect(skySnapshot(noon, SEOUL.lat, SEOUL.lon, 'ko').sun.alt).toBeGreaterThan(50);
    expect(skySnapshot(midnight, SEOUL.lat, SEOUL.lon, 'ko').sun.alt).toBeLessThan(-40);
    const a = skySnapshot(noon, SEOUL.lat, SEOUL.lon, 'ko').lmstHours;
    const b = skySnapshot(noon + 1000, SEOUL.lat, SEOUL.lon, 'ko').lmstHours;
    // One sidereal second per solar second is 1.0027379 s: 1 s of LMST
    // advances by 1/3600 h times that factor.
    expect((b - a) * 3600).toBeCloseTo(1.0027379, 4);
  });
});

describe('skyAlmanac · countdownParts', () => {
  it('splits a positive delta into whole days and hours and floors the past at zero', () => {
    expect(countdownParts(NOW, NOW + 4 * MS_PER_DAY + 12 * 3_600_000 + 59 * 60_000)).toEqual({ days: 4, hours: 12 });
    expect(countdownParts(NOW, NOW + 30 * 60_000)).toEqual({ days: 0, hours: 0 });
    expect(countdownParts(NOW, NOW - 1)).toEqual({ days: 0, hours: 0 });
    const w = moonPhaseWidgetFor(NOW, 'ko', 540);
    expect(countdownParts(NOW, w.nextTermMs)).toEqual({ days: 4, hours: 12 });
  });
});
