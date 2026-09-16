import {
  Archive,
  Atom,
  Boxes,
  Clapperboard,
  Coins,
  Crown,
  Factory,
  Globe2,
  GraduationCap,
  Hourglass,
  Landmark,
  MessagesSquare,
  Network,
  Orbit,
  Share2,
  ShieldCheck,
  Store,
  Telescope,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

/**
 * REV-34 M4-A (founder directive 2026-09-16) -- the UNITAS SQUARE (U-Square)
 * theme table: the ONE ordered list every square surface iterates.
 *
 * WHY a descriptor table instead of twenty components: the square grew from
 * six hub tabs to twenty fixed themes in one directive, and the six that
 * already have a real panel (rankings, shorts, rooms, exchange, social,
 * swarm) must keep their DOM contract (`data-hub-tab-btn=rankings` …) while
 * the fourteen new ones render from data (lede · live signal tiles · three
 * features · one CTA deep-link). One table gives the popup its tab order,
 * the master tile its 20-icon roll, the i18n applicator its key list and the
 * unit test its invariants -- nothing is counted twice.
 *
 * Deep-links only ever point at routes that already exist (`app/[locale]/*`
 * + MODULE_REGISTRY): the prebuild registry validator fails the build closed
 * on any route folder drift, so this table adds none. `gated` mirrors the
 * registry's coin gate -- the (gated) layout enforces the grant, the CTA
 * just links there.
 */
export type SquareThemeKey =
  | 'uRanking'
  | 'uShorts'
  | 'uTalk'
  | 'uExchange'
  | 'uSocial'
  | 'uAcademy'
  | 'uVenture'
  | 'uOracle'
  | 'uFactory'
  | 'uCoin'
  | 'uGovernance'
  | 'uNexus'
  | 'uAkashic'
  | 'uQuantum'
  | 'uShield'
  | 'uNomad'
  | 'uChronos'
  | 'uSpace'
  | 'uVision'
  | 'uMaster';

/** The six REV-29/32 hub panels that survive under their original DOM keys (D-10). */
export type SquareLegacyTab = 'rankings' | 'shorts' | 'rooms' | 'exchange' | 'social' | 'swarm';

/**
 * Live signal tiles a descriptor panel can show. Every one of them is read
 * from REAL local state (device ledger, wallet, lock-in set, registry sizes,
 * governance axes, swarm cache) or from the day-seeded index -- never a
 * random number (D-11).
 */
export type SquareSignalKey =
  | 'online'
  | 'packs'
  | 'coins'
  | 'lockins'
  | 'modules'
  | 'axes'
  | 'nodes'
  | 'uptime'
  | 'burn'
  | 'sales'
  | 'nomad'
  | 'index';

export interface SquareDeepLink {
  /** Route segment under `/<locale>/` -- must already exist. */
  route: string;
  /** True when the route sits behind the (gated) coin-grant layout. */
  gated: boolean;
}

export interface SquareTheme {
  key: SquareThemeKey;
  /** 1-based position in the founder's fixed order; also `data-square-tab`. */
  order: number;
  /** Present on the six themes that render an existing hub panel. */
  legacyTab?: SquareLegacyTab;
  icon: LucideIcon;
  color: string;
  glow: string;
  deepLink: SquareDeepLink;
  /** Exactly four tiles, in display order. */
  signals: readonly [SquareSignalKey, SquareSignalKey, SquareSignalKey, SquareSignalKey];
  /** uMaster only: public visitors see a locked state; the CTA needs the sovereign hint. */
  founderOnly?: boolean;
}

/** Roll cadence of the master tile (shared with the attach roll): 2.4 s per icon. */
export const SQUARE_STOP_MS = 2400;

export const SQUARE_THEMES: readonly SquareTheme[] = [
  { key: 'uRanking', order: 1, legacyTab: 'rankings', icon: Trophy, color: '#d4af37', glow: '#fde047', deepLink: { route: 'u-ai', gated: false }, signals: ['index', 'modules', 'burn', 'uptime'] },
  { key: 'uShorts', order: 2, legacyTab: 'shorts', icon: Clapperboard, color: '#f43f5e', glow: '#fda4af', deepLink: { route: 'u-ai', gated: false }, signals: ['online', 'uptime', 'index', 'modules'] },
  { key: 'uTalk', order: 3, legacyTab: 'rooms', icon: MessagesSquare, color: '#22d3ee', glow: '#67e8f9', deepLink: { route: 'u-ai', gated: false }, signals: ['online', 'axes', 'uptime', 'nodes'] },
  { key: 'uExchange', order: 4, legacyTab: 'exchange', icon: Store, color: '#f59e0b', glow: '#fde68a', deepLink: { route: 'u-pay', gated: false }, signals: ['packs', 'sales', 'coins', 'burn'] },
  { key: 'uSocial', order: 5, legacyTab: 'social', icon: Share2, color: '#3b82f6', glow: '#93c5fd', deepLink: { route: 'u-signature', gated: false }, signals: ['online', 'nomad', 'uptime', 'index'] },
  { key: 'uAcademy', order: 6, icon: GraduationCap, color: '#10b981', glow: '#6ee7b7', deepLink: { route: 'arche', gated: true }, signals: ['packs', 'axes', 'modules', 'uptime'] },
  { key: 'uVenture', order: 7, icon: TrendingUp, color: '#f97316', glow: '#fdba74', deepLink: { route: 'syndicate', gated: true }, signals: ['sales', 'coins', 'index', 'burn'] },
  { key: 'uOracle', order: 8, icon: Orbit, color: '#c084fc', glow: '#e9d5ff', deepLink: { route: 'oracle', gated: true }, signals: ['index', 'axes', 'uptime', 'nodes'] },
  { key: 'uFactory', order: 9, icon: Factory, color: '#a855f7', glow: '#d8b4fe', deepLink: { route: 'genesis', gated: true }, signals: ['modules', 'lockins', 'burn', 'nodes'] },
  { key: 'uCoin', order: 10, icon: Coins, color: '#eab308', glow: '#fef08a', deepLink: { route: 'u-pay', gated: false }, signals: ['coins', 'burn', 'packs', 'sales'] },
  { key: 'uGovernance', order: 11, icon: Landmark, color: '#8a97a0', glow: '#cbd5e1', deepLink: { route: 'codex22', gated: true }, signals: ['axes', 'modules', 'index', 'uptime'] },
  { key: 'uNexus', order: 12, legacyTab: 'swarm', icon: Network, color: '#06b6d4', glow: '#67e8f9', deepLink: { route: 'omni-swarm', gated: false }, signals: ['nodes', 'modules', 'online', 'uptime'] },
  { key: 'uAkashic', order: 13, icon: Archive, color: '#14b8a6', glow: '#5eead4', deepLink: { route: 'u-signature', gated: false }, signals: ['nodes', 'packs', 'uptime', 'index'] },
  { key: 'uQuantum', order: 14, icon: Atom, color: '#6366f1', glow: '#a5b4fc', deepLink: { route: 'paradox', gated: true }, signals: ['burn', 'index', 'nodes', 'modules'] },
  { key: 'uShield', order: 15, icon: ShieldCheck, color: '#60a5fa', glow: '#93c5fd', deepLink: { route: 'u-key', gated: false }, signals: ['lockins', 'online', 'uptime', 'index'] },
  { key: 'uNomad', order: 16, icon: Globe2, color: '#34d399', glow: '#6ee7b7', deepLink: { route: 'arena', gated: true }, signals: ['nomad', 'online', 'coins', 'lockins'] },
  { key: 'uChronos', order: 17, icon: Hourglass, color: '#d946ef', glow: '#f0abfc', deepLink: { route: 'chronos', gated: true }, signals: ['uptime', 'index', 'burn', 'axes'] },
  { key: 'uSpace', order: 18, icon: Boxes, color: '#8b5cf6', glow: '#c4b5fd', deepLink: { route: 'apex', gated: true }, signals: ['modules', 'nodes', 'index', 'uptime'] },
  { key: 'uVision', order: 19, icon: Telescope, color: '#b76e79', glow: '#f9a8d4', deepLink: { route: 'fate', gated: true }, signals: ['index', 'axes', 'sales', 'burn'] },
  { key: 'uMaster', order: 20, icon: Crown, color: '#d4af37', glow: '#fde68a', deepLink: { route: 'sovereign', gated: false }, signals: ['modules', 'axes', 'lockins', 'uptime'], founderOnly: true },
];

/** The 20 icons in theme order -- the master tile's roll track. */
export const SQUARE_ICONS: readonly LucideIcon[] = SQUARE_THEMES.map((t) => t.icon);

export const SQUARE_THEME_KEYS: readonly SquareThemeKey[] = SQUARE_THEMES.map((t) => t.key);

/** The first theme is the default tab (D-10: 기본 탭 = 1번 유랭킹). */
export const SQUARE_DEFAULT_THEME: SquareThemeKey = SQUARE_THEMES[0].key;

/** Per-viewer convenience: the last theme opened (localStorage, guarded). */
export const SQUARE_LAST_THEME_KEY = 'unitas.square.lastTheme.v1';

export function isSquareThemeKey(value: string | null | undefined): value is SquareThemeKey {
  return !!value && SQUARE_THEMES.some((t) => t.key === value);
}

export function squareTheme(key: SquareThemeKey): SquareTheme {
  return SQUARE_THEMES.find((t) => t.key === key) ?? SQUARE_THEMES[0];
}

/**
 * The DOM key a theme's tab and panel carry (`data-hub-tab-btn`,
 * `data-hub-panel`, `data-hub-tab`): the legacy key for the six surviving
 * panels, the theme key for everything else (D-10).
 */
export function squareDomKey(theme: SquareTheme): SquareLegacyTab | SquareThemeKey {
  return theme.legacyTab ?? theme.key;
}

/** Theme for a DOM key (legacy or theme key), or null. */
export function squareThemeForDomKey(domKey: string | null | undefined): SquareTheme | null {
  if (!domKey) return null;
  return SQUARE_THEMES.find((t) => squareDomKey(t) === domKey || t.key === domKey) ?? null;
}

/** SSR-safe read of the remembered theme; the default when absent or invalid. */
export function readLastSquareTheme(): SquareThemeKey {
  if (typeof window === 'undefined') return SQUARE_DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(SQUARE_LAST_THEME_KEY);
    return isSquareThemeKey(raw) ? raw : SQUARE_DEFAULT_THEME;
  } catch {
    return SQUARE_DEFAULT_THEME;
  }
}

