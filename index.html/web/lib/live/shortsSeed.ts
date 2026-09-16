/**
 * UNITAS Shorts seed catalogue (pure, deterministic). Retired in REV-20
 * §7.1, REVIVED in REV-29 MISSION 4 (founder directive 2026-09-15) as the
 * "UNITAS 숏츠" panel of the UNITAS master hub.
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
 *
 * REV-29: every clip is tagged with one of the 22 live-news axes
 * (lib/live/hotNews.ts) instead of the REV-19 hub themes REV-23 deleted, so
 * the hub's shorts, chat rooms and news share ONE theme vocabulary.
 */
import type { HotNewsCategory } from '@/lib/live/hotNews';

export interface ShortSeed {
  id: string;
  title: string;
  handle: string;
  /** Poster gradient (two stops) -- no image asset, no fetch. */
  hue: [number, number];
  /** Seconds. */
  duration: number;
  theme: HotNewsCategory;
}

export interface ShortStats {
  views: number;
  likes: number;
  followers: number;
}

export const SHORTS_STORAGE_KEY = 'unitas.shorts.v2';

export const SHORTS_SEED: readonly ShortSeed[] = [
  { id: 'aurora-run', title: 'Speedrun at dawn — the last 12 seconds', handle: 'nomad.kai', hue: [262, 200], duration: 34, theme: 'technology' },
  { id: 'corner-kick', title: 'The corner kick nobody saw coming', handle: 'pitch.side', hue: [22, 42], duration: 21, theme: 'sports' },
  { id: 'one-take', title: 'One take. No cuts. Rain on the lens.', handle: 'frame.zero', hue: [340, 290], duration: 58, theme: 'culture' },
  { id: 'page-turn', title: 'The chapter that broke the internet', handle: 'ink.and.echo', hue: [44, 30], duration: 27, theme: 'expression' },
  { id: 'drop-alert', title: 'Unboxed in 15 seconds — worth it?', handle: 'cart.mind', hue: [164, 190], duration: 15, theme: 'pragma' },
  { id: 'open-bell', title: 'Opening bell, explained with coins', handle: 'quiet.ledger', hue: [218, 240], duration: 41, theme: 'economy' },
  { id: 'panel-swipe', title: 'Drawing panel 47 in real time', handle: 'lineweight', hue: [190, 170], duration: 49, theme: 'art' },
  { id: 'silhouette', title: 'Three silhouettes before the season', handle: 'hem.line', hue: [300, 330], duration: 19, theme: 'society' },
  { id: 'night-market', title: 'Night market, one bite each stall', handle: 'steam.rising', hue: [38, 12], duration: 52, theme: 'pragma' },
  { id: 'boss-phase', title: 'Phase two starts when the music stops', handle: 'nomad.kai', hue: [250, 210], duration: 30, theme: 'technology' },
  { id: 'lab-bench', title: 'The reaction that glows for exactly 4 seconds', handle: 'bench.notes', hue: [200, 150], duration: 24, theme: 'science' },
  { id: 'ward-round', title: 'What a night shift sounds like at 3am', handle: 'ward.seven', hue: [172, 140], duration: 37, theme: 'health' },
  { id: 'chalk-line', title: 'A theorem in one chalk line', handle: 'proof.sketch', hue: [230, 260], duration: 22, theme: 'education' },
  { id: 'city-grid', title: 'The power grid, seen from the roof', handle: 'span.wire', hue: [28, 60], duration: 45, theme: 'structure' },
  // REV-36 M3: coverage to two clips per axis (44 total). Handles are all
  // drawn from lib/square/pulse.ts PULSE_HANDLES so the same creators appear
  // across shorts, the exchange and the rooms. Titles stay brand-neutral.
  { id: 'ballot-dawn', title: 'The district that decides it all, at dawn', handle: 'frame.zero', hue: [350, 12], duration: 33, theme: 'politics' },
  { id: 'quiet-vote', title: 'The committee vote nobody filmed', handle: 'hem.line', hue: [8, 340], duration: 26, theme: 'politics' },
  { id: 'yield-whisper', title: 'The yield curve, whispering again', handle: 'quiet.ledger', hue: [214, 236], duration: 38, theme: 'economy' },
  { id: 'null-result', title: 'A null result you can actually trust', handle: 'bench.notes', hue: [196, 152], duration: 44, theme: 'science' },
  { id: 'weld-line', title: 'One weld, no way to check from outside', handle: 'span.wire', hue: [30, 58], duration: 29, theme: 'engineering' },
  { id: 'tunnel-bore', title: 'The bore head breaks through at 6am', handle: 'bench.notes', hue: [206, 160], duration: 41, theme: 'engineering' },
  { id: 'overtime-legs', title: 'The last fifteen minutes decide it', handle: 'pitch.side', hue: [20, 44], duration: 23, theme: 'sports' },
  { id: 'festival-slot', title: 'The festival slot that changed a career', handle: 'frame.zero', hue: [332, 288], duration: 47, theme: 'culture' },
  { id: 'wall-behind', title: 'The colour shifts when the wall changes', handle: 'lineweight', hue: [188, 168], duration: 35, theme: 'art' },
  { id: 'three-sentences', title: 'Three plain sentences broke the internet', handle: 'ink.and.echo', hue: [46, 28], duration: 19, theme: 'expression' },
  { id: 'last-speaker', title: 'A field kit for the last speakers', handle: 'steam.rising', hue: [40, 14], duration: 52, theme: 'language' },
  { id: 'loanword', title: 'Every loanword is a trade route', handle: 'ink.and.echo', hue: [50, 32], duration: 27, theme: 'language' },
  { id: 'third-place', title: 'The corner cafe that held the neighbourhood', handle: 'hem.line', hue: [300, 330], duration: 31, theme: 'society' },
  { id: 'substation', title: 'One substation, a whole city on it', handle: 'span.wire', hue: [26, 62], duration: 43, theme: 'structure' },
  { id: 'gavel-echo', title: 'Courtroom vocabulary in five languages', handle: 'ink.and.echo', hue: [220, 250], duration: 36, theme: 'law' },
  { id: 'the-dissent', title: 'The dissent that becomes next decade’s law', handle: 'proof.sketch', hue: [232, 262], duration: 40, theme: 'law' },
  { id: 'org-chart', title: 'The org chart is a rumour; the budget is truth', handle: 'quiet.ledger', hue: [210, 190], duration: 28, theme: 'institution' },
  { id: 'audit-room', title: 'What an audit actually finds', handle: 'cart.mind', hue: [166, 192], duration: 34, theme: 'institution' },
  { id: 'teach-it-back', title: 'A theorem in one chalk line', handle: 'proof.sketch', hue: [228, 258], duration: 22, theme: 'education' },
  { id: 'safety-net', title: 'A safety net you can actually reach', handle: 'ward.seven', hue: [170, 138], duration: 37, theme: 'welfare' },
  { id: 'waiting-list', title: 'The waiting list nobody voted for', handle: 'hem.line', hue: [304, 334], duration: 30, theme: 'welfare' },
  { id: 'night-shift', title: 'What a night shift sounds like at 3am', handle: 'ward.seven', hue: [174, 142], duration: 39, theme: 'health' },
  { id: 'patch-tuesday', title: 'The breach was the unpatched Tuesday', handle: 'bench.notes', hue: [200, 148], duration: 25, theme: 'security' },
  { id: 'least-privilege', title: 'Least privilege is the whole game', handle: 'nomad.kai', hue: [258, 214], duration: 32, theme: 'security' },
  { id: 'corridor-hours', title: 'A corridor measured in hours', handle: 'proof.sketch', hue: [234, 264], duration: 42, theme: 'conflict' },
  { id: 'frozen-front', title: 'The quiet front where the next flashpoint waits', handle: 'span.wire', hue: [24, 56], duration: 48, theme: 'conflict' },
  { id: 'sherpa-table', title: 'The sherpas wrote the treaty, not the summit', handle: 'hem.line', hue: [306, 336], duration: 33, theme: 'strategy' },
  { id: 'red-line', title: 'A red line only counts if they believe it', handle: 'frame.zero', hue: [348, 10], duration: 27, theme: 'strategy' },
  { id: 'ten-seconds', title: 'Early warning buys ten seconds, ten seconds save streets', handle: 'span.wire', hue: [22, 54], duration: 24, theme: 'disaster' },
  { id: 'evac-lane', title: 'The evacuation route is only as fast as its slowest lane', handle: 'ward.seven', hue: [168, 136], duration: 46, theme: 'disaster' },
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

/** Pure: the clips of one theme, catalogue order. */
export function shortsByTheme(theme: HotNewsCategory | 'all'): ShortSeed[] {
  return theme === 'all' ? [...SHORTS_SEED] : SHORTS_SEED.filter((s) => s.theme === theme);
}
