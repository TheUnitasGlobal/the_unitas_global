'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from '@/i18n/navigation';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { moduleAccessName } from '@/lib/module-registry';
import type { EcosystemTheme } from '@/lib/ecosystems';

interface EcosystemEntryModalProps {
  ecosystem: EcosystemTheme | null;
  onClose: () => void;
}

/**
 * Cyberpunk hologram entry modal for one of the 11 ecosystems: Rules, Cost,
 * live balance, and a "Pay & Enter" button. Per the brief, clicking Pay &
 * Enter does NOT navigate instantly -- it shows a brief "authorizing"
 * state first (the same spend_coins-gated flow as ModuleQuestModal, just
 * with a deliberate pause before the route change).
 */
export function EcosystemEntryModal({ ecosystem, onClose }: EcosystemEntryModalProps) {
  const t = useTranslations('B2C');
  const tEntry = useTranslations('EntryModal');
  const tEcosystems = useTranslations('Ecosystems');
  const tWallet = useTranslations('Wallet');
  const { session, balance, loading, configured } = useWallet();
  const { playQuestEnterSfx } = useSpatialAudio();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [spendError, setSpendError] = useState<string | null>(null);

  const open = ecosystem !== null;
  const cost = ecosystem?.coinCost ?? 0;
  const hasBalanceInfo = configured && Boolean(session) && balance !== null && !loading;
  const insufficient = hasBalanceInfo && (balance as number) < cost;

  function handleClose() {
    if (processing) return;
    setSpendError(null);
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, processing]);

  async function handlePayAndEnter() {
    if (!ecosystem || processing) return;
    if (!session) {
      setSpendError(tEntry('signInRequired'));
      return;
    }
    setSpendError(null);
    setProcessing(true);
    playQuestEnterSfx();
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc('spend_coins', {
        p_module: moduleAccessName(ecosystem.route) ?? ecosystem.key,
        p_amount: ecosystem.coinCost,
      });
      if (error) {
        setSpendError(error.message || tEntry('spendFailed'));
        setProcessing(false);
        return;
      }
    } catch {
      setSpendError(tEntry('spendFailed'));
      setProcessing(false);
      return;
    }
    window.setTimeout(() => {
      router.push(`/${ecosystem.route}`);
    }, 900);
  }

  return (
    <AnimatePresence>
      {open && ecosystem && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-void/85 p-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          role="presentation"
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden border bg-quantum/90 p-8"
            style={{
              borderColor: `${ecosystem.color}66`,
              boxShadow: `0 0 60px ${ecosystem.glow}33, inset 0 0 40px ${ecosystem.color}11`,
            }}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-modal-title"
          >
            {/* Hologram scanline overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)',
              }}
              aria-hidden="true"
            />

            <button
              type="button"
              onClick={handleClose}
              disabled={processing}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center border text-xs disabled:opacity-40"
              style={{ borderColor: `${ecosystem.color}55`, color: ecosystem.color }}
            >
              ✕
            </button>

            <p className="mb-1 text-[9px] uppercase tracking-[0.3em] text-gray-500">
              {t('badgeCoinGated')} · {t('badgeQuest')}
            </p>
            <h2
              id="entry-modal-title"
              className="mb-3 font-serif text-2xl font-bold text-white"
              style={{ textShadow: `0 0 24px ${ecosystem.glow}66` }}
            >
              {tEcosystems(`${ecosystem.messageKey}.title`)}
            </h2>
            <p className="mb-5 text-sm text-gray-400">
              {tEcosystems(`${ecosystem.messageKey}.description`)}
            </p>

            <div className="mb-5 border-l-2 pl-3" style={{ borderColor: `${ecosystem.color}55` }}>
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                {tEntry('rulesLabel')}
              </p>
              <p className="text-xs italic text-gray-400">
                {tEcosystems(`${ecosystem.messageKey}.rules`)}
              </p>
            </div>

            <div className="mb-6 space-y-2 border border-white/10 bg-void/60 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('cost')}</span>
                <span className="font-bold text-white">{cost.toLocaleString()} U-COIN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('yourBalance')}</span>
                <span className="font-bold" style={{ color: ecosystem.color }}>
                  {!configured || !session
                    ? '—'
                    : loading || balance === null
                      ? t('checkingBalance')
                      : `${balance.toLocaleString()} U-COIN`}
                </span>
              </div>
            </div>

            <p className="mb-6 text-center text-[10px] text-gray-600">{tWallet('currencyNote')}</p>

            {insufficient && !processing && !spendError && (
              <p className="mb-4 text-center text-[11px] font-bold text-red-400">
                {t('insufficientBalance')}
              </p>
            )}
            {spendError && (
              <p className="mb-4 text-center text-[11px] font-bold text-red-400">{spendError}</p>
            )}

            <button
              type="button"
              onClick={handlePayAndEnter}
              disabled={processing || (hasBalanceInfo && insufficient)}
              className="w-full py-3 text-xs font-bold uppercase tracking-widest text-void transition-all disabled:cursor-wait disabled:opacity-50"
              style={{ backgroundColor: processing ? `${ecosystem.color}88` : ecosystem.color }}
            >
              {processing ? tEntry('processing') : tEntry('payAndEnter')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
