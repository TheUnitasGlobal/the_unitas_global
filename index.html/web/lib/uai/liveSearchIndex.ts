import type { LucideIcon } from 'lucide-react';
import { HOT_SHORTCUT_MATRIX, axisDescription, axisTitle, type AxisTranslators, type HotShortcutAxis } from '@/lib/hotIssues';
import { EMAIL_SHORTCUTS, SOCIAL_SHORTCUTS, type DirectAppShortcut } from '@/lib/appShortcuts';
import { progressiveMatch, type MatchRange } from '@/lib/hangul';
import type { LiveSuggestion } from './liveSuggest';

/**
 * The local half of the "글자 조합별 실시간 검색" dropdown: every knowledge
 * tier of the 30-axis shortcut matrix plus the direct-app launchers, folded
 * into one flat, already-localized corpus that the IME-aware matcher
 * (lib/hangul.ts) filters on every keystroke -- zero network, zero cost,
 * instant. The live-web half (liveSuggest.ts) is merged in by the caller.
 *
 * Deliberately excludes the ecosystem / module / protocol catalog cards the
 * dropdown used to render (owner instruction 2026-09-03: "기존 Echo/Chronos/
 * U-Key 레거시 카드를 완전히 삭제") -- those stay reachable from the module
 * walls below the search bar, where they belong.
 */

export type LiveResultKind = 'axis' | 'app' | 'web';

export interface LiveResult {
  kind: LiveResultKind;
  /** Unique across kinds -- used as React key and for de-duplication. */
  id: string;
  title: string;
  description: string;
  /** Localized category label (the strip's tab label, or the "live web" label). */
  category: string;
  icon?: LucideIcon;
  color?: string;
  /** Set for `axis` results: opens the infinite knowledge ladder on it. */
  axis?: HotShortcutAxis;
  /** Set for `app` and `web` results: the outbound page. */
  url?: string;
  /** Where the query matched inside `title` (code points), for highlighting. */
  range: MatchRange | null;
}

export interface LiveIndexLabels {
  axisT: AxisTranslators;
  /** `OmniSynapse.tab.<group>` -- one label per matrix group + email/social. */
  tabLabel: (tab: string) => string;
  /** Localized description for a direct-app tile (e.g. "Open Gmail in a new tab"). */
  appDescription: (app: DirectAppShortcut) => string;
}

export interface LiveIndexEntry {
  kind: 'axis' | 'app';
  id: string;
  title: string;
  description: string;
  category: string;
  icon: LucideIcon;
  color: string;
  axis?: HotShortcutAxis;
  url?: string;
  /** Extra strings the matcher may also hit (description words, brand key). */
  aliases: string[];
}

/** Build the localized corpus once per locale (cheap: ~40 entries). */
export function buildLiveIndex(labels: LiveIndexLabels): LiveIndexEntry[] {
  const axes: LiveIndexEntry[] = HOT_SHORTCUT_MATRIX.map((axis) => {
    const title = axisTitle(axis, labels.axisT);
    const description = axisDescription(axis, labels.axisT);
    return {
      kind: 'axis',
      id: `axis:${axis.group}:${axis.key}`,
      title,
      description,
      category: labels.tabLabel(axis.group),
      icon: axis.icon,
      color: axis.color,
      axis,
      aliases: [axis.key, axis.messageKey],
    };
  });
  const apps: LiveIndexEntry[] = [...EMAIL_SHORTCUTS, ...SOCIAL_SHORTCUTS].map((app) => ({
    kind: 'app',
    id: `app:${app.family}:${app.key}`,
    title: app.brand,
    description: labels.appDescription(app),
    category: labels.tabLabel(app.family),
    icon: app.icon,
    color: app.color,
    url: app.url,
    aliases: [app.key],
  }));
  return [...axes, ...apps];
}

/**
 * Filter the local corpus with the progressive matcher. Title hits rank
 * first (earliest match position wins), then alias/description hits.
 */
export function searchLiveIndex(index: LiveIndexEntry[], query: string, limit = 10): LiveResult[] {
  const q = query.trim();
  if (!q) return [];
  const scored: Array<{ entry: LiveIndexEntry; range: MatchRange | null; score: number }> = [];
  for (const entry of index) {
    const titleRange = progressiveMatch(q, entry.title);
    if (titleRange) {
      scored.push({ entry, range: titleRange, score: 1000 - titleRange.start });
      continue;
    }
    const aliasHit = entry.aliases.some((alias) => progressiveMatch(q, alias) !== null);
    if (aliasHit) {
      scored.push({ entry, range: null, score: 500 });
      continue;
    }
    const descRange = progressiveMatch(q, entry.description);
    if (descRange) scored.push({ entry, range: null, score: 100 - Math.min(99, descRange.start) });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry, range }) => ({
      kind: entry.kind,
      id: entry.id,
      title: entry.title,
      description: entry.description,
      category: entry.category,
      icon: entry.icon,
      color: entry.color,
      axis: entry.axis,
      url: entry.url,
      range,
    }));
}

/** Fold live-web suggestions in after the local hits, skipping duplicates. */
export function mergeLiveResults(
  local: LiveResult[],
  web: LiveSuggestion[],
  query: string,
  webCategory: string,
  limit = 14,
): LiveResult[] {
  const seen = new Set(local.map((r) => r.title.toLowerCase()));
  const merged = [...local];
  for (const s of web) {
    const key = s.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      kind: 'web',
      id: `web:${s.url}`,
      title: s.title,
      description: s.description,
      category: webCategory,
      url: s.url,
      range: progressiveMatch(query, s.title),
    });
    if (merged.length >= limit) break;
  }
  return merged.slice(0, limit);
}
