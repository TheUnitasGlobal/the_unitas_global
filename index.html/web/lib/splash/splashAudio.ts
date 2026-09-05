// Fully synthesized Web Audio score for the cinematic intro splash (owner
// instruction 2026-09-04, item 3-4). No audio files -- every sound is
// oscillators + filtered noise + a synthesized hall impulse, matching the
// Low-Memory Armor / no-binary-assets rule used by SpatialAudioProvider and
// the Coming-Soon cinema.
//
//   1.0s -> ~2.6s  "U - NI - TAS" -- an ultra-deep, grand, HUMAN male bass
//                  chant (round 10 rebuild, owner instruction 2026-09-05,
//                  item 1). The fundamental lives in the F1-A1 band
//                  (43.65-55 Hz): U sits on F1, the phrase leans up through
//                  G1 / G#1 to peak on A1 for the sustained "A", then drops
//                  away into the final "S". Two things separate this from a
//                  one-second synth blast:
//                    * PER-LETTER PITCH CONTOURING -- every voiced letter is
//                      its own note with a human onset scoop (starting 30-50
//                      cents flat and gliding up onto pitch), a slight lean
//                      into the sustain, and a release drift -- on top of a
//                      slow vibrato whose depth BUILDS across each held
//                      vowel, a faster micro-jitter, and a random-walk pitch
//                      drift (low-passed noise into detune) so no two plays
//                      are identical and no note is ever machine-steady.
//                    * BREATH + FORMANT MODULATION -- an audible intake of
//                      breath before the onset, an aspiration bed that
//                      follows the voice, and a soft exhale after the "S";
//                      vowel formants move with coarticulation (the tract is
//                      already shaping "A" during the silent "T" closure)
//                      plus a slow jaw LFO that keeps F1/F2 gently moving.
//                  The source is a detuned sawtooth pair + a clean sine on
//                  the fundamental (the felt sub weight) + an octave-up
//                  sawtooth (the same voice carried through phone speakers
//                  via the missing-fundamental effect), glottal-lowpassed,
//                  then split into a direct "chest" path (lowpass ~140 Hz,
//                  so the F1-A1 fundamental and its 2nd harmonic reach the
//                  output at full weight -- parallel formant bandpasses
//                  alone would strip them) and a three-band formant filter
//                  (wide, low-Q -- a narrow resonant peak rings like a
//                  machine formant). A lowshelf chest lift, a mild presence
//                  peak, a highshelf CUT (brightness reads as synthetic on a
//                  bass) and a cathedral convolver finish it. The chant is
//                  1.6s long by design and OVERLAPS the crystal impact: the
//                  held "A" is still ringing when the impact lands at 2s.
//   2.0s -> 3.0s   crystal echo impact -- a bright inharmonic bell cluster
//                  (E7 / B7 / E8 / G7 strikes) with a two-tap feedback delay
//                  whose loop is high-passed so every echo comes back thinner
//                  and glassier, plus an airy 10 kHz shimmer and a rising
//                  sweep for the impact edge. Rings out by the 3-second mark.
//
// Master level (round 10, item 2): the 0.246 baseline x the GLOBAL 50%
// omni-channel attenuation (lib/audio/masterLevel.ts) -- identical on PC,
// mobile and tablet, online and installed App. The earlier PC-only extra
// cuts are retired.
//
// Autoplay policy: the context is created suspended on a cold load. We try
// to resume immediately (allowed for installed PWAs / high-engagement
// sites); otherwise the first pointer/key gesture during the splash unlocks
// it and `splashAudioOffsets` re-times the cues from that moment. Respects
// the site-wide mute preference (`unitas_audio_pref === 'off'`).

import { attenuateMaster } from '@/lib/audio/masterLevel';
import {
  SPLASH_CRYSTAL_LENGTH_S,
  SPLASH_VOCAL_LENGTH_S,
  splashAudioOffsets,
} from './splashTimeline';

/** Mirrors SpatialAudioProvider's persisted preference key. */
const AUDIO_PREF_KEY = 'unitas_audio_pref';
/** Round-1 (2026-09-05) baseline: 0.3x the original 0.82. */
const SPLASH_BASE_MASTER_GAIN = 0.246;
/** Shipped level under the global 50% doctrine -- every device, every channel. */
const MASTER_GAIN = attenuateMaster(SPLASH_BASE_MASTER_GAIN);

