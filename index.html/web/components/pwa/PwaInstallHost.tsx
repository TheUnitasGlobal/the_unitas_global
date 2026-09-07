'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Share, X } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { useGatedSurface } from '@/components/ui/useGatedSurface';
import { usePwaInstall } from '@/lib/hooks/usePwaInstall';
import { attemptInAppEscape, currentInAppBrowser } from '@/lib/pwa/inAppBrowser';
import {
  PWA_INSTALL_REQUEST_EVENT,
  PWA_INSTALL_TRIGGER_ATTR,
  PWA_PROMPT_GRACE_MS,
  canBrowserPrompt,
  promptPwaInstall,
  waitForPwaPrompt,
} from '@/lib/pwa/installPrompt';

/** Stamped on the tapped trigger while a late prompt is awaited (CSS hook). */
const TRIGGER_BUSY_ATTR = 'data-pwa-busy';

/**
 * Global one-click PWA install handler (owner instruction 2026-09-04, item 2;
 * re-hardened 2026-09-07, comparative hardening item 1).
 *
 * Mounted ONCE in app/[locale]/layout.tsx (it needs translations, so it lives
 * under NextIntlClientProvider) and serves every route -- home, the sealed
 * ad/cinema screen, company/legal/support landing pages, module sub-routes.
 * Two trigger paths, both zero-wiring for the surface that uses them:
 *
 *   1. any element carrying `data-pwa-install` (delegated document click);
 *   2. `requestPwaInstall()` (a window CustomEvent) for programmatic use.
 *
 * Resolution order on a tap -- the native system dialog is ALWAYS preferred
 * and a manual guide is the last resort, never the first:
 *
 *   a. in-app container (Facebook / Instagram / KakaoTalk / ... WebView):
 *      hand the page to the system browser right now (lib/pwa/inAppBrowser)
 *      -- those views can never install; <InAppBrowserEscape/> shows the
 *      fallback card if the hand-off is refused.
 *   b. captured `beforeinstallprompt`: `prompt()` synchronously, inside this
 *      very click's user activation -> the OS install dialog opens.
 *   c. Chromium engine, prompt not yet captured (tap landed a beat before the
 *      browser finished its installability check): hold the activation
 *      window open for up to PWA_PROMPT_GRACE_MS and fire the dialog the
 *      instant the event lands. No guide, no second tap.
 *   d. only when none of the above can ever apply (Safari / Firefox / already
 *      installed / prompt consumed) does the compact localized sheet open,
 *      so a tap is still never a dead click.
 *
 * The sheet is its own fixed overlay at z-[650]: above the pre-launch curtain
 * (z-400) and the audio gate (z-300), below the intro splash (z-700), so it
 * also works from the sealed cinema screen where the shared <Modal/> (z-200)
 * would render underneath the curtain.
 */
export function PwaInstallHost() {
  const t = useTranslations('Nav');
  const { canInstall, isInstalled, isIos, isDesktop } = usePwaInstall();
  const { open, setOpen } = useGatedSurface('pwa:install-guide', { lockScroll: true });
  const liveRef = useRef({ canInstall, isInstalled });
  liveRef.current = { canInstall, isInstalled };

  useEffect(() => {
    const openSheet = () => setOpen(true, { force: true });

    const handleRequest = (trigger: Element | null) => {
      // (a) embedded WebView -> system browser hand-off.
      if (currentInAppBrowser()) {
        attemptInAppEscape({ auto: false });
        return;
      }

      const { canInstall: ready, isInstalled: installed } = liveRef.current;

      // (b) native dialog, synchronously inside the gesture.
      if (!installed && ready) {
        void promptPwaInstall().then((status) => {
          if (status === 'unavailable') openSheet();
        });
        return;
      }

      // (c) Chromium: the prompt is probably still in flight -- wait for it
      //     within the activation window, then fire.
      if (!installed && canBrowserPrompt()) {
        trigger?.setAttribute(TRIGGER_BUSY_ATTR, '1');
        void waitForPwaPrompt(PWA_PROMPT_GRACE_MS)
          .then((prompt) => {
            if (!prompt) {
              openSheet();
              return;
            }
            return promptPwaInstall().then((status) => {
              if (status === 'unavailable') openSheet();
            });
          })
          .finally(() => trigger?.removeAttribute(TRIGGER_BUSY_ATTR));
        return;
      }

      // (d) engines with no programmatic path.
      openSheet();
    };

    const onRequestEvent = () => handleRequest(null);
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const trigger = target?.closest?.(`[${PWA_INSTALL_TRIGGER_ATTR}]`);
      if (!trigger) return;
      event.preventDefault();
      handleRequest(trigger);
    };

    window.addEventListener(PWA_INSTALL_REQUEST_EVENT, onRequestEvent);
    document.addEventListener('click', onDocumentClick);
    return () => {
      window.removeEventListener(PWA_INSTALL_REQUEST_EVENT, onRequestEvent);
      document.removeEventListener('click', onDocumentClick);
    };
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

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
    <ModalPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="pwa-sheet-viewport fixed inset-0 z-[650] overflow-y-auto overscroll-contain bg-void/85 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div className="flex min-h-full items-center justify-center p-[max(1.5rem,env(safe-area-inset-top))]">
              <motion.div
                className="glow-box unitas-sheet-card relative w-full max-w-md bg-quantum p-6 text-left sm:p-8"
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pwa-install-guide-title"
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="unitas-tap absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center border border-accent/40 bg-quantum/80 text-accent transition-colors hover:border-accent"
                >
                  <X size={14} />
                </button>

                <div className="flex items-center gap-3">
                  <span className="logo-hologram logo-hologram--sm shrink-0" aria-hidden="true">
                    <img src="/assets/svg/unitas-mark.svg" alt="" width={18} height={18} />
                  </span>
                  <h2
                    id="pwa-install-guide-title"
                    className="font-serif text-lg font-bold uppercase tracking-[0.18em] text-accent"
                  >
                    {t('appDownloadModalTitle')}
                  </h2>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-gray-200">{hint}</p>

                {!isInstalled && canInstall && (
                  <button
                    type="button"
                    onClick={() => {
                      void promptPwaInstall();
                      setOpen(false);
                    }}
                    className="unitas-tap unitas-cta-solid mt-6 flex w-full items-center justify-center gap-2 border border-accent bg-accent/10 py-3 text-sm font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-void"
                  >
                    <Download size={16} aria-hidden="true" />
                    {t('appDownloadInstallNow')}
                  </button>
                )}

                {!isInstalled && !canInstall && isIos && (
                  <p className="mt-5 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-300/80">
                    <Share size={14} aria-hidden="true" />
                    Share → Add to Home Screen
                  </p>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}
