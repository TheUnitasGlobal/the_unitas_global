'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Coins, RefreshCw, ShieldCheck, ShieldAlert, Minus, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useWallet } from './WalletProvider';
import { GuestUpgradeStrip } from './GuestUpgradeStrip';
import { useCoinLedger } from './useCoinLedger';
import { SectionHeader } from './walletUi';
import {
  DEFAULT_WALLET_PREFS,
  SPENDABLE_MODULES,
  clampWalletPrefs,
  loadWalletPrefs,
  saveWalletPrefs,
  simulateSpend,
  verifyLedger,
  type SpendWindow,
  type WalletPrefs,
} from '@/lib/walletSimulation';

interface WalletBalanceModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * U-COIN control panel opened from the nav-bar coin badge. Four working
 * surfaces -- live balance summary, ledger integrity check, per-module spend
 * simulator, and an auto-spend limit -- all honest about what is live
 * (balance, ledger) vs. a local-only preference (auto-spend), and none of them
 * moving real balance (that only ever happens through `spend_coins()`).
 */
export function WalletBalanceModal({ open, onClose }: WalletBalanceModalProps) {
  const t = useTranslations('Wallet');
  const tModules = useTranslations('Modules');
  const tEcosystems = useTranslations('Ecosystems');
  const { session, balance, loading, configured } = useWallet();

  const signedIn = configured && Boolean(session);
  const { status: ledgerStatus, entries, reload } = useCoinLedger(open && signedIn, session?.user.id);

  const sectionLabels = {
    description: t('sec.description'),
    howto: t('sec.howto'),
    caution: t('sec.caution'),
  };
  const mkHint = (k: string) => ({
    label: t(`${k}.title`),
    title: t(`${k}.title`),
    description: t(`${k}.description`),
    howto: t(`${k}.howto`),
    caution: t(`${k}.caution`),
  });

  const balanceLabel = !signedIn
    ? '—'
    : loading || balance === null
      ? '···'
      : balance.toLocaleString();

  const lifetimeSpent = useMemo(
    () =>
      ledgerStatus === 'ready'
        ? entries
            .filter((e) => e.amount < 0)
            .reduce((sum, e) => sum + Math.abs(e.amount), 0)
        : null,
    [ledgerStatus, entries],
  );

  const verification = useMemo(
    () => verifyLedger(entries, signedIn ? balance : null),
    [entries, balance, signedIn],
  );

  // --- module spend simulator ---
  const [selections, setSelections] = useState<Record<string, number>>({});
  const sim = useMemo(
    () => simulateSpend(selections, signedIn ? balance : null),
    [selections, balance, signedIn],
  );
  const step = (key: string, delta: number) =>
    setSelections((prev) => {
      const next = Math.max(0, Math.min(9, (prev[key] ?? 0) + delta));
      return { ...prev, [key]: next };
    });

  const moduleTitle = (messageKey: string, tier: 'ecosystem' | 'b2c') =>
    tier === 'ecosystem'
      ? tEcosystems(`${messageKey}.title`)
      : tModules(`${messageKey}.title`);

  // --- auto-spend preference ---
  const [prefs, setPrefs] = useState<WalletPrefs>(DEFAULT_WALLET_PREFS);
  const [prefsSaved, setPrefsSaved] = useState(false);
  useEffect(() => {
    if (open) setPrefs(loadWalletPrefs());
  }, [open]);
  const patchPrefs = (patch: Partial<WalletPrefs>) => {
    setPrefs((prev) => {
      const next = clampWalletPrefs({ ...prev, ...patch });
      saveWalletPrefs(next);
      return next;
    });
    setPrefsSaved(true);
    window.setTimeout(() => setPrefsSaved(false), 1600);
  };

  useEffect(() => {
    if (!open) setSelections({});
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} labelledBy="wallet-balance-title" size="lg">
      <h2
        id="wallet-balance-title"
        className="mb-1 pr-8 font-serif text-lg font-bold text-accent"
      >
        {t('balanceTitle')}
      </h2>
      <p className="mb-6 text-xs leading-relaxed text-gray-500">
        {signedIn ? t('balanceBody') : t('signInRequired')}
      </p>

      <GuestUpgradeStrip />

      {/* 1 — real-time available balance summary */}
      <section className="mb-6 border border-white/10 bg-void/50 p-4">
        <SectionHeader
          title={t('bal.summaryTitle')}
          hint={mkHint('bal.summaryHint')}
          ariaHintPrefix={t('hintPrefix')}
          sectionLabels={sectionLabels}
          tag={{ label: t('tag.live'), tone: 'live' }}
        />
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coins size={26} className="text-accent/80" aria-hidden="true" />
            <span className="font-serif text-3xl font-bold text-neon">{balanceLabel}</span>
            <span className="text-[10px] uppercase tracking-widest text-gray-500">
              {t('coinUnit')}
            </span>
          </div>
          <button
            type="button"
            onClick={reload}
            className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-gray-500 transition-colors hover:text-neon"
          >
            <RefreshCw size={12} aria-hidden="true" />
            {t('bal.refresh')}
          </button>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="border border-white/5 bg-void/40 p-2">
            <dt className="uppercase tracking-widest text-gray-600">{t('bal.available')}</dt>
            <dd className="mt-1 font-bold text-white">{balanceLabel}</dd>
          </div>
          <div className="border border-white/5 bg-void/40 p-2">
            <dt className="uppercase tracking-widest text-gray-600">{t('bal.reserved')}</dt>
            <dd className="mt-1 font-bold text-white">
              {prefs.autoSpendEnabled ? prefs.autoSpendLimit.toLocaleString() : '0'}
            </dd>
          </div>
          <div className="border border-white/5 bg-void/40 p-2">
            <dt className="uppercase tracking-widest text-gray-600">{t('bal.lifetimeSpent')}</dt>
            <dd className="mt-1 font-bold text-white">
              {lifetimeSpent === null ? '—' : lifetimeSpent.toLocaleString()}
            </dd>
          </div>
        </dl>
      </section>

      {/* 2 — transaction history + real-time integrity verification */}
      <section className="mb-6 border border-white/10 bg-void/50 p-4">
        <SectionHeader
          title={t('bal.historyTitle')}
          hint={mkHint('bal.historyHint')}
          ariaHintPrefix={t('hintPrefix')}
          sectionLabels={sectionLabels}
          tag={{
            label: ledgerStatus === 'ready' ? t('tag.live') : t('tag.pending'),
            tone: ledgerStatus === 'ready' ? 'live' : 'pending',
          }}
        />

        {!signedIn && <p className="text-[11px] text-gray-500">{t('bal.historySignedOut')}</p>}
        {signedIn && ledgerStatus === 'loading' && (
          <p className="text-[11px] text-gray-500">···</p>
        )}
        {signedIn && ledgerStatus === 'unavailable' && (
          <p className="text-[11px] text-gray-500">{t('bal.historyUnavailable')}</p>
        )}
        {signedIn && ledgerStatus === 'ready' && entries.length === 0 && (
          <p className="text-[11px] text-gray-500">{t('bal.historyEmpty')}</p>
        )}

        {signedIn && ledgerStatus === 'ready' && entries.length > 0 && (
          <>
            <div
              className={`mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${
                verification.ok ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {verification.ok ? (
                <ShieldCheck size={12} aria-hidden="true" />
              ) : (
                <ShieldAlert size={12} aria-hidden="true" />
              )}
              {verification.ok
                ? t('bal.verifyPass', { count: verification.checked })
                : t('bal.verifyFail', { count: verification.breaks + (verification.headMismatch ? 1 : 0) })}
            </div>
            <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
              {entries.map((e, i) => (
                <li
                  key={`${e.created_at}-${i}`}
                  className="flex items-center justify-between gap-2 border-b border-white/5 py-1 text-[11px] last:border-0"
                >
                  <span className="truncate text-gray-400">
                    {e.module ?? t(`bal.kind.${e.kind}`)}
                  </span>
                  <span
                    className={`shrink-0 font-bold ${e.amount < 0 ? 'text-red-300' : 'text-green-300'}`}
                  >
                    {e.amount > 0 ? '+' : ''}
                    {e.amount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* 3 — per-module coin-consumption simulator */}
      <section className="mb-6 border border-white/10 bg-void/50 p-4">
        <SectionHeader
          title={t('bal.simTitle')}
          hint={mkHint('bal.simHint')}
          ariaHintPrefix={t('hintPrefix')}
          sectionLabels={sectionLabels}
          tag={{ label: t('tag.sim'), tone: 'sim' }}
        />
        <p className="mb-2 text-[11px] text-gray-500">{t('bal.simIntro')}</p>
        <ul className="max-h-44 space-y-1 overflow-y-auto pr-1">
          {SPENDABLE_MODULES.map((mod) => {
            const qty = selections[mod.key] ?? 0;
            return (
              <li
                key={mod.key}
                className="flex items-center justify-between gap-2 py-1 text-[11px]"
              >
                <span className="truncate text-gray-300">
                  {moduleTitle(mod.messageKey, mod.tier)}
                  <span className="ml-1 text-gray-600">· {mod.coinCost}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => step(mod.key, -1)}
                    aria-label={`${moduleTitle(mod.messageKey, mod.tier)} −`}
                    className="flex h-5 w-5 items-center justify-center border border-white/15 text-gray-400 transition-colors hover:border-neon hover:text-neon disabled:opacity-30"
                    disabled={qty === 0}
                  >
                    <Minus size={11} />
                  </button>
                  <span className="w-4 text-center font-bold text-white">{qty}</span>
                  <button
                    type="button"
                    onClick={() => step(mod.key, 1)}
                    aria-label={`${moduleTitle(mod.messageKey, mod.tier)} +`}
                    className="flex h-5 w-5 items-center justify-center border border-white/15 text-gray-400 transition-colors hover:border-neon hover:text-neon"
                  >
                    <Plus size={11} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-[11px]">
          <div className="flex justify-between">
            <span className="text-gray-500">{t('bal.simTotal')}</span>
            <span className="font-bold text-white">
              {sim.totalCost.toLocaleString()} {t('coinUnit')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t('bal.simRemaining')}</span>
            <span className={`font-bold ${sim.sufficient ? 'text-neon' : 'text-red-400'}`}>
              {sim.remaining === null ? '—' : sim.remaining.toLocaleString()}
            </span>
          </div>
          {!sim.sufficient && (
            <p className="pt-1 text-[10px] font-bold text-red-400">{t('bal.simInsufficient')}</p>
          )}
          {sim.totalCost > 0 && (
            <button
              type="button"
              onClick={() => setSelections({})}
              className="pt-1 text-[10px] uppercase tracking-widest text-gray-500 hover:text-white"
            >
              {t('bal.simReset')}
            </button>
          )}
        </div>
      </section>

      {/* 4 — auto-spending (auto-approve) limit */}
      <section className="mb-6 border border-white/10 bg-void/50 p-4">
        <SectionHeader
          title={t('bal.autoTitle')}
          hint={mkHint('bal.autoHint')}
          hintKind="warn"
          ariaHintPrefix={t('hintPrefix')}
          sectionLabels={sectionLabels}
          tag={{ label: t('tag.local'), tone: 'local' }}
        />
        <label className="flex items-center justify-between gap-3 text-[11px] text-gray-300">
          <span>{t('bal.autoEnable')}</span>
          <input
            type="checkbox"
            checked={prefs.autoSpendEnabled}
            onChange={(e) => patchPrefs({ autoSpendEnabled: e.target.checked })}
            className="h-4 w-4 accent-[#00f3ff]"
          />
        </label>
        <div
          className={`mt-3 grid grid-cols-2 gap-3 transition-opacity ${
            prefs.autoSpendEnabled ? 'opacity-100' : 'pointer-events-none opacity-40'
          }`}
        >
          <label className="text-[10px] uppercase tracking-widest text-gray-500">
            {t('bal.autoLimit')}
            <input
              type="number"
              min={1}
              max={1000}
              value={prefs.autoSpendLimit}
              onChange={(e) => patchPrefs({ autoSpendLimit: Number(e.target.value) })}
              className="mt-1 w-full border border-white/15 bg-void/60 px-2 py-1 text-sm font-bold text-white focus:border-neon focus:outline-none"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest text-gray-500">
            {t('bal.autoWindow')}
            <select
              value={prefs.autoSpendWindow}
              onChange={(e) => patchPrefs({ autoSpendWindow: e.target.value as SpendWindow })}
              className="mt-1 w-full border border-white/15 bg-void/60 px-2 py-1 text-sm font-bold text-white focus:border-neon focus:outline-none"
            >
              <option value="day">{t('bal.window.day')}</option>
              <option value="week">{t('bal.window.week')}</option>
              <option value="month">{t('bal.window.month')}</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-600">
          {prefsSaved ? t('saved') : t('bal.autoNote')}
        </p>
      </section>

      <p className="mb-4 text-center text-[10px] leading-relaxed text-gray-600">
        {t('currencyNote')}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="w-full bg-accent py-3 text-xs font-bold uppercase tracking-widest text-void transition-all hover:bg-white"
      >
        {t('close')}
      </button>
    </Modal>
  );
}
