'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { usePwaInstall } from '@/lib/hooks/usePwaInstall';

/**
 * Coming-Soon twin of the nav-bar "shimmering logo + UNITAS App Download" CTA
 * (see components/nav/NavBar.tsx -- same hologram mark + gold/cyan
 * `app-download-pulse` lockup, copied verbatim). Pinned bottom-left of the
 * sealed cinema screen so a visitor can one-click install the PWA the instant
 * the ad ends -- the post-ad growth path (owner instruction 2026-08-30).
 *
 * It deliberately does NOT reuse the shared <Modal/>: that portals to <body>
 * at z-[200], below the curtain's z-[400], so it would render behind the
 * sealed screen. The install sheet here is an in-curtain overlay instead.
 * The logo is intentionally NOT a link -- the sealed screen is fail-closed,
 * nothing may offer a route into the real site.
 */
export function CinemaAppDownload() {
  const t = useTranslations('Nav');
  const { canInstall, isInstalled, isIos, isDesktop, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);

  const hint = isInstalled
    ? t('appDownloadAlreadyInstalledHint')
    : canInstall
      ? t('appDownloadReadyHint')
      : isIos
        ? t('appDownloadIosHint')
        : isDesktop
          ? t('appDownloadDesktopHint')
          : t('appDownloadUnsupported');

  return (
    <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3">
      <span className="logo-hologram shrink-0" aria-hidden="true">
        <img src="/assets/svg/unitas-mark.svg" alt="" width={30} height={30} />
      </span>
      <button
        type="button"
        aria-label={t('appDownloadAria')}
        onClick={() => setOpen(true)}
        className="app-download-pulse flex min-w-0 flex-col items-start justify-center gap-0 rounded-xl border-none bg-transparent px-2.5 py-1 sm:flex-row sm:items-center sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-1.5"
      >
        <span className="font-serif text-[10px] font-bold uppercase leading-tight tracking-[0.1em] text-accent sm:text-[15px] sm:leading-none sm:tracking-[0.18em]">
          UNITAS
        </span>
        <span className="text-[8px] font-medium normal-case leading-tight tracking-wide text-cyan-300/90 sm:text-[11px] sm:leading-none">
          App Download
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain bg-void/85 p-6 text-left backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <motion.div
              className="glow-box relative w-full max-w-md bg-quantum p-6 sm:p-8"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cinema-app-download-title"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center border border-accent/40 bg-quantum/80 text-accent transition-colors hover:border-accent"
              >
                <X size={14} />
              </button>
              <h2
                id="cinema-app-download-title"
                className="font-serif text-lg font-bold uppercase tracking-[0.18em] text-accent"
              >
                {t('appDownloadModalTitle')}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-gray-200">{hint}</p>

              {!isInstalled && canInstall && (
                <button
                  type="button"
                  onClick={() => {
                    void promptInstall();
                    setOpen(false);
                  }}
                  className="mt-6 flex w-full items-center justify-center gap-2 border border-accent bg-accent/10 py-3 text-sm font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-void"
                >
                  <Download size={16} aria-hidden="true" />
                  {t('appDownloadInstallNow')}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
