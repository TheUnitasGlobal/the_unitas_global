// Fully synthesized Web Audio score for the 3-second cinematic intro splash
// (owner instruction 2026-09-04, item 3-4). No audio files -- every sound is
// oscillators + filtered noise + a synthesized hall impulse, matching the
// Low-Memory Armor / no-binary-assets rule used by SpatialAudioProvider and
// the Coming-Soon cinema.
//
//   1.0s -> 2.0s  "UNITAS" -- a grand, deep, natural male bass vocal (round 8
//                 -- owner instruction 2026-09-05: reverses round 7's move to
//                 a thin mid-high register; the fundamental sits back down in
//                 a true bass band, but unlike the pre-round-5 "murky" bass
//                 this one stays clean via a lower-Q, smoother formant filter
//                 and a lighter sourceLp cutoff tuned to the lower register).
//                 A unison pair of detuned sawtooths plus a soft sine
//                 sub-octave (not a second sawtooth -- keeps the extra weight
//                 from turning into buzz) feed a shared vibrato+jitter detune
//                 bus (slow 5.2 Hz vibrato for the "grand" sustain, a faster
//                 subtle ~11 Hz jitter for natural pitch micro-instability --
//                 a dead-steady pitch is what reads as "machine"), plus a
//                 gain-domain shimmer LFO and a parallel formant-shaped
//                 breath-noise bed for the same reason -- a pure harmonic
//                 tone with zero air/noise floor is the other big "synthetic"
//                 tell. Source-lowpassed to shave the raw sawtooth's buzz
//                 before it hits a three-band formant filter (wider, lower-Q
//                 bands than round 7 -- a narrow resonant peak rings like a
//                 machine formant) whose F1/F2/F3 targets (lowered back for a
//                 warm, large vocal-tract color) walk U -> N -> I -> T -> A ->
//                 S (a noise burst for the plosive T, a high-passed hiss for
//                 the final S), then a warm low-shelf "chest" lift + a tamed
//                 top end (a highshelf CUT, not boost -- round 7's brightness
//                 is exactly the thin/artificial quality being reversed), and
//                 a cathedral convolver for scale.
//   2.0s -> 3.0s  crystal echo impact -- a bright inharmonic bell cluster
//                 (E7 / B7 / E8 / G7 strikes) with a two-tap feedback delay
//                 whose loop is high-passed so every echo comes back thinner
//                 and glassier, plus an airy 10 kHz shimmer and a rising
//                 sweep for the impact edge. Rings out by the 3-second mark.
//
// Autoplay policy: the context is created suspended on a cold load. We try
// to resume immediately (allowed for installed PWAs / high-engagement
// sites); otherwise the first pointer/key gesture during the splash unlocks
// it and `splashAudioOffsets` re-times the cues from that moment. Respects
// the site-wide mute preference (`unitas_audio_pref === 'off'`).

import { isTouchPrimaryDevice } from '@/lib/pointerDevice';
import {
  SPLASH_CRYSTAL_LENGTH_S,
  SPLASH_VOCAL_LENGTH_S,
  splashAudioOffsets,
} from './splashTimeline';

/** Mirrors SpatialAudioProvider's persisted preference key. */
const AUDIO_PREF_KEY = 'unitas_audio_pref';
// Owner instruction 2026-09-05 (round 1): master gain cut to 0.3x its prior
// level (0.82 -> 0.246) so the splash vocal/crystal chime sits well under
// the site's ambient bed instead of dominating the opening seconds. This
// stays the mobile/handheld level -- untouched by round 2 below.
const MASTER_GAIN_MOBILE = 0.246;
// Owner instruction 2026-09-05 (round 2): PC only gets an ADDITIONAL 30% cut
// on top of the round-1 level (0.246 -> 0.1722) so the vocal/echo sits more
// comfortably on desktop speakers/headphones; handheld devices keep the
// round-1 level unchanged. Gated on `isTouchPrimaryDevice()` (coarse
// pointer + no hover -- a genuine phone/tablet), the same primary-pointer
// check the scroll-focus SFX already uses to tell a real handheld apart
// from a mouse-driven desktop.
// Owner instruction 2026-09-05 (round 4): a SECOND additional 30% cut stacks
// on top of round 2's already-reduced PC level (0.1722 -> 0.12054) -- still
// gated the same way, handheld level untouched.
const MASTER_GAIN_PC = MASTER_GAIN_MOBILE * 0.7 * 0.7;

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

