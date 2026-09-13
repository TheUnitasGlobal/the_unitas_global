/**
 * Shared query-normalisation + locale-name table.
 *
 * REV-23 M2.2 (founder directive 2026-09-13): this module used to be the
 * deep-insight (Phase 2-4) prompt builder and strict-JSON parser. The deep
 * tier is deleted, so `buildInsightPrompt` and `parseInsightResponse` are
 * gone with it. What survives is what the SHORTCUT and TREND engines -- both
 * kept surfaces -- import from here: `normalizeQuery` (the Genesis Memory
 * cache key) and `LOCALE_NAME`. The filename stays so those imports do not
 * churn.
 */

export const LOCALE_NAME: Record<string, string> = {
  en: 'English',
  ko: 'Korean',
  et: 'Estonian',
  ja: 'Japanese',
  zh: 'Simplified Chinese',
  es: 'Spanish',
  km: 'Khmer',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ru: 'Russian',
  hi: 'Hindi',
  it: 'Italian',
  tr: 'Turkish',
  th: 'Thai',
  pl: 'Polish',
  nl: 'Dutch',
  tl: 'Tagalog',
};

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 400);
}
