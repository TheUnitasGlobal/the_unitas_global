import type { CSSProperties } from 'react';

/**
 * REV-34 M1-E (founder directive 2026-09-16) -- the one glyph of the strip.
 *
 * The news widget used to draw 22 lucide axis icons, a three-state
 * StoryBadge (Radio / Flame / TrendingUp) and coloured row markers while the
 * shortcut carousel's rank-less rows drew a plain 8px coloured circle. The
 * founder ordered the pictures out and the circle in: one minimal dot,
 * coloured by the slot / axis accent, everywhere a glyph used to sit.
 *
 * The colour travels as `--qw-hub-accent` (the token every hub chip, tab and
 * rank box already consumes) so the CSS in quantum-white-rev19.css paints it
 * -- no hard-coded colour in the component. Purely decorative: the text next
 * to it carries the meaning, so it is hidden from assistive tech.
 */
export interface HubDotProps {
  /** Slot / axis accent (hex). */
  color: string;
  /** Diameter in CSS px; 8 is the strip's row marker, 12-14 a card header. */
  size?: number;
  /** Utility classes for optical alignment beside a text line (`mt-1.5`). */
  className?: string;
}

export function HubDot({ color, size = 8, className = '' }: HubDotProps) {
  return (
    <span
      className={`qw-hub-dot ${className}`.trim()}
      style={{ '--qw-hub-accent': color, '--qw-hub-dot-size': `${size}px` } as CSSProperties}
      aria-hidden="true"
    />
  );
}
