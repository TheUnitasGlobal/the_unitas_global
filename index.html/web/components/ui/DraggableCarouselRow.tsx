'use client';

import { useCallback, useEffect, useRef } from 'react';

export interface CarouselItem {
  id: string;
  render: () => React.ReactNode;
}

interface DraggableCarouselRowProps {
  items: CarouselItem[];
  className?: string;
  /** Idle auto-scroll drift speed in px/sec. */
  speed?: number;
}

/**
 * A single-row strip that idly drifts (marquee-style) while staying fully
 * manual-overridable: mouse pointers get a custom grab-drag (native browsers
 * don't pan a horizontal scroller via plain click-drag), touch keeps native
 * swipe/momentum scrolling untouched, and every tile inside stays clickable
 * -- a mouse drag past a few px suppresses the click that would otherwise
 * follow it, so dragging never misfires as a tap (owner instruction
 * 2026-09-04 round 4: "1행 회전형 정렬" for the shortcut strip and both
 * ranking widgets). Content renders twice back-to-back so the drift can
 * reset seamlessly at the halfway point instead of jump-cutting at the end.
 */
export function DraggableCarouselRow({ items, className = '', speed = 26 }: DraggableCarouselRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const halfWidthRef = useRef(0);
  const pausedRef = useRef(false);
  const downRef = useRef(false);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const dragDistanceRef = useRef(0);
  const suppressClickRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    if (scrollRef.current) halfWidthRef.current = scrollRef.current.scrollWidth / 2;
  }, []);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, items.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    function tick(ts: number) {
      const half = halfWidthRef.current;
      if (!pausedRef.current && !draggingRef.current && half > 0 && el!.clientWidth < half) {
        const last = lastTsRef.current ?? ts;
        const dt = Math.min((ts - last) / 1000, 0.1);
        el!.scrollLeft += speed * dt;
        if (el!.scrollLeft >= half) el!.scrollLeft -= half;
      }
      lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [speed]);

  function resumeSoon() {
    if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, 700);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    pausedRef.current = true;
    if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
    if (e.pointerType !== 'mouse') return; // touch keeps native swipe/momentum scrolling
    const el = scrollRef.current;
    if (!el) return;
    // Capturing the pointer here (before any movement) would retarget the
    // eventual "click" event from the tapped button to this container,
    // silently breaking every plain click -- so capture is deferred to
    // onPointerMove, only once real drag distance is confirmed.
    downRef.current = true;
    draggingRef.current = false;
    pointerIdRef.current = e.pointerId;
    dragDistanceRef.current = 0;
    dragStartXRef.current = e.clientX;
    dragStartScrollRef.current = el.scrollLeft;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!downRef.current || e.pointerType !== 'mouse') return;
    const el = scrollRef.current;
    if (!el) return;
    const delta = e.clientX - dragStartXRef.current;
    dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(delta));
    if (!draggingRef.current && dragDistanceRef.current > 5) {
      draggingRef.current = true;
      if (pointerIdRef.current !== null) el.setPointerCapture(pointerIdRef.current);
    }
    if (draggingRef.current) el.scrollLeft = dragStartScrollRef.current - delta;
  }

  function endDrag() {
    if (draggingRef.current) suppressClickRef.current = true;
    downRef.current = false;
    draggingRef.current = false;
    resumeSoon();
  }

  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (suppressClickRef.current) {
      e.stopPropagation();
      e.preventDefault();
      suppressClickRef.current = false;
    }
  }

  return (
    <div
      ref={scrollRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        if (!draggingRef.current) resumeSoon();
      }}
      onClickCapture={onClickCapture}
      className={`flex flex-nowrap gap-2.5 overflow-x-auto cursor-grab select-none active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {items.map((item) => (
        <div key={item.id} className="shrink-0">
          {item.render()}
        </div>
      ))}
      {items.map((item) => (
        <div key={`${item.id}__dup`} className="shrink-0" aria-hidden="true">
          {item.render()}
        </div>
      ))}
    </div>
  );
}
