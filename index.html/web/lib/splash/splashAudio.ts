// Fully synthesized Web Audio score for the cinematic intro splash (owner
// instruction 2026-09-04, item 3-4). No audio files -- every sound is
// oscillators + filtered noise + a synthesized hall impulse, matching the
// Low-Memory Armor / no-binary-assets rule used by SpatialAudioProvider and
// the Coming-Soon cinema.
//
//   1.0s -> ~3.3s  "유 - 니 - 타 - 스" -- a POWERFUL, thick, grand, HUMAN male
//                  SUB-BASS BARITONE (round 13 rebuild, owner instruction
//                  2026-09-05, hardening patch, item 2; on top of the round
//                  11 chest re-voicing and the round 12 four-syllable
//                  segmentation). The cue sheet is now UNIFORM by design:
//                    * ONE TONE -- every syllable sits on the same low note
//                      (E2, 82 Hz: the floor of a real bass-baritone's chest
//                      register), with only a human onset scoop and release
//                      drift around it -- no high point, no descending tail;
//                    * ONE LEVEL -- 유 · 니 · 타 are delivered at the same
//                      full weight, separated by the same short break;
//                    * ONE SPACING -- the same gap between every syllable
//                      (the T closure IS the gap before 타);
//                  with exactly two designed exceptions:
//                    * 타 is held TWICE as long as any other syllable -- the
//                      phrase's one long, overwhelming sustain;
//                    * 스 is delivered QUIETER than 유 / 니 (a lower voiced
//                      level and a softer hiss), so the phrase lands, not
//                      spits.
//                  The weight comes from the source: a heavier fundamental
//                  sine, a stronger sub-octave sine (41 Hz, felt more than
//                  heard) as chest resonance, a wider-open chest path and a
//                  deeper low-shelf lift -- thick and grand, while the
//                  formant tract, vibrato bloom, breath and drift keep it a
//                  person. A three-tap echo (low-passed, panned, feeding a
//                  long cathedral hall) gives the voice its grand, spacious
//                  "메아리". Two things separate this from a synth blast:
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
//                  the fundamental + the soft sub-octave sine (chest
//                  resonance) + a faint octave-up sawtooth (the same voice
//                  carried through phone speakers via the missing-fundamental
//                  effect), glottal-lowpassed, then split into a direct
//                  "chest" path (lowpass ~320 Hz, so the E2 fundamental, its
//                  sub-octave and its 2nd/3rd harmonics reach the output at
//                  full weight -- parallel formant bandpasses alone would
//                  strip them) and a three-band formant filter (wide, low-Q
//                  -- a narrow resonant peak rings like a machine formant). A
//                  lowshelf chest lift, a mild presence peak, a highshelf CUT
//                  (brightness reads as synthetic on a low voice), the echo
//                  send and a cathedral convolver finish it. The chant is
//                  2.3s long by design and OVERLAPS the crystal impact: the
//                  long "타" is still ringing when the impact lands at 2s.
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
// sites); otherwise the first gesture unlocks it and `splashAudioOffsets`
// re-times the cues from that moment. Respects the site-wide mute
// preference (`unitas_audio_pref === 'off'`).
//
// MOBILE UNLOCK, online AND App (owner instruction 2026-09-05, round 11,
// item 2; the 7-point hardening, item 7; the hardening patch, item 4): the
// gesture listeners live HERE, on `window`, in the capture phase, from the
// moment the context is created until it is running (or disposed) -- not
// only inside the splash component's effect. They listen to the events
// browsers count as USER ACTIVATION -- `pointerup` / `touchend` / `click`
// (touch), a mouse `pointerdown`, `keydown` -- AND force a `resume()` on
// `pointerdown` / `touchstart` as well: the very first contact with the
// screen. Where an engine refuses a pre-activation resume the promise simply
// settles later, on the activating `touchend` that follows the same finger;
// where it honours it (installed PWAs, engaged origins, Firefox) the chant
// starts a full gesture earlier. Round 13 hardens the gesture itself for
// WebKit: inside EVERY unlock gesture a silent one-sample buffer is started
// on the context (the legacy iOS unlock that `resume()` alone did not always
// achieve), an `interrupted` context (iOS after a call / Siri) is treated
// like a suspended one, and the page declares a PLAYBACK audio session so
// the iPhone ring/silent switch no longer mutes Web Audio (lib/audio/
// audioSession.ts) -- the reason the logo page was silent on so many phones
// while the same code sang on a desktop. Every path converges on the
// idempotent `schedule()`. A `statechange` hook schedules the score if
// anything else (the site-wide audio gate, an OS media resume) brings the
// context up first.
//
// LATE UNLOCK: on a phone the first touch routinely lands 2-4s into the
// splash. `splashAudioOffsets` no longer drops the chant in that case -- it
// plays immediately with the crystal a full lead behind -- and `dispose()`
// below holds the context open until that late score has finished ringing,
// so the logo page is never silent on mobile online.

