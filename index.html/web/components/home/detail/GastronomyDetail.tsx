'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { foodScienceOf, mealSlotOf, regionName, sunAreaDays, trendingPick } from '@/lib/live/gastronomy';

/**
 * REV-42 D-7 tier 3 (founder directive 2026-09-18, mission 3) -- the
 * gastronomy detail: where today's plate came from, physically. The day's
 * trending pick (the same `trendingPick` the card and the popup show, from
 * the same day index) names its ingredient; `FOOD_SCIENCE` names the
 * photosynthetic pathway and the energy density; and three sections follow
 * in the E2E-pinned order `solar` / `chemistry` / `pairing`
 * (`[data-gastro-section]`, tests/web-cinema-e2e/rev42-shortcuts.spec.js d).
 *
 * Clock discipline: `nowMs` is read once by the host at open time and
 * handed in; the day index derives from it and the local hour from
 * `new Date(nowMs).getHours()` -- the device's civil clock, which is the
 * diner's own (the card, which cannot see a timezone, approximates from
 * longitude; both land in the same meal slot for almost every diner). No
 * clock read in render, no randomness, no network, no buttons:
 * this is a reading surface inside the tier-3 shell (SlotDetailModal),
 * which owns the dialog contract.
 *
 * Numbers are formatted with Intl.NumberFormat(locale) only. The energy
 * line's two assumptions (1 kWh/m²/day, 1 % efficiency) are stated in
 * `energyNote` right under the figure -- an estimate labelled as one.
 */
export interface GastronomyDetailProps {
  locale: string;
  country?: string;
  nowMs: number;
}

const MS_PER_DAY = 86_400_000;

function formatNumber(value: number, locale: string, digits: number): string {
  try {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value);
  } catch {
    return value.toFixed(digits);
  }
}

export function GastronomyDetail({ locale, country, nowMs }: GastronomyDetailProps) {
  const t = useTranslations('Rev42.gastronomy');
  const { pick, slot, science } = useMemo(() => {
    const dayIndex = Math.floor(nowMs / MS_PER_DAY);
    const mealSlot = mealSlotOf(new Date(nowMs).getHours());
    const dish = trendingPick(dayIndex, mealSlot);
    return { pick: dish, slot: mealSlot, science: foodScienceOf(dish.ingredientKey) };
  }, [nowMs]);

  const origin = regionName(locale, pick.originCc);

  return (
    <div className="qw-gastro-detail" data-gastro-detail="" data-gastro-locale={locale} data-gastro-country={country} data-gastro-pick={pick.key}>
      <header className="qw-gastro-head">
        <p className="qw-gastro-eyebrow">{t('facts.trending')}</p>
        <p className="qw-gastro-title">{t(`trending.${pick.key}.name`)}</p>
        {science && (
          <p className="qw-gastro-sub">
            <span className="qw-gastro-ingredient" data-gastro-ingredient={science.key}>
              {t(`science.${science.key}.ingredient`)}
            </span>
            <span className="qw-gastro-sub-sep" aria-hidden="true">
              ·
            </span>
            <span>{origin}</span>
          </p>
        )}
        <ul className="qw-gastro-chips" aria-label={t('facts.trending')}>
          {science && (
            <li className="qw-gastro-chip" data-kind="pathway" data-gastro-pathway={science.pathway}>
              {t(`pathway.${science.pathway}`)}
            </li>
          )}
          <li className="qw-gastro-chip" data-kind="slot">
            {t(`mealSlots.${slot}`)}
          </li>
          <li className="qw-gastro-chip" data-kind="flavor">
            {t(`flavors.${pick.flavorKey}`)}
          </li>
        </ul>
        <p className="qw-gastro-why">{t(`trending.${pick.key}.why`)}</p>
      </header>

      <section className="qw-gastro-section" data-gastro-section="solar">
        <h3 className="qw-gastro-section-title">{t('sections3.solar')}</h3>
        {science && (
          <>
            <p className="qw-gastro-body">{t(`science.${science.key}.solar`)}</p>
            <div className="qw-gastro-energy" data-gastro-energy="" data-gastro-kcal={science.kcalPer100g}>
              <p className="qw-gastro-energy-line">
                {t('energyLine', {
                  kcal: formatNumber(science.kcalPer100g, locale, 0),
                  area: formatNumber(sunAreaDays(science.kcalPer100g), locale, 1),
                })}
              </p>
              <p className="qw-gastro-energy-note">{t('energyNote')}</p>
            </div>
          </>
        )}
      </section>

      <section className="qw-gastro-section" data-gastro-section="chemistry">
        <h3 className="qw-gastro-section-title">{t('sections3.chemistry')}</h3>
        {science && <p className="qw-gastro-body">{t(`science.${science.key}.chemistry`)}</p>}
      </section>

      <section className="qw-gastro-section" data-gastro-section="pairing">
        <h3 className="qw-gastro-section-title">{t('sections3.pairing')}</h3>
        {science && <p className="qw-gastro-body">{t(`science.${science.key}.pairing`)}</p>}
      </section>
    </div>
  );
}
