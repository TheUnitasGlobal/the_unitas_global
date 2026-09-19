'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { findDiscoverySlot } from '@/lib/live/discoverySlots';
import { useSlotContext } from '@/lib/live/useSlotContext';
import { CosmosDetail } from './CosmosDetail';
import { GastronomyDetail } from './GastronomyDetail';
import { SkyDetail } from './SkyDetail';

/**
 * REV-42 D-5 (founder directive 2026-09-18) -- the tier-3 detail shell.
 *
 * The three flagship shortcuts (weather / cosmos / gastronomy) gain a third
 * tier under their deep popup: a NESTED `Modal size="xl"` labelled by the
 * unique id `slot-detail-title` (the `#feed-deep-title` / `#slot-weather-
 * title` tokens of tier 2 stay exactly one each, 1-A #6), root hook
 * `[data-slot-detail=<key>]`. The host deep modal owns the open state,
 * resets it on slot change and on its own close, and mounts this shell
 * unconditionally with `open` (the exit transition plays, SKILL §4).
 * Because `Modal` portals to the body and parks one history entry per
 * dialog (REV-19 back stack), the DOM is a sibling of tier 2 and the
 * history is one layer up: X / ESC / backdrop / device back close THIS
 * layer only and tier 2 stays (rev42-shortcuts (b)(c)(d)).
 *
 * The header repeats the slot's own icon and accent from the registry (one
 * source of truth for the three colours), then the tier-3 title
 * (`Rev42.detail.title.<key>`) and the slot's tag line. The body is the
 * slot's: weather -> SkyDetail, cosmos -> CosmosDetail (lane D: the SAME
 * SkyDetail mirrored + four sections), gastronomy -> GastronomyDetail
 * (lane E). No HubMetaLine here (1-A #4).
 *
 * `nowMs` is the instant the host read at open time; when the host has
 * none, this shell reads its own once per open (state + effect, never in
 * render -- REV-36/40) and the body's own clock ticks from there.
 */
export type SlotDetailKey = 'weather' | 'cosmos' | 'gastronomy';

export interface SlotDetailPlace {
  lat: number;
  lon: number;
  name: string;
}

export interface SlotDetailModalProps {
  open: boolean;
  slotKey: SlotDetailKey;
  onClose: () => void;
  /** The observer / diner's point; null when the host has none yet. */
  place: SlotDetailPlace | null;
  /** Read once by the host at open time (never `Date.now()` in render). */
  nowMs?: number;
  children?: ReactNode;
}

export function SlotDetailModal({ open, slotKey, onClose, place, nowMs, children }: SlotDetailModalProps) {
  const t = useTranslations();
  const locale = useLocale();
  const ctx = useSlotContext();
  const slot = findDiscoverySlot(slotKey);
  // The fallback instant: seeded once, refreshed each time the dialog opens
  // without a host-supplied `nowMs`, so a reopen never resumes an old clock.
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  useEffect(() => {
    if (open && nowMs === undefined) setOpenedAt(Date.now());
  }, [open, nowMs]);
  const at = nowMs ?? openedAt;
  const Icon = slot?.icon;

  return (
    <Modal open={open} onClose={onClose} size="xl" labelledBy="slot-detail-title">
      <div className="qw-detail space-y-5" data-slot-detail={slotKey} data-detail-host={slotKey}>
        <div className="flex items-start gap-3">
          {Icon && <Icon size={26} style={{ color: slot.color }} className="mt-0.5 shrink-0" aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            <p id="slot-detail-title" className="qw-detail-title text-[20px] font-bold text-white">
              {t(`Rev42.detail.title.${slotKey}`)}
            </p>
            <p className="qw-hub-meta mt-0.5 text-[14px] text-gray-400">{t(`Rev20.slots.${slotKey}.tag`)}</p>
            {slotKey === 'cosmos' && <p className="qw-detail-mirror mt-1 text-[12px] text-gray-500">{t('Rev42.detail.mirrorNote')}</p>}
          </div>
        </div>

        <div className="qw-detail-body" style={slot ? ({ '--qw-hub-accent': slot.color } as CSSProperties) : undefined}>
          {slotKey === 'weather' && <SkyDetail place={place} nowMs={at} host="weather" />}
          {slotKey === 'cosmos' && <CosmosDetail place={place} nowMs={at} />}
          {slotKey === 'gastronomy' && <GastronomyDetail locale={locale} country={ctx.country} nowMs={at} />}
        </div>

        {children}
      </div>
    </Modal>
  );
}
