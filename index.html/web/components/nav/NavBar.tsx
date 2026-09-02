'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { SoundToggle } from '@/components/audio/SoundToggle';
import { usePwaInstall } from '@/lib/hooks/usePwaInstall';
import { Modal } from '@/components/ui/Modal';
import { useGatedSurface } from '@/components/ui/useGatedSurface';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AuthButton } from './AuthButton';
import { SettingsButton } from './SettingsButton';
import { CoinBalanceBadge } from '@/components/wallet/CoinBalanceBadge';

export function NavBar() {
  const t = useTranslations('Nav');
  const { canInstall, isInstalled, isIos, isDesktop, promptInstall } = usePwaInstall();
  const { open: showGuide, setOpen: setShowGuide } = useGatedSurface('nav:app-download', {
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

  // Always surface the install popup (owner instruction 2026-08-29): the modal
  // now hosts the live one-click install button wired to `beforeinstallprompt`,
  // so we no longer fire the native prompt straight from the nav click.
  const handleAppDownloadClick = () => {
    setShowGuide(true, { force: true });
  };

  const handleModalInstall = () => {
    void promptInstall();
    setShowGuide(false);
  };

  const guideMessage = isInstalled
    ? t('appDownloadAlreadyInstalledHint')
    : canInstall
      ? t('appDownloadReadyHint')
      : isIos
        ? t('appDownloadIosHint')
        : isDesktop
          ? t('appDownloadDesktopHint')
          : t('appDownloadUnsupported');

  return (
    <nav id="unitas-nav" className="fixed left-0 top-0 z-50 w-full border-b border-accent/20 bg-void/80 py-5 backdrop-blur-md">
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
            onClick={handleAppDownloadClick}
            className="app-download-pulse flex min-w-0 flex-col items-start justify-center gap-0 rounded-xl border-none bg-transparent px-2.5 py-1 sm:flex-row sm:items-center sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-1.5"
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
            {/* Coin economy is the core CTA -- must never scroll out of view when
                the mobile icon cluster is swiped. `sticky left-0` clamps it to the
                scroll container's left edge once swiping would otherwise carry it
                past that point; before that it simply sits at its normal flow
                position, so nothing shifts on initial render. No-op on lg+ (the
                cluster switches to overflow-x-visible there, so there is nothing
                to stick to). z-20 (above .nav-edge-hint's z-10) so the purely
                decorative left scroll-scrim never paints over the badge once
                both occupy the same left edge.

                The dark backdrop itself is gated on `edgeHint.left` (only true
                once the strip has actually been swiped) -- applying it
                unconditionally painted a visibly solid black box around the
                badge at rest, clashing against every non-black hero background
                behind the translucent nav (owner-reported "상단바 검정 박스",
                2026-09-01). It's only needed once other icons are actually
                sliding underneath the stuck badge. */}
            <div
              className={`sticky left-0 z-20 flex shrink-0 items-center pr-3 transition-colors lg:static lg:bg-transparent lg:pr-0 lg:backdrop-blur-none ${
                edgeHint.left ? 'bg-void/90 backdrop-blur-md' : 'bg-transparent'
              }`}
            >
              <CoinBalanceBadge />
            </div>
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

      <Modal open={showGuide} onClose={() => setShowGuide(false)} labelledBy="app-download-guide-title">
        <h2
          id="app-download-guide-title"
          className="font-serif text-lg font-bold uppercase tracking-[0.18em] text-accent"
        >
          {t('appDownloadModalTitle')}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-gray-200">{guideMessage}</p>

        {/* Live one-click install: only rendered while the browser has actually
            fired `beforeinstallprompt` (canInstall), so tapping it always
            resolves to the real native install flow -- no dead button. */}
        {!isInstalled && canInstall && (
          <button
            type="button"
            onClick={handleModalInstall}
            className="mt-6 flex w-full items-center justify-center gap-2 border border-accent bg-accent/10 py-3 text-sm font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-void"
          >
            <Download size={16} aria-hidden="true" />
            {t('appDownloadInstallNow')}
          </button>
        )}
      </Modal>
    </nav>
  );
}
