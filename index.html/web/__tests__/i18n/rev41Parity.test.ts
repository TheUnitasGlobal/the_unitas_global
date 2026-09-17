import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

// REV-41 SPEC.md §2 D-9, §4 -- the `Rev41` namespace is written by
// scripts/apply-rev41-i18n.mjs (deep-merge SET of the FX compass, the
// Around-Me omni-radar and the sub-theme chip strings, plus two `Rev20`
// VALUE replacements), and the same applicator DELETES the root namespace
// `Rev35`, whose only reader (the carousel's uRanking branch) is retired by
// D-7. This gate proves every half in all 20 locales: the exact key set, ICU
// tokens preserved per key, no empty string, no `[MISSING` placeholder, a
// per-locale drift ceiling so a positional L() slip that leaves English in a
// foreign slot cannot ship, the three retired namespaces absent everywhere
// (inherited from rev35Parity, which this file replaces), and the two `Rev20`
// tags actually rewritten rather than merely re-saved.

function load(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8')) as Record<string, unknown>;
}

/** Flatten to leaf strings; array elements become `path.<index>`. */
function flatten(obj: unknown, prefix: string, out: Record<string, string>): Record<string, string> {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}.${i}`, out));
    return out;
  }
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') out[prefix] = obj;
    return out;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    flatten(value, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

const icu = (s: string) => (s.match(/\{[^}]*\}/g) ?? []).slice().sort().join('|');

/**
 * Keys whose value legitimately stays byte-identical to en in every locale
 * (SPEC §4 "IDENTICAL 허용"): the three SI radius chips and the source line,
 * which is nothing but proper nouns (Frankfurter, ECB, CoinGecko, GeoJS).
 * `fx.perUnit` ("1 {base} = {value} {quote}") is NOT waived on purpose: it is
 * a pure ICU formula that reads the same in every script, so it spends one
 * slot of the 8% ceiling below instead of hiding behind a waiver -- a real
 * positional slip still has to fit in what is left.
 */
const IDENTICAL_ALLOWED = new Set<string>([
  'nearby.radius.r10',
  'nearby.radius.r50',
  'nearby.radius.r100',
  'fx.source',
]);

/**
 * Root namespaces retired across revisions; each applicator deleted its own
 * and nothing may re-add them (REV-35 M1: the world/unitas ranking panels;
 * REV-41 D-7: the uRanking slot tag).
 */
const RETIRED_NAMESPACES = ['GlobalRankings', 'UnitasRankings', 'Rev35'] as const;

function get(tree: Record<string, unknown>, dotted: string): unknown {
  let node: unknown = tree;
  for (const p of dotted.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[p];
  }
  return node;
}

describe('REV-41 i18n', () => {
  const en = flatten(load('en').Rev41, '', {});
  const enKeys = Object.keys(en).sort();

  it('en carries exactly the Rev41 namespace of SPEC §4, no more and no less', () => {
    // Exact, not `>=`. A floor lets a lane bolt a key on without a locale
    // sweep and lets a deleted key's 19 foreign copies rot in place; adding
    // or removing a key is a deliberate edit to this list, which is the
    // moment to check all 20 files.
    expect(enKeys).toEqual([
      'fx.change24h',
      'fx.change30d',
      'fx.dollarIndex',
      'fx.dollarIndexNote',
      'fx.facts.home',
      'fx.facts.pairs',
      'fx.gold',
      'fx.homeLabel',
      'fx.majors',
      'fx.parity',
      'fx.perUnit',
      'fx.source',
      'fx.sparkAria',
      'fx.unreadable',
      'nearby.center',
      'nearby.constellation',
      'nearby.constellationNote',
      'nearby.empty',
      'nearby.exact',
      'nearby.facts.beams',
      'nearby.facts.detected',
      'nearby.facts.nearest',
      'nearby.facts.radius',
      'nearby.lens.factory',
      'nearby.lens.inspiration',
      'nearby.lens.nomad',
      'nearby.lens.signal',
      'nearby.radarAria',
      'nearby.radius.global',
      'nearby.radius.r10',
      'nearby.radius.r100',
      'nearby.radius.r50',
      'nearby.radiusAria',
      'nearby.unreadable',
      'tabs.held',
      'tabs.rotating',
    ]);
  });

  it('en carries the ICU arguments the widgets interpolate and the honest empty/unreadable states', () => {
    expect(icu(en['fx.perUnit'])).toBe('{base}|{quote}|{value}');
    expect(icu(en['fx.sparkAria'])).toBe('{quote}');
    expect(icu(en['nearby.radarAria'])).toBe('{center}|{radius}');
    // D-5 / D-8: unreadable is a different sentence from empty -- "nothing
    // within this radius" is a claim about the world, "cannot read" is the truth
    // when every beam failed.
    expect(en['nearby.unreadable']).not.toBe(en['nearby.empty']);
    expect(en['fx.source']).toBe('Frankfurter (ECB) · CoinGecko · GeoJS');
    expect(en['nearby.constellation']).toContain('UNITAS');
  });

  it.each(routing.locales)('%s has the exact Rev41 key set with ICU tokens preserved, no empty strings and no placeholders', (locale) => {
    const flat = flatten(load(locale).Rev41, '', {});
    expect(Object.keys(flat).sort()).toEqual(enKeys);
    for (const key of enKeys) {
      expect(icu(flat[key]), `${locale}:${key}`).toBe(icu(en[key]));
      expect(flat[key].trim().length, `${locale}:${key}`).toBeGreaterThan(0);
      expect(flat[key].includes('[MISSING'), `${locale}:${key}`).toBe(false);
    }
  });

  it.each(routing.locales)('%s keeps the radius chips and the source line verbatim (SPEC §4 IDENTICAL)', (locale) => {
    const flat = flatten(load(locale).Rev41, '', {});
    for (const key of IDENTICAL_ALLOWED) expect(flat[key], `${locale}:${key}`).toBe(en[key]);
  });

  it.each(routing.locales.filter((l) => l !== 'en'))('%s is actually translated (not a positional L() slip)', (locale) => {
    const flat = flatten(load(locale).Rev41, '', {});
    const identical = enKeys.filter((k) => !IDENTICAL_ALLOWED.has(k) && flat[k] === en[k]);
    // The same 8% ceiling rev34/35/36Parity use: floor(36 * 0.08) = 2.
    const allowed = Math.floor(enKeys.length * 0.08);
    expect(identical.length, `${locale}: ${identical.slice(0, 5).join(', ')}`).toBeLessThanOrEqual(allowed);
  });

  it.each(routing.locales)('%s no longer carries the retired GlobalRankings / UnitasRankings / Rev35 namespaces', (locale) => {
    const messages = load(locale);
    for (const ns of RETIRED_NAMESPACES) {
      expect(ns in messages, `${locale}:${ns}`).toBe(false);
    }
  });
});

// D-6 / D-9 replace two `Rev20.slots.*.tag` VALUES without touching the key
// set (rev20Parity's fixed 76). A value swap cannot be caught by a key-set
// gate, so these guards pin what the new copy must no longer say.
describe('REV-41 Rev20 tag rewrites', () => {
  it.each(routing.locales)('%s newProducts.tag is one philosophical line, not the 16-family roll call', (locale) => {
    const tag = get(load(locale), 'Rev20.slots.newProducts.tag');
    expect(typeof tag, locale).toBe('string');
    expect(tag as string, `${locale}: still enumerates the families`).not.toMatch(/16/);
    expect((tag as string).trim().length, locale).toBeGreaterThan(0);
  });

  it('en / ko newProducts.tag no longer names the first family', () => {
    expect(get(load('en'), 'Rev20.slots.newProducts.tag') as string).not.toMatch(/\bcars\b/i);
    expect(get(load('ko'), 'Rev20.slots.newProducts.tag') as string).not.toContain('자동차');
  });

  it.each(routing.locales)('%s nearby.tag no longer promises a fixed 10km radius (the radius is a toggle now)', (locale) => {
    const tag = get(load(locale), 'Rev20.slots.nearby.tag');
    expect(typeof tag, locale).toBe('string');
    expect(tag as string, locale).not.toMatch(/10\s?km/i);
    expect((tag as string).trim().length, locale).toBeGreaterThan(0);
  });
});
