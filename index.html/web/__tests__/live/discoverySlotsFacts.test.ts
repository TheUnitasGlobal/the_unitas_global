import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// REV-34 M1-C (docs/rev34/SPEC.md §1.5, §3.2): the large "하위 정보 1위"
// under a card title was the loader re-emitting items[0]'s title / name /
// handle as an emphasised fact. The nine such facts are cut at the source.
// The network-backed loaders cannot run here, so this is a static guard on
// the module text: none of the nine label keys may come back, and no fact
// may be built from a first item's title again. Numeric emphasised facts
// (temperature, magnitude, price, AQI, GDP...) are untouched.

const source = readFileSync(path.resolve(__dirname, '../../lib/live/discoverySlots.ts'), 'utf8');

const TITLE_DUPLICATE_FACT_KEYS = [
  'Rev20.slots.facts.firstEvent',
  'Rev20.slots.facts.rank1',
  'Rev20.slots.facts.topStory',
  'Rev20.slots.facts.paperTitle',
  'Rev20.slots.facts.bookTitle',
  'Rev20.slots.facts.artTitle',
  'Rev20.slots.facts.nearbyTitle',
  'Rev21.slots.facts.topRank',
  'Rev21.slots.facts.topOperator',
];

describe('discovery slot facts (REV-34 M1-C)', () => {
  it('emits none of the nine title-duplicate facts', () => {
    for (const key of TITLE_DUPLICATE_FACT_KEYS) {
      expect(source.includes(`'${key}'`), key).toBe(false);
    }
  });

  it('never builds an emphasised fact from a first item title, name or handle', () => {
    const emphasised = source.match(/\{[^{}]*emphasis:\s*true[^{}]*\}/g) ?? [];
    expect(emphasised.length).toBeGreaterThan(0);
    for (const fact of emphasised) {
      expect(fact).not.toMatch(/items\[0\]\.title|top\.title|top\.name|top\.display_name|obj\.title|rows\[0\]\?\.handle/);
    }
  });

  it('keeps the numeric emphasised facts the cards still lead with', () => {
    for (const key of ['tempNow', 'maxMag', 'btcPrice', 'nationGdp']) {
      expect(source, key).toMatch(new RegExp(`Rev20\\.slots\\.facts\\.${key}'[^\\n]*emphasis: true`));
    }
  });
});