/* ------------------------------------------------------------------ */
/* Signal tiles -- pure, unit-tested, no React                          */
/* ------------------------------------------------------------------ */

export const DAY_MS = 86_400_000;
/** UTC day the square went live (founder directive 2026-09-16) -- the uptime origin. */
export const SQUARE_EPOCH_DAY = Math.floor(Date.UTC(2026, 8, 16) / DAY_MS);

/** Everything a tile can be computed from, all read by the panel from local state. */
export interface SquareSignalInput {
  /** UTC day number (floor(now / DAY_MS)) -- from a state initialiser, never render-time Date.now(). */
  dayIndex: number;
  /** A live hub session exists (server ledger); false = this device only. */
  online: boolean;
  /** Knowledge packs owned on this device. */
  packs: number;
  /** Knowledge packs listed for sale on this device. */
  sales: number;
  /** Wallet balance; null while signed out / not loaded. */
  coins: number | null;
  /** Active lock-in modules on this device. */
  lockins: number;
  /** MODULE_REGISTRY size. */
  modules: number;
  /** GOVERNANCE_AXES size. */
  axes: number;
  /** Walked swarm subjects in the device cache. */
  nodes: number;
}

/**
 * A tile's value: a number, `'live' | 'local'` for the link state, or null
 * when the source is genuinely unknown (wallet not loaded). The three
 * doctrine indices (burn / nomad / index) are DAY-SEEDED (D-11): the same
 * day renders the same number on every device and every reload, and they
 * never touch Math.random.
 */
