import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

// REV-36 SPEC.md §2 D-7, amended by REV-40 -- the `Rev36` namespace is written
// by scripts/apply-rev36-i18n.mjs and then reshaped by
// scripts/apply-rev40-i18n.mjs. REV-36 shipped a simulated network pulse with
// honest "simulation" labels; REV-40 deleted the simulation itself, so the
// namespace now carries only the three-state vocabulary (loading / real rows /
// empty) plus the surviving chrome. This gate proves the same key set in all
// 20 locales, ICU tokens preserved per key, no empty string, no `[MISSING`
// placeholder, a per-locale drift ceiling so a positional L() slip that leaves
// English in a foreign slot cannot ship, and -- since REV-40 -- that the
// simulation label keys stay dead.

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
 * Keys whose English value is a short label that a handful of Latin-script
 * locales legitimately keep identical (a loanword, a one-word product term).
 * Kept explicit so the drift ceiling still catches a real positional slip.
 */
const IDENTICAL_ALLOWED = new Set<string>([
  // `shorts.sortTrending` used to be waived here; REV-40 deleted the key, and a
  // waiver for a key that no longer exists only hides the next real slip.
  'shorts.sortCatalogue', // "Catalogue" -- fr keeps it verbatim
  'exchange.market', // "Marktpuls" nl vs "Market pulse" differ, but keep room for one-word overlaps
]);

describe('REV-36 i18n', () => {
  const en = flatten(load('en').Rev36, '', {});
  const enKeys = Object.keys(en).sort();

  it('en carries exactly the Rev36 hyper-matrix namespace, no more and no less', () => {
    // Exact, not `>=`. A floor lets a lane bolt a key on without a locale sweep
    // and lets a deleted key's 19 foreign copies rot in place unnoticed; both
    // have happened here. Adding or removing a key is now a deliberate edit to
    // this list, which is the moment to check all 20 files.
    expect(enKeys).toEqual([
      'common.loading',
      'exchange.boardEmpty',
      'exchange.ledgerLive',
      'exchange.market',
      'exchange.marketEmpty',
      'exchange.topTheme',
      'exchange.traders24h',
      'exchange.trades24h',
      'exchange.volume24h',
      'shorts.account',
      'shorts.countsEmpty',
      'shorts.device',
      'shorts.feed',
      'shorts.feedEmpty',
      'shorts.sortCatalogue',
      'shorts.sortLabel',
      'shorts.sortMostLiked',
      'talk.roomEmpty',
    ]);
    expect(en['exchange.marketEmpty']).toContain('24 hours');
  });

  it('en carries the REV-40 three-state vocabulary (loading / data / empty)', () => {
    for (const key of ['common.loading', 'shorts.feedEmpty', 'shorts.countsEmpty', 'talk.roomEmpty', 'exchange.marketEmpty', 'exchange.boardEmpty']) {
      expect(en[key], key).toBeTruthy();
    }
  });

  it('the REV-40 simulation label keys stay dead', () => {
    // REV-40 deleted the fabricated pulse; nothing may render a "simulation"
    // badge, a simulated-trade suffix, or a seeded {handle} reaction row again.
    const dead = [
      'pulse.label', 'pulse.sim', 'pulse.note', 'talk.pulseRoom',
      'shorts.feedLike', 'shorts.feedFollow', 'shorts.feedWatch', 'exchange.simTrade',
      // Fabricated-count and dead-rail labels: grep-verified to have zero
      // references left in components/, app/ and lib/. Their DOM carriers went
      // with the simulation, so a surviving string is just an invitation to
      // render a number nothing measures.
      'shorts.watching', 'shorts.trending', 'shorts.sortTrending',
      'shorts.reactionsEmpty', 'shorts.reactionsLive', 'shorts.reactionsLoading',
      'talk.presence',
      'exchange.demand', 'exchange.momentumUp', 'exchange.momentumFlat', 'exchange.momentumDown',
      // NOT dead: `talk.roomEmpty`. ThemeChatRooms.tsx reads `Rev29.rooms.empty`
      // for its own empty state, so this key reads as orphaned -- but the
      // three-state contract above asserts it truthy. It stays.
    ];
    for (const key of dead) expect(enKeys, key).not.toContain(key);
    for (const locale of routing.locales) {
      // The delete has to land in all 20 files, not just en -- a stale foreign
      // copy is how a deleted string finds its way back into a future SET.
      expect(Object.keys(flatten(load(locale).Rev36, '', {})).sort(), locale).toEqual(enKeys);
    }
    expect(Object.prototype.hasOwnProperty.call(load('en').Rev36 as object, 'pulse')).toBe(false);
  });

  it.each(routing.locales)('%s has the exact Rev36 key set with ICU tokens preserved, no empty strings and no placeholders', (locale) => {
    const flat = flatten(load(locale).Rev36, '', {});
    expect(Object.keys(flat).sort()).toEqual(enKeys);
    for (const key of enKeys) {
      expect(icu(flat[key]), `${locale}:${key}`).toBe(icu(en[key]));
      expect(flat[key].trim().length, `${locale}:${key}`).toBeGreaterThan(0);
      expect(flat[key].includes('[MISSING'), `${locale}:${key}`).toBe(false);
    }
  });

  it.each(routing.locales.filter((l) => l !== 'en'))('%s is actually translated (not a positional L() slip)', (locale) => {
    const flat = flatten(load(locale).Rev36, '', {});
    const identical = enKeys.filter((k) => !IDENTICAL_ALLOWED.has(k) && flat[k] === en[k]);
    const allowed = Math.floor(enKeys.length * 0.08);
    expect(identical.length, `${locale}: ${identical.slice(0, 5).join(', ')}`).toBeLessThanOrEqual(allowed);
  });
});

