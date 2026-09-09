'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { useWallet } from './WalletProvider';
import { useGatedSurface } from '@/components/ui/useGatedSurface';
import { formatVirtualId } from '@/lib/guestIdentity';

/**
 * Header strip shown at the top of the coin panels when the visitor is a
 * guest: states the Virtual ID and offers a one-click jump to full sign-up.
 * The CTA hands the single-open-surface gate to `nav:auth`, which is what the
 * AuthModal instance in the nav bar listens on -- so this panel closes and the
 * sign-up modal opens in the same tick. Renders nothing for real sessions.
 */
export function GuestUpgradeStrip() {
  const t = useTranslations('Guest');
  const { guest, session } = useWallet();
  const auth = useGatedSurface('nav:auth', { lockScroll: true });

  if (session || !guest) return null;

  return (
    <div className="mb-5 flex flex-col gap-2 border border-accent/30 bg-accent/5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-accent">
          <Sparkles size={12} aria-hidden="true" />
          {t('badge')}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-gray-400">
          {t('virtualIdLabel')}: <span className="text-gray-200">{formatVirtualId(guest.virtualId)}</span>
        </p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-gray-500">{t('upgradeReason')}</p>
      </div>
      <button
        type="button"
        onClick={() => auth.setOpen(true, { force: true })}
        className="shrink-0 bg-accent px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-void transition-colors hover:bg-white"
      >
        {t('upgradeCta')}
      </button>
    </div>
  );
}
