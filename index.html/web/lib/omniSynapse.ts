import { ECOSYSTEMS, type EcosystemTheme } from './ecosystems';

export interface OmniSynapseAnalysis {
  directionality: string;
  concept: string;
  tendency: string;
  matches: Array<{ eco: EcosystemTheme; title: string }>;
  /** All 11 ecosystems scored simultaneously, sorted highest-first -- the "Swarm Cross-Reasoning" view. */
  swarm: Array<{ eco: EcosystemTheme; title: string; score: number }>;
}

/**
 * Client-side heuristic "AI Architect" analysis -- real keyword/pattern
 * scoring against the 11 ecosystems' (translated) title+description, NOT a
 * real LLM call. Four dimensions per the brief:
 *  - Directionality: question-like (Divergent) vs. declarative (Convergent)
 *  - Concept/Ideology: keyword-lexicon match against a few broad concept buckets
 *  - User Tendency: derived from query length
 *  - Blueprint: the top-scoring ecosystem match (matches[0])
 */
export function analyzeQuery(
  query: string,
  tEcosystems: (key: string) => string,
  /** Extra text pulled from drag-and-dropped files/tabs, folded into scoring alongside the typed query. */
  context = '',
): OmniSynapseAnalysis {
  const trimmed = query.trim();
  const q = `${trimmed} ${context}`.trim().toLowerCase();

  const directionality = /\?\s*$|^(why|how|what|when|where|who|explain)\b/i.test(trimmed)
    ? 'Divergent'
    : 'Convergent';

  const conceptLexicon: Array<[RegExp, string]> = [
    [/pay|money|fiscal|coin|market|invest|price/i, 'Fiscal'],
    [/trend|future|predict|forecast|next/i, 'Predictive'],
    [/self|identity|feel|emotion|who am i/i, 'Introspective'],
    [/history|time|cycle|decade|year/i, 'Temporal'],
    [/network|connect|relation|link/i, 'Relational'],
  ];
  const concept = conceptLexicon.find(([re]) => re.test(trimmed))?.[1] ?? 'Structural';

  const typedWordCount = trimmed.toLowerCase().split(/\s+/).filter(Boolean).length;
  const tendency =
    typedWordCount === 0 ? '—' : typedWordCount <= 3 ? 'Decisive' : typedWordCount <= 8 ? 'Exploratory' : 'Analytical';

  const words = q.split(/\s+/).filter((w) => w.length >= 3);
  const swarm = ECOSYSTEMS.map((eco) => {
    const title = tEcosystems(`${eco.messageKey}.title`);
    const description = tEcosystems(`${eco.messageKey}.description`);
    const text = `${title} ${description} ${eco.key}`.toLowerCase();
    let score = words.reduce((acc, w) => acc + (text.includes(w) ? 2 : 0), 0);
    if (trimmed.length > 0 && text.includes(trimmed.toLowerCase())) score += 3;
    return { eco, title, score };
  }).sort((a, b) => b.score - a.score);

  const matches = swarm.filter((s) => s.score > 0).slice(0, 3).map(({ eco, title }) => ({ eco, title }));

  return { directionality, concept, tendency, matches, swarm };
}
