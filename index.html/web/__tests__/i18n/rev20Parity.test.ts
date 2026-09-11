import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

// REV-20 SPEC.md §8 -- the `Rev20` namespace (discovery-slot titles/tags/fact
// labels) must exist with the exact same key set in all 20 locales
// (scripts/i18n/apply-rev20.mjs writes it from docs/rev20/i18n/<locale>.json),
// mirrors rev19Parity.test.ts's contract exactly.

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

describe('REV-20 i18n', () => {
  const en = flatten(load('en').Rev20, '', {});
  const enKeys = Object.keys(en).sort();

  it('en carries the slots namespace: rail label, 13 slot titles/tags (weather + 12 feed themes), fact labels', () => {
    expect(enKeys.length).toBe(74);
    expect(en['slots.railLabel']).toBeTruthy();
    for (const k of ['weather', 'history', 'quake', 'mostRead', 'fx', 'crypto', 'devPulse', 'paper', 'library', 'art', 'air', 'nation', 'nearby']) {
      expect(en[`slots.${k}.title`]).toBeTruthy();
      expect(en[`slots.${k}.tag`]).toBeTruthy();
    }
    for (const band of ['good', 'fair', 'moderate', 'poor', 'veryPoor', 'extreme']) {
      expect(en[`slots.facts.aqi.${band}`]).toBeTruthy();
    }
  });

  it.each(routing.locales)('%s has the exact Rev20 key set with ICU tokens preserved and no empty strings', (locale) => {
    const flat = flatten(load(locale).Rev20, '', {});
    expect(Object.keys(flat).sort()).toEqual(enKeys);
    for (const key of enKeys) {
      expect(icu(flat[key]), `${locale}:${key}`).toBe(icu(en[key]));
      expect(flat[key].trim().length, `${locale}:${key}`).toBeGreaterThan(0);
    }
  });
});
