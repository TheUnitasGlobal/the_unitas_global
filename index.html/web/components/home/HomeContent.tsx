'use client';

import { Fragment, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Hero } from './Hero';
import { OmniSynapseSearch } from './OmniSynapseSearch';
import { EcosystemCard } from '@/components/cards/EcosystemCard';
import { LiveServiceCard } from '@/components/cards/LiveServiceCard';
import { B2BProtocolCard } from '@/components/cards/B2BProtocolCard';
import { LockInModuleCarousel } from '@/components/home/LockInModuleCarousel';
import { EcosystemEntryModal } from '@/components/interaction/EcosystemEntryModal';
import { ModuleQuestModal } from '@/components/interaction/ModuleQuestModal';
import { HotShortcutResultModal } from '@/components/interaction/HotShortcutResultModal';
import { LockInModuleModal } from '@/components/interaction/LockInModuleModal';
import { ExitGuard } from '@/components/interaction/ExitGuard';
import { Footer } from '@/components/layout/Footer';
import { useShockwave } from '@/components/effects/Shockwave';
import { useUai } from '@/lib/uai/useUai';
import { ECOSYSTEMS, type EcosystemTheme } from '@/lib/ecosystems';
import { B2C_MODULES, B2B_PROTOCOLS, type B2CModule } from '@/lib/modules';
import { HOT_SHORTCUT_MATRIX, findShortcutAxis, type HotShortcutAxis } from '@/lib/hotIssues';
import {
  isLockInModuleKey,
  lockInModule,
  readActiveLockIns,
  toggleLockIn,
  writeActiveLockIns,
  type LockInModule,
  type LockInModuleKey,
} from '@/lib/lockInModules';

/** Restores which shortcut popup was open across a next-intl locale switch
 *  (which remounts the client tree) -- The Living Knowledge Ouroboros's
 *  "keep results synced" requirement, scoped to *what was open*, not a
 *  re-fetch of any coin-costing report. Stored as `${group}:${key}`. */
const SHORTCUT_STORAGE_KEY = 'unitas.ouroboros.shortcut.v1';
/** Which lock-in module popup was open (owner instruction 2026-09-04
 *  round 8) -- same locale-remount survival, its own key. */
const LOCK_IN_OPEN_KEY = 'unitas.lockin.open.v1';

