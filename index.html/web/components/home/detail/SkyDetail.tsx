'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatHms, solarTermLongitude } from '@/lib/live/celestial';
import { SOLAR_TERM_KEYS, ZODIAC_KEYS, countdownParts, skySnapshot, type SkySnapshot, type ZodiacKey } from '@/lib/live/skyAlmanac';
import {
  compassPoint16,
  formatAu,
  formatCoord,
  formatDeg,
  formatDistanceKm,
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
import type { SlotDetailPlace } from './SlotDetailModal';

/**
 * REV-42 D-5 / mission 1 tier 3 (founder directive 2026-09-18) -- the
 * precision sky view: sidereal time, the 24 solar terms, the Sun and the
 * Moon in ecliptic / equatorial / horizontal coordinates with their zodiac
 * positions, and the zodiac ring. The weather flagship opens it as
 * `host="weather"`; the cosmos flagship MIRRORS it (D-6, `host="cosmos"`)
 * -- the same component over the same data, so the two tiers can never
 * disagree by a single arcminute.
 *
 * The clock. `now` is React state seeded from the host's `nowMs` (read once
 * at open time, never `Date.now()` in render) and advanced by ONE
 * `setInterval` every second -- skipped while the tab is hidden, cleared
 * on unmount. Each tick recomputes `skySnapshot` (lib/live/skyAlmanac.ts,
 * about a millisecond) and the local sidereal time `[data-sky-lst]` is
 * seen ticking (rev42-shortcuts (b): the text changes within 2.5 s).
 *
 * The rings are plain SVG (no blur, no filter): the 24-term ring
 * `[data-sky-terms]` with the Sun at its longitude and the term in force in
 * the slot accent, the 12-sign ring `[data-sky-zodiac]` with Sun and Moon
 * markers. Longitude 0° (the vernal point) sits at the right and grows
 * counter-clockwise, as on a star chart.
 *
 * Four-state truth (REV-40): `data-sky-state="loading"` while the host has
 * no observer yet (a skeleton, no numbers), `"data"` otherwise. There is
 * nothing to fabricate here -- the engine is pure arithmetic -- so no
 * `empty` / `unreadable` branch exists. No buttons, no links, no meta line
 * (1-A #4): this is a reading, not a route.
 */
export type SkyDetailHost = 'weather' | 'cosmos';

export interface SkyDetailProps {
  place: SlotDetailPlace | null;
  nowMs: number;
  host: SkyDetailHost;
}

/** Ring geometry shared by both SVGs (viewBox 0 0 200 200). */
const RING = { cx: 100, cy: 100, outer: 84, inner: 66, marker: 75, size: 200 } as const;

/** A tick every second; the sidereal second is what the visitor watches. */
const TICK_MS = 1000;

interface SkyModel {
  snap: SkySnapshot;
  tzOffsetMinutes: number;
}

export function SkyDetail({ place, nowMs, host }: SkyDetailProps) {
  const t = useTranslations('Rev42.sky');
  const locale = useLocale();

  // The ONE clock (see the header): state, seeded from the host's instant.
  const [now, setNow] = useState(() => nowMs);
  useEffect(() => {
    setNow(nowMs);
  }, [nowMs]);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setNow(Date.now());
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const lat = place?.lat;
  const lon = place?.lon;
  const model = useMemo<SkyModel | null>(() => {
    if (lat === undefined || lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      snap: skySnapshot(now, lat, lon, locale),
      // The visitor's own civil offset at THIS instant (DST-aware); a Date
      // built from a number is not a clock read.
      tzOffsetMinutes: -new Date(now).getTimezoneOffset(),
    };
  }, [now, lat, lon, locale]);

  return (
    <div className="qw-sky" data-sky-detail="" data-sky-host={host} data-sky-state={model ? 'data' : 'loading'}>
      <div className="qw-sky-head">
        <span className="qw-sky-live" data-sky-live="">
          <span className="qw-sky-live-dot" aria-hidden="true" />
          {t('live')}
        </span>
        {model && <span className="qw-sky-offset">{t('utcOffset', { offset: formatUtcOffset(model.tzOffsetMinutes) })}</span>}
      </div>

      {model && place ? (
        <SkyBody model={model} place={place} t={t} locale={locale} />
      ) : (
        <div className="qw-sky-skeleton" aria-hidden="true">
          <span className="qw-sky-skeleton-tile qw-sky-skeleton-hero" />
          <span className="qw-sky-skeleton-tile" />
          <span className="qw-sky-skeleton-tile" />
          <span className="qw-sky-skeleton-tile" />
        </div>
      )}
    </div>
  );
}

/** The Rev42.sky translator, narrowed to the call shape the body uses. */
type SkyT = (key: string, values?: Record<string, string | number>) => string;

function SkyBody({ model, place, t, locale }: { model: SkyModel; place: SlotDetailPlace; t: SkyT; locale: string }) {
  const { snap } = model;
  const { sun, moon, term, lunar } = snap;
  const termIn = countdownParts(snap.nowMs, term.nextStartMs);
  const sunSign = t(`zodiac.${sun.zodiac.key}`);
  const moonSign = t(`zodiac.${moon.zodiac.key}`);
  const lunarLine = t(lunar.isLeapMonth ? 'lunarLeapLine' : 'lunarLine', { month: lunar.month, day: lunar.day });
  const animalYear = t('animalYear', { animal: t(`animals.${lunar.animalKey}`) });

  return (
    <>
      {/* 1. Sidereal time -- the hero is the ticking LST. */}
      <section className="qw-sky-section" data-sky-section="sidereal">
        <h3 className="qw-sky-section-title">{t('sectionSidereal')}</h3>
        <div className="qw-sky-grid">
          <Tile label={t('lst')} value={formatHms(snap.lmstHours)} hero valueAttrs={{ 'data-sky-lst': '' }} />
          <Tile label={t('gmst')} value={formatHms(snap.gmstHours)} valueAttrs={{ 'data-sky-gmst': '' }} />
          <Tile label={t('jd')} value={formatJd(snap.jd, locale)} valueAttrs={{ 'data-sky-jd': '' }} />
        </div>
        <p className="qw-sky-observer" data-sky-observer="">
          <span className="qw-sky-label">{t('observer')}</span>
          <span className="qw-sky-observer-line">
            {t('observerLine', { name: place.name, lat: formatCoord(place.lat, locale), lon: formatCoord(place.lon, locale) })}
          </span>
        </p>
      </section>

      {/* 2. The 24 solar terms -- ring + the term in force / the next one. */}
      <section className="qw-sky-section" data-sky-section="terms">
        <h3 className="qw-sky-section-title">{t('sectionTerms')}</h3>
        <div className="qw-sky-ring-row">
          <TermsRing sunLon={sun.lon} activeIndex={term.index} aria={t('ringAria')} />
          <div className="qw-sky-ring-facts">
            <div className="qw-sky-term qw-sky-term-now" data-sky-term={term.key}>
              <span className="qw-sky-label">{t('termNow')}</span>
              <span className="qw-sky-value qw-sky-term-name">{t(`terms.${term.key}`)}</span>
              <span className="qw-sky-sub">
                {formatDeg(solarTermLongitude(term.index), locale, 0)} · {formatInstant(term.startMs, locale)}
              </span>
            </div>
            <div className="qw-sky-term" data-sky-term-next={term.nextKey}>
              <span className="qw-sky-label">{t('termNext')}</span>
              <span className="qw-sky-value qw-sky-term-name">{t(`terms.${term.nextKey}`)}</span>
              <span className="qw-sky-sub">
                {t('termIn', termIn)} · {formatInstant(term.nextStartMs, locale)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Sun. */}
      <section className="qw-sky-section" data-sky-section="sun">
        <h3 className="qw-sky-section-title">{t('sectionSun')}</h3>
        <div className="qw-sky-grid">
          <Tile
            label={t('sun')}
            value={t('zodiacPos', { sign: sunSign, deg: sun.zodiac.deg, min: sun.zodiac.min })}
            hero
            valueAttrs={{ 'data-sky-sun-sign': sun.zodiac.key }}
          />
          <Tile label={t('eclipticLon')} value={formatDeg(sun.lon, locale)} />
          <Tile label={t('ra')} value={formatRaHm(sun.ra)} />
          <Tile label={t('dec')} value={formatSignedDeg(sun.dec, locale)} />
          <Tile label={t('altitude')} value={formatSignedDeg(sun.alt, locale)} sub={t(sun.alt > 0 ? 'aboveHorizon' : 'belowHorizon')} tone={sun.alt > 0 ? 'up' : 'down'} />
          <Tile label={t('azimuth')} value={formatDeg(sun.az, locale, 1)} sub={compassPoint16(sun.az)} />
          <Tile label={t('distance')} value={formatAu(sun.distAu, locale)} />
        </div>
      </section>

      {/* 4. The Moon -- the same reading plus latitude, phase and the lunar date. */}
      <section className="qw-sky-section" data-sky-section="moon">
        <h3 className="qw-sky-section-title">{t('sectionMoon')}</h3>
        <div className="qw-sky-grid">
          <Tile
            label={t('moon')}
            value={t('zodiacPos', { sign: moonSign, deg: moon.zodiac.deg, min: moon.zodiac.min })}
            hero
            valueAttrs={{ 'data-sky-moon-sign': moon.zodiac.key }}
          />
          <Tile label={t('eclipticLon')} value={formatDeg(moon.lon, locale)} />
          <Tile label={t('eclipticLat')} value={formatSignedDeg(moon.lat, locale)} />
          <Tile label={t('ra')} value={formatRaHm(moon.ra)} />
          <Tile label={t('dec')} value={formatSignedDeg(moon.dec, locale)} />
          <Tile label={t('altitude')} value={formatSignedDeg(moon.alt, locale)} sub={t(moon.alt > 0 ? 'aboveHorizon' : 'belowHorizon')} tone={moon.alt > 0 ? 'up' : 'down'} />
          <Tile label={t('azimuth')} value={formatDeg(moon.az, locale, 1)} sub={compassPoint16(moon.az)} />
          <Tile label={t('distance')} value={formatDistanceKm(moon.distKm, locale)} />
          <Tile
            label={t(`phases.${moon.phase.phaseKey}`)}
            value={t('illumination', { pct: formatIlluminationPct(moon.phase.illumination, locale) })}
            sub={t('moonAge', { age: formatMoonAge(moon.phase.ageDays, locale) })}
            valueAttrs={{ 'data-sky-phase': moon.phase.phaseKey }}
          />
          <Tile label={t('lunarLabel')} value={lunarLine} sub={animalYear} valueAttrs={{ 'data-sky-lunar': `${lunar.month}-${lunar.day}` }} />
        </div>
      </section>

      {/* 5. The zodiac -- ring with both bodies, legend of the twelve signs. */}
      <section className="qw-sky-section" data-sky-section="zodiac">
        <h3 className="qw-sky-section-title">{t('sectionZodiac')}</h3>
        <div className="qw-sky-ring-row">
          <ZodiacRing sunLon={sun.lon} moonLon={moon.lon} sunKey={sun.zodiac.key} moonKey={moon.zodiac.key} aria={t('ringAria')} />
          <ol className="qw-sky-signs">
            {ZODIAC_KEYS.map((key, i) => {
              const isSun = key === sun.zodiac.key;
              const isMoon = key === moon.zodiac.key;
              return (
                <li key={key} className="qw-sky-sign" data-sky-sign={key} data-sun={isSun ? '1' : '0'} data-moon={isMoon ? '1' : '0'}>
                  <span className="qw-sky-sign-index">{i + 1}</span>
                  <span className="qw-sky-sign-name">{t(`zodiac.${key}`)}</span>
                  {isSun && <span className="qw-sky-sign-mark qw-sky-sign-mark-sun">{t('sun')}</span>}
                  {isMoon && <span className="qw-sky-sign-mark qw-sky-sign-mark-moon">{t('moon')}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </>
  );
}

/** One reading: an uppercase label over a tabular value, an optional
 *  sub-line (compass point, horizon state, moon age). */
function Tile({
  label,
  value,
  sub,
  hero = false,
  tone,
  valueAttrs,
}: {
  label: string;
  value: string;
  sub?: string;
  hero?: boolean;
  tone?: 'up' | 'down';
  valueAttrs?: Record<string, string>;
}) {
  return (
    <div className={`qw-sky-tile${hero ? ' qw-sky-tile-hero' : ''}`} data-tone={tone}>
      <span className="qw-sky-label">{label}</span>
      <span className={`qw-sky-value${hero ? ' qw-sky-value-hero' : ''}`} {...valueAttrs}>
        {value}
      </span>
      {sub && <span className="qw-sky-sub">{sub}</span>}
    </div>
  );
}

/** The 24-term ring: each 15° segment from lichun (315°), the term in
 *  force in the accent, the four cardinal ticks (equinoxes / solstices)
 *  and the Sun at its apparent longitude. */
function TermsRing({ sunLon, activeIndex, aria }: { sunLon: number; activeIndex: number; aria: string }) {
  const sunAt = ringPoint(sunLon, RING.cx, RING.cy, RING.marker);
  return (
    <svg className="qw-sky-ring" viewBox={`0 0 ${RING.size} ${RING.size}`} role="img" aria-label={aria} data-sky-terms="" data-sky-term-index={activeIndex}>
      {SOLAR_TERM_KEYS.map((key, i) => {
        const from = solarTermLongitude(i);
        return (
          <path
            key={key}
            className="qw-sky-ring-seg"
            data-term={key}
            data-active={i === activeIndex ? '1' : '0'}
            d={ringSegmentPath(from, from + 15, RING.cx, RING.cy, RING.inner, RING.outer)}
          />
        );
      })}
      {[0, 90, 180, 270].map((deg) => {
        const a = ringPoint(deg, RING.cx, RING.cy, RING.inner - 6);
        const b = ringPoint(deg, RING.cx, RING.cy, RING.outer + 6);
        return <line key={deg} className="qw-sky-ring-tick" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      <circle className="qw-sky-ring-sun" cx={sunAt.x} cy={sunAt.y} r={5} data-sky-ring-sun="" />
    </svg>
  );
}

/** The 12-sign ring: 30° segments from aries (0°), the segments holding
 *  the Sun / Moon marked, both bodies at their longitudes, the sign index
 *  at each segment's middle (the legend beside it names them). */
function ZodiacRing({ sunLon, moonLon, sunKey, moonKey, aria }: { sunLon: number; moonLon: number; sunKey: ZodiacKey; moonKey: ZodiacKey; aria: string }) {
  const sunAt = ringPoint(sunLon, RING.cx, RING.cy, RING.marker);
  const moonAt = ringPoint(moonLon, RING.cx, RING.cy, RING.marker);
  return (
    <svg className="qw-sky-ring" viewBox={`0 0 ${RING.size} ${RING.size}`} role="img" aria-label={aria} data-sky-zodiac="" data-sky-sun-sign={sunKey} data-sky-moon-sign={moonKey}>
      {ZODIAC_KEYS.map((key, i) => {
        const from = i * 30;
        const mid = ringPoint(from + 15, RING.cx, RING.cy, RING.inner - 12);
        return (
          <g key={key} data-sign={key} data-sun={key === sunKey ? '1' : '0'} data-moon={key === moonKey ? '1' : '0'}>
            <path className="qw-sky-ring-seg" d={ringSegmentPath(from, from + 30, RING.cx, RING.cy, RING.inner, RING.outer)} />
            <text className="qw-sky-ring-index" x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central">
              {i + 1}
            </text>
          </g>
        );
      })}
      <circle className="qw-sky-ring-moon" cx={moonAt.x} cy={moonAt.y} r={4.5} data-sky-ring-moon="" />
      <circle className="qw-sky-ring-sun" cx={sunAt.x} cy={sunAt.y} r={5} data-sky-ring-sun="" />
    </svg>
  );
}
