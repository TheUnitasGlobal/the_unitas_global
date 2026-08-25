'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ECOSYSTEMS } from '@/lib/ecosystems';
import { B2C_MODULES, B2B_PROTOCOLS } from '@/lib/modules';

const SITE_URL = 'https://www.theunitas.global';

/**
 * Pure-text, semantic index of all 19 catalog entries (11 Cognitive
 * Ecosystems + 5 Live Consumer Services + 3 Enterprise Protocols). The card
 * grids above already render this same copy, but nested inside interactive
 * <button>/<div> shells with no sectioning semantics. This block re-exposes
 * it as <article>/<dl> plus a matching JSON-LD ItemList so crawlers get an
 * unambiguous, structured read of the full module catalog in one place.
 */
export function AboutSection() {
  const locale = useLocale();
  const tAbout = useTranslations('About');
  const tCognitive = useTranslations('Cognitive');
  const tB2c = useTranslations('B2C');
  const tB2b = useTranslations('B2B');
  const tEcosystems = useTranslations('Ecosystems');
  const tModules = useTranslations('Modules');

  const pageUrl = `${SITE_URL}/${locale}`;

  const itemListElement = [
    ...ECOSYSTEMS.map((eco, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: tEcosystems(`${eco.messageKey}.title`),
        description: tEcosystems(`${eco.messageKey}.description`),
        url: `${pageUrl}#ecosystems`,
        provider: { '@type': 'Organization', name: 'UNITAS' },
      },
    })),
    ...B2C_MODULES.map((module, index) => ({
      '@type': 'ListItem',
      position: ECOSYSTEMS.length + index + 1,
      item: {
        '@type': 'Service',
        name: tModules(`${module.messageKey}.title`),
        description: tModules(`${module.messageKey}.description`),
        url: `${pageUrl}#live-services`,
        provider: { '@type': 'Organization', name: 'UNITAS' },
      },
    })),
    ...B2B_PROTOCOLS.map((protocol, index) => ({
      '@type': 'ListItem',
      position: ECOSYSTEMS.length + B2C_MODULES.length + index + 1,
      item: {
        '@type': 'Service',
        name: tModules(`${protocol.messageKey}.title`),
        description: tModules(`${protocol.messageKey}.description`),
        url: `${pageUrl}#b2b`,
        provider: { '@type': 'Organization', name: 'UNITAS' },
      },
    })),
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: tAbout('title'),
    description: tAbout('intro'),
    itemListElement,
  };

  return (
    <section id="about" aria-labelledby="about-heading" className="mx-auto mt-8 max-w-5xl border-t border-white/10 px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-10 text-center">
        <h2 id="about-heading" className="glow-text mb-3 font-serif text-2xl font-bold text-accent md:text-3xl">
          {tAbout('title')}
        </h2>
        <p className="mx-auto max-w-2xl text-[16px] text-gray-400 md:text-[17px]">{tAbout('intro')}</p>
      </div>

      <article aria-labelledby="about-ecosystems-heading" className="mb-10">
        <h3 id="about-ecosystems-heading" className="mb-2 font-serif text-lg font-semibold text-accent/90">
          {tCognitive('title')}
        </h3>
        <p className="mb-4 text-sm text-gray-500">{tCognitive('subtitle')}</p>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {ECOSYSTEMS.map((eco) => (
            <div key={eco.key}>
              <dt className="font-medium text-gray-200">{tEcosystems(`${eco.messageKey}.title`)}</dt>
              <dd className="text-sm text-gray-500">{tEcosystems(`${eco.messageKey}.description`)}</dd>
            </div>
          ))}
        </dl>
      </article>

      <article aria-labelledby="about-b2c-heading" className="mb-10">
        <h3 id="about-b2c-heading" className="mb-2 font-serif text-lg font-semibold text-accent/90">
          {tB2c('title')}
        </h3>
        <p className="mb-4 text-sm text-gray-500">{tB2c('subtitle')}</p>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {B2C_MODULES.map((module) => (
            <div key={module.key}>
              <dt className="font-medium text-gray-200">{tModules(`${module.messageKey}.title`)}</dt>
              <dd className="text-sm text-gray-500">{tModules(`${module.messageKey}.description`)}</dd>
            </div>
          ))}
        </dl>
      </article>

      <article aria-labelledby="about-b2b-heading">
        <h3 id="about-b2b-heading" className="mb-2 font-serif text-lg font-semibold text-accent/90">
          {tB2b('title')}
        </h3>
        <p className="mb-4 text-sm text-gray-500">{tB2b('subtitle')}</p>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {B2B_PROTOCOLS.map((protocol) => (
            <div key={protocol.key}>
              <dt className="font-medium text-gray-200">{tModules(`${protocol.messageKey}.title`)}</dt>
              <dd className="text-sm text-gray-500">{tModules(`${protocol.messageKey}.description`)}</dd>
            </div>
          ))}
        </dl>
      </article>
    </section>
  );
}