export interface SplashAudioHandle {
  /** Call from a user gesture (or immediately) -- resumes + schedules once. */
  unlock: () => void;
  /** Fades out and closes the context. Idempotent. */
  dispose: () => void;
}

interface Buses {
  dry: GainNode;
  wet: GainNode;
}

function makeHallImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Slightly different noise per channel widens the tail into stereo.
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buffer;
}

function makeNoise(ctx: AudioContext, seconds = 1.2): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Piecewise-linear gain envelope helper. Points are [offsetSeconds, value]. */
function envelope(param: AudioParam, t0: number, points: Array<[number, number]>): void {
  param.setValueAtTime(points[0][1], t0 + points[0][0]);
  for (let i = 1; i < points.length; i++) {
    const [at, value] = points[i];
    param.linearRampToValueAtTime(value, t0 + at);
  }
}

/** Cents -> frequency ratio. */
const cents = (c: number) => Math.pow(2, c / 1200);

// ---------------------------------------------------------------------------
// 1. "UNITAS" chant -- ultra-deep human bass, letter by letter
// ---------------------------------------------------------------------------

// The F1-A1 band the fundamental is confined to (owner instruction).
const F1_HZ = 43.65;
const G1_HZ = 49.0;
const GS1_HZ = 51.91;
const A1_HZ = 55.0;

/** Letter timing inside the chant (relative seconds; total = 1.6s). */
const LETTER = {
  U: { on: 0.0, off: 0.44 },
  N: { on: 0.44, off: 0.58 },
  I: { on: 0.58, off: 0.84 },
  T: { close: 0.84, burst: 0.905 },
  A: { on: 0.935, off: 1.36 },
  S: { on: 1.36, off: 1.62 },
} as const;

/** A tiny per-play humanization: +/- `range` (uniform). */
const humanize = (range: number) => (Math.random() * 2 - 1) * range;

