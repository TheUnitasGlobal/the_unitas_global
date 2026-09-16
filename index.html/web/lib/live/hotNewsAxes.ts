import { HOT_NEWS_CATEGORIES, type HotNewsCategory } from './hotNews';

/**
 * Client-side presentation metadata for the 22 news filter axes (REV-29
 * M2.2 split 복지·보건 and 안보·분쟁 into one theme per box) -- the accent
 * colour per axis. The 16 doctrine axes keep the very same palette as
 * lib/governance.ts so a 언어/법/전략 chip here is visually the same entity
 * as the matching shortcut tile; the four world categories sit in the same
 * palette family. REV-23 M3.2 removed the catch-all 'world' axis.
 *
 * REV-34 M1-E (founder directive 2026-09-16): the lucide icon per axis is
 * gone -- the news widget draws the shortcut strip's minimal coloured dot
 * (components/home/hub/HubDot.tsx) instead of a picture, so this map is now
 * colour only. The keys and colours are unchanged; only the `icon` field and
 * the lucide import left. Kept out of lib/live/hotNews.ts so the server
 * routes never import presentation data.
 */
export interface HotNewsAxisMeta {
  key: HotNewsCategory;
  color: string;
}

const META: Record<HotNewsCategory, { color: string }> = {
  politics: { color: '#f43f5e' },
  economy: { color: '#f97316' },
  science: { color: '#a855f7' },
  technology: { color: '#8b5cf6' },
  engineering: { color: '#06b6d4' },
  sports: { color: '#fb923c' },
  culture: { color: '#8b5cf6' },
  art: { color: '#f43f5e' },
  expression: { color: '#10b981' },
  language: { color: '#06b6d4' },
  society: { color: '#3b82f6' },
  structure: { color: '#f59e0b' },
  pragma: { color: '#a855f7' },
  law: { color: '#3b82f6' },
  institution: { color: '#f59e0b' },
  education: { color: '#f43f5e' },
  welfare: { color: '#10b981' },
  health: { color: '#14b8a6' },
  security: { color: '#a855f7' },
  conflict: { color: '#b91c1c' },
  strategy: { color: '#f97316' },
  disaster: { color: '#ef4444' },
};

export const HOT_NEWS_AXES: HotNewsAxisMeta[] = HOT_NEWS_CATEGORIES.map((key) => ({ key, ...META[key] }));

export function hotNewsAxisMeta(key: HotNewsCategory): HotNewsAxisMeta {
  return { key, ...META[key] };
}
