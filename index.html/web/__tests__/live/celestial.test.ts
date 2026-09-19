import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ANIMAL_KEYS,
  J2000_JD,
  J2000_MS,
  MOON_PHASE_KEYS,
  MS_PER_DAY,
  SOLAR_TERM_KEYS,
  ZODIAC_KEYS,
  altAz,
  civilDayIndex,
  deltaTSeconds,
  earthHeliocentric,
  formatHms,
  gmstHours,
  julianDay,
  lastNewMoonAtOrBefore,
  lmstHours,
  lunarDate,
  lunarMeridianFor,
  lunarPhaseInstant,
  moonPhase,
  moonPosition,
  msFromJulianDay,
  newMoonNear,
  newMoonsBetween,
  normalizeDeg,
  sexagenaryOf,
  signedDeg,
  solarTermInstant,
  solarTermLongitude,
  solarTermOf,
  sunPosition,
  sunPositionLowAccuracy,
  zodiacOf,
} from '@/lib/live/celestial';

// REV-42 SPEC.md D-2 / S5 -- the celestial engine pinned against the
// almanac vectors, Meeus' own worked examples and ICU's lunisolar calendars.
// Every instant below is UTC; the engine converts to TT internally.

const MIN = 60_000;
const iso = (ms: number): string => new Date(ms).toISOString();

function expectInstant(got: number, expected: number, toleranceMs: number, label: string): void {
  const deltaMin = ((got - expected) / MIN).toFixed(2);
  expect(
    Math.abs(got - expected),
    `${label}: got ${iso(got)}, expected ${iso(expected)} (${deltaMin} min off)`,
  ).toBeLessThanOrEqual(toleranceMs);
}

/** Meeus examples are given at 0h TD (dynamical time); this turns such a
 *  JDE into the UTC instant the engine expects. */
const utcOfJde = (jde: number): number => msFromJulianDay(jde - deltaTSeconds(jde) / 86_400);

