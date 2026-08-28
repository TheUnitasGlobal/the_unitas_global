'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Coins, FileLock2, Zap } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useWallet } from './WalletProvider';
import { GuestUpgradeStrip } from './GuestUpgradeStrip';
import { SectionHeader, StatusDot } from './walletUi';
import {
  CHARGE_PACKAGES,
  DEFAULT_WALLET_PREFS,
  clampWalletPrefs,
  loadWalletPrefs,
  packageTotalCoins,
  pricePerCoin,
  saveWalletPrefs,
  type ChargeTier,
  type WalletPrefs,
} from '@/lib/walletSimulation';

interface ChargeCoinsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Charge Coins panel. The purchase itself is NOT wired up in this portal (see
 * the root static site's Stripe-backed create-coin-checkout-session for the
 * live flow) -- so the gateway status is shown honestly as "pending" and the
 * proceed button is inert. Everything above it (package selection, auto-refill
 * threshold, invoice details) is real, usable configuration that a live
 * checkout would consume.
 */
export function ChargeCoinsModal({ open, onClose }: ChargeCoinsModalProps) {
  const t = useTranslations('Wallet');
  const { balance, configured, session } = useWallet();

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

  const bestValueTier = useMemo(() => {
    let best = CHARGE_PACKAGES[0];
    for (const pkg of CHARGE_PACKAGES) {
      if (pricePerCoin(pkg) < pricePerCoin(best)) best = pkg;
    }
    return best.tier;
  }, []);

  const [selectedTier, setSelectedTier] = useState<ChargeTier>('pro');
  const selectedPackage =
    CHARGE_PACKAGES.find((p) => p.tier === selectedTier) ?? CHARGE_PACKAGES[1];

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

  const [invoice, setInvoice] = useState({ company: '', vat: '', email: '' });
  useEffect(() => {
    if (!open) setInvoice({ company: '', vat: '', email: '' });
  }, [open]);

  const projectedBalance =
    balance === null ? null : balance + packageTotalCoins(selectedPackage);

  return (
    <Modal open={open} onClose={onClose} labelledBy="charge-coins-title" size="lg">
      <h2 id="charge-coins-title" className="mb-1 pr-8 font-serif text-lg font-bold text-accent">
        {t('chargeTitle')}
      </h2>
      <p className="mb-6 text-xs leading-relaxed text-gray-500">{t('chargeBody')}</p>

      <GuestUpgradeStrip />

      {/* 1 — tiered smart charge packages */}
      <section className="mb-6 border border-white/10 bg-void/50 p-4">
        <SectionHeader
          title={t('chg.packagesTitle')}
          hint={mkHint('chg.packagesHint')}
          ariaHintPrefix={t('hintPrefix')}
          sectionLabels={sectionLabels}
        />
        <p className="mb-3 text-[11px] text-gray-500">{t('chg.packagesIntro')}</p>
        <div className="space-y-2">
          {CHARGE_PACKAGES.map((pkg) => {
            const selected = pkg.tier === selectedTier;
            return (
              <button
                key={pkg.tier}
                type="button"
                onClick={() => setSelectedTier(pkg.tier)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-3 border p-3 text-left transition-colors ${
                  selected
                    ? 'border-neon bg-neon/10'
                    : 'border-white/10 bg-void/40 hover:border-white/30'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    selected ? 'border-neon bg-neon text-void' : 'border-white/30'
                  }`}
                >
                  {selected && <Check size={11} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-serif text-xs font-bold uppercase tracking-widest text-white">
                      {t(`chg.tier.${pkg.tier}`)}
                    </span>
                    {pkg.tier === bestValueTier && (
                      <span className="border border-accent/40 bg-accent/10 px-1 py-0.5 text-[8px] font-bold uppercase tracking-widest text-accent">
                        {t('chg.bestValue')}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-gray-500">
                    {t(`chg.tierDesc.${pkg.tier}`)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold text-neon">
                    {packageTotalCoins(pkg).toLocaleString()}
                    <span className="ml-1 text-[9px] uppercase text-gray-500">{t('coinUnit')}</span>
                  </span>
                  <span className="block text-[10px] text-gray-400">
                    €{pkg.priceEur.toLocaleString()}
                  </span>
                  {pkg.bonusCoins > 0 && (
                    <span className="block text-[9px] font-bold text-green-400">
                      {t('chg.bonusBadge', { n: pkg.bonusCoins })}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[11px]">
          <span className="text-gray-500">{t('chg.summaryEstimate')}</span>
          <span className="font-bold text-white">
            {balance === null ? '—' : balance.toLocaleString()}
            <span className="mx-1 text-gray-600">→</span>
            <span className="text-neon">
              {projectedBalance === null ? '—' : projectedBalance.toLocaleString()}
            </span>{' '}
            {t('coinUnit')}
          </span>
        </div>
      </section>

      {/* 2 — instant payment gateway status */}
      <section className="mb-6 border border-white/10 bg-void/50 p-4">
        <SectionHeader
          title={t('chg.gatewayTitle')}
          hint={mkHint('chg.gatewayHint')}
          ariaHintPrefix={t('hintPrefix')}
          sectionLabels={sectionLabels}
          tag={{ label: t('tag.pending'), tone: 'pending' }}
        />
        <div className="space-y-2 text-[11px] text-gray-300">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Zap size={12} className="text-accent/70" aria-hidden="true" />
              {t('chg.gatewayStripe')}
            </span>
            <StatusDot tone="pending" label={t('chg.status.pending')} />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Coins size={12} className="text-accent/70" aria-hidden="true" />
              {t('chg.gatewayWeb3')}
            </span>
            <StatusDot tone="offline" label={t('chg.status.offline')} />
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-600">{t('chg.gatewayNote')}</p>
      </section>

      {/* 3 — auto-refill threshold */}
      <section className="mb-6 border border-white/10 bg-void/50 p-4">
        <SectionHeader
          title={t('chg.autoRefillTitle')}
          hint={mkHint('chg.autoRefillHint')}
          hintKind="warn"
          ariaHintPrefix={t('hintPrefix')}
          sectionLabels={sectionLabels}
          tag={{ label: t('tag.local'), tone: 'local' }}
        />
        <label className="flex items-center justify-between gap-3 text-[11px] text-gray-300">
          <span>{t('chg.autoRefillEnable')}</span>
          <input
            type="checkbox"
            checked={prefs.autoRefillEnabled}
            onChange={(e) => patchPrefs({ autoRefillEnabled: e.target.checked })}
            className="h-4 w-4 accent-[#00f3ff]"
          />
        </label>
        <div
          className={`mt-3 grid grid-cols-2 gap-3 transition-opacity ${
            prefs.autoRefillEnabled ? 'opacity-100' : 'pointer-events-none opacity-40'
          }`}
        >
          <label className="text-[10px] uppercase tracking-widest text-gray-500">
            {t('chg.autoRefillThreshold')}
            <input
              type="number"
              min={0}
              max={1000}
              value={prefs.autoRefillThreshold}
              onChange={(e) => patchPrefs({ autoRefillThreshold: Number(e.target.value) })}
              className="mt-1 w-full border border-white/15 bg-void/60 px-2 py-1 text-sm font-bold text-white focus:border-neon focus:outline-none"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest text-gray-500">
            {t('chg.autoRefillPackageLabel')}
            <select
              value={prefs.autoRefillPackage}
              onChange={(e) => patchPrefs({ autoRefillPackage: e.target.value as ChargeTier })}
              className="mt-1 w-full border border-white/15 bg-void/60 px-2 py-1 text-sm font-bold text-white focus:border-neon focus:outline-none"
            >
              <option value="starter">{t('chg.tier.starter')}</option>
              <option value="pro">{t('chg.tier.pro')}</option>
              <option value="sovereign">{t('chg.tier.sovereign')}</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-600">
          {prefsSaved ? t('saved') : t('chg.autoRefillNote')}
        </p>
      </section>

      {/* 4 — secure invoice issuance */}
      <section className="mb-6 border border-white/10 bg-void/50 p-4">
        <SectionHeader
          title={t('chg.invoiceTitle')}
          hint={mkHint('chg.invoiceHint')}
          ariaHintPrefix={t('hintPrefix')}
          sectionLabels={sectionLabels}
          tag={{ label: t('tag.pending'), tone: 'pending' }}
        />
        <p className="mb-3 text-[11px] text-gray-500">{t('chg.invoiceIntro')}</p>
        <div className="space-y-2">
          <input
            type="text"
            value={invoice.company}
            onChange={(e) => setInvoice((p) => ({ ...p, company: e.target.value }))}
            placeholder={t('chg.invoiceCompany')}
            className="w-full border border-white/15 bg-void/60 px-2 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-neon focus:outline-none"
          />
          <input
            type="text"
            value={invoice.vat}
            onChange={(e) => setInvoice((p) => ({ ...p, vat: e.target.value }))}
            placeholder={t('chg.invoiceVat')}
            className="w-full border border-white/15 bg-void/60 px-2 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-neon focus:outline-none"
          />
          <input
            type="email"
            value={invoice.email}
            onChange={(e) => setInvoice((p) => ({ ...p, email: e.target.value }))}
            placeholder={t('chg.invoiceEmail')}
            className="w-full border border-white/15 bg-void/60 px-2 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-neon focus:outline-none"
          />
        </div>
        <button
          type="button"
          disabled
          className="mt-3 flex w-full items-center justify-center gap-2 border border-white/15 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500"
        >
          <FileLock2 size={12} aria-hidden="true" />
          {t('chg.invoiceGenerate')}
        </button>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-600">{t('chg.invoicePending')}</p>
      </section>

      <button
        type="button"
        disabled
        aria-disabled="true"
        className="w-full cursor-not-allowed bg-accent/40 py-3 text-xs font-bold uppercase tracking-widest text-void/70"
      >
        {t('chg.proceedPending')}
      </button>
      <p className="mt-3 text-center text-[10px] leading-relaxed text-gray-600">
        {configured && session ? t('currencyNote') : t('signInRequired')}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full border border-white/15 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-white"
      >
        {t('close')}
      </button>
    </Modal>
  );
}
