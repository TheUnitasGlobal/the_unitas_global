'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { useDragScroll } from '@/components/ui/useDragScroll';
import { centeredScrollLeft } from '@/lib/interaction/railDrag';
import { DISCOVERY_ROTATE_MS, type SlotTab } from '@/lib/live/discoverySlots';

/**
 * REV-41 D-6 (founder directive 2026-09-17, mission 1-E) -- the sub-tab
 * rail inside a hub card, wearing the SAME chip as the main slot rail.
 *
 * The new-products families used to render as `.qw-hub-tab` 11.5px pills
 * with no clock; the founder ordered the sub-title box promoted to the
 * main title box's glassmorphism chip, auto-rotating with a colour change,
 * and a click that pins / releases exactly like the main `toggleHold`. So
 * this rail copies DiscoveryCarousel's chip rail markup verbatim
 * (`.qw-hub-strip` › `.qw-hub-chip[data-active]` › `.qw-hub-progress
 * [data-held][data-paused]`, `--qw-hub-accent` = the tab's colour,
 * `--qw-slot-rotate` = the period) and its three behaviours: mouse
 * grab-drag on a native snap scroller (useDragScroll -- pointerdown / up
 * stop here so a drag on the tabs is never read as a card swipe), the
 * active chip kept centred unless the visitor just dragged, and a 700ms
 * touch pause because touch has no hover.
 *
 * Who owns what: the ACTIVE key and the HELD state belong to the parent --
 * this rail only reports. `onPick(key, 'clock')` is the auto-advance
 * (REV-24 M3: the clock never arms `intentRef`, so a stale card is served
 * from memory), `onPick(key, 'intent')` is a click. A click on the active
 * chip calls `onToggleHold(key)`; a click on another chip calls
 * `onPick(key, 'intent')` AND THEN `onToggleHold(key)` when the parent
 * supplied it -- the parent decides whether a pick pins by passing the
 * callback at all (DiscoveryCarousel pins on pick for autoplay rails, the
 * radius rail of the Around-Me card passes nothing and never pins).
 *
 * The clock runs only while `autoplay && !paused && !held` and no touch
 * pause is active; every resume bumps `epoch`, which remounts the
 * progress bar so the bar and the interval start together (the same
 * contract as the main rail). No Date.now() / Math.random() in render.
 *
 * The four-radius rail (D-5) is recognised by its keys and additionally
 * stamps `data-radius={key}` on every chip -- the E2E contract for 1-G
 * counts `[data-radius]` = 4 -- while every chip always carries
 * `data-tab={key}`.
 */
export interface SlotTabRailProps {
  tabs: readonly SlotTab[];
  activeKey: string | undefined;
  /** intent = a click, clock = the auto-advance. */
  onPick: (key: string, source: 'intent' | 'clock') => void;
  autoplay?: boolean;
  /** The parent card is not the active slot / its rotation stands still. */
  paused?: boolean;
  /** Pinned -- owned by the parent. */
  held?: boolean;
  onToggleHold?: (key: string) => void;
  ariaLabel: string;
  rotateMs?: number;
  className?: string;
  'data-testid'?: string;
}

/** The Around-Me radius keys (SPEC D-5 `NEARBY_RADII`); kept local so this
 *  primitive never imports the data lane's module. */
const RADIUS_KEYS: readonly string[] = ['r10', 'r50', 'r100', 'global'];

/** §1.4: touch has no hover -- a tap pauses, the clock resumes 700ms after
 *  the LAST touch (the same window as HUB_TOUCH_PAUSE_MS on the card). */
const TAB_TOUCH_PAUSE_MS = 700;

/** True for the nearby card's radius rail: every key is one of the four
 *  radii (an empty rail is not a radius rail). */
export function isRadiusRail(tabs: readonly SlotTab[]): boolean {
  return tabs.length > 0 && tabs.every((tab) => RADIUS_KEYS.includes(tab.key));
}

/** The tab the clock advances to: the one after `activeKey` in rail order,
 *  wrapping; the first when nothing is active or the key is unknown. */
export function nextTabKey(tabs: readonly SlotTab[], activeKey: string | undefined): string | undefined {
  if (tabs.length === 0) return undefined;
  const index = tabs.findIndex((tab) => tab.key === activeKey);
  return tabs[(index + 1) % tabs.length].key;
}

