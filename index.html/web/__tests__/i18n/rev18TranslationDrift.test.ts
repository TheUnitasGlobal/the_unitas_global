import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

// REV-18 SPEC.md §1.2 stage 4 -- a static regression gate proving the
// 18-locale QuantumWhite translation pass (docs/rev18/) doesn't silently
// regress on a future REV that adds English-fallback copy and forgets to
// translate it. Mirrors __tests__/quantumWhite/rev17Copy.test.ts's
// static-source-text convention (no JSX import, just JSON-shape assertions).

// Brand/legal proper nouns that are correctly identical to the English
// source in every locale (see scripts/i18n/merge-drift.mjs's
// ALLOWLIST_IDENTICAL).
const ALLOWLIST_IDENTICAL = new Set(['QuantumWhite.coinUnit', 'QuantumWhite.watermark']);

// en/ko are the hand-authored source/gold-standard locales, not translation
// targets -- excluded from the drift ratio check by design (REV-18 SPEC.md
// §0.1).
const TRANSLATION_TARGET_LOCALES = routing.locales.filter((l) => l !== 'en' && l !== 'ko');

// Above this fraction of QuantumWhite string keys being byte-identical to
// the English source (outside the allowlist), a locale is considered to
// have regressed back to untranslated fallback text.
const MAX_IDENTICAL_RATIO = 0.05;

function loadMessages(locale: string): Record<string, unknown> {
  const raw = readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function flatten(obj: unknown, prefix: string, out: Record<string, string>): Record<string, string> {
  if (!obj || typeof obj !== 'object') return out;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else if (typeof value === 'string') {
      out[path] = value;
    }
  }
  return out;
}

describe('REV-18 QuantumWhite translation drift (SPEC.md §1)', () => {
  const en = loadMessages('en');
  const enFlat = flatten((en as { QuantumWhite?: unknown }).QuantumWhite, 'QuantumWhite', {});
  const totalKeys = Object.keys(enFlat).length;

  it('en.json QuantumWhite has a non-trivial key set to compare against (sanity check)', () => {
    expect(totalKeys).toBeGreaterThan(50);
  });

  for (const locale of TRANSLATION_TARGET_LOCALES) {
    it(`locale ${locale}: fewer than ${(MAX_IDENTICAL_RATIO * 100).toFixed(0)}% of QuantumWhite strings remain untranslated English fallback`, () => {
      const messages = loadMessages(locale);
      const localeFlat = flatten((messages as { QuantumWhite?: unknown }).QuantumWhite, 'QuantumWhite', {});

      const identicalKeys = Object.keys(enFlat).filter((key) => {
        if (ALLOWLIST_IDENTICAL.has(key)) return false;
        return localeFlat[key] === enFlat[key];
      });

      const ratio = identicalKeys.length / totalKeys;
      expect(
        ratio,
        `${locale}: ${identicalKeys.length}/${totalKeys} keys identical to English (untranslated): ${identicalKeys.slice(0, 10).join(', ')}${identicalKeys.length > 10 ? '…' : ''}`,
      ).toBeLessThan(MAX_IDENTICAL_RATIO);
    });
  }
});
