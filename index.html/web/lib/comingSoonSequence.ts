// 30-second, infinitely-looping cinematic played after the visitor crosses the
// entry gate. Rendered on a single 2D <canvas> by <ComingSoonCinema/> at up to
// 60fps, with a low, fixed particle budget and zero per-frame allocation
// (all fields are pre-seeded once). Honours prefers-reduced-motion upstream
// (the component draws a single frame instead of running the rAF loop).
//
// Timeline (owner instruction 2026-08-29: even 6s cadence, no uneven jumps /
// buffering feel). Each segment renders a two-line lockup: an English keyword
// HEAD + a localized SUB line (ComingSoonGate.cinemaS{n}Head / .cinemaS{n}Sub
// in messages/*.json). Flow: UNITAS -> U-AI -> 11 Cores -> 5&3 -> Awakening,
// then the sealed "COMING SOON" screen:
//   0-6s   "The Singularity is Near."  (UNITAS overture) -- black-hole condensation
//   6-12s  "U-AI Engine"                                 -- autonomous-engine silhouette
//   12-18s "11 Cognitive Cores"                          -- rotating constellation
//   18-24s "5 Systems & 3 Pillars"                       -- pentagon + sovereign axes
//   24-30s "The Sovereign Intelligence is Awakening."    -- closing bloom + lock
//
// The pure timing helpers (cinemaSegmentAt / *Progress) are unit-tested in
// __tests__/gate/comingSoonSequence.test.ts. drawFrame() itself is visual-only.

export const CINEMA_DURATION_MS = 30_000;

export interface CinemaSegment {
  id: 1 | 2 | 3 | 4 | 5;
  startMs: number;
  endMs: number;
  /** ComingSoonGate.* message key for the localized caption line. */
  captionKey: 'cinemaS1' | 'cinemaS2' | 'cinemaS3' | 'cinemaS4' | 'cinemaS5';
}

export const CINEMA_SEGMENTS: readonly CinemaSegment[] = [
  { id: 1, startMs: 0, endMs: 6_000, captionKey: 'cinemaS1' },
  { id: 2, startMs: 6_000, endMs: 12_000, captionKey: 'cinemaS2' },
  { id: 3, startMs: 12_000, endMs: 18_000, captionKey: 'cinemaS3' },
  { id: 4, startMs: 18_000, endMs: 24_000, captionKey: 'cinemaS4' },
  { id: 5, startMs: 24_000, endMs: 30_000, captionKey: 'cinemaS5' },
] as const;

function wrap(ms: number): number {
  return ((ms % CINEMA_DURATION_MS) + CINEMA_DURATION_MS) % CINEMA_DURATION_MS;
}

export function cinemaSegmentAt(ms: number): CinemaSegment {
  const t = wrap(ms);
  for (const seg of CINEMA_SEGMENTS) {
    if (t >= seg.startMs && t < seg.endMs) return seg;
  }
  return CINEMA_SEGMENTS[CINEMA_SEGMENTS.length - 1];
}

/** 0..1 progress within the current segment. */
export function cinemaSegmentProgress(ms: number): number {
  const t = wrap(ms);
  const seg = cinemaSegmentAt(ms);
  return (t - seg.startMs) / (seg.endMs - seg.startMs);
}

/** 0..1 progress across the whole 30s loop. */
export function cinemaOverallProgress(ms: number): number {
  return wrap(ms) / CINEMA_DURATION_MS;
}

// --- rendering ---------------------------------------------------------------

const PALETTE = {
  void: '#030305',
  accent: '#d4af37',
  neon: '#00f3ff',
  violet: '#7c3aed',
  pink: '#ec4899',
};

const STAR_COUNT = 130;
const SPIRAL_COUNT = 64;
const ECHO_CORES = 11;

interface Star {
  x: number;
  y: number;
  r: number;
  tw: number;
  phase: number;
}
interface SpiralP {
  a0: number;
  rad: number;
  size: number;
  spin: number;
  hue: number;
}

interface SeededField {
  stars: Star[];
  spiral: SpiralP[];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build the deterministic particle field once, then reuse every frame. */
export function seedCinemaField(seed = 0x554e_4954): SeededField {
  const rnd = mulberry32(seed);
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: rnd(),
      y: rnd(),
      r: 0.4 + rnd() * 1.4,
      tw: 0.4 + rnd() * 2.6,
      phase: rnd() * Math.PI * 2,
    });
  }
  const spiral: SpiralP[] = [];
  for (let i = 0; i < SPIRAL_COUNT; i++) {
    spiral.push({
      a0: rnd() * Math.PI * 2,
      rad: 0.32 + rnd() * 0.62,
      size: 0.6 + rnd() * 1.9,
      spin: 0.6 + rnd() * 1.5,
      hue: rnd(),
    });
  }
  return { stars, spiral };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (v: number) => (v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2);
