import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

// REV-19 SPEC.md §14 -- the `Rev19` namespace must exist with the exact
// same key set in all 20 locales (scripts/i18n/apply-rev19.mjs writes it
// from docs/rev19/i18n/<locale>.json), ICU tokens must survive translation,
// and SPEC §12's Korean term rule ("고지" -> 공지사항 / 안내) must hold
// across the whole ko.json.

function load(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8')) as Record<string, unknown>;
}

function flatten(obj: unknown, prefix: string, out: Record<string, string>): Record<string, string> {
  if (!obj || typeof obj !== 'object') return out;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path, out);
    else if (typeof value === 'string') out[path] = value;
  }
  return out;
}

const icu = (s: string) => (s.match(/\{[^}]*\}/g) ?? []).slice().sort().join('|');

describe('REV-19 i18n', () => {
  const en = flatten(load('en').Rev19, '', {});
  const enKeys = Object.keys(en).sort();

  it('en carries the namespace with the curiosity-card pool and the nine hub themes', () => {
    expect(enKeys.length).toBeGreaterThan(60);
    for (let i = 1; i <= 12; i++) expect(en[`search.cards.c${i}`]).toBeTruthy();
    for (const k of ['game', 'sports', 'movie', 'bestseller', 'shopping', 'stock', 'webtoon', 'fashion', 'food']) {
      expect(en[`hub.themes.${k}.title`]).toBeTruthy();
      expect(en[`hub.themes.${k}.tag`]).toBeTruthy();
    }
  });

  it.each(routing.locales)('%s has the exact Rev19 key set with ICU tokens preserved', (locale) => {
    const flat = flatten(load(locale).Rev19, '', {});
    expect(Object.keys(flat).sort()).toEqual(enKeys);
    for (const key of enKeys) {
      expect(icu(flat[key]), `${locale}:${key}`).toBe(icu(en[key]));
      expect(flat[key].trim().length, `${locale}:${key}`).toBeGreaterThan(0);
    }
  });

  it('ko.json no longer uses the term 고지 anywhere (SPEC §12)', () => {
    const raw = readFileSync(join(__dirname, '../../messages', 'ko.json'), 'utf8');
    expect(raw.includes('고지')).toBe(false);
    const ko = load('ko') as { Footer: Record<string, string>; QuantumWhite: { entry: Record<string, string> } };
    expect(ko.Footer.legal).toBe('법률 안내');
    expect(ko.QuantumWhite.entry.eyebrowNotice).toBe('공지사항');
  });
});
