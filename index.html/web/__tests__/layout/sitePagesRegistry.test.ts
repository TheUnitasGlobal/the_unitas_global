import { describe, expect, it } from 'vitest';
import { SITE_PAGE_OPEN_STORAGE_KEY } from '@/lib/sitePages';
import {
  REGISTRY_LABEL_KEYS,
  REGISTRY_SECTIONS_BY_SLUG,
  buildCookiesSection,
  buildStorageSection,
  buildThirdPartySection,
  registrySectionsFor,
  type RegistryLabels,
} from '@/lib/sitePagesRegistry';
import { BROWSER_STORAGE_LEDGER, COOKIE_LEDGER, fetchedSources, sourcesBySide } from '@/lib/uai/sourceRegistry';
import { LOCALE_SWITCH_MARKER_KEY } from '@/lib/i18n/localeSwitchMarker';

// REV-21 SPEC.md §12.8 step (2) -- the privacy / cookies disclosures are
// generated from the omni-tech source registry, so they can never drift
// from what the code calls or stores.

const labels = Object.fromEntries(REGISTRY_LABEL_KEYS.map((k) => [k, `<${k}>`])) as unknown as RegistryLabels;

describe('registry-generated site sections', () => {
  it('third-party section names every fetched source with its calling side, then every outbound destination', () => {
    const section = buildThirdPartySection('en', labels);
    const fetched = fetchedSources();
    const outbound = sourcesBySide('outbound');
    expect(section.kind).toBe('third-party');
    expect(section.heading).toBe('<thirdPartyLabel>');
    expect(section.paragraphs).toEqual(['<fetchedIntro>', '<browserIntro>']);
    expect(section.items).toHaveLength(fetched.length + outbound.length);
    fetched.forEach((s, i) => {
      const item = section.items![i];
      expect(item.meta).toBe(s.side === 'server' ? '<sideServer>' : '<sideBrowser>');
      expect(item.href).toBe(s.homepage);
      expect(item.note!.length).toBeGreaterThan(10);
      expect(item.name.length).toBeGreaterThan(1);
    });
    outbound.forEach((s, i) => {
      const item = section.items![fetched.length + i];
      expect(item.meta).toBe(s.loginWall ? '<loginWall>' : undefined);
      expect(item.href).toBe(s.homepage);
      expect(item.note!.length).toBeGreaterThan(10);
    });
    const names = section.items!.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    // the founder's "실명" rule: the parent is named where the name alone hides it
    expect(names.some((n) => /Microsoft/.test(n))).toBe(true);
  });

  it('third-party section is localised for Korean (attribution lines differ from English)', () => {
    const en = buildThirdPartySection('en', labels);
    const ko = buildThirdPartySection('ko', labels);
    const wikiEn = en.items!.find((i) => /Wikipedia/.test(i.name));
    const wikiKo = ko.items!.find((i) => /위키백과/.test(i.name));
    expect(wikiEn).toBeDefined();
    expect(wikiKo).toBeDefined();
    expect(wikiKo!.note).not.toBe(wikiEn!.note);
  });

  it('storage section lists the whole ledger with the storage kind as the badge', () => {
    const section = buildStorageSection('en', labels);
    expect(section.kind).toBe('storage');
    expect(section.heading).toBe('<storageLabel>');
    expect(section.paragraphs).toEqual(['<storageIntro>']);
    expect(section.items).toHaveLength(BROWSER_STORAGE_LEDGER.length);
    expect(section.items!.length).toBeGreaterThanOrEqual(30);
    for (const item of section.items!) {
      expect(['localStorage', 'sessionStorage']).toContain(item.meta);
      expect(item.note!.length).toBeGreaterThan(10);
      expect(item.href).toBeUndefined();
    }
    const keys = section.items!.map((i) => i.name);
    expect(new Set(keys).size).toBe(keys.length);
    // SPEC §12.8: the REV-21 keys are disclosed
    expect(keys).toContain(SITE_PAGE_OPEN_STORAGE_KEY);
    expect(keys).toContain(LOCALE_SWITCH_MARKER_KEY);
    expect(keys).toContain('unitas.uai.stream.v1');
    expect(keys).toContain('unitas.deeper.v1');
    expect(keys).toContain('unitas.uai.suggest.v1');
    // the 2026-09-13 inventory: site-wide keys, not only the U-AI ones
    expect(keys).toContain('unitas_locale_pref');
    expect(keys).toContain('unitas.guest.v1');
    expect(keys).toContain('unitas_cinema_phase');
    expect(keys).toContain('unitas.wallet.prefs.v1');
  });

  it('cookies section lists every cookie with an HttpOnly badge where scripts cannot read it', () => {
    const section = buildCookiesSection('en', labels);
    expect(section.kind).toBe('cookies');
    expect(section.heading).toBe('<cookiesLabel>');
    expect(section.paragraphs).toEqual(['<cookiesIntro>']);
    expect(section.items).toHaveLength(COOKIE_LEDGER.length);
    expect(COOKIE_LEDGER.length).toBeGreaterThanOrEqual(5);
    for (const item of section.items!) {
      expect(['HttpOnly', 'cookie']).toContain(item.meta);
      expect(item.note!.length).toBeGreaterThan(10);
    }
    const names = section.items!.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    expect(section.items!.find((i) => i.name === 'unitas_sovereign')!.meta).toBe('HttpOnly');
    expect(names.some((n) => n.startsWith('sb-'))).toBe(true);
    const ko = buildCookiesSection('ko', labels).items!;
    expect(ko.some((i, idx) => i.note !== section.items![idx].note)).toBe(true);
  });

  it('storage section reads Korean purpose + retention for ko', () => {
    const en = buildStorageSection('en', labels).items!;
    const ko = buildStorageSection('ko', labels).items!;
    expect(ko.map((i) => i.name)).toEqual(en.map((i) => i.name));
    expect(ko.some((i, idx) => i.note !== en[idx].note)).toBe(true);
  });

  it('only privacy and cookies carry generated sections', () => {
    expect(REGISTRY_SECTIONS_BY_SLUG.privacy).toEqual(['third-party', 'storage', 'cookies']);
    expect(REGISTRY_SECTIONS_BY_SLUG.cookies).toEqual(['storage', 'cookies']);
    expect(registrySectionsFor('privacy', 'en', labels).map((s) => s.kind)).toEqual(['third-party', 'storage', 'cookies']);
    expect(registrySectionsFor('cookies', 'en', labels).map((s) => s.kind)).toEqual(['storage', 'cookies']);
    for (const slug of ['about', 'careers', 'press', 'patent-notice', 'compliance', 'security', 'terms', 'help-center', 'contact', 'system-status']) {
      expect(registrySectionsFor(slug, 'en', labels)).toEqual([]);
    }
  });

  it('ledger entries never use the retired Korean terms', () => {
    const text = JSON.stringify(BROWSER_STORAGE_LEDGER) + JSON.stringify(COOKIE_LEDGER);
    expect(text).not.toMatch(/고지|주권|제국/);
  });
});
