// Timed decision-scoring for the Apex ecosystem (Ecosystems.apex.rules:
// "High-stakes performance simulation under a hard countdown clock... The
// timer does not pause. Submit before zero or the run is forfeit."). The
// countdown/timer itself is inherently stateful and lives in ApexEngine.tsx;
// this file is the pure, testable scoring function it calls once a choice
// (or a timeout) happens. Verdicts/rationale are translation keys, not
// English strings, so the component renders them through next-intl.

export const APEX_SCENARIO_OPTIONS = ['match', 'hold', 'bundle'] as const;
export type ApexOptionId = (typeof APEX_SCENARIO_OPTIONS)[number];

const BASE_SCORES: Record<ApexOptionId, number> = {
  match: 45,
  hold: 65,
  bundle: 80,
};

export interface ApexResult {
  score: number;
  optionId: ApexOptionId | null;
  /** Translation key under ModuleEngine for the verdict line. */
  verdictKey: string;
  /** Translation key under ModuleEngine for the one-line rationale. */
  rationaleKey: string;
  forfeited: boolean;
}

export function scoreApexRun(optionId: ApexOptionId | null, timeRemainingMs: number, totalMs: number): ApexResult {
  if (!optionId) {
    return {
      score: 0,
      optionId: null,
      verdictKey: 'apexForfeitVerdict',
      rationaleKey: 'apexForfeitRationale',
      forfeited: true,
    };
  }

  const timeBonus = Math.round(Math.max(0, Math.min(1, timeRemainingMs / totalMs)) * 20);
  const score = Math.min(100, BASE_SCORES[optionId] + timeBonus);
  const verdictKey = score >= 80 ? 'apexVerdictHigh' : score >= 55 ? 'apexVerdictMid' : 'apexVerdictLow';
  const rationaleKey = `apexOption${optionId.charAt(0).toUpperCase()}${optionId.slice(1)}Rationale`;

  return { score, optionId, verdictKey, rationaleKey, forfeited: false };
}
