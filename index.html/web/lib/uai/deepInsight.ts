import type { BinaryVerdict, ChronosPoint, DeepReport } from './types';

/**
 * Deep-insight (Phase 2-4) prompt + strict-JSON parser. Pure functions --
 * imported by the API route (server) only, but kept dependency-free so they
 * can be unit-tested in isolation.
 */

const LOCALE_NAME: Record<string, string> = {
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
};

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 400);
}

export function buildInsightPrompt(query: string, locale: string): { system: string; user: string } {
  const lang = LOCALE_NAME[locale] ?? 'English';
  const system = [
    'You are U-AI, the sovereign omni-analysis engine of THE UNITAS GLOBAL.',
    'You do not answer casually. You produce a decision-grade intelligence brief that a founder can act on.',
    'Voice: hyper-logical, original, future-facing, philosophically deep, precise. Never marketing fluff.',
    `Write every string value in ${lang}.`,
    'Return ONLY a single minified JSON object, no markdown fences, no commentary. Schema:',
    '{',
    '  "chronos": [ {"horizon":"y1","text":"..."}, {"horizon":"y2","text":"..."}, {"horizon":"y3","text":"..."} ],',
    '  "binary": {"optionA":"...","optionB":"...","pick":"A"|"B","rationale":"...","confidence":0-100},',
    '  "redPen": ["...", "...", "..."],',
    '  "voidInsight": "one cinematic paragraph on the question behind the question -- the negative space",',
    '  "efficiencyPath": ["step 1", "step 2", "step 3", "step 4"]',
    '}',
    'chronos: concrete 1/2/3-year trajectory of the subject. binary: the sharpest either/or the user faces, decided with a quantified rationale. redPen: 3 hidden commercial or structural intents behind how the query is framed. efficiencyPath: the highest-leverage route that breaks the user\'s implied constraints.',
  ].join('\n');
  const user = `QUERY: ${query.trim().slice(0, 400)}`;
  return { system, user };
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function asStringArray(v: unknown, min: number): string[] {
  const arr = Array.isArray(v) ? v.map((x) => asString(x)).filter(Boolean) : [];
  return arr.length >= min ? arr : [...arr, ...Array(Math.max(0, min - arr.length)).fill('—')];
}

function asNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
}

/**
 * Parse Claude's raw text into a validated DeepReport. Tolerant of stray
 * markdown fences / leading prose; throws only if no JSON object is present
 * at all.
 */
export function parseInsightResponse(raw: string, model: string): DeepReport {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('No JSON object in model response');
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;

  const chronosRaw = Array.isArray(parsed.chronos) ? parsed.chronos : [];
  const horizons: ChronosPoint['horizon'][] = ['y1', 'y2', 'y3'];
  const chronos: ChronosPoint[] = horizons.map((horizon, i) => {
    const item = (chronosRaw[i] ?? {}) as Record<string, unknown>;
    return { horizon, text: asString(item.text, '—') };
  });

  const binRaw = (parsed.binary ?? {}) as Record<string, unknown>;
  const binary: BinaryVerdict = {
    optionA: asString(binRaw.optionA, '—'),
    optionB: asString(binRaw.optionB, '—'),
    pick: binRaw.pick === 'B' ? 'B' : 'A',
    rationale: asString(binRaw.rationale, '—'),
    confidence: asNumber(binRaw.confidence, 50),
  };

  return {
    chronos,
    binary,
    redPen: asStringArray(parsed.redPen, 3).slice(0, 5),
    voidInsight: asString(parsed.voidInsight, '—'),
    efficiencyPath: asStringArray(parsed.efficiencyPath, 3).slice(0, 6),
    model,
    cached: false,
  };
}