function scheduleVocal(ctx: AudioContext, buses: Buses, noise: AudioBuffer, t0: number): void {
  const L = SPLASH_VOCAL_LENGTH_S;
  const { U, N, I, T, A, S } = LETTER;
  const stopAt = t0 + L + 0.6;

  // --- voiced source bus with the phonetic amplitude contour -------------
  // Soft onset (a human never slams into a vowel), a nasal dip for N, the
  // stop closure for T, a full-weight bloom on the held A, then the voice
  // thins out under the final S hiss.
  const source = ctx.createGain();
  envelope(source.gain, t0, [
    [0, 0.0001],
    [0.06, 0.5],
    [0.17, 1],
    [U.off - 0.03, 0.95],
    [N.on + 0.03, 0.6],
    [N.off, 0.62],
    [I.on + 0.04, 1],
    [I.off - 0.04, 0.9],
    [T.close, 0.0001],
    [A.on, 0.0001],
    [A.on + 0.045, 1],
    [A.on + 0.22, 1],
    [A.off - 0.06, 0.82],
    [S.on + 0.02, 0.3],
    [S.on + 0.1, 0.0001],
  ]);

  // --- per-letter pitch contour (fundamental, Hz) ------------------------
  // Every voiced letter is its own note: a flat onset scoop gliding up onto
  // pitch, a slight lean into the sustain, and a release drift. The phrase
  // as a whole rises U -> N -> I -> A ("announcement" cadence) and falls
  // away into S. Per-play humanization nudges the scoop depths and the lean
  // so no two launches are the same take.
  const scoopU = -45 + humanize(8);
  const scoopN = -20 + humanize(5);
  const scoopI = -30 + humanize(6);
  const scoopA = -50 + humanize(9);
  const f0: Array<[number, number]> = [
    [0, F1_HZ * cents(scoopU)],
    [0.1, F1_HZ],
    [U.off - 0.04, F1_HZ * cents(6 + humanize(2))],
    [N.on + 0.02, G1_HZ * cents(scoopN)],
    [N.off - 0.02, G1_HZ],
    [I.on + 0.02, GS1_HZ * cents(scoopI)],
    [I.on + 0.12, GS1_HZ],
    [I.off - 0.02, GS1_HZ * cents(8 + humanize(2))],
    [A.on, A1_HZ * cents(scoopA)],
    [A.on + 0.095, A1_HZ],
    [A.on + 0.29, A1_HZ * cents(5 + humanize(2))],
    [A.off - 0.02, G1_HZ],
    [S.on + 0.06, F1_HZ * cents(-20)],
  ];

  // Slow vibrato whose DEPTH builds across each held vowel (a singer's
  // vibrato blooms into a sustain; it is not switched on at a fixed depth).
  const vibrato = ctx.createOscillator();
  vibrato.type = 'sine';
  vibrato.frequency.value = 5.0 + humanize(0.3);
  const vibratoDepth = ctx.createGain();
  envelope(vibratoDepth.gain, t0, [
    [0, 0],
    [0.12, 0],
    [U.off - 0.06, 9],
    [N.on + 0.02, 3],
    [I.on + 0.1, 4],
    [I.off, 6],
    [A.on, 0],
    [A.on + 0.12, 4],
    [A.on + 0.3, 12],
    [A.off, 7],
    [S.on + 0.1, 0],
  ]);
  vibrato.connect(vibratoDepth);
  vibrato.start(t0);
  vibrato.stop(stopAt);

  // Faster micro-jitter: real vocal cords wobble a few cents even on a
  // "held" note -- a dead-steady pitch is what reads as "machine".
  const jitter = ctx.createOscillator();
  jitter.type = 'sine';
  jitter.frequency.value = 7.3 + humanize(0.6);
  const jitterDepth = ctx.createGain();
  jitterDepth.gain.value = 2.6; // cents
  jitter.connect(jitterDepth);
  jitter.start(t0);
  jitter.stop(stopAt);

  // Slow aperiodic drift: three incommensurate, per-play-randomized sub-Hz
  // sines summed into detune wander a few cents with no audible period --
  // the organic instability a single LFO can't fake. (Deterministic nodes
  // rather than a sub-Hz-lowpassed noise source: a 2 Hz biquad sits at the
  // edge of float precision on some engines, and a misbehaving one would
  // spray hundreds of cents of noise into the pitch.)
  const driftDepth = ctx.createGain();
  driftDepth.gain.value = 1;
  for (const [hz, depthCents] of [
    [0.41, 3.2],
    [0.67, 2.3],
    [1.13, 1.6],
  ] as const) {
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = hz + humanize(hz * 0.25);
    const depth = ctx.createGain();
    depth.gain.value = depthCents;
    lfo.connect(depth);
    depth.connect(driftDepth);
    lfo.start(t0 + humanize(0.4) - 0.4); // random phase via a random (past) start
    lfo.stop(stopAt);
  }

  // --- source oscillators --------------------------------------------------
  // The F1-A1 fundamental is carried by the detuned sawtooth pair + a clean
  // sine (pure sub weight, no extra harmonics); the octave sawtooth carries
  // the same voice through small/phone speakers (missing-fundamental
  // effect) so the chant reads as the same deep bass everywhere; a faint
  // triangle on the 12th adds presence without buzz.
  const oscSpecs: Array<{ type: OscillatorType; mult: number; detune: number; gain: number }> = [
    { type: 'sawtooth', mult: 1, detune: -5, gain: 0.4 },
    { type: 'sawtooth', mult: 1, detune: 5, gain: 0.4 },
    { type: 'sine', mult: 1, detune: 0, gain: 0.34 },
    { type: 'sawtooth', mult: 2, detune: 3, gain: 0.2 },
    { type: 'triangle', mult: 3, detune: -2, gain: 0.07 },
  ];
  for (const spec of oscSpecs) {
    const osc = ctx.createOscillator();
    osc.type = spec.type;
    osc.detune.value = spec.detune;
    osc.frequency.setValueAtTime(f0[0][1] * spec.mult, t0);
    for (let i = 1; i < f0.length; i++) {
      osc.frequency.exponentialRampToValueAtTime(f0[i][1] * spec.mult, t0 + f0[i][0]);
    }
    vibratoDepth.connect(osc.detune);
    jitterDepth.connect(osc.detune);
    driftDepth.connect(osc.detune);
    const g = ctx.createGain();
    g.gain.value = spec.gain;
    osc.connect(g);
    g.connect(source);
    osc.start(t0);
    osc.stop(stopAt);
  }

  // Barely-there loudness shimmer -- real vocal loudness never holds a flat
  // line either. Sums additively into source.gain with the envelope above.
  const shimmer = ctx.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.value = 4.6 + humanize(0.4);
  const shimmerDepth = ctx.createGain();
  shimmerDepth.gain.value = 0.03;
  shimmer.connect(shimmerDepth);
  shimmerDepth.connect(source.gain);
  shimmer.start(t0);
  shimmer.stop(stopAt);

  // Glottal rolloff: shave the raw sawtooth buzz before the tract.
  const sourceLp = ctx.createBiquadFilter();
  sourceLp.type = 'lowpass';
  sourceLp.frequency.value = 2400;
  sourceLp.Q.value = 0.5;
  source.connect(sourceLp);

  // --- vocal tract -----------------------------------------------------------
  const vocalBus = ctx.createGain();
  vocalBus.gain.value = 1.35;

  // Direct CHEST path: a lowpass that lets the F1-A1 fundamental and its 2nd
  // harmonic (87-110 Hz) through at full weight. Parallel formant bandpasses
  // centred at 250 Hz+ would otherwise strip the very band the owner wants
  // maximised -- this is where the "극저음 웅장함" physically comes from.
  const chestPath = ctx.createBiquadFilter();
  chestPath.type = 'lowpass';
  chestPath.frequency.value = 140;
  chestPath.Q.value = 0.8;
  const chestGain = ctx.createGain();
  chestGain.gain.value = 0.62;
  sourceLp.connect(chestPath);
  chestPath.connect(chestGain);
  chestGain.connect(vocalBus);

  // Three-band formant filter (parallel) -- wide, low-Q bands.
  const bands = [
    { q: 2.2, gain: 1.5 },
    { q: 3.2, gain: 0.8 },
    { q: 4.0, gain: 0.32 },
  ].map(({ q, gain }) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    sourceLp.connect(filter);
    filter.connect(g);
    g.connect(vocalBus);
    return { filter, g, base: gain };
  });

  // Vowel targets [F1, F2, F3] Hz + band weights, voiced for a large, warm
  // male tract (formants sit low). N is the nasal murmur (weak, dark).
  const vowels: Record<string, { f: [number, number, number]; w: [number, number, number] }> = {
    U: { f: [300, 690, 2250], w: [1, 0.32, 0.1] },
    N: { f: [250, 1150, 2300], w: [0.55, 0.18, 0.07] },
    I: { f: [280, 2050, 2650], w: [1, 0.36, 0.26] },
    A: { f: [680, 1080, 2400], w: [1, 0.7, 0.3] },
  };
  const setVowel = (name: keyof typeof vowels, at: number, tau: number) => {
    const v = vowels[name];
    bands.forEach(({ filter, g, base }, i) => {
      filter.frequency.setTargetAtTime(v.f[i], at, tau);
      g.gain.setTargetAtTime(base * v.w[i], at, tau);
    });
  };
  bands.forEach(({ filter, g, base }, i) => {
    filter.frequency.setValueAtTime(vowels.U.f[i], t0);
    g.gain.setValueAtTime(base * vowels.U.w[i], t0);
  });
  // Coarticulation: the tract starts moving toward the next vowel a little
  // before the voice gets there, and is already shaping "A" during the
  // silent T closure -- exactly what a real mouth does.
  setVowel('N', t0 + N.on - 0.02, 0.03);
  setVowel('I', t0 + I.on - 0.015, 0.04);
  setVowel('A', t0 + T.close + 0.02, 0.035);

  // Slow "jaw" LFO keeps F1 / F2 gently moving through every sustain --
  // formants that sit perfectly still are another machine tell.
  const jaw = ctx.createOscillator();
  jaw.type = 'sine';
  jaw.frequency.value = 1.1 + humanize(0.15);
  const jawF1 = ctx.createGain();
  jawF1.gain.value = 16; // Hz
  const jawF2 = ctx.createGain();
  jawF2.gain.value = 28; // Hz
  jaw.connect(jawF1);
  jaw.connect(jawF2);
  jawF1.connect(bands[0].filter.frequency);
  jawF2.connect(bands[1].filter.frequency);
  jaw.start(t0);
  jaw.stop(stopAt);

  // --- breath ------------------------------------------------------------------
  // Aspiration bed that follows the voice: air moving through the tract.
  const breath = ctx.createBufferSource();
  breath.buffer = noise;
  breath.loop = true;
  const breathFilter = ctx.createBiquadFilter();
  breathFilter.type = 'bandpass';
  breathFilter.frequency.value = 600;
  breathFilter.Q.value = 0.35;
  const breathGain = ctx.createGain();
  envelope(breathGain.gain, t0, [
    [0, 0.0001],
    [0.1, 0.05],
    [U.off, 0.045],
    [T.close, 0.012],
    [A.on + 0.06, 0.05],
    [S.on, 0.04],
    [S.off + 0.1, 0.0001],
  ]);
  breath.connect(breathFilter);
  breathFilter.connect(breathGain);
  breathGain.connect(vocalBus);
  breath.start(t0);
  breath.stop(stopAt);

  // Intake of breath before the onset (the human "tell" before a phrase).
  // If the context unlocked late and the chant is being played "now", the
  // inhale is compressed forward rather than scheduled in the past.
  const inhaleLen = 0.28;
  const inhaleAt = Math.max(t0 - inhaleLen, ctx.currentTime + 0.005);
  const inhaleSpan = Math.max(0.08, t0 - inhaleAt);
  const inhale = ctx.createBufferSource();
  inhale.buffer = noise;
  const inhaleHp = ctx.createBiquadFilter();
  inhaleHp.type = 'highpass';
  inhaleHp.frequency.value = 900;
  const inhaleBp = ctx.createBiquadFilter();
  inhaleBp.type = 'bandpass';
  inhaleBp.frequency.value = 1400;
  inhaleBp.Q.value = 0.5;
  const inhaleGain = ctx.createGain();
  envelope(inhaleGain.gain, inhaleAt, [
    [0, 0.0001],
    [inhaleSpan * 0.55, 0.045],
    [inhaleSpan * 0.92, 0.012],
    [inhaleSpan, 0.0001],
  ]);
  inhale.connect(inhaleHp);
  inhaleHp.connect(inhaleBp);
  inhaleBp.connect(inhaleGain);
  inhaleGain.connect(buses.dry);
  const inhaleHall = ctx.createGain();
  inhaleHall.gain.value = 0.25;
  inhaleGain.connect(inhaleHall);
  inhaleHall.connect(buses.wet);
  inhale.start(inhaleAt);
  inhale.stop(t0 + 0.05);

  // Soft exhale after the final S -- the phrase is released, not cut.
  const exhale = ctx.createBufferSource();
  exhale.buffer = noise;
  const exhaleBp = ctx.createBiquadFilter();
  exhaleBp.type = 'bandpass';
  exhaleBp.frequency.value = 900;
  exhaleBp.Q.value = 0.4;
  const exhaleGain = ctx.createGain();
  envelope(exhaleGain.gain, t0 + S.off, [
    [0, 0.0001],
    [0.08, 0.03],
    [0.33, 0.0001],
  ]);
  exhale.connect(exhaleBp);
  exhaleBp.connect(exhaleGain);
  exhaleGain.connect(buses.dry);
  exhale.start(t0 + S.off);
  exhale.stop(t0 + S.off + 0.36);

  // --- tone shaping + sends ----------------------------------------------------
  // Chest lowshelf lift, a mild presence peak so the consonants stay
  // intelligible, and a highshelf CUT (a bass voice with a bright top end
  // reads as artificial). Then dry + cathedral hall.
  const chest = ctx.createBiquadFilter();
  chest.type = 'lowshelf';
  chest.frequency.value = 160;
  chest.gain.value = 4;
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 1900;
  presence.Q.value = 0.9;
  presence.gain.value = 1.5;
  const airCut = ctx.createBiquadFilter();
  airCut.type = 'highshelf';
  airCut.frequency.value = 4800;
  airCut.gain.value = -3;
  vocalBus.connect(chest);
  chest.connect(presence);
  presence.connect(airCut);
  airCut.connect(buses.dry);
  const toHall = ctx.createGain();
  toHall.gain.value = 0.55;
  airCut.connect(toHall);
  toHall.connect(buses.wet);

  // --- consonants ---------------------------------------------------------
  // T: short band-passed burst right after the closure.
  const burst = ctx.createBufferSource();
  burst.buffer = noise;
  const burstFilter = ctx.createBiquadFilter();
  burstFilter.type = 'bandpass';
  burstFilter.frequency.value = 3600;
  burstFilter.Q.value = 2.2;
  const burstGain = ctx.createGain();
  burstGain.gain.setValueAtTime(0.0001, t0 + T.burst);
  burstGain.gain.linearRampToValueAtTime(0.22, t0 + T.burst + 0.03);
  burstGain.gain.exponentialRampToValueAtTime(0.0001, t0 + T.burst + 0.075);
  burst.connect(burstFilter);
  burstFilter.connect(burstGain);
  burstGain.connect(buses.dry);
  burst.start(t0 + T.burst);
  burst.stop(t0 + T.burst + 0.1);

  // S: high-passed hiss that tails the word out into the crystal echo.
  const hiss = ctx.createBufferSource();
  hiss.buffer = noise;
  const hissFilter = ctx.createBiquadFilter();
  hissFilter.type = 'highpass';
  hissFilter.frequency.value = 5000;
  hissFilter.Q.value = 0.7;
  const hissGain = ctx.createGain();
  hissGain.gain.setValueAtTime(0.0001, t0 + S.on);
  hissGain.gain.linearRampToValueAtTime(0.16, t0 + S.on + 0.04);
  hissGain.gain.setValueAtTime(0.16, t0 + S.on + 0.12);
  hissGain.gain.exponentialRampToValueAtTime(0.0001, t0 + S.on + 0.34);
  hiss.connect(hissFilter);
  hissFilter.connect(hissGain);
  hissGain.connect(buses.dry);
  const hissHall = ctx.createGain();
  hissHall.gain.value = 0.3;
  hissGain.connect(hissHall);
  hissHall.connect(buses.wet);
  hiss.start(t0 + S.on);
  hiss.stop(t0 + S.on + 0.38);
}

