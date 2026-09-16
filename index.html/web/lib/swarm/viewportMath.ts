/**
 * REV-33 M2 (founder directive 2026-09-15) -- the swarm viewport.
 *
 * THE PROBLEM. The field is a box of absolutely-positioned buttons over an
 * SVG edge layer, sized by its container. On a phone that container is about
 * 300 px across and the field can hold forty nodes: readable, but not
 * explorable. The founder asked for the opposite of a picture -- "오직 스웜
 * 데이터망 내부에서만 부드럽게 유영" -- a surface you travel inside.
 *
 * Travelling inside a box that lives in a scrolling document is a conflict:
 * the same finger drag means "pan the field" to us and "scroll the page" to
 * the browser, and two fingers mean "zoom the field" to us and "zoom the
 * document" to iOS Safari. That conflict is settled in the view (touch-action
 * plus non-passive preventDefault); what is settled HERE is the arithmetic,
 * so it can be proven without a browser.
 *
 * Everything below is pure: same inputs, same outputs, no DOM, no clock. The
 * unit tests in __tests__/swarm/viewportMath.test.ts are the specification.
 *
 * UNITS. Pan is expressed in PERCENT OF THE STAGE, not pixels, for the same
 * reason `swarmLayout` speaks percent: one set of numbers drives an absolutely
 * positioned HTML layer AND an SVG `viewBox="0 0 100 100"` layer, and a pixel
 * would drift between them the moment the box resized.
 */

/** Never below 1: the fitted field is the floor, so the visitor cannot zoom
 *  out into empty margin and lose the graph. */
export const SWARM_ZOOM_MIN = 1;
/** Far enough to read a long label on a phone, near enough that the edge
 *  lines stay hairlines rather than bars. Measured against the 44px node. */
export const SWARM_ZOOM_MAX = 3.2;
/** One wheel notch / one pinch step. */
export const SWARM_ZOOM_STEP = 0.18;

/**
 * How far a finger may travel and still be a TAP. A node is a real <button>
 * inside a Tab-trapping modal; a drag that begins on one must pan the field
 * and must NOT activate it, or every attempt to travel would absorb an
 * entity instead. 8 px is the threshold `railDrag` already uses for the same
 * decision on the discovery rail -- one number, one meaning, app-wide.
 */
export const SWARM_TAP_SLOP_PX = 8;

export interface SwarmViewport {
  /** Pan, in percent of the stage. Positive x moves the field right. */
  x: number;
  y: number;
  /** Scale. 1 = fitted. */
  z: number;
}

export const SWARM_VIEWPORT_IDENTITY: SwarmViewport = { x: 0, y: 0, z: 1 };

export function clampZoom(z: number): number {
  // NaN is the only value that cannot be reasoned about -- it would survive
  // both comparisons below and reach a CSS transform as `scale(NaN)`, which
  // silently removes the element. An infinity is merely an extreme, and the
  // clamp already has an answer for extremes.
  if (Number.isNaN(z)) return SWARM_ZOOM_MIN;
  return Math.min(SWARM_ZOOM_MAX, Math.max(SWARM_ZOOM_MIN, z));
}

/**
 * The furthest the field may be panned at this zoom, in percent of the stage.
 *
 * At zoom z the field is z times the stage, so exactly (z - 1) of a stage
 * hangs over the edges -- half on each side. Panning further than that would
 * drag the graph off its own stage and leave the visitor holding nothing,
 * which is the failure mode every hand-rolled pan has. At z = 1 the limit is
 * 0: a fitted field does not move, because there is nowhere for it to go.
 */
export function panLimit(z: number): number {
  const scale = clampZoom(z);
  return ((scale - 1) / 2) * 100;
}

/** Clamp a viewport into the reachable box for its own zoom. */
export function clampViewport(v: SwarmViewport): SwarmViewport {
  const z = clampZoom(v.z);
  const limit = panLimit(z);
  const fix = (n: number) => {
    if (!Number.isFinite(n)) return 0;
    const clamped = Math.min(limit, Math.max(-limit, n));
    // Normalise -0. It is arithmetically equal to 0 but not identical to it,
    // and letting it escape makes every equality assertion downstream a
    // coin-flip -- including the one the reset control reads.
    return clamped === 0 ? 0 : clamped;
  };
  return { x: fix(v.x), y: fix(v.y), z };
}

/**
 * Apply a pan delta, in percent of the stage, and re-clamp.
 * A pan at zoom 1 is a no-op by construction -- `panLimit(1)` is 0.
 */
export function panBy(v: SwarmViewport, dxPct: number, dyPct: number): SwarmViewport {
  return clampViewport({ x: v.x + dxPct, y: v.y + dyPct, z: v.z });
}

/**
 * Zoom about the stage centre, then re-clamp the pan.
 *
 * Re-clamping matters: zooming OUT shrinks `panLimit`, so a viewport that was
 * legally panned at 3x becomes illegal at 1.2x. Without this the field would
 * stay stranded off-centre with no way back except a reset.
 */
export function zoomBy(v: SwarmViewport, factor: number): SwarmViewport {
  return clampViewport({ x: v.x, y: v.y, z: v.z * (Number.isFinite(factor) && factor > 0 ? factor : 1) });
}

/** Absolute zoom, pan re-clamped. */
export function zoomTo(v: SwarmViewport, z: number): SwarmViewport {
  return clampViewport({ x: v.x, y: v.y, z });
}

export interface SwarmPoint {
  x: number;
  y: number;
}

/** Euclidean distance between two touch points, in px. */
export function pinchDistance(a: SwarmPoint, b: SwarmPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The scale factor a pinch represents. Guarded against the zero-distance
 * first frame, which would otherwise divide by zero and send the field to
 * Infinity on the very first two-finger touch.
 */
export function pinchFactor(startDistance: number, currentDistance: number): number {
  if (!Number.isFinite(startDistance) || startDistance <= 0) return 1;
  if (!Number.isFinite(currentDistance) || currentDistance <= 0) return 1;
  return currentDistance / startDistance;
}

/** Did the pointer stay still enough to mean "activate this node"? */
export function isTap(dxPx: number, dyPx: number): boolean {
  return Math.hypot(dxPx, dyPx) <= SWARM_TAP_SLOP_PX;
}

/** Is this viewport the identity -- i.e. is the reset control pointless? */
export function isIdentity(v: SwarmViewport): boolean {
  return v.x === 0 && v.y === 0 && v.z === SWARM_ZOOM_MIN;
}

/**
 * Pixels dragged -> percent of the stage. A pan must feel like the field is
 * stuck to the finger, and at zoom z the field is z times the stage, so a
 * given pixel travel is a SMALLER fraction of the field the further in you
 * are. Dividing by z is what keeps the grab from sliding.
 */
export function pxToPct(deltaPx: number, stagePx: number, z: number): number {
  if (!Number.isFinite(stagePx) || stagePx <= 0) return 0;
  const scale = clampZoom(z);
  return (deltaPx / stagePx) * 100 / scale;
}
