'use client';

import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { CLICK_SUPPRESS_MS, classifyGesture, stepForSwipe } from '@/lib/interaction/railDrag';

/**
 * REV-21 §1.2 -- a left/right swipe on the active discovery card advances
 * or rewinds the carousel. Pointer events (mouse AND touch); a vertical-
 * dominant travel is left to the page scroll (`touch-action: pan-y` on the
 * card). A completed swipe swallows the `click` that follows it so the
 * card's own whole-surface hitbox (§1.5) never opens the deep modal on a
 * swipe. Feeds the pure classifier in lib/interaction/railDrag.ts.
 */
export function useHorizontalSwipe(onStep: (step: -1 | 1) => void) {
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const swipedAtRef = useRef<number | null>(null);

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }

  function finish(e: ReactPointerEvent<HTMLElement>) {
    const start = startRef.current;
    startRef.current = null;
    if (!start || start.id !== e.pointerId) return;
    const step = stepForSwipe(classifyGesture(e.clientX - start.x, e.clientY - start.y));
    if (step === 0) return;
    swipedAtRef.current = Date.now();
    onStep(step);
  }

  function onClickCapture(e: ReactMouseEvent<HTMLElement>) {
    if (swipedAtRef.current !== null && Date.now() - swipedAtRef.current < CLICK_SUPPRESS_MS) {
      e.stopPropagation();
      e.preventDefault();
      swipedAtRef.current = null;
    }
  }

  return {
    onPointerDown,
    onPointerUp: finish,
    onPointerCancel: () => {
      startRef.current = null;
    },
    onClickCapture,
  };
}
