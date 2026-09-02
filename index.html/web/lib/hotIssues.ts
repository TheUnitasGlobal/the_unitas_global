import {
  Gamepad2,
  Trophy,
  Film,
  CloudSun,
  Coins,
  LineChart,
  Bitcoin,
  Briefcase,
  Home,
  KeyRound,
  Landmark,
  Heart,
  HeartHandshake,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { GOVERNANCE_AXES, type GovernanceAxis } from './governance';

// The global hot-issue / theme shortcut groups: hot-issue (game/sports/movie/
// weather), finance (defi/stocks/bitcoin), real estate (housing/rental/
// mortgage), dating (romance/matchmaking/relationship), career (job market).
// Distinct from the 16 doctrine-derived Governance axes (lib/governance.ts,
// CLAUDE.md §3.3) -- these are real-time cultural/economic-pulse categories,
// not constitution axes, so each group lives in its own message namespace
// (`HotIssue`, `Finance`, `RealEstate`, `Dating`, `Career`) while sharing this
// one shape so HotShortcutMatrixStrip and HotShortcutResultModal can render
// every group generically. Every axis here seeds the fully-automated
// shortcut analytics engine (lib/uai/shortcutAnalytics.ts) with its localized
// title as the query.

export type ShortcutGroup = 'governance' | 'hotIssue' | 'finance' | 'realEstate' | 'dating' | 'career';

export interface HotShortcutAxis extends GovernanceAxis {
  /** which message namespace `messageKey` resolves under -- lets one strip/
   *  modal render every group without a component per family. */
  group: ShortcutGroup;
}

interface AxisSeed {
  key: string;
  icon: LucideIcon;
  color: string;
  glow: string;
}

function buildGroup(group: ShortcutGroup, seeds: AxisSeed[]): HotShortcutAxis[] {
  return seeds.map((seed) => ({
    key: seed.key,
    messageKey: seed.key,
    icon: seed.icon,
    group,
    color: seed.color,
    glow: seed.glow,
  }));
}

export const HOT_ISSUE_AXES: HotShortcutAxis[] = buildGroup('hotIssue', [
  { key: 'game', icon: Gamepad2, color: '#e879f9', glow: '#f5d0fe' },
  { key: 'sports', icon: Trophy, color: '#fb923c', glow: '#fed7aa' },
  { key: 'movie', icon: Film, color: '#facc15', glow: '#fde047' },
  { key: 'weather', icon: CloudSun, color: '#38bdf8', glow: '#7dd3fc' },
]);

export const FINANCE_AXES: HotShortcutAxis[] = buildGroup('finance', [
  { key: 'defi', icon: Coins, color: '#34d399', glow: '#6ee7b7' },
  { key: 'stocks', icon: LineChart, color: '#60a5fa', glow: '#93c5fd' },
  // bitcoin keeps its own brand orange
  { key: 'bitcoin', icon: Bitcoin, color: '#f7931a', glow: '#fbbf24' },
]);

export const REAL_ESTATE_AXES: HotShortcutAxis[] = buildGroup('realEstate', [
  { key: 'housing', icon: Home, color: '#2dd4bf', glow: '#99f6e4' },
  { key: 'rental', icon: KeyRound, color: '#a3e635', glow: '#d9f99d' },
  { key: 'mortgage', icon: Landmark, color: '#f59e0b', glow: '#fde68a' },
]);

export const DATING_AXES: HotShortcutAxis[] = buildGroup('dating', [
  { key: 'romance', icon: Heart, color: '#fb7185', glow: '#fecdd3' },
  { key: 'matchmaking', icon: HeartHandshake, color: '#f472b6', glow: '#fbcfe8' },
  { key: 'relationship', icon: Users, color: '#e879f9', glow: '#f5d0fe' },
]);

export const CAREER_AXES: HotShortcutAxis[] = buildGroup('career', [
  { key: 'career', icon: Briefcase, color: '#c084fc', glow: '#e9d5ff' },
]);

/**
 * The full "다차원 숏컷 매트릭스" (multi-dimensional shortcut matrix): every
 * U-AI-popup-driven group in one flat list. Direct-app launchers (email +
 * social, lib/appShortcuts.ts) and asset downloads (lib/unitasAssets.ts) are
 * deliberately NOT folded in here -- they open external apps / files directly
 * rather than HotShortcutResultModal's chained U-AI popup, so they stay their
 * own types.
 */
export const HOT_SHORTCUT_MATRIX: HotShortcutAxis[] = [
  ...GOVERNANCE_AXES.map((axis): HotShortcutAxis => ({ ...axis, group: 'governance' })),
  ...HOT_ISSUE_AXES,
  ...FINANCE_AXES,
  ...REAL_ESTATE_AXES,
  ...DATING_AXES,
  ...CAREER_AXES,
];

/** Every item belonging to one group, in matrix order -- the pool
 *  HotShortcutResultModal's infinite prev/next ladder cycles through. */
export function itemsInGroup(group: ShortcutGroup): HotShortcutAxis[] {
  return HOT_SHORTCUT_MATRIX.filter((axis) => axis.group === group);
}

/** Group + key -> axis (used to rehydrate a persisted ladder after a locale
 *  remount -- see HotShortcutResultModal's LADDER_STORAGE_KEY). */
export function findShortcutAxis(group: string, key: string): HotShortcutAxis | undefined {
  return HOT_SHORTCUT_MATRIX.find((axis) => axis.group === group && axis.key === key);
}

/** The next-intl `useTranslations` results for each U-AI-popup group, keyed
 *  by `HotShortcutAxis['group']` -- lets axisTitle/axisDescription below
 *  resolve any axis's copy without a per-group ternary at every call site. */
export type AxisTranslators = Record<ShortcutGroup, (key: string) => string>;

export function axisTitle(axis: HotShortcutAxis, t: AxisTranslators): string {
  return t[axis.group](`axes.${axis.messageKey}.title`);
}

export function axisDescription(axis: HotShortcutAxis, t: AxisTranslators): string {
  return t[axis.group](`axes.${axis.messageKey}.description`);
}