// ---------------------------------------------------------------------------
// 2. crystal echo impact
// ---------------------------------------------------------------------------
function scheduleCrystal(ctx: AudioContext, buses: Buses, noise: AudioBuffer, t0: number): void {
  const L = SPLASH_CRYSTAL_LENGTH_S;

  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0.62, t0);
  bus.gain.setValueAtTime(0.62, t0 + 0.5);
  bus.gain.exponentialRampToValueAtTime(0.0008, t0 + L);
  bus.connect(buses.dry);
  const toHall = ctx.createGain();
  toHall.gain.value = 0.55;
  bus.connect(toHall);
  toHall.connect(buses.wet);

  // Two-tap feedback echo; the loop is high-passed so each repeat returns
  // thinner and glassier than the last ("crystal echo").
  const echoOut = ctx.createGain();
  echoOut.gain.value = 0.5;
  echoOut.connect(buses.dry);
  const echoHall = ctx.createGain();
  echoHall.gain.value = 0.35;
  echoOut.connect(echoHall);
  echoHall.connect(buses.wet);
  for (const [time, feedback, hp] of [
    [0.17, 0.46, 1600],
    [0.29, 0.32, 2300],
  ] as const) {
    const delay = ctx.createDelay(1);
    delay.delayTime.value = time;
    const fb = ctx.createGain();
    fb.gain.value = feedback;
    const loopHp = ctx.createBiquadFilter();
    loopHp.type = 'highpass';
    loopHp.frequency.value = hp;
    bus.connect(delay);
    delay.connect(loopHp);
    loopHp.connect(fb);
    fb.connect(delay);
    loopHp.connect(echoOut);
  }

  // Bell strikes: bright inharmonic partial clusters, arpeggiated upward.
  const ratios = [1, 1.49, 2.0, 2.76, 3.98, 5.4];
  const weights = [1, 0.42, 0.3, 0.24, 0.12, 0.06];
  const decays = [0.9, 0.75, 0.65, 0.5, 0.4, 0.3];
  const strikes: Array<[number, number, number]> = [
    [0, 2637.02, 1], // E7
    [0.06, 3951.07, 0.6], // B7
    [0.13, 5274.04, 0.38], // E8
    [0.21, 3135.96, 0.3], // G7
  ];
  for (const [at, base, weight] of strikes) {
    const st = t0 + at;
    ratios.forEach((ratio, i) => {
      const freq = base * ratio;
      if (freq > ctx.sampleRate / 2 - 500) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(weights[i] * weight * 0.5, st + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0008, st + decays[i]);
      osc.connect(g);
      g.connect(bus);
      osc.start(st);
      osc.stop(st + decays[i] + 0.05);
    });
  }

  // Airy shimmer on the impact edge.
  const shimmer = ctx.createBufferSource();
  shimmer.buffer = noise;
  const shimmerFilter = ctx.createBiquadFilter();
  shimmerFilter.type = 'bandpass';
  shimmerFilter.frequency.value = 9800;
  shimmerFilter.Q.value = 1.2;
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.setValueAtTime(0.11, t0);
  shimmerGain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.18);
  shimmer.connect(shimmerFilter);
  shimmerFilter.connect(shimmerGain);
  shimmerGain.connect(bus);
  shimmer.start(t0);
  shimmer.stop(t0 + 0.22);

  // Rising sweep -- the "impact" attack under the bells.
  const sweep = ctx.createOscillator();
  sweep.type = 'sine';
  sweep.frequency.setValueAtTime(1500, t0);
  sweep.frequency.exponentialRampToValueAtTime(6200, t0 + 0.22);
  const sweepGain = ctx.createGain();
  sweepGain.gain.setValueAtTime(0.0001, t0);
  sweepGain.gain.linearRampToValueAtTime(0.09, t0 + 0.03);
  sweepGain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.26);
  sweep.connect(sweepGain);
  sweepGain.connect(bus);
  sweep.start(t0);
  sweep.stop(t0 + 0.3);

  // Glitter: a handful of tiny high sines scattered through the echo tail.
  for (let i = 0; i < 6; i++) {
    const at = t0 + 0.3 + i * 0.075 + Math.random() * 0.03;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 6000 + Math.random() * 3500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.035, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, at + 0.26);
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.random() * 1.6 - 0.8;
    osc.connect(g);
    g.connect(panner);
    panner.connect(bus);
    osc.start(at);
    osc.stop(at + 0.3);
  }
}

