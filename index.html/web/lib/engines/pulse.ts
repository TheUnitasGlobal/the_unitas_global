// Deterministic "live" signal simulator for the Pulse ecosystem
// (Ecosystems.pulse.rules: "Live feed; each session monitors one signal at
// a time."). A seeded pseudo-random walk over the visitor's own signal
// name, not a real market/sentiment feed -- the seed makes the same name
// always produce the same series, which is what "deterministic simulation"
// means here rather than a live external data source.

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

/** Mulberry32 PRNG -- small, seedable, good enough for a decorative walk. */
function mulberry32(seed: number) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PulseSeries {
  momentum: number[];
  sentiment: number[];
  volatility: number[];
}

export function generatePulseSeries(signalName: string, ticks = 12): PulseSeries {
  const rand = mulberry32(hashSeed(signalName.trim().toLowerCase() || 'signal'));
  const momentum: number[] = [];
  const sentiment: number[] = [];
  const volatility: number[] = [];

  let m = 50;
  let s = 50;
  for (let i = 0; i < ticks; i += 1) {
    m = Math.max(0, Math.min(100, m + (rand() - 0.5) * 24));
    s = Math.max(0, Math.min(100, s + (rand() - 0.5) * 18));
    const v = Math.round(Math.abs(rand() - 0.5) * 2 * 100);
    momentum.push(Math.round(m));
    sentiment.push(Math.round(s));
    volatility.push(v);
  }

  return { momentum, sentiment, volatility };
}

export interface PulseRead {
  momentumKey: string;
  volatilityKey: string;
}

export function readPulseSeries(series: PulseSeries): PulseRead {
  const lastMomentum = series.momentum[series.momentum.length - 1] ?? 50;
  const avgVolatility = series.volatility.reduce((a, b) => a + b, 0) / series.volatility.length;

  const momentumKey = lastMomentum >= 60 ? 'pulseBullish' : lastMomentum <= 40 ? 'pulseBearish' : 'pulseNeutral';
  const volatilityKey = avgVolatility >= 55 ? 'pulseHighVol' : 'pulseLowVol';

  return { momentumKey, volatilityKey };
}
