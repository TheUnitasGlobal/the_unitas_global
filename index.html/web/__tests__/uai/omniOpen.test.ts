import { describe, expect, it } from 'vitest';
import {
  OMNI_SOURCE_ROW,
  OUTBOUND_BRAND_ROW,
  omniOpenUrl,
  outboundSearchUrl,
  sourceById,
  sourceLabel,
} from '@/lib/uai/sourceRegistry';

/**
 * REV-31 M1-M3 (founder directive 2026-09-15) -- the contract behind the
 * omni-open block that replaced the REV-21 "더 깊이 탐색" block.
 *
 * The block itself is a client component (next-intl, lucide, React), and this
 * suite runs in the node environment by policy, so what is pinned here is the
 * part that can actually be wrong: the DATA RULE that makes the two rows
 * impossible to render empty. The DOM rules -- the pairing, the ordering and
 * the pixel-identical headings -- are pinned in the browser by
 * tests/web-cinema-e2e/rev29-verify.spec.js ("M2.4 / REV-31").
 */

const TERM = '공기';
const ENCODED = encodeURIComponent(TERM);

describe('REV-31 omni-open rows', () => {
  it('the sources row and the platform row name different things', () => {
    const overlap = OMNI_SOURCE_ROW.filter((id) => (OUTBOUND_BRAND_ROW as readonly string[]).includes(id));
    expect(overlap, 'a source must not also be listed as a platform').toEqual([]);
    expect(OMNI_SOURCE_ROW.length).toBeGreaterThanOrEqual(3);
    expect(OUTBOUND_BRAND_ROW.length).toBeGreaterThanOrEqual(3);
  });

  it('every row entry is a real registry source with a label in both locales', () => {
    for (const id of [...OMNI_SOURCE_ROW, ...OUTBOUND_BRAND_ROW]) {
      expect(sourceById(id), id).toBeTruthy();
      expect(sourceLabel(id, 'en').trim().length, `${id} en label`).toBeGreaterThan(0);
      expect(sourceLabel(id, 'ko').trim().length, `${id} ko label`).toBeGreaterThan(0);
      expect(sourceById(id).homepage, `${id} homepage`).toMatch(/^https:\/\//);
    }
  });

  /**
   * THE INVARIANT THAT MATTERS. Before REV-31 the sources row held only the
   * Wikipedia and Wikidata links, both gated on the anchor carrying a QID --
   * so five shipped call sites (the operator profile, Shorts, the news story
   * popup, the UNITAS ranking branch and the `nearby` slot) would have
   * rendered a titled row with nothing under it. Every row entry now answers
   * a BARE TERM, so an identifier buys precision, never presence.
   */
  it('every row entry answers a bare term with a search that carries the term', () => {
    for (const id of [...OMNI_SOURCE_ROW, ...OUTBOUND_BRAND_ROW]) {
      const url = omniOpenUrl(id, TERM, 'ko');
      expect(url, `${id} must be a real URL`).toMatch(/^https:\/\//);
      expect(url, `${id} must search for the term, not land on a homepage`).toContain(ENCODED);
      expect(url, `${id} must not be the bare homepage`).not.toBe(sourceById(id).homepage);
    }
  });

  it('an identifier upgrades the two wiki sources to the exact article', () => {
    const identity = { qid: 'Q11663', localeTitle: '날씨 예보' };
    expect(omniOpenUrl('wikipedia', TERM, 'ko', identity)).toBe(
      `https://ko.wikipedia.org/wiki/${encodeURIComponent('날씨_예보')}`,
    );
    expect(omniOpenUrl('wikidata', TERM, 'ko', identity)).toBe('https://www.wikidata.org/wiki/Q11663');
  });

  it('a half-known identity still degrades to a search rather than a dead link', () => {
    // A QID with no locale title cannot name an article, so Wikipedia falls
    // back; Wikidata only ever needs the QID.
    expect(omniOpenUrl('wikipedia', TERM, 'ko', { qid: 'Q11663' })).toBe(outboundSearchUrl('wikipedia', TERM, 'ko'));
    expect(omniOpenUrl('wikidata', TERM, 'ko', { localeTitle: '공기' })).toBe(outboundSearchUrl('wikidata', TERM, 'ko'));
  });

  it('a platform is never upgraded by an identifier -- it always searches', () => {
    const identity = { qid: 'Q11663', localeTitle: '날씨 예보' };
    for (const id of OUTBOUND_BRAND_ROW) {
      expect(omniOpenUrl(id, TERM, 'ko', identity), id).toBe(outboundSearchUrl(id, TERM, 'ko'));
    }
  });

  it('the language reaches the language-qualified wiki hosts', () => {
    expect(omniOpenUrl('wikipedia', TERM, 'ja')).toContain('https://ja.wikipedia.org/');
    expect(omniOpenUrl('wiktionary', TERM, 'de')).toContain('https://de.wiktionary.org/');
    // Wikidata and Commons are single-host projects: no language prefix.
    expect(omniOpenUrl('wikidata', TERM, 'ja')).toContain('https://www.wikidata.org/');
    expect(omniOpenUrl('wikimediaCommons', TERM, 'ja')).toContain('https://commons.wikimedia.org/');
  });

  it('the compact slice of the sources row is still a usable row', () => {
    // components/home/OmniOpen.tsx takes the first three on tight surfaces.
    const compact = OMNI_SOURCE_ROW.slice(0, 3);
    expect(compact.length).toBe(3);
    expect(compact).toContain('wikipedia');
    expect(compact).toContain('wikidata');
  });
});
