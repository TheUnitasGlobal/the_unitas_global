'use client';

import type { SlotKey, SlotWidget } from '@/lib/live/discoverySlots';
import { FxCompassHero } from './FxCompassHero';
import { OmniRadar } from './OmniRadar';

/**
 * REV-41 D-8 (founder directive 2026-09-17) -- the one entry point through
 * which a hub card renders the typed widget its adapter attached
 * (`SlotCard.widget`): the FX compass hero (D-3, mission 1-D) or the
 * Around-Me omni-radar (D-5, mission 1-G). DiscoveryCarousel mounts it
 * above the facts row with `variant="card"`, FeedDeepModal above the
 * sections with `variant="deep"`; the kind switch lives here so neither
 * host needs to know what a widget looks like.
 *
 * WHY `kind` IS A PROP AND NOT READ OFF THE WIDGET: the honest 4-state
 * contract (loading | data | empty | unreadable) needs a shell BEFORE the
 * card arrives (the radar's rings while the beams are in flight) and an
 * honest line when the adapter could not build a widget at all (the fx
 * card after a Frankfurter outage is an EMPTY_CARD with no widget). Both
 * cases have no widget to read a kind from, so the host names the kind
 * from the slot key (`slotWidgetKind`) and passes the widget it has, if any.
 * A widget of the wrong kind (a stale card from another slot in the deep
 * modal while its own load is in flight) is ignored, not mis-rendered.
 */
export type SlotWidgetKind = SlotWidget['kind'];
export type SlotWidgetVariant = 'card' | 'deep';

/** Which widget a slot's card carries -- the two slots the data lane wires
 *  (lib/live/discoverySlots.ts fxSlot / nearbySlot). */
const SLOT_WIDGET_KIND: Partial<Record<SlotKey, SlotWidgetKind>> = {
  fx: 'fxCompass',
  nearby: 'omniRadar',
};

export function slotWidgetKind(key: SlotKey): SlotWidgetKind | null {
  return SLOT_WIDGET_KIND[key] ?? null;
}

export interface SlotWidgetViewProps {
  kind: SlotWidgetKind;
  /** The card's widget when the card has one; undefined while loading or
   *  when the adapter could not build it. */
  widget: SlotWidget | undefined;
  variant: SlotWidgetVariant;
  /** The host is still loading the card (no cache to paint). A widget of
   *  the right kind always wins over this flag. */
  loading: boolean;
  /** The slot's accent -- the sweep / spark colour (`--qw-hub-accent`). */
  accent: string;
  /** The sub-tab the host is showing or loading (the radar's radius key),
   *  so the loading shell already reads the radius the visitor picked. */
  pendingTab?: string;
}

export function SlotWidgetView({ kind, widget, variant, loading, accent, pendingTab }: SlotWidgetViewProps) {
  if (kind === 'fxCompass') {
    return <FxCompassHero widget={widget?.kind === 'fxCompass' ? widget : undefined} variant={variant} loading={loading} accent={accent} />;
  }
  return (
    <OmniRadar
      widget={widget?.kind === 'omniRadar' ? widget : undefined}
      variant={variant}
      loading={loading}
      accent={accent}
      pendingRadiusKey={pendingTab}
    />
  );
}
