'use client';

import { useRef } from 'react';
import { useDragScroll } from '@/components/ui/useDragScroll';

export interface CarouselItem {
  id: string;
  render: () => React.ReactNode;
}

interface DraggableCarouselRowProps {
  items: CarouselItem[];
  className?: string;
  /** Retired (REV-21 §1.2 / PERF-04): the idle marquee drift is gone. Kept
   *  so existing call sites compile; ignored. */
  speed?: number;
}

/**
 * A single-row native horizontal scroller with mouse grab-drag (touch keeps
 * the browser's own swipe/momentum), scroll-snap and every tile clickable --
 * a mouse drag past a few px suppresses the click that would otherwise
 * follow it, so dragging never misfires as a tap.
 *
 * REV-21 §1.2 / PERF-04: the REV-19 marquee (a per-instance infinite rAF
 * loop writing scrollLeft every frame over doubled content, four instances
 * on the home) is retired. What remains is GPU-friendly: native scrolling,
 * one rAF per pointer frame while dragging, and no duplicate DOM.
 */
export function DraggableCarouselRow({ items, className = '' }: DraggableCarouselRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { handlers } = useDragScroll(scrollRef);

  return (
    <div
      ref={scrollRef}
      {...handlers}
      className={`u-hscroll flex flex-nowrap gap-2.5 cursor-grab select-none active:cursor-grabbing ${className}`}
    >
      {items.map((item) => (
        <div key={item.id} className="shrink-0 snap-start">
          {item.render()}
        </div>
      ))}
    </div>
  );
}
