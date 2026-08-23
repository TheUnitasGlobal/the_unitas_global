'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Modal } from '@/components/ui/Modal';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import type { B2CModule } from '@/lib/modules';

interface ModuleQuestModalProps {
  module: B2CModule | null;
  onClose: () => void;
}

/**
 * Opens on B2C card click: an immediate coin-balance check before entering
 * the quest/simulation subpage. The subpage itself is still a scaffolded
 * placeholder (see [[project-unitas-web-nextjs-scaffold]] memory) -- this
 * modal is the honest "gate" step the request asked for, not a fake quiz.
 */
export function ModuleQuestModal({ module, onClose }: ModuleQuestModalProps) {
  const t = useTranslations('B2C');
  const tModules = useTranslations('Modules');
  const tWallet = useTranslations('Wallet');
  const { session, balance, loading, configured } = useWallet();
  const { playQuestEnterSfx } = useSpatialAudio();
  const router = useRouter();

  const open = module !== null;
  const cost = module?.coinCost ?? 0;
  const hasBalanceInfo = configured && Boolean(session) && balance !== null && !loading;
  const insufficient = hasBalanceInfo && (balance as number) < cost;

  function handleEnter() {
    if (!module) return;
    playQuestEnterSfx();
    onClose();
    router.push(`/${module.route}`);
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="quest-modal-title">
      {module && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="border border-green-400/40 bg-green-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-green-400">
              {t('badgeLive')}
            </span>
            <span className="border border-accent/40 bg-accent/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-accent">
              {t('badgeCoinGated')}
            </span>
            <span className="border border-neon/40 bg-neon/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-neon">
              {t('badgeQuest')}
            </span>
          </div>

          <h2 id="quest-modal-title" className="mb-2 font-serif text-xl font-bold text-white">
            {tModules(`${module.messageKey}.title`)}
          </h2>
          <p className="mb-6 text-sm text-gray-400">
            {tModules(`${module.messageKey}.description`)}
          </p>

          <div className="mb-6 space-y-2 border border-white/10 bg-void/60 p-4 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('cost')}</span>
              <span className="font-bold text-white">{cost.toLocaleString()} U-COIN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('yourBalance')}</span>
              <span className="font-bold text-neon">
                {!configured || !session
                  ? '—'
                  : loading || balance === null
                    ? t('checkingBalance')
                    : `${balance.toLocaleString()} U-COIN`}
              </span>
            </div>
          </div>

          <p className="mb-4 text-center text-[10px] text-gray-600">{tWallet('currencyNote')}</p>

          {insufficient && (
            <p className="mb-4 text-center text-[11px] font-bold text-red-400">
              {t('insufficientBalance')}
            </p>
          )}

          <button
            type="button"
            onClick={handleEnter}
            className="w-full bg-accent py-3 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white"
          >
            {t('enterQuest')}
          </button>
        </>
      )}
    </Modal>
  );
}
