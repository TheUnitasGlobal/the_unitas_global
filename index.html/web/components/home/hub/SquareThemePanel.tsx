'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { hasSovereignHint } from '@/lib/foundersGate';
import { GOVERNANCE_AXES } from '@/lib/governance';
import { hasHubSession, isHubServerConfigured } from '@/lib/hub/hubLedger';
import { readLedger } from '@/lib/hub/knowledgeExchange';
import { readActiveLockIns } from '@/lib/lockInModules';
import { MODULE_REGISTRY } from '@/lib/module-registry';
import { swarmCache } from '@/lib/swarm/swarmCache';
import {
  DAY_MS,
  SQUARE_SIGNAL_UNIT,
  squareSignalValue,
  type SquareSignalInput,
  type SquareTheme,
} from '@/lib/square/themes';

/**
 * REV-34 M4-A (founder directive 2026-09-16) -- one descriptor-driven face
 * for the fourteen U-Square themes that have no dedicated panel yet
 * (academy … master). Lede · four live signal tiles · three features · one
 * CTA that deep-links into a route that already exists.
 *
 * WHY every tile is read from local state: the square must render the same
 * on a cold reload, offline, and in an in-app WebView (Codex ch.7), so the
 * numbers are the device ledger, the wallet, the lock-in set, the registry
 * and governance sizes, the swarm cache -- plus three day-seeded doctrine
 * indices that change once per UTC day and never touch Math.random (D-11).
 * The day index and every storage read come from state initialisers, so a
 * render never calls Date.now() and never disagrees with itself.
 *
 * uMaster is founder-only: the public sees a locked state; only a browser
 * holding the sovereign hint cookie gets the `/sovereign` CTA. That is a
 * courtesy, not a gate -- middleware still answers 404 to anyone else.
 */
export interface SquareThemePanelProps {
  theme: SquareTheme;
}

export function SquareThemePanel({ theme }: SquareThemePanelProps) {
  const t = useTranslations('Rev34.square');
  const locale = useLocale();
  const { balance } = useWallet();
  const { playHoverSfx } = useSpatialAudio();

  const [dayIndex] = useState(() => Math.floor(Date.now() / DAY_MS));
  const [lockins] = useState(() => readActiveLockIns().length);
  const [ledger] = useState(() => readLedger());
  const [nodes] = useState(() => swarmCache.size);
  const [founderHint] = useState(() => hasSovereignHint());
  const [online, setOnline] = useState(false);

  // The server ledger is the only async source: a session check, skipped
  // outright when Supabase is not configured (guest / offline stays local).
  useEffect(() => {
    if (!isHubServerConfigured()) return;
    let cancelled = false;
    hasHubSession().then((live) => {
      if (!cancelled) setOnline(live);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const numberFmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const input: SquareSignalInput = {
    dayIndex,
    online,
    packs: ledger.purchases.length,
    sales: ledger.listings.length,
    coins: balance,
    lockins,
    modules: MODULE_REGISTRY.length,
    axes: GOVERNANCE_AXES.length,
    nodes,
  };

  const locked = theme.founderOnly === true && !founderHint;
  const Icon = theme.icon;

  return (
    <div
      className="qw-square-panel"
      data-square-panel={theme.key}
      data-hub-theme={theme.key}
      data-square-locked={locked ? '1' : '0'}
      style={{ '--qw-hub-accent': theme.color, '--qw-hub-glow': theme.glow } as CSSProperties}
    >
      <div className="qw-square-hero">
        <span className="qw-square-hero-icon" aria-hidden="true">
          <Icon size={22} />
        </span>
        <p className="qw-square-lede">{t(`themes.${theme.key}.lede`)}</p>
      </div>

      <ul className="qw-square-signals" data-square-signals="">
        {theme.signals.map((key) => {
          const value = squareSignalValue(key, input);
          const shown =
            value === null
              ? '—'
              : value === 'live'
                ? t('signals.live')
                : value === 'local'
                  ? t('signals.local')
                  : `${numberFmt.format(value)}${SQUARE_SIGNAL_UNIT[key] ?? ''}`;
          return (
            <li key={key} className="qw-square-signal qw-hubx-card" data-square-signal={key}>
              <strong className="qw-square-signal-value">{shown}</strong>
              <span className="qw-square-signal-label">{t(`signals.${key}`)}</span>
            </li>
          );
        })}
      </ul>

      <ul className="qw-square-features" data-square-features="">
        {([0, 1, 2] as const).map((i) => (
          <li key={i} className="qw-square-feature">
            <Check size={14} aria-hidden="true" />
            <span>{t(`themes.${theme.key}.features.${i}`)}</span>
          </li>
        ))}
      </ul>

      {locked ? (
        <div className="qw-square-locked" data-square-cta="locked" role="status">
          <Lock size={16} aria-hidden="true" />
          <span className="qw-square-locked-title">{t('locked')}</span>
          <span className="qw-square-locked-copy">{t('founderOnly')}</span>
        </div>
      ) : (
        <Link
          href={`/${theme.deepLink.route}`}
          className="qw-pill-btn qw-square-cta"
          data-square-cta={theme.deepLink.route}
          data-gated={theme.deepLink.gated ? '1' : '0'}
          data-on="1"
          onMouseEnter={() => playHoverSfx()}
        >
          <span>{t(`themes.${theme.key}.cta`)}</span>
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
