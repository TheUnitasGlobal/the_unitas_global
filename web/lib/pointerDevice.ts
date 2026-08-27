/**
 * Live input-modality detection for the scroll-into-focus card SFX
 * (EcosystemCard / LiveServiceCard / B2BProtocolCard).
 *
 * Owner instruction (2026-08-27, supersedes the earlier "touch-capable device"
 * heuristic): the scroll-through-center sound must fire ONLY while the visitor is
 * actually scrolling the page by touch (phone / tablet). On any mouse- or
 * trackpad-driven session it must NEVER fire -- not even on a touchscreen laptop --
 * because a pointer user already gets the identical cue from hover, and replaying it
 * on every scroll pass makes scrolling itself noisy.
 *
 * Static capability probes (navigator.maxTouchPoints, `any-pointer: coarse`,
 * `ontouchstart`) cannot tell a mouse user on a hybrid laptop apart from a finger
 * user -- that is exactly what leaked the cue onto PCs before. So we track the *live*
 * input modality: every real pointer / wheel / touch gesture bumps a monotonic
 * sequence counter, and whichever modality acted most recently wins. Before the first
 * interaction we fall back to a primary-pointer media query
 * (`(pointer: coarse) and (hover: none)` == a genuine handheld, not a desktop). In
 * practice the audio pipeline is gated behind the AudioGate's unlock gesture, so a
 * real modality reading always exists before any SFX can play; the media-query
 * fallback is only a defensive default.
 */

let seq = 0;
let lastTouchSeq = 0;
let lastMouseSeq = 0;
let listening = false;

function markTouch(): void {
  lastTouchSeq = ++seq;
}

function markMouse(): void {
  lastMouseSeq = ++seq;
}

function onPointer(event: Event): void {
  const pointerType = (event as PointerEvent).pointerType;
  if (pointerType === 'touch') {
    markTouch();
  } else if (pointerType === 'mouse') {
    markMouse();
  }
  // 'pen'/stylus is deliberately neither: it is not "a mouse-driven PC", and a stylus
  // tablet should keep behaving like a touch device for this cue.
}

/** Attach the passive modality listeners exactly once, as early as this module loads in the browser. */
function startListening(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  window.addEventListener('pointerdown', onPointer, opts);
  window.addEventListener('pointermove', onPointer, opts);
  window.addEventListener('touchstart', markTouch, opts);
  window.addEventListener('wheel', markMouse, opts);
}

startListening();

/**
 * A genuine handheld: the *primary* pointer is coarse (finger) and cannot hover.
 * A mouse desktop is `(pointer: fine) and (hover: hover)`; a touchscreen laptop still
 * reports a fine primary pointer, so it is (correctly) not counted here.
 */
export function isTouchPrimaryDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(hover: none)').matches
  );
}

/**
 * Whether the scroll-into-focus SFX should play right now.
 *
 * true  -> touch acted more recently than any mouse/trackpad input (or, pre-interaction,
 *          the device is a coarse-primary handheld): the visitor is scrolling by finger
 *          and wants the cue.
 * false -> a mouse / trackpad / wheel gesture is the most recent input: treat the session
 *          as a PC and stay silent, since hover already covers it.
 */
export function shouldPlayScrollFocusSfx(): boolean {
  if (typeof window === 'undefined') return false;
  startListening();

  if (lastTouchSeq === 0 && lastMouseSeq === 0) {
    // No qualifying gesture observed yet -- decide by the primary pointer.
    return isTouchPrimaryDevice();
  }
  return lastTouchSeq > lastMouseSeq;
}
