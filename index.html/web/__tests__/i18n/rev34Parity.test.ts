import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

// REV-34 SPEC.md §5 stage 1 -- the `Rev34` namespace is written by five
// independent applicators (scripts/apply-rev34-{strip,weather,products,
// square,uranking}-i18n.mjs), each a deep-merge SET of its own dotted keys.
// Because they run concurrently on the same messages/*.json, the only proof
// that none of them clobbered another is this gate: the exact same key set in
// all 20 locales, ICU tokens preserved per key, no empty string, no
// `[MISSING` placeholder (the i18n:sync fallback the applicators fail closed
// on), and a per-locale drift ceiling so a positional L() slip that leaves
// English in a foreign slot cannot ship.

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

/** The twenty U-Square hyper-themes (SPEC §3.4, D-10); their tab labels are U-branded product names. */
const SQUARE_THEMES = [
  'uRanking', 'uShorts', 'uTalk', 'uExchange', 'uSocial', 'uAcademy', 'uVenture', 'uOracle', 'uFactory', 'uCoin',
  'uGovernance', 'uNexus', 'uAkashic', 'uQuantum', 'uShield', 'uNomad', 'uChronos', 'uSpace', 'uVision', 'uMaster',
] as const;

/** Keys whose English value is a proper noun / token that legitimately stays identical. */
const IDENTICAL_ALLOWED = new Set<string>([
  'square.title', // "UNITAS SQUARE (U-Square)" -- the brand, identical in all 20 locales.
  'square.signals.coins', // "U-Coins" -- the ecosystem currency name.
  'uRankings.rankAria', // "#{rank}" -- a bare ICU token, nothing to translate.
  // "U-Shorts", "U-Talk", ... -- module product names; Latin-script locales keep them verbatim.
  ...SQUARE_THEMES.map((theme) => `square.themes.${theme}.tab`),
]);

describe('REV-34 i18n', () => {
  const en = flatten(load('en').Rev34, '', {});
  const enKeys = Object.keys(en).sort();

  it('en carries every lane sub-namespace', () => {
    expect(enKeys.length).toBeGreaterThanOrEqual(180);
    expect(en['meta.line']).toContain('{count}');
    expect(en['row.open']).toBeTruthy();
    expect(en['weather.hourlyLabel']).toBeTruthy();
    expect(en['uRankings.label']).toBeTruthy();
    expect(en['square.title']).toBe('UNITAS SQUARE (U-Square)');
    for (const theme of SQUARE_THEMES) {
      for (const leaf of ['tab', 'lede', 'features.0', 'features.1', 'features.2', 'cta']) {
        expect(en[`square.themes.${theme}.${leaf}`], `en:square.themes.${theme}.${leaf}`).toBeTruthy();
      }
    }
  });

  it.each(routing.locales)('%s has the exact Rev34 key set with ICU tokens preserved, no empty strings and no placeholders', (locale) => {
    const flat = flatten(load(locale).Rev34, '', {});
    expect(Object.keys(flat).sort()).toEqual(enKeys);
    for (const key of enKeys) {
      expect(icu(flat[key]), `${locale}:${key}`).toBe(icu(en[key]));
      expect(flat[key].trim().length, `${locale}:${key}`).toBeGreaterThan(0);
      expect(flat[key].includes('[MISSING'), `${locale}:${key}`).toBe(false);
    }
  });

  it.each(routing.locales.filter((l) => l !== 'en'))('%s is actually translated (not a positional L() slip)', (locale) => {
    const flat = flatten(load(locale).Rev34, '', {});
    const identical = enKeys.filter((k) => !IDENTICAL_ALLOWED.has(k) && flat[k] === en[k]);
    // Loanwords such as "Module", "Pause" or "Live" are genuinely spelled the
    // same in several Latin-script locales; anything beyond 8% is a slip.
    const allowed = Math.max(3, Math.floor(enKeys.length * 0.08));
    expect(identical.length, `${locale}: ${identical.slice(0, 5).join(', ')}`).toBeLessThanOrEqual(allowed);
  });
});
