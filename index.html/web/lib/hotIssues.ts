import { Gamepad2, Trophy, Film, CloudSun, type LucideIcon } from 'lucide-react';
import { GOVERNANCE_AXES, type GovernanceAxis } from './governance';

// The global hot-issue shortcut group: game/sports/movie/weather. Distinct
// from the 16 doctrine-derived Governance axes (lib/governance.ts, CLAUDE.md
// §3.3) -- these are real-time cultural-pulse categories, not constitution
// axes, so they live in their own message namespace (`HotIssue`) and their
// own small palette rather than reusing GOVERNANCE_AXES's rotation.

export interface HotShortcutAxis extends GovernanceAxis {
  /** which message namespace `messageKey` resolves under -- lets one strip/
   *  modal render both families without a second component per family. */
  group: 'governance' | 'hotIssue';
}

const HOT_ISSUE_PALETTE: Array<{ color: string; glow: string }> = [
  { color: '#e879f9', glow: '#f5d0fe' }, // game
  { color: '#fb923c', glow: '#fed7aa' }, // sports
  { color: '#facc15', glow: '#fde047' }, // movie
  { color: '#38bdf8', glow: '#7dd3fc' }, // weather
];

const HOT_ISSUE_BASE: Array<{ key: string; icon: LucideIcon }> = [
  { key: 'game', icon: Gamepad2 },
  { key: 'sports', icon: Trophy },
  { key: 'movie', icon: Film },
  { key: 'weather', icon: CloudSun },
];

export const HOT_ISSUE_AXES: HotShortcutAxis[] = HOT_ISSUE_BASE.map((axis, i) => ({
  key: axis.key,
  messageKey: axis.key,
  icon: axis.icon,
  group: 'hotIssue',
  ...HOT_ISSUE_PALETTE[i % HOT_ISSUE_PALETTE.length],
}));

/**
 * The full "다차원 숏컷 매트릭스" (multi-dimensional shortcut matrix): the 16
 * Governance axes followed by the hot-issue categories, in one flat list so
 * HotShortcutMatrixStrip can loop it exactly like the old 16-only marquee.
 */
export const HOT_SHORTCUT_MATRIX: HotShortcutAxis[] = [
  ...GOVERNANCE_AXES.map((axis): HotShortcutAxis => ({ ...axis, group: 'governance' })),
  ...HOT_ISSUE_AXES,
];
