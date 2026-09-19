'use client';

import type { CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cosmosObjectByKey, formatLightYears, type CosmosScopeWidget } from '@/lib/live/cosmos';
import { windDirLabel } from '@/lib/live/weatherDeep';
import type { SlotWidgetVariant } from './SlotWidgetView';

/**
 * REV-42 D-6 (founder directive 2026-09-18, mission 2) -- the cosmos
 * card's sky dome: the visitor's whole sky as one polar projection, the
 * zenith at the centre, the horizon as the outer ring, azimuth clockwise
 * from north at the top. Today's object (the slot accent, larger), the
 * Sun, the Moon and the galactic centre sit where they are right now; the
 * other 23 catalogue objects are 2.5-unit dots; anything below the horizon
 * is a small hollow dashed marker just outside the ring at its bearing,
 * so a visitor still reads WHERE it would rise.
 *
 * Pure SVG from one `CosmosScopeWidget` the adapter built (lib/live/cosmos
 * .ts cosmosTelemetry): no fetch, no clock read, no random source,
 * no animation, no blur, and -- on the card variant -- no button, link or
 * role (1-A #7). Names come from `Rev42.cosmos.objects.<key>.name`;
 * numbers go through Intl.NumberFormat(locale).
 *
 * The 4-state contract (SPEC D-8), on the root as `data-state`:
 *  loading    -- no widget yet and the host is loading: the dashed rings,
 *                no marker, the computing line;
 *  data       -- a widget: the dome as computed;
 *  unreadable -- no widget once the host has settled: the dimmed rings and
 *                the honest line (`Rev42.cosmos.scopeState.unreadable`).
 * (A computed sky is never "empty": the catalogue is bundled.)
 *
 * E2E contract (rev42-shortcuts): `[data-cosmos-scope][data-state]
 * [data-variant][data-featured][data-visible=1|0]`; the featured marker
 * carries `[data-scope-featured]`.
 */
export interface CosmosScopeProps {
  widget?: CosmosScopeWidget;
  variant: SlotWidgetVariant;
  loading: boolean;
  /** The slot's accent -- the featured object's marker (`--qw-hub-accent`). */
  accent: string;
}

export type CosmosScopeState = 'loading' | 'data' | 'unreadable';

/** The SVG stage: a 200-unit square, the horizon ring at 84 so the
 *  below-horizon markers (ring + 6, radius 2.5) and the compass letters
 *  stay inside the box. */
const VIEW = 200;
const CENTRE = VIEW / 2;
const HORIZON_R = 84;
const BELOW_R = HORIZON_R + 6;
const ALT_RINGS = [0, 30, 60] as const;
const COMPASS: ReadonlyArray<{ label: 'N' | 'E' | 'S' | 'W'; az: number }> = [
  { label: 'N', az: 0 },
  { label: 'E', az: 90 },
  { label: 'S', az: 180 },
  { label: 'W', az: 270 },
];
const DOT_R = 2.5;
const BODY_R: Record<SlotWidgetVariant, number> = { card: 4, deep: 4.5 };
const FEATURED_R: Record<SlotWidgetVariant, number> = { card: 5.5, deep: 6.5 };

export function cosmosScopeState(widget: CosmosScopeWidget | undefined, loading: boolean): CosmosScopeState {
  if (widget) return 'data';
  return loading ? 'loading' : 'unreadable';
}

/** Polar projection of a horizontal position: r = (90 − alt) / 90 × R for
 *  alt ≥ 0 (zenith at the centre, horizon on the ring); a body below the
 *  horizon sits at BELOW_R on its azimuth. SVG y grows downwards, so
 *  north (az 0) is −y and east (az 90) is +x. */
export function domePoint(alt: number, az: number): { x: number; y: number; below: boolean } {
  const below = !(alt > 0);
  const clampedAlt = Math.min(90, Math.max(0, Number.isFinite(alt) ? alt : 0));
  const r = below ? BELOW_R : ((90 - clampedAlt) / 90) * HORIZON_R;
  const rad = ((Number.isFinite(az) ? az : 0) * Math.PI) / 180;
  return { x: CENTRE + r * Math.sin(rad), y: CENTRE - r * Math.cos(rad), below };
}

function ringRadius(alt: number): number {
  return ((90 - alt) / 90) * HORIZON_R;
}

interface MarkerProps {
  alt: number;
  az: number;
  r: number;
  className: string;
  title: string;
  featured?: boolean;
}

/** One body: a filled disc above the horizon, a hollow dashed ring at the
 *  rim below it. The <title> is the hover / assistive name only -- no
 *  role, no handler (1-A #7). */
function Marker({ alt, az, r, className, title, featured }: MarkerProps) {
  const p = domePoint(alt, az);
  return (
    <circle
      className={className}
      data-below={p.below ? '1' : undefined}
      {...(featured ? { 'data-scope-featured': '' } : null)}
      cx={p.x.toFixed(2)}
      cy={p.y.toFixed(2)}
      r={p.below ? DOT_R : r}
    >
      <title>{title}</title>
    </circle>
  );
}

