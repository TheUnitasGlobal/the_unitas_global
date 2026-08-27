// Deterministic risk-gap analyzer for the Void ecosystem (Ecosystems.void.rules:
// "Submit a thesis; Void returns only what breaks it."). A real lexicon-coverage
// check across four risk categories plus an absolute-language detector -- not an
// LLM critique, just what the thesis text does and doesn't mention.

interface VoidCategory {
  key: string;
  lexicon: RegExp;
}

const CATEGORIES: VoidCategory[] = [
  { key: 'Legal', lexicon: /legal|contract|liabilit|complian|regulat|lawsuit/i },
  { key: 'Financial', lexicon: /revenue|cost|cash|budget|price|margin|profit|funding/i },
  { key: 'Competitive', lexicon: /competitor|market share|rival|alternative|substitute/i },
  { key: 'Operational', lexicon: /team|hire|supply|logistics|capacity|timeline|execution/i },
];

const ABSOLUTE_RE = /\b(always|never|guaranteed?|definitely|impossible|certainly|no risk|can'?t fail)\b/gi;

export interface VoidResult {
  /** Translation keys under ModuleEngine, e.g. "voidGapLegal". */
  gapKeys: string[];
  unhedgedClaims: string[];
  verdictKey: string;
}

export function runVoidAnalysis(thesis: string): VoidResult {
  const gapKeys = CATEGORIES.filter((c) => !c.lexicon.test(thesis)).map((c) => `voidGap${c.key}`);
  const unhedgedClaims = Array.from(new Set((thesis.match(ABSOLUTE_RE) ?? []).map((m) => m.trim().toLowerCase())));
  const verdictKey = gapKeys.length === 0 && unhedgedClaims.length === 0 ? 'voidVerdictClean' : 'voidVerdictBroken';
  return { gapKeys, unhedgedClaims, verdictKey };
}
