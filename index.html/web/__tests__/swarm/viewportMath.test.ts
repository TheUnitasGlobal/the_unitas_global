import { describe, expect, it } from 'vitest';
import {
  SWARM_TAP_SLOP_PX,
  SWARM_VIEWPORT_IDENTITY,
  SWARM_ZOOM_MAX,
  SWARM_ZOOM_MIN,
  clampViewport,
  clampZoom,
  isIdentity,
  isTap,
  panBy,
  panLimit,
  pinchDistance,
  pinchFactor,
  pxToPct,
  zoomBy,
  zoomTo,
} from '@/lib/swarm/viewportMath';

// REV-33 M2 -- the swarm viewport arithmetic. Pure: no DOM, no clock, no
// fixtures shared with other __tests__/** files (CLAUDE.md "Module-level test
// isolation"). What the view owes this module is that every pan and every
// pinch goes through these functions, so the field can never be dragged off
// its own stage nor zoomed out of existence.

describe('clampZoom', () => {
  it('holds the fitted field as the floor and a readable ceiling', () => {
    expect(clampZoom(0.2)).toBe(SWARM_ZOOM_MIN);
    expect(clampZoom(99)).toBe(SWARM_ZOOM_MAX);
    expect(clampZoom(2)).toBe(2);
  });

  it('refuses NaN -- scale(NaN) silently removes the element', () => {
    expect(clampZoom(Number.NaN)).toBe(SWARM_ZOOM_MIN);
  });

  it('treats an infinity as the extreme it is, not as an error', () => {
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(SWARM_ZOOM_MAX);
    expect(clampZoom(Number.NEGATIVE_INFINITY)).toBe(SWARM_ZOOM_MIN);
  });
});

describe('panLimit', () => {
  it('is ZERO at the fitted zoom -- a field that fits has nowhere to go', () => {
    expect(panLimit(1)).toBe(0);
  });

  it('is half the overhang, in percent of the stage', () => {
    // At 3x, two stages of field hang over the edges: one per side.
    expect(panLimit(3)).toBe(100);
    expect(panLimit(1.5)).toBeCloseTo(25, 10);
  });

  it('never exceeds the limit of the maximum zoom', () => {
    expect(panLimit(1000)).toBe(panLimit(SWARM_ZOOM_MAX));
  });
});

describe('clampViewport', () => {
  it('pulls a pan back inside the box its own zoom allows', () => {
    expect(clampViewport({ x: 500, y: -500, z: 2 })).toEqual({ x: 50, y: -50, z: 2 });
  });

  it('collapses any pan to zero at the fitted zoom', () => {
    expect(clampViewport({ x: 40, y: -40, z: 1 })).toEqual(SWARM_VIEWPORT_IDENTITY);
  });

  it('survives a corrupt viewport instead of rendering NaN', () => {
    expect(clampViewport({ x: Number.NaN, y: Number.NaN, z: Number.NaN })).toEqual(SWARM_VIEWPORT_IDENTITY);
  });
});

describe('panBy', () => {
  it('moves the field and keeps it reachable', () => {
    const v = panBy({ x: 0, y: 0, z: 2 }, 10, -5);
    expect(v).toEqual({ x: 10, y: -5, z: 2 });
  });

  it('is a no-op at the fitted zoom, by construction rather than by a guard', () => {
    expect(panBy(SWARM_VIEWPORT_IDENTITY, 30, 30)).toEqual(SWARM_VIEWPORT_IDENTITY);
  });

  it('stops at the edge instead of sliding past it', () => {
    const v = panBy({ x: 45, y: 0, z: 2 }, 40, 0);
    expect(v.x).toBe(panLimit(2));
  });
});

