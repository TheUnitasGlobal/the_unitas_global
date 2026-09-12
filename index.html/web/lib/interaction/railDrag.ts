/**
 * REV-21 §1.2 -- the pure physics behind every horizontal rail on the home
 * (the discovery chip rail, the ranking / news rails, the active card's
 * swipe). No DOM here: unit-tested maths that the hooks in
 * components/ui/useDragScroll.ts / useHorizontalSwipe.ts apply to elements.
 */

/** A mouse drag counts once the pointer has moved this far (px). */
export const DRAG_THRESHOLD_PX = 5;
/** After a drag ends, a `click` inside this window is the drag's tail, not a tap. */
export const CLICK_SUPPRESS_MS = 200;
/** A horizontal pointer travel of at least this many px on the active card
 *  advances / rewinds the carousel. */
export const SWIPE_THRESHOLD_PX = 40;
/** The rail's auto-centering stays out of the way for this long after a drag. */
export const CENTER_SUPPRESS_MS = 700;

export type GestureKind = 'none' | 'drag' | 'swipe-left' | 'swipe-right' | 'vertical';

/** Classify a pointer travel. Vertical-dominant travel is handed back to the
 *  browser (page scroll); horizontal travel below the swipe threshold is a
 *  drag, above it a swipe in the direction of travel. */
export function classifyGesture(dx: number, dy: number, swipeThreshold = SWIPE_THRESHOLD_PX): GestureKind {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < DRAG_THRESHOLD_PX && ay < DRAG_THRESHOLD_PX) return 'none';
  if (ay > ax) return 'vertical';
  if (ax >= swipeThreshold) return dx < 0 ? 'swipe-left' : 'swipe-right';
  return 'drag';
}

/** scrollLeft that keeps the grabbed point under the pointer. */
export function dragScrollLeft(startScrollLeft: number, startX: number, currentX: number): number {
  return Math.max(0, startScrollLeft - (currentX - startX));
}

/** Left offset that centers an item of `itemWidth` at `itemLeft` inside a
 *  viewport of `railWidth`. Clamped at 0; the browser clamps the far end. */
export function centeredScrollLeft(itemLeft: number, itemWidth: number, railWidth: number): number {
  return Math.max(0, Math.round(itemLeft - (railWidth - itemWidth) / 2));
}

/** True when a click at `now` still belongs to a drag that ended at `dragEndedAt`. */
export function isClickSuppressed(dragEndedAt: number | null, now: number, windowMs = CLICK_SUPPRESS_MS): boolean {
  return dragEndedAt !== null && now - dragEndedAt < windowMs;
}

/** Next carousel index after a swipe: a left swipe reveals the NEXT slot. */
export function stepForSwipe(kind: GestureKind): -1 | 0 | 1 {
  if (kind === 'swipe-left') return 1;
  if (kind === 'swipe-right') return -1;
  return 0;
}
