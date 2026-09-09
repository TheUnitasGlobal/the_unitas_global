'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { SINGULARITY_CLUSTERS, type ClusterKey, type SingularityCluster } from '@/lib/quantumWhite/clusters';
import { createPrecache, type Precache } from '@/lib/quantumWhite/precache';
import { acquireGate } from '@/lib/uiGate';
import { playHapticTic } from '@/lib/audio/haptics';
import { ClusterPopout } from './ClusterPopout';

/** Single-popup gate id this cluster grid (and its popout) coordinates on. */
const CLUSTER_GATE_ID = 'qw-cluster';

/** Orbit dot position, driven by CSS custom properties consumed in quantum-white.css. */
function orbitDotStyle(color: string, index: number, total: number): CSSProperties {
  return {
    backgroundColor: color,
    '--qw-i': index,
    '--qw-n': total,
  } as CSSProperties;
}

/**
 * REV-13 Singularity Core: the four cluster cores that replace the old
 * separate Ecosystem / Live Service / Lock-in / Enterprise section grids
 * (spec §3, §10.20). Each core is a single white-glass button; opening one
 * acquires the site-wide UI gate and hands off to `ClusterPopout`, which
 * renders through `ModalPortal` so it escapes `.dashboard-zoom`'s 0.75 zoom.
 */
export function SingularityCoreGrid() {
  const t = useTranslations('QuantumWhite');
  const tFull = useTranslations();
  const router = useRouter();
  const precache = useMemo<Precache>(() => createPrecache(router), [router]);
  const [openKey, setOpenKey] = useState<ClusterKey | null>(null);

  useEffect(() => () => precache.dispose(), [precache]);

  const openCluster = openKey ? SINGULARITY_CLUSTERS.find((c) => c.key === openKey) ?? null : null;

  function handleOpen(cluster: SingularityCluster) {
    if (!acquireGate(CLUSTER_GATE_ID)) return;
    playHapticTic();
    setOpenKey(cluster.key);
  }

  function handleClose() {
    setOpenKey(null);
  }

  return (
    <section className="qw-cluster-section mx-auto max-w-7xl px-6 pb-8 pt-16" aria-label={t('surfaceLabel')}>
      <div className="qw-cluster-grid grid grid-cols-1 gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))] lg:grid-cols-4">
        {SINGULARITY_CLUSTERS.map((cluster) => {
          const title = tFull(cluster.titleKey);
          return (
            <button
              key={cluster.key}
              type="button"
              className="qw-cluster-card unitas-tap flex min-h-[44px] flex-col items-center gap-1 rounded-[20px] border border-[var(--qw-line)] bg-[var(--qw-glass)] px-6 pb-7 pt-8 text-center backdrop-blur-md transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-[rgba(10,10,12,.16)] hover:shadow-[0_18px_40px_rgba(10,10,12,.08)] focus-visible:-translate-y-1 focus-visible:outline-none"
              onPointerEnter={() => precache.warmCluster(cluster)}
              onFocus={() => precache.warmCluster(cluster)}
              onClick={() => handleOpen(cluster)}
              aria-haspopup="dialog"
              aria-label={t('openCluster', { title })}
            >
              <span className="qw-cluster-orbit relative mb-2 h-[84px] w-[84px]" aria-hidden="true">
                {cluster.modules.map((m, i) => (
                  <span
                    key={m.id}
                    className="qw-cluster-dot absolute left-1/2 top-1/2 h-[7px] w-[7px] rounded-full shadow-[0_0_0_3px_#fff]"
                    style={orbitDotStyle(m.color, i, cluster.modules.length)}
                  />
                ))}
              </span>
              <span className="font-serif text-[1.2rem] font-bold tracking-[0.01em] text-[var(--qw-ink)]">
                {title}
              </span>
              <span className="max-w-[26ch] text-[0.82rem] text-[var(--qw-ink-3)]">
                {tFull(cluster.taglineKey)}
              </span>
              <span className="mt-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--qw-gold)]">
                {t('moduleCount', { count: cluster.modules.length })}
              </span>
            </button>
          );
        })}
      </div>

      <ClusterPopout cluster={openCluster} onClose={handleClose} precache={precache} />
    </section>
  );
}
