// Deterministic long-cycle projection for the Chronos ecosystem
// (Ecosystems.chronos.rules: "Minimum query horizon: ten years. Chronos
// does not answer same-day questions."). Compound growth modulated by a
// sine-wave cycle -- a real (if simplified) cyclical model, not a market
// forecast.

export const CHRONOS_MIN_HORIZON_YEARS = 10;

export interface ChronosInput {
  startingValue: number;
  horizonYears: number;
  cycleLengthYears: number;
  annualGrowthRate: number; // percent
}

export interface ChronosYear {
  year: number;
  value: number;
  /** Translation key: chronosPhaseExpansion | chronosPhasePeak | chronosPhaseContraction | chronosPhaseTrough */
  phaseKey: string;
}

export interface ChronosResult {
  horizonViolation: boolean;
  years: ChronosYear[];
  finalValue: number;
  finalPhaseKey: string;
}

function phaseKeyForCyclePosition(position: number): string {
  // position is 0..1 through one cycle
  if (position < 0.25) return 'chronosPhaseExpansion';
  if (position < 0.5) return 'chronosPhasePeak';
  if (position < 0.75) return 'chronosPhaseContraction';
  return 'chronosPhaseTrough';
}

export function runChronosProjection(input: ChronosInput): ChronosResult {
  const horizonViolation = input.horizonYears < CHRONOS_MIN_HORIZON_YEARS;
  const horizonYears = Math.max(CHRONOS_MIN_HORIZON_YEARS, Math.round(input.horizonYears));
  const cycleLength = Math.max(1, input.cycleLengthYears);
  const amplitude = 6; // percentage points of oscillation around the base growth rate

  const years: ChronosYear[] = [];
  let value = input.startingValue;

  for (let y = 1; y <= horizonYears; y += 1) {
    const cyclePosition = ((y % cycleLength) + cycleLength) % cycleLength / cycleLength;
    const cycleModulation = Math.sin(cyclePosition * Math.PI * 2) * amplitude;
    value *= 1 + (input.annualGrowthRate + cycleModulation) / 100;
    years.push({ year: y, value: Math.round(value), phaseKey: phaseKeyForCyclePosition(cyclePosition) });
  }

  const last = years[years.length - 1];
  return { horizonViolation, years, finalValue: last?.value ?? input.startingValue, finalPhaseKey: last?.phaseKey ?? 'chronosPhaseExpansion' };
}
