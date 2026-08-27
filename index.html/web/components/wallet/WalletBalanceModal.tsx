'use client';

import { useTranslations } from 'next-intl';
import { Coins } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useWallet } from './WalletProvider';

interface WalletBalanceModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * U-COIN balance panel opened from the nav-bar coin badge. Mirrors the
 * honest "read-only" posture of ChargeCoinsModal: it surfaces the live
 * `wallets` balance (or a sign-in prompt when signed out / not configured)
 * without pretending to run a spend flow this portal doesn't own yet.
 */
export function WalletBalanceModal({ open, onClose }: WalletBalanceModalProps) {
  const t = useTranslations('Wallet');
  const { session, balance, loading, configured } = useWallet();

  const signedIn = configured && Boolean(session);
  const balanceLabel = !signedIn
    ? '—'
    : loading || balance === null
      ? '···'
      : balance.toLocaleString();

  return (
    <Modal open={open} onClose={onClose} labelledBy="wallet-balance-title">
      <h2
        id="wallet-balance-title"
        className="mb-6 text-center font-serif text-xl font-bold text-accent"
      >
        {t('balanceTitle')}
      </h2>

      <div className="flex flex-col items-center gap-2">
        <Coins size={28} className="text-accent/80" aria-hidden="true" />
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-4xl font-bold text-neon">{balanceLabel}</span>
          <span className="text-sm uppercase tracking-widest text-gray-500">{t('coinUnit')}</span>
        </div>
        <span className="text-xs uppercase tracking-widest text-gray-500">{t('balance')}</span>
      </div>

      <p className="mt-6 text-center text-sm leading-relaxed text-gray-400">
        {signedIn ? t('balanceBody') : t('signInRequired')}
      </p>
      <p className="mt-4 text-center text-xs leading-relaxed text-gray-500">{t('currencyNote')}</p>

      <button
        type="button"
        onClick={onClose}
        className="mt-8 w-full bg-accent py-3 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white"
      >
        {t('close')}
      </button>
    </Modal>
  );
}