// KnowledgeExchange.tsx binds `useTranslations('Rev40')` for the market bar and
// the seller board's loading/empty copy, so the same parity contract has to
// hold for that namespace too -- otherwise a locale silently renders the raw
// `Rev40.exchange.marketEmpty` key string to a real visitor.
describe('REV-40 i18n', () => {
  const en = flatten(load('en').Rev40, '', {});
  const enKeys = Object.keys(en).sort();

  it('en carries the loading/empty/unreadable copy the hub actually reads', () => {
    expect(enKeys).toEqual([
      'exchange.boardEmpty',
      'exchange.boardLoading',
      'exchange.boardUnreadable',
      'exchange.marketEmpty',
      'exchange.marketLoading',
      'exchange.marketUnreadable',
      'exchange.sortLabel',
      'shorts.countsUnreadable',
    ]);
  });

  it('the signed-out state says why the figure is absent, never a fabricated zero', () => {
    // A signed-out visitor must not be told "No trades in the last 24 hours." --
    // that is a claim about the world the page cannot make. These three say the
    // number is unreadable, which is the truth.
    for (const key of ['exchange.marketUnreadable', 'exchange.boardUnreadable', 'shorts.countsUnreadable']) {
      expect(en[key], key).toBeTruthy();
      expect(en[key], key).not.toBe(en[key.replace('Unreadable', 'Empty')]);
    }
  });

  it.each(routing.locales)('%s has the exact Rev40 key set, translated, with no placeholders', (locale) => {
    const flat = flatten(load(locale).Rev40, '', {});
    expect(Object.keys(flat).sort()).toEqual(enKeys);
    for (const key of enKeys) {
      expect(icu(flat[key]), `${locale}:${key}`).toBe(icu(en[key]));
      expect(flat[key].trim().length, `${locale}:${key}`).toBeGreaterThan(0);
      expect(flat[key].includes('[MISSING'), `${locale}:${key}`).toBe(false);
      if (locale !== 'en') expect(flat[key], `${locale}:${key}`).not.toBe(en[key]);
    }
  });
});
