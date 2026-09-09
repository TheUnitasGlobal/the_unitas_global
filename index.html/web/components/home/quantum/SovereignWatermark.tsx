'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { buildInvisibleMark } from '@/lib/quantumWhite/watermark';
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
 */
export function SovereignWatermark() {
  const t = useTranslations('QuantumWhite');
  const released = useCurtainReleased();
  const appendedRef = useRef(false);
  const invisibleMark = buildInvisibleMark(BUILD_FINGERPRINT);

  useEffect(() => {
    if (!released || appendedRef.current) return;
    try {
      document.documentElement.style.setProperty('--u-sig', `"${invisibleMark}"`);
      const heroTitle = document.querySelector('.qw-hero-wrap h1');
      if (heroTitle && !(heroTitle.textContent ?? '').includes(invisibleMark)) {
        heroTitle.appendChild(document.createTextNode(invisibleMark));
      }
      appendedRef.current = true;
    } catch {
      // Decorative only -- never let a DOM quirk trip the home.
    }
  }, [released, invisibleMark]);

  if (!released) return null;

  return (
    <ModalPortal>
      <div
        className="qw-watermark pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-[390] select-none text-right font-serif text-[10px] uppercase tracking-[0.32em]"
        style={{ color: 'rgba(10,10,12,.28)', mixBlendMode: 'multiply' }}
      >
        <span className="qw-watermark-hairline block h-px w-full bg-gradient-to-r from-transparent via-[var(--qw-gold)] to-transparent" />
        <span className="mt-1 block">{t('watermark')}</span>
        <span aria-hidden="true" data-u={invisibleMark} className="qw-watermark-invisible">
          {invisibleMark}
        </span>
      </div>
    </ModalPortal>
  );
}
