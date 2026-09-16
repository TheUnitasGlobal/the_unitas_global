/**
 * REV-36 MISSION 3 -- 유숏츠 (U-Shorts) hyper matrix. The shorts rail was a
 * static seed catalogue with fixed counters; now every card carries a LIVE
 * count (views that only ever climb, current watchers, momentum) and the panel
 * shows a rolling pulse feed of likes / follows / watches from across the
 * network. All of it is deterministic from the 5-minute slot -- no fetch, no
 * Math.random, no render-time clock -- and honestly labelled as simulation.
 */
import { SHORTS_SEED, shortStats, type ShortSeed } from '@/lib/live/shortsSeed';
import { PULSE_SLOT_MS, intIn, mulberry32, pickHandle, pulseSlot, seedHash } from './pulse';

export interface ShortPulseStats {
  /** Cumulative view count -- monotonic non-decreasing as `now` advances. */
  views: number;
  /** Likes, 4-13 % of views (a fixed per-clip ratio). */
  likes: number;
  /** Cumulative followers of the creator -- monotonic non-decreasing. */
  followers: number;
  /** People watching this clip right now (3..180), changes each slot. */
  watching: number;
  /** Views gained over roughly the last hour -- the trend signal. */
  momentum: number;
}

/** Per-clip base growth slope (views per 5-min slot), fixed for the clip. */
function slope(short: ShortSeed): number {
  const rand = mulberry32(seedHash(`shorts-slope::${short.id}`));
  return intIn(rand, 3, 40);
}

/**
 * Pure: cumulative views at `slot`. base + slot*slope + wobble, where the
 * wobble is bounded strictly below the slope so consecutive slots always
 * increase -- views can never appear to go backwards on a reload.
 */
function viewsAt(short: ShortSeed, slot: number, per: number): number {
  const base = shortStats(short).views;
  const wobble = seedHash(`shorts-wobble::${short.id}::${slot}`) % per; // 0..per-1
  return base + slot * per + wobble;
}

/** Pure: the live stats for a clip at `now`. */
export function shortsPulseStats(short: ShortSeed, now: number): ShortPulseStats {
  const slot = pulseSlot(now);
  const per = slope(short);
  const views = viewsAt(short, slot, per);
  const ratioRand = mulberry32(seedHash(`shorts-ratio::${short.id}`));
  const ratio = 0.04 + ratioRand() * 0.09; // fixed per clip, 4-13 %
  const likes = Math.floor(views * ratio);
  const base = shortStats(short);
  const followers = base.followers + Math.floor((views - base.views) * 0.3);
  const watchRand = mulberry32(seedHash(`shorts-watch::${short.id}::${slot}`));
  const watching = intIn(watchRand, 3, 180);
  const prev = viewsAt(short, Math.max(0, slot - 12), per);
  const momentum = views - prev;
  return { views, likes, followers, watching, momentum };
}

/**
 * Pure: clips ordered by a trending score (current watchers weighted with
 * recent momentum), stable by id. Never mutates the input.
 */
export function shortsTrending(clips: readonly ShortSeed[], now: number): ShortSeed[] {
  return [...clips].sort((a, b) => {
    const sa = shortsPulseStats(a, now);
    const sb = shortsPulseStats(b, now);
    const scoreA = sa.watching * 2 + sa.momentum;
    const scoreB = sb.watching * 2 + sb.momentum;
    return scoreB - scoreA || a.id.localeCompare(b.id);
  });
}

export interface ShortsFeedEvent {
  id: string;
  kind: 'like' | 'follow' | 'watch';
  handle: string;
  shortId: string;
  at: number;
}

const FEED_KINDS: readonly ShortsFeedEvent['kind'][] = ['like', 'follow', 'watch'];

/**
 * Pure: the rolling activity strip -- `count` events within the last ~30
 * minutes, newest first, each referencing a real seed clip.
 */
export function shortsPulseFeed(now: number, count = 8): ShortsFeedEvent[] {
  const slot = pulseSlot(now);
  const rand = mulberry32(seedHash(`shorts-feed::${slot}`));
  const events: ShortsFeedEvent[] = [];
  // Bounded to the last ~28 minutes (spacing minus a sub-step jitter), newest
  // first, so the strip always reads as "just now".
  const spacing = Math.max(15_000, Math.floor((28 * 60_000) / count));
  let at = now - intIn(rand, 0, 60_000);
  for (let i = 0; i < count; i++) {
    const kind = FEED_KINDS[Math.floor(rand() * FEED_KINDS.length) % FEED_KINDS.length];
    const short = SHORTS_SEED[Math.floor(rand() * SHORTS_SEED.length) % SHORTS_SEED.length];
    events.push({ id: `sim:feed:${slot}:${i}`, kind, handle: pickHandle(rand), shortId: short.id, at });
    at -= spacing - intIn(rand, 0, Math.floor(spacing / 3));
  }
  return events;
}

export { PULSE_SLOT_MS };