import { attenuateMaster } from '@/lib/audio/masterLevel';
import { ensurePlaybackAudioSession, kickAudioContext, makeSilentBuffer } from '@/lib/audio/audioSession';
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
/** Longest `dispose()` will hold the context open for a late-unlocked score
 *  to finish (s). Covers the 2.3s vocal + crystal + a breath of tail; short
 *  enough that a founder replay never stacks two chants for long. */
const LATE_SCORE_HOLD_MAX_S = 3.2;

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
// 1. "UNITAS" chant -- powerful sub-bass baritone chest voice, one tone
// ---------------------------------------------------------------------------

/** THE tone (round 13): every syllable sits on E2 -- the floor of a real
 *  bass-baritone's chest register. Lower than this (F1-A1, 43-55 Hz) leaves
 *  the human range and reads as machine rumble (round 11 finding); the
 *  sub-octave sine underneath supplies that felt weight instead. */
const E2_HZ = 82.41;

/** Uniform syllable length (s) for 유 · 니 · 스. */
const SYL_S = 0.4;
/** Uniform break (s) between syllables (the T closure IS the break before
 *  타). */
const GAP_S = 0.1;
/** 타 is held TWICE as long as any other syllable (owner instruction
 *  2026-09-05, hardening patch, item 2). */
const TA_S = SYL_S * 2;

/** Level of 스 relative to 유 / 니 / 타 (the instruction: 스 is delivered
 *  QUIETER than 유 + 니). Applied to the voiced "으" tail; the hiss has its
 *  own lowered gain below. */
const S_LEVEL = 0.58;

/**
 * Syllable cue sheet inside the chant (relative seconds; total = 2.3s =
 * SPLASH_VOCAL_LENGTH_S). Uniform by design (see the header): 유 / 니 / 스
 * each SYL_S long, 타 twice that, every break GAP_S. `S.voice` is where the
 * hiss opens onto the voiced, closed "으" tail.
 *
 *   유  0.00 - 0.40
 *   니  0.50 - 0.90   (nasal 0.50 - 0.60, "I" 0.60 - 0.90)
 *   타  1.00 - 1.80   (closure 0.90 - 0.98, burst 0.98)
 *   스  1.90 - 2.30   (hiss 1.90, voiced 으 1.98 - 2.30)
 */
const SYLLABLE = (() => {
  const uOn = 0;
  const uOff = uOn + SYL_S;
  const nOn = uOff + GAP_S;
  const nOff = nOn + 0.1;
  const iOff = nOn + SYL_S;
  const tClose = iOff;
  const aOn = tClose + GAP_S;
  const tBurst = aOn - 0.02;
  const aOff = aOn + TA_S;
  const sOn = aOff + GAP_S;
  const sVoice = sOn + 0.08;
  const sOff = sOn + SYL_S;
  return {
    U: { on: uOn, off: uOff },
    N: { on: nOn, off: nOff },
    I: { on: nOff, off: iOff },
    T: { close: tClose, burst: tBurst },
    A: { on: aOn, off: aOff },
    S: { on: sOn, voice: sVoice, off: sOff },
  } as const;
})();

/** A tiny per-play humanization: +/- `range` (uniform). */
const humanize = (range: number) => (Math.random() * 2 - 1) * range;

