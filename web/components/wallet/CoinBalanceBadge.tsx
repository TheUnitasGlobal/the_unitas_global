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
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-2 border border-accent/30 bg-void/60 px-5 py-3 text-base text-gray-300"
        title={!session ? t('signInRequired') : undefined}
      >
        <Coins size={26} className="text-accent" />
        <span className="font-bold text-neon">{balanceLabel}</span>
        <span className="hidden text-gray-500 sm:inline">{t('coinUnit')}</span>
      </div>
      <button
        type="button"
        onClick={() => setChargeOpen(true)}
        className="flex items-center gap-2 border border-accent/50 bg-accent/10 px-5 py-3 text-base font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-void"
      >
        <Plus size={26} />
        <span className="hidden sm:inline">{t('chargeCoins')}</span>
      </button>
      <ChargeCoinsModal open={chargeOpen} onClose={() => setChargeOpen(false)} />
    </div>
  );
}