describe('celestial · time scales', () => {
  it('GMST at J2000.0 is 18.697374558 h within a second (SPEC S5)', () => {
    expect(julianDay(J2000_MS)).toBe(J2000_JD);
    expect(J2000_MS).toBe(Date.UTC(2000, 0, 1, 12));
    expect(Math.abs(gmstHours(J2000_MS) - 18.697374558) * 3600).toBeLessThan(1);
  });

  it('julianDay and msFromJulianDay invert each other to double precision (~0.01 ms at JD 2.46e6)', () => {
    for (const ms of [0, J2000_MS, Date.UTC(2026, 8, 18, 12, 34, 56, 789), Date.UTC(1977, 1, 18, 3, 37)]) {
      expect(Math.abs(msFromJulianDay(julianDay(ms)) - ms)).toBeLessThan(0.05);
    }
  });

  it('LMST adds the east longitude and formatHms wraps, pads and truncates', () => {
    const ms = Date.UTC(2026, 8, 18, 12);
    expect(lmstHours(ms, 0)).toBeCloseTo(gmstHours(ms), 12);
    expect(normalizeDeg((lmstHours(ms, 126.978) - gmstHours(ms)) * 15)).toBeCloseTo(126.978, 9);
    expect(normalizeDeg((lmstHours(ms, -74) - gmstHours(ms)) * 15)).toBeCloseTo(286, 9);
    expect(formatHms(18.697374558)).toBe('18:41:50');
    expect(formatHms(0)).toBe('00:00:00');
    expect(formatHms(-0.5)).toBe('23:30:00');
    expect(formatHms(24)).toBe('00:00:00');
    expect(formatHms(23.9999999)).toBe('23:59:59');
    expect(formatHms(gmstHours(ms))).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('dT sits on the measured 69 s plateau now and joins the polynomial fits continuously', () => {
    expect(deltaTSeconds(julianDay(Date.UTC(2026, 0, 1)))).toBeCloseTo(69.2, 6);
    // 2015.0 from the 2005-2050 fit is 69.0 s: the plateau join is < 0.3 s.
    expect(Math.abs(deltaTSeconds(julianDay(Date.UTC(2014, 11, 31))) - 69.2)).toBeLessThan(0.3);
    // The 2000 boundary between the 1986-2005 fit and the next: both give ~64 s.
    expect(deltaTSeconds(julianDay(Date.UTC(2000, 0, 1)))).toBeCloseTo(63.86, 1);
    expect(deltaTSeconds(julianDay(Date.UTC(1977, 1, 18)))).toBeGreaterThan(45);
    expect(deltaTSeconds(julianDay(Date.UTC(1977, 1, 18)))).toBeLessThan(50);
  });

  it('normalizeDeg / signedDeg reduce into [0,360) and [-180,180)', () => {
    expect(normalizeDeg(-30)).toBe(330);
    expect(normalizeDeg(720)).toBe(0);
    expect(normalizeDeg(359.5)).toBe(359.5);
    expect(signedDeg(350)).toBe(-10);
    expect(signedDeg(180)).toBe(-180);
    expect(signedDeg(179)).toBe(179);
  });
});

describe('celestial · the Sun', () => {
  it('reproduces Meeus example 25.b (1992-10-13 0h TD): L 19.907372, B -0.000179, R 0.99760775', () => {
    const ms = utcOfJde(2448908.5);
    const earth = earthHeliocentric(ms);
    expect(earth.L).toBeCloseTo(19.907372, 5);
    expect(earth.B).toBeCloseTo(-0.000179, 5);
    expect(earth.R).toBeCloseTo(0.99760775, 7);
    const sun = sunPosition(ms);
    // Apparent longitude after FK5, nutation (+15.9") and aberration (-20.5").
    expect(sun.lon).toBeCloseTo(199.90606, 3);
    expect(sun.distAu).toBeCloseTo(0.99760775, 7);
    expect(sun.ra).toBeCloseTo(13.2252, 3);
    expect(sun.dec).toBeCloseTo(-7.784, 2);
  });

  it('the VSOP87 Sun and the independent ch.25 low-accuracy Sun agree to 0.01 deg across 2000-2050', () => {
    // A transcription slip in any large VSOP87 term would break this; the
    // low-accuracy series shares no coefficient with the tables.
    let worst = 0;
    for (let i = 0; i < 2000; i++) {
      const ms = Date.UTC(2000, 0, 1) + i * 9.131 * MS_PER_DAY;
      const diff = Math.abs(signedDeg(sunPosition(ms).lon - sunPositionLowAccuracy(ms).lon));
      if (diff > worst) worst = diff;
      expect(Math.abs(sunPosition(ms).distAu - sunPositionLowAccuracy(ms).distAu)).toBeLessThan(0.0001);
    }
    expect(worst).toBeLessThan(0.01);
  });

  it('finds the 2026 equinoxes and solstices within 20 minutes of the almanac (SPEC S5)', () => {
    expectInstant(solarTermInstant(Date.UTC(2026, 2, 20), 0), Date.UTC(2026, 2, 20, 14, 46), 20 * MIN, 'March equinox 2026');
    expectInstant(solarTermInstant(Date.UTC(2026, 5, 21), 90), Date.UTC(2026, 5, 21, 8, 24), 20 * MIN, 'June solstice 2026');
    expectInstant(solarTermInstant(Date.UTC(2026, 8, 23), 180), Date.UTC(2026, 8, 23, 0, 5), 20 * MIN, 'September equinox 2026');
    expectInstant(solarTermInstant(Date.UTC(2026, 11, 21), 270), Date.UTC(2026, 11, 21, 20, 50), 20 * MIN, 'December solstice 2026');
    // The VSOP87 series actually lands within a minute; guard the gain so a
    // regression to the low-accuracy path would be visible, not silent.
    expectInstant(solarTermInstant(Date.UTC(2026, 2, 20), 0), Date.UTC(2026, 2, 20, 14, 46), 2 * MIN, 'March equinox 2026 (tight)');
    expectInstant(solarTermInstant(Date.UTC(2025, 2, 20), 0), Date.UTC(2025, 2, 20, 9, 1), 2 * MIN, 'March equinox 2025 (tight)');
  });

  it('solarTermInstant walks to the nearest crossing from either side and across the 360 wrap', () => {
    const equinox = solarTermInstant(Date.UTC(2026, 2, 20), 0);
    expect(solarTermInstant(Date.UTC(2026, 2, 5), 0)).toBeCloseTo(equinox, -3);
    expect(solarTermInstant(Date.UTC(2026, 3, 10), 0)).toBeCloseTo(equinox, -3);
    expect(solarTermInstant(Date.UTC(2026, 2, 20, 14, 46), 0)).toBeCloseTo(equinox, -3);
    expect(Math.abs(signedDeg(sunPosition(equinox).lon))).toBeLessThan(0.0001);
  });
});

describe('celestial · the Moon', () => {
  it('reproduces Meeus example 47.a (1992-04-12 0h TD): lon 133.167265, lat -3.229126, 368409.7 km', () => {
    const moon = moonPosition(utcOfJde(2448724.5));
    expect(moon.lon).toBeCloseTo(133.167265, 3);
    expect(moon.lat).toBeCloseTo(-3.229126, 4);
    expect(moon.distKm).toBeCloseTo(368409.7, 0);
    expect(moon.ra).toBeCloseTo(134.688470 / 15, 3);
    expect(moon.dec).toBeCloseTo(13.768368, 3);
  });

  it('new moons 2026-02-17 12:01 and 2026-08-12 17:37 within 20 minutes (SPEC S5), and ch.49 agrees with the ch.47 elongation root', () => {
    const feb = newMoonNear(Date.UTC(2026, 1, 17, 12, 1));
    const aug = newMoonNear(Date.UTC(2026, 7, 12, 17, 37));
    expectInstant(feb, Date.UTC(2026, 1, 17, 12, 1), 20 * MIN, 'new moon 2026-02-17');
    expectInstant(aug, Date.UTC(2026, 7, 12, 17, 37), 20 * MIN, 'new moon 2026-08-12');
    // Two independent theories (ch.49 series vs ch.47 + ch.25 positions):
    // they must agree to a couple of minutes or a table is mistyped.
    expectInstant(lunarPhaseInstant(feb, 0), feb, 2 * MIN, 'ch.47 elongation root vs ch.49 (Feb)');
    expectInstant(lunarPhaseInstant(aug, 0), aug, 2 * MIN, 'ch.47 elongation root vs ch.49 (Aug)');
    expect(moonPhase(feb).phaseAngle < 0.05 || moonPhase(feb).phaseAngle > 359.95).toBe(true);
  });

  it('reproduces Meeus example 49.a: new moon 1977-02-18 03:37:42 TD', () => {
    const got = newMoonNear(Date.UTC(1977, 1, 18));
    expectInstant(got, utcOfJde(2443192.65118), 1 * MIN, 'new moon 1977-02-18');
  });

  it('full moon 2026-09-26 16:49 within 30 minutes via the elongation root, and moonPhase names it', () => {
    const expected = Date.UTC(2026, 8, 26, 16, 49);
    expectInstant(lunarPhaseInstant(expected, 180), expected, 30 * MIN, 'full moon 2026-09-26');
    const full = moonPhase(expected);
    expect(full.phaseKey).toBe('fullMoon');
    expect(full.illumination).toBeGreaterThan(0.98);
    expect(full.waxing).toBe(false);
    expect(full.ageDays).toBeGreaterThan(14);
    expect(full.ageDays).toBeLessThan(17);
    const dark = moonPhase(Date.UTC(2026, 8, 11, 3, 27));
    expect(dark.phaseKey).toBe('newMoon');
    expect(dark.illumination).toBeLessThan(0.02);
    expect(dark.waxing).toBe(true);
    expect(dark.ageDays).toBeLessThan(0.05);
  });

  it('assigns the eight phase names by 45-degree octants centred on the quarters', () => {
    const newMoon = newMoonNear(Date.UTC(2026, 1, 17, 12));
    const days = SYNODIC_SAMPLE;
    const seen = new Set<string>();
    for (const d of days) {
      const p = moonPhase(newMoon + d * MS_PER_DAY);
      seen.add(p.phaseKey);
      expect(p.ageDays).toBeGreaterThanOrEqual(0);
      expect(p.ageDays).toBeLessThan(30);
      expect(p.illumination).toBeGreaterThanOrEqual(0);
      expect(p.illumination).toBeLessThanOrEqual(1);
      expect(p.waxing).toBe(p.phaseAngle < 180);
      const octant = Math.floor(normalizeDeg(p.phaseAngle + 22.5) / 45) % 8;
      expect(p.phaseKey).toBe(MOON_PHASE_KEYS[octant]);
    }
    expect([...seen].sort()).toEqual([...MOON_PHASE_KEYS].sort());
    expect(moonPhase(newMoon + 7.4 * MS_PER_DAY).phaseKey).toBe('firstQuarter');
    expect(moonPhase(newMoon + 14.77 * MS_PER_DAY).phaseKey).toBe('fullMoon');
    expect(moonPhase(newMoon + 22.1 * MS_PER_DAY).phaseKey).toBe('lastQuarter');
  });

  it('newMoonsBetween is ascending, spaced 29.27-29.83 days, 12 or 13 per year; lastNewMoonAtOrBefore never looks ahead', () => {
    for (const year of [2024, 2025, 2026, 2027]) {
      const list = newMoonsBetween(Date.UTC(year, 0, 1), Date.UTC(year + 1, 0, 1) - 1);
      expect(list.length === 12 || list.length === 13, `${year}: ${list.length} new moons`).toBe(true);
      for (let i = 1; i < list.length; i++) {
        const gap = (list[i] - list[i - 1]) / MS_PER_DAY;
        expect(gap).toBeGreaterThan(29.2);
        expect(gap).toBeLessThan(29.9);
      }
      for (const t of list) {
        expect(lastNewMoonAtOrBefore(t)).toBeCloseTo(t, 3);
        expect(lastNewMoonAtOrBefore(t - 1000)).toBeLessThan(t - 1000);
        expect(lastNewMoonAtOrBefore(t + 1000)).toBeCloseTo(t, 3);
      }
    }
    expect(newMoonsBetween(Date.UTC(2026, 1, 20), Date.UTC(2026, 1, 10))).toEqual([]);
    expect(newMoonsBetween(Date.UTC(2026, 1, 1), Date.UTC(2026, 2, 1)).map(iso)).toEqual([iso(newMoonNear(Date.UTC(2026, 1, 17, 12)))]);
  });
});

const SYNODIC_SAMPLE = Array.from({ length: 60 }, (_, i) => i * 0.49);

describe('celestial · horizontal coordinates', () => {
  const SEOUL = { lat: 37.5665, lon: 126.978 };

  it('Sirius from Seoul has a valid altitude and azimuth', () => {
    const { alt, az } = altAz(6.752, -16.72, Date.UTC(2026, 8, 18, 12), SEOUL.lat, SEOUL.lon);
    expect(Math.abs(alt)).toBeLessThanOrEqual(90);
    expect(az).toBeGreaterThanOrEqual(0);
    expect(az).toBeLessThan(360);
  });

  it('the Sun culminates due south near local noon in Seoul and Polaris sits at the latitude', () => {
    // Solar noon in Seoul on 2026-09-18: ~12:26 KST (LMT offset -32 min,
    // equation of time +6 min) = 03:26 UTC. Max altitude 90 - 37.57 + 1.75.
    const noon = Date.UTC(2026, 8, 18, 3, 26);
    const sun = sunPosition(noon);
    const { alt, az } = altAz(sun.ra, sun.dec, noon, SEOUL.lat, SEOUL.lon);
    expect(alt).toBeGreaterThan(52);
    expect(alt).toBeLessThan(55);
    expect(az).toBeGreaterThan(175);
    expect(az).toBeLessThan(185);
    const polaris = altAz(2.53, 89.26, noon, SEOUL.lat, SEOUL.lon);
    expect(Math.abs(polaris.alt - SEOUL.lat)).toBeLessThan(0.8);
    expect(polaris.az < 1.5 || polaris.az > 358.5).toBe(true);
    // Six hours later the Sun is below the horizon, west of south.
    const evening = altAz(sun.ra, sun.dec, noon + 8 * 3_600_000, SEOUL.lat, SEOUL.lon);
    expect(evening.alt).toBeLessThan(0);
    expect(evening.az).toBeGreaterThan(180);
  });

  it('east longitude advances local sidereal time; the same star rises earlier further east', () => {
    const ms = Date.UTC(2026, 8, 18, 12);
    const a = altAz(6.752, -16.72, ms, 37.5665, 126.978);
    const b = altAz(6.752, -16.72, ms, 37.5665, 136.978);
    expect(a.az).not.toBeCloseTo(b.az, 1);
    expect(normalizeDeg((lmstHours(ms, 136.978) - lmstHours(ms, 126.978)) * 15)).toBeCloseTo(10, 9);
  });
});

describe('celestial · zodiac and solar terms', () => {
  it('zodiacOf: 0 -> aries 0/0, 29.99 -> aries 29/59, 30 -> taurus, and the 12 keys tile 360 (SPEC S5)', () => {
    expect(zodiacOf(0)).toEqual({ key: 'aries', deg: 0, min: 0 });
    expect(zodiacOf(29.99)).toEqual({ key: 'aries', deg: 29, min: 59 });
    expect(zodiacOf(30)).toEqual({ key: 'taurus', deg: 0, min: 0 });
    expect(zodiacOf(359.9999)).toEqual({ key: 'pisces', deg: 29, min: 59 });
    expect(zodiacOf(360).key).toBe('aries');
    expect(zodiacOf(-1).key).toBe('pisces');
    expect(zodiacOf(175.5966)).toEqual({ key: 'virgo', deg: 25, min: 35 });
    ZODIAC_KEYS.forEach((key, i) => {
      expect(zodiacOf(i * 30 + 15).key).toBe(key);
    });
    expect(ZODIAC_KEYS).toHaveLength(12);
  });

  it('solarTermOf 2026-09-18T12:00Z is bailu with qiufen next at 2026-09-23T00:05Z (SPEC S5)', () => {
    const ms = Date.UTC(2026, 8, 18, 12);
    const term = solarTermOf(ms);
    expect(term.key).toBe('bailu');
    expect(term.index).toBe(14);
    expect(solarTermLongitude(14)).toBe(165);
    expect(term.nextKey).toBe('qiufen');
    expect(term.lon).toBeGreaterThanOrEqual(165);
    expect(term.lon).toBeLessThan(180);
    expect(term.startMs).toBeLessThanOrEqual(ms);
    expect(term.nextStartMs).toBeGreaterThan(ms);
    expectInstant(term.nextStartMs, Date.UTC(2026, 8, 23, 0, 5), 20 * MIN, 'qiufen 2026');
    expectInstant(term.startMs, Date.UTC(2026, 8, 7, 14, 41), 20 * MIN, 'bailu 2026');
  });

  it('the 24 keys occur in pinyin order over one tropical year starting at lichun', () => {
    expect(SOLAR_TERM_KEYS).toHaveLength(24);
    expect(new Set(SOLAR_TERM_KEYS).size).toBe(24);
    expect(SOLAR_TERM_KEYS[0]).toBe('lichun');
    expect(SOLAR_TERM_KEYS[3]).toBe('chunfen');
    expect(SOLAR_TERM_KEYS[9]).toBe('xiazhi');
    expect(SOLAR_TERM_KEYS[15]).toBe('qiufen');
    expect(SOLAR_TERM_KEYS[21]).toBe('dongzhi');
    expect(solarTermLongitude(0)).toBe(315);
    expect(solarTermLongitude(3)).toBe(0);
    expect(solarTermLongitude(21)).toBe(270);
    const lichun = solarTermInstant(Date.UTC(2026, 1, 4), 315);
    const sequence: string[] = [];
    // 367 daily samples (0.05 .. 366.05): the next lichun falls ~365.24 days on.
    for (let d = 0.05; d < 367; d += 1) {
      const key = solarTermOf(lichun + d * MS_PER_DAY).key;
      if (sequence[sequence.length - 1] !== key) sequence.push(key);
    }
    expect(sequence).toEqual([...SOLAR_TERM_KEYS, 'lichun']);
  });

  it('every term start lies at its longitude and the starts are 14.7-15.8 days apart', () => {
    let prev = solarTermInstant(Date.UTC(2026, 1, 4), 315);
    for (let i = 1; i <= 24; i++) {
      const lon = solarTermLongitude(i % 24);
      const t = solarTermInstant(prev + 15.2 * MS_PER_DAY, lon);
      expect(Math.abs(signedDeg(sunPosition(t).lon - lon))).toBeLessThan(0.0001);
      const gap = (t - prev) / MS_PER_DAY;
      expect(gap).toBeGreaterThan(14.6);
      expect(gap).toBeLessThan(15.9);
      prev = t;
    }
  });
});

describe('celestial · lunisolar calendar', () => {
  const KST = 9;
  const noonKst = (y: number, m: number, d: number): number => Date.UTC(y, m - 1, d, 3);
  const pick = (y: number, m: number, d: number, meridian = KST) => {
    const l = lunarDate(noonKst(y, m, d), meridian);
    return { year: l.year, month: l.month, day: l.day, leap: l.isLeapMonth, animal: l.animalKey };
  };

  it('SPEC S5 vectors are exact on the KST meridian', () => {
    expect(pick(2026, 2, 17)).toEqual({ year: 2026, month: 1, day: 1, leap: false, animal: 'horse' });
    expect(pick(2026, 9, 25)).toEqual({ year: 2026, month: 8, day: 15, leap: false, animal: 'horse' });
    expect(pick(2025, 1, 29)).toEqual({ year: 2025, month: 1, day: 1, leap: false, animal: 'snake' });
    expect(pick(2025, 10, 6)).toEqual({ year: 2025, month: 8, day: 15, leap: false, animal: 'snake' });
    expect(pick(2024, 2, 10)).toEqual({ year: 2024, month: 1, day: 1, leap: false, animal: 'dragon' });
    expect(pick(2024, 9, 17)).toEqual({ year: 2024, month: 8, day: 15, leap: false, animal: 'dragon' });
    // The day before New Year belongs to month 12 of the previous lunar year.
    expect(pick(2026, 2, 16)).toEqual({ year: 2025, month: 12, day: 29, leap: false, animal: 'snake' });
    expect(pick(2026, 1, 15)).toEqual({ year: 2025, month: 11, day: 27, leap: false, animal: 'snake' });
  });

  it('2025 has leap month 6 starting 2025-07-25 and 2023 leap month 2 starting 2023-03-22 (SPEC S5)', () => {
    expect(pick(2025, 7, 24)).toEqual({ year: 2025, month: 6, day: 30, leap: false, animal: 'snake' });
    expect(pick(2025, 7, 25)).toEqual({ year: 2025, month: 6, day: 1, leap: true, animal: 'snake' });
    expect(pick(2023, 3, 21)).toEqual({ year: 2023, month: 2, day: 30, leap: false, animal: 'rabbit' });
    expect(pick(2023, 3, 22)).toEqual({ year: 2023, month: 2, day: 1, leap: true, animal: 'rabbit' });
    // The month after a leap month resumes the count: leap 6 is followed by 7.
    let ms = noonKst(2025, 7, 25);
    let length = 0;
    while (lunarDate(ms, KST).isLeapMonth) {
      length++;
      ms += MS_PER_DAY;
    }
    expect(length === 29 || length === 30).toBe(true);
    const after = lunarDate(ms, KST);
    expect([after.month, after.day, after.isLeapMonth]).toEqual([7, 1, false]);
    // 2024, 2026 and 2027 carry no leap month at all.
    for (const year of [2024, 2026, 2027]) {
      for (let t = Date.UTC(year, 0, 1, 3); t < Date.UTC(year + 1, 0, 1); t += MS_PER_DAY) {
        expect(lunarDate(t, KST).isLeapMonth, `${iso(t)} flagged leap`).toBe(false);
      }
    }
  });

  it('the 2027 New Year splits by meridian: Feb 7 on KST, Feb 6 on CST / ICT (new moon 2027-02-06 15:56 UTC)', () => {
    const nm = newMoonNear(Date.UTC(2027, 1, 6, 12));
    expectInstant(nm, Date.UTC(2027, 1, 6, 15, 56), 1 * MIN, 'new moon 2027-02-06');
    expect(pick(2027, 2, 6, 9)).toEqual({ year: 2026, month: 12, day: 30, leap: false, animal: 'horse' });
    expect(pick(2027, 2, 7, 9)).toEqual({ year: 2027, month: 1, day: 1, leap: false, animal: 'goat' });
    expect(pick(2027, 2, 6, 8)).toEqual({ year: 2027, month: 1, day: 1, leap: false, animal: 'goat' });
    expect(pick(2027, 2, 6, 7)).toEqual({ year: 2027, month: 1, day: 1, leap: false, animal: 'goat' });
  });

  it('months are 29 or 30 days, years 12 or 13 months, days count 1..n and the year advances only at month 1 (2000-2050)', () => {
    let prev = lunarDate(Date.UTC(2000, 0, 1, 3), KST);
    let monthLength = prev.day;
    for (let t = Date.UTC(2000, 0, 2, 3); t < Date.UTC(2051, 0, 1); t += MS_PER_DAY) {
      const cur = lunarDate(t, KST);
      if (cur.month === prev.month && cur.isLeapMonth === prev.isLeapMonth && cur.year === prev.year) {
        expect(cur.day).toBe(prev.day + 1);
        monthLength++;
      } else {
        expect(monthLength === 29 || monthLength === 30, `${iso(t)} month length ${monthLength}`).toBe(true);
        expect(cur.day).toBe(1);
        const expectedNumber = prev.month === 12 ? 1 : prev.month + 1;
        if (cur.isLeapMonth) expect(cur.month).toBe(prev.month);
        else expect(cur.month).toBe(expectedNumber);
        if (cur.month === 1 && !cur.isLeapMonth) expect(cur.year).toBe(prev.year + 1);
        else expect(cur.year).toBe(prev.year);
        monthLength = 1;
      }
      prev = cur;
    }
  });

  it('sexagenary cycle: 2026 bing-wu (horse), 2024 jia-chen (dragon), 2000 geng-chen, 1984 jia-zi (rat)', () => {
    expect(sexagenaryOf(2026)).toEqual({ stemIndex: 2, branchIndex: 6, animalKey: 'horse' });
    expect(sexagenaryOf(2024)).toEqual({ stemIndex: 0, branchIndex: 4, animalKey: 'dragon' });
    expect(sexagenaryOf(2000)).toEqual({ stemIndex: 6, branchIndex: 4, animalKey: 'dragon' });
    expect(sexagenaryOf(1984)).toEqual({ stemIndex: 0, branchIndex: 0, animalKey: 'rat' });
    expect(sexagenaryOf(2027).animalKey).toBe('goat');
    expect(ANIMAL_KEYS).toEqual(['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig']);
    const l = lunarDate(noonKst(2026, 9, 18), KST);
    expect([l.stemIndex, l.branchIndex, l.animalKey]).toEqual([2, 6, 'horse']);
  });

  it('lunarMeridianFor maps ko/ja -> 9, zh -> 8, vi -> 7, everything else -> 8', () => {
    expect(lunarMeridianFor('ko')).toBe(9);
    expect(lunarMeridianFor('ko-KR')).toBe(9);
    expect(lunarMeridianFor('ja')).toBe(9);
    expect(lunarMeridianFor('zh')).toBe(8);
    expect(lunarMeridianFor('zh-TW')).toBe(8);
    expect(lunarMeridianFor('zh_Hans')).toBe(8);
    expect(lunarMeridianFor('vi')).toBe(7);
    for (const other of ['en', 'de', 'fr', 'es', 'pt', 'ru', 'tr', 'th', 'id', 'pl', 'nl', 'tl', 'it', 'et', 'km', 'hi', '']) {
      expect(lunarMeridianFor(other)).toBe(8);
    }
  });

  it('civilDayIndex reckons local midnight on the meridian', () => {
    expect(civilDayIndex(Date.UTC(2026, 1, 17, 14, 59), 9)).toBe(civilDayIndex(Date.UTC(2026, 1, 17, 0), 9));
    expect(civilDayIndex(Date.UTC(2026, 1, 17, 15, 0), 9)).toBe(civilDayIndex(Date.UTC(2026, 1, 17, 0), 9) + 1);
    expect(civilDayIndex(0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ICU cross-check (SPEC 1-A #16). Node's full-ICU calendars are the only
// independent lunisolar reference available offline. Raw parts, probed on
// Node 24.19 / ICU 78.3, for 2025-07-25T03:00Z = leap-6 day 1:
//
//   Intl.DateTimeFormat('ko-KR-u-ca-dangi', { timeZone: 'Asia/Seoul',
//     year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(...)
//   -> [{relatedYear:'2025'}, {literal:'. '}, {month:'윤6'}, {literal:'. '},
//       {day:'1'}, {literal:'.'}]
//   Intl.DateTimeFormat('zh-CN-u-ca-chinese', { timeZone: 'Asia/Shanghai', ... })
//   -> [{relatedYear:'2025'}, {literal:'年'}, {month:'闰六月'}, {day:'1'}]
//   (plain months read 正月 二月 三月 四月 五月 六月 七月 八月 九月 十月
//    十一月 腊月; a leap month is prefixed 闰; 'relatedYear' is the Gregorian
//    year in which the lunar year began -- 2026-01-15 -> relatedYear 2025.)
//
// So the leap flag is "month part starts with 윤 / 闰", the month number is
// the digits (ko) or the numeral (zh) that follows, and the year is
// relatedYear -- the same convention as `lunarDate`.
// ---------------------------------------------------------------------------

interface IcuLunar {
  year: number;
  month: number;
  day: number;
  leap: boolean;
}

const ZH_MONTHS: Record<string, number> = {
  正: 1,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  冬: 11,
  十二: 12,
  腊: 12,
};

function icuFormatter(locale: string, timeZone: string): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });
  } catch {
    return null;
  }
}

function icuLunar(fmt: Intl.DateTimeFormat, ms: number, script: 'ko' | 'zh'): IcuLunar {
  const parts = fmt.formatToParts(new Date(ms));
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  const rawMonth = part('month');
  const leap = rawMonth.startsWith('윤') || rawMonth.startsWith('闰');
  const bare = rawMonth.replace(/^[윤闰]/, '').replace(/月$/, '');
  const month = script === 'ko' ? Number(bare) : (ZH_MONTHS[bare] ?? Number.NaN);
  return { year: Number(part('relatedYear')), month, day: Number(part('day')), leap };
}

/** The probe of SPEC 1-A #16: leap-6 day 1 of 2025 must render with a
 *  month part that contains "6" (ko) / "六" (zh) and the leap prefix. */
function icuSupports(fmt: Intl.DateTimeFormat | null, script: 'ko' | 'zh'): fmt is Intl.DateTimeFormat {
  if (!fmt) return false;
  try {
    const parts = fmt.formatToParts(new Date(Date.UTC(2025, 6, 25, 3)));
    // TypeScript's lib does not list 'relatedYear' among the part types the
    // Intl spec allows, so the comparison goes through String().
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const year = parts.find((p) => String(p.type) === 'relatedYear')?.value ?? '';
    return year === '2025' && (script === 'ko' ? month === '윤6' : month === '闰六月');
  } catch {
    return false;
  }
}

const RANGE_START = Date.UTC(2024, 0, 1, 3); // 12:00 KST
const RANGE_END = Date.UTC(2027, 11, 31, 3);

function crossCheck(fmt: Intl.DateTimeFormat, script: 'ko' | 'zh', meridian: number): string[] {
  const mismatches: string[] = [];
  for (let ms = RANGE_START; ms <= RANGE_END; ms += MS_PER_DAY) {
    const icu = icuLunar(fmt, ms, script);
    const mine = lunarDate(ms, meridian);
    if (icu.year !== mine.year || icu.month !== mine.month || icu.day !== mine.day || icu.leap !== mine.isLeapMonth) {
      mismatches.push(
        `${iso(ms).slice(0, 10)} icu=${icu.year}/${icu.leap ? 'leap' : ''}${icu.month}/${icu.day} engine=${mine.year}/${mine.isLeapMonth ? 'leap' : ''}${mine.month}/${mine.day}`,
      );
    }
  }
  return mismatches;
}

const dangi = icuFormatter('ko-KR-u-ca-dangi', 'Asia/Seoul');
const chinese = icuFormatter('zh-CN-u-ca-chinese', 'Asia/Shanghai');

describe('celestial · ICU cross-check 2024-01-01..2027-12-31', () => {
  it.skipIf(!icuSupports(dangi, 'ko'))('ko-KR-u-ca-dangi (Asia/Seoul) agrees with lunarDate(ms, 9) on every day: 0 mismatches', () => {
    const mismatches = crossCheck(dangi as Intl.DateTimeFormat, 'ko', 9);
    expect(mismatches, `dangi mismatches (${mismatches.length}):\n${mismatches.join('\n')}`).toEqual([]);
  });

  it.skipIf(!icuSupports(chinese, 'zh'))('zh-CN-u-ca-chinese (Asia/Shanghai) agrees with lunarDate(ms, 8) on every day, except the ICU defect it documents', () => {
    // ICU's CalendarAstronomer is a low-precision theory (a few minutes on a
    // new moon). The Feb 2027 new moon falls at 15:56 UTC = 23:56 CST, four
    // minutes before midnight, and ICU places it after midnight: it prints
    // Chinese New Year 2027 on Feb 7 where the official calendar (and Korea's
    // Seollal split from it) has Feb 6. Two INDEPENDENT theories in this
    // engine -- the ch.49 series and the ch.47/ch.25 elongation root -- put
    // the instant at 15:56:0x UTC to within ten seconds of each other, so
    // the engine is not loosened to match: the single ICU-misplaced lunation
    // is allowed only if the engine proves, right here, that the new moon
    // precedes CST midnight by more than a minute and that ICU is exactly
    // one day behind for that month and nowhere else.
    const cst = 8;
    const nm = newMoonNear(Date.UTC(2027, 1, 6, 12));
    const cstMidnight = Date.UTC(2027, 1, 6, 16); // 2027-02-07T00:00 CST
    expect(cstMidnight - nm).toBeGreaterThan(1 * MIN);
    expect(cstMidnight - nm).toBeLessThan(6 * MIN);
    expectInstant(lunarPhaseInstant(nm, 0), nm, 1 * MIN, 'ch.47 root vs ch.49 for 2027-02-06');
    const windowStart = civilDayIndex(nm, cst);
    const windowEnd = civilDayIndex(newMoonNear(nm + 29.53 * MS_PER_DAY), cst); // exclusive
    expect(windowEnd - windowStart).toBe(30);

    const mismatches = crossCheck(chinese as Intl.DateTimeFormat, 'zh', cst);
    const unexplained = mismatches.filter((line) => {
      const day = civilDayIndex(Date.UTC(+line.slice(0, 4), +line.slice(5, 7) - 1, +line.slice(8, 10), 3), cst);
      if (day < windowStart || day >= windowEnd) return true;
      // Inside the window ICU must read exactly one day behind the engine.
      const [, icuPart, enginePart] = line.match(/icu=(\S+) engine=(\S+)/) ?? [];
      const [iy, im, id] = (icuPart ?? '').split('/').map(Number);
      const [ey, em, ed] = (enginePart ?? '').split('/').map(Number);
      const oneBehind = (iy === ey && im === em && id === ed - 1) || (iy === ey - 1 && im === 12 && id === 30 && em === 1 && ed === 1);
      return !oneBehind;
    });
    expect(unexplained, `chinese mismatches outside the documented 2027 lunation (${unexplained.length}):\n${unexplained.join('\n')}`).toEqual([]);
    expect(mismatches.length === 0 || mismatches.length === 30, `expected 0 or the 30-day window, got ${mismatches.length}`).toBe(true);
  });
});

describe('celestial · source scan (SPEC 1-A #14)', () => {
  it('celestial.ts and skyAlmanac.ts contain no Math.random(, Date.now( or new Date()', () => {
    const root = join(process.cwd(), 'lib', 'live');
    for (const file of ['celestial.ts', 'skyAlmanac.ts']) {
      const src = readFileSync(join(root, file), 'utf8');
      expect(src.includes('Math.random('), `${file} rolls a die`).toBe(false);
      expect(src.includes('Date.now('), `${file} reads the clock`).toBe(false);
      expect(src.includes('new Date()'), `${file} reads the clock via the constructor`).toBe(false);
      expect(src.includes('\r\n'), `${file} must stay LF like the rest of lib/live`).toBe(false);
    }
  });
});
