'use client';

import { useMemo, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { buildMoonPixelGrid } from '@/lib/live/moonPixel';
import { countdownParts, type MoonPhaseWidget } from '@/lib/live/skyAlmanac';
import type { SlotWidgetVariant } from './SlotWidgetView';

/**
 * REV-42 D-3 (founder directive 2026-09-18) -- the weather card's moon.
 * The founder ordered the solar AND lunar date side by side with a pixel
 * rendering of tonight's Moon: one SVG, a 24-cell disc, every cell lit or
 * dark by which side of the terminator its centre lies on (lib/live/
 * moonPixel.ts owns the geometry), drawn as two <path> elements with
 * `shape-rendering: crispEdges` -- the lit face in the slot's accent.
 *
 * Everything shown comes from ONE `MoonPhaseWidget` the weather adapter
 * attached at load time (lib/live/skyAlmanac.ts moonPhaseWidgetFor): the
 * civil date, the lunisolar date on the locale's meridian, the phase, the
 * age, the illuminated fraction and the solar term in force with the next
 * one's start. No fetch, no clock: the "in N d M h" countdown is
 * `nextTermMs - widget.nowMs`, never Date.now() (SPEC 1-A #14).
 *
 * The 4-state contract on the root `data-state`: `data` when the widget is
 * here, `loading` while the host has no card yet (a dim disc, no text),
 * `unreadable` when the host settled without one (the honest line).
 *
 * Two variants: `card` is horizontal -- a 48px disc, the date and the
 * lunar line, then one compact row with the phase, the age and the term
 * chip -- and stays under 96px (1-A #8, the card's height only grows);
 * `deep` is a 96px disc with every line and the next-term countdown.
 * Neither carries a button, a link or a role (1-A #7: the one-target card
 * is the control; lane F mounts the tier-3 CTA in the deep modal itself).
 *
 * E2E contract (rev42-shortcuts (b)): `[data-moon-pixel][data-state=data]
 * [data-phase][data-age]` on the weather card, one `[data-moon-term]`
 * inside it, and zero `button, a, [role]` descendants.
 */
export interface MoonPhasePixelProps {
  widget?: MoonPhaseWidget;
  variant: SlotWidgetVariant;
  loading: boolean;
  /** The slot's accent -- the lit face of the disc (`--qw-hub-accent`). */
  accent: string;
}

export type MoonPixelState = 'loading' | 'data' | 'unreadable';

const VIEW = 24;
/** The loading shell's disc: every cell dark, drawn once. */
const SHELL = buildMoonPixelGrid(0, true, VIEW);

/** The civil date, spelled in full in the visitor's language, from its
 *  parts at local noon (never from an ISO string -- WebKit would shift the
 *  day by the offset). Falls back to ISO digits when Intl rejects the tag. */
function formatGregorian(locale: string, g: { y: number; m: number; d: number }): string {
  const date = new Date(g.y, g.m - 1, g.d, 12, 0, 0, 0);
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date);
  } catch {
    return `${g.y}-${String(g.m).padStart(2, '0')}-${String(g.d).padStart(2, '0')}`;
  }
}

export function MoonPhasePixel({ widget, variant, loading, accent }: MoonPhasePixelProps) {
  const t = useTranslations('Rev42.sky');
  const locale = useLocale();
  const state: MoonPixelState = widget ? 'data' : loading ? 'loading' : 'unreadable';

  const grid = useMemo(() => (widget ? buildMoonPixelGrid(widget.phaseAngle, widget.waxing, VIEW) : SHELL), [widget]);
  const gregorian = useMemo(() => (widget ? formatGregorian(locale, widget.gregorian) : ''), [locale, widget]);

  const style = { '--qw-hub-accent': accent } as CSSProperties;

  if (!widget) {
    return (
      <div className="qw-moon" data-moon-pixel="" data-state={state} data-variant={variant} style={style} aria-busy={state === 'loading' ? true : undefined}>
        <svg className="qw-moon-disc" viewBox={`0 0 ${VIEW} ${VIEW}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
          <path className="qw-moon-dark" d={grid.dark} />
        </svg>
        {state === 'unreadable' && (
          <div className="qw-moon-text">
            <p className="qw-moon-unreadable" data-moon-unreadable="">
              {t('unreadable')}
            </p>
          </div>
        )}
      </div>
    );
  }

  const age = widget.ageDays.toFixed(1);
  const phase = t(`phases.${widget.phaseKey}`);
  const pct = Math.round(Math.min(1, Math.max(0, widget.illumination)) * 100);
  const lunarLine = t(widget.lunar.leap ? 'lunarLeapLine' : 'lunarLine', { month: widget.lunar.month, day: widget.lunar.day });
  const animalYear = t('animalYear', { animal: t(`animals.${widget.lunar.animalKey}`) });
  const term = t(`terms.${widget.termKey}`);
  const nextTerm = t(`terms.${widget.nextTermKey}`);
  const countdown = countdownParts(widget.nowMs, widget.nextTermMs);
  const termIn = t('termIn', countdown);
  const deep = variant === 'deep';

  return (
    <div
      className="qw-moon"
      data-moon-pixel=""
      data-state="data"
      data-variant={variant}
      data-phase={widget.phaseKey}
      data-age={age}
      data-waxing={widget.waxing ? '1' : '0'}
      style={style}
      aria-label={t('pixelAria', { phase, age })}
    >
      <svg className="qw-moon-disc" viewBox={`0 0 ${VIEW} ${VIEW}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
        {grid.dark && <path className="qw-moon-dark" d={grid.dark} />}
        {grid.lit && <path className="qw-moon-lit" d={grid.lit} />}
      </svg>

      <div className="qw-moon-text">
        <p className="qw-moon-date" data-moon-gregorian="">
          {deep && <span className="qw-moon-label">{t('gregorianLabel')}</span>}
          <span className="qw-moon-date-value">{gregorian}</span>
        </p>
        <p className="qw-moon-lunar" data-moon-lunar="">
          {deep && <span className="qw-moon-label">{t('lunarLabel')}</span>}
          <span className="qw-moon-lunar-value">{lunarLine}</span>
          <span className="qw-moon-animal">{animalYear}</span>
        </p>
        <p className="qw-moon-meta">
          <span className="qw-moon-phase" data-moon-phase-name="">
            {phase}
          </span>
          <span className="qw-moon-age">{t('moonAge', { age })}</span>
          {deep && <span className="qw-moon-illum">{t('illumination', { pct })}</span>}
          <span className="qw-moon-term" data-moon-term={widget.termKey} data-term-key={widget.termKey} title={t('termChipAria', { term })}>
            {deep && <span className="qw-moon-term-label">{t('termNow')}</span>}
            <span className="qw-moon-term-name">{term}</span>
            <span className="qw-moon-term-in">{termIn}</span>
          </span>
        </p>
        {deep && (
          <p className="qw-moon-next" data-moon-next-term={widget.nextTermKey}>
            <span className="qw-moon-label">{t('termNext')}</span>
            <span className="qw-moon-next-name">{nextTerm}</span>
          </p>
        )}
      </div>
    </div>
  );
}
