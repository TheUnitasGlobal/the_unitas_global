import { createHash } from 'node:crypto';
import { LOCALE_NAME } from './deepInsight';
import type { GlobalRankingEntry, GlobalRankingThemeKey } from '../globalRankings';

/**
 * FREE encyclopedic ranking-detail popup (owner instruction 2026-09-04
 * round 3: "1위(또는 상위 순위) 클릭 시 ... 백과사전급 세부 설명, 역사적
 * 배경, 핵심 데이터 정보를 모든 랭킹 테마에 공통 적용" + "상단 언어
 * 셀렉터 변경에 따라 해당 국가 언어로 완벽하게 번역").
 *
 * Rather than hand-authoring ~240 curated one-liners (ranks 1-20 x 12
 * themes) into 20 static locale files -- which the codebase's own design
 * note in lib/globalRankings.ts explicitly opted out of for proper nouns --
 * this generates the deep write-up on demand, grounded in the theme's
 * canonical (English) name/note/detail so the model can't drift off-subject,
 * then parks it in `genesis_memory` forever (same table + fail-open pattern
 * as constitutionRedesign.ts's 'cr-v1' namespace and shortcutCache.ts's deep
 * reports). One LLM call per (locale, theme, rank) combination, EVER -- after
 * that every visitor of that popup in that language is served from Postgres
 * at engine cost 0원, matching the "초지능 캐싱 ... 마진율 무한대" doctrine.
 *
 * Server-only (node:crypto). The route is the sole caller.
 */

export const RANKING_DETAIL_VERSION = 'rd-v1';

/** Output budget: name/note localization + 4 short sections comfortably fit. */
export const RANKING_DETAIL_MAX_TOKENS = 1400;

export interface RankingDetailReport {
  rank: number;
  theme: GlobalRankingThemeKey;
  /** Canonical (English) name -- always present, used as a stable fallback. */
  name: string;
  /** Localized display name (e.g. "Italy" -> "이탈리아"). Falls back to
   *  `name` for locales/subjects where transliteration isn't idiomatic. */
  localizedName: string;
  /** Localized short qualifier (e.g. "60 sites" -> "유적 60곳"). */
  localizedNote: string;
  overview: string;
  background: string;
  keyFacts: string[];
  significance: string;
  model: string;
  cached: boolean;
}

export interface RankingDetailApiResponse {
  ok: boolean;
  report: RankingDetailReport | null;
}

export function rankingDetailHash(locale: string, theme: GlobalRankingThemeKey, rank: number): string {
  return createHash('sha256').update(`${RANKING_DETAIL_VERSION}::${locale}::${theme}::${rank}`).digest('hex');
}

export function buildRankingDetailPrompt(
  entry: GlobalRankingEntry,
  theme: GlobalRankingThemeKey,
  themeTitle: string,
  locale: string,
): { system: string; user: string } {
  const lang = LOCALE_NAME[locale] ?? 'English';
  const system = [
    'You are U-AI, the sovereign encyclopedic engine of THE UNITAS GLOBAL.',
    `A visitor tapped into rank #${entry.rank} of a "${themeTitle}" leaderboard and wants a deep, study-grade explainer -- not a one-line caption.`,
    'You are given CANONICAL FACTS below (name, rank, a short stat, and optionally a one-line note). Treat them as ground truth and never contradict the figures given -- your job is to explain and enrich, not to re-derive or invent different numbers.',
    'Produce:',
    '  - localizedName: the subject name rendered the way a native reader of the target language conventionally expects (idiomatic exonym/transliteration for countries and well-known places; keep the original for names that stay in Latin script/untranslated by convention in that language).',
    '  - localizedNote: the short qualifier, translated and kept concise.',
    '  - overview: 2-3 sentences introducing the subject and why it holds this rank.',
    '  - background: one richer paragraph (roughly 80-140 words) of historical or contextual background.',
    '  - keyFacts: 4-6 short, concrete, independently-verifiable facts as separate strings (no bullet characters, no numbering).',
    '  - significance: 1-2 sentences on the subject\'s broader legacy or significance.',
    'Voice: precise, encyclopedic, engaging -- never marketing fluff, never hedging, never inventing figures beyond the canonical facts given.',
    `Write every string value in ${lang}.`,
    'Return ONLY a single minified JSON object, no markdown fences, no commentary. Schema:',
    '{"localizedName":"...","localizedNote":"...","overview":"...","background":"...","keyFacts":["...","...","...","..."],"significance":"..."}',
  ].join('\n');
  const user = [
    `CANONICAL FACTS: name="${entry.name}", rank=${entry.rank}, note="${entry.note}"${entry.detail ? `, existing summary="${entry.detail}"` : ''}, theme="${themeTitle}"`,
  ].join('\n');
  return { system, user };
}

function asString(v: unknown, fallback: string, max = 900): string {
  if (typeof v !== 'string') return fallback;
  const clean = Array.from(v)
    .filter((ch) => ch === '\n' || ch === '\t' || (ch >= ' ' && ch !== ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? clean.slice(0, max) : fallback;
}

function asStringArray(v: unknown, max = 6, maxLen = 240): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((s) => asString(s, '', maxLen))
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Parse the model's raw text into a validated RankingDetailReport. Throws
 * only when no JSON object is present at all (the route treats that as a
 * generation failure and the client falls back to the static one-liner).
 */
export function parseRankingDetailResponse(
  raw: string,
  model: string,
  entry: GlobalRankingEntry,
  theme: GlobalRankingThemeKey,
): RankingDetailReport {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('No JSON object in model response');
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  return {
    rank: entry.rank,
    theme,
    name: entry.name,
    localizedName: asString(parsed.localizedName, entry.name, 200),
    localizedNote: asString(parsed.localizedNote, entry.note, 200),
    overview: asString(parsed.overview, entry.detail ?? entry.note, 700),
    background: asString(parsed.background, '—', 1400),
    keyFacts: asStringArray(parsed.keyFacts),
    significance: asString(parsed.significance, '—', 500),
    model,
    cached: false,
  };
}
