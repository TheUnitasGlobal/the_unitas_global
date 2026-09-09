'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';

type HintKind = 'info' | 'warn';

interface InfoHintProps {
  /** 'info' -> circled "?", 'warn' -> circled "!". */
  kind?: HintKind;
  /** Accessible name for the trigger, e.g. the feature's label. */
  label: string;
  /** Card heading (usually the feature name). */
  title: string;
  /** What the feature is. */
  description: string;
  /** How to use it. */
  howto: string;
  /** What to watch out for. */
  caution: string;
  /** i18n: aria label prefix, e.g. "도움말: ". */
  ariaHintPrefix: string;
  /** i18n: labels for the three card sections. */
  sectionLabels: { description: string; howto: string; caution: string };
  className?: string;
}

const CARD_MAX_WIDTH = 300;
const VIEWPORT_MARGIN = 12;
const GAP = 10;

interface Coords {
  top: number;
  left: number;
  width: number;
  placement: 'top' | 'bottom';
  arrowLeft: number;
}

/**
 * A `[?]` / `[!]` indicator that reveals a context card with the feature's
 * description, usage, and cautions.
 *
 * - PC (mouse / trackpad): opens on hover and keyboard focus.
 * - Touch (mobile / tablet): tap toggles it "pinned" open; a tap elsewhere,
 *   Esc, or scrolling it out of view closes it.
 * - The card is portaled to `document.body` (above the z-[200] modal layer) and
 *   its position is clamped every frame to the viewport, so it is never clipped
 *   at a screen edge and it survives scrolling inside a tall dialog.
 */
export function InfoHint({
  kind = 'info',
  label,
  title,
  description,
  howto,
  caution,
  ariaHintPrefix,
  sectionLabels,
  className,
}: InfoHintProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardId = useId();

  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);

  const openReason = hovered || focused || pinned;

  useEffect(() => {
    setMounted(true);
  }, []);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width = Math.min(CARD_MAX_WIDTH, vw - VIEWPORT_MARGIN * 2);
    const cardHeight = cardRef.current?.offsetHeight ?? 220;

    const spaceBelow = vh - rect.bottom;
    const placement: 'top' | 'bottom' =
      spaceBelow < cardHeight + GAP + VIEWPORT_MARGIN && rect.top > spaceBelow ? 'top' : 'bottom';

    const top =
      placement === 'bottom'
        ? Math.min(rect.bottom + GAP, vh - VIEWPORT_MARGIN - cardHeight)
        : Math.max(VIEWPORT_MARGIN, rect.top - GAP - cardHeight);

    const triggerCenter = rect.left + rect.width / 2;
    const rawLeft = triggerCenter - width / 2;
    const left = Math.min(Math.max(rawLeft, VIEWPORT_MARGIN), vw - VIEWPORT_MARGIN - width);
    const arrowLeft = Math.min(Math.max(triggerCenter - left, 16), width - 16);

    setCoords({ top, left, width, placement, arrowLeft });
  }, []);

  useEffect(() => {
    if (!openReason) {
      setCoords(null);
      return;
    }
    reposition();
    // A second pass once the card has real height.
    const raf = requestAnimationFrame(reposition);
    return () => cancelAnimationFrame(raf);
  }, [openReason, reposition]);

  useEffect(() => {
    if (!openReason) return;

    const onScrollOrResize = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const offscreen = rect.bottom < 0 || rect.top > window.innerHeight;
      if (offscreen) {
        setHovered(false);
        setFocused(false);
        setPinned(false);
        return;
      }
      reposition();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHovered(false);
        setFocused(false);
        setPinned(false);
      }
    };

    const onPointerDownAway = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        triggerRef.current?.contains(target) ||
        cardRef.current?.contains(target)
      ) {
        return;
      }
      setPinned(false);
      setHovered(false);
    };

    window.addEventListener('scroll', onScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDownAway, true);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDownAway, true);
    };
  }, [openReason, reposition]);

  const handlePointerEnter = (e: ReactPointerEvent) => {
    if (e.pointerType === 'touch') return;
    setHovered(true);
  };
  const handlePointerLeave = (e: ReactPointerEvent) => {
    if (e.pointerType === 'touch') return;
    setHovered(false);
  };
  const handleClick = () => {
    setPinned((prev) => !prev);
  };

  const glyph = kind === 'warn' ? '!' : '?';
  const tone =
    kind === 'warn'
      ? 'border-amber-400/60 text-amber-300 hover:border-amber-300 hover:text-amber-200'
      : 'border-neon/50 text-neon hover:border-neon hover:text-white';

  const card =
    mounted && openReason && coords
      ? createPortal(
          <div
            ref={cardRef}
            id={cardId}
            role="tooltip"
            className="fixed z-[320] border border-accent/30 bg-quantum/98 p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur-md"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
          >
            <span
              aria-hidden="true"
              className="absolute h-2.5 w-2.5 rotate-45 border-accent/30 bg-quantum/98"
              style={{
                left: coords.arrowLeft - 5,
                ...(coords.placement === 'bottom'
                  ? { top: -6, borderLeft: '1px solid', borderTop: '1px solid' }
                  : { bottom: -6, borderRight: '1px solid', borderBottom: '1px solid' }),
              }}
            />
            <p className="mb-2 font-serif text-xs font-bold uppercase tracking-[0.15em] text-accent">
              {title}
            </p>
            <dl className="space-y-2.5 text-[11px] leading-relaxed">
              <div>
                <dt className="font-bold uppercase tracking-widest text-gray-500">
                  {sectionLabels.description}
                </dt>
                <dd className="mt-0.5 text-gray-300">{description}</dd>
              </div>
              <div>
                <dt className="font-bold uppercase tracking-widest text-gray-500">
                  {sectionLabels.howto}
                </dt>
                <dd className="mt-0.5 text-gray-300">{howto}</dd>
              </div>
              <div>
                <dt className="font-bold uppercase tracking-widest text-amber-400/80">
                  {sectionLabels.caution}
                </dt>
                <dd className="mt-0.5 text-amber-200/90">{caution}</dd>
              </div>
            </dl>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${ariaHintPrefix}${label}`}
        aria-expanded={openReason}
        aria-describedby={openReason ? cardId : undefined}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={handleClick}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border align-middle text-[10px] font-bold leading-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${tone} ${className ?? ''}`}
      >
        {glyph}
      </button>
      {card}
    </>
  );
}
