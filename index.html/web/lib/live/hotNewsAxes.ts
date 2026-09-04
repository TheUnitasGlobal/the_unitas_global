import {
  Globe2,
  Vote,
  TrendingUp,
  FlaskConical,
  Cpu,
  Cog,
  Trophy,
  Palette,
  Paintbrush,
  MessagesSquare,
  Languages,
  Users,
  Building2,
  Wrench,
  Scale,
  Landmark,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  Target,
  CloudLightning,
  type LucideIcon,
} from 'lucide-react';
import { HOT_NEWS_CATEGORIES, type HotNewsCategory } from './hotNews';

/**
 * Client-side presentation metadata for the 21 news filter axes -- icon +
 * colour per chip so the filter row reads exactly like the two ranking
 * carousels above it (icon 18px + bold uppercase label, owner instruction
 * 2026-09-04 round 6). The 16 doctrine axes reuse the very same icons and
 * palette as lib/governance.ts so a 언어/법/전략 chip here is visually the
 * same entity as the matching shortcut tile; the five world categories get
 * their own icons in the same palette family. Kept out of lib/live/hotNews.ts
 * so the server routes never import lucide.
 */
export interface HotNewsAxisMeta {
  key: HotNewsCategory;
  icon: LucideIcon;
  color: string;
}

const META: Record<HotNewsCategory, { icon: LucideIcon; color: string }> = {
  world: { icon: Globe2, color: '#22d3ee' },
  politics: { icon: Vote, color: '#f43f5e' },
  economy: { icon: TrendingUp, color: '#f97316' },
  science: { icon: FlaskConical, color: '#a855f7' },
  technology: { icon: Cpu, color: '#8b5cf6' },
  engineering: { icon: Cog, color: '#06b6d4' },
  sports: { icon: Trophy, color: '#fb923c' },
  culture: { icon: Palette, color: '#8b5cf6' },
  art: { icon: Paintbrush, color: '#f43f5e' },
  expression: { icon: MessagesSquare, color: '#10b981' },
  language: { icon: Languages, color: '#06b6d4' },
  society: { icon: Users, color: '#3b82f6' },
  structure: { icon: Building2, color: '#f59e0b' },
  pragma: { icon: Wrench, color: '#a855f7' },
  law: { icon: Scale, color: '#3b82f6' },
  institution: { icon: Landmark, color: '#f59e0b' },
  education: { icon: GraduationCap, color: '#f43f5e' },
  welfare: { icon: HeartHandshake, color: '#10b981' },
  security: { icon: ShieldCheck, color: '#a855f7' },
  strategy: { icon: Target, color: '#f97316' },
  disaster: { icon: CloudLightning, color: '#ef4444' },
};

export const HOT_NEWS_AXES: HotNewsAxisMeta[] = HOT_NEWS_CATEGORIES.map((key) => ({ key, ...META[key] }));

export function hotNewsAxisMeta(key: HotNewsCategory): HotNewsAxisMeta {
  return { key, ...META[key] };
}