const easeOut = (v: number) => 1 - (1 - v) ** 3;

/** Fade an element in over `ms` at the segment start and out before its end. */
function edgeFade(local: number, segMs: number, ms = 420): number {
  const inA = clamp01((local * segMs) / ms);
  const outA = clamp01(((1 - local) * segMs) / ms);
  return Math.min(inA, outA);
}

function hueColor(h: number, alpha: number): string {
  const stops = [PALETTE.neon, PALETTE.accent, PALETTE.violet, PALETTE.pink];
  const c = stops[Math.floor(h * stops.length) % stops.length];
  return withAlpha(c, alpha);
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

export interface DrawArgs {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  elapsedMs: number;
  field: SeededField;
  reducedMotion?: boolean;
  /** 0..1 -- global dim applied on the locked "Coming Soon" screen. */
  dim?: number;
}

export function drawCinemaFrame({
  ctx,
  width,
  height,
  elapsedMs,
  field,
  reducedMotion = false,
  dim = 0,
}: DrawArgs): void {
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  const t = wrap(elapsedMs);
  const seg = cinemaSegmentAt(elapsedMs);
  const local = cinemaSegmentProgress(elapsedMs);
  const globalAlpha = 1 - clamp01(dim) * 0.62;

  // background
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(0, 0, width, height);

  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, minDim * 0.75);
  bg.addColorStop(0, withAlpha(PALETTE.violet, 0.14 * globalAlpha));
  bg.addColorStop(0.55, withAlpha(PALETTE.void, 0));
  bg.addColorStop(1, withAlpha(PALETTE.void, 0));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // starfield (all segments)
  const time = elapsedMs / 1000;
  for (const s of field.stars) {
    const twinkle = reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(time * s.tw + s.phase);
    ctx.fillStyle = withAlpha('#ffffff', (0.12 + 0.5 * twinkle) * 0.5 * globalAlpha);
    ctx.beginPath();
    ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';

  // core glow -- present in every segment, intensity varies
  const coreBeat = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(time * 1.6);
  const coreR = minDim * (0.03 + 0.012 * coreBeat);
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 6);
  core.addColorStop(0, withAlpha('#ffffff', 0.9 * globalAlpha));
  core.addColorStop(0.25, withAlpha(PALETTE.accent, 0.5 * globalAlpha));
  core.addColorStop(1, withAlpha(PALETTE.accent, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, coreR * 6, 0, Math.PI * 2);
  ctx.fill();

  const spin = reducedMotion ? 0 : time;

  // SEGMENT 1 -- condensation
  if (seg.id === 1) {
    const collapse = easeInOut(local);
    const a = edgeFade(local, seg.endMs - seg.startMs);
    for (const p of field.spiral) {
      const rad = minDim * p.rad * (1 - collapse * 0.92);
      const ang = p.a0 + spin * p.spin + collapse * 5;
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad;
      ctx.fillStyle = hueColor(p.hue, (0.5 + 0.5 * collapse) * a * globalAlpha);
      ctx.beginPath();
      ctx.arc(x, y, p.size * (0.6 + collapse), 0, Math.PI * 2);
      ctx.fill();
    }
    if (collapse > 0.7) {
      const flash = (collapse - 0.7) / 0.3;
      ctx.strokeStyle = withAlpha('#ffffff', flash * (1 - flash) * 4 * a * globalAlpha);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, minDim * 0.06 * flash * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // SEGMENT 3 -- 11 echo cores
  if (seg.id === 3) {
    const grow = easeOut(clamp01(local * 1.6));
    const a = edgeFade(local, seg.endMs - seg.startMs);
    const ring = minDim * (0.16 + 0.16 * grow);
    const nodes: Array<[number, number]> = [];
    for (let i = 0; i < ECHO_CORES; i++) {
      const ang = (i / ECHO_CORES) * Math.PI * 2 + spin * 0.35;
      nodes.push([Math.cos(ang) * ring, Math.sin(ang) * ring]);
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < ECHO_CORES; i++) {
      for (let j = i + 1; j < ECHO_CORES; j++) {
        const [x1, y1] = nodes[i];
        const [x2, y2] = nodes[j];
        const d = Math.hypot(x2 - x1, y2 - y1) / (ring * 2);
        ctx.strokeStyle = withAlpha(PALETTE.neon, (0.16 - d * 0.13) * a * globalAlpha);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    nodes.forEach(([x, y], i) => {
      const pulse = reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(time * 2 + i);
      const g = ctx.createRadialGradient(x, y, 0, x, y, minDim * 0.03);
      g.addColorStop(0, withAlpha('#ffffff', 0.9 * a * globalAlpha));
      g.addColorStop(0.4, withAlpha(PALETTE.neon, 0.6 * a * globalAlpha));
      g.addColorStop(1, withAlpha(PALETTE.neon, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, minDim * (0.014 + 0.01 * pulse), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // SEGMENT 2 -- U-AI / autonomous-engine silhouette
  if (seg.id === 2) {
    const a = edgeFade(local, seg.endMs - seg.startMs);
    for (let k = 0; k < 4; k++) {
      const rr = minDim * (0.08 + k * 0.06) + (reducedMotion ? 0 : Math.sin(time * 1.2 + k) * 4);
      ctx.strokeStyle = withAlpha(PALETTE.accent, (0.22 - k * 0.04) * a * globalAlpha);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    // scanning bar
    const scanY = (reducedMotion ? 0.5 : (local * 2) % 1) * minDim * 0.5 - minDim * 0.25;
    const grad = ctx.createLinearGradient(0, scanY - 12, 0, scanY + 12);
    grad.addColorStop(0, withAlpha(PALETTE.neon, 0));
    grad.addColorStop(0.5, withAlpha(PALETTE.neon, 0.5 * a * globalAlpha));
    grad.addColorStop(1, withAlpha(PALETTE.neon, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(-minDim * 0.32, scanY - 12, minDim * 0.64, 24);
  }

  // SEGMENT 4 -- 5 live systems (pentagon only; the 3 sovereign axes moved
  // to their own SEGMENT 5 now that 5대 and 3대 are distinct ad phases)
  if (seg.id === 4) {
    const a = edgeFade(local, seg.endMs - seg.startMs);
    const R = minDim * 0.24;
    // 5-system pentagon
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 - Math.PI / 2 + spin * 0.25;
      const x = Math.cos(ang) * R;
      const y = Math.sin(ang) * R;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = withAlpha(PALETTE.accent, 0.7 * a * globalAlpha);
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 - Math.PI / 2 + spin * 0.25;
      const x = Math.cos(ang) * R;
      const y = Math.sin(ang) * R;
      const g = ctx.createRadialGradient(x, y, 0, x, y, minDim * 0.04);
      g.addColorStop(0, withAlpha('#ffffff', 0.9 * a * globalAlpha));
      g.addColorStop(1, withAlpha(PALETTE.accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, minDim * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // SEGMENT 5 -- 3 sovereign pillars (triangle of nodes + axes), then a soft
  // closing bloom that hands off to the sealed "COMING SOON" screen
  if (seg.id === 5) {
    const a = 1 - clamp01((local - 0.7) / 0.3);
    const R = minDim * 0.22;
    const tri: Array<[number, number]> = [];
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 - Math.PI / 2 + spin * 0.18;
      tri.push([Math.cos(ang) * R, Math.sin(ang) * R]);
    }
    // connecting axes
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = withAlpha(PALETTE.violet, 0.42 * a * globalAlpha);
    ctx.beginPath();
    tri.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    // pillar nodes
    tri.forEach(([x, y], i) => {
      const pulse = reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(time * 1.8 + i * 2.1);
      const g = ctx.createRadialGradient(x, y, 0, x, y, minDim * 0.05);
      g.addColorStop(0, withAlpha('#ffffff', 0.92 * a * globalAlpha));
      g.addColorStop(0.4, withAlpha(PALETTE.accent, 0.6 * a * globalAlpha));
      g.addColorStop(1, withAlpha(PALETTE.accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, minDim * (0.016 + 0.008 * pulse), 0, Math.PI * 2);
      ctx.fill();
    });
    if (local > 0.55) {
      const bloom = (local - 0.55) / 0.45;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, minDim * 0.5 * bloom);
      g.addColorStop(0, withAlpha('#ffffff', 0.5 * (1 - bloom) * globalAlpha));
      g.addColorStop(1, withAlpha('#ffffff', 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, minDim * 0.5 * bloom, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  // faint vignette on top
  const vig = ctx.createRadialGradient(cx, cy, minDim * 0.35, cx, cy, minDim * 0.75);
  vig.addColorStop(0, withAlpha(PALETTE.void, 0));
  vig.addColorStop(1, withAlpha(PALETTE.void, 0.55));
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  void t;
}