function scheduleVocal(ctx: AudioContext, buses: Buses, noise: AudioBuffer, t0: number): void {
  const L = SPLASH_VOCAL_LENGTH_S;
  const { U, N, I, T, A, S } = SYLLABLE;
  const stopAt = t0 + L + 0.6;

  // --- voiced source bus with the phonetic amplitude contour -------------
  // Soft onset (a human never slams into a vowel), full weight held through
  // the syllable, then a clean, UNIFORM break down to near-silence before
  // the next one -- the same shape for 유, 니 and 타 (타 simply holds twice as
  // long); the stop closure for T is the one true silence, as in real
  // speech. 스 opens with the hiss alone and its voiced "으" tail comes in
  // at S_LEVEL -- deliberately below the other three.
  const source = ctx.createGain();
  envelope(source.gain, t0, [
    [0, 0.0001],
    [0.04, 0.7],
    [0.1, 1],
    [U.off - 0.06, 0.96],
    [U.off, 0.04],
    [N.on, 0.04],
    [N.on + 0.05, 0.86],
    [I.on, 1],
    [I.off - 0.06, 0.96],
    [I.off, 0.04],
    [T.close + 0.02, 0.0001],
    [A.on, 0.0001],
    [A.on + 0.05, 1],
    [A.on + 0.3, 1],
    [A.off - 0.1, 0.96],
    [A.off, 0.04],
    [S.on, 0.02],
    [S.voice, S_LEVEL * 0.9],
    [S.voice + 0.06, S_LEVEL],
    [S.off - 0.1, S_LEVEL * 0.85],
    [S.off, 0.0001],
  ]);

  // --- pitch contour (fundamental, Hz) -------------------------------------
  // ONE tone. Every syllable is the same E2 note; what remains human is the
  // onset scoop (starting 25-35 cents flat and gliding up onto pitch), a
  // slight lean into each sustain, and a release drift into each break --
  // never a change of note. Per-play humanization nudges the scoop depths so
  // no two launches are the same take.
  const scoopU = -30 + humanize(6);
  const scoopN = -25 + humanize(5);
  const scoopA = -35 + humanize(7);
  const scoopS = -20 + humanize(5);
  const f0: Array<[number, number]> = [
    [0, E2_HZ * cents(scoopU)],
    [0.08, E2_HZ],
    [U.off - 0.05, E2_HZ * cents(2 + humanize(1))],
    [U.off, E2_HZ * cents(-6)],
    [N.on, E2_HZ * cents(scoopN)],
    [N.on + 0.08, E2_HZ],
    [I.off - 0.05, E2_HZ * cents(2 + humanize(1))],
    [I.off, E2_HZ * cents(-6)],
    [A.on, E2_HZ * cents(scoopA)],
    [A.on + 0.1, E2_HZ],
    [A.on + 0.4, E2_HZ * cents(3 + humanize(1))],
    [A.off - 0.08, E2_HZ * cents(1)],
    [A.off, E2_HZ * cents(-8)],
    [S.voice, E2_HZ * cents(scoopS)],
    [S.voice + 0.1, E2_HZ * cents(-3)],
    [S.off, E2_HZ * cents(-14)],
  ];

  // Slow vibrato whose DEPTH builds across each held vowel (a singer's
  // vibrato blooms into a sustain; it is not switched on at a fixed depth).
  // The long 타 gets the widest bloom -- it has the time for it -- and the
  // quiet 스 tail the least.
  const vibrato = ctx.createOscillator();
  vibrato.type = 'sine';
  vibrato.frequency.value = 5.1 + humanize(0.3);
  const vibratoDepth = ctx.createGain();
  envelope(vibratoDepth.gain, t0, [
    [0, 0],
    [0.1, 0],
    [U.off - 0.05, 5],
    [U.off, 2],
    [N.on, 0],
    [N.on + 0.1, 1],
    [I.off - 0.05, 6],
    [I.off, 2],
    [A.on, 0],
    [A.on + 0.15, 3],
    [A.on + 0.5, 9],
    [A.off - 0.05, 8],
    [A.off, 3],
    [S.voice, 1],
    [S.voice + 0.15, 3],
    [S.off, 0],
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
  // The E2 fundamental is carried by the detuned sawtooth pair + a HEAVY
  // clean sine (the felt chest weight, no extra harmonics); a strong
  // sub-octave sine (41 Hz -- felt more than heard) sits underneath as chest
  // resonance, the "굵고 웅장한" body of the round-13 voice without the
  // machine rumble of a sub-bass fundamental; an octave sawtooth carries the
  // same voice through small/phone speakers (missing-fundamental effect) so
  // the chant reads as the same deep voice everywhere; a faint triangle on
  // the 12th adds presence without buzz.
  const oscSpecs: Array<{ type: OscillatorType; mult: number; detune: number; gain: number }> = [
    { type: 'sawtooth', mult: 1, detune: -4, gain: 0.4 },
    { type: 'sawtooth', mult: 1, detune: 4, gain: 0.4 },
    { type: 'sine', mult: 1, detune: 0, gain: 0.44 },
    { type: 'sine', mult: 0.5, detune: 0, gain: 0.3 },
    { type: 'sawtooth', mult: 2, detune: 3, gain: 0.14 },
    { type: 'triangle', mult: 3, detune: -2, gain: 0.06 },
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
  sourceLp.frequency.value = 2600;
  sourceLp.Q.value = 0.5;
  source.connect(sourceLp);

  // --- vocal tract -----------------------------------------------------------
  const vocalBus = ctx.createGain();
  vocalBus.gain.value = 1.42;

  // Direct CHEST path: a lowpass that lets the E2 fundamental, the sub
  // octave beneath it and the 2nd / 3rd harmonics (165 / 247 Hz) through at
  // full weight. Parallel formant bandpasses alone would thin the very band
  // the chest tone lives in -- this is where the "굵고 웅장한 극저음 체스트
  // 톤" physically comes from (round 13 opened it wider and heavier).
  const chestPath = ctx.createBiquadFilter();
  chestPath.type = 'lowpass';
  chestPath.frequency.value = 320;
  chestPath.Q.value = 0.8;
  const chestGain = ctx.createGain();
  chestGain.gain.value = 0.74;
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
  // male tract (formants sit low). N is the nasal murmur (weak, dark); EU is
  // the closed, unrounded "으" that voices the tail of the final "스".
  // Round 13: the whole set sits a little lower -- a bigger, darker tract.
  const vowels: Record<string, { f: [number, number, number]; w: [number, number, number] }> = {
    U: { f: [280, 640, 2200], w: [1, 0.32, 0.1] },
    N: { f: [240, 1100, 2250], w: [0.55, 0.18, 0.07] },
    I: { f: [270, 1950, 2600], w: [1, 0.42, 0.3] },
    A: { f: [640, 1040, 2350], w: [1, 0.7, 0.3] },
    EU: { f: [280, 1200, 2250], w: [0.9, 0.24, 0.08] },
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
  // silent T closure -- exactly what a real mouth does. The "으" of the
  // final syllable forms while the hiss is still sounding.
  setVowel('N', t0 + N.on - 0.02, 0.03);
  setVowel('I', t0 + I.on - 0.015, 0.04);
  setVowel('A', t0 + T.close + 0.02, 0.035);
  setVowel('EU', t0 + S.on + 0.03, 0.04);

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
  // A murmured chest voice is breathier than a projected one: the
  // aspiration bed sits a touch higher so the "부드러운 호흡" stays audible
  // under every vowel.
  envelope(breathGain.gain, t0, [
    [0, 0.0001],
    [0.1, 0.062],
    [U.off, 0.058],
    [I.on + 0.1, 0.05],
    [T.close, 0.014],
    [A.on + 0.06, 0.06],
    [A.off, 0.05],
    [S.on, 0.05 * S_LEVEL],
    [S.voice + 0.1, 0.04 * S_LEVEL],
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
    [inhaleSpan * 0.55, 0.055],
    [inhaleSpan * 0.92, 0.014],
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
  // intelligible, and a highshelf CUT (a low voice with a bright top end
  // reads as artificial). Then dry + echo + cathedral hall.
  // Round 13: a deeper, lower chest lift and a firmer top cut -- weight
  // below, nothing brittle above.
  const chest = ctx.createBiquadFilter();
  chest.type = 'lowshelf';
  chest.frequency.value = 180;
  chest.gain.value = 6;
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 1500;
  presence.Q.value = 0.9;
  presence.gain.value = 1.5;
  const airCut = ctx.createBiquadFilter();
  airCut.type = 'highshelf';
  airCut.frequency.value = 4400;
  airCut.gain.value = -4;
  vocalBus.connect(chest);
  chest.connect(presence);
  presence.connect(airCut);
  airCut.connect(buses.dry);
  // Round 12 (item 1): a heavier hall send -- the voice is meant to fill a
  // grand, deep space ("웅장하고 깊은 공간감"), not sit dry in front of it.
  const toHall = ctx.createGain();
  toHall.gain.value = 0.84;
  airCut.connect(toHall);
  toHall.connect(buses.wet);

  // --- echo ("메아리", round 11; deepened round 12) --------------------------
  // Three feedback taps on the voice, each low-passed inside its loop so
  // every repeat comes back darker and further away, panned apart (and one
  // dead-centre, longest) so the space opens sideways AND backwards, and fed
  // into the hall as well so the echoes sit in the same room as the voice.
  // Round 12 raised the send and the feedback and added the long centre tap:
  // the tails now ring ~2.2s, yet the direct voice still always leads.
  const echoSend = ctx.createGain();
  echoSend.gain.value = 0.44;
  airCut.connect(echoSend);
  const echoOut = ctx.createGain();
  echoOut.gain.value = 0.58;
  echoOut.connect(buses.dry);
  const echoHall = ctx.createGain();
  echoHall.gain.value = 0.66;
  echoOut.connect(echoHall);
  echoHall.connect(buses.wet);
  for (const [time, feedback, lp, pan] of [
    [0.27, 0.42, 1700, -0.4],
    [0.41, 0.36, 1250, 0.4],
    [0.63, 0.3, 950, 0],
  ] as const) {
    const delay = ctx.createDelay(1);
    delay.delayTime.value = time + humanize(0.01);
    const loopLp = ctx.createBiquadFilter();
    loopLp.type = 'lowpass';
    loopLp.frequency.value = lp;
    loopLp.Q.value = 0.5;
    const fb = ctx.createGain();
    fb.gain.value = feedback;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    echoSend.connect(delay);
    delay.connect(loopLp);
    loopLp.connect(fb);
    fb.connect(delay);
    loopLp.connect(panner);
    panner.connect(echoOut);
  }

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

  // S: high-passed hiss that opens the final syllable and hands over to its
  // low voiced "으" tail (the hiss thins as the voice sinks in beneath it).
  // Round 13: the hiss, like the tail, sits BELOW the level of 유 / 니.
  const hiss = ctx.createBufferSource();
  hiss.buffer = noise;
  const hissFilter = ctx.createBiquadFilter();
  hissFilter.type = 'highpass';
  hissFilter.frequency.value = 5000;
  hissFilter.Q.value = 0.7;
  const hissGain = ctx.createGain();
  const hissPeak = 0.15 * S_LEVEL;
  hissGain.gain.setValueAtTime(0.0001, t0 + S.on);
  hissGain.gain.linearRampToValueAtTime(hissPeak, t0 + S.on + 0.04);
  hissGain.gain.setValueAtTime(hissPeak, t0 + S.voice - 0.02);
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

  // iPhone ring/silent switch: declare a playback session BEFORE the context
  // exists (round 13, item 4 -- see lib/audio/audioSession.ts).
  ensurePlaybackAudioSession();

  let ctx: AudioContext;
  try {
    ctx = new AudioCtx();
  } catch {
    return null;
  }
  const silent = makeSilentBuffer(ctx);

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

  // Round 12 (item 1): a longer, slower-decaying cathedral tail -- the
  // "웅장하고 깊은 공간감" lives here as much as in the echo taps.
  const hall = ctx.createConvolver();
  hall.buffer = makeHallImpulse(ctx, 2.8, 2.3);
  const wet = ctx.createGain();
  wet.gain.value = 1;
  wet.connect(hall);
  const hallOut = ctx.createGain();
  hallOut.gain.value = 0.5;
  hall.connect(hallOut);
  hallOut.connect(master);

  const noise = makeNoise(ctx);
  const buses: Buses = { dry, wet };

  let scheduled = false;
  let disposed = false;
  let detachGestures: (() => void) | null = null;
  /** Context time at which the scheduled score (voice + crystal + tails) is
   *  over -- `dispose()` will not fade before this on a late unlock. */
  let scoreEndsAt = 0;

  const schedule = () => {
    if (scheduled || disposed || ctx.state !== 'running') return;
    scheduled = true;
    detachGestures?.();
    const elapsed = (performance.now() - startedAt) / 1000;
    const { vocalAt, crystalAt } = splashAudioOffsets(elapsed);
    const now = ctx.currentTime + 0.02;
    try {
      if (vocalAt !== null) scheduleVocal(ctx, buses, noise, now + vocalAt);
      scheduleCrystal(ctx, buses, noise, now + crystalAt);
      scoreEndsAt = Math.max(
        vocalAt !== null ? now + vocalAt + SPLASH_VOCAL_LENGTH_S : 0,
        now + crystalAt + SPLASH_CRYSTAL_LENGTH_S,
      );
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
    // Round 13 (item 4): everything below runs SYNCHRONOUSLY inside the
    // gesture handler -- that is what carries the user activation to the
    // autoplay policy. The silent kick is the legacy WebKit unlock that
    // `resume()` alone did not always achieve on iPhones; an `interrupted`
    // context (iOS, after a call / Siri) is resumed exactly like a
    // suspended one.
    ensurePlaybackAudioSession();
    if (silent) kickAudioContext(ctx, silent);
    ctx
      .resume()
      .then(() => schedule())
      .catch(() => {});
  };

  // Global activation-event unlock (round 11, item 2) -- see the header.
  // Capture phase so a surface that stops propagation (a modal backdrop, the
  // curtain's own handlers) can never swallow the unlocking gesture; passive
  // so scrolling is never blocked. Detached the moment the score is
  // scheduled, or on dispose.
  detachGestures = attachActivationUnlock(unlock);
  // Anything else bringing the context up (the site-wide audio gate resuming
  // it, an OS-level media resume) schedules the score too.
  const onStateChange = () => {
    if (ctx.state === 'running') schedule();
  };
  ctx.addEventListener('statechange', onStateChange);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    detachGestures?.();
    ctx.removeEventListener('statechange', onStateChange);
    // A late-unlocked score (mobile online: first touch at 2-4s) may still be
    // mid-chant when the 5s layer leaves. Let it finish -- bounded -- before
    // fading, so the logo page's voice is never cut off on a phone. An early
    // unlock has already finished by now and fades at once, as before.
    let holdMs = 0;
    try {
      holdMs = Math.min(LATE_SCORE_HOLD_MAX_S, Math.max(0, scoreEndsAt - ctx.currentTime)) * 1000;
    } catch {
      holdMs = 0;
    }
    window.setTimeout(() => {
      try {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
        master.gain.linearRampToValueAtTime(0, t + 0.35);
      } catch {
        /* no-op */
      }
      window.setTimeout(() => {
        ctx.close().catch(() => {});
      }, 500);
    }, holdMs);
  };

  // Try right away -- installed PWAs and high-engagement origins are allowed
  // to start audio without a gesture; everyone else unlocks on first touch.
  unlock();

  return { unlock, dispose };
}

/**
 * The events browsers treat as "activation triggering input events" (HTML
 * spec): `keydown`, `mousedown`, a MOUSE `pointerdown`, a non-mouse
 * `pointerup`, `touchend`, plus `click` as the universal fallback -- AND
 * (owner instruction 2026-09-05, 7-point hardening, item 7) a forced resume
 * on `pointerdown` / `touchstart`, the first physical contact with the
 * screen. Those two carry no activation on their own, so an engine may
 * defer the resume they request; the activating `touchend` / `pointerup` of
 * the same finger settles it a few dozen ms later. Where the engine does
 * honour an early resume (installed PWA, engaged origin, Firefox) the chant
 * starts on contact. Exported for the splash component and the Coming-Soon
 * cinema, which mirror the same set.
 */
export const SPLASH_UNLOCK_EVENTS = [
  'pointerdown',
  'touchstart',
  'pointerup',
  'touchend',
  'mousedown',
  'click',
  'keydown',
] as const;

/**
 * Installs the unlock listeners on `window` (capture, passive) and returns
 * the detach function. Idempotent per call; safe to call multiple times.
 */
export function attachActivationUnlock(unlock: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  const handler = () => {
    try {
      // Round 13 (item 4): the playback session is (re)declared inside the
      // gesture itself, for every engine that shares this unlock -- the
      // splash score, the Coming-Soon ambient bed and the site-wide SFX.
      ensurePlaybackAudioSession();
      unlock();
    } catch {
      /* never let an unlock attempt throw out of a gesture */
    }
  };
  for (const type of SPLASH_UNLOCK_EVENTS) window.addEventListener(type, handler, opts);
  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    for (const type of SPLASH_UNLOCK_EVENTS) window.removeEventListener(type, handler, opts);
  };
}
