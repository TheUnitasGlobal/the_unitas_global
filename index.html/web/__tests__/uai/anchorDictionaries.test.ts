import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';
import { GLOBAL_RANKING_THEMES, RANKING_ENTRY_QID, THEME_QID, rankingEntryQid } from '@/lib/globalRankings';
import { AXIS_QID, HOT_NEWS_CATEGORIES } from '@/lib/live/hotNews';
import { DEFAULT_PLACE } from '@/lib/live/useLiveWeather';
import { SLOT_QID } from '@/lib/live/discoverySlots';

// REV-21 SPEC.md §12.3 (h) -- the QID dictionaries every Explore Deeper host
// anchors on. Each id was verified against Wikidata on 2026-09-12; these
// tests pin shape and coverage so a theme, axis or locale added later
// cannot ship without its anchor.

const QID = /^Q\d+$/;

describe('anchor dictionaries', () => {
  it('THEME_QID covers every ranking theme with a Wikidata id', () => {
    for (const theme of GLOBAL_RANKING_THEMES) expect(THEME_QID[theme.key], theme.key).toMatch(QID);
    expect(THEME_QID.heritage).toBe('Q9259');
    expect(THEME_QID.mountains).toBe('Q8502');
  });

  it('RANKING_ENTRY_QID curates ranks 1-10 of every theme, unique within a theme', () => {
    for (const theme of GLOBAL_RANKING_THEMES) {
      const table = RANKING_ENTRY_QID[theme.key];
      for (let rank = 1; rank <= 10; rank += 1) expect(table[rank], `${theme.key}#${rank}`).toMatch(QID);
      expect(new Set(Object.values(table)).size, theme.key).toBe(Object.keys(table).length);
      // Every curated rank exists in the dataset.
      for (const rank of Object.keys(table).map(Number)) expect(theme.entries.some((e) => e.rank === rank), `${theme.key}#${rank}`).toBe(true);
    }
    expect(rankingEntryQid('mountains', 1)).toBe('Q513'); // Mount Everest
    expect(rankingEntryQid('buildings', 10)).toBe('Q197833'); // CITIC Tower, Beijing (China Zun) -- not the Hong Kong namesake
    expect(rankingEntryQid('humanRecords', 3)).toBe('Q1189'); // Usain Bolt
    expect(rankingEntryQid('mountains', 11)).toBeUndefined();
  });

  it('AXIS_QID covers all 22 news axes', () => {
    expect(Object.keys(AXIS_QID).sort()).toEqual([...HOT_NEWS_CATEGORIES].sort());
    for (const key of HOT_NEWS_CATEGORIES) expect(AXIS_QID[key], key).toMatch(QID);
    expect(AXIS_QID.law).toBe('Q7748');
    expect(AXIS_QID.disaster).toBe('Q3839081');
    // REV-29 M2.2: the split halves carry their own items.
    expect(AXIS_QID.health).toBe('Q12147');
    expect(AXIS_QID.conflict).toBe('Q350604');
  });

  it('every locale default place carries its city QID', () => {
    for (const locale of routing.locales) {
      expect(DEFAULT_PLACE[locale], locale).toBeTruthy();
      expect(DEFAULT_PLACE[locale].qid, locale).toMatch(QID);
      expect(DEFAULT_PLACE[locale].countryCode, locale).toMatch(/^[A-Z]{2}$/);
    }
    expect(DEFAULT_PLACE.ko.qid).toBe('Q8684'); // Seoul
    expect(DEFAULT_PLACE.et.qid).toBe('Q1770'); // Tallinn
  });

  it('slot QIDs stay Wikidata ids (the weather slot anchors on Q11663)', () => {
    for (const qid of Object.values(SLOT_QID)) expect(qid).toMatch(QID);
    expect(SLOT_QID.weather).toBe('Q11663');
  });
});
