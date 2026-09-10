'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { buildInvisibleMark } from '@/lib/quantumWhite/watermark';
import {
  DEVTOOLS_POLL_MS,
  REVEAL_MS,
  blurIsCapture,
  classifyContextTarget,
  classifyKeyGesture,
  devtoolsDocked,
  selectionIsHarvest,
  withOwnershipTrailer,
  type CaptureKind,
} from '@/lib/quantumWhite/antiPiracy';
import { useCurtainReleased } from './useCurtainReleased';

/** Build fingerprint embedded in the invisible mark (spec §3, watermark.ts). */
const BUILD_FINGERPRINT = process.env.NEXT_PUBLIC_UNITAS_BUILD_FINGERPRINT ?? 'rev13';

/** Debounce for the drag-selection probe (ms) -- a selection is judged once
 *  the pointer settles, not on every caret move. */
const SELECTION_SETTLE_MS = 160;
/** The console probe is re-armed at most this often after it fires. */
const CONSOLE_PROBE_REARM_MS = 10_000;

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(el.isContentEditable);
}

/**
 * REV-13 ownership mark (spec §3, §10.10): a quiet, fixed bottom-right
 * "THE UNITAS GLOBAL OÜ" label rendered through `ModalPortal` at z-390 --
 * below the pre-launch curtain (z-400), so it only becomes visible once
 * `useCurtainReleased()` flips true, and above everything else on the
 * released home. Also carries the invisible zero-width ownership mark
 * (`lib/quantumWhite/watermark.ts`) in an `aria-hidden` span here, and
 * appends the same mark to the hero title's text node so any copy/paste of
 * either surface carries a traceable build fingerprint.
 *
 * REV-19 §6 (anti-piracy, multi-layer): at rest the label is barely there
 * (opacity .07, quantum-white-rev19.css §16). It flares to full visibility
 * -- and the full-page DIAGONAL mark flashes on screen with it -- for
 * `REVEAL_MS` after any of the acts that precede or constitute a capture:
 *
 *   print (Ctrl/Cmd+P, `beforeprint`) · screenshot chords (PrintScreen,
 *   Win+Shift+S, Cmd+Shift+3/4/5/6) and the focus loss that follows them ·
 *   save-page (Ctrl/Cmd+S) · copy / cut (the clipboard also receives the
 *   ownership trailer) · ANY context menu (image targets and plain text
 *   alike -- the menu is never suppressed) · a drag-selection of a real run
 *   of text or Ctrl/Cmd+A · text / images dragged out of the page (the drag
 *   payload carries the trailer) · developer tools: F12, Ctrl+Shift+I/J/C,
 *   Cmd+Opt+I/J/C/U, Ctrl/Cmd+U, a docked panel (viewport shrinking inside
 *   the window) or the console formatting the probe element.
 *
 * A print also paints the diagonal mark (`.qw-print-mark`, @media print).
 * Every trigger is classified by the pure lib/quantumWhite/antiPiracy.ts
 * helpers. Nothing here blocks the visitor.
 */
