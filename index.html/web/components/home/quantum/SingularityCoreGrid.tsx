'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { SINGULARITY_CLUSTERS, type ClusterKey, type SingularityCluster } from '@/lib/quantumWhite/clusters';
import { ClusterSigil } from '@/lib/quantumWhite/clusterSigils';
import {
  SURFACE_MIRROR_KEY,
  SURFACE_TOMBSTONE,
  encodeSurface,
  resolveInitialSurface,
  stripRouterKeys,
  surfaceHref,
  type SurfaceState,
} from '@/lib/quantumWhite/surfaceState';
import { createPrecache, type Precache } from '@/lib/quantumWhite/precache';
import { acquireGate } from '@/lib/uiGate';
import { playHapticTic } from '@/lib/audio/haptics';
import { writeVisitLedger } from '@/lib/entry/visitLedgerWriter';
import { useCurtainReleased } from './useCurtainReleased';
import { ClusterPopout } from './ClusterPopout';

/** Single-popup gate id this cluster grid (and its popout) coordinates on. */
const CLUSTER_GATE_ID = 'qw-cluster';

/**
 * REV-13 Singularity Core: the four cluster cores that replace the old
 * separate Ecosystem / Live Service / Lock-in / Enterprise section grids
 * (spec §3, §10.20). Each core is a single white-glass button; opening one
 * acquires the site-wide UI gate and hands off to `ClusterPopout`, which
 * renders through `ModalPortal` so it escapes `.dashboard-zoom`'s 0.75 zoom.
 *
 * REV-17 (SPEC.md §3.3-3.4): this component is now the SOLE writer of the
 * "which cluster / module pop-out is open" surface state, mirrored into
 * sessionStorage (`SURFACE_MIRROR_KEY`), the URL hash (`#core/<cluster>
 * [/<moduleId>]`) and the visit ledger -- see `commitSurface` below. On the
 * first render after the curtain releases, it also RESTORES that state (a
 * refresh, a same-document App cold-relaunch restore, or a deep link no
 * longer drops the visitor back at a bare home with no popup open).
 */
export function SingularityCoreGrid() {
  const t = useTranslations('QuantumWhite');
  const tFull = useTranslations();
  const router = useRouter();
  const released = useCurtainReleased();
  const precache = useMemo<Precache>(() => createPrecache(router), [router]);
  const [openKey, setOpenKey] = useState<ClusterKey | null>(null);
  const initialModuleIdRef = useRef<string | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => () => precache.dispose(), [precache]);

  const openCluster = openKey ? SINGULARITY_CLUSTERS.find((c) => c.key === openKey) ?? null : null;

  /**
   * The one place `SURFACE_MIRROR_KEY` / the URL hash / the visit ledger's
   * `surface` field are ever written. Deliberately a `replaceState` with
   * Next's own router-private keys stripped out (see `stripRouterKeys`'s
   * doc comment) so the hash actually survives the router's own next
   * history write, while every OTHER key already on the entry (in
   * particular ExitGuard's sentinel marker/depth) is preserved untouched.
   */
  const writeSurfaceRecord = useCallback((next: SurfaceState | null) => {
    try {
      sessionStorage.setItem(SURFACE_MIRROR_KEY, next ? encodeSurface(next) : SURFACE_TOMBSTONE);
    } catch {
      /* non-fatal -- the mirror is a restore convenience only. */
    }
    writeVisitLedger({ surface: next ? encodeSurface(next) : undefined });
  }, []);

  const commitSurface = useCallback(
    (next: SurfaceState | null) => {
      writeSurfaceRecord(next);
      try {
        const href = surfaceHref(window.location, next);
        window.history.replaceState(stripRouterKeys(window.history.state), '', href);
      } catch {
        /* history unavailable -- nothing further to do. */
      }
    },
    [writeSurfaceRecord],
  );

  /** REV-19 §1: the URL of a surface belongs to that surface's OWN history
   *  entry on the deep modal stack (ClusterPopout pushes it), so the entry
   *  beneath keeps the URL it had -- a back press then lands on a URL that
   *  matches what is on screen. Opening therefore writes the mirror/ledger
   *  only; closing still rewrites the (now current) entry. */
  const surfaceHrefFor = useCallback(
    (moduleId: string | null) => {
      if (!openKey) return '';
      try {
        return surfaceHref(window.location, { cluster: openKey, moduleId: moduleId ?? undefined });
      } catch {
        return '';
      }
    },
    [openKey],
  );

  // REV-17 (SPEC.md §3.4): restore whatever surface was open the moment the
  // curtain releases -- same commit as the home itself, so there is no
  // "bare home, then popup" flash. A `useLayoutEffect` (not `useEffect`)
  // because that "same commit" property is the whole point; harmless on the
  // server since `released` only ever flips true client-side.
  useLayoutEffect(() => {
    if (!released || restoredRef.current) return;
    restoredRef.current = true;
    let mirror: string | null = null;
    try {
      mirror = sessionStorage.getItem(SURFACE_MIRROR_KEY);
    } catch {
      /* no-op -- falls through to the URL hash below. */
    }
    let hash = '';
    try {
      hash = window.location.hash;
    } catch {
      /* no-op */
    }
    const resolved = resolveInitialSurface({ hash, mirror }, SINGULARITY_CLUSTERS);
    if (!resolved) return;
    if (!acquireGate(CLUSTER_GATE_ID)) return; // another surface already owns the single-popup gate.
    playHapticTic();
    initialModuleIdRef.current = resolved.moduleId ?? null;
    setOpenKey(resolved.cluster);
  }, [released]);

  function handleOpen(cluster: SingularityCluster) {
    if (!acquireGate(CLUSTER_GATE_ID)) return;
    playHapticTic();
    initialModuleIdRef.current = null;
    setOpenKey(cluster.key);
    writeSurfaceRecord({ cluster: cluster.key });
  }

  function handleClose() {
    setOpenKey(null);
    commitSurface(null);
  }

  function handleModuleChange(moduleId: string | null) {
    if (!openKey) return;
    if (moduleId) writeSurfaceRecord({ cluster: openKey, moduleId });
    else commitSurface({ cluster: openKey });
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
              <span className="qw-cluster-sigil" style={{ '--qw-sigil-accent': cluster.accent } as CSSProperties} aria-hidden="true">
                <ClusterSigil cluster={cluster.key} />
              </span>
              <span className="qw-cluster-title font-serif text-[var(--qw-ink)]">{title}</span>
              <span className="qw-cluster-tagline text-[var(--qw-ink-3)]">{tFull(cluster.taglineKey)}</span>
            </button>
          );
        })}
      </div>

      <ClusterPopout
        cluster={openCluster}
        onClose={handleClose}
        onModuleChange={handleModuleChange}
        initialModuleId={initialModuleIdRef.current}
        precache={precache}
        surfaceHrefFor={surfaceHrefFor}
      />
    </section>
  );
}
