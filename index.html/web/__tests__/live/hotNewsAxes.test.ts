import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOT_NEWS_AXES, hotNewsAxisMeta } from '../../lib/live/hotNewsAxes';
import { HOT_NEWS_CATEGORIES } from '../../lib/live/hotNews';

// REV-34 M1-E (docs/rev34/SPEC.md §3.2, D-6): the news widget's glyphs are
// the shortcut strip's coloured dot. The axis metadata is colour only -- no
// icon component, no lucide import -- and the server-side hotNews.ts must
// stay presentation-free.

const read = (rel: string) => readFileSync(path.resolve(__dirname, '../../', rel), 'utf8');

describe('hot-news axes (colour only)', () => {
  it('lists the 22 categories once each, in the canonical order', () => {
    expect(HOT_NEWS_AXES.map((a) => a.key)).toEqual([...HOT_NEWS_CATEGORIES]);
    expect(new Set(HOT_NEWS_AXES.map((a) => a.key)).size).toBe(22);
  });

  it('carries a hex accent per axis and nothing else', () => {
    for (const axis of HOT_NEWS_AXES) {
      expect(axis.color, axis.key).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Object.keys(axis).sort(), axis.key).toEqual(['color', 'key']);
      expect('icon' in axis, axis.key).toBe(false);
    }
  });

  it('hotNewsAxisMeta resolves the same colour the list carries', () => {
    for (const axis of HOT_NEWS_AXES) {
      expect(hotNewsAxisMeta(axis.key)).toEqual(axis);
    }
  });

  it('neither the axis map nor the server news module imports lucide', () => {
    expect(read('lib/live/hotNewsAxes.ts')).not.toMatch(/lucide-react|LucideIcon|icon:/);
    expect(read('lib/live/hotNews.ts')).not.toMatch(/lucide-react/);
  });
});
