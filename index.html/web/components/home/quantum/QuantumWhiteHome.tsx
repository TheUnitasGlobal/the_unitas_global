'use client';

import '@/app/quantum-white.css';

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Hero } from '../Hero';
import { OmniSynapseSearch } from '../OmniSynapseSearch';
import { EcosystemEntryModal } from '@/components/interaction/EcosystemEntryModal';
import { HotShortcutResultModal } from '@/components/interaction/HotShortcutResultModal';
import { Footer } from '@/components/layout/Footer';
import { SovereignShield } from '@/components/system/SovereignShield';
import { SectionShield } from '@/components/system/PageShield';
import { useUai } from '@/lib/uai/useUai';
import type { EcosystemTheme } from '@/lib/ecosystems';
import { HOT_SHORTCUT_MATRIX, findShortcutAxis, type HotShortcutAxis } from '@/lib/hotIssues';
import { setAmbientBedSuppressed } from '@/components/audio/SpatialAudioProvider';
import { applyChrono, clearChrono } from '@/lib/quantumWhite/chrono';
import { startUSignatureCollector } from '@/lib/security/uSignature';
import { USignatureHoneypot } from '@/components/security/USignatureHoneypot';
import { QuantumBluePulseHost } from '@/components/upay/QuantumBluePulse';
import { APP_EXIT_EVENT, APP_TERMINATE_EVENT } from '@/lib/exit/appExit';
import { QuantumVoid } from './QuantumVoid';
import { SingularityCoreGrid } from './SingularityCoreGrid';
import { SovereignWatermark } from './SovereignWatermark';
import { useCurtainReleased } from './useCurtainReleased';

/** `<html data-unitas-surface="...">` value the whole theme scope keys on. */
const SURFACE_VALUE = 'quantum-white';
/** Re-derive the chrono luminance/warmth bands every 10 minutes (spec §2). */
const CHRONO_INTERVAL_MS = 10 * 60 * 1000;

/** Same storage key HomeContent used -- keeps a reopened shortcut consistent
 *  across a next-intl locale switch (which remounts the client tree). */
const SHORTCUT_STORAGE_KEY = 'unitas.ouroboros.shortcut.v1';

/**
 * REV-13 "UNITAS Quantum White" home body (spec §1-§3, §10). Replaces
 * `HomeContent` as `app/[locale]/page.tsx`'s render target (wired by the
 * INTEGRATION agent). Retains, unchanged in wiring: `Hero`, the single
 * `useUai()` session driving `OmniSynapseSearch` (same 4 props), its two
 * modals (`EcosystemEntryModal`, `HotShortcutResultModal`), the Ouroboros
 * dim/blur wrapper (now around `SingularityCoreGrid` instead of the three old
 * catalog sections), `SectionShield`/`SovereignShield` zones, and `Footer`.
 * Replaces the old Ecosystem/Live-Service/Lock-in/B2B grids with the
 * Singularity Core cluster grid (spec §10.20).
 */
