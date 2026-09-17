'use client';

import type { CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { NearbyRadiusKey, OmniRadarWidget, RadarBlip, RadarLens } from '@/lib/live/discoverySlots';
import { formatDistance, radiusByKey } from '@/lib/live/omniRadar';
import type { SlotWidgetVariant } from './SlotWidgetView';

/**
 * REV-41 D-5 / D-8 (founder directive 2026-09-17, mission 1-G) -- the
 * Around-Me omni-radar. The nearby card used to be a ten-row Wikipedia
 * geosearch list whose "10 km" tag and the rows never agreed; the founder
 * ordered a radar: the visitor at the centre, three rings, the compass
 * axes, a sweep, and every detected spot as a blip placed by its measured
 * bearing and distance, classified by the 1000-codex lens (nomad meetup
 * spot / AI-factory workspace / hidden inspiration spot / signal).
 *
 * Pure SVG, no fetch, no clock: everything drawn is the `OmniRadarWidget`
 * the adapter built (lib/live/discoverySlots.ts nearbySlot, lib/live/
 * omniRadar.ts). The sweep is one CSS rotate animation on the <path>
 * (§29 `.qw-radar-sweep`, stopped under prefers-reduced-motion), so this
 * file holds no Date.now() / Math.random() and no timer.
 *
 * Placement: a blip's radius is distKm / radiusKm of the tier (the ring
 * IS the radius, which is what makes the 0% error visible -- a blip past
 * the outer ring would be a blip past the promised radius, and buildRadar
 * never emits one); the Global tier has no radius, so it is a square-root
 * scale out to 20,000 km (no point on Earth is further than the antipode)
 * that keeps the sixteen hubs from bunching at the rim.
 *
 * The 4-state contract (SPEC D-8), on the root as `data-state`:
 *  loading    -- no widget yet and the host is loading (the rings and the
 *                sweep run, no blip, no message);
 *  unreadable -- every sweep beam failed (`beams > 0 && failedBeams ===
 *                beams`), or the host settled with no widget at all: the
 *                honest line, the sweep stopped (a sweeping radar with a
 *                dead signal would be a lie);
 *  empty      -- some beam answered and nothing sits inside the radius;
 *  data       -- at least one blip.
 *
 * E2E contract (rev41-uai-popup 1-G): `[data-omni-radar][data-state]
 * [data-radius-key][data-radius-km]` (the km attribute is OMITTED for
 * Global), every blip `[data-radar-blip][data-lens][data-dist-km]` with
 * `data-dist-km <= data-radius-km`, and the radius chips are the host's
 * SlotTabRail (`[data-radius]`), not this widget's.
 */
export interface OmniRadarProps {
  widget: OmniRadarWidget | undefined;
  variant: SlotWidgetVariant;
  loading: boolean;
  accent: string;
  /** The radius tab the host is showing or loading -- the loading shell
   *  already reads the radius the visitor picked (defaults to 10 km). */
  pendingRadiusKey?: string;
}

export type RadarState = 'loading' | 'data' | 'empty' | 'unreadable';

const LENSES: readonly RadarLens[] = ['nomad', 'factory', 'inspiration', 'signal'];

/** The SVG stage: a 200-unit square, the outer ring at 92 so a rim blip's
 *  stroke stays inside the box. */
const VIEW = 200;
const CENTRE = VIEW / 2;
const RING_R = 92;
const RING_FRACTIONS = [1 / 3, 2 / 3, 1] as const;
/** Half the Earth's circumference: the Global tier's rim. */
export const GLOBAL_EDGE_KM = 20_000;
/** The sweep wedge's angular width, degrees. */
const SWEEP_DEG = 42;
const BLIP_R: Record<SlotWidgetVariant, number> = { card: 3.2, deep: 4 };

export function radarState(widget: OmniRadarWidget | undefined, loading: boolean): RadarState {
  if (!widget) return loading ? 'loading' : 'unreadable';
  if (widget.beams > 0 && widget.failedBeams === widget.beams) return 'unreadable';
  if (widget.blips.length === 0) return 'empty';
  return 'data';
}

/** Where a blip sits on the stage: bearing clockwise from north (SVG y
 *  grows downwards, so north is -y), radius = the tier ratio, or the
 *  square-root scale for Global; clamped to the outer ring. */
export function blipPoint(blip: Pick<RadarBlip, 'distKm' | 'bearing'>, radiusKm: number | null): { x: number; y: number } {
  const ratio = radiusKm === null ? Math.sqrt(Math.max(0, blip.distKm) / GLOBAL_EDGE_KM) : radiusKm > 0 ? blip.distKm / radiusKm : 1;
  const r = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 1)) * RING_R;
  const rad = (blip.bearing * Math.PI) / 180;
  return { x: CENTRE + r * Math.sin(rad), y: CENTRE - r * Math.cos(rad) };
}

