import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

// REV-35 SPEC.md §2 D-7 -- the `Rev35` namespace is written by
// scripts/apply-rev35-i18n.mjs (deep-merge SET of `Rev35.uRanking.tag`, the
// discovery carousel's U-Ranking slot tag line). The same applicator DELETES
// the root namespaces `GlobalRankings` and `UnitasRankings`, whose readers
// (the retired world/unitas ranking panels and the ranking-detail API) are
// gone in this revision. This gate proves both halves in all 20 locales: the
// exact key set, ICU tokens preserved, no empty string, no `[MISSING`
// placeholder, a per-locale drift ceiling against a positional L() slip, and
// the two orphan namespaces absent everywhere so the 41 dead strings cannot
// creep back through i18n:sync.

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
 * Keys whose English value is a proper noun / token that legitimately stays
 * identical. Empty today: the single Rev35 string is a full sentence that
 * every locale must render in its own language.
 */
const IDENTICAL_ALLOWED = new Set<string>([]);

/** Root namespaces REV-35 M1 retired; the applicator deletes them and nothing may re-add them. */
const RETIRED_NAMESPACES = ['GlobalRankings', 'UnitasRankings'] as const;

describe('REV-35 i18n', () => {
  const en = flatten(load('en').Rev35, '', {});
  const enKeys = Object.keys(en).sort();

  it('en carries the U-Ranking slot tag', () => {
    expect(enKeys).toEqual(['uRanking.tag']);
    expect(en['uRanking.tag']).toContain('UNITAS');
  });

  it.each(routing.locales)('%s has the exact Rev35 key set with ICU tokens preserved, no empty strings and no placeholders', (locale) => {
    const flat = flatten(load(locale).Rev35, '', {});
    expect(Object.keys(flat).sort()).toEqual(enKeys);
    for (const key of enKeys) {
      expect(icu(flat[key]), `${locale}:${key}`).toBe(icu(en[key]));
      expect(flat[key].trim().length, `${locale}:${key}`).toBeGreaterThan(0);
      expect(flat[key].includes('[MISSING'), `${locale}:${key}`).toBe(false);
    }
  });

  it.each(routing.locales.filter((l) => l !== 'en'))('%s is actually translated (not a positional L() slip)', (locale) => {
    const flat = flatten(load(locale).Rev35, '', {});
    const identical = enKeys.filter((k) => !IDENTICAL_ALLOWED.has(k) && flat[k] === en[k]);
    // The same 8% ceiling rev34Parity uses; with a one-key namespace the
    // floor of Math.floor(1 * 0.08) = 0 means the tag must differ from en.
    const allowed = Math.floor(enKeys.length * 0.08);
    expect(identical.length, `${locale}: ${identical.slice(0, 5).join(', ')}`).toBeLessThanOrEqual(allowed);
  });

  it.each(routing.locales)('%s no longer carries the retired GlobalRankings / UnitasRankings namespaces', (locale) => {
    const messages = load(locale);
    for (const ns of RETIRED_NAMESPACES) {
      expect(ns in messages, `${locale}:${ns}`).toBe(false);
    }
  });
});