export function HomeContent() {
  const tHome = useTranslations('Home');
  const tCognitive = useTranslations('Cognitive');
  const tB2c = useTranslations('B2C');
  const tB2b = useTranslations('B2B');

  const [activeEcosystem, setActiveEcosystem] = useState<EcosystemTheme | null>(null);
  const [activeModule, setActiveModule] = useState<B2CModule | null>(null);
  const [activeShortcut, setActiveShortcut] = useState<HotShortcutAxis | null>(null);
  /** The lock-in module popup that is open, and the device-local set of
   *  activated lock-in modules (localStorage, see lib/lockInModules.ts). */
  const [activeLockIn, setActiveLockIn] = useState<LockInModule | null>(null);
  const [lockedIn, setLockedIn] = useState<LockInModuleKey[]>([]);
  /** Focus Isolation: true while OmniSynapseSearch is focused on an empty
      query ("ouroboros" mode) -- sinks the catalog sections behind the
      search bar's multi-dimensional shortcut marquee instead of the usual
      browse hub. */
  const [isOuroboros, setIsOuroboros] = useState(false);
  const { trigger: triggerShockwave, element: shockwaveElement } = useShockwave();

  useEffect(() => {
    try {
      const savedKey = sessionStorage.getItem(SHORTCUT_STORAGE_KEY);
      if (savedKey) {
        // stored as `${group}:${key}` (v2); a bare key from the v1 format
        // still resolves through the matrix-wide fallback.
        const [group, key] = savedKey.includes(':') ? savedKey.split(':', 2) : ['', savedKey];
        const found = findShortcutAxis(group, key) ?? HOT_SHORTCUT_MATRIX.find((a) => a.key === key);
        if (found) setActiveShortcut(found);
      }
    } catch {
      // sessionStorage unavailable -- restoring the open popup is a nicety,
      // not a requirement.
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

  useEffect(() => {
    setLockedIn(readActiveLockIns());
    try {
      const saved = sessionStorage.getItem(LOCK_IN_OPEN_KEY);
      if (isLockInModuleKey(saved)) setActiveLockIn(lockInModule(saved));
    } catch {
      // non-fatal, see above.
    }
  }, []);

  useEffect(() => {
    try {
      if (activeLockIn) sessionStorage.setItem(LOCK_IN_OPEN_KEY, activeLockIn.key);
      else sessionStorage.removeItem(LOCK_IN_OPEN_KEY);
    } catch {
      // non-fatal, see above.
    }
  }, [activeLockIn]);

  function handleToggleLockIn(module: LockInModule) {
    setLockedIn((prev) => {
      const next = toggleLockIn(prev, module.key);
      writeActiveLockIns(next);
      return next;
    });
  }

  // Single U-AI session for the whole home page: the search bar drives it.
  // The ecosystem / module / protocol walls below are ALWAYS mounted on the
  // bare home screen (restored, owner instruction 2026-08-30) -- when a U-AI
  // search is running they simply gain a connective heading and stay directly
  // beneath the result dashboard, so the catalog reads as linked to the
  // search output rather than as a separate page section.
  const uai = useUai();
  const searchActive = uai.phase !== 'idle';

  return (
    <Fragment>
    <main className="pb-24">
      {shockwaveElement}

      {/* pt-24 (nav clearance) and pb-24 are literally the same class, not independently-tuned
          values that happen to match -- that is what guarantees exact top/bottom symmetry around
          the title. OmniSynapseSearch carries no margin-top of its own (see its root div), so
          this pb-24 is the entire gap down to the search box, mirroring the pt-24 gap up to the nav. */}
      <div className="flex flex-col items-center pt-24 pb-24">
        <Hero />
      </div>
      <OmniSynapseSearch
        uai={uai}
        onSelectEcosystem={setActiveEcosystem}
        onOpenShortcut={setActiveShortcut}
        onOuroborosChange={setIsOuroboros}
      />

      {/* Mobile "back = leave" double gate: the hardware/browser back gesture
          (incl. the one dismissing the virtual keyboard) asks 로그아웃? then
          종료? instead of bouncing the visitor straight to the home screen. */}
      <ExitGuard />

      {/* Sections 1-3 -- the UNITAS ecosystem / consumer / enterprise catalogs.
          Always visible on the bare home screen (restored, owner instruction
          2026-08-30). While a U-AI search is running they render directly under
          the result dashboard with a connective heading, so the catalog reads
          as organically linked to the search output. */}
      {searchActive && (
        <div className="mx-auto max-w-7xl px-6 pt-14">
          <p className="border-l-2 border-accent pl-3 text-[11px] font-bold uppercase tracking-[0.3em] text-accent/80">
            {tHome('modulesLinkedLabel')}
          </p>
        </div>
      )}

      {/* Focus Isolation (The Living Knowledge Ouroboros): the catalog sinks
          -- dim/blur/settle back -- while the search bar is focused on an
          empty query and showing the shortcut marquee instead. The page
          ends with Section 3: the former Section 4 (16-axis "지성문명
          거버넌스 매트릭스" grid) was purged on the founder's instruction
          (2026-09-04 round 8) and must stay purged. */}
      <motion.div
        animate={
          isOuroboros
            ? { opacity: 0.35, scale: 0.985, filter: 'blur(2px)' }
            : { opacity: 1, scale: 1, filter: 'blur(0px)' }
        }
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{ pointerEvents: isOuroboros ? 'none' : 'auto' }}
      >
      {/* Section 1 -- Cognitive Ecosystem (the 11 modules) */}
      <section id="ecosystems" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="glow-text mb-3 font-serif text-2xl font-bold text-accent md:text-3xl">
            {tCognitive('title')}
          </h2>
          <p className="mx-auto max-w-2xl text-[16px] text-gray-400 sm:whitespace-nowrap sm:text-[17px] md:text-[19px]">
            {tCognitive('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ECOSYSTEMS.map((eco, index) => (
            <EcosystemCard
              key={eco.key}
              ecosystem={eco}
              index={index}
              onOpen={setActiveEcosystem}
              shockwaveTrigger={triggerShockwave}
            />
          ))}
        </div>
      </section>

      {/* Section 2 -- Live Consumer Services (restored: the original 5 modules) */}
      {/* mt-[19px] compensates the -mt-[19px] pulled by OmniSynapseSearch above, so this
          section (and everything after it) stays at its original page position while only
          the search bar + Cognitive Ecosystem block shifts up. */}
      <section id="live-services" className="mx-auto mt-[19px] max-w-7xl border-t border-white/10 px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="glow-text mb-3 font-serif text-2xl font-bold text-accent md:text-3xl">
            {tB2c('title')}
          </h2>
          <p className="mx-auto max-w-2xl text-[16px] text-gray-400 sm:whitespace-nowrap sm:text-[17px] md:text-[19px]">
            {tB2c('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {B2C_MODULES.map((module, index) => (
            <LiveServiceCard key={module.key} module={module} index={index} onOpen={setActiveModule} />
          ))}
        </div>
      </section>

      {/* Lock-in Ecosystem -- the 8 lock-in modules [NEXUS, AEGIS, U-TWIN,
          INFINITY, PANOPTICON, ORACLE, SYNDICATE-X, FATE-MATRIX] as one
          single-row rotating carousel, pinned DIRECTLY ABOVE the core 3
          enterprise modules (owner instruction 2026-09-04 round 8). Keep
          this block between Section 2 and Section 3; nothing may be
          inserted between it and Section 3 below. */}
      <LockInModuleCarousel active={lockedIn} onOpen={setActiveLockIn} />

      {/* Section 3 -- Enterprise Protocols (the core 3 modules) */}
      <section id="b2b" className="mx-auto mt-8 max-w-7xl border-t border-accent/10 px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="mb-3 font-serif text-2xl font-bold text-accent/80 md:text-3xl">
            {tB2b('title')}
          </h2>
          <p className="mx-auto max-w-2xl text-[16px] text-gray-500 sm:whitespace-nowrap sm:text-[17px] md:text-[19px]">
            {tB2b('subtitle')}
          </p>
          {/* Manifesto + patent-anchor paragraphs removed (owner instruction
              2026-08-29): the enterprise section header is now just the title +
              one-line subtitle, matching the other two sections' altitude. */}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {B2B_PROTOCOLS.map((protocol, index) => (
            <B2BProtocolCard key={protocol.key} protocol={protocol} index={index} />
          ))}
        </div>
      </section>
      </motion.div>

      <EcosystemEntryModal ecosystem={activeEcosystem} onClose={() => setActiveEcosystem(null)} />
      <ModuleQuestModal module={activeModule} onClose={() => setActiveModule(null)} />
      <HotShortcutResultModal shortcut={activeShortcut} onClose={() => setActiveShortcut(null)} />
      <LockInModuleModal
        module={activeLockIn}
        active={activeLockIn !== null && lockedIn.includes(activeLockIn.key)}
        onToggleActive={handleToggleLockIn}
        onStep={setActiveLockIn}
        onClose={() => setActiveLockIn(null)}
      />
    </main>
    <Footer />
    </Fragment>
  );
}
