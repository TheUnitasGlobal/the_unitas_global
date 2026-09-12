import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

// REV-21 SPEC.md §7 -- the `Rev21` namespace must exist with the exact same
// key set (and the same array shapes) in all 20 locales
// (scripts/i18n/apply-rev21.mjs writes it from docs/rev21/i18n/<locale>.json),
// ICU tokens must survive translation, no string may be empty, and the
// apply script's silent en-fallback must not slip a wholesale-English
// locale into production (drift check below).

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

/** Keys whose English value is a proper noun / number that legitimately stays identical. */
const IDENTICAL_ALLOWED = new Set<string>([]);

describe('REV-21 i18n', () => {
  const en = flatten(load('en').Rev21, '', {});
  const enKeys = Object.keys(en).sort();

  it('en carries the namespace with the two ranking slots', () => {
    expect(enKeys.length).toBeGreaterThanOrEqual(10);
    expect(en['slots.worldRanking.title']).toBeTruthy();
    expect(en['slots.unitasRanking.title']).toBeTruthy();
    expect(en['slots.facts.topRank']).toBeTruthy();
  });

  it.each(routing.locales)('%s has the exact Rev21 key set with ICU tokens preserved and no empty strings', (locale) => {
    const flat = flatten(load(locale).Rev21, '', {});
    expect(Object.keys(flat).sort()).toEqual(enKeys);
    for (const key of enKeys) {
      expect(icu(flat[key]), `${locale}:${key}`).toBe(icu(en[key]));
      expect(flat[key].trim().length, `${locale}:${key}`).toBeGreaterThan(0);
    }
  });

  it.each(routing.locales.filter((l) => l !== 'en'))('%s is actually translated (not the apply script\'s English fallback)', (locale) => {
    const flat = flatten(load(locale).Rev21, '', {});
    const identical = enKeys.filter((k) => !IDENTICAL_ALLOWED.has(k) && flat[k] === en[k]);
    // Small namespaces get one free identical string (a loanword such as
    // "modules"); larger ones must stay under 5% -- the REV-18 drift gate.
    const allowed = Math.max(1, Math.floor(enKeys.length * 0.05));
    expect(identical.length, `${locale}: ${identical.slice(0, 5).join(', ')}`).toBeLessThanOrEqual(allowed);
  });

  it('ko copy avoids the retired term 고지', () => {
    const ko = JSON.stringify(load('ko').Rev21);
    expect(ko.includes('고지')).toBe(false);
  });
});
