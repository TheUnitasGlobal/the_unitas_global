import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

// Module-level test isolation (CLAUDE.md) -- pure JSON-shape assertions
// only, no Supabase, no other module's fixtures. Guards the REV-13
// "QuantumWhite" i18n namespace (see REV13-SPEC.md section 7 + section 10
// items 13/17): every locale in `routing.locales` must carry the exact same
// QuantumWhite key set as en.json, with no leftover i18n-sync placeholder
// and no forbidden internal-jargon string leaking onto the rendered home.

/** Forbidden strings, verbatim from REV13-SPEC.md section 0 rule 4. Matched
 * case-insensitively since translators may capitalize differently. */
const FORBIDDEN_WORDS: readonly string[] = [
  'doctrine',
  'codex',
  'constitution',
  'sovereign doctrine',
  'Claude',
  'Roo',
  'Gemini',
  'PowerShell',
  'TypeScript',
  'React',
  'Next.js',
  'Tailwind',
  'Supabase',
  'RPC',
  'migration',
  'USPTO',
  'patent',
];

/** Escapes regex metacharacters in a literal string. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary matching, not plain substring `includes`: several forbidden
// tokens ("Roo", "RPC") are short enough to occur as a substring inside an
// unrelated word in another language (e.g. Estonian "proovi" contains
// "roo"). `\b` only matches at a word/non-word transition, which is exactly
// right for these all-Latin, all-word-character tokens and their `.`
// containing sibling ("Next.js").
const FORBIDDEN_PATTERNS: readonly RegExp[] = FORBIDDEN_WORDS.map(
  (word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i'),
);

/** Flattens a nested message tree into `{ 'a.b.c': value }`, string leaves only. */
function flatten(node: unknown, prefix = ''): Record<string, string> {
  if (typeof node === 'string') {
    return prefix ? { [prefix]: node } : {};
  }
  if (node === null || typeof node !== 'object') return {};
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      return { ...acc, ...flatten(value, nextPrefix) };
    },
    {},
  );
}

function loadQuantumWhite(locale: string): Record<string, string> {
  const raw = readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  const namespace = (parsed as Record<string, unknown>).QuantumWhite;
  if (namespace === undefined) {
    throw new Error(`messages/${locale}.json is missing the QuantumWhite namespace`);
  }
  return flatten(namespace);
}

const LOCALES = routing.locales;
const EN_KEYS = Object.keys(loadQuantumWhite('en')).sort();

describe('QuantumWhite i18n parity', () => {
  it('routing.locales covers the 20 REV-13 locales', () => {
    expect([...LOCALES].sort()).toEqual(
      [
        'de', 'en', 'es', 'et', 'fr', 'hi', 'id', 'it', 'ja', 'km',
        'ko', 'nl', 'pl', 'pt', 'ru', 'th', 'tl', 'tr', 'vi', 'zh',
      ].sort(),
    );
  });

  it('en.json has a non-empty QuantumWhite namespace to compare against', () => {
    expect(EN_KEYS.length).toBeGreaterThan(0);
  });

  for (const locale of LOCALES) {
    describe(`locale: ${locale}`, () => {
      const messages = loadQuantumWhite(locale);

      it('has exactly the same QuantumWhite key set as en.json', () => {
        expect(Object.keys(messages).sort()).toEqual(EN_KEYS);
      });

      it('has no leftover i18n-sync placeholder', () => {
        for (const [key, value] of Object.entries(messages)) {
          expect(value, `${locale}.QuantumWhite.${key}`).not.toMatch(/\[MISSING/);
        }
      });

      it('has no forbidden internal-jargon word (spec section 0 rule 4)', () => {
        for (const [key, value] of Object.entries(messages)) {
          for (const pattern of FORBIDDEN_PATTERNS) {
            expect(
              pattern.test(value),
              `${locale}.QuantumWhite.${key} contains forbidden word: "${value}"`,
            ).toBe(false);
          }
        }
      });
    });
  }
});
