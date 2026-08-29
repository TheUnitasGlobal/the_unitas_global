'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SoundToggle } from '@/components/audio/SoundToggle';
import { usePwaInstall } from '@/lib/hooks/usePwaInstall';
import { Modal } from '@/components/ui/Modal';
import { useGatedSurface } from '@/components/ui/UIGateProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AuthButton } from './AuthButton';
import { SettingsButton } from './SettingsButton';
import { CoinBalanceBadge } from '@/components/wallet/CoinBalanceBadge';

export function NavBar() {
  const t = useTranslations('Nav');
  const { canInstall, isInstalled, isIos, isDesktop, promptInstall } = usePwaInstall();
  const { open: showGuide, setOpen: setShowGuide, blocked: guideBlocked } = useGatedSurface('nav:app-download', {
    lockScroll: true,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edgeHint, setEdgeHint] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateEdgeHint = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      setEdgeHint({
        left: el.scrollLeft > 8,
        right: el.scrollLeft < maxScroll - 8,
      });
    };

    updateEdgeHint();
    el.addEventListener('scroll', updateEdgeHint, { passive: true });
    window.addEventListener('resize', updateEdgeHint);
    return () => {
      el.removeEventListener('scroll', updateEdgeHint);
      window.removeEventListener('resize', updateEdgeHint);
    };
  }, []);

  const handleAppDownloadClick = () => {
    // Locked out while any other popup/modal/function-window is open.
    if (guideBlocked) return;
    if (isInstalled) {
      setShowGuide(true);
      return;
    }
    if (canInstall) {
      void promptInstall();
      return;
    }
    setShowGuide(true);
  };

  const guideMessage = isInstalled
    ? t('appDownloadAlreadyInstalledHint')
    : isIos
      ? t('appDownloadIosHint')
      : isDesktop
        ? t('appDownloadDesktopHint')
        : t('appDownloadUnsupported');

  return (
    <nav className="fixed left-0 top-0 z-50 w-full border-b border-accent/20 bg-void/80 py-5 backdrop-blur-md">
      <div className="flex items-center gap-6 px-4 lg:justify-between lg:gap-0 lg:px-6">
        {/* Brand anchor: always shrink-0, never inside the scroll container below --
            stays put on screen through any swipe on the menu cluster. */}
        <div className="relative flex shrink-0 items-center gap-3">
          <Link href="/" className="flex items-center">
            <span className="logo-hologram shrink-0">
              <img src="/assets/svg/unitas-mark.svg" alt="UNITAS" width={30} height={30} />
            </span>
          </Link>
          <button
            type="button"
            aria-label={t('appDownloadAria')}
            aria-disabled={guideBlocked}
            onClick={handleAppDownloadClick}
            className={`app-download-pulse flex min-w-0 flex-col items-start justify-center gap-0 rounded-xl border-none bg-transparent px-2.5 py-1 sm:flex-row sm:items-center sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-1.5 ${
              guideBlocked ? 'pointer-events-none' : ''
            }`}
          >
            <span className="font-serif text-[10px] font-bold uppercase leading-tight tracking-[0.1em] text-accent sm:text-[15px] sm:leading-none sm:tracking-[0.18em]">
              UNITAS
            </span>
            <span className="text-[8px] font-medium normal-case leading-tight tracking-wide text-cyan-300/90 sm:text-[11px] sm:leading-none">
              App Download
            </span>
          </button>
        </div>

        {/* Menu cluster: the only part that swipe-scrolls. Isolated from the
            brand anchor above so it can never drag the logo/download badge
            offscreen with it. */}
        <div className="relative min-w-0 flex-1 self-stretch lg:flex-initial">
          <div
            ref={scrollRef}
            className="nav-scroll flex h-full items-center gap-6 overflow-x-auto sm:gap-9 lg:overflow-x-visible"
          >
            <SoundToggle />
            <CoinBalanceBadge />
            <LanguageSwitcher />
            <AuthButton />
            <SettingsButton />
          </div>

          <div
            aria-hidden="true"
            className={`nav-edge-hint nav-edge-hint-left lg:hidden ${edgeHint.left ? 'opacity-100' : 'opacity-0'}`}
          >
            <span className="nav-edge-hint-pulse nav-edge-hint-pulse-left" />
          </div>
          <div
            aria-hidden="true"
            className={`nav-edge-hint nav-edge-hint-right lg:hidden ${edgeHint.right ? 'opacity-100' : 'opacity-0'}`}
          >
            <span className="nav-edge-hint-pulse" />
          </div>
        </div>
      </div>

      <Modal open={showGuide} onClose={() => void setShowGuide(false)} labelledBy="app-download-guide-title">
        <h2
          id="app-download-guide-title"
          className="font-serif text-lg font-bold uppercase tracking-[0.18em] text-accent"
        >
          {t('appDownloadModalTitle')}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-gray-200">{guideMessage}</p>
      </Modal>
    </nav>
  );
}
