'use client';

import { Link } from '@/i18n/navigation';
import { SoundToggle } from '@/components/audio/SoundToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { CoinBalanceBadge } from '@/components/wallet/CoinBalanceBadge';

export function NavBar() {
  return (
    <nav className="fixed left-0 top-0 z-50 flex w-full items-center justify-between border-b border-accent/20 bg-void/80 px-4 py-3 backdrop-blur-md sm:px-6">
      <Link href="/" className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
        <span className="hidden font-serif text-sm font-bold tracking-widest text-accent sm:inline">
          THE UNITAS GLOBAL OÜ
        </span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-4">
        <CoinBalanceBadge />
        <SoundToggle />
        <LanguageSwitcher />
      </div>
    </nav>
  );
}
