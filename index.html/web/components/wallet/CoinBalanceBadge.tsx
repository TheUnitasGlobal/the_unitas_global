'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Coins, Plus } from 'lucide-react';
import { useWallet } from './WalletProvider';
import { ChargeCoinsModal } from './ChargeCoinsModal';

/** Fixed top-right live coin balance + Charge Coins CTA (nav bar). */
export function CoinBalanceBadge() {
  const t = useTranslations('Wallet');
  const { session, balance, loading, configured } = useWallet();
  const [chargeOpen, setChargeOpen] = useState(false);

  const balanceLabel = !configured || !session
    ? '—'
    : loading || balance === null
      ? '···'
      : balance.toLocaleString();

  return (
    <div className="flex items-center gap-5">
      <div
        className="flex items-center gap-2 text-sm text-gray-300"
        title={!session ? t('signInRequired') : undefined}
      >
        <Coins size={22} className="text-accent/80" />
        <span className="font-bold text-neon">{balanceLabel}</span>
        <span className="hidden text-gray-500 sm:inline">{t('coinUnit')}</span>
      </div>
      <button
        type="button"
        onClick={() => setChargeOpen(true)}
        className="flex items-center gap-2 py-2 text-sm font-bold uppercase tracking-widest text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none"
      >
        <Plus size={20} />
        <span className="hidden sm:inline">{t('chargeCoins')}</span>
      </button>
      <ChargeCoinsModal open={chargeOpen} onClose={() => setChargeOpen(false)} />
    </div>
  );
}
