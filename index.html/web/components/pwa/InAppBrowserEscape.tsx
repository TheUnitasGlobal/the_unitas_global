'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, ExternalLink, X } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { MasterMarkLogo } from '@/components/brand/MasterMarkLogo';
import {
  IN_APP_ESCAPE_ATTEMPT_EVENT,
  attemptInAppEscape,
  currentInAppBrowser,
  type InAppDetection,
} from '@/lib/pwa/inAppBrowser';

/**
 * How long after mount the fallback card waits before showing. The
 * pre-hydration bootstrap (lib/pwa/inAppBrowser.ts IN_APP_ESCAPE_BOOTSTRAP)
 * has already fired the automatic hand-off by then; if the visitor is still
 * looking at this document, the container refused it and they need the card.
 */
const FALLBACK_DELAY_MS = 1400;

/**
 * In-app browser fallback card (owner instruction 2026-09-07, comparative
 * hardening item 2). Renders NOTHING in a real browser or in the installed
 * app. Inside a recognised embedded WebView it appears as a bottom sheet
 * only when the automatic hand-off did not take the visitor away:
 *
 *   [Open in browser]  re-fires the hand-off (KakaoTalk / LINE schemes,
 *                      Android `intent://` pinned to Chrome, iOS
 *                      `x-safari-https://`) on a real tap.
 *   [Copy link]        the universal path for the few containers (Facebook /
 *                      Instagram on iOS) that swallow foreign schemes.
 *
 * z-[660]: above the curtain (z-400), the exit modal (z-680 sits above it on
 * purpose), below the intro splash (z-700).
 */
export function InAppBrowserEscape() {
  const t = useTranslations('InApp');
  const [detection, setDetection] = useState<InAppDetection | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const found = currentInAppBrowser();
    if (!found) return;
    setDetection(found);
    const timer = window.setTimeout(() => setVisible(true), FALLBACK_DELAY_MS);
    const onAttempt = (event: Event) => {
      const detail = (event as CustomEvent<{ auto?: boolean }>).detail;
      if (detail && detail.auto === false) setVisible(true);
    };
    window.addEventListener(IN_APP_ESCAPE_ATTEMPT_EVENT, onAttempt);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(IN_APP_ESCAPE_ATTEMPT_EVENT, onAttempt);
    };
  }, []);

  const openExternal = useCallback(() => {
    attemptInAppEscape({ auto: false });
  }, []);

  const copyLink = useCallback(async () => {
    const href = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(href);
      } else {
        const area = document.createElement('textarea');
        area.value = href;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked -- the visible URL hint still lets them retype it */
    }
  }, []);

  if (!detection) return null;

  return (
    <ModalPortal>
      <AnimatePresence>
        {visible && (
          <motion.aside
            className="unitas-inapp-card fixed inset-x-0 bottom-0 z-[660] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            role="dialog"
            aria-labelledby="unitas-inapp-title"
            data-inapp-vendor={detection.vendor}
          >
            <div className="glow-box unitas-sheet-card relative mx-auto w-full max-w-md bg-quantum p-5 text-left">
              <button
                type="button"
                onClick={() => setVisible(false)}
                aria-label={t('close')}
                className="unitas-tap absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center border border-accent/40 bg-quantum/80 text-accent"
              >
                <X size={14} />
              </button>
              <div className="flex items-center gap-3 pr-8">
                <span className="logo-hologram logo-hologram--sm shrink-0" aria-hidden="true">
                  <MasterMarkLogo variant="compact" style={{ width: 18, height: 18 }} />
                </span>
                <h2 id="unitas-inapp-title" className="font-serif text-base font-bold uppercase tracking-[0.16em] text-accent">
                  {t('title')}
                </h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-200">{t('body')}</p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={openExternal}
                  className="unitas-tap unitas-cta-solid flex items-center justify-center gap-2 border border-accent bg-accent/10 py-3 text-xs font-bold uppercase tracking-[0.16em] text-accent"
                >
                  <ExternalLink size={15} aria-hidden="true" />
                  {t('open')}
                </button>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="unitas-tap flex items-center justify-center gap-2 border border-cyan-300/50 bg-transparent py-3 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200"
                >
                  <Copy size={15} aria-hidden="true" />
                  {copied ? t('copied') : t('copy')}
                </button>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{t('menuHint')}</p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}
