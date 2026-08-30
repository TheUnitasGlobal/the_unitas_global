import { ECOSYSTEMS } from '@/lib/ecosystems';
import type {
  Band,
  Directionality,
  LensKey,
  LensScore,
  QueryArchetype,
  ShieldVerdict,
  SurfaceReport,
  SwarmScore,
} from './types';

/**
 * Phase-1 surface analysis -- 100% deterministic, client-side, zero cost.
 * Real keyword/pattern scoring (NOT an LLM call): the "3-second stereoscopic
 * perspective" (tech / economy / public opinion), the commercial-bias shield
 * gauge, the query archetype that selects the 3-step action checklist, and
 * the 11-ecosystem swarm score.
 *
 * All outputs are numbers or enum tags -- every piece of display text is
 * resolved from `messages/*.json` (`UAI.*`) by the dashboard, so this stays
 * locale-agnostic.
 */

const LENS_LEXICON: Record<LensKey, RegExp> = {
  tech: /\b(ai|ml|model|algorithm|code|software|hardware|data|system|api|cloud|automat|robot|quantum|neural|build|deploy|architecture|protocol|chip|gpu|llm|machine|engineer|dev)\w*/gi,
  economy: /\b(price|cost|money|invest|market|profit|revenue|budget|fee|coin|token|salary|roi|fund|capital|econom|financ|margin|tax|trade|pay|worth|cheap|expensive|value)\w*/gi,
  opinion: /\b(people|think|feel|trend|social|public|opinion|popular|community|culture|debate|controvers|sentiment|ethic|should|fair|trust|reputation|viral|consensus|belief)\w*/gi,
};

const COMMERCIAL_LEXICON =
  /\b(buy|best|cheapest|deal|discount|coupon|review|vs|versus|recommend|top\s?\d*|worth\s+it|should\s+i\s+(buy|get)|which\s+.*(better|best)|affiliate|sponsor|promo|sale|brand)\w*/gi;

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

function bandOf(score: number): Band {
  if (score >= 66) return 'high';
  if (score >= 33) return 'mid';
  return 'low';
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function analyzeSurface(
  query: string,
  tEcosystems: (key: string) => string,
  context = '',
): SurfaceReport {
  const trimmed = query.trim();
  const haystack = `${trimmed} ${context}`.trim();
  const lower = haystack.toLowerCase();
  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;

  const directionality: Directionality =
    /\?\s*$|^(why|how|what|when|where|who|which|explain|should|can|is|are|does)\b/i.test(trimmed)
      ? 'divergent'
      : 'convergent';

  const archetype: QueryArchetype =
    directionality === 'divergent'
      ? 'explore'
      : wordCount <= 4
        ? 'decide'
        : 'analyze';

  // Triple lens: raw keyword density -> 0-100, floored so every bar is
  // visible even for a terse query. A longer, richer query lifts every lens.
  const richness = Math.min(1, wordCount / 12);
  const lenses: LensScore[] = (Object.keys(LENS_LEXICON) as LensKey[]).map((key) => {
    const hits = countMatches(lower, LENS_LEXICON[key]);
    const raw = hits * 26 + richness * 22 + (trimmed ? 12 : 0);
    const score = clamp(raw);
    return { key, score, band: bandOf(score) };
  });

  // Shield gauge: commercial-intent pull. A genuine question ("?") relieves
  // it; comparison/purchase language drives it up.
  const commercialHits = countMatches(lower, COMMERCIAL_LEXICON);
  const shieldScore = clamp(
    commercialHits * 30 + (/\b(product|price|\$|€|₩)\b/i.test(haystack) ? 14 : 0) - (trimmed.endsWith('?') ? 10 : 0) + 6,
  );
  const shieldVerdict: ShieldVerdict =
    shieldScore >= 60 ? 'biased' : shieldScore >= 30 ? 'caution' : 'clear';

  // 11-ecosystem swarm -- keyword overlap against each (translated) title +
  // description, normalised against the top match.
  const terms = lower.split(/\s+/).filter((w) => w.length >= 3);
  const rawSwarm = ECOSYSTEMS.map((eco): SwarmScore & { raw: number } => {
    const title = tEcosystems(`${eco.messageKey}.title`);
    const description = tEcosystems(`${eco.messageKey}.description`);
    const text = `${title} ${description} ${eco.key}`.toLowerCase();
    let raw = terms.reduce((acc, w) => acc + (text.includes(w) ? 2 : 0), 0);
    if (trimmed && text.includes(trimmed.toLowerCase())) raw += 3;
    return { key: eco.key, messageKey: eco.messageKey, color: eco.color, score: 0, raw };
  });
  const maxRaw = Math.max(1, ...rawSwarm.map((s) => s.raw));
  const swarm: SwarmScore[] = rawSwarm
    .map(({ raw, ...rest }) => ({ ...rest, score: raw === 0 ? 0 : clamp((raw / maxRaw) * 100) }))
    .sort((a, b) => b.score - a.score);

  return {
    query: trimmed,
    directionality,
    archetype,
    lenses,
    shield: { score: shieldScore, verdict: shieldVerdict },
    checklistArchetype: archetype,
    swarm,
    topEcosystemKey: swarm[0]?.score ? swarm[0].key : null,
  };
}
