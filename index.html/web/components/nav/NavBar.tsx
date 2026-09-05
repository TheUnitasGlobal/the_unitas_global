'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MasterMarkLogo } from '@/components/brand/MasterMarkLogo';
import { SoundToggle } from '@/components/audio/SoundToggle';
import { PWA_INSTALL_TRIGGER_ATTR } from '@/lib/pwa/installPrompt';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AuthButton } from './AuthButton';
import { SettingsButton } from './SettingsButton';
import { CoinBalanceBadge } from '@/components/wallet/CoinBalanceBadge';

export function NavBar() {
  const t = useTranslations('Nav');
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

  // One-click install (owner instruction 2026-09-04, item 2): the button is a
  // plain `data-pwa-install` trigger. The global <PwaInstallHost/> (mounted in
  // app/[locale]/layout.tsx) fires the browser's native install popup on this
  // exact click whenever `beforeinstallprompt` was captured, and opens the
  // localized guide sheet otherwise -- identical behaviour on every route.
  const installTrigger = { [PWA_INSTALL_TRIGGER_ATTR]: 'nav' } as Record<string, string>;

  return (
    <nav id="unitas-nav" className="fixed left-0 top-0 z-50 w-full border-b border-accent/20 bg-void/80 py-5 backdrop-blur-md">
      <div className="flex items-center gap-6 px-4 lg:justify-between lg:gap-0 lg:px-6">
        {/* Brand anchor: always shrink-0, never inside the scroll container below --
            stays put on screen through any swipe on the menu cluster. */}
        <div className="relative flex shrink-0 items-center gap-3">
          <Link href="/" className="flex items-center">
            <span className="logo-hologram shrink-0">
              <MasterMarkLogo variant="compact" style={{ width: 30, height: 30 }} />
            </span>
          </Link>
          <button
            type="button"
            aria-label={t('appDownloadAria')}
            {...installTrigger}
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
    </nav>
  );
}
