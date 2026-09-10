'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { UPayGateway } from '@/components/upay/UPayGateway';
import { hasSovereignHint } from '@/lib/foundersGate';
import { isLockInModuleKey, readActiveLockIns, toggleLockIn, writeActiveLockIns } from '@/lib/lockInModules';
import type { ClusterKey, ClusterModule } from '@/lib/quantumWhite/clusters';
import { ClusterSigil } from '@/lib/quantumWhite/clusterSigils';

interface EntryGateProps {
  module: ClusterModule;
}

/** Which of the four Singularity Core sigils stands in for a module's kind on its own Entry Gate stage (SPEC.md §6.3). */
const KIND_TO_CLUSTER: Readonly<Record<ClusterModule['kind'], ClusterKey>> = {
  ecosystem: 'cognitive',
  lifeos: 'cognitive',
  b2c: 'live',
  lockin: 'lockin',
  b2b: 'enterprise',
};

/**
 * REV-17 (SPEC.md §6.7): how long the success block stays visible before a
 * routed, executable investment auto-proceeds to the module's own page --
 * long enough to see the Quantum Blue pulse land, short enough that "Enter"
 * doesn't feel like it needs a second confirming tap. `0` disables it.
 */
const ENTRY_AUTO_PROCEED_MS = 700;

/**
 * REV-17 "Entry Gate" (SPEC.md §6): the module detail + one-click investment
 * surface, promoted from a side slide-over into the pop-out's second VIEW
 * (`ClusterPopout`'s `data-view="entry"`). Renders only its two content
 * halves -- the scrollable scenario/guide/legal-notice stack (top) and the
 * sticky U-Pay zone (bottom) -- the shared dialog chrome (header, focus
 * trap, ESC, backdrop) stays owned by `ClusterPopout`.
 *
 * Ported from the retired `ModulePopupSpace.tsx`: title/description/cost
 * resolution, the founder-only executability gate for `lifeos`, the
 * lock-in activation toggle and the post-investment action all carry over
 * unchanged; only the surrounding content and the U-Pay CTA copy changed
 * (SPEC.md §6.5 -- "Invest now" -> "Enter" / "입장하기").
 */
export function EntryGate({ module }: EntryGateProps) {
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

  const canEnter =
    invested &&
    module.kind !== 'lockin' &&
    module.hasRoute &&
    (module.kind !== 'lifeos' || founderHint);
  const canActivate = invested && module.kind === 'lockin';

  // REV-17 (SPEC.md §6.7): once a burn succeeds for a routed, executable
  // module, move on automatically after the success pulse has had a beat to
  // register, instead of requiring a second tap on "Step inside".
  useEffect(() => {
    if (!invested || !canEnter || ENTRY_AUTO_PROCEED_MS <= 0) return undefined;
    const timer = window.setTimeout(() => router.push(module.href), ENTRY_AUTO_PROCEED_MS);
    return () => window.clearTimeout(timer);
  }, [invested, canEnter, module.href, router]);

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

  const stageCluster = KIND_TO_CLUSTER[module.kind];
  const guideBase = `entry.guide.${module.kind}`;

  return (
    <>
      <div className="qw-entry-scroll">
        <div className="qw-entry-stage" data-video-slot={module.id} data-video-src="">
          <span
            className="qw-entry-stage-sigil"
            style={{ '--qw-sigil-accent': module.color } as CSSProperties}
            aria-hidden="true"
          >
            <ClusterSigil cluster={stageCluster} />
          </span>
          <span className="qw-entry-stage-caption">{t('entry.stageStandby')}</span>
        </div>

        <div className="qw-entry-scenario">
          <p className="qw-entry-eyebrow">{t('entry.eyebrowScenario')}</p>
          <p className="qw-entry-scenario-text">{tFull(module.i18n.scenarioKey)}</p>
        </div>

        <div className="qw-entry-guide">
          <p className="qw-entry-eyebrow">{t('entry.eyebrowGuide')}</p>
          <ul>
            <li>{t(`${guideBase}.g1`)}</li>
            <li>{t(`${guideBase}.g2`)}</li>
            <li>{t(`${guideBase}.g3`)}</li>
          </ul>
        </div>

        <div className="qw-entry-notice" role="note">
          <p className="qw-entry-eyebrow">{t('entry.eyebrowNotice')}</p>
          <ol>
            <li>{t('entry.notice.n1')}</li>
            <li>{t('entry.notice.n2')}</li>
            <li>{t('entry.notice.n3')}</li>
            <li>{t('entry.notice.n4')}</li>
          </ol>
          <a href="/legal/terms" className="qw-entry-legal-link">
            {t('entry.notice.legalLink')}
          </a>
        </div>
      </div>

      <div className="qw-entry-pay">
        <UPayGateway module={module} founder={founderHint} onSuccess={handleSuccess} />

        {invested && (
          <div
            className="qw-module-success flex flex-col gap-2 rounded-2xl border border-[var(--qw-line)] bg-[var(--qw-bg-2)] p-4"
            role="status"
          >
            <p className="text-sm font-bold text-[var(--qw-ink)]">{t('successTitle')}</p>
            <p className="text-xs text-[var(--qw-ink-3)]">{t('successBody')}</p>
            {balanceAfter !== null && (
              <p className="text-xs font-semibold tabular-nums text-[var(--qw-ink-2)]">
                {t('balanceLabel')}: {balanceAfter.toLocaleString()} {t('coinUnit')}
              </p>
            )}

            {canEnter && (
              <button type="button" className="qw-upay-btn unitas-tap mt-1" onClick={handleEnter}>
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
    </>
  );
}
