import {
  Gamepad2,
  Trophy,
  Film,
  CloudSun,
  Coins,
  LineChart,
  Bitcoin,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';
import { GOVERNANCE_AXES, type GovernanceAxis } from './governance';

// The global hot-issue / theme shortcut groups: hot-issue (game/sports/movie/
// weather), finance (defi/stocks/bitcoin), career (job market). Distinct from
// the 16 doctrine-derived Governance axes (lib/governance.ts, CLAUDE.md §3.3)
// -- these are real-time cultural/economic-pulse categories, not constitution
// axes, so each group lives in its own message namespace (`HotIssue`,
// `Finance`, `Career`) while sharing this one shape so HotShortcutMatrixStrip
// and HotShortcutResultModal can render every group generically.

export type ShortcutGroup = 'governance' | 'hotIssue' | 'finance' | 'career';

export interface HotShortcutAxis extends GovernanceAxis {
  /** which message namespace `messageKey` resolves under -- lets one strip/
   *  modal render every group without a component per family. */
  group: ShortcutGroup;
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

const FINANCE_PALETTE: Array<{ color: string; glow: string }> = [
  { color: '#34d399', glow: '#6ee7b7' }, // defi
  { color: '#60a5fa', glow: '#93c5fd' }, // stocks
  { color: '#f7931a', glow: '#fbbf24' }, // bitcoin (its own brand orange)
];

const FINANCE_BASE: Array<{ key: string; icon: LucideIcon }> = [
  { key: 'defi', icon: Coins },
  { key: 'stocks', icon: LineChart },
  { key: 'bitcoin', icon: Bitcoin },
];

export const FINANCE_AXES: HotShortcutAxis[] = FINANCE_BASE.map((axis, i) => ({
  key: axis.key,
  messageKey: axis.key,
  icon: axis.icon,
  group: 'finance',
  ...FINANCE_PALETTE[i % FINANCE_PALETTE.length],
}));

export const CAREER_AXES: HotShortcutAxis[] = [
  { key: 'career', messageKey: 'career', icon: Briefcase, group: 'career', color: '#c084fc', glow: '#e9d5ff' },
];

/**
 * The full "다차원 숏컷 매트릭스" (multi-dimensional shortcut matrix): every
 * U-AI-popup-driven group (governance, hot-issue, finance, career) in one
 * flat list. Email (lib/emailShortcuts.ts) is deliberately NOT folded in here
 * -- it opens external webmail links directly rather than
 * HotShortcutResultModal's chained U-AI popup, so it stays its own type.
 */
export const HOT_SHORTCUT_MATRIX: HotShortcutAxis[] = [
  ...GOVERNANCE_AXES.map((axis): HotShortcutAxis => ({ ...axis, group: 'governance' })),
  ...HOT_ISSUE_AXES,
  ...FINANCE_AXES,
  ...CAREER_AXES,
];

/** Every item belonging to one group, in matrix order -- the pool
 *  HotShortcutResultModal's infinite prev/next ladder cycles through. */
export function itemsInGroup(group: ShortcutGroup): HotShortcutAxis[] {
  return HOT_SHORTCUT_MATRIX.filter((axis) => axis.group === group);
}

/** The four next-intl `useTranslations` results for each U-AI-popup group,
 *  keyed by `HotShortcutAxis['group']` -- lets titleOf/descriptionOf below
 *  resolve any axis's copy without a per-group ternary at every call site. */
export interface AxisTranslators {
  governance: (key: string) => string;
  hotIssue: (key: string) => string;
  finance: (key: string) => string;
  career: (key: string) => string;
}

export function axisTitle(axis: HotShortcutAxis, t: AxisTranslators): string {
  return t[axis.group](`axes.${axis.messageKey}.title`);
}

export function axisDescription(axis: HotShortcutAxis, t: AxisTranslators): string {
  return t[axis.group](`axes.${axis.messageKey}.description`);
}
