/**
 * REV-36 MISSION 3 (founder directive 2026-09-16) -- the U-Square HYPER
 * MATRIX, shared half. The three square panels that already had a real
 * component (유숏츠 · 유토크 · 유지식거래소) open on data that BREATHES:
 * a simulated network pulse that changes every five minutes, on every device
 * identically, without a single network call.
 *
 * WHY a time-sliced deterministic matrix rather than random noise or a
 * server feed: the square must render the same on a cold reload, offline and
 * inside an in-app WebView (Codex ch.7), the marginal cost of opening a
 * panel must stay at zero (ch.1 Micro-Burn), and the server render and the
 * first client frame must agree byte for byte. So everything derives from
 * TWO integers -- the 5-minute slot since the ignition epoch and the UTC day
 * -- through the house seed hash (FNV-1a with the MurmurHash3 fmix32
 * finisher, lib/square/uRankings.ts) and mulberry32. Callers pass `now`;
 * nothing in lib/square/* ever reads the clock or Math.random.
 *
 * The pulse is labelled as a simulation wherever it is rendered
 * (`Rev36.pulse.sim`, `data-*-sim="1"`): a visitor's own actions and the
 * account ledger (lib/hub/hubLedger.ts) are the real thing; the pulse is the
 * living background they land in.
 */

/** One pulse slot: the cadence at which every simulated stream advances. */
export const PULSE_SLOT_MS = 300_000;

/** UTC midnight of the ignition day (2026-09-16) -- slot 0 of every stream. */
export const PULSE_EPOCH_MS = Date.UTC(2026, 8, 16);

export const DAY_MS = 86_400_000;

/** Slot index of `now` (0 before the epoch). */
export function pulseSlot(now: number): number {
  return Math.max(0, Math.floor((now - PULSE_EPOCH_MS) / PULSE_SLOT_MS));
}

/** UTC day number of `now` -- the same convention as SquareThemePanel / uRankings. */
export function dayIndexOf(now: number): number {
  return Math.floor(now / DAY_MS);
}

/**
 * FNV-1a 32-bit followed by the MurmurHash3 fmix32 finisher (house
 * convention): neighbouring seeds such as `x::1` and `x::2` land far apart,
 * so per-slot draws never drift in lock-step.
 */
export function seedHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32: a tiny, fast, well-distributed PRNG seeded by one uint32. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] (inclusive) from one draw. */
export function intIn(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/** One element of a non-empty list from one draw. */
export function pickOne<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length) % list.length];
}

/**
 * The pseudonymous handle pool every simulated stream draws from. The first
 * thirteen are the creators/sellers the REV-29 seed catalogues already use
 * (lib/live/shortsSeed.ts, lib/hub/knowledgeExchange.ts), so the same people
 * appear to like, follow, trade and talk across the three panels. Every
 * handle matches /^[a-z0-9.]+$/ -- the chat, exchange and reaction RPCs all
 * validate that shape.
 */
export const PULSE_HANDLES: readonly string[] = [
  'nomad.kai',
  'pitch.side',
  'frame.zero',
  'ink.and.echo',
  'cart.mind',
  'quiet.ledger',
  'lineweight',
  'hem.line',
  'steam.rising',
  'bench.notes',
  'ward.seven',
  'proof.sketch',
  'span.wire',
  'aria.loop',
  'blue.margin',
  'cobalt.fern',
  'dawn.ledger',
  'echo.harbor',
  'fig.and.salt',
  'glass.meridian',
  'halo.stack',
  'iris.vector',
  'juniper.grid',
  'kite.signal',
  'lumen.forge',
  'moss.orbit',
  'north.quill',
  'ochre.wave',
  'paper.comet',
  'quartz.note',
  'river.index',
  'saffron.byte',
  'tidal.mark',
  'umber.field',
  'velvet.axis',
  'wren.circuit',
  'xeno.leaf',
  'yarrow.dot',
  'zenith.pale',
  'opal.static',
];

/** One handle from the pool. */
export function pickHandle(rand: () => number): string {
  return pickOne(rand, PULSE_HANDLES);
}

/** A handle from the pool that differs from `avoid` (re-draws once, then steps). */
export function pickHandleUnlike(rand: () => number, avoid: string | null): string {
  const first = pickHandle(rand);
  if (first !== avoid) return first;
  const i = PULSE_HANDLES.indexOf(first);
  return PULSE_HANDLES[(i + 1) % PULSE_HANDLES.length];
}
