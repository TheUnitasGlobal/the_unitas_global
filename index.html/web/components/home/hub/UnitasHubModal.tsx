'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { SectionShield } from '@/components/system/PageShield';
import { useDragScroll } from '@/components/ui/useDragScroll';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import {
  SQUARE_DEFAULT_THEME,
  SQUARE_THEMES,
  readLastSquareTheme,
  squareDomKey,
  squareTheme,
  writeLastSquareTheme,
  type SquareLegacyTab,
  type SquareTheme,
  type SquareThemeKey,
} from '@/lib/square/themes';
import { KnowledgeExchange } from './KnowledgeExchange';
import { UnitasShorts } from './UnitasShorts';
import { HubRankings } from './HubRankings';
import { ThemeChatRooms } from './ThemeChatRooms';
import { SocialHub } from './SocialHub';
import { SquareThemePanel } from './SquareThemePanel';
import { OmniSwarmWorkspace } from '@/components/swarm/OmniSwarmWorkspace';

/**
 * REV-34 M4-A/B (founder directive 2026-09-16) -- UNITAS SQUARE (U-Square):
 * the centred popup the master tile at the end of the search bar opens,
 * grown from the REV-29 six-tab hub to TWENTY fixed themes (유랭킹 …
 * 유마스터, lib/square/themes.ts) under one cosmic lede.
 *
 * The six panels that already exist keep their component AND their DOM key
 * (`data-hub-tab-btn=rankings|shorts|rooms|exchange|social|swarm`, D-10) --
 * they simply sit at positions 1·2·3·4·5·12 of the new order. The other
 * fourteen render SquareThemePanel from their descriptor. Exactly one panel
 * is mounted at a time, each in its own shield, so a bad answer in one can
 * never take the others down and the swarm (portal pattern, WIKIMEDIA page
 * budget) is only ever alive while its tab is active.
 *
 * One history layer (Modal) -- the back gesture closes the square and only
 * the square; nested popups (a short, a creator pass) stack their own
 * layers. The last theme opened is remembered per device (localStorage,
 * guarded); an explicit `initialTab` prop always wins, so E2E stays
 * deterministic.
 *
 * Tab strip: twenty pills on one native horizontal scroller with the
 * house mouse grab-drag (useDragScroll); ≤767px it folds into a two-row
 * snap grid (unitas-hub.css) so the whole square is one gesture wide. The
 * drag handlers are bound unconditionally -- binding them to a "dragging"
 * state killed taps in REV-33, and touch never enters the drag path at all.
 */
export type HubTab = SquareThemeKey;

export interface UnitasHubModalProps {
  open: boolean;
  onClose: () => void;
  /** Explicit start theme; when omitted the last opened theme (or 유랭킹) is used. */
  initialTab?: HubTab;
}

function LegacyPanel({ tab }: { tab: SquareLegacyTab }) {
  switch (tab) {
    case 'rankings':
      return <HubRankings />;
    case 'shorts':
      return <UnitasShorts />;
    case 'rooms':
      return <ThemeChatRooms />;
    case 'exchange':
      return <KnowledgeExchange />;
    case 'social':
      return <SocialHub />;
    case 'swarm':
      return <OmniSwarmWorkspace variant="hub" />;
  }
}

function SquarePanel({ theme }: { theme: SquareTheme }) {
  return theme.legacyTab ? <LegacyPanel tab={theme.legacyTab} /> : <SquareThemePanel theme={theme} />;
}

export function UnitasHubModal({ open, onClose, initialTab }: UnitasHubModalProps) {
  const t = useTranslations('Rev34.square');
  const { playHoverSfx } = useSpatialAudio();
  const [tab, setTab] = useState<SquareThemeKey>(() => initialTab ?? readLastSquareTheme());
  // True while the open theme is the remembered one (no explicit initialTab,
  // and it is not simply the default) -- announced to screen readers only.
  const [restored, setRestored] = useState(() => initialTab === undefined && readLastSquareTheme() !== SQUARE_DEFAULT_THEME);
  const railRef = useRef<HTMLDivElement>(null);
  const { handlers: dragHandlers } = useDragScroll(railRef);

  useEffect(() => {
    if (!open) return;
    const remembered = readLastSquareTheme();
    setTab(initialTab ?? remembered);
    setRestored(initialTab === undefined && remembered !== SQUARE_DEFAULT_THEME);
  }, [open, initialTab]);

  // REV-38 (zero friction): twenty uppercase pills are ~2000px of rail, so a
  // remembered theme near the end used to open with its pill scrolled out of
  // sight -- the square looked like it had opened on nothing. Bring the active
  // pill into the rail's own view. Deliberately NOT scrollIntoView: that walks
  // the ancestor chain and would scroll the modal (and the page) too. One rAF
  // lets the open layout settle first.
  useEffect(() => {
    if (!open) return;
    const rail = railRef.current;
    if (!rail) return;
    const frame = requestAnimationFrame(() => {
      const active = rail.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      const left = active.offsetLeft;
      const right = left + active.offsetWidth;
      if (left < rail.scrollLeft || right > rail.scrollLeft + rail.clientWidth) {
        rail.scrollLeft = Math.max(0, left - (rail.clientWidth - active.offsetWidth) / 2);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, tab]);

  const pick = useCallback((key: SquareThemeKey) => {
    setTab(key);
    setRestored(false);
    writeLastSquareTheme(key);
  }, []);

  const active = squareTheme(tab);
  const domKey = squareDomKey(active);

  return (
    <Modal open={open} onClose={onClose} labelledBy="unitas-hub-title" size="hub">
      <div className="qw-hub-shell" data-unitas-hub="" data-unitas-square="" data-hub-tab={domKey} data-square-theme={active.key}>
        <header className="qw-hub-head">
          <p id="unitas-hub-title" className="qw-discovery-label mb-0 flex items-center gap-2 text-[17px] font-bold text-white">
            <Sparkles size={18} aria-hidden="true" />
            {t('title')}
          </p>
          <p className="qw-hub-meta mt-1 text-[13px] text-gray-400">{t('lede')}</p>
          <span className="sr-only">{t('swipeHint')}</span>
          {restored ? (
            <span className="sr-only" role="status" data-square-last-theme="">
              {t('lastTheme')}
            </span>
          ) : null}
        </header>

        <div
          ref={railRef}
          className="qw-hub-tabs qw-hub-nav qw-square-nav u-hscroll select-none"
          role="tablist"
          aria-label={t('title')}
          {...dragHandlers}
        >
          {SQUARE_THEMES.map((theme) => {
            const Icon = theme.icon;
            const selected = tab === theme.key;
            return (
              <button
                key={theme.key}
                type="button"
                role="tab"
                aria-selected={selected}
                data-hub-tab-btn={squareDomKey(theme)}
                data-square-tab={theme.order}
                data-square-theme={theme.key}
                className="qw-hub-tab qw-hub-nav-tab qw-square-tab"
                onMouseEnter={() => playHoverSfx()}
                onClick={() => pick(theme.key)}
              >
                <Icon size={14} aria-hidden="true" />
                <span className="qw-square-tab-label">{t(`themes.${theme.key}.tab`)}</span>
              </button>
            );
          })}
        </div>

        <div className="qw-hub-panel" role="tabpanel" data-hub-panel={domKey}>
          <SectionShield key={active.key} zone={`hub-${domKey}`}>
            <SquarePanel theme={active} />
          </SectionShield>
        </div>
      </div>
    </Modal>
  );
}
