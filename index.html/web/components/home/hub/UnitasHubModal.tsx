'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Clapperboard, Cpu, MessagesSquare, Share2, Sparkles, Store, Trophy, type LucideIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { SectionShield } from '@/components/system/PageShield';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { KnowledgeExchange } from './KnowledgeExchange';
import { UnitasShorts } from './UnitasShorts';
import { HubRankings } from './HubRankings';
import { ThemeChatRooms } from './ThemeChatRooms';
import { SocialHub } from './SocialHub';
import { OmniSwarmWorkspace } from '@/components/swarm/OmniSwarmWorkspace';

/**
 * REV-29 MISSION 4 (founder directive 2026-09-15) -- the UNITAS master hub:
 * the centred popup the master tile at the end of the search bar opens.
 * Five surfaces under one roof, each in its own shield so a bad answer in
 * one can never take the others down:
 *
 *   지식 거래소  the revenue theme -- knowledge packs bought and listed
 *   UNITAS 숏츠  the vertical-video rail, revived from REV-19 and moved here
 *   UNITAS 랭킹  the world + UNITAS rankings, the same embedded panels
 *   테마별 대화방 22 rooms, one per news axis, live over the hub channel
 *   소셜 미디어  the world's social / mail apps and one-tap UNITAS sharing
 *   옴니-테크 스원 the multi-dimensional network field (REV-32 M2) -- the hub is
 *              the one surface reachable from every page, so the swarm's
 *              entrance belongs here as well as on its own route
 *
 * One history layer (Modal) -- the back gesture closes the hub and only the
 * hub; nested popups (a short, a creator pass) stack their own layers.
 */
export type HubTab = 'exchange' | 'shorts' | 'rankings' | 'rooms' | 'social' | 'swarm';

const TABS: ReadonlyArray<{ key: HubTab; icon: LucideIcon }> = [
  { key: 'exchange', icon: Store },
  { key: 'shorts', icon: Clapperboard },
  { key: 'rankings', icon: Trophy },
  { key: 'rooms', icon: MessagesSquare },
  { key: 'social', icon: Share2 },
  { key: 'swarm', icon: Cpu },
];

export interface UnitasHubModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: HubTab;
}

export function UnitasHubModal({ open, onClose, initialTab = 'exchange' }: UnitasHubModalProps) {
  const t = useTranslations('Rev29.hub');
  const { playHoverSfx } = useSpatialAudio();
  const [tab, setTab] = useState<HubTab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  return (
    <Modal open={open} onClose={onClose} labelledBy="unitas-hub-title" size="hub">
      <div className="qw-hub-shell" data-unitas-hub="" data-hub-tab={tab}>
        <header className="qw-hub-head">
          <p id="unitas-hub-title" className="qw-discovery-label mb-0 flex items-center gap-2 text-[17px] font-bold text-white">
            <Sparkles size={18} aria-hidden="true" />
            {t('title')}
          </p>
          <p className="qw-hub-meta mt-1 text-[13px] text-gray-400">{t('lede')}</p>
        </header>

        <div className="qw-hub-tabs qw-hub-nav u-hscroll select-none" role="tablist" aria-label={t('title')}>
          {TABS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              data-hub-tab-btn={key}
              className="qw-hub-tab qw-hub-nav-tab"
              onMouseEnter={() => playHoverSfx()}
              onClick={() => setTab(key)}
            >
              <Icon size={14} aria-hidden="true" />
              {t(`tabs.${key}`)}
            </button>
          ))}
        </div>

        <div className="qw-hub-panel" role="tabpanel" data-hub-panel={tab}>
          {tab === 'exchange' && (
            <SectionShield zone="hub-exchange">
              <KnowledgeExchange />
            </SectionShield>
          )}
          {tab === 'shorts' && (
            <SectionShield zone="hub-shorts">
              <UnitasShorts />
            </SectionShield>
          )}
          {tab === 'rankings' && (
            <SectionShield zone="hub-rankings">
              <HubRankings />
            </SectionShield>
          )}
          {tab === 'rooms' && (
            <SectionShield zone="hub-rooms">
              <ThemeChatRooms />
            </SectionShield>
          )}
          {tab === 'social' && (
            <SectionShield zone="hub-social">
              <SocialHub />
            </SectionShield>
          )}
          {tab === 'swarm' && (
            <SectionShield zone="hub-swarm">
              <OmniSwarmWorkspace variant="hub" />
            </SectionShield>
          )}
        </div>
      </div>
    </Modal>
  );
}
