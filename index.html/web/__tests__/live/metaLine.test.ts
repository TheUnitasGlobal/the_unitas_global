import { describe, expect, it } from 'vitest';
import { META_TIME_PLACEHOLDER, formatMetaTime, metaLineArgs, metaTimeFormatter } from '../../lib/live/metaLine';

// REV-34 M1-B (docs/rev34/SPEC.md §3.2, D-4): every footer on the shortcut
// strip renders `Rev34.meta.line` from ONE pure formatter. These are its
// invariants -- the values it hands to the ICU message, never the message.

const NOON_UTC = Date.UTC(2026, 8, 16, 12, 34, 0);

describe('metaLine formatter', () => {
  it('formats a usable timestamp as a short clock time in the visitor locale', () => {
    for (const locale of ['en', 'ko', 'de', 'ja', 'th']) {
      const text = formatMetaTime(NOON_UTC, locale);
      expect(text, locale).not.toBe(META_TIME_PLACEHOLDER);
      expect(text, locale).not.toMatch(/Invalid/i);
      // Hours and minutes are present in every locale's digit set (the
      // formatter is hour + minute only: no seconds, no date).
      expect(text.replace(/[^\d٠-٩०-९๐-๙]/g, '').length, locale).toBeGreaterThanOrEqual(3);
      expect(text, locale).not.toContain('2026');
    }
  });

  it('renders the placeholder, never "Invalid Date" or the epoch, when no timestamp has landed', () => {
    expect(formatMetaTime(undefined, 'en')).toBe(META_TIME_PLACEHOLDER);
    expect(formatMetaTime(null, 'en')).toBe(META_TIME_PLACEHOLDER);
    expect(formatMetaTime(0, 'en')).toBe(META_TIME_PLACEHOLDER);
    expect(formatMetaTime(-5, 'en')).toBe(META_TIME_PLACEHOLDER);
    expect(formatMetaTime(Number.NaN, 'en')).toBe(META_TIME_PLACEHOLDER);
    expect(formatMetaTime(Number.POSITIVE_INFINITY, 'en')).toBe(META_TIME_PLACEHOLDER);
  });

  it('memoises one formatter per locale and survives an unknown locale tag', () => {
    expect(metaTimeFormatter('ko')).toBe(metaTimeFormatter('ko'));
    expect(metaTimeFormatter('ko')).not.toBe(metaTimeFormatter('en'));
    expect(() => formatMetaTime(NOON_UTC, 'not a locale !!')).not.toThrow();
    expect(formatMetaTime(NOON_UTC, 'not a locale !!')).not.toBe(META_TIME_PLACEHOLDER);
  });

  it('hands the ICU message a whole non-negative count, a trimmed source and the formatted time', () => {
    const args = metaLineArgs({ count: 4.7, source: '  Wikimedia · Google 뉴스 RSS  ', updatedAt: NOON_UTC }, 'ko');
    expect(args.count).toBe(4);
    expect(args.source).toBe('Wikimedia · Google 뉴스 RSS');
    expect(args.updated).toBe(formatMetaTime(NOON_UTC, 'ko'));
    expect(Object.keys(args).sort()).toEqual(['count', 'source', 'updated']);
  });

  it('clamps a negative or non-finite count to zero instead of leaking it into copy', () => {
    expect(metaLineArgs({ count: -3, source: 'x' }, 'en').count).toBe(0);
    expect(metaLineArgs({ count: Number.NaN, source: 'x' }, 'en').count).toBe(0);
    expect(metaLineArgs({ count: 12, source: 'x' }, 'en').updated).toBe(META_TIME_PLACEHOLDER);
  });
});
