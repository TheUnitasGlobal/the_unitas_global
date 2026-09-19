'use client';

import type { MouseEvent as ReactMouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { CornerDownLeft, Orbit } from 'lucide-react';
import type { SlotDetailKey } from './SlotDetailModal';

/**
 * REV-42 D-5 (founder directive 2026-09-18) -- the way INTO tier 3.
 *
 * A glass chip (`.qw-detail-open`, derived from the rail chip's metrics:
 * 1.5px rim, pill radius, 800-weight tracked uppercase, §19 / §29) with
 * the `Orbit` glyph, the slot's label (`Rev42.detail.open.<key>`) and a
 * trailing ⏎ glyph -- the same "one press, one way in" grammar as the
 * title row's enter box (REV-34 M1-C). Mounted ONLY inside a tier-2 deep
 * modal (never on a card, 1-A #7: the one-target card's padding holds no
 * control), it stops propagation so the host container's one-target
 * onClick never fires twice, and it never auto-opens anything (1-A #6):
 * the visitor presses, the host flips its own `detailOpen`.
 *
 * E2E hook: `[data-detail-open=<key>]` (rev42-shortcuts openDetail).
 */
export interface DetailOpenButtonProps {
  slotKey: SlotDetailKey;
  onOpen: () => void;
}

export function DetailOpenButton({ slotKey, onOpen }: DetailOpenButtonProps) {
  const t = useTranslations('Rev42.detail');
  function handleClick(e: ReactMouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onOpen();
  }
  return (
    <div className="qw-detail-open-row">
      <button type="button" className="qw-detail-open" data-detail-open={slotKey} onClick={handleClick}>
        <Orbit size={15} className="qw-detail-open-orbit" aria-hidden="true" />
        <span className="qw-detail-open-label">{t(`open.${slotKey}`)}</span>
        <CornerDownLeft size={14} strokeWidth={2.75} className="qw-detail-open-enter" aria-hidden="true" />
      </button>
    </div>
  );
}
