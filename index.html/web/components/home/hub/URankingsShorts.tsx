'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, Compass, Crown, Flame, Layers, ShieldCheck, Sparkles, Tag, Trophy } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { OmniOpen } from '@/components/home/OmniOpen';
import { compactCount } from '@/lib/live/shortsSeed';
import { MODULE_REGISTRY, type ModuleRegistryEntry } from '@/lib/module-registry';
import { moduleTitleNamespace } from '@/lib/unitasRankings';
import { textAnchor } from '@/lib/uai/deeperAnchor';
import { wikiLangFor } from '@/lib/uai/liveSuggest';
import {
  U_RANK_METRIC_KEYS,
  U_RANK_METRIC_LABEL_KEY,
  uRankDayIndex,
  uRankModuleHue,
  uRankingsFor,
  type URankEntry,
  type URankMetricKey,
} from '@/lib/square/uRankings';

/** Same three-line gradient helper UnitasShorts keeps module-private. */
function posterStyle(entry: URankEntry): CSSProperties {
  return {
    background: `linear-gradient(160deg, hsl(${entry.hue[0]} 70% 52%) 0%, hsl(${entry.hue[1]} 80% 30%) 100%)`,
  };
}

const TIER_ICON = { sovereign: Crown, platinum: ShieldCheck, gold: Trophy } as const;

function metricValue(entry: URankEntry, key: URankMetricKey): string {
  switch (key) {
    case 'microBurnEfficiency':
      return `${entry.microBurnEfficiency}%`;
    case 'knowledgeSales':
      return compactCount(entry.knowledgeSales);
    case 'nomadContribution':
      return String(entry.nomadContribution);
    case 'sovereignIndex':
      return String(entry.sovereignIndex);
  }
}

/**
 * REV-34 MISSION 4-C -- 유랭킹 (U-Rankings) inside the U-Square hub. WHY this
 * file exists: the founder retired the hub's world-ranking tab and asked for
 * the UNITAS leaderboard to be re-created "100 % identical" to the shorts
 * rail -- so this is UnitasShorts.tsx's markup and classes verbatim
 * (.qw-shorts-rail / .qw-short-card / .qw-short-title / .qw-short-meta /
 * .qw-short-poster, hover lift only, ZERO new CSS) with the two poster pills
 * repurposed: top-left = rank badge, top-right = module, second meta row =
 * the ecosystem metrics (Micro-Burn efficiency, knowledge sales, nomad
 * contribution). The ladder is the per-day seeded catalogue in
 * lib/square/uRankings.ts; the day index is read in a state initialiser and
 * refreshed after hydration so SSR and CSR agree. Filter chips switch to a
 * module's own ladder (always twelve cards). A card opens its own size='lg'
 * popup with the four metrics and the same direct-shortcut host the shorts
 * popup uses. The seed note keeps the honest "simulated" posture.
 */
