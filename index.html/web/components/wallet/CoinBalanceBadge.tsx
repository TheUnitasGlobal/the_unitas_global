'use client';

import { useTranslations } from 'next-intl';
import { Coins, Plus } from 'lucide-react';
import { useWallet } from './WalletProvider';
import { useGatedSurface } from '@/components/ui/useGatedSurface';
import { ChargeCoinsModal } from './ChargeCoinsModal';
import { WalletBalanceModal } from './WalletBalanceModal';

/** Fixed top-right live coin balance + Charge Coins CTA (nav bar). */
export function CoinBalanceBadge() {
  const t = useTranslations('Wallet');
  const { session, balance, loading, configured } = useWallet();

  // Both panels are gate participants: opening one force-closes the other and
  // every other single-open surface, and while any other surface holds the
  // gate these triggers go inert (pointer-events-none + aria-disabled).
  const chargeGate = useGatedSurface('nav:charge', { lockScroll: true });
  const balanceGate = useGatedSurface('nav:balance', { lockScroll: true });

  const balanceLabel = !configured || !session
    ? '—'
    : loading || balance === null
      ? '···'
      : balance.toLocaleString();

  return (
    <div className="flex items-center gap-3 sm:gap-5">
      <button
        type="button"
        onClick={() => balanceGate.setOpen(true, { force: true })}
        title={!session ? t('signInRequired') : undefined}
        aria-label={t('balanceTitle')}
        aria-haspopup="dialog"
        aria-disabled={balanceGate.blocked || undefined}
        className={`flex items-center gap-1.5 py-2 text-xs text-gray-300 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none sm:gap-2 sm:text-sm ${
          balanceGate.blocked ? 'pointer-events-none opacity-50' : 'pointer-events-auto'
        }`}
      >
        <Coins className="h-[18px] w-[18px] text-accent/80 sm:h-[22px] sm:w-[22px]" />
        <span className="font-bold text-neon">{balanceLabel}</span>
        <span className="hidden text-gray-500 sm:inline">{t('coinUnit')}</span>
      </button>
      <button
        type="button"
        onClick={() => chargeGate.setOpen(true, { force: true })}
        aria-haspopup="dialog"
        aria-disabled={chargeGate.blocked || undefined}
        className={`flex items-center gap-1.5 py-2 text-xs font-bold uppercase tracking-widest text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none sm:gap-2 sm:text-sm ${
          chargeGate.blocked ? 'pointer-events-none opacity-50' : 'pointer-events-auto'
        }`}
      >
        <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
        <span className="hidden sm:inline">{t('chargeCoins')}</span>
      </button>
      <WalletBalanceModal open={balanceGate.open} onClose={() => balanceGate.setOpen(false)} />
      <ChargeCoinsModal open={chargeGate.open} onClose={() => chargeGate.setOpen(false)} />
    </div>
  );
}
