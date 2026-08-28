// One-shot generator for the shared "coming soon" cinematic loop.
//
// Emits a single deterministic manifest (public/coming-soon/cinema.json) that
// describes an ambient background animation as pure data -- a seeded particle
// field, gradient-sweep / scanline / title-pulse keyframe tracks, palette,
// timing. No video, no canvas rasterization, no ffmpeg: the render side is a
// small Framer Motion component (components/modules/ComingSoonScene.tsx) that
// reads this manifest. Keeping the motion as data means regenerating the
// "cinema" is a script run, not a re-export of binary assets -- the output
// stays diff-friendly and a few KB, per the Low-Memory Armor rules in CLAUDE.md.
//
// Usage:
//   node scripts/generate-coming-soon-cinema.mjs --loop --target=web --optimize=low-memory
//   npm --prefix web run gen:coming-soon
//
// Flags:
//   --loop / --no-loop     seamless loop (last keyframe == first). Default: loop.
//   --target=web           output surface. Only "web" is supported today
//                          (-> public/coming-soon/cinema.json). Default: web.
//   --optimize=<profile>   low-memory | balanced | high. Controls particle
//                          count, keyframe density, and coordinate precision.
//                          Default: balanced.
//   --seed=<string>        RNG seed. Default: "unitas//coming-soon//v1".
//   --out=<path>           explicit output file, overrides --target.
//
// Deterministic: identical flags produce byte-identical output (no wall-clock
// stamp), so re-running in CI or the Stop hook never creates a spurious diff.

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

// ---- arg parsing --------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf('=');
  return eq === -1 ? true : hit.slice(eq + 1);
};

const loop = flag('no-loop') ? false : true;
const target = String(opt('target', 'web'));
const profileName = String(opt('optimize', 'balanced'));
const seed = String(opt('seed', 'unitas//coming-soon//v1'));
const outOverride = opt('out', null);

const PROFILES = {
  'low-memory': { particles: 34, keyframes: 3, precision: 1 },
  balanced: { particles: 64, keyframes: 5, precision: 2 },
  high: { particles: 120, keyframes: 7, precision: 2 },
};
const profile = PROFILES[profileName];
if (!profile) {
  throw new Error(
    `Unknown --optimize=${profileName}. Expected one of: ${Object.keys(PROFILES).join(', ')}`,
  );
}
if (target !== 'web' && !outOverride) {
  throw new Error(`Unsupported --target=${target}. Only "web" is supported (or pass --out=<path>).`);
}

// ---- deterministic RNG (cyrb128 seed + mulberry32) ---------------------
function cyrb128(str) {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}
function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(cyrb128(seed));
const p = profile.precision;
const r = (n) => Number(n.toFixed(p));
const between = (min, max) => min + rand() * (max - min);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const offsetAt = (i, n) => Number((i / (n - 1)).toFixed(3));

// ---- palette (mirrors tailwind.config.ts) -----------------------------
const PALETTE = {
  void: '#030305',
  haze: '#0f1016',
  accent: '#d4af37',
  neon: '#00f3ff',
};

const DURATION_MS = 21000;

// ---- seeded particle drift field -------------------------------------
const particles = Array.from({ length: profile.particles }, () => {
  const depth = rand(); // 0 = far/faint/slow, 1 = near/bright
  return {
    x: r(between(0, 100)),
    y: r(between(0, 100)),
    radius: r(0.6 + depth * 2.4),
    opacity: r(0.12 + depth * 0.42),
    delayMs: Math.round(between(0, DURATION_MS)),
    durationMs: Math.round(between(7000, 14000)),
    drift: [r(between(-46, 46)), r(between(-72, -14))],
    tone: pick(['accent', 'neon', 'haze']),
  };
});

// ---- keyframe tracks -------------------------------------------------
function track(build) {
  const n = profile.keyframes;
  const frames = [];
  for (let i = 0; i < n; i++) {
    frames.push({ offset: offsetAt(i, n), ...build(offsetAt(i, n)) });
  }
  if (loop && n > 1) {
    frames[n - 1] = { ...frames[0], offset: 1 };
  }
  return frames;
}

const sweep = track((o) => ({
  rotate: r(-6 + Math.sin(o * Math.PI * 2) * 10),
  opacity: r(0.14 + Math.sin(o * Math.PI) ** 2 * 0.2),
}));

const pulse = track((o) => ({
  glowPx: Math.round(12 + Math.sin(o * Math.PI) ** 2 * 26),
  opacity: r(0.62 + Math.sin(o * Math.PI) ** 2 * 0.38),
  letterSpacingEm: r(0.2 + Math.sin(o * Math.PI * 2) * 0.06),
}));

// A scanline that fades fully at both ends, so the loop wrap (bottom -> top)
// is never visible regardless of --loop.
const scan = [
  { offset: 0, y: -12, opacity: 0 },
  { offset: 0.5, y: 50, opacity: r(0.32) },
  { offset: 1, y: 112, opacity: 0 },
];

// ---- manifest ------------------------------------------------------
const manifest = {
  schemaVersion: 1,
  kind: 'coming-soon-cinema',
  generator: 'scripts/generate-coming-soon-cinema.mjs',
  seed,
  target,
  profile: profileName,
  loop,
  durationMs: DURATION_MS,
  viewBox: { width: 1200, height: 675 },
  palette: PALETTE,
  layers: [
    { id: 'drift-field', type: 'particles', blend: 'screen', particles },
    {
      id: 'horizon-sweep',
      type: 'gradient-sweep',
      blend: 'screen',
      from: 'accent',
      to: 'neon',
      keyframes: sweep,
    },
    { id: 'scanline', type: 'sweep-bar', blend: 'screen', tone: 'neon', keyframes: scan },
    { id: 'title-pulse', type: 'text-glow', tone: 'accent', keyframes: pulse },
  ],
  meta: {
    particleCount: particles.length,
    keyframesPerTrack: profile.keyframes,
    precision: profile.precision,
    deterministic: true,
    note: 'Generated from seed with no wall-clock stamp; identical flags -> byte-identical output. Edit the generator, not this file.',
  },
};

// ---- write (idempotent) ------------------------------------------
const outPath = outOverride
  ? resolve(String(outOverride))
  : join(webRoot, 'public', 'coming-soon', 'cinema.json');
const json = `${JSON.stringify(manifest, null, 2)}\n`;

let prev = null;
try {
  prev = readFileSync(outPath, 'utf8');
} catch {
  /* first run */
}

if (prev === json) {
  console.log(`coming-soon cinema: unchanged (${outPath})`);
} else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json, 'utf8');
  console.log(
    `coming-soon cinema: ${particles.length} particles, profile=${profileName}, loop=${loop} -> ${outPath}`,
  );
}
