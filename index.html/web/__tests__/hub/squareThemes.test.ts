import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routing } from '@/i18n/routing';
import { MODULE_REGISTRY } from '@/lib/module-registry';
import {
  SQUARE_DEFAULT_THEME,
  SQUARE_EPOCH_DAY,
  SQUARE_ICONS,
  SQUARE_STOP_MS,
  SQUARE_THEME_KEYS,
  SQUARE_THEMES,
  isSquareThemeKey,
  squareDomKey,
  squareSignalValue,
  squareTheme,
  squareThemeForDomKey,
  readLastSquareTheme,
  type SquareLegacyTab,
  type SquareSignalInput,
  type SquareSignalKey,
  type SquareThemeKey,
} from '@/lib/square/themes';

// REV-34 MISSION 4-A/4-B -- UNITAS SQUARE: the descriptor table's invariants
// (blueprint D-10/D-11) and the 20-locale copy the panels read (D-13).

/** Founder's fixed order (SPEC.md §2 D-10). */
const FIXED_ORDER: SquareThemeKey[] = [
  'uRanking', 'uShorts', 'uTalk', 'uExchange', 'uSocial', 'uAcademy', 'uVenture', 'uOracle', 'uFactory', 'uCoin',
  'uGovernance', 'uNexus', 'uAkashic', 'uQuantum', 'uShield', 'uNomad', 'uChronos', 'uSpace', 'uVision', 'uMaster',
];

/** The six surviving REV-29/32 panels and the positions they keep (D-10: 1·2·3·4·5·12). */
const LEGACY_AT: Record<SquareLegacyTab, number> = { rankings: 1, shorts: 2, rooms: 3, exchange: 4, social: 5, swarm: 12 };

const SIGNAL_KEYS: SquareSignalKey[] = ['online', 'packs', 'coins', 'lockins', 'modules', 'axes', 'nodes', 'uptime', 'burn', 'sales', 'nomad', 'index'];

/** Routes that exist as app folders but are not modules (no coin gate). */
const INFRA_ROUTES = new Set(['u-ai', 'omni-swarm', 'sovereign']);

const KO_TABS = ['유랭킹', '유숏츠', '유토크', '유지식거래소', '유소셜미디어', '유아카데미', '유벤처', '유오라클', '유팩토리', '유코인', '유거버넌스', '유넥서스', '유아카식', '유퀀텀', '유실드', '유노마드', '유크로노스', '유스페이스', '유비전', '유마스터'];
const EN_TABS = ['U-Rankings', 'U-Shorts', 'U-Talk', 'U-Exchange', 'U-Social', 'U-Academy', 'U-Venture', 'U-Oracle', 'U-Factory', 'U-Coin', 'U-Governance', 'U-Nexus', 'U-Akashic', 'U-Quantum', 'U-Shield', 'U-Nomad', 'U-Chronos', 'U-Space', 'U-Vision', 'U-Master'];

const APP_DIR = join(__dirname, '../../app/[locale]');

type Tree = { [key: string]: string | Tree };

function load(locale: string): Tree {
  return JSON.parse(readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8')) as Tree;
}

function flatten(node: unknown, prefix = ''): Record<string, string> {
  if (typeof node === 'string') return prefix ? { [prefix]: node } : {};
  if (node === null || typeof node !== 'object') return {};
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return { ...acc, ...flatten(value, next) };
  }, {});
}

function get(tree: Tree, dotted: string): unknown {
  let node: unknown = tree;
  for (const p of dotted.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[p];
  }
  return node;
}