export function SovereignWatermark() {
  const t = useTranslations('QuantumWhite');
  const tRev = useTranslations('Rev19.watermark');
  const released = useCurtainReleased();
  const appendedRef = useRef(false);
  const invisibleMark = buildInvisibleMark(BUILD_FINGERPRINT);
  const [revealKind, setRevealKind] = useState<CaptureKind | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const lastCaptureKeyRef = useRef<number | null>(null);
  const trailerRef = useRef('');
  trailerRef.current = `${tRev('copyTrailer')} ${invisibleMark}`;
  const noticeRef = useRef('');
  noticeRef.current = tRev('consoleNotice');

  useEffect(() => {
    if (!released || appendedRef.current) return;
    try {
      document.documentElement.style.setProperty('--u-sig', `"${invisibleMark}"`);
      const heroTitle = document.querySelector('.qw-hero-wrap h1');
      if (heroTitle && !(heroTitle.textContent ?? '').includes(invisibleMark)) {
        // REV-19 §2: inside its own zero-letter-spacing span so the mark can
        // never widen the title's fit-content box (Hero.tsx).
        const mark = document.createElement('span');
        mark.className = 'qw-title-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = invisibleMark;
        heroTitle.appendChild(mark);
      }
      appendedRef.current = true;
    } catch {
      // Decorative only -- never let a DOM quirk trip the home.
    }
  }, [released, invisibleMark]);

  // --- REV-19 §6: capture / copy / print / context / select / drag / devtools reveal
  useEffect(() => {
    if (!released) return;

    const reveal = (kind: CaptureKind) => {
      setRevealKind(kind);
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = window.setTimeout(() => {
        revealTimerRef.current = null;
        setRevealKind(null);
      }, REVEAL_MS);
    };

    // -- keyboard chords ---------------------------------------------------
    const onKeyDown = (e: KeyboardEvent) => {
      const kind = classifyKeyGesture(e);
      if (!kind) return;
      // select-all inside a field is the visitor editing their own text
      if (kind === 'select' && isEditable(e.target)) return;
      if (kind === 'capture') lastCaptureKeyRef.current = Date.now();
      reveal(kind);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      // PrintScreen only reports on keyup in several browsers.
      if (classifyKeyGesture(e) === 'capture') {
        lastCaptureKeyRef.current = Date.now();
        reveal('capture');
      }
    };
    const onBlur = () => {
      if (blurIsCapture(lastCaptureKeyRef.current, Date.now())) reveal('capture');
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && blurIsCapture(lastCaptureKeyRef.current, Date.now())) reveal('capture');
    };

    // -- clipboard / drag payloads ------------------------------------------
    const onCopy = (e: ClipboardEvent) => {
      reveal('copy');
      try {
        const selection = window.getSelection()?.toString() ?? '';
        const text = withOwnershipTrailer(selection, trailerRef.current);
        if (text && e.clipboardData) {
          e.clipboardData.setData('text/plain', text);
          e.preventDefault();
        }
      } catch {
        // clipboard unavailable -- the reveal alone is the response.
      }
    };
    const onDragStart = (e: DragEvent) => {
      if (isEditable(e.target)) return;
      reveal('drag');
      try {
        const selection = window.getSelection()?.toString() ?? '';
        const text = withOwnershipTrailer(selection, trailerRef.current);
        if (text && e.dataTransfer) e.dataTransfer.setData('text/plain', text);
      } catch {
        // drag payload untouchable -- the reveal alone is the response.
      }
    };

    // -- context menu (never suppressed) -------------------------------------
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      let hasBg = false;
      try {
        if (target) hasBg = getComputedStyle(target).backgroundImage !== 'none';
      } catch {
        hasBg = false;
      }
      reveal(classifyContextTarget(target?.tagName, hasBg));
    };

    // -- drag-selection harvest --------------------------------------------
    let selectionTimer: number | null = null;
    const onSelectionChange = () => {
      if (selectionTimer !== null) window.clearTimeout(selectionTimer);
      selectionTimer = window.setTimeout(() => {
        selectionTimer = null;
        try {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) return;
          if (isEditable(sel.anchorNode?.parentElement ?? null)) return;
          if (selectionIsHarvest(sel.toString().replace(/\s+/g, ' ').trim().length)) reveal('select');
        } catch {
          // selection API unavailable
        }
      }, SELECTION_SETTLE_MS);
    };

    // -- developer tools -----------------------------------------------------
    const onBeforePrint = () => reveal('print');
    let docked = devtoolsDocked(window.outerWidth, window.innerWidth, window.outerHeight, window.innerHeight);
    const probeDock = () => {
      const next = devtoolsDocked(window.outerWidth, window.innerWidth, window.outerHeight, window.innerHeight);
      if (next && !docked) reveal('devtools');
      docked = next;
    };
    const dockTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') probeDock();
    }, DEVTOOLS_POLL_MS);
    window.addEventListener('resize', probeDock);

    // Console probe: a RegExp whose `toString` runs only when a console
    // panel builds the message's description -- Chromium formats buffered
    // messages the moment DevTools attaches, so the single ownership notice
    // logged at mount reports a later open too. Re-armed (one fresh log)
    // at most once per CONSOLE_PROBE_REARM_MS after it fires.
    let probeArmedAt = 0;
    let probeDisposed = false;
    const armConsoleProbe = () => {
      if (probeDisposed || Date.now() - probeArmedAt < CONSOLE_PROBE_REARM_MS) return;
      probeArmedAt = Date.now();
      try {
        const probe = /UNITAS/;
        probe.toString = () => {
          if (!probeDisposed) {
            reveal('devtools');
            window.setTimeout(armConsoleProbe, CONSOLE_PROBE_REARM_MS);
          }
          return '/THE UNITAS GLOBAL OÜ/';
        };
        console.log(
          '%c' + noticeRef.current,
          'font:600 12px/1.6 ui-sans-serif,system-ui;color:#b8962e;padding:2px 0',
          probe,
        );
      } catch {
        // console unavailable
      }
    };
    armConsoleProbe();

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('beforeprint', onBeforePrint);
    return () => {
      probeDisposed = true;
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('dragstart', onDragStart, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('resize', probeDock);
      window.clearInterval(dockTimer);
      if (selectionTimer !== null) window.clearTimeout(selectionTimer);
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    };
  }, [released]);

  if (!released) return null;

  const printMark = tRev('printMark');

  return (
    <ModalPortal>
      <div
        className="qw-watermark pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-[390] select-none text-right font-serif text-[10px] uppercase tracking-[0.32em]"
        style={{ color: 'rgba(10,10,12,.28)', mixBlendMode: 'multiply' }}
        data-reveal={revealKind ? '1' : '0'}
        data-reveal-kind={revealKind ?? undefined}
      >
        <span className="qw-watermark-hairline block h-px w-full bg-gradient-to-r from-transparent via-[var(--qw-gold)] to-transparent" />
        <span className="mt-1 block">{t('watermark')}</span>
        <span aria-hidden="true" data-u={invisibleMark} className="qw-watermark-invisible">
          {invisibleMark}
        </span>
      </div>
      <div
        className="qw-print-mark"
        aria-hidden="true"
        data-screen={revealKind ? '1' : '0'}
        data-reveal-kind={revealKind ?? undefined}
        key={revealKind ?? 'rest'}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i}>
            {printMark} · {printMark} · {printMark}
          </span>
        ))}
        <p className="qw-print-caption">{tRev('screenCaption')}</p>
      </div>
    </ModalPortal>
  );
}
