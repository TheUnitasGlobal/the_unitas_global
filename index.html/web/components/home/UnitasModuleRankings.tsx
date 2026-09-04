'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Crown, UsersRound } from 'lucide-react';
import {
  MODULE_REGISTRY,
  moduleTitleNamespace,
  unitasRankingFor,
  type ModuleRegistryEntry,
  type UnitasRankingEntry,
  type UnitasRankingTier,
} from '@/lib/unitasRankings';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { Modal } from '@/components/ui/Modal';
import { DraggableCarouselRow } from '@/components/ui/DraggableCarouselRow';

const TIER_COLOR: Record<UnitasRankingTier, string> = {
  sovereign: '#d4af37',
  platinum: '#e5e4e2',
  gold: '#facc15',
};

/**
 * "실시간 유니타스 랭킹" (owner instruction 2026-09-04 round 2): a
 * cross-module leaderboard mounted twice -- once inside the U-AI report
 * popup (UaiDashboard) and once at the very bottom of the home page
 * (HotShortcutMatrixStrip's hotIssue tab), per the owner's literal "팝업 및
 * 페이지 최하단" instruction. Same component both places; data comes from
 * lib/unitasRankings.ts's deterministic, pseudonymous generator -- see that
 * file's banner for why this isn't wired to real user records.
 */
export function UnitasModuleRankings() {
  const t = useTranslations('UnitasRankings');
  const tEco = useTranslations('Ecosystems');
  const tModules = useTranslations('Modules');
  const { playHoverSfx } = useSpatialAudio();
  const [activeModule, setActiveModule] = useState<ModuleRegistryEntry | null>(null);
  const [profile, setProfile] = useState<{ entry: UnitasRankingEntry; module: ModuleRegistryEntry } | null>(null);

  function titleFor(module: ModuleRegistryEntry): string {
    const tt = moduleTitleNamespace(module) === 'Ecosystems' ? tEco : tModules;
    return tt(`${module.messageKey}.title`);
  }

  function openModule(module: ModuleRegistryEntry) {
    setActiveModule((prev) => (prev?.key === module.key ? null : module));
  }

  const rows = activeModule ? unitasRankingFor(activeModule) : [];

  return (
    <div className="mt-2 w-full border-t border-white/10 pt-4">
      <p className="mb-2 flex items-center gap-1.5 text-[16px] font-bold uppercase tracking-[0.3em] text-accent sm:text-[18px]">
        <UsersRound size={18} aria-hidden="true" />
        {t('label')}
      </p>

      <DraggableCarouselRow
        items={MODULE_REGISTRY.map((module) => ({
          id: module.key,
          render: () => (
            <button
              type="button"
              aria-expanded={activeModule?.key === module.key}
              onMouseEnter={() => playHoverSfx()}
              onClick={() => openModule(module)}
              className={`border px-3 py-2 text-[13px] font-bold uppercase tracking-widest transition-colors sm:text-[15px] ${
                activeModule?.key === module.key
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white'
              }`}
            >
              {titleFor(module)}
            </button>
          ),
        }))}
      />

      {activeModule && (
        <div className="mt-3 border border-white/10 bg-void/40 p-4">
          <p className="mb-3 text-[15px] font-bold text-white">{titleFor(activeModule)}</p>
          <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {rows.map((entry) => (
              <li key={entry.rank}>
                <button
                  type="button"
                  onMouseEnter={() => playHoverSfx()}
                  onClick={() => setProfile({ entry, module: activeModule })}
                  aria-label={t('viewProfileAria', { handle: entry.handle })}
                  className="flex w-full items-center gap-3 border border-white/10 bg-void/50 px-3 py-2 text-left text-[13px] transition-colors hover:border-white/25 hover:bg-void/80"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-bold"
                    style={{ borderColor: `${TIER_COLOR[entry.tier]}55`, color: TIER_COLOR[entry.tier] }}
                  >
                    {entry.rank === 1 ? <Crown size={12} aria-hidden="true" /> : entry.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold text-white">{entry.handle}</span>
                  <span className="shrink-0 text-[11px] text-gray-500">{entry.score.toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <Modal open={profile !== null} onClose={() => setProfile(null)} labelledBy="unitas-ranking-profile-title">
        {profile && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center border text-[13px] font-bold"
                style={{ borderColor: `${TIER_COLOR[profile.entry.tier]}55`, color: TIER_COLOR[profile.entry.tier] }}
              >
                {profile.entry.rank === 1 ? <Crown size={15} aria-hidden="true" /> : profile.entry.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p id="unitas-ranking-profile-title" className="text-[17px] font-bold text-white">
                  {profile.entry.handle}
                </p>
                <p className="mt-0.5 text-[12px] uppercase tracking-widest" style={{ color: TIER_COLOR[profile.entry.tier] }}>
                  {t(`tier.${profile.entry.tier}`)}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <dt className="text-gray-500">{t('profile.moduleLabel')}</dt>
                <dd className="mt-0.5 font-bold text-white">{titleFor(profile.module)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('profile.rankLabel')}</dt>
                <dd className="mt-0.5 font-bold text-white">#{profile.entry.rank}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-gray-500">{t('profile.scoreLabel')}</dt>
                <dd className="mt-0.5 font-bold text-white">{profile.entry.score.toLocaleString()}</dd>
              </div>
            </dl>
            <p className="text-[14px] leading-relaxed text-gray-300">
              {t(`bio.${profile.entry.bioIndex}`, { module: titleFor(profile.module) })}
            </p>
            <p className="text-[10px] text-gray-500">{t('disclaimer')}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
