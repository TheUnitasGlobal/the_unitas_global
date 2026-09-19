'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  BODY_ELEMENTS,
  SCALE_LADDER,
  epochOf,
  formatScale,
  latitudeGravity,
  lightLeft,
  objectOfDay,
  rotationSpeedMs,
} from '@/lib/live/cosmos';
import { SkyDetail } from './SkyDetail';
import type { SlotDetailPlace } from './SlotDetailModal';

/**
 * REV-42 D-6 (founder directive 2026-09-18, mission 2, tier 3) -- the
 * macro-cosmos detail view: shortcut 1's precise sky view MIRRORED
 * (`<SkyDetail host="cosmos" />`, the same component on the same place
 * and instant), then four synthesised sections:
 *  trajectory -- when the light of today's object set out and which epoch
 *                of Earth's history that was (lib/live/cosmos.ts lightLeft
 *                / epochOf; light-years are years of travel by definition);
 *  lineage    -- where the atoms of a human body were made (BODY_ELEMENTS:
 *                the conventional body-mass table and the accepted
 *                nucleosynthesis attributions);
 *  relativity -- gravity and rotation at the visitor's own latitude (WGS84
 *                gravity formula, 465.1 × cos φ), the GPS clock offset, the
 *                surface time dilation and the light-travel times to the
 *                Moon and the Sun (physical constants);
 *  scale      -- the eleven-rung supercluster ladder (SCALE_LADDER).
 *
 * Everything derives from `nowMs` (read once by the host at open time,
 * never a clock read in render) and `place`; with no place the relativity
 * section shows its skeleton rather than a guessed latitude. No control
 * lives here (the tier-3 shell owns close), so there is nothing to focus.
 *
 * E2E contract (rev42-shortcuts): `[data-cosmos-detail]` wrapping one
 * `[data-sky-detail][data-sky-host=cosmos]` and `[data-cosmos-section]` ×4
 * in DOM order trajectory, lineage, relativity, scale; no `[data-meta-line]`
 * in tier 3 (1-A #4).
 */
export interface CosmosDetailProps {
  place: SlotDetailPlace | null;
  nowMs: number;
}

/** Physical constants quoted in the relativity section (not measured
 *  here, so they are rendered as plain strings, never localised numbers). */
const GPS_OFFSET_US_PER_DAY = 38.6;
const SURFACE_DILATION = '7×10⁻¹⁰';
const LIGHT_MOON_S = 1.28;
const LIGHT_SUN = { min: 8, s: 19 };

function safeNumberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(locale, options);
  } catch {
    return new Intl.NumberFormat('en', options);
  }
}

