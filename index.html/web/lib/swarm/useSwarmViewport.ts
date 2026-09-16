'use client';

/**
 * REV-33 M2 (founder directive 2026-09-15) -- ZERO-FRICTION travel inside the
 * swarm field.
 *
 * THE CONFLICT. The field is a box inside a scrolling document. One finger
 * dragging across it means "pan the graph" to us and "scroll the page" to the
 * browser; two fingers mean "zoom the graph" to us and "zoom the document" to
 * iOS Safari. Whoever is not told to stand down, wins -- and the default is
 * that the browser wins, which is why a hand-rolled graph on a phone feels
 * like fighting the page.
 *
 * SO IT IS SETTLED THREE TIMES OVER, because one is not enough:
 *
 *  1. `touch-action: none` on the stage (CSS). This is the declaration every
 *     engine honours for scroll and for pinch INSIDE the element, and it is
 *     what makes pointer events arrive at all instead of being swallowed by
 *     a scroll gesture.
 *  2. a non-passive `touchmove` listener that calls `preventDefault()`.
 *     React attaches its own touch handlers passively, so an `onTouchMove`
 *     prop cannot cancel anything -- this listener is registered by hand,
 *     with `{ passive: false }`, which is the only way to say no.
 *  3. `gesturestart` / `gesturechange` / `gestureend`, prevented. These are
 *     WebKit-only events that fire for a two-finger pinch on the DOCUMENT,
 *     above and outside the pointer model. Without them iOS Safari zooms the
 *     whole page while the field is being pinched -- the exact failure the
 *     founder named.
 *
 * WHAT IT DOES NOT DO. It never blocks a single-finger gesture that starts
 * outside the stage, so the page still scrolls normally everywhere else, and
 * it never blocks the browser's own accessibility zoom. The capture is
 * bounded to this box.
 *
 * TAP VERSUS TRAVEL. Every node is a real <button>. A drag that begins on one
 * must move the field and must NOT absorb that entity, or travelling would be
 * impossible. `movedRef` is the verdict, written here and read by the node's
 * click handler; the threshold is `SWARM_TAP_SLOP_PX`, the same 8 px the
 * discovery rail already uses for the same decision.
 *
 * COST. No render loop, no React state on move: the pan and the zoom are two
 * CSS custom properties written through a ref at most once per animation
 * frame, exactly like the REV-24 parallax they sit beside. React state changes
 * only when a drag begins or ends, and when the zoom lands.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SWARM_VIEWPORT_IDENTITY,
  SWARM_ZOOM_STEP,
  isIdentity,
  isTap,
  panBy,
  pinchDistance,
  pinchFactor,
  pxToPct,
  zoomBy,
  type SwarmViewport,
} from './viewportMath';

export interface SwarmViewportApi {
  stageRef: React.RefObject<HTMLDivElement>;
  fieldRef: React.RefObject<HTMLDivElement>;
  /** True while a pan or a pinch is in progress (cursor + hit-testing). */
  dragging: boolean;
  /** True once the pointer has travelled past the tap threshold. Read it in
   *  a node's click handler to tell travel from activation. */
  movedRef: React.MutableRefObject<boolean>;
  viewport: SwarmViewport;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  canReset: boolean;
  /** Bind to the stage element. */
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}

interface LivePointer {
  x: number;
  y: number;
}