describe('SQUARE_THEMES descriptor table', () => {
  it('holds exactly the twenty themes in the founder order, numbered 1..20', () => {
    expect(SQUARE_THEMES).toHaveLength(20);
    expect(SQUARE_THEMES.map((t) => t.key)).toEqual(FIXED_ORDER);
    expect(SQUARE_THEME_KEYS).toEqual(FIXED_ORDER);
    expect(SQUARE_THEMES.map((t) => t.order)).toEqual(FIXED_ORDER.map((_, i) => i + 1));
    expect(SQUARE_DEFAULT_THEME).toBe('uRanking');
  });

  it('gives every theme a unique key, a unique icon and a colour pair', () => {
    expect(new Set(SQUARE_THEMES.map((t) => t.key)).size).toBe(20);
    expect(new Set(SQUARE_ICONS).size).toBe(20);
    expect(SQUARE_ICONS).toHaveLength(20);
    for (const theme of SQUARE_THEMES) {
      expect(theme.color, theme.key).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.glow, theme.key).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('keeps the six legacy panels at positions 1·2·3·4·5·12, each exactly once', () => {
    const legacy = SQUARE_THEMES.filter((t) => t.legacyTab);
    expect(legacy).toHaveLength(6);
    expect(new Set(legacy.map((t) => t.legacyTab)).size).toBe(6);
    for (const theme of legacy) {
      expect(theme.order, theme.key).toBe(LEGACY_AT[theme.legacyTab as SquareLegacyTab]);
    }
  });

  it('deep-links only to routes that already exist, with the gate flag mirroring the registry', () => {
    const byRoute = new Map(MODULE_REGISTRY.map((m) => [m.route, m]));
    for (const theme of SQUARE_THEMES) {
      const { route, gated } = theme.deepLink;
      const entry = byRoute.get(route);
      if (entry) {
        expect(gated, `${theme.key} -> ${route}`).toBe(entry.coinGated);
        expect(existsSync(join(APP_DIR, gated ? '(gated)' : '', route)), `${theme.key} -> ${route}`).toBe(true);
      } else {
        expect(INFRA_ROUTES.has(route), `${theme.key} -> ${route} is neither a module nor an infra route`).toBe(true);
        expect(gated, `${theme.key} -> ${route}`).toBe(false);
        expect(existsSync(join(APP_DIR, route)), `${theme.key} -> ${route}`).toBe(true);
      }
    }
  });

  it('shows exactly four valid signal tiles per theme and locks only uMaster', () => {
    for (const theme of SQUARE_THEMES) {
      expect(theme.signals, theme.key).toHaveLength(4);
      expect(new Set(theme.signals).size, theme.key).toBe(4);
      for (const key of theme.signals) expect(SIGNAL_KEYS, `${theme.key}:${key}`).toContain(key);
      expect(theme.founderOnly === true, theme.key).toBe(theme.key === 'uMaster');
    }
    expect(squareTheme('uMaster').deepLink.route).toBe('sovereign');
  });

  it('exposes the legacy key as DOM key for the six and the theme key for the fourteen', () => {
    for (const theme of SQUARE_THEMES) {
      const dom = squareDomKey(theme);
      expect(dom).toBe(theme.legacyTab ?? theme.key);
      expect(squareThemeForDomKey(dom)?.key).toBe(theme.key);
      expect(squareThemeForDomKey(theme.key)?.key).toBe(theme.key);
    }
    expect(squareThemeForDomKey('nope')).toBeNull();
    expect(squareThemeForDomKey(null)).toBeNull();
    expect(isSquareThemeKey('uNexus')).toBe(true);
    expect(isSquareThemeKey('swarm')).toBe(false);
    expect(squareTheme('uNexus').legacyTab).toBe('swarm');
  });

  it('keeps the attach-roll cadence', () => {
    expect(SQUARE_STOP_MS).toBe(2400);
  });
});

describe('squareSignalValue', () => {
  const input: SquareSignalInput = {
    dayIndex: SQUARE_EPOCH_DAY + 3,
    online: true,
    packs: 2,
    sales: 1,
    coins: 40,
    lockins: 3,
    modules: MODULE_REGISTRY.length,
    axes: 22,
    nodes: 7,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the real local state back verbatim', () => {
    expect(squareSignalValue('online', input)).toBe('live');
    expect(squareSignalValue('online', { ...input, online: false })).toBe('local');
    expect(squareSignalValue('packs', input)).toBe(2);
    expect(squareSignalValue('sales', input)).toBe(1);
    expect(squareSignalValue('coins', input)).toBe(40);
    expect(squareSignalValue('coins', { ...input, coins: null })).toBeNull();
    expect(squareSignalValue('lockins', input)).toBe(3);
    expect(squareSignalValue('modules', input)).toBe(MODULE_REGISTRY.length);
    expect(squareSignalValue('axes', input)).toBe(22);
    expect(squareSignalValue('nodes', input)).toBe(7);
    expect(squareSignalValue('uptime', input)).toBe(3);
    expect(squareSignalValue('uptime', { ...input, dayIndex: SQUARE_EPOCH_DAY - 9 })).toBe(0);
  });

  it('seeds the three doctrine indices by day, inside their bands, never from Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    for (let day = SQUARE_EPOCH_DAY; day < SQUARE_EPOCH_DAY + 400; day += 1) {
      const burn = squareSignalValue('burn', { ...input, dayIndex: day }) as number;
      const nomad = squareSignalValue('nomad', { ...input, dayIndex: day }) as number;
      const index = squareSignalValue('index', { ...input, dayIndex: day }) as number;
      expect(burn).toBeGreaterThanOrEqual(96);
      expect(burn).toBeLessThanOrEqual(99);
      expect(nomad).toBeGreaterThanOrEqual(12);
      expect(nomad).toBeLessThanOrEqual(99);
      expect(index).toBeGreaterThanOrEqual(1000);
      expect(index).toBeLessThanOrEqual(1499);
      expect(squareSignalValue('index', { ...input, dayIndex: day })).toBe(index);
    }
    expect(random).not.toHaveBeenCalled();
    expect(squareSignalValue('index', input)).not.toBe(squareSignalValue('index', { ...input, dayIndex: input.dayIndex + 1 }));
  });

  it('falls back to the default theme without a window (SSR)', () => {
    expect(typeof window).toBe('undefined');
    expect(readLastSquareTheme()).toBe(SQUARE_DEFAULT_THEME);
  });
});

