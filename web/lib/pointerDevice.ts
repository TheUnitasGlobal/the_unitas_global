/**
 * Pointer / input-capability detection shared by the scroll-into-focus card SFX
 * (EcosystemCard / LiveServiceCard / B2BProtocolCard).
 *
 * Intent (owner instruction 2026-08-27): the scroll-through-center sound effect is a
 * touch-device substitute for the hover cue mouse users already get. It must keep
 * firing on every touch/stylus/tablet/mobile device, and be muted ONLY on a pure
 * mouse-driven desktop that has no touch input at all.
 *
 * The previous heuristic -- `(hover: hover) and (pointer: fine)` -- was too blunt: a
 * touchscreen laptop (Surface, most modern Windows laptops) and many Android tablets
 * report a fine primary pointer *and* hover, so they wrongly lost the scroll SFX.
 * We now gate on actual touch capability instead of the primary-pointer guess.
 */

/** True when the device can accept touch input at all (phone, tablet, hybrid laptop, stylus). */
export function isTouchCapableDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // navigator.maxTouchPoints is the most reliable signal and covers hybrid devices
  // whose *primary* pointer is a mouse but which still have a touchscreen.
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.maxTouchPoints === 'number' && nav.maxTouchPoints > 0) return true;

  // Fallbacks: any coarse pointer (finger) available, or any hover-incapable pointer.
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(any-pointer: coarse)').matches) return true;
    if (window.matchMedia('(any-hover: none)').matches) return true;
  }

  // Legacy touch-event feature probe.
  return 'ontouchstart' in window;
}

/**
 * Whether the scroll-into-focus SFX should play on this device.
 *
 * Plays on every touch-capable device (its hover substitute). Muted only on a
 * genuine no-touch, fine-pointer desktop -- there the identical cue already fires
 * from the card's mouseenter handler, so replaying it on each scroll pass would
 * double up and make scrolling itself noisy.
 */
export function shouldPlayScrollFocusSfx(): boolean {
  if (typeof window === 'undefined') return false;
  if (isTouchCapableDevice()) return true;

  const finePointerDesktop =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  return !finePointerDesktop;
}