export function useSwarmViewport(): SwarmViewportApi {
  const stageRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<SwarmViewport>(SWARM_VIEWPORT_IDENTITY);
  const [dragging, setDragging] = useState(false);

  const vpRef = useRef(viewport);
  vpRef.current = viewport;
  const movedRef = useRef(false);
  const pointers = useRef(new Map<number, LivePointer>());
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<SwarmViewport | null>(null);

  /** Write the viewport to CSS custom properties, at most once a frame. */
  const paint = useCallback((next: SwarmViewport) => {
    pendingRef.current = next;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const v = pendingRef.current;
      const el = fieldRef.current;
      if (!v || !el) return;
      el.style.setProperty('--vx', v.x.toFixed(3));
      el.style.setProperty('--vy', v.y.toFixed(3));
      el.style.setProperty('--vz', v.z.toFixed(4));
    });
  }, []);

  const commit = useCallback(
    (next: SwarmViewport) => {
      vpRef.current = next;
      paint(next);
      setViewport(next);
    },
    [paint],
  );

  const zoomIn = useCallback(() => commit(zoomBy(vpRef.current, 1 + SWARM_ZOOM_STEP)), [commit]);
  const zoomOut = useCallback(() => commit(zoomBy(vpRef.current, 1 / (1 + SWARM_ZOOM_STEP))), [commit]);
  const reset = useCallback(() => commit(SWARM_VIEWPORT_IDENTITY), [commit]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // A secondary mouse button is a context menu, not a drag.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      movedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      lastRef.current = { x: e.clientX, y: e.clientY };
      pinchRef.current = null;
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchRef.current = { distance: pinchDistance(a, b), zoom: vpRef.current.z };
      // A second finger means the visitor is zooming, not activating.
      movedRef.current = true;
    }
    // NO `setPointerCapture`. It reads like the right tool and it silently
    // breaks the field: capture retargets every later event for this pointer
    // to the capturing element, so `pointerup` lands on the STAGE and the
    // browser then fires `click` on the stage rather than on the node the
    // finger went down on. Measured -- a plain tap stopped absorbing
    // anything. The window listeners below already follow a pointer that
    // leaves the box, which is the only thing capture was wanted for.
    setDragging(true);
  }, []);

  /**
   * Movement and release live on the WINDOW, not on the element: a finger that
   * leaves the stage mid-drag must keep panning, and a pointer released
   * outside must still end the gesture. Pointer capture usually delivers both,
   * but it is lost whenever the element re-renders under the finger -- which
   * is exactly what an absorption does.
   *
   * THEY ARE BOUND ONCE, NOT WHILE `dragging`. Gating them on state looked
   * tidier and was wrong: the effect that would attach them runs AFTER the
   * render `setDragging(true)` schedules, so a fast click -- pointerdown and
   * pointerup inside the same frame, which is exactly what a test harness and
   * a real tap both produce -- released with no listener bound. The pointer
   * was then never removed from the map, so the NEXT press counted as a
   * second finger, was read as a pinch, and set `movedRef` -- after which no
   * node could ever be absorbed again. Bound unconditionally they are
   * no-ops while the map is empty, and the race cannot exist.
   */
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size >= 2 && pinchRef.current) {
        const [a, b] = Array.from(pointers.current.values());
        const factor = pinchFactor(pinchRef.current.distance, pinchDistance(a, b));
        commit(zoomBy({ ...vpRef.current, z: pinchRef.current.zoom }, factor));
        return;
      }

      const last = lastRef.current;
      const start = startRef.current;
      const stage = stageRef.current;
      if (!last || !start || !stage) return;
      if (!movedRef.current && !isTap(e.clientX - start.x, e.clientY - start.y)) movedRef.current = true;
      if (!movedRef.current) return;

      const box = stage.getBoundingClientRect();
      const next = panBy(
        vpRef.current,
        pxToPct(e.clientX - last.x, box.width, vpRef.current.z),
        pxToPct(e.clientY - last.y, box.height, vpRef.current.z),
      );
      lastRef.current = { x: e.clientX, y: e.clientY };
      commit(next);
    };

    const end = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 1) {
        // One finger lifted off a pinch: continue as a pan from where the
        // survivor is, rather than jumping by the gap between them.
        const [only] = Array.from(pointers.current.values());
        lastRef.current = { x: only.x, y: only.y };
        startRef.current = { x: only.x, y: only.y };
        pinchRef.current = null;
        return;
      }
      if (pointers.current.size > 0) return;
      pinchRef.current = null;
      lastRef.current = null;
      startRef.current = null;
      setDragging(false);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [commit]);

  /**
   * The three refusals. Registered by hand because React's own touch handlers
   * are passive and therefore cannot cancel anything, and because `gesture*`
   * is a WebKit event React does not model at all.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const stopTouch = (e: TouchEvent) => {
      // A two-finger gesture on the field is always ours. A one-finger
      // gesture is ours once it has become a pan -- before that, it may
      // still turn out to be a tap on a node, and cancelling it early would
      // break the button.
      if (e.touches.length > 1 || movedRef.current) e.preventDefault();
    };
    const stopGesture = (e: Event) => e.preventDefault();

    stage.addEventListener('touchmove', stopTouch, { passive: false });
    stage.addEventListener('gesturestart', stopGesture as EventListener);
    stage.addEventListener('gesturechange', stopGesture as EventListener);
    stage.addEventListener('gestureend', stopGesture as EventListener);

    // Desktop: the conventional zoom gesture is ctrl/⌘ + wheel, which the
    // browser would otherwise spend on the whole document. A plain wheel is
    // left alone so the page still scrolls past the field.
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      commit(zoomBy(vpRef.current, e.deltaY < 0 ? 1 + SWARM_ZOOM_STEP : 1 / (1 + SWARM_ZOOM_STEP)));
    };
    stage.addEventListener('wheel', wheel, { passive: false });

    return () => {
      stage.removeEventListener('touchmove', stopTouch);
      stage.removeEventListener('gesturestart', stopGesture as EventListener);
      stage.removeEventListener('gesturechange', stopGesture as EventListener);
      stage.removeEventListener('gestureend', stopGesture as EventListener);
      stage.removeEventListener('wheel', wheel);
    };
  }, [commit]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return {
    stageRef,
    fieldRef,
    dragging,
    movedRef,
    viewport,
    zoomIn,
    zoomOut,
    reset,
    canReset: !isIdentity(viewport),
    onPointerDown,
  };
}
