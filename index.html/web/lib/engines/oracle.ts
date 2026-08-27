// Deterministic probabilistic-forecast calculator for the Oracle ecosystem
// (Ecosystems.oracle.rules: "Ask one question at a time; Oracle answers in
// probabilities, never certainties"). A weighted-heuristic simulation over
// the visitor's own inputs -- not a real forecasting model, and not framed
// as one; the "financial/decision calculation engine" here is honest about
// being a structured way to reason through the three inputs, not a market
// predictor.

export interface OracleInput {
  question: string;
  /** 0-100: how solid the visitor's current information is. */
  confidence: number;
  /** 0-100: how much the situation is expected to shift unpredictably. */
  volatility: number;
  /** Years until the decision's outcome is actually known. */
  horizonYears: number;
}

export interface OracleDistribution {
  likely: number;
  uncertain: number;
  unlikely: number;
}

export interface OracleResult {
  distribution: OracleDistribution;
  rationale: string[];
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function keyTerm(question: string): string {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/gi, '')
    .split(/\s+/)
    .filter((w) => w.length > 3);
  return words.sort((a, b) => b.length - a.length)[0] ?? 'this decision';
}

export function runOracleForecast(input: OracleInput): OracleResult {
  const { question, confidence, volatility, horizonYears } = input;
  const boundedHorizon = clamp(horizonYears, 1, 30);

  const uncertain = clamp(20 + volatility * 0.3 + boundedHorizon * 0.6, 10, 70);
  const remaining = 100 - uncertain;
  const likelyShare = clamp(0.5 + (confidence - 50) / 200 - (volatility - 50) / 400, 0.1, 0.9);

  let likely = Math.round(remaining * likelyShare);
  let unlikely = Math.round(remaining - likely);
  const uncertainRounded = Math.round(uncertain);

  const drift = 100 - (likely + unlikely + uncertainRounded);
  likely += drift;
  if (likely < 0) {
    unlikely += likely;
    likely = 0;
  }

  const term = keyTerm(question);
  const seed = hashSeed(question);
  const rationale: string[] = [];

  rationale.push(
    confidence >= 60
      ? `High stated confidence pulls the distribution toward "Likely" for ${term}.`
      : confidence <= 30
        ? `Low stated confidence keeps ${term} anchored in "Uncertain" rather than a clean call.`
        : `Moderate confidence leaves ${term} without a strong lean either way.`,
  );
  rationale.push(
    volatility >= 60
      ? 'High volatility widens the "Uncertain" band -- the situation can still move before it resolves.'
      : 'Lower volatility narrows the range, but does not remove it.',
  );
  rationale.push(
    boundedHorizon >= 10
      ? `A ${boundedHorizon}-year horizon means most of what determines the outcome hasn't happened yet.`
      : `At ${boundedHorizon} year(s) out, today's signal still carries real weight.`,
  );
  if (seed % 2 === 0) {
    rationale.push('Oracle answers in probabilities, never certainties -- treat this as a weighting, not a verdict.');
  }

  return {
    distribution: { likely, uncertain: uncertainRounded, unlikely: Math.max(0, unlikely) },
    rationale,
  };
}
