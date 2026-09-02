import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';
import { HOT_SHORTCUT_MATRIX } from '@/lib/hotIssues';
import { analyzeSurface } from '@/lib/uai/heuristics';
import {
  isFreshRow,
  isSeedQuery,
  labelsFor,
  loadMessages,
  seedQueries,
  shortcutCacheKey,
} from '@/lib/uai/shortcutCache';
import {
  SHORTCUT_CACHE_TTL_MS,
  SHORTCUT_CACHE_VERSION,
  deriveKeywords,
  isViableShortcutQuery,
  type ShortcutSnapshot,
} from '@/lib/uai/shortcutCore';
import type { WebSynthesis } from '@/lib/uai/types';

// The 24h sovereign caching engine: the parts that must hold for the batch
// and the visitor route to agree on what a tier is, in every locale.

function fakeWeb(titles: string[]): WebSynthesis {
  return {
    sourced: titles.length > 0,
    sources: titles.map((title) => ({ title, url: `https://en.wikipedia.org/wiki/${title}`, snippet: `${title} snippet` })),
    digest: titles.join(' '),
    lang: 'en',
    fetchedAt: Date.now(),
  };
}

describe('shortcutCacheKey', () => {
  it('is deterministic and normalizes casing / whitespace', () => {
    expect(shortcutCacheKey('en', 'Sovereign  AI')).toBe(shortcutCacheKey('en', 'sovereign ai '));
    expect(shortcutCacheKey('en', 'x')).toHaveLength(64);
  });

  it('separates locales and is namespaced by the snapshot version', () => {
    expect(shortcutCacheKey('en', 'bitcoin')).not.toBe(shortcutCacheKey('ko', 'bitcoin'));
    expect(SHORTCUT_CACHE_VERSION).toMatch(/^sc-v\d+$/);
  });
});

describe('isViableShortcutQuery', () => {
  it('admits one-character CJK words (the ko/ja `law` tier) but not one latin letter', () => {
    expect(isViableShortcutQuery('법')).toBe(true);
    expect(isViableShortcutQuery(' 法 ')).toBe(true);
    expect(isViableShortcutQuery('a')).toBe(false);
    expect(isViableShortcutQuery('')).toBe(false);
    expect(isViableShortcutQuery('ai')).toBe(true);
  });
});

describe('seed matrix', () => {
  it('resolves every axis title in all 20 locales without placeholders', async () => {
    for (const locale of routing.locales) {
      const messages = await loadMessages(locale);
      const seeds = seedQueries(messages);
      expect(seeds, locale).toHaveLength(HOT_SHORTCUT_MATRIX.length);
      seeds.forEach((seed) => {
        expect(seed.query, `${locale}/${seed.group}/${seed.key}`).not.toMatch(/\[MISSING|\.axes\./);
      });
      expect(isSeedQuery(messages, seeds[0].query.toUpperCase())).toBe(true);
      expect(isSeedQuery(messages, 'definitely-not-a-seed-tier')).toBe(false);
    }
  }, 30_000); // 20 locale bundles go through the vite transform on a cold run

  it('resolves constitution / lens labels from the message tree', async () => {
    const labels = labelsFor(await loadMessages('ko'));
    expect(labels.constitution('logic')).not.toContain('UAI.');
    expect(labels.lens('tech')).not.toContain('UAI.');
  });
});

describe('deriveKeywords', () => {
  it('caps chips, dedupes against the query and never repeats an entity', async () => {
    const labels = labelsFor(await loadMessages('en'));
    const web = fakeWeb(['Bitcoin', 'Bitcoin', 'Lightning Network', 'Satoshi Nakamoto', 'Proof of work', 'Mining', 'Halving']);
    const report = analyzeSurface('bitcoin', labels.ecosystems, '', web);
    const chips = deriveKeywords('bitcoin', report, web, labels);
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThanOrEqual(7);
    const ids = chips.map((c) => c.query.toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('bitcoin');
    expect(chips.filter((c) => c.kind === 'entity').length).toBeLessThanOrEqual(4);
    expect(chips.some((c) => c.kind === 'constitution')).toBe(true);
  });
});

describe('isFreshRow', () => {
  const snapshot = { version: SHORTCUT_CACHE_VERSION } as ShortcutSnapshot;

  it('accepts a current-version row inside the 24h window', () => {
    expect(isFreshRow({ payload: snapshot, synthesized_at: new Date().toISOString() })).toBe(true);
  });

  it('rejects stale rows and old snapshot versions', () => {
    const old = new Date(Date.now() - SHORTCUT_CACHE_TTL_MS - 1000).toISOString();
    expect(isFreshRow({ payload: snapshot, synthesized_at: old })).toBe(false);
    expect(
      isFreshRow({ payload: { version: 'sc-v0' } as ShortcutSnapshot, synthesized_at: new Date().toISOString() }),
    ).toBe(false);
  });
});
