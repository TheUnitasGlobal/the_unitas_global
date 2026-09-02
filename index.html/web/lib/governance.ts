import {
  Languages,
  Palette,
  Users,
  Building2,
  Paintbrush,
  MessagesSquare,
  Wrench,
  TrendingUp,
  Cog,
  Cpu,
  Scale,
  Landmark,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  Target,
  type LucideIcon,
} from 'lucide-react';

// The 16 "지성 문명 및 사회 거버넌스" (Intelligent Civilization & Social Governance)
// axes from CLAUDE.md §3.3: 언어,문화,사회,구조,예술,표현,실용,경제,공학,기술,
// 법,제도,교육,복지,안보,전략. Doctrine-only until now (prose in CLAUDE.md, no
// UI) -- this is the first shortcut-matrix rendering of it. Navigated as a
// single "ladder" (see GovernanceLadderModal) rather than 16 separate modals,
// per lib/uiGate.ts's one-surface-at-a-time design.

export interface GovernanceAxis {
  key: string;
  messageKey: string;
  color: string;
  glow: string;
  icon: LucideIcon;
}

/** 8-color rotation reused across two full passes for the 16 axes -- same
 *  palette family as lib/ecosystems.ts, kept distinct from its instances. */
const PALETTE: Array<{ color: string; glow: string }> = [
  { color: '#06b6d4', glow: '#67e8f9' },
  { color: '#8b5cf6', glow: '#c4b5fd' },
  { color: '#3b82f6', glow: '#93c5fd' },
  { color: '#f59e0b', glow: '#fde68a' },
  { color: '#f43f5e', glow: '#fda4af' },
  { color: '#10b981', glow: '#6ee7b7' },
  { color: '#a855f7', glow: '#d8b4fe' },
  { color: '#f97316', glow: '#fdba74' },
];

const AXES_BASE: Array<{ key: string; icon: LucideIcon }> = [
  { key: 'language', icon: Languages },
  { key: 'culture', icon: Palette },
  { key: 'society', icon: Users },
  { key: 'structure', icon: Building2 },
  { key: 'art', icon: Paintbrush },
  { key: 'expression', icon: MessagesSquare },
  { key: 'pragma', icon: Wrench },
  { key: 'economy', icon: TrendingUp },
  { key: 'engineering', icon: Cog },
  { key: 'technology', icon: Cpu },
  { key: 'law', icon: Scale },
  { key: 'institution', icon: Landmark },
  { key: 'education', icon: GraduationCap },
  { key: 'welfare', icon: HeartHandshake },
  { key: 'security', icon: ShieldCheck },
  { key: 'strategy', icon: Target },
];

export const GOVERNANCE_AXES: GovernanceAxis[] = AXES_BASE.map((axis, i) => ({
  key: axis.key,
  messageKey: axis.key,
  icon: axis.icon,
  ...PALETTE[i % PALETTE.length],
}));
