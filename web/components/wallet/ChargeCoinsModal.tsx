'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';

interface ChargeCoinsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Coin purchase checkout isn't wired up in this app yet (see the root
 * static site's Stripe-backed create-coin-checkout-session for the live
 * version) -- this is an honest "coming soon" panel, not a fake purchase
 * flow.
 */
export function ChargeCoinsModal({ open, onClose }: ChargeCoinsModalProps) {
  const t = useTranslations('Wallet');

  return (
    <Modal open={open} onClose={onClose} labelledBy="charge-coins-title">
      <h2
        id="charge-coins-title"
        className="mb-4 text-center font-serif text-xl font-bold text-accent"
      >
        {t('chargeTitle')}
      </h2>
      <p className="text-center text-sm leading-relaxed text-gray-400">{t('chargeBody')}</p>
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