describe('zoomBy / zoomTo', () => {
  it('multiplies and clamps', () => {
    expect(zoomBy({ x: 0, y: 0, z: 1 }, 2).z).toBe(2);
    expect(zoomBy({ x: 0, y: 0, z: 3 }, 10).z).toBe(SWARM_ZOOM_MAX);
    expect(zoomBy({ x: 0, y: 0, z: 2 }, 0.01).z).toBe(SWARM_ZOOM_MIN);
  });

  it('ignores a nonsense factor rather than destroying the viewport', () => {
    expect(zoomBy({ x: 0, y: 0, z: 2 }, 0).z).toBe(2);
    expect(zoomBy({ x: 0, y: 0, z: 2 }, Number.NaN).z).toBe(2);
    expect(zoomBy({ x: 0, y: 0, z: 2 }, -3).z).toBe(2);
  });

  /**
   * THE ONE THAT BITES. Zooming out shrinks the reachable box, so a pan that
   * was legal at 3x is illegal at 1.2x. Without re-clamping, the field is
   * stranded off-centre with no way back.
   */
  it('re-clamps the pan when zooming out strands it', () => {
    const wide = clampViewport({ x: 100, y: 100, z: 3 });
    expect(wide.x).toBe(100);
    const back = zoomTo(wide, 1.2);
    expect(back.z).toBe(1.2);
    expect(back.x).toBe(panLimit(1.2));
    expect(back.y).toBe(panLimit(1.2));
  });

  it('returns exactly to the identity when zoomed all the way out', () => {
    expect(zoomTo({ x: 90, y: -90, z: 3 }, 1)).toEqual(SWARM_VIEWPORT_IDENTITY);
  });
});

describe('pinch', () => {
  it('measures the distance between two fingers', () => {
    expect(pinchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('turns a spread into a factor above 1 and a squeeze into one below', () => {
    expect(pinchFactor(100, 200)).toBe(2);
    expect(pinchFactor(200, 100)).toBe(0.5);
  });

  /** The first frame of a two-finger touch can report zero separation. */
  it('refuses to divide by a zero-distance first frame', () => {
    expect(pinchFactor(0, 120)).toBe(1);
    expect(pinchFactor(120, 0)).toBe(1);
    expect(pinchFactor(Number.NaN, 120)).toBe(1);
  });
});

describe('isTap', () => {
  it('lets a still finger activate a node', () => {
    expect(isTap(0, 0)).toBe(true);
    expect(isTap(SWARM_TAP_SLOP_PX - 1, 0)).toBe(true);
  });

  it('calls a travelling finger a pan, so a drag never absorbs an entity', () => {
    expect(isTap(SWARM_TAP_SLOP_PX + 1, 0)).toBe(false);
    expect(isTap(10, 10)).toBe(false);
  });
});

describe('pxToPct', () => {
  it('converts drag pixels to stage percent', () => {
    expect(pxToPct(50, 100, 1)).toBe(50);
  });

  /** Divide by the zoom, or the field slides out from under the finger. */
  it('shrinks the travel as the visitor zooms in, so the grab holds', () => {
    expect(pxToPct(50, 100, 2)).toBe(25);
    expect(pxToPct(50, 100, 3.2)).toBeCloseTo(15.625, 10);
  });

  it('uses the CLAMPED zoom, so an out-of-range value cannot change the feel', () => {
    expect(pxToPct(50, 100, 99)).toBe(pxToPct(50, 100, SWARM_ZOOM_MAX));
    expect(pxToPct(50, 100, 0.1)).toBe(pxToPct(50, 100, SWARM_ZOOM_MIN));
  });

  it('answers zero for a stage that has not been measured yet', () => {
    expect(pxToPct(50, 0, 1)).toBe(0);
    expect(pxToPct(50, Number.NaN, 1)).toBe(0);
  });
});

describe('isIdentity', () => {
  it('knows when the reset control would do nothing', () => {
    expect(isIdentity(SWARM_VIEWPORT_IDENTITY)).toBe(true);
    expect(isIdentity({ x: 0, y: 0, z: 1.2 })).toBe(false);
    expect(isIdentity({ x: 1, y: 0, z: 1 })).toBe(false);
  });
});
