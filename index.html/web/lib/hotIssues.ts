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
// weather/culture/society/expression/strategy), finance (defi/stocks/
// bitcoin/economy), real estate (housing/rental/mortgage), dating (romance/
// matchmaking/relationship), career (job market + engineering/technology/
// pragma), civic (language/art/structure/law/institution/education/welfare/
// security). The old standalone "governance" tab (owner instruction
// 2026-09-03: "거버넌스 탭을 일괄 제거") was retired from this shortcut
// matrix -- its 16 doctrine-derived axes (lib/governance.ts, CLAUDE.md §3.3)
// now live folded into the groups above (finance/career/hotIssue) or, for
// the eight that didn't fit an existing box, the new dedicated "civic" box.
// Section 4's standalone 16-axis Governance Matrix wall (HomeContent,
// GovernanceCard/GovernanceLadderModal) is untouched -- it reads
// GOVERNANCE_AXES directly and isn't part of this shortcut-popup matrix.
// Each group lives in its own message namespace (`HotIssue`, `Finance`,
// `RealEstate`, `Dating`, `Career`, `Civic`) while sharing this one shape so
// HotShortcutMatrixStrip and HotShortcutResultModal can render every group
// generically. Every axis here seeds the fully-automated shortcut analytics
// engine (lib/uai/shortcutAnalytics.ts) with its localized title as the
// query.

export type ShortcutGroup = 'civic' | 'hotIssue' | 'finance' | 'realEstate' | 'dating' | 'career';

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

/** Re-groups one of the 16 doctrine axes (lib/governance.ts) into one of
 *  this matrix's own groups -- keeps its icon/color/glow, keeps its
 *  `messageKey` (so `axisTitle` resolves it under the NEW group's own
 *  `axes.<key>` message namespace, which the locale files mirror 1:1 from
 *  `Governance.axes.<key>`, see messages/*.json). */
function fromGovernance(key: string, group: ShortcutGroup): HotShortcutAxis {
  const axis = GOVERNANCE_AXES.find((a) => a.key === key);
  if (!axis) throw new Error(`fromGovernance: unknown governance axis "${key}"`);
  return { key: axis.key, messageKey: axis.key, icon: axis.icon, color: axis.color, glow: axis.glow, group };
}

export const HOT_ISSUE_AXES: HotShortcutAxis[] = [
  ...buildGroup('hotIssue', [
    { key: 'game', icon: Gamepad2, color: '#e879f9', glow: '#f5d0fe' },
    { key: 'sports', icon: Trophy, color: '#fb923c', glow: '#fed7aa' },
    { key: 'movie', icon: Film, color: '#facc15', glow: '#fde047' },
    { key: 'weather', icon: CloudSun, color: '#38bdf8', glow: '#7dd3fc' },
  ]),
  // 유저 참여를 유도하는 확장 숏컷 (owner instruction 2026-09-03): folded in
  // from the retired governance tab rather than invented from scratch, so
  // every one of these already carries a full 20-locale doctrine blurb.
  fromGovernance('culture', 'hotIssue'),
  fromGovernance('society', 'hotIssue'),
  fromGovernance('expression', 'hotIssue'),
  fromGovernance('strategy', 'hotIssue'),
];

export const FINANCE_AXES: HotShortcutAxis[] = [
  ...buildGroup('finance', [
    { key: 'defi', icon: Coins, color: '#34d399', glow: '#6ee7b7' },
    { key: 'stocks', icon: LineChart, color: '#60a5fa', glow: '#93c5fd' },
    // bitcoin keeps its own brand orange
    { key: 'bitcoin', icon: Bitcoin, color: '#f7931a', glow: '#fbbf24' },
  ]),
  fromGovernance('economy', 'finance'),
];

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

export const CAREER_AXES: HotShortcutAxis[] = [
  ...buildGroup('career', [{ key: 'career', icon: Briefcase, color: '#c084fc', glow: '#e9d5ff' }]),
  fromGovernance('engineering', 'career'),
  fromGovernance('technology', 'career'),
  fromGovernance('pragma', 'career'),
];

/** The eight doctrine axes with no natural home in an existing group --
 *  their own dedicated box (owner instruction 2026-09-03: "새로운 전용
 *  박스를 생성"), replacing the old flat 16-item governance tab. */
export const CIVIC_AXES: HotShortcutAxis[] = [
  'language',
  'art',
  'structure',
  'law',
  'institution',
  'education',
  'welfare',
  'security',
].map((key) => fromGovernance(key, 'civic'));

/**
 * The full "다차원 숏컷 매트릭스" (multi-dimensional shortcut matrix): every
 * U-AI-popup-driven group in one flat list. Direct-app launchers (email +
 * social, lib/appShortcuts.ts) and asset downloads (lib/unitasAssets.ts) are
 * deliberately NOT folded in here -- they open external apps / files directly
 * rather than HotShortcutResultModal's chained U-AI popup, so they stay their
 * own types.
 */
export const HOT_SHORTCUT_MATRIX: HotShortcutAxis[] = [
  ...CIVIC_AXES,
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
