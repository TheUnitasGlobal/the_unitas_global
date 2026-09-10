/**
 * REV-19 §8 -- UNITAS Shorts seed catalogue (pure, deterministic).
 *
 * The Shorts rail is the UI architecture for vertical video sharing
 * (views / likes / follows) that seeds the U-Messenger ecosystem. There is
 * no upload pipeline yet (a serverless video ingest needs object storage,
 * transcoding and moderation that this repo does not run), so the rail is
 * populated from this seed catalogue -- HONESTLY labelled as seed clips in
 * the UI -- with counters derived from a seeded PRNG (FNV-1a + mulberry32,
 * never Math.random, so SSR and CSR agree) and the visitor's own like /
 * follow toggles persisted per device (localStorage). Titles/handles are
 * brand-neutral English strings shared by every locale (the same rule the
 * ranking catalogues follow).
 */

export interface ShortSeed {
  id: string;
  title: string;
  handle: string;
  /** Poster gradient (two stops) -- no image asset, no fetch. */
  hue: [number, number];
  /** Seconds. */
  duration: number;
  theme: 'game' | 'sports' | 'movie' | 'bestseller' | 'shopping' | 'stock' | 'webtoon' | 'fashion' | 'food';
}

export interface ShortStats {
  views: number;
  likes: number;
  followers: number;
}

export const SHORTS_STORAGE_KEY = 'unitas.shorts.v1';

export const SHORTS_SEED: readonly ShortSeed[] = [
  { id: 'aurora-run', title: 'Speedrun at dawn — the last 12 seconds', handle: 'nomad.kai', hue: [262, 200], duration: 34, theme: 'game' },
  { id: 'corner-kick', title: 'The corner kick nobody saw coming', handle: 'pitch.side', hue: [22, 42], duration: 21, theme: 'sports' },
  { id: 'one-take', title: 'One take. No cuts. Rain on the lens.', handle: 'frame.zero', hue: [340, 290], duration: 58, theme: 'movie' },
  { id: 'page-turn', title: 'The chapter that broke the internet', handle: 'ink.and.echo', hue: [44, 30], duration: 27, theme: 'bestseller' },
  { id: 'drop-alert', title: 'Unboxed in 15 seconds — worth it?', handle: 'cart.mind', hue: [164, 190], duration: 15, theme: 'shopping' },
  { id: 'open-bell', title: 'Opening bell, explained with coins', handle: 'quiet.ledger', hue: [218, 240], duration: 41, theme: 'stock' },
  { id: 'panel-swipe', title: 'Drawing panel 47 in real time', handle: 'lineweight', hue: [190, 170], duration: 49, theme: 'webtoon' },
  { id: 'silhouette', title: 'Three silhouettes before the season', handle: 'hem.line', hue: [300, 330], duration: 19, theme: 'fashion' },
  { id: 'night-market', title: 'Night market, one bite each stall', handle: 'steam.rising', hue: [38, 12], duration: 52, theme: 'food' },
  { id: 'boss-phase', title: 'Phase two starts when the music stops', handle: 'nomad.kai', hue: [250, 210], duration: 30, theme: 'game' },
];

function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pure: seeded view / like / follower counters for a short. */
export function shortStats(short: ShortSeed): ShortStats {
  const rand = mulberry32(hashString(`${short.id}|${short.handle}`));
  const views = 1200 + Math.floor(rand() * 98_000);
  const likes = Math.floor(views * (0.04 + rand() * 0.09));
  const followers = 300 + Math.floor(rand() * 42_000);
  return { views, likes, followers };
}

/** Pure: compact counter text ("12.4K"), locale-neutral. */
export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export interface ShortsPrefs {
  liked: string[];
  followed: string[];
}

export function readShortsPrefs(): ShortsPrefs {
  if (typeof window === 'undefined') return { liked: [], followed: [] };
  try {
    const raw = window.localStorage.getItem(SHORTS_STORAGE_KEY);
    if (!raw) return { liked: [], followed: [] };
    const parsed = JSON.parse(raw) as Partial<ShortsPrefs>;
    return {
      liked: Array.isArray(parsed.liked) ? parsed.liked.filter((x): x is string => typeof x === 'string') : [],
      followed: Array.isArray(parsed.followed) ? parsed.followed.filter((x): x is string => typeof x === 'string') : [],
    };
  } catch {
    return { liked: [], followed: [] };
  }
}

export function writeShortsPrefs(prefs: ShortsPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHORTS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // quota / private mode -- toggles stay in memory for the session.
  }
}

/** Pure: toggle membership. */
export function toggleMember(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