export function CosmosDetail({ place, nowMs }: CosmosDetailProps) {
  const t = useTranslations('Rev42.cosmos');
  const tDetail = useTranslations('Rev42.detail');
  const locale = useLocale();

  const whole = useMemo(() => safeNumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const pct = useMemo(() => safeNumberFormat(locale, { maximumFractionDigits: 5 }), [locale]);
  const two = useMemo(() => safeNumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [locale]);
  const four = useMemo(() => safeNumberFormat(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 }), [locale]);

  // The object of the UTC day -- the same pick the card made (1-A #14).
  const featured = objectOfDay(Math.floor(nowMs / 86_400_000));
  const nowYear = new Date(nowMs).getUTCFullYear();
  const years = Math.round(featured.distanceLy);
  const departure = lightLeft(featured.distanceLy, nowYear);
  const featuredName = t(`objects.${featured.key}.name`);
  const trajectoryLine = t('trajectory.line', { object: featuredName, years: whole.format(years), epoch: t(`epochs.${epochOf(years)}`) });
  const lightLeftLine =
    departure.mode === 'ago' ? t('lightLeft.ago', { n: whole.format(departure.n) }) : t(`lightLeft.${departure.mode}`, { year: whole.format(departure.n) });

  const lat = place?.lat ?? null;
  const gravity = lat === null ? null : latitudeGravity(lat);
  const rotation = lat === null ? null : rotationSpeedMs(lat);

  const relativityRows: Array<{ key: 'gps' | 'dilation' | 'lightMoon' | 'lightSun'; value: string }> = [
    { key: 'gps', value: t('relativity.gpsValue', { us: `+${two.format(GPS_OFFSET_US_PER_DAY)}` }) },
    { key: 'dilation', value: SURFACE_DILATION },
    { key: 'lightMoon', value: `${two.format(LIGHT_MOON_S)} s` },
    { key: 'lightSun', value: t('relativity.lightSunValue', { min: String(LIGHT_SUN.min), s: String(LIGHT_SUN.s) }) },
  ];

  return (
    <div className="qw-cosmos-detail" data-cosmos-detail="">
      <SkyDetail place={place} nowMs={nowMs} host="cosmos" />
      <p className="qw-cosmos-mirror" data-cosmos-mirror="">
        {tDetail('mirrorNote')}
      </p>

      <section className="qw-cosmos-section" data-cosmos-section="trajectory">
        <h3 className="qw-cosmos-section-title">{t('sections.trajectory')}</h3>
        <p className="qw-cosmos-lead" data-cosmos-trajectory={featured.key}>
          {trajectoryLine}
        </p>
        <p className="qw-cosmos-departure" data-light-left={departure.mode}>
          <span className="qw-cosmos-label">{t('facts.lightLeft')}</span>
          <span className="qw-cosmos-value">{lightLeftLine}</span>
        </p>
        <p className="qw-cosmos-note">{t(`objects.${featured.key}.note`)}</p>
      </section>

      <section className="qw-cosmos-section" data-cosmos-section="lineage">
        <h3 className="qw-cosmos-section-title">{t('sections.lineage')}</h3>
        <p className="qw-cosmos-lead">{t('lineage.bodyIntro')}</p>
        <p className="qw-cosmos-note">{t('lineage.intro')}</p>
        <table className="qw-cosmos-lineage" data-cosmos-lineage="">
          <tbody>
            {BODY_ELEMENTS.map((el) => (
              <tr key={el.key} className="qw-cosmos-lineage-row" data-element={el.key} data-origin={el.originKey}>
                <th scope="row" className="qw-cosmos-lineage-element">
                  {t(`lineage.elements.${el.key}`)}
                </th>
                <td className="qw-cosmos-lineage-share">{t('lineage.bodyShare', { pct: pct.format(el.bodyPct) })}</td>
                <td className="qw-cosmos-lineage-origin">{t(`lineage.origins.${el.originKey}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="qw-cosmos-section" data-cosmos-section="relativity" data-cosmos-place={place ? '1' : '0'}>
        <h3 className="qw-cosmos-section-title">{t('sections.relativity')}</h3>
        {gravity !== null && rotation !== null && lat !== null ? (
          <div className="qw-cosmos-local" data-cosmos-local="">
            <p className="qw-cosmos-lead" data-cosmos-gravity={gravity.toFixed(4)}>
              {t('relativity.gLine', { lat: two.format(lat), g: four.format(gravity) })}
            </p>
            <p className="qw-cosmos-lead" data-cosmos-rotation={rotation.toFixed(0)}>
              {t('relativity.rotLine', { v: whole.format(rotation) })}
            </p>
          </div>
        ) : (
          <div className="qw-cosmos-local qw-cosmos-skeleton" data-cosmos-local="skeleton" aria-hidden="true">
            <span className="qw-cosmos-skeleton-line" />
            <span className="qw-cosmos-skeleton-line" />
          </div>
        )}
        <dl className="qw-cosmos-rows" data-cosmos-relativity="">
          {relativityRows.map((row) => (
            <div key={row.key} className="qw-cosmos-row" data-relativity={row.key}>
              <dt className="qw-cosmos-label">{t(`relativity.${row.key}`)}</dt>
              <dd className="qw-cosmos-value">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="qw-cosmos-section" data-cosmos-section="scale">
        <h3 className="qw-cosmos-section-title">{t('sections.scale')}</h3>
        <ol className="qw-cosmos-ladder" data-cosmos-ladder="">
          {SCALE_LADDER.map((rung, i) => (
            <li key={rung.key} className="qw-cosmos-rung" data-rung={rung.key}>
              <span className="qw-cosmos-rung-index">{whole.format(i + 1)}</span>
              <span className="qw-cosmos-rung-name">{t(`scale.${rung.key}`)}</span>
              <span className="qw-cosmos-rung-size">{formatScale(rung, locale)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
