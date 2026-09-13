import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';
import { ALL_SITE_SLUGS, DISCLAIMER_SLUGS, readSitePageDocument } from '@/lib/sitePages';
import { REGISTRY_LABEL_KEYS } from '@/lib/sitePagesRegistry';

// REV-21 SPEC.md §6.2 / §7 -- the `SitePages` namespace (12 institutional
// pages, sections schema) must exist with the same slug set, the same
// section / paragraph counts and no empty strings in all 20 locales
// (scripts/i18n/apply-rev21.mjs --namespace SitePages writes it from
// docs/rev21/i18n/sitepages/<locale>.json); the founder's vocabulary rules
// (no "constitution / codex / doctrine / USPTO" English words, no
// application number -- D-31; ko never uses 고지 / 주권 / 제국) hold in every
// locale; and no locale is the apply script's wholesale-English fallback.

const COMMON_KEYS = ['back', 'disclaimer', 'corporateNotice', 'updatedLabel', 'contentsLabel', ...REGISTRY_LABEL_KEYS];
const FORBIDDEN = /constitution|codex|doctrine|uspto|64\/023|023,911|application\s*#/i;

type Messages = Record<string, unknown>;

function load(locale: string): Messages {
  const all = JSON.parse(readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8')) as { SitePages?: Messages };
  return all.SitePages ?? {};
}

function leaves(obj: unknown, prefix: string, out: Record<string, string>): Record<string, string> {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => leaves(v, `${prefix}.${i}`, out));
    return out;
  }
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') out[prefix] = obj;
    return out;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) leaves(value, prefix ? `${prefix}.${key}` : key, out);
  return out;
}

const en = load('en');
const enLeaves = leaves(en, '', {});
const enKeys = Object.keys(enLeaves).sort();

describe('REV-21 SitePages i18n', () => {
  it('en carries all 12 slugs as section documents with a revision date, plus the common strings', () => {
    for (const slug of ALL_SITE_SLUGS) {
      const doc = readSitePageDocument(en[slug]);
      expect(doc, slug).not.toBeNull();
      expect(doc!.sections.length, slug).toBeGreaterThanOrEqual(4);
      expect(doc!.updated, slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const section of doc!.sections) {
        expect(section.heading.trim().length).toBeGreaterThan(0);
        expect(section.paragraphs.length).toBeGreaterThan(0);
      }
    }
    const common = en.common as Record<string, unknown>;
    for (const key of COMMON_KEYS) expect(typeof common[key], key).toBe('string');
    expect(Object.keys(en).sort()).toEqual([...ALL_SITE_SLUGS, 'common'].sort());
    for (const slug of DISCLAIMER_SLUGS) expect(ALL_SITE_SLUGS).toContain(slug);
  });

  it('en patent notice keeps the pending wording and names no application number', () => {
    const text = JSON.stringify(en['patent-notice']);
    expect(text).toMatch(/pending/i);
    expect(text).not.toMatch(FORBIDDEN);
  });

  it.each(routing.locales)('%s has the exact SitePages key set (slugs, sections, paragraphs) with no empty strings', (locale) => {
    const flat = leaves(load(locale), '', {});
    expect(Object.keys(flat).sort()).toEqual(enKeys);
    for (const key of enKeys) expect(flat[key].trim().length, `${locale}:${key}`).toBeGreaterThan(0);
    for (const slug of ALL_SITE_SLUGS) {
      const doc = readSitePageDocument(load(locale)[slug]);
      const ref = readSitePageDocument(en[slug])!;
      expect(doc, `${locale}:${slug}`).not.toBeNull();
      expect(doc!.sections.length, `${locale}:${slug}`).toBe(ref.sections.length);
      doc!.sections.forEach((s, i) => expect(s.paragraphs.length, `${locale}:${slug}:${i}`).toBe(ref.sections[i].paragraphs.length));
      expect(doc!.updated, `${locale}:${slug}`).toBe(ref.updated);
    }
  });

  it.each(routing.locales)('%s copy never uses the forbidden legal / internal vocabulary (D-31)', (locale) => {
    const flat = leaves(load(locale), '', {});
    for (const [key, value] of Object.entries(flat)) expect(value, `${locale}:${key}`).not.toMatch(FORBIDDEN);
  });

  it.each(routing.locales)('%s keeps the company name verbatim wherever English names it', (locale) => {
    const flat = leaves(load(locale), '', {});
    for (const key of enKeys) {
      if (/THE UNITAS GLOBAL OÜ/.test(enLeaves[key])) expect(flat[key], `${locale}:${key}`).toContain('THE UNITAS GLOBAL OÜ');
    }
  });

  it.each(routing.locales.filter((l) => l !== 'en'))('%s is actually translated (not the apply script\'s English fallback)', (locale) => {
    const flat = leaves(load(locale), '', {});
    const comparable = enKeys.filter((k) => !k.endsWith('.updated'));
    const identical = comparable.filter((k) => flat[k] === enLeaves[k]);
    const allowed = Math.max(1, Math.floor(comparable.length * 0.05));
    expect(identical.length, `${locale}: ${identical.slice(0, 5).join(', ')}`).toBeLessThanOrEqual(allowed);
  });

  it('ko copy avoids the retired terms 고지 / 주권 / 제국 (legal-risk language rule)', () => {
    const ko = JSON.stringify(load('ko'));
    expect(ko).not.toMatch(/고지|주권|제국|바로 입장/);
  });
});