export type SquareSignalValue = number | 'live' | 'local' | null;

export function squareSignalValue(key: SquareSignalKey, input: SquareSignalInput): SquareSignalValue {
  switch (key) {
    case 'online':
      return input.online ? 'live' : 'local';
    case 'packs':
      return input.packs;
    case 'sales':
      return input.sales;
    case 'coins':
      return input.coins;
    case 'lockins':
      return input.lockins;
    case 'modules':
      return input.modules;
    case 'axes':
      return input.axes;
    case 'nodes':
      return input.nodes;
    case 'uptime':
      return Math.max(0, input.dayIndex - SQUARE_EPOCH_DAY);
    case 'burn':
      // micro-burn efficiency band 96–99 %, one step per day
      return 96 + ((input.dayIndex * 7) % 4);
    case 'nomad':
      // nomad contribution band 12–99, day-seeded
      return 12 + ((input.dayIndex * 13) % 88);
    case 'index':
      // sovereign index band 1000–1499, day-seeded
      return 1000 + ((input.dayIndex * 37) % 500);
  }
}

/** Unit suffix a tile appends after the number (empty = none). */
export const SQUARE_SIGNAL_UNIT: Readonly<Partial<Record<SquareSignalKey, string>>> = { burn: '%' };

export function writeLastSquareTheme(key: SquareThemeKey): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SQUARE_LAST_THEME_KEY, key);
  } catch {
    // storage unavailable -- the square simply reopens on the default theme.
  }
}
