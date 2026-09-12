'use client';

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { CENTER_SUPPRESS_MS, DRAG_THRESHOLD_PX, dragScrollLeft, isClickSuppressed } from '@/lib/interaction/railDrag';

export interface DragScrollOptions {
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export interface DragScrollHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  onClickCapture: (e: ReactMouseEvent<HTMLElement>) => void;
}

/**
 * REV-21 §1.2 -- mouse grab-drag for a native horizontal scroller (touch
 * keeps the browser's own swipe + momentum; only `pointerType === 'mouse'`
 * is handled). Extracted from the retired DraggableCarouselRow marquee:
 *
 *  - the drag only starts after DRAG_THRESHOLD_PX so a plain click on a tile
 *    is never eaten, and pointer capture is deferred to that moment (capturing
 *    on pointerdown would retarget the eventual `click` to the container);
 *  - scrollLeft writes are batched into one rAF per frame (60fps, no layout
 *    thrash from writing on every pointermove);
 *  - a click that lands within CLICK_SUPPRESS_MS of a drag's end is swallowed;
 *  - `data-dragging="1"` is stamped on the element while dragging (CSS hook);
 *  - `recentlyDragged()` lets the owner hold off auto-centering for a moment.
 */
export function useDragScroll<T extends HTMLElement>(ref: React.RefObject<T>, options: DragScrollOptions = {}) {
  const downRef = useRef(false);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startScrollRef = useRef(0);
  const pendingXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragEndedAtRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const flush = useCallback(() => {
    rafRef.current = null;
    const el = ref.current;
    const x = pendingXRef.current;
    if (!el || x === null) return;
    el.scrollLeft = dragScrollLeft(startScrollRef.current, startXRef.current, x);
  }, [ref]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const end = useCallback(() => {
    if (!downRef.current) return;
    const el = ref.current;
    if (draggingRef.current) {
      dragEndedAtRef.current = Date.now();
      el?.removeAttribute('data-dragging');
      optionsRef.current.onDragEnd?.();
    }
    if (el && pointerIdRef.current !== null) {
      try {
        el.releasePointerCapture(pointerIdRef.current);
      } catch {
        // capture may already be gone
      }
    }
    downRef.current = false;
    draggingRef.current = false;
    pointerIdRef.current = null;
  }, [ref]);

  const handlers: DragScrollHandlers = {
    onPointerDown: (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const el = ref.current;
      if (!el) return;
      downRef.current = true;
      draggingRef.current = false;
      pointerIdRef.current = e.pointerId;
      startXRef.current = e.clientX;
      startScrollRef.current = el.scrollLeft;
    },
    onPointerMove: (e) => {
      if (!downRef.current || e.pointerType !== 'mouse') return;
      const el = ref.current;
      if (!el) return;
      if (!draggingRef.current) {
        if (Math.abs(e.clientX - startXRef.current) <= DRAG_THRESHOLD_PX) return;
        draggingRef.current = true;
        el.setAttribute('data-dragging', '1');
        if (pointerIdRef.current !== null) {
          try {
            el.setPointerCapture(pointerIdRef.current);
          } catch {
            // unsupported -- dragging still works while the pointer stays inside
          }
        }
        optionsRef.current.onDragStart?.();
      }
      pendingXRef.current = e.clientX;
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(flush);
    },
    onPointerUp: end,
    onPointerCancel: end,
    onClickCapture: (e) => {
      if (isClickSuppressed(dragEndedAtRef.current, Date.now())) {
        e.stopPropagation();
        e.preventDefault();
        dragEndedAtRef.current = null;
      }
    },
  };

  const recentlyDragged = useCallback(
    () => draggingRef.current || (dragEndedAtRef.current !== null && Date.now() - dragEndedAtRef.current < CENTER_SUPPRESS_MS),
    [],
  );

  return { handlers, recentlyDragged };
}
