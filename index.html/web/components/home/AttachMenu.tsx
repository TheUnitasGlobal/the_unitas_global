'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Paperclip, PenTool, Video } from 'lucide-react';

/**
 * REV-21 §5A / SPEC §5.1 + §12.6 -- the unified action box's ATTACH half:
 * one split-button toggle beside the ⏎ key that opens the three shortcuts
 * (file / video / sketch). The three icons roll through the toggle as a
 * DISPLAY-ONLY animation (2.4 s per step); the toggle never changes what a
 * click does. Under `prefers-reduced-motion` or on hover-less (touch)
 * devices the roll is replaced by a static three-icon stack, so every
 * attach path stays discoverable (the "only one icon visible" defect).
 *
 * REV-23 M5 (founder directive 2026-09-13): the below-768px BOTTOM SHEET is
 * retired. It read as "yet another popup" -- a surface that flew up from the
 * screen edge, carried its own title bar and close button, and had to be
 * dismissed. What the founder asked for is a plain, immediate dropdown that
 * you pick from: so the menu is now the SAME anchored dropdown at every
 * width, opening in 140 ms directly under the toggle, with no sheet
 * chrome and no VisualViewport choreography. The sheet head, the close
 * button and the `sheetTitle` / `close` labels are gone with it.
 *
 * Every control uses `onMouseDown preventDefault` so the search input keeps
 * focus and the typing dropdown never collapses; the file / video items call
 * their hidden `<input type=file>` synchronously inside the click (iOS
 * gesture stack). Not a history layer (non-modal).
 */

export interface AttachMenuLabels {
  toggle: string;
  file: string;
  video: string;
  sketch: string;
}

export interface AttachMenuProps {
  /** Attached items (text + visual) -- shown as a badge on the toggle. */
  count: number;
  labels: AttachMenuLabels;
  onFile: () => void;
  onVideo: () => void;
  onSketch: () => void;
  onHover?: () => void;
}

const ROLL_ICONS = [Paperclip, Video, PenTool] as const;

export function AttachMenu({ count, labels, onFile, onVideo, onSketch, onHover }: AttachMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);

  // Outside pointerdown + Escape close the menu; nothing else does.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, close]);

  // Focus the first item when the menu opens (keyboard path).
  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus({ preventScroll: true });
  }, [open]);

  function onMenuKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = index;
    if (e.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (e.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else next = items.length - 1;
    items[next]?.focus({ preventScroll: true });
  }

  function pick(action: () => void) {
    return () => {
      // The hidden file inputs must be clicked INSIDE this gesture.
      action();
      close();
    };
  }

  const items = [
    { key: 'file', label: labels.file, Icon: Paperclip, action: onFile },
    { key: 'video', label: labels.video, Icon: Video, action: onVideo },
    { key: 'sketch', label: labels.sketch, Icon: PenTool, action: onSketch },
  ] as const;

  return (
    <div ref={rootRef} className="qw-attach relative shrink-0" data-attach-open={open ? '1' : '0'}>
      <button
        type="button"
        className="qw-attach-toggle relative flex h-8 w-8 items-center justify-center border border-accent/40 text-accent transition-colors hover:bg-accent/10 sm:h-[38px] sm:w-[38px]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={labels.toggle}
        title={labels.toggle}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => onHover?.()}
        onClick={() => setOpen((v) => !v)}
        data-attach-toggle=""
      >
        <span className="qw-attach-roll" aria-hidden="true">
          <span className="qw-attach-roll-track">
            {ROLL_ICONS.map((Icon, i) => (
              <Icon key={i} size={18} className="qw-attach-roll-icon" />
            ))}
            {/* duplicate of the first icon: the loop wraps without a jump */}
            <Paperclip size={18} className="qw-attach-roll-icon" />
          </span>
        </span>
        <span className="qw-attach-badge" data-attach-badge="" hidden={count === 0} aria-live="polite">
          {count}
        </span>
      </button>

      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label={labels.toggle}
        hidden={!open}
        className="qw-attach-menu"
        onMouseDown={(e) => e.preventDefault()}
        onKeyDown={onMenuKeyDown}
        data-attach-menu=""
      >
        {items.map(({ key, label, Icon, action }) => (
          <button
            key={key}
            type="button"
            role="menuitem"
            className="qw-attach-item"
            data-attach-item={key}
            onMouseEnter={() => onHover?.()}
            onClick={pick(action)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