export function CosmosScope({ widget, variant, loading, accent }: CosmosScopeProps) {
  const t = useTranslations('Rev42');
  const locale = useLocale();
  const state = cosmosScopeState(widget, loading);
  const featured = widget?.objects.find((o) => o.key === widget.featuredKey);
  const featuredObject = widget ? cosmosObjectByKey(widget.featuredKey) : undefined;
  const featuredName = widget ? t(`cosmos.objects.${widget.featuredKey}.name`) : '';
  const others = widget ? widget.objects.filter((o) => o.key !== widget.featuredKey) : [];

  const sunLabel = t('sky.sun');
  const moonLabel = t('sky.moon');
  const centreLabel = t('cosmos.facts.galacticCenter');
  const featuredLabel = t('cosmos.facts.objectOfDay');

  const caption =
    widget && featured
      ? t('cosmos.rowMeta', {
          alt: featured.alt.toFixed(0),
          az: windDirLabel(featured.az),
          dist: t('cosmos.lightYears', { n: formatLightYears(featuredObject?.distanceLy ?? 0, locale) }),
        })
      : null;

  return (
    <div
      className="qw-cosmos-scope"
      data-cosmos-scope=""
      data-state={state}
      data-variant={variant}
      data-featured={widget?.featuredKey}
      data-visible={featured ? (featured.visible ? '1' : '0') : undefined}
      aria-label={t('cosmos.scopeAria')}
      style={{ '--qw-hub-accent': accent } as CSSProperties}
    >
      <div className="qw-cosmos-dome" data-variant={variant}>
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} role="img" aria-label={t('cosmos.scopeAria')} aria-busy={state === 'loading' ? true : undefined} focusable="false">
          <g className="qw-cosmos-rings">
            {ALT_RINGS.map((alt) => (
              <circle key={alt} className="qw-cosmos-ring" data-alt={alt} cx={CENTRE} cy={CENTRE} r={ringRadius(alt).toFixed(2)} />
            ))}
          </g>
          <g className="qw-cosmos-axes">
            <line x1={CENTRE} y1={CENTRE - HORIZON_R} x2={CENTRE} y2={CENTRE + HORIZON_R} />
            <line x1={CENTRE - HORIZON_R} y1={CENTRE} x2={CENTRE + HORIZON_R} y2={CENTRE} />
          </g>
          <g className="qw-cosmos-compass" aria-hidden="true">
            {COMPASS.map(({ label, az }) => {
              const rad = (az * Math.PI) / 180;
              const rr = HORIZON_R + 11;
              return (
                <text key={label} x={(CENTRE + rr * Math.sin(rad)).toFixed(2)} y={(CENTRE - rr * Math.cos(rad)).toFixed(2)} textAnchor="middle" dominantBaseline="central">
                  {label}
                </text>
              );
            })}
          </g>
          <circle className="qw-cosmos-zenith" cx={CENTRE} cy={CENTRE} r={1.2} />
          {widget && (
            <g className="qw-cosmos-bodies">
              {others.map((o) => (
                <Marker key={o.key} alt={o.alt} az={o.az} r={DOT_R} className="qw-cosmos-dot" title={t(`cosmos.objects.${o.key}.name`)} />
              ))}
              <Marker alt={widget.galacticCenter.alt} az={widget.galacticCenter.az} r={BODY_R[variant]} className="qw-cosmos-centre" title={centreLabel} />
              <Marker alt={widget.moon.alt} az={widget.moon.az} r={BODY_R[variant]} className="qw-cosmos-moon" title={moonLabel} />
              <Marker alt={widget.sun.alt} az={widget.sun.az} r={BODY_R[variant]} className="qw-cosmos-sun" title={sunLabel} />
              {featured && (
                <Marker alt={featured.alt} az={featured.az} r={FEATURED_R[variant]} className="qw-cosmos-featured" title={featuredName} featured />
              )}
            </g>
          )}
        </svg>
      </div>

      <div className="qw-cosmos-side">
        {widget && featured && (
          <p className="qw-cosmos-caption" data-cosmos-caption="">
            <span className="qw-cosmos-caption-name">{featuredName}</span>
            <span className="qw-cosmos-caption-meta">{caption}</span>
          </p>
        )}
        {state === 'loading' && (
          <p className="qw-cosmos-state" data-cosmos-state-line="loading">
            {t('cosmos.scopeState.loading')}
          </p>
        )}
        {state === 'unreadable' && (
          <p className="qw-cosmos-state" data-cosmos-state-line="unreadable" role="status">
            {t('cosmos.scopeState.unreadable')}
          </p>
        )}
        <ul className="qw-cosmos-legend" data-cosmos-legend="">
          <li className="qw-cosmos-legend-chip" data-body="featured">
            {featuredLabel}
          </li>
          <li className="qw-cosmos-legend-chip" data-body="sun">
            {sunLabel}
          </li>
          <li className="qw-cosmos-legend-chip" data-body="moon">
            {moonLabel}
          </li>
          <li className="qw-cosmos-legend-chip" data-body="centre">
            {centreLabel}
          </li>
        </ul>
      </div>
    </div>
  );
}
