// REV-21 §6 / SPEC §12.8 step (2) -- the privacy and cookie pages' "third-party
// sources" and "browser storage keys" sections are GENERATED from the
// omni-tech source registry (lib/uai/sourceRegistry.ts), never hand-written:
// one registry, one legal line per source, and the public disclosure can
// never drift from what the code actually calls or stores.
//
// Pure: no React, no `window`. Used by both hosts (the inline modal and the
// /legal/<slug> route) and by __tests__/layout/sitePagesRegistry.test.ts.

import {
  BROWSER_STORAGE_LEDGER,
  COOKIE_LEDGER,
  fetchedSources,
  sourceAttribution,
  sourceLabel,
  sourcesBySide,
} from '@/lib/uai/sourceRegistry';
import type { SiteSection, SiteSectionItem } from './sitePages';

/** The `SitePages.common.*` strings the generated sections are phrased with. */
export interface RegistryLabels {
  thirdPartyLabel: string;
  storageLabel: string;
  fetchedIntro: string;
  browserIntro: string;
  storageIntro: string;
  sideServer: string;
  sideBrowser: string;
  loginWall: string;
  cookiesLabel: string;
  cookiesIntro: string;
}

export const REGISTRY_LABEL_KEYS: readonly (keyof RegistryLabels)[] = [
  'thirdPartyLabel',
  'storageLabel',
  'fetchedIntro',
  'browserIntro',
  'storageIntro',
  'sideServer',
  'sideBrowser',
  'loginWall',
  'cookiesLabel',
  'cookiesIntro',
];

/** Read the `SitePages.common.*` strings through any translator (`t` from
 *  next-intl's client or server API). */
export function readRegistryLabels(t: (key: string) => string): RegistryLabels {
  const labels = {} as RegistryLabels;
  for (const key of REGISTRY_LABEL_KEYS) labels[key] = t(`common.${key}`);
  return labels;
}

export type RegistryKind = 'third-party' | 'storage' | 'cookies';

/** Which generated sections each slug carries (SPEC §12.8: privacy gets
 *  all three, the cookie policy the two on-device ledgers; every other page
 *  none). */
export const REGISTRY_SECTIONS_BY_SLUG: Readonly<Record<string, readonly RegistryKind[]>> = {
  privacy: ['third-party', 'storage', 'cookies'],
  cookies: ['storage', 'cookies'],
};

/** Every operator the site reaches: fetched sources (server / browser,
 *  each badged with the side that calls it and its legal attribution line)
 *  followed by the outbound-only destinations (link only, nothing fetched;
 *  a "may ask you to sign in" badge where the vendor shows a login wall). */
export function buildThirdPartySection(locale: string, labels: RegistryLabels): SiteSection {
  const items: SiteSectionItem[] = [];
  for (const s of fetchedSources()) {
    items.push({
      name: sourceLabel(s.id, locale, true),
      meta: s.side === 'server' ? labels.sideServer : labels.sideBrowser,
      note: sourceAttribution(s.id, locale),
      href: s.homepage,
    });
  }
  for (const s of sourcesBySide('outbound')) {
    items.push({
      name: sourceLabel(s.id, locale, true),
      meta: s.loginWall ? labels.loginWall : undefined,
      note: sourceAttribution(s.id, locale),
      href: s.homepage,
    });
  }
  return {
    heading: labels.thirdPartyLabel,
    paragraphs: [labels.fetchedIntro, labels.browserIntro],
    items,
    kind: 'third-party',
  };
}

/** Every key the site keeps on the visitor's device, with the purpose and
 *  the retention the code enforces. */
export function buildStorageSection(locale: string, labels: RegistryLabels): SiteSection {
  const ko = locale === 'ko';
  const items: SiteSectionItem[] = BROWSER_STORAGE_LEDGER.map((e) => ({
    name: e.key,
    meta: e.storage,
    note: `${ko ? e.purpose.ko : e.purpose.en} ${ko ? e.retention.ko : e.retention.en}`,
  }));
  return {
    heading: labels.storageLabel,
    paragraphs: [labels.storageIntro],
    items,
    kind: 'storage',
  };
}

/** Every cookie the site, its middleware or its sign-in library sets,
 *  badged HttpOnly where page scripts cannot read it. */
export function buildCookiesSection(locale: string, labels: RegistryLabels): SiteSection {
  const ko = locale === 'ko';
  const items: SiteSectionItem[] = COOKIE_LEDGER.map((c) => ({
    name: c.name,
    meta: c.httpOnly ? 'HttpOnly' : 'cookie',
    note: `${ko ? c.purpose.ko : c.purpose.en} ${ko ? c.lifetime.ko : c.lifetime.en}`,
  }));
  return {
    heading: labels.cookiesLabel,
    paragraphs: [labels.cookiesIntro],
    items,
    kind: 'cookies',
  };
}

const BUILDERS: Record<RegistryKind, (locale: string, labels: RegistryLabels) => SiteSection> = {
  'third-party': buildThirdPartySection,
  storage: buildStorageSection,
  cookies: buildCookiesSection,
};

/** The generated sections a page appends after its authored ones. */
export function registrySectionsFor(slug: string, locale: string, labels: RegistryLabels): SiteSection[] {
  const kinds = REGISTRY_SECTIONS_BY_SLUG[slug] ?? [];
  return kinds.map((kind) => BUILDERS[kind](locale, labels));
}
