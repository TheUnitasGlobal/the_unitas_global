// Deterministic contradiction stress-test for the Paradox ecosystem
// (Ecosystems.paradox.rules: "Submit a conclusion; Paradox rewinds it to
// find where it contradicts itself."). Pattern-matching over the
// conclusion's own wording, not a formal logic solver.

const ABSOLUTE_RE = /\b(always|never|all|none|every|impossible|only)\b/i;
const HEDGE_RE = /\b(sometimes|except|unless|but|however|although|usually|often|occasionally)\b/i;
const CIRCULAR_RE = /\bbecause it (is|always has|just does)\b|\bsince it (is|always has)\b/i;

export interface ParadoxResult {
  /** Translation keys under ModuleEngine, e.g. "paradoxAbsoluteClaim". */
  findingKeys: string[];
  verdictKey: string;
}

export function runParadoxStressTest(conclusion: string): ParadoxResult {
  const trimmed = conclusion.trim();
  const findingKeys: string[] = [];

  const hasAbsolute = ABSOLUTE_RE.test(trimmed);
  const hasHedge = HEDGE_RE.test(trimmed);

  if (hasAbsolute && hasHedge) {
    findingKeys.push('paradoxSelfContradiction');
  } else if (hasAbsolute) {
    findingKeys.push('paradoxAbsoluteClaim');
  }

  if (CIRCULAR_RE.test(trimmed)) {
    findingKeys.push('paradoxCircular');
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount > 0 && wordCount < 6) {
    findingKeys.push('paradoxUnderspecified');
  }

  const verdictKey = findingKeys.length > 0 ? 'paradoxVerdictBroken' : 'paradoxVerdictHeld';
  return { findingKeys, verdictKey };
}
