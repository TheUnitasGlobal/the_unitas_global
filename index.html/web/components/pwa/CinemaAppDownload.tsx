'use client';

import { useTranslations } from 'next-intl';
import { MasterMarkLogo } from '@/components/brand/MasterMarkLogo';
import { PWA_INSTALL_TRIGGER_ATTR } from '@/lib/pwa/installPrompt';

/**
 * Coming-Soon twin of the nav-bar "shimmering logo + UNITAS App Download" CTA
 * (see components/nav/NavBar.tsx -- same hologram mark + gold/cyan
 * `app-download-pulse` lockup, copied verbatim). Pinned bottom-left of the
 * sealed cinema screen so a visitor can one-click install the PWA the instant
 * the ad ends -- the post-ad growth path (owner instruction 2026-08-30).
 *
 * Owner instruction 2026-09-04 (item 2): the button no longer owns an
 * in-curtain sheet. It is a plain `data-pwa-install` trigger -- the global
 * <PwaInstallHost/> fires the native install popup on this very click when
 * the browser offers one, and its z-[650] guide sheet (above this curtain's
 * z-400) otherwise. The logo is intentionally NOT a link -- the sealed screen
 * is fail-closed, nothing may offer a route into the real site.
 */
export function CinemaAppDownload() {
  const t = useTranslations('Nav');
  const trigger = { [PWA_INSTALL_TRIGGER_ATTR]: 'cinema' } as Record<string, string>;

  return (
    <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2.5">
      <span className="logo-hologram logo-hologram--sm shrink-0" aria-hidden="true">
        <MasterMarkLogo variant="compact" style={{ width: 18, height: 18 }} />
      </span>
      <button
        type="button"
        aria-label={t('appDownloadAria')}
        {...trigger}
        className="app-download-pulse flex items-center gap-1.5 whitespace-nowrap rounded-full border-none bg-transparent px-3 py-1.5"
      >
        <span className="font-serif text-[11px] font-bold uppercase leading-none tracking-[0.22em] text-accent">
          UNITAS
        </span>
        <span className="text-[11px] font-medium normal-case leading-none tracking-[0.02em] text-cyan-300/90">
          App Download
        </span>
      </button>
    </div>
  );
}