// ---------------------------------------------------------------------------
// public entry
// ---------------------------------------------------------------------------
export function createSplashAudio(startedAt: number): SplashAudioHandle | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.localStorage.getItem(AUDIO_PREF_KEY) === 'off') return null;
  } catch {
    /* storage blocked -> default ON */
  }
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  let ctx: AudioContext;
  try {
    ctx = new AudioCtx();
  } catch {
    return null;
  }

  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -16;
  limiter.knee.value = 14;
  limiter.ratio.value = 5;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.2;
  master.connect(limiter);
  limiter.connect(ctx.destination);

  const dry = ctx.createGain();
  dry.gain.value = 0.9;
  dry.connect(master);

  const hall = ctx.createConvolver();
  hall.buffer = makeHallImpulse(ctx, 1.9, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 1;
  wet.connect(hall);
  const hallOut = ctx.createGain();
  hallOut.gain.value = 0.42;
  hall.connect(hallOut);
  hallOut.connect(master);

  const noise = makeNoise(ctx);
  const buses: Buses = { dry, wet };

  let scheduled = false;
  let disposed = false;

  const schedule = () => {
    if (scheduled || disposed || ctx.state !== 'running') return;
    scheduled = true;
    const elapsed = (performance.now() - startedAt) / 1000;
    const { vocalAt, crystalAt } = splashAudioOffsets(elapsed);
    const now = ctx.currentTime + 0.02;
    try {
      if (vocalAt !== null) scheduleVocal(ctx, buses, noise, now + vocalAt);
      scheduleCrystal(ctx, buses, noise, now + crystalAt);
    } catch {
      /* a node failing to schedule must never break the splash */
    }
  };

  const unlock = () => {
    if (scheduled || disposed) return;
    if (ctx.state === 'running') {
      schedule();
      return;
    }
    ctx
      .resume()
      .then(() => schedule())
      .catch(() => {});
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    try {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
      master.gain.linearRampToValueAtTime(0, t + 0.25);
    } catch {
      /* no-op */
    }
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 400);
  };

  // Try right away -- installed PWAs and high-engagement origins are allowed
  // to start audio without a gesture; everyone else unlocks on first touch.
  unlock();

  return { unlock, dispose };
}