describe('Rev34.square copy (20 locales)', () => {
  const LOCALES = routing.locales;
  const en = load('en');
  const enSquare = flatten(en.Rev34 && (en.Rev34 as Tree).square, 'Rev34.square');

  it('en.json carries the header, hint, lock and signal copy', () => {
    for (const key of ['title', 'lede', 'toggleAria', 'swipeHint', 'lastTheme', 'founderOnly', 'locked', 'signals.live', 'signals.local']) {
      expect(typeof get(en, `Rev34.square.${key}`), key).toBe('string');
    }
    for (const key of SIGNAL_KEYS) expect(typeof get(en, `Rev34.square.signals.${key}`), key).toBe('string');
    expect(get(en, 'Rev34.square.title')).toBe('UNITAS SQUARE (U-Square)');
    expect(get(en, 'Rev34.square.lede')).toBe(
      'A cosmic multidimensional nexus where infinite intelligence intersects and perpetual value expands — twenty hyper-themes resonating in one square.',
    );
  });

  it('en.json carries tab, lede, three features and a CTA for every theme', () => {
    for (const theme of SQUARE_THEMES) {
      for (const leaf of ['tab', 'lede', 'features.0', 'features.1', 'features.2', 'cta']) {
        expect(typeof get(en, `Rev34.square.themes.${theme.key}.${leaf}`), `${theme.key}.${leaf}`).toBe('string');
      }
    }
    expect(Object.keys(enSquare)).toHaveLength(7 + SIGNAL_KEYS.length + 2 + 20 * 6);
    expect(SQUARE_THEMES.map((t) => get(en, `Rev34.square.themes.${t.key}.tab`))).toEqual(EN_TABS);
  });

  it('ko.json carries the founder’s exact tab labels and the D-13 lede', () => {
    const ko = load('ko');
    expect(SQUARE_THEMES.map((t) => get(ko, `Rev34.square.themes.${t.key}.tab`))).toEqual(KO_TABS);
    expect(get(ko, 'Rev34.square.lede')).toBe(
      '무한한 지성이 교차하고 영속적 가치가 팽창하는 코스믹 다차원 넥서스 — 스무 개의 하이퍼-테마가 하나의 광장에서 공명합니다.',
    );
  });

  for (const locale of LOCALES) {
    it(`locale ${locale}: exact Rev34.square key set, real strings, U-Square in Rev29.hub`, () => {
      const tree = load(locale);
      const square = flatten(tree.Rev34 && (tree.Rev34 as Tree).square, 'Rev34.square');
      expect(Object.keys(square).sort()).toEqual(Object.keys(enSquare).sort());
      for (const [key, value] of Object.entries(square)) {
        expect(value.trim().length, key).toBeGreaterThan(0);
        expect(value, key).not.toContain('[MISSING');
      }
      // Rev29.hub keeps its key set (D-10) but its header values now say U-Square.
      expect(get(tree, 'Rev29.hub.title')).toBe('UNITAS SQUARE (U-Square)');
      expect(get(tree, 'Rev29.hub.lede')).toBe(get(tree, 'Rev34.square.lede'));
      expect(get(tree, 'Rev29.hub.toggleAria')).toBe(get(tree, 'Rev34.square.toggleAria'));
      expect(typeof get(tree, 'Rev29.hub.tabs.swarm')).toBe('string');
    });
  }
});
