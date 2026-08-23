// Deterministic unit-economics calculator for the Genesis ecosystem
// (Ecosystems.genesis.rules: "Start from zero assumptions; Genesis rejects
// any premise it cannot derive"). A real arithmetic model over the
// visitor's own inputs, not a market predictor -- "first principles" here
// means the five inputs are the only axioms, and everything else (breakeven,
// the 12-month projection) is derived from them, nothing looked up.

export interface GenesisInput {
  pricePerUnit: number;
  costPerUnit: number;
  fixedCostsPerMonth: number;
  startingCustomers: number;
  /** Percent, e.g. 10 for 10% month-over-month customer growth. */
  monthlyGrowthRate: number;
}

export interface GenesisResult {
  axiomViolations: string[];
  contributionMargin: number;
  breakevenUnits: number | null;
  /** Cumulative profit/loss at the end of each of the next 12 months. */
  projection: number[];
  breakevenMonth: number | null;
  verdict: string;
}

export function runGenesisConstruction(input: GenesisInput): GenesisResult {
  const { pricePerUnit, costPerUnit, fixedCostsPerMonth, startingCustomers, monthlyGrowthRate } = input;
  const axiomViolations: string[] = [];

  if (pricePerUnit <= costPerUnit) {
    axiomViolations.push('genesisAxiomPriceCost');
  }
  if (startingCustomers <= 0) {
    axiomViolations.push('genesisAxiomCustomers');
  }
  if (fixedCostsPerMonth < 0) {
    axiomViolations.push('genesisAxiomFixedCosts');
  }

  const contributionMargin = pricePerUnit - costPerUnit;
  const breakevenUnits =
    contributionMargin > 0 && fixedCostsPerMonth > 0 ? Math.ceil(fixedCostsPerMonth / contributionMargin) : null;

  const projection: number[] = [];
  let customers = Math.max(0, startingCustomers);
  let cumulative = 0;
  for (let month = 1; month <= 12; month += 1) {
    const revenue = customers * pricePerUnit;
    const cost = customers * costPerUnit + fixedCostsPerMonth;
    cumulative += revenue - cost;
    projection.push(Math.round(cumulative));
    customers *= 1 + monthlyGrowthRate / 100;
  }

  const breakevenIndex = projection.findIndex((v) => v >= 0);
  const breakevenMonth = axiomViolations.length === 0 && breakevenIndex !== -1 ? breakevenIndex + 1 : null;

  const verdict =
    axiomViolations.length > 0
      ? 'genesisVerdictRejected'
      : breakevenMonth
        ? 'genesisVerdictBreakeven'
        : 'genesisVerdictNoBreakeven';

  return { axiomViolations, contributionMargin, breakevenUnits, projection, breakevenMonth, verdict };
}
