'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Hero } from './Hero';
import { OmniSynapseSearch } from './OmniSynapseSearch';
import { EcosystemCard } from '@/components/cards/EcosystemCard';
import { LiveServiceCard } from '@/components/cards/LiveServiceCard';
import { B2BProtocolCard } from '@/components/cards/B2BProtocolCard';
import { EcosystemEntryModal } from '@/components/interaction/EcosystemEntryModal';
import { ModuleQuestModal } from '@/components/interaction/ModuleQuestModal';
import { Footer } from '@/components/layout/Footer';
import { useShockwave } from '@/components/effects/Shockwave';
import { useUai } from '@/lib/uai/useUai';
import { ECOSYSTEMS, type EcosystemTheme } from '@/lib/ecosystems';
import { B2C_MODULES, B2B_PROTOCOLS, type B2CModule } from '@/lib/modules';

export function HomeContent() {
  const tHome = useTranslations('Home');
  const tCognitive = useTranslations('Cognitive');
  const tB2c = useTranslations('B2C');
  const tB2b = useTranslations('B2B');

  const [activeEcosystem, setActiveEcosystem] = useState<EcosystemTheme | null>(null);
  const [activeModule, setActiveModule] = useState<B2CModule | null>(null);
  const { trigger: triggerShockwave, element: shockwaveElement } = useShockwave();

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

      <EcosystemEntryModal ecosystem={activeEcosystem} onClose={() => setActiveEcosystem(null)} />
      <ModuleQuestModal module={activeModule} onClose={() => setActiveModule(null)} />
    </main>
    <Footer />
    </Fragment>
  );
}