/** The sweep wedge from north to SWEEP_DEG, drawn once; the CSS rotates it. */
function sweepPath(): string {
  const rad = (SWEEP_DEG * Math.PI) / 180;
  const ex = (CENTRE + RING_R * Math.sin(rad)).toFixed(2);
  const ey = (CENTRE - RING_R * Math.cos(rad)).toFixed(2);
  return `M${CENTRE},${CENTRE} L${CENTRE},${CENTRE - RING_R} A${RING_R},${RING_R} 0 0 1 ${ex},${ey} Z`;
}
const SWEEP_D = sweepPath();

function countByLens(blips: readonly RadarBlip[]): Record<RadarLens, number> {
  const counts: Record<RadarLens, number> = { nomad: 0, factory: 0, inspiration: 0, signal: 0 };
  for (const blip of blips) counts[blip.lens] += 1;
  return counts;
}

export function OmniRadar({ widget, variant, loading, accent, pendingRadiusKey }: OmniRadarProps) {
  const t = useTranslations('Rev41.nearby');
  const locale = useLocale();

  const state = radarState(widget, loading);
  // The loading shell reads the radius the host is fetching; a settled
  // widget is the only truth once it exists.
  const pending = radiusByKey(pendingRadiusKey);
  const radiusKey: NearbyRadiusKey = widget ? widget.radiusKey : pending.key;
  const radiusKm: number | null = widget ? widget.radiusKm : pending.km;
  const isGlobal = radiusKey === 'global';
  const blips = state === 'data' && widget ? widget.blips : [];
  const counts = countByLens(blips);
  const centreName = widget?.center.name ?? '…';
  const ariaLabel = t('radarAria', { center: centreName, radius: t(`radius.${radiusKey}`) });

  let countFormat: Intl.NumberFormat | null = null;
  try {
    countFormat = new Intl.NumberFormat(locale);
  } catch {
    countFormat = null;
  }
  const formatCount = (n: number) => (countFormat ? countFormat.format(n) : String(n));

  return (
    <div
      className="qw-omni-radar"
      data-omni-radar=""
      data-state={state}
      data-radius-key={radiusKey}
      {...(radiusKm !== null ? { 'data-radius-km': String(radiusKm) } : null)}
      data-variant={variant}
      style={{ '--qw-hub-accent': accent } as CSSProperties}
    >
      <div className="qw-radar" data-variant={variant}>
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} role="img" aria-label={ariaLabel} aria-busy={state === 'loading' ? true : undefined} focusable="false">
          <g className="qw-radar-rings">
            {RING_FRACTIONS.map((fraction) => (
              <circle key={fraction} className="qw-radar-ring" cx={CENTRE} cy={CENTRE} r={(RING_R * fraction).toFixed(2)} />
            ))}
          </g>
          {/* §28 owns `.qw-radar-cross` as an HTML crosshair; the omni-radar's
              axes are `.qw-radar-axes` on an SVG group (§29). */}
          <g className="qw-radar-axes">
            <line x1={CENTRE} y1={CENTRE - RING_R} x2={CENTRE} y2={CENTRE + RING_R} />
            <line x1={CENTRE - RING_R} y1={CENTRE} x2={CENTRE + RING_R} y2={CENTRE} />
          </g>
          {state !== 'unreadable' && <path className="qw-radar-sweep" d={SWEEP_D} />}
          <circle className="qw-radar-centre" cx={CENTRE} cy={CENTRE} r={3} />
          <g className="qw-radar-blips">
            {blips.map((blip) => {
              const point = blipPoint(blip, radiusKm);
              return (
                <circle
                  key={blip.id}
                  className="qw-radar-blip"
                  data-radar-blip=""
                  data-lens={blip.lens}
                  data-dist-km={String(Number(blip.distKm.toFixed(3)))}
                  cx={point.x.toFixed(2)}
                  cy={point.y.toFixed(2)}
                  r={BLIP_R[variant]}
                >
                  <title>{`${blip.title} · ${formatDistance(blip.distKm, locale)}`}</title>
                </circle>
              );
            })}
          </g>
        </svg>
      </div>

      <ul className="qw-radar-legend" data-radar-legend="">
        {LENSES.map((lens) => (
          <li key={lens} className="qw-radar-legend-chip" data-lens={lens}>
            {t(`lens.${lens}`)}
            <span className="qw-radar-legend-count">{formatCount(counts[lens])}</span>
          </li>
        ))}
      </ul>

      {widget && (
        <p className="qw-radar-centre-line" data-radar-centre="">
          <span className="qw-radar-caption-label">{t('center')}</span>
          <span className="qw-radar-centre-name">{widget.center.name}</span>
        </p>
      )}
      {state === 'empty' && (
        <p className="qw-radar-state" data-radar-state-line="empty">
          {t('empty')}
        </p>
      )}
      {state === 'unreadable' && (
        <p className="qw-radar-state" data-radar-state-line="unreadable" role="status">
          {t('unreadable')}
        </p>
      )}
      {state === 'data' && !isGlobal && (
        <p className="qw-radar-exact" data-radar-exact="">
          {t('exact')}
        </p>
      )}
      {isGlobal && widget && (
        <p className="qw-radar-constellation" data-radar-constellation="">
          <span className="qw-radar-constellation-title">{t('constellation')}</span>
          <span className="qw-radar-constellation-note">{t('constellationNote')}</span>
        </p>
      )}
    </div>
  );
}
