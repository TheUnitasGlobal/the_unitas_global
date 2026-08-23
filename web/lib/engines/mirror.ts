// Deterministic behavioral self-diagnostic for the Mirror ecosystem
// (Ecosystems.mirror.rules: "One scan per session; results are sealed to
// your identity alone."). Five fixed scenario questions, each option
// nudging three trait axes; the scan is arithmetic over the visitor's own
// answers, not a real psychometric instrument.

export type MirrorAxis = 'risk' | 'speed' | 'analytical';

export interface MirrorOption {
  /** Translation key suffix, e.g. "mirrorQ1OptA". */
  key: string;
  deltas: Partial<Record<MirrorAxis, number>>;
}

export interface MirrorQuestion {
  /** Translation key, e.g. "mirrorQ1". */
  key: string;
  options: MirrorOption[];
}

export const MIRROR_QUESTIONS: MirrorQuestion[] = [
  {
    key: 'mirrorQ1',
    options: [
      { key: 'mirrorQ1OptA', deltas: { speed: 2, risk: -1 } },
      { key: 'mirrorQ1OptB', deltas: { risk: 1, speed: 1 } },
      { key: 'mirrorQ1OptC', deltas: { analytical: 2, speed: -1 } },
    ],
  },
  {
    key: 'mirrorQ2',
    options: [
      { key: 'mirrorQ2OptA', deltas: { risk: -2 } },
      { key: 'mirrorQ2OptB', deltas: { risk: 2 } },
      { key: 'mirrorQ2OptC', deltas: { analytical: 2 } },
    ],
  },
  {
    key: 'mirrorQ3',
    options: [
      { key: 'mirrorQ3OptA', deltas: { speed: 1, analytical: -1 } },
      { key: 'mirrorQ3OptB', deltas: { analytical: 2 } },
      { key: 'mirrorQ3OptC', deltas: { speed: 2, risk: 1 } },
    ],
  },
  {
    key: 'mirrorQ4',
    options: [
      { key: 'mirrorQ4OptA', deltas: { speed: 1 } },
      { key: 'mirrorQ4OptB', deltas: { analytical: 1, speed: -1 } },
      { key: 'mirrorQ4OptC', deltas: { speed: -2 } },
    ],
  },
  {
    key: 'mirrorQ5',
    options: [
      { key: 'mirrorQ5OptA', deltas: { risk: 1 } },
      { key: 'mirrorQ5OptB', deltas: { analytical: 1 } },
      { key: 'mirrorQ5OptC', deltas: { risk: -1, speed: -1 } },
    ],
  },
];

export interface MirrorResult {
  /** 0-100 per axis. */
  scores: Record<MirrorAxis, number>;
  /** Band translation key per axis, e.g. "mirrorBandHigh". */
  bands: Record<MirrorAxis, string>;
  dominantAxis: MirrorAxis;
}

const MAX_RAW_PER_AXIS = 6; // 5 questions x up to ~2 per axis, loosely bounding the range

function bandFor(score: number): string {
  return score >= 66 ? 'mirrorBandHigh' : score >= 34 ? 'mirrorBandMid' : 'mirrorBandLow';
}

export function scoreMirrorScan(optionKeysByQuestion: string[]): MirrorResult {
  const raw: Record<MirrorAxis, number> = { risk: 0, speed: 0, analytical: 0 };

  optionKeysByQuestion.forEach((optionKey, i) => {
    const option = MIRROR_QUESTIONS[i]?.options.find((o) => o.key === optionKey);
    if (!option) return;
    (Object.keys(option.deltas) as MirrorAxis[]).forEach((axis) => {
      raw[axis] += option.deltas[axis] ?? 0;
    });
  });

  const scores = {} as Record<MirrorAxis, number>;
  const bands = {} as Record<MirrorAxis, string>;
  (['risk', 'speed', 'analytical'] as MirrorAxis[]).forEach((axis) => {
    const normalized = Math.round(((raw[axis] + MAX_RAW_PER_AXIS) / (MAX_RAW_PER_AXIS * 2)) * 100);
    const clamped = Math.max(0, Math.min(100, normalized));
    scores[axis] = clamped;
    bands[axis] = bandFor(clamped);
  });

  const dominantAxis = (['risk', 'speed', 'analytical'] as MirrorAxis[]).sort(
    (a, b) => Math.abs(scores[b] - 50) - Math.abs(scores[a] - 50),
  )[0];

  return { scores, bands, dominantAxis };
}