export function SlotTabRail({
  tabs,
  activeKey,
  onPick,
  autoplay = false,
  paused = false,
  held = false,
  onToggleHold,
  ariaLabel,
  rotateMs = DISCOVERY_ROTATE_MS,
  className = '',
  'data-testid': testId,
}: SlotTabRailProps) {
  const t = useTranslations();
  const tTabs = useTranslations('Rev41.tabs');
  const { playHoverSfx } = useSpatialAudio();

  const railRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const { handlers, recentlyDragged } = useDragScroll(railRef);

  const [touchPaused, setTouchPaused] = useState(false);
  const touchResumeRef = useRef<number | null>(null);
  /** Counts clock steps; keyed into the progress bar so it restarts with
   *  every period even when the parent keeps the same key (a one-tab rail). */
  const [tick, setTick] = useState(0);
  /** Bumped on every resume so the bar remounts with the interval. */
  const [epoch, setEpoch] = useState(0);

  const isRadius = isRadiusRail(tabs);
  const stalled = paused || touchPaused;
  const clockRunning = autoplay && !held && !stalled;

  // The interval reads the latest tabs / key / callback without restarting
  // on every render: the same ref pattern useDragScroll uses for options.
  const stepRef = useRef<() => void>(() => {});
  stepRef.current = () => {
    const next = nextTabKey(tabs, activeKey);
    if (next === undefined) return;
    setTick((n) => n + 1);
    onPick(next, 'clock');
  };

  const pauseForTouch = useCallback(() => {
    setTouchPaused(true);
    if (touchResumeRef.current !== null) window.clearTimeout(touchResumeRef.current);
    touchResumeRef.current = window.setTimeout(() => {
      touchResumeRef.current = null;
      setTouchPaused(false);
    }, TAB_TOUCH_PAUSE_MS);
  }, []);

  useEffect(
    () => () => {
      if (touchResumeRef.current !== null) window.clearTimeout(touchResumeRef.current);
    },
    [],
  );

  // Advance one tab every `rotateMs` while nothing pauses the clock. A
  // resume restarts the full period AND bumps `epoch` (bar remount).
  useEffect(() => {
    if (!clockRunning) return;
    setEpoch((n) => n + 1);
    const id = window.setInterval(() => stepRef.current(), rotateMs);
    return () => window.clearInterval(id);
  }, [clockRunning, rotateMs]);

  // Keep the active chip centred (16 families overflow a card). Scrolling
  // the rail itself -- never scrollIntoView -- guarantees the page never
  // moves. `offsetLeft` is measured from the offsetParent, which is the
  // card (`contain: layout`), so the rail's own offset is subtracted.
  useEffect(() => {
    if (activeKey === undefined) return;
    const el = chipRefs.current.get(activeKey);
    const scroller = railRef.current;
    if (!el || !scroller || recentlyDragged()) return;
    const itemLeft = el.offsetLeft - (el.offsetParent === scroller ? 0 : scroller.offsetLeft);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({
      left: centeredScrollLeft(itemLeft, el.offsetWidth, scroller.clientWidth),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activeKey, recentlyDragged]);

  const chipTitle = autoplay ? (held ? tTabs('held') : tTabs('rotating')) : undefined;

  return (
    <div
      ref={railRef}
      className={`qw-hub-strip qw-hub-tabs u-hscroll select-none ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
      data-tab-rail=""
      data-autoplay={autoplay ? '1' : '0'}
      data-testid={testId}
      onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (e.pointerType !== 'mouse') pauseForTouch();
        handlers.onPointerDown(e);
      }}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={(e: ReactPointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        handlers.onPointerUp(e);
      }}
      onPointerCancel={handlers.onPointerCancel}
      onClickCapture={handlers.onClickCapture}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              if (el) chipRefs.current.set(tab.key, el);
              else chipRefs.current.delete(tab.key);
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-active={isActive ? '1' : '0'}
            data-tab={tab.key}
            {...(isRadius ? { 'data-radius': tab.key } : null)}
            className="qw-hub-chip"
            title={chipTitle}
            style={{ '--qw-hub-accent': tab.color, '--qw-slot-rotate': `${rotateMs}ms` } as CSSProperties}
            onMouseEnter={() => playHoverSfx()}
            onClick={(e) => {
              e.stopPropagation();
              if (isActive) {
                onToggleHold?.(tab.key);
                return;
              }
              onPick(tab.key, 'intent');
              onToggleHold?.(tab.key);
            }}
          >
            {t(tab.labelKey)}
            {/* Without a clock there is nothing to fill: the bar of a
                non-autoplay rail stays parked (paused at 0) instead of
                animating a lie. */}
            {isActive && (
              <span
                key={`${tab.key}-${tick}-${epoch}`}
                className="qw-hub-progress"
                data-held={held ? '1' : '0'}
                data-paused={!autoplay || (stalled && !held) ? '1' : '0'}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
