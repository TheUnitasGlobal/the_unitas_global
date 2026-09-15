'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Paperclip, PenTool, Video } from 'lucide-react';

/**
 * REV-21 §5A / SPEC §5.1 + §12.6 -- the unified action box's ATTACH half:
 * one split-button toggle beside the ⏎ key that opens the three shortcuts
 * (file / video / sketch). The three icons roll through the toggle as a
 * DISPLAY-ONLY animation (2.4 s per step); the toggle never changes what a
 * click does.
 *
 * REV-23 M5: the below-768px bottom sheet is retired -- the menu is the
 * SAME anchored dropdown at every width, opening in 140 ms directly under
 * the toggle.
 *
 * REV-29 MISSION 5 (founder directive 2026-09-15):
 *  - the three menu icons sit in identical 20px boxes and the video glyph
 *    is scaled up to the same optical weight as the clip and the pen;
 *  - every label is a SHORT one-line string (`Rev29.attach.*`) rendered
 *    `white-space: nowrap` -- the long capture hints stay as `title` /
 *    `aria-label`, so no locale ever wraps the row and the text is never
 *    shrunk;
 *  - `active`: the shortcut the visitor picked. The roll STOPS on that icon
 *    and the toggle wears the same strong armed fill the ⏎ key wears while
 *    a query is typed, until the attachment is removed;
 *  - the roll runs one icon at a time on EVERY device -- the touch /
 *    reduced-motion static 2x2 stack is gone (globals.css).
 *
 * Every control uses `onMouseDown preventDefault` so the search input keeps
 * focus and the typing dropdown never collapses; the file / video items call
 * their hidden `<input type=file>` synchronously inside the click (iOS
 * gesture stack). Not a history layer (non-modal).
 */

export type AttachKind = 'file' | 'video' | 'sketch';

export interface AttachMenuLabels {
  toggle: string;
  file: string;
  video: string;
  sketch: string;
}

export interface AttachMenuProps {
  /** Attached items (text + visual) -- shown as a badge on the toggle. */
  count: number;
  /** Short one-line labels (rendered text). */
  labels: AttachMenuLabels;
  /** Long hints (title / aria-label); default to the labels. */
  titles?: Partial<Record<AttachKind, string>>;
  /** The picked shortcut -- stops the roll on it and arms the toggle. */
  active: AttachKind | null;
  onPick: (kind: AttachKind) => void;
  onFile: () => void;
  onVideo: () => void;
  onSketch: () => void;
  onHover?: () => void;
}

const ROLL: ReadonlyArray<{ key: AttachKind; Icon: typeof Paperclip }> = [
  { key: 'file', Icon: Paperclip },
  { key: 'video', Icon: Video },
  { key: 'sketch', Icon: PenTool },
];

export function AttachMenu({ count, labels, titles, active, onPick, onFile, onVideo, onSketch, onHover }: AttachMenuProps) {
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

  function pick(kind: AttachKind, action: () => void) {
    return () => {
      // The pick is the visitor's stated intent: the roll stops on this icon
      // and the toggle arms, before the (possibly cancelled) picker opens.
      onPick(kind);
      // The hidden file inputs must be clicked INSIDE this gesture.
      action();
      close();
    };
  }

  const items = [
    { key: 'file' as const, label: labels.file, Icon: Paperclip, action: onFile },
    { key: 'video' as const, label: labels.video, Icon: Video, action: onVideo },
    { key: 'sketch' as const, label: labels.sketch, Icon: PenTool, action: onSketch },
  ];

  const activeIndex = active ? ROLL.findIndex((r) => r.key === active) : -1;

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
        data-active={active ? '1' : '0'}
        data-attach-active={active ?? undefined}
      >
        <span className="qw-attach-roll" aria-hidden="true">
          <span
            className="qw-attach-roll-track"
            data-stop={activeIndex >= 0 ? '1' : '0'}
            style={activeIndex >= 0 ? ({ '--qw-roll-index': activeIndex } as React.CSSProperties) : undefined}
          >
            {ROLL.map(({ key, Icon }) => (
              <span key={key} className="qw-attach-roll-icon" data-icon={key}>
                <Icon size={18} />
              </span>
            ))}
            {/* duplicate of the first icon: the loop wraps without a jump */}
            <span className="qw-attach-roll-icon" data-icon="file">
              <Paperclip size={18} />
            </span>
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
            data-active={active === key ? '1' : '0'}
            title={titles?.[key] ?? label}
            aria-label={titles?.[key] ?? label}
            onMouseEnter={() => onHover?.()}
            onClick={pick(key, action)}
          >
            <span className="qw-attach-item-icon" data-icon={key} aria-hidden="true">
              <Icon size={18} />
            </span>
            <span className="qw-attach-item-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
