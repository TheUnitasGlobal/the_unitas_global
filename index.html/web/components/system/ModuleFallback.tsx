'use client';

import { useTranslations } from 'next-intl';
import { PWA_ICON_VERSION } from '@/lib/pwa/iconVersion';

/**
 * Quiet in-place fallback for a shielded PAGE / SECTION zone (owner
 * instruction 2026-09-07, item 1). Deliberately not an "error screen": no
 * alarm title, no reference id, nothing about what failed -- just the dimmed
 * master mark and one retry control, sized to the slot it replaces so the
 * rest of the page (nav, curtain, audio, exit guard) keeps working around it.
 * The shield remounts the zone by itself first; this is only ever seen when
 * a fault is persistent.
 */
export function ModuleFallback({ retry, compact = false }: { retry: () => void; compact?: boolean }) {
  const t = useTranslations('ErrorBoundary');
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-4 text-center ${
        compact ? 'min-h-[120px] px-4 py-6' : 'min-h-[50vh] px-6 py-16'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/assets/svg/unitas-mark.svg?v=${PWA_ICON_VERSION}`}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={`${compact ? 'h-8 w-8' : 'h-12 w-12'} opacity-40`}
        style={{ filter: 'saturate(.5)' }}
      />
      <button
        type="button"
        onClick={retry}
        className="border border-accent/40 bg-accent/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-accent/90 transition-colors hover:bg-accent/20"
      >
        {t('retry')}
      </button>
    </div>
  );
}
