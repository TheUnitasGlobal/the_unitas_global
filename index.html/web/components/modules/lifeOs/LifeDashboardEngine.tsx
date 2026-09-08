'use client';

import { useTranslations } from 'next-intl';
import { Activity, Radio } from 'lucide-react';
import { HotIssueNewsList } from '@/components/home/HotIssueNewsList';
import { MODULE_REGISTRY } from '@/lib/module-registry';

/**
 * Life Dashboard: the Life-OS hub root (app/[locale]/sovereign/page.tsx) --
 * "Unified operations and briefing stream" per the founder directive.
 * Reuses the existing live news wire (HotIssueNewsList, already
 * self-contained/no props) as the briefing stream rather than building a
 * second one, and surfaces the module catalog's own live counts
 * (MODULE_REGISTRY, lib/module-registry.ts) as the "System Pulse" -- both
 * are real, already-existing data, not placeholder widgets.
 */
export function LifeDashboardEngine() {
  const t = useTranslations('LifeOs.lifeDashboard');

  const live = MODULE_REGISTRY.filter((m) => m.status === 'live').length;
  const coinGated = MODULE_REGISTRY.filter((m) => m.coinGated).length;
  const tiers = new Set(MODULE_REGISTRY.map((m) => m.tier)).size;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-accent">
          <Activity size={14} aria-hidden="true" />
          {t('systemPulse')}
        </h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="border border-accent/15 bg-void/60 p-4">
            <dt className="text-[10px] uppercase tracking-widest text-gray-500">{t('liveModules')}</dt>
            <dd className="mt-1 font-serif text-2xl text-white">{live}</dd>
          </div>
          <div className="border border-accent/15 bg-void/60 p-4">
            <dt className="text-[10px] uppercase tracking-widest text-gray-500">{t('coinGatedModules')}</dt>
            <dd className="mt-1 font-serif text-2xl text-white">{coinGated}</dd>
          </div>
          <div className="border border-accent/15 bg-void/60 p-4">
            <dt className="text-[10px] uppercase tracking-widest text-gray-500">{t('governanceTiers')}</dt>
            <dd className="mt-1 font-serif text-2xl text-white">{tiers}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-accent">
          <Radio size={14} aria-hidden="true" />
          {t('briefingStream')}
        </h2>
        <HotIssueNewsList />
      </section>
    </div>
  );
}