// ---------------------------------------------------------------------------
// 1. "UNITAS" vocal (formant synthesis)
// ---------------------------------------------------------------------------
function scheduleVocal(ctx: AudioContext, buses: Buses, noise: AudioBuffer, t0: number): void {
  const L = SPLASH_VOCAL_LENGTH_S;
  // Syllable map inside the one-second word (relative seconds).
  const N0 = 0.3;
  const I0 = 0.38;
  const T0 = 0.6;
  const A0 = 0.65;
  const S0 = 0.88;

  // --- voiced source bus with the phonetic amplitude contour -------------
  const source = ctx.createGain();
  envelope(source.gain, t0, [
    [0, 0.0001],
    [0.07, 1],
    [N0 - 0.02, 1],
    [N0 + 0.02, 0.62], // nasal dip for N
    [I0 + 0.03, 1],
    [T0 - 0.03, 0.9],
    [T0, 0.0001], // stop closure for T
    [A0, 0.0001],
    [A0 + 0.035, 1],
    [S0 - 0.03, 0.85],
    [S0 + 0.05, 0.0001],
  ]);

  // Fundamental contour: rises through the word ("announcement" cadence),
  // then falls into the final syllable -- round 8: back down into a true
  // bass register (a low G2 area) after round 7's mid-high excursion, per
  // owner instruction to sound like a grand, deep, natural male bass rather
  // than a thin premium tone.
  const f0: Array<[number, number]> = [
    [0, 92],
    [0.2, 104],
    [N0, 106],
    [I0, 109],
    [T0 - 0.02, 112],
    [A0, 118],
    [0.8, 102],
    [S0, 90],
  ];

  const vibrato = ctx.createOscillator();
  vibrato.type = 'sine';
  vibrato.frequency.value = 5.2;
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.setValueAtTime(0, t0);
  vibratoDepth.gain.linearRampToValueAtTime(11, t0 + 0.4); // cents -- slightly deeper for a "grand" sustain
  vibrato.connect(vibratoDepth);
  vibrato.start(t0);
  vibrato.stop(t0 + L + 0.4);

  // round 8: a small, fast, ever-so-slightly-random-sounding jitter LFO on
  // top of the slow vibrato -- a perfectly steady pitch is one of the
  // clearest "synthesized" tells; real vocal cords wobble a few cents even
  // when a human is trying to hold a note dead level.
  const jitter = ctx.createOscillator();
  jitter.type = 'sine';
  jitter.frequency.value = 11.3;
  const jitterDepth = ctx.createGain();
  jitterDepth.gain.value = 3; // cents
  jitter.connect(jitterDepth);
  jitter.start(t0);
  jitter.stop(t0 + L + 0.4);

  // round 8: a soft sine sub-octave is back (round 7 removed it outright to
  // kill "thick low end", but that was in service of a mid-high voice this
  // round intentionally reverses). Using a sine rather than a second
  // sawtooth keeps the extra octave of weight from turning into the old
  // "murky" buzz -- it just reinforces fundamental weight, no new harmonics.
  const oscSpecs: Array<{ type: OscillatorType; mult: number; detune: number; gain: number }> = [
    { type: 'sawtooth', mult: 1, detune: -4, gain: 0.5 },
    { type: 'sawtooth', mult: 1, detune: 4, gain: 0.5 },
    { type: 'sine', mult: 0.5, detune: 0, gain: 0.17 }, // chest sub-octave, deliberately clean
    { type: 'triangle', mult: 2, detune: 2, gain: 0.12 }, // presence octave, trimmed back this round
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
    const g = ctx.createGain();
    g.gain.value = spec.gain;
    osc.connect(g);
    g.connect(source);
    osc.start(t0);
    osc.stop(t0 + L + 0.4);
  }

  // round 8: a barely-there amplitude shimmer -- real vocal loudness never
  // holds a perfectly flat line either. Sums additively into source.gain
  // alongside the phonetic envelope already scheduled above.
  const shimmer = ctx.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.value = 4.3;
  const shimmerDepth = ctx.createGain();
  shimmerDepth.gain.value = 0.035;
  shimmer.connect(shimmerDepth);
  shimmerDepth.connect(source.gain);
  shimmer.start(t0);
  shimmer.stop(t0 + L + 0.4);

  // Shave the raw sawtooth's upper buzz before it ever reaches the formant
  // bands -- round 8: cutoff lowered back down alongside the bass f0 (round
  // 7 raised it for the mid-high voice's harmonics; those aren't needed here
  // and leaving it high just reintroduces buzz on the lower fundamental).
  const sourceLp = ctx.createBiquadFilter();
  sourceLp.type = 'lowpass';
  sourceLp.frequency.value = 3400;
  sourceLp.Q.value = 0.6;
  source.connect(sourceLp);

  // round 8: a parallel formant-shaped breath-noise bed. A pure harmonic
  // tone with zero noise floor is the other classic "synthesizer" tell --
  // real breath moving through a vocal tract always carries some air.  Kept
  // very quiet and shaped broadly (not a sharp resonance) so it reads as
  // texture, not hiss.
  const breath = ctx.createBufferSource();
  breath.buffer = noise;
  const breathFilter = ctx.createBiquadFilter();
  breathFilter.type = 'bandpass';
  breathFilter.frequency.value = 700;
  breathFilter.Q.value = 0.4;
  const breathGain = ctx.createGain();
  envelope(breathGain.gain, t0, [
    [0, 0.0001],
    [0.08, 0.05],
    [S0 + 0.05, 0.045],
    [S0 + 0.2, 0.0001],
  ]);
  breath.connect(breathFilter);
  breathFilter.connect(breathGain);
  breath.start(t0);
  breath.stop(t0 + L + 0.3);

  // --- three-band formant filter (parallel) ------------------------------
  const vocalBus = ctx.createGain();
  vocalBus.gain.value = 1.35;
  breathGain.connect(vocalBus);
  const bands = [
    { q: 2.8, gain: 1.5 }, // round 8: lower Q than round 7 -- a narrow resonant peak rings like a machine formant, not a chest
    { q: 4.0, gain: 0.75 },
    { q: 5.0, gain: 0.3 },
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

  // Vowel targets: [F1, F2, F3] Hz and relative band weights. round 8:
  // lowered back down from round 7's thinned-out values so the vocal-tract
  // color reads as a large, warm chest rather than a small/sleek throat.
  const vowels: Record<string, { f: [number, number, number]; w: [number, number, number] }> = {
    U: { f: [350, 800, 2300], w: [1, 0.35, 0.1] },
    N: { f: [300, 1350, 2300], w: [0.6, 0.2, 0.08] },
    I: { f: [310, 2150, 2700], w: [1, 0.32, 0.24] },
    A: { f: [750, 1150, 2450], w: [1, 0.65, 0.28] },
  };
  const setVowel = (name: keyof typeof vowels, at: number, tau = 0.035) => {
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
  setVowel('N', t0 + N0, 0.02);
  setVowel('I', t0 + I0);
  setVowel('A', t0 + A0, 0.025);

  // Tone shaping: round 8 -- the chest low-shelf boost is back (round 7
  // removed it for a thin mid-high voice; this round explicitly wants the
  // opposite). A gentle presence peak keeps consonants intelligible, and the
  // old "air" highshelf BOOST is flipped to a highshelf CUT -- extra top-end
  // brilliance is exactly the sleek/synthetic quality being reversed here,
  // and a bass voice with a bright top end reads as artificial.
  const chest = ctx.createBiquadFilter();
  chest.type = 'lowshelf';
  chest.frequency.value = 220;
  chest.gain.value = 3.5;
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 2200;
  presence.Q.value = 0.9;
  presence.gain.value = 1.6;
  const airCut = ctx.createBiquadFilter();
  airCut.type = 'highshelf';
  airCut.frequency.value = 5000;
  airCut.gain.value = -2.5;
  vocalBus.connect(chest);
  chest.connect(presence);
  presence.connect(airCut);
  airCut.connect(buses.dry);
  const toHall = ctx.createGain();
  toHall.gain.value = 0.5; // round 8: a touch more hall depth to reinforce the "grand" quality
  airCut.connect(toHall);
  toHall.connect(buses.wet);

  // --- consonants ---------------------------------------------------------
  // T: short band-passed burst right after the closure.
  const burst = ctx.createBufferSource();
  burst.buffer = noise;
  const burstFilter = ctx.createBiquadFilter();
  burstFilter.type = 'bandpass';
  burstFilter.frequency.value = 3800;
  burstFilter.Q.value = 2.5;
  const burstGain = ctx.createGain();
  burstGain.gain.setValueAtTime(0.0001, t0 + T0);
  burstGain.gain.linearRampToValueAtTime(0.24, t0 + T0 + 0.032);
  burstGain.gain.exponentialRampToValueAtTime(0.0001, t0 + T0 + 0.08);
  burst.connect(burstFilter);
  burstFilter.connect(burstGain);
  burstGain.connect(buses.dry);
  burst.start(t0 + T0 + 0.028);
  burst.stop(t0 + T0 + 0.1);

  // S: high-passed hiss that tails the word out.
  const hiss = ctx.createBufferSource();
  hiss.buffer = noise;
  const hissFilter = ctx.createBiquadFilter();
  hissFilter.type = 'highpass';
  hissFilter.frequency.value = 5200;
  hissFilter.Q.value = 0.7;
  const hissGain = ctx.createGain();
  hissGain.gain.setValueAtTime(0.0001, t0 + S0);
  hissGain.gain.linearRampToValueAtTime(0.17, t0 + S0 + 0.035);
  hissGain.gain.setValueAtTime(0.17, t0 + S0 + 0.1);
  hissGain.gain.exponentialRampToValueAtTime(0.0001, t0 + S0 + 0.32);
  hiss.connect(hissFilter);
  hissFilter.connect(hissGain);
  hissGain.connect(buses.dry);
  const hissHall = ctx.createGain();
  hissHall.gain.value = 0.3;
  hissGain.connect(hissHall);
  hissHall.connect(buses.wet);
  hiss.start(t0 + S0);
  hiss.stop(t0 + S0 + 0.36);
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
  master.gain.value = isTouchPrimaryDevice() ? MASTER_GAIN_MOBILE : MASTER_GAIN_PC;
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
