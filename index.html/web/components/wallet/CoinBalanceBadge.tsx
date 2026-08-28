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
    <div className="flex items-center gap-5">
      <button
        type="button"
        onClick={() => balanceGate.setOpen(true, { force: true })}
        title={!session ? t('signInRequired') : undefined}
        aria-label={t('balanceTitle')}
        aria-haspopup="dialog"
        aria-disabled={balanceGate.blocked || undefined}
        className={`flex items-center gap-2 py-2 text-sm text-gray-300 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none ${
          balanceGate.blocked ? 'pointer-events-none opacity-50' : 'pointer-events-auto'
        }`}
      >
        <Coins size={22} className="text-accent/80" />
        <span className="font-bold text-neon">{balanceLabel}</span>
        <span className="hidden text-gray-500 sm:inline">{t('coinUnit')}</span>
      </button>
      <button
        type="button"
        onClick={() => chargeGate.setOpen(true, { force: true })}
        aria-haspopup="dialog"
        aria-disabled={chargeGate.blocked || undefined}
        className={`flex items-center gap-2 py-2 text-sm font-bold uppercase tracking-widest text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none ${
          chargeGate.blocked ? 'pointer-events-none opacity-50' : 'pointer-events-auto'
        }`}
      >
        <Plus size={20} />
        <span className="hidden sm:inline">{t('chargeCoins')}</span>
      </button>
      <WalletBalanceModal open={balanceGate.open} onClose={() => balanceGate.setOpen(false)} />
      <ChargeCoinsModal open={chargeGate.open} onClose={() => chargeGate.setOpen(false)} />
    </div>
  );
}
