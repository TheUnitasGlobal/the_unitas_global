/**
 * REV-13 Adaptive Chrono-Luminance: the white canvas breathes with the
 * visitor's LOCAL clock -- slightly dimmer and warmer in the evening, crisp
 * and cool at midday -- by writing two CSS custom properties that
 * app/quantum-white.css multiplies into its light pools and glass tokens.
 *
 * Pure function + a tiny DOM writer so the UI agent can call `applyChrono`
 * on mount and every 10 minutes (and only after the curtain is `released`),
 * and vitest can pin every band boundary without a DOM.
 *
 * Bands are half-open on the local hour: [5,9) dawn, [9,17) day, [17,21)
 * dusk, everything else night. `--qw-lum` stays within 0.92..1.0 so the
 * surface never reads as "grey" -- it is a luminance multiplier, not a
 * theme switch.
 */

export type ChronoLabel = 'dawn' | 'day' | 'dusk' | 'night';

export interface ChronoLuminance {
  /** Luminance multiplier 0.92..1.0 -> `--qw-lum`. */
  lum: number;
  /** Warmth 0 (cool morning) .. 1 (warm evening) -> `--qw-warm`. */
  warm: number;
  label: ChronoLabel;
}

const CHRONO_BANDS: Readonly<Record<ChronoLabel, ChronoLuminance>> = {
  dawn: { lum: 0.96, warm: 0.15, label: 'dawn' },
  day: { lum: 1, warm: 0, label: 'day' },
  dusk: { lum: 0.95, warm: 0.55, label: 'dusk' },
  night: { lum: 0.92, warm: 0.35, label: 'night' },
};

export function chronoLabelForHour(hour: number): ChronoLabel {
  if (!Number.isFinite(hour)) return 'day';
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 9) return 'dawn';
  if (h >= 9 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'dusk';
  return 'night';
}

export function chronoLuminance(date: Date): ChronoLuminance {
  const band = CHRONO_BANDS[chronoLabelForHour(date.getHours())];
  // Return a fresh object so callers can never mutate the band table.
  return { lum: band.lum, warm: band.warm, label: band.label };
}

export const CHRONO_LUM_PROP = '--qw-lum';
export const CHRONO_WARM_PROP = '--qw-warm';
/** REV-15 (SPEC.md §1.2): ready-made percentage string for the `color-mix()`
 *  tokens in app/quantum-white.css -- keeps that CSS free of any `calc()`
 *  dependency on `--qw-lum`. */
export const CHRONO_LUM_PCT_PROP = '--qw-lum-pct';

/**
 * Writes `--qw-lum` / `--qw-warm` / `--qw-lum-pct` (plus a `data-qw-chrono`
 * label for CSS-only band styling) onto `root`. Never throws -- a detached
 * or style-less element simply receives nothing.
 */
export function applyChrono(root: HTMLElement, date: Date = new Date()): ChronoLuminance {
  const chrono = chronoLuminance(date);
  try {
    root.style.setProperty(CHRONO_LUM_PROP, String(chrono.lum));
    root.style.setProperty(CHRONO_WARM_PROP, String(chrono.warm));
    root.style.setProperty(CHRONO_LUM_PCT_PROP, `${Math.round(chrono.lum * 100)}%`);
    root.dataset.qwChrono = chrono.label;
  } catch {
    // Non-element root or frozen style declaration -- decorative only.
  }
  return chrono;
}

/** Removes what `applyChrono` wrote (home unmount -> other routes stay untouched). */
export function clearChrono(root: HTMLElement): void {
  try {
    root.style.removeProperty(CHRONO_LUM_PROP);
    root.style.removeProperty(CHRONO_WARM_PROP);
    root.style.removeProperty(CHRONO_LUM_PCT_PROP);
    delete root.dataset.qwChrono;
  } catch {
    // ignore -- see applyChrono
  }
}