export function URankingsShorts() {
  const t = useTranslations('Rev34.uRankings');
  const tEco = useTranslations('Ecosystems');
  const tModules = useTranslations('Modules');
  const locale = useLocale();
  const lang = wikiLangFor(locale);
  const { playHoverSfx } = useSpatialAudio();
  const [dayIndex, setDayIndex] = useState<number>(() => uRankDayIndex());
  const [moduleKey, setModuleKey] = useState<string | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setDayIndex(uRankDayIndex());
  }, []);

  const ladder = useMemo(() => uRankingsFor(dayIndex, moduleKey), [dayIndex, moduleKey]);
  const open = useMemo(() => ladder.find((e) => e.id === openId) ?? null, [ladder, openId]);

  function moduleOf(key: string): ModuleRegistryEntry | null {
    return MODULE_REGISTRY.find((m) => m.key === key) ?? null;
  }

  function titleFor(module: ModuleRegistryEntry): string {
    const tt = moduleTitleNamespace(module) === 'Ecosystems' ? tEco : tModules;
    return tt(`${module.messageKey}.title`);
  }

  function moduleTitle(key: string): string {
    const module = moduleOf(key);
    return module ? titleFor(module) : key;
  }

  function renderRankBadge(entry: URankEntry) {
    const Icon = TIER_ICON[entry.tier];
    return (
      <>
        <Icon size={11} aria-hidden="true" />
        {t('rankAria', { rank: entry.rank })}
      </>
    );
  }

  return (
    <div className="w-full" data-unitas-urankings="">
      <div className="mb-1.5 flex flex-wrap items-center gap-3">
        <p className="qw-discovery-label mb-0 text-[15px] font-bold text-white">
          <Trophy size={16} aria-hidden="true" />
          {t('label')}
        </p>
      </div>
      <p className="qw-hub-meta mb-3 text-[12px] text-gray-500">{t('lede')}</p>

      <div className="qw-hub-strip select-none mb-3" role="tablist" aria-label={t('filterAll')}>
        <button type="button" role="tab" aria-selected={moduleKey === 'all'} data-active={moduleKey === 'all' ? '1' : '0'} className="qw-hub-chip" onMouseEnter={() => playHoverSfx()} onClick={() => setModuleKey('all')} data-urank-filter="all">
          <Tag size={15} aria-hidden="true" />
          {t('filterAll')}
        </button>
        {MODULE_REGISTRY.map((module) => {
          const color = `hsl(${uRankModuleHue(module.key)} 70% 55%)`;
          const Icon = module.tier === 'ecosystem' ? Sparkles : Layers;
          return (
            <button
              key={module.key}
              type="button"
              role="tab"
              aria-selected={moduleKey === module.key}
              data-active={moduleKey === module.key ? '1' : '0'}
              className="qw-hub-chip"
              style={{ '--qw-hub-accent': color } as CSSProperties}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => setModuleKey(module.key)}
              data-urank-filter={module.key}
            >
              <Icon size={15} style={{ color }} aria-hidden="true" />
              {titleFor(module)}
            </button>
          );
        })}
      </div>

      <div className="qw-shorts-rail" data-urank-rail="">
        {ladder.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="qw-short-card"
            style={posterStyle(entry)}
            onMouseEnter={() => playHoverSfx()}
            onClick={() => setOpenId(entry.id)}
            aria-label={t('openAria', { name: entry.name })}
            data-urank={entry.handle}
            data-urank-rank={entry.rank}
          >
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-bold">
              {renderRankBadge(entry)}
            </span>
            <span className="absolute right-2.5 top-2.5 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-bold">
              {moduleTitle(entry.moduleKey)}
            </span>
            <span className="qw-short-title">{entry.name}</span>
            <span className="qw-short-meta">
              <span>@{entry.handle}</span>
            </span>
            <span className="qw-short-meta">
              <span className="inline-flex items-center gap-1" title={t('metrics.microBurn')}>
                <Flame size={12} aria-hidden="true" />
                {metricValue(entry, 'microBurnEfficiency')}
              </span>
              <span className="inline-flex items-center gap-1" title={t('metrics.knowledgeSales')}>
                <BookOpen size={12} aria-hidden="true" />
                {metricValue(entry, 'knowledgeSales')}
              </span>
              <span className="inline-flex items-center gap-1" title={t('metrics.nomad')}>
                <Compass size={12} aria-hidden="true" />
                {metricValue(entry, 'nomadContribution')}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-widest text-gray-500">{t('seedNote')}</p>

      <Modal open={open !== null} onClose={() => setOpenId(null)} labelledBy="unitas-urank-title" size="lg">
        {open && (
          <div className="space-y-4" data-urank-modal={open.handle}>
            <div className="qw-short-poster qw-short-card w-full" style={posterStyle(open)} aria-hidden="true">
              <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-bold">
                {renderRankBadge(open)}
              </span>
              <span className="qw-short-title">{open.name}</span>
            </div>
            <div>
              <p id="unitas-urank-title" className="text-[19px] font-bold text-white">
                {open.name}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-400">
                <span>@{open.handle}</span>
                <span>
                  {t('rankLabel')} · {t('rankAria', { rank: open.rank })}
                </span>
                <span>
                  {t('moduleLabel')} · {moduleTitle(open.moduleKey)}
                </span>
                <span className="inline-flex items-center gap-1 text-accent">
                  {(() => {
                    const Icon = TIER_ICON[open.tier];
                    return <Icon size={12} aria-hidden="true" />;
                  })()}
                  {t(`tier.${open.tier}`)}
                </span>
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]" data-urank-metrics="">
              {U_RANK_METRIC_KEYS.map((key) => (
                <div key={key} className="rounded-lg border border-white/10 px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-widest text-gray-500">{t(`metrics.${U_RANK_METRIC_LABEL_KEY[key]}`)}</dt>
                  <dd className="mt-0.5 text-[17px] font-bold text-white">{metricValue(open, key)}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[13px] leading-relaxed text-gray-300">{t('modalLede')}</p>
            <OmniOpen anchor={textAnchor(moduleTitle(open.moduleKey), lang)} host="newsRail" family="unitas" />
            <p className="text-[11px] uppercase tracking-widest text-gray-500">{t('seedNote')}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