export function QuantumWhiteHome() {
  const tHome = useTranslations('Home');
  const released = useCurtainReleased();

  const [activeEcosystem, setActiveEcosystem] = useState<EcosystemTheme | null>(null);
  const [activeShortcut, setActiveShortcut] = useState<HotShortcutAxis | null>(null);
  const [isOuroboros, setIsOuroboros] = useState(false);

  const chronoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const collectorStopRef = useRef<(() => void) | null>(null);

  // Single U-AI session for the whole home page: the search bar drives it.
  const uai = useUai();
  const searchActive = uai.phase !== 'idle';

  // Restore / persist which shortcut popup was open (mirrors HomeContent).
  useEffect(() => {
    try {
      const savedKey = sessionStorage.getItem(SHORTCUT_STORAGE_KEY);
      if (savedKey) {
        const [group, key] = savedKey.includes(':') ? savedKey.split(':', 2) : ['', savedKey];
        const found = findShortcutAxis(group, key) ?? HOT_SHORTCUT_MATRIX.find((a) => a.key === key);
        if (found) setActiveShortcut(found);
      }
    } catch {
      // sessionStorage unavailable -- restoring the open popup is a nicety, not a requirement.
    }
  }, []);

  useEffect(() => {
    try {
      if (activeShortcut) sessionStorage.setItem(SHORTCUT_STORAGE_KEY, `${activeShortcut.group}:${activeShortcut.key}`);
      else sessionStorage.removeItem(SHORTCUT_STORAGE_KEY);
    } catch {
      // non-fatal, see above.
    }
  }, [activeShortcut]);

  // Activate the Quantum White theme scope for as long as this page is mounted.
  useLayoutEffect(() => {
    document.documentElement.dataset.unitasSurface = SURFACE_VALUE;
    return () => {
      delete document.documentElement.dataset.unitasSurface;
    };
  }, []);

  // Ambient bed suppression: requested only once the curtain has released the
  // home (spec §0.9, §10.2) -- lifted the moment this page unmounts.
  useEffect(() => {
    if (!released) return;
    setAmbientBedSuppressed(true);
    return () => setAmbientBedSuppressed(false);
  }, [released]);

  // Adaptive chrono-luminance: apply immediately on release, then every 10
  // minutes -- also gated on `released` (spec §0.9: nothing that colours the
  // curtain-hidden surface should run before then).
  useEffect(() => {
    if (!released) return undefined;
    const root = document.documentElement;
    applyChrono(root);
    chronoIntervalRef.current = setInterval(() => applyChrono(root), CHRONO_INTERVAL_MS);
    return () => {
      if (chronoIntervalRef.current) clearInterval(chronoIntervalRef.current);
      chronoIntervalRef.current = null;
      clearChrono(root);
    };
  }, [released]);

  // U-Shield behavioural collector: started once per page, for the page's lifetime.
  useEffect(() => {
    collectorStopRef.current = startUSignatureCollector();
    return () => {
      collectorStopRef.current?.();
      collectorStopRef.current = null;
    };
  }, []);

  // App exit / terminate: stop the long-lived engines this component owns
  // directly (haptics and the U-Signature collector's own listeners already
  // self-manage their own APP_EXIT_EVENT/APP_TERMINATE_EVENT teardown).
  useEffect(() => {
    function stopEngines() {
      if (chronoIntervalRef.current) {
        clearInterval(chronoIntervalRef.current);
        chronoIntervalRef.current = null;
      }
      collectorStopRef.current?.();
      collectorStopRef.current = null;
    }
    window.addEventListener(APP_EXIT_EVENT, stopEngines);
    window.addEventListener(APP_TERMINATE_EVENT, stopEngines);
    return () => {
      window.removeEventListener(APP_EXIT_EVENT, stopEngines);
      window.removeEventListener(APP_TERMINATE_EVENT, stopEngines);
    };
  }, []);

  return (
    <Fragment>
      <QuantumVoid />
      <main className="qw-main pb-24">
        <div className="qw-hero-wrap flex flex-col items-center pt-24 pb-12">
          <SectionShield zone="home-hero">
            <Hero />
          </SectionShield>
        </div>

        <SectionShield zone="home-search">
          <OmniSynapseSearch
            uai={uai}
            onSelectEcosystem={setActiveEcosystem}
            onOpenShortcut={setActiveShortcut}
            onOuroborosChange={setIsOuroboros}
          />
        </SectionShield>

        {searchActive && (
          <div className="mx-auto max-w-7xl px-6 pt-14">
            <p className="border-l-2 border-[var(--qw-gold)] pl-3 text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--qw-ink-3)]">
              {tHome('modulesLinkedLabel')}
            </p>
          </div>
        )}

        {/* Focus Isolation (The Living Knowledge Ouroboros): the Singularity
            Core grid sinks -- dim/blur/settle back -- while the search bar is
            focused on an empty query and showing the shortcut marquee. */}
        <motion.div
          animate={
            isOuroboros
              ? { opacity: 0.35, scale: 0.985, filter: 'blur(2px)' }
              : { opacity: 1, scale: 1, filter: 'blur(0px)' }
          }
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ pointerEvents: isOuroboros ? 'none' : 'auto' }}
        >
          <SectionShield zone="home-singularity">
            <SingularityCoreGrid />
          </SectionShield>
        </motion.div>

        <SovereignShield zone="modal-ecosystem" resetKeys={[activeEcosystem]}>
          <EcosystemEntryModal ecosystem={activeEcosystem} onClose={() => setActiveEcosystem(null)} />
        </SovereignShield>
        <SovereignShield zone="modal-shortcut" resetKeys={[activeShortcut]}>
          <HotShortcutResultModal shortcut={activeShortcut} onClose={() => setActiveShortcut(null)} />
        </SovereignShield>
      </main>

      <SovereignShield zone="footer">
        <Footer />
      </SovereignShield>

      <SovereignWatermark />
      <QuantumBluePulseHost />
      <USignatureHoneypot />
    </Fragment>
  );
}
