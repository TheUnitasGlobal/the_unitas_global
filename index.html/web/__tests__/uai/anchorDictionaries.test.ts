import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';
import { AXIS_QID, HOT_NEWS_CATEGORIES } from '@/lib/live/hotNews';
import { DEFAULT_PLACE } from '@/lib/live/useLiveWeather';
import { SLOT_QID } from '@/lib/live/discoverySlots';

// REV-21 SPEC.md §12.3 (h) -- the QID dictionaries every omni-open host
// anchors on. Each id was verified against Wikidata on 2026-09-12; these
// tests pin shape and coverage so an axis or locale added later cannot
// ship without its anchor. REV-35 M1 (D-2): the world-ranking dictionaries
// (THEME_QID / RANKING_ENTRY_QID) were deleted with lib/globalRankings.ts.

const QID = /^Q\d+$/;

describe('anchor dictionaries', () => {
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

  it('slot QIDs stay Wikidata ids (the weather slot anchors on Q11663; the retired U-Ranking seat has none)', () => {
    for (const qid of Object.values(SLOT_QID)) expect(qid).toMatch(QID);
    expect(SLOT_QID.weather).toBe('Q11663');
    // REV-41 D-7 retired the U-Ranking seat from the rail, so its key is no
    // longer a SlotKey -- the guard reads the table by string on purpose.
    expect(Object.keys(SLOT_QID)).not.toContain('uRanking');
  });
});
