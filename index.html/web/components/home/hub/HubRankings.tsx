'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trophy, UsersRound } from 'lucide-react';
import { GlobalThemeRankings } from '@/components/home/GlobalThemeRankings';
import { UnitasModuleRankings } from '@/components/home/UnitasModuleRankings';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';

/**
 * REV-29 MISSION 4 -- UNITAS 랭킹 inside the hub: the very same embedded
 * panels the discovery carousel's ranking deep modal renders (REV-21 §1.3),
 * so the theme chips, the tiered paging and the rank-detail / operator-
 * profile popups are byte-identical wherever a ranking is opened.
 */
export function HubRankings() {
  const t = useTranslations('Rev21.slots');
  const { playHoverSfx } = useSpatialAudio();
  const [tab, setTab] = useState<'world' | 'unitas'>('world');

  return (
    <div data-hub-rankings="">
      <div className="qw-hub-tabs mb-3" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'world'} className="qw-hub-tab" onMouseEnter={() => playHoverSfx()} onClick={() => setTab('world')} data-hub-ranking-tab="world">
          <Trophy size={13} aria-hidden="true" />
          {t('worldRanking.title')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'unitas'} className="qw-hub-tab" onMouseEnter={() => playHoverSfx()} onClick={() => setTab('unitas')} data-hub-ranking-tab="unitas">
          <UsersRound size={13} aria-hidden="true" />
          {t('unitasRanking.title')}
        </button>
      </div>
      {tab === 'world' ? <GlobalThemeRankings embedded /> : <UnitasModuleRankings embedded />}
    </div>
  );
}
