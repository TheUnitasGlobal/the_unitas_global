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
import { ECOSYSTEMS, type EcosystemTheme } from '@/lib/ecosystems';
import { B2C_MODULES, B2B_PROTOCOLS, type B2CModule } from '@/lib/modules';

export function HomeContent() {
  const tCognitive = useTranslations('Cognitive');
  const tB2c = useTranslations('B2C');
  const tB2b = useTranslations('B2B');

  const [activeEcosystem, setActiveEcosystem] = useState<EcosystemTheme | null>(null);
  const [activeModule, setActiveModule] = useState<B2CModule | null>(null);
  const { trigger: triggerShockwave, element: shockwaveElement } = useShockwave();

  return (
    <Fragment>
    <main className="pb-24 pt-24">
      {shockwaveElement}

      <Hero />
      <OmniSynapseSearch onSelectEcosystem={setActiveEcosystem} onSelectModule={setActiveModule} />

      {/* Section 1 -- Cognitive Ecosystem (the 11 modules, always visible) */}
      <section id="ecosystems" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="glow-text mb-3 font-serif text-2xl font-bold text-accent md:text-3xl">
            {tCognitive('title')}
          </h2>
          <p className="mx-auto max-w-2xl text-[11px] text-gray-400 sm:whitespace-nowrap sm:text-xs md:text-sm">
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
      <section id="live-services" className="mx-auto max-w-7xl border-t border-white/10 px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="glow-text mb-3 font-serif text-2xl font-bold text-accent md:text-3xl">
            {tB2c('title')}
          </h2>
          <p className="mx-auto max-w-2xl text-[11px] text-gray-400 sm:whitespace-nowrap sm:text-xs md:text-sm">
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
          <p className="mx-auto max-w-xl text-xs text-gray-500 md:text-sm">{tB2b('subtitle')}</p>
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
