import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';
import { HOT_NEWS_CATEGORIES } from '@/lib/live/hotNews';
import { PRODUCT_FAMILY_KEYS } from '@/lib/live/newProducts';

// REV-29 -- every locale carries the same REV-29 copy as en.json, with
// real strings (no i18n-sync placeholder) and, for M2.2, exactly one theme
// per news label (no fused "복지·보건" survives anywhere).

type Tree = { [key: string]: string | Tree };

function load(locale: string): Tree {
  return JSON.parse(readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8')) as Tree;
}

function flatten(node: unknown, prefix = ''): Record<string, string> {
  if (typeof node === 'string') return prefix ? { [prefix]: node } : {};
  if (node === null || typeof node !== 'object') return {};
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return { ...acc, ...flatten(value, next) };
  }, {});
}

function get(tree: Tree, dotted: string): unknown {
  let node: unknown = tree;
  for (const p of dotted.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[p];
  }
  return node;
}

const LOCALES = routing.locales;
const en = load('en');
const enRev29 = flatten(en.Rev29, 'Rev29');
const enHotNews = flatten(en.HotNews, 'HotNews');

describe('REV-29 copy parity', () => {
  it('en.json carries the hub, exchange, rooms, social, attach, shorts and product trees', () => {
    for (const key of [
      'Rev29.hub.title', 'Rev29.hub.toggleAria', 'Rev29.hub.tabs.exchange', 'Rev29.hub.tabs.shorts', 'Rev29.hub.tabs.rankings', 'Rev29.hub.tabs.rooms', 'Rev29.hub.tabs.social',
      'Rev29.exchange.buy', 'Rev29.exchange.form.submit', 'Rev29.rooms.send', 'Rev29.social.share', 'Rev29.attach.file', 'Rev29.attach.video', 'Rev29.attach.sketch',
      'Rev29.shorts.label', 'Rev29.shorts.pass.reserve', 'Rev29.shorts.filterAll', 'Rev29.newProducts.facts.count',
      'Rev20.slots.newProducts.title', 'Rev20.slots.newProducts.tag',
      'HotNews.openOriginal', 'HotNews.storyCount', 'HotNews.axisTag', 'HotNews.detailAria', 'HotNews.allStories',
    ]) {
      expect(typeof get(en, key), key).toBe('string');
    }
    for (const family of PRODUCT_FAMILY_KEYS) expect(typeof get(en, `Rev29.newProducts.families.${family}`), family).toBe('string');
    expect(Object.keys(enRev29).length).toBeGreaterThan(90);
  });

  for (const locale of LOCALES) {
    describe(`locale ${locale}`, () => {
      const tree = load(locale);
      const rev29 = flatten(tree.Rev29, 'Rev29');
      const hotNews = flatten(tree.HotNews, 'HotNews');

      it('has exactly the en Rev29 key set', () => {
        expect(Object.keys(rev29).sort()).toEqual(Object.keys(enRev29).sort());
      });

      it('has exactly the en HotNews key set, with all 22 category labels', () => {
        expect(Object.keys(hotNews).sort()).toEqual(Object.keys(enHotNews).sort());
        const categories = get(tree, 'HotNews.category') as Record<string, string>;
        expect(Object.keys(categories).sort()).toEqual([...HOT_NEWS_CATEGORIES].sort());
      });

      it('M2.2: no news label carries two themes any more', () => {
        const categories = get(tree, 'HotNews.category') as Record<string, string>;
        for (const [key, label] of Object.entries(categories)) {
          expect(label.trim().length, key).toBeGreaterThan(0);
          expect(label, `${key} = "${label}" still fused`).not.toMatch(/[·・]/);
        }
        expect(categories.welfare).not.toBe(categories.health);
        expect(categories.security).not.toBe(categories.conflict);
      });

      it('carries no placeholder and no empty string in the REV-29 trees', () => {
        for (const [key, value] of Object.entries({ ...rev29, ...hotNews })) {
          expect(value.trim().length, key).toBeGreaterThan(0);
          expect(value, key).not.toMatch(/\[MISSING/);
        }
      });

      it('keeps every ICU argument the en string uses', () => {
        for (const [key, enValue] of Object.entries(enRev29)) {
          const args = Array.from(enValue.matchAll(/\{(\w+)\}/g)).map((m) => m[1]);
          for (const arg of args) expect(rev29[key], `${key} lost {${arg}}`).toContain(`{${arg}}`);
        }
        for (const key of ['HotNews.storyCount', 'HotNews.axisTag', 'HotNews.detailAria', 'HotNews.allStories']) {
          const args = Array.from(enHotNews[key].matchAll(/\{(\w+)\}/g)).map((m) => m[1]);
          for (const arg of args) expect(hotNews[key], `${key} lost {${arg}}`).toContain(`{${arg}}`);
        }
      });
    });
  }
});
