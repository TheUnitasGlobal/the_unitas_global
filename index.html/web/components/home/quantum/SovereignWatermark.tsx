'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { buildInvisibleMark } from '@/lib/quantumWhite/watermark';
import {
  REVEAL_MS,
  blurIsCapture,
  classifyKeyGesture,
  isImageTarget,
  withOwnershipTrailer,
  type CaptureKind,
} from '@/lib/quantumWhite/antiPiracy';
import { useCurtainReleased } from './useCurtainReleased';

/** Build fingerprint embedded in the invisible mark (spec §3, watermark.ts). */
const BUILD_FINGERPRINT = process.env.NEXT_PUBLIC_UNITAS_BUILD_FINGERPRINT ?? 'rev13';

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
 * REV-19 §6 (anti-piracy): at rest the label is barely there (opacity .07,
 * quantum-white-rev19.css §16). It flares to full visibility -- and only
 * then -- while the page is being captured or copied: print (Ctrl/Cmd+P,
 * `beforeprint`), screenshot key gestures (PrintScreen, Win+Shift+S,
 * Cmd+Shift+3/4/5/6) and the focus loss that follows them, copy / cut
 * (the clipboard additionally receives a visible ownership trailer), and a
 * context menu on an image. A print also paints a full-page diagonal mark
 * (`.qw-print-mark`, @media print). Every trigger is classified by the pure
 * lib/quantumWhite/antiPiracy.ts helpers.
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

  // --- REV-19 §6: capture / copy / print reveal ------------------------------
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

    const onKeyDown = (e: KeyboardEvent) => {
      const kind = classifyKeyGesture(e);
      if (!kind) return;
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
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      let hasBg = false;
      try {
        hasBg = getComputedStyle(target).backgroundImage !== 'none';
      } catch {
        hasBg = false;
      }
      if (isImageTarget(target.tagName, hasBg)) reveal('image');
    };
    const onBeforePrint = () => reveal('print');

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('beforeprint', onBeforePrint);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('beforeprint', onBeforePrint);
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
      <div className="qw-print-mark" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i}>
            {printMark} · {printMark} · {printMark}
          </span>
        ))}
      </div>
    </ModalPortal>
  );
}
