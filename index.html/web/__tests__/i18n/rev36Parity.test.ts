import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

// REV-36 SPEC.md §2 D-7 -- the `Rev36` namespace is written by
// scripts/apply-rev36-i18n.mjs (deep-merge SET of the U-Square hyper-matrix
// chrome: pulse labels, the market bar, the demand chip, the pulse feed). This
// gate proves the same key set in all 20 locales, ICU tokens preserved per
// key, no empty string, no `[MISSING` placeholder, and a per-locale drift
// ceiling so a positional L() slip that leaves English in a foreign slot
// cannot ship. The simulated CONTENT (chat phrases, clip titles) is
// deliberately NOT in i18n -- it is brand-neutral English in lib/, so nothing
// here has to translate a phrase table.

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
  'pulse.sim', // "simulation" -- fr keeps it verbatim
  'shorts.sortTrending', // "Trending" -- nl keeps it verbatim
  'shorts.sortCatalogue', // "Catalogue" -- fr keeps it verbatim
  'exchange.market', // "Marktpuls" nl vs "Market pulse" differ, but keep room for one-word overlaps
]);

describe('REV-36 i18n', () => {
  const en = flatten(load('en').Rev36, '', {});
  const enKeys = Object.keys(en).sort();

  it('en carries the whole Rev36 hyper-matrix namespace', () => {
    expect(enKeys.length).toBeGreaterThanOrEqual(26);
    expect(en['pulse.note']).toContain('5 minutes');
    expect(en['talk.presence']).toContain('{count}');
    expect(en['shorts.feedFollow']).toContain('{creator}');
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
