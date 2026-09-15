'use client';

import { Clapperboard, MessagesSquare, Share2, Store, Trophy } from 'lucide-react';

/**
 * REV-29 MISSION 4 (founder directive 2026-09-15) -- the UNITAS master tile:
 * ONE pack at the right end of the U-AI search bar, the third box of the
 * action group after ⏎ and the attach toggle. Same footprint (32 / 38px),
 * same 1.5px rim, same 10px radius, same quiet neutral at rest, the same
 * armed fill while its popup is open -- and the SAME roll: the five hub
 * surfaces (exchange · shorts · rankings · rooms · social) step through the
 * one-icon window at the attach toggle's own 2.4 s cadence and easing.
 *
 * A click opens the centred hub popup at once -- never a dropdown.
 * `onMouseDown preventDefault` keeps the search input focused so the strip
 * beneath never collapses under the popup.
 */
export interface UnitasHubToggleProps {
  open: boolean;
  label: string;
  onOpen: () => void;
  onHover?: () => void;
}

const HUB_ICONS = [Store, Clapperboard, Trophy, MessagesSquare, Share2] as const;

export function UnitasHubToggle({ open, label, onOpen, onHover }: UnitasHubToggleProps) {
  return (
    <div className="qw-attach relative shrink-0">
      <button
        type="button"
        className="qw-attach-toggle qw-unitas-toggle relative flex h-8 w-8 items-center justify-center border border-accent/40 text-accent transition-colors hover:bg-accent/10 sm:h-[38px] sm:w-[38px]"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => onHover?.()}
        onClick={onOpen}
        data-unitas-hub-toggle=""
        data-active={open ? '1' : '0'}
      >
        <span className="qw-attach-roll" aria-hidden="true">
          <span className="qw-attach-roll-track qw-unitas-roll-track" data-stop={open ? '1' : '0'}>
            {HUB_ICONS.map((Icon, i) => (
              <span key={i} className="qw-attach-roll-icon">
                <Icon size={18} />
              </span>
            ))}
            {/* duplicate of the first icon: the loop wraps without a jump */}
            <span className="qw-attach-roll-icon">
              <Store size={18} />
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
