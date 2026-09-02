'use client';

import { Fragment, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Hero } from './Hero';
import { OmniSynapseSearch } from './OmniSynapseSearch';
import { EcosystemCard } from '@/components/cards/EcosystemCard';
import { LiveServiceCard } from '@/components/cards/LiveServiceCard';
import { B2BProtocolCard } from '@/components/cards/B2BProtocolCard';
import { GovernanceCard } from '@/components/cards/GovernanceCard';
import { EcosystemEntryModal } from '@/components/interaction/EcosystemEntryModal';
import { ModuleQuestModal } from '@/components/interaction/ModuleQuestModal';
import { GovernanceLadderModal } from '@/components/interaction/GovernanceLadderModal';
import { Footer } from '@/components/layout/Footer';
import { useShockwave } from '@/components/effects/Shockwave';
import { useUai } from '@/lib/uai/useUai';
import { ECOSYSTEMS, type EcosystemTheme } from '@/lib/ecosystems';
import { B2C_MODULES, B2B_PROTOCOLS, type B2CModule } from '@/lib/modules';
import { GOVERNANCE_AXES, type GovernanceAxis } from '@/lib/governance';

/** Restores which governance axis was open across a next-intl locale switch
 *  (which remounts the client tree) -- The Living Knowledge Ouroboros's
 *  "keep results synced" requirement, scoped to *what was open*, not a
 *  re-fetch of any coin-costing report. */
const AXIS_STORAGE_KEY = 'unitas.ouroboros.axis.v1';

export function HomeContent() {
  const tHome = useTranslations('Home');
  const tCognitive = useTranslations('Cognitive');
  const tB2c = useTranslations('B2C');
  const tB2b = useTranslations('B2B');
  const tGovernance = useTranslations('Governance');

  const [activeEcosystem, setActiveEcosystem] = useState<EcosystemTheme | null>(null);
  const [activeModule, setActiveModule] = useState<B2CModule | null>(null);
  const [activeAxis, setActiveAxis] = useState<GovernanceAxis | null>(null);
  /** Focus Isolation: true while OmniSynapseSearch is focused on an empty
      query ("ouroboros" mode) -- sinks Sections 1-3 behind the search bar's
      16-axis Governance shortcut marquee instead of the usual browse hub. */
  const [isOuroboros, setIsOuroboros] = useState(false);
  const { trigger: triggerShockwave, element: shockwaveElement } = useShockwave();

  // Restore the governance axis that was open before a locale switch
  // remounted this tree (next-intl's router.replace re-navigates the whole
  // client tree on a locale change -- see GovernanceLadderStrip/
  // OmniSynapseSearch for the matching query-text persistence).
  useEffect(() => {
    try {
      const savedKey = sessionStorage.getItem(AXIS_STORAGE_KEY);
      if (savedKey) {
        const found = GOVERNANCE_AXES.find((a) => a.key === savedKey);
        if (found) setActiveAxis(found);
      }
    } catch {
      // sessionStorage unavailable -- restoring the open axis is a nicety,
      // not a requirement.
    }
  }, []);

  useEffect(() => {
    try {
      if (activeAxis) sessionStorage.setItem(AXIS_STORAGE_KEY, activeAxis.key);
      else sessionStorage.removeItem(AXIS_STORAGE_KEY);
    } catch {
      // non-fatal, see above.
    }
  }, [activeAxis]);

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
        onSelectModule={setActiveModule}
        onOpenAxis={setActiveAxis}
        onOuroborosChange={setIsOuroboros}
      />

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

      {/* Focus Isolation (The Living Knowledge Ouroboros): Sections 1-3 sink
          -- dim/blur/settle back -- while the search bar is focused on an
          empty query and showing the Governance shortcut marquee instead.
          Section 4 (Governance) is excluded on purpose: it sits directly
          below the marquee it mirrors, so keeping it at full opacity reads
          as one continuous surface rather than a second sunken block. */}
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

      {/* Section 3 -- Enterprise Protocols */}
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

      {/* Section 4 -- 16-Axis Governance Matrix (CLAUDE.md §3.3, first UI
          rendering of the doctrine's "지성 문명 및 사회 거버넌스" list). Free,
          not coin-gated -- a reference/doctrine surface, not a product. */}
      <section id="governance" className="mx-auto mt-8 max-w-7xl border-t border-white/10 px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="glow-text mb-3 font-serif text-2xl font-bold text-accent md:text-3xl">
            {tGovernance('title')}
          </h2>
          <p className="mx-auto max-w-2xl text-[16px] text-gray-400 sm:text-[17px] md:text-[19px]">
            {tGovernance('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
          {GOVERNANCE_AXES.map((axis, index) => (
            <GovernanceCard
              key={axis.key}
              axis={axis}
              index={index}
              total={GOVERNANCE_AXES.length}
              onOpen={setActiveAxis}
            />
          ))}
        </div>
      </section>

      <EcosystemEntryModal ecosystem={activeEcosystem} onClose={() => setActiveEcosystem(null)} />
      <ModuleQuestModal module={activeModule} onClose={() => setActiveModule(null)} />
      <GovernanceLadderModal axis={activeAxis} onClose={() => setActiveAxis(null)} />
    </main>
    <Footer />
    </Fragment>
  );
}
