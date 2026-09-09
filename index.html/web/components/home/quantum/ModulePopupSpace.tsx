'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { UPayGateway } from '@/components/upay/UPayGateway';
import { hasSovereignHint } from '@/lib/foundersGate';
import { isLockInModuleKey, readActiveLockIns, toggleLockIn, writeActiveLockIns } from '@/lib/lockInModules';
import type { ClusterModule } from '@/lib/quantumWhite/clusters';

interface ModulePopupSpaceProps {
  module: ClusterModule;
}

/**
 * REV-13 module detail + one-click investment panel (spec §3, §10.6-9):
 * title/description/cost resolved from `module.i18n` (root-namespace full
 * keys) or, for lock-in modules, the literal owner-named brand mark; renders
 * `UPayGateway` for every module kind (b2b resolves the same as ecosystem/
 * b2c/lockin; lifeos only resolves executable for a verified founder hint,
 * `planInvestment` marks it `unlisted` for everyone else); once a burn (or a
 * double-burn-guard reuse) succeeds, reveals the matching post-investment
 * action for the module's kind.
 */
export function ModulePopupSpace({ module }: ModulePopupSpaceProps) {
  const t = useTranslations('QuantumWhite');
  const tFull = useTranslations();
  const router = useRouter();

  const [invested, setInvested] = useState(false);
  const [balanceAfter, setBalanceAfter] = useState<number | null>(null);
  const [locallyActive, setLocallyActive] = useState(false);
  // Client-visible hint cookie only (not server-verified) -- exactly the
  // read `canEnter` already relied on below; gates whether `lifeos` even
  // attempts a burn (see `UPayGateway`'s `founder` prop / `planInvestment`).
  const founderHint = hasSovereignHint();

  // Every module the popout can open is a fresh subject -- never carry a
  // previous tile's investment/activation state into this one.
  useEffect(() => {
    setInvested(false);
    setBalanceAfter(null);
    setLocallyActive(isLockInModuleKey(module.key) ? readActiveLockIns().includes(module.key) : false);
  }, [module.id, module.key]);

  function handleSuccess(result: { balanceAfter: number | null; reused: boolean }) {
    setBalanceAfter(result.balanceAfter);
    setInvested(true);
  }

  function handleActivate() {
    if (!isLockInModuleKey(module.key)) return;
    const next = toggleLockIn(readActiveLockIns(), module.key);
    writeActiveLockIns(next);
    setLocallyActive(next.includes(module.key));
  }

  function handleEnter() {
    if (module.hasRoute) router.push(module.href);
  }

  const title = module.i18n.titleKey ? tFull(module.i18n.titleKey) : module.literalTitle ?? '';
  const description = tFull(module.i18n.descriptionKey);

  const canEnter =
    invested &&
    module.kind !== 'lockin' &&
    module.hasRoute &&
    (module.kind !== 'lifeos' || founderHint);
  const canActivate = invested && module.kind === 'lockin';

  return (
    <div className="qw-module-panel flex flex-col gap-4">
      <span
        className="qw-module-accent block h-1.5 w-16 rounded-full"
        style={{ backgroundColor: module.color }}
        aria-hidden="true"
      />
      <div>
        <h3 className="font-serif text-lg font-bold text-[var(--qw-ink)]">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--qw-ink-3)]">{description}</p>
      </div>

      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--qw-ink-2)]">
        <span>{t('costLabel')}</span>
        <span className="qw-upay-chip inline-flex w-fit items-center text-[0.72rem]">
          {module.coinCost} {t('coinUnit')}
        </span>
      </p>

      <UPayGateway module={module} founder={founderHint} onSuccess={handleSuccess} />

      {invested && (
        <div className="qw-module-success flex flex-col gap-2 rounded-2xl border border-[var(--qw-line)] bg-[var(--qw-bg-2)] p-4" role="status">
          <p className="text-sm font-bold text-[var(--qw-ink)]">{t('successTitle')}</p>
          <p className="text-xs text-[var(--qw-ink-3)]">{t('successBody')}</p>
          {balanceAfter !== null && (
            <p className="text-xs font-semibold tabular-nums text-[var(--qw-ink-2)]">
              {t('balanceLabel')}: {balanceAfter.toLocaleString()} {t('coinUnit')}
            </p>
          )}

          {canEnter && (
            <button
              type="button"
              className="qw-upay-btn unitas-tap mt-1"
              onClick={handleEnter}
            >
              {t('enterModule')}
            </button>
          )}

          {canActivate &&
            (locallyActive ? (
              <span className="mt-1 inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--qw-line)] px-6 text-sm font-bold text-[var(--qw-ink-2)]">
                {t('activated')}
              </span>
            ) : (
              <button
                type="button"
                className="qw-upay-btn unitas-tap mt-1 flex min-h-[44px] items-center justify-center rounded-full px-6 text-sm font-bold text-[var(--qw-ink)]"
                onClick={handleActivate}
              >
                {t('activateModule')}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
