import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';
import { CONTENT_KINDS, STAGE1_KINDS, STAGE2_KINDS, streamRecipe, wikimediaCost, STREAM_PAGE_CAP, WIKIMEDIA_PAGE_BUDGET } from '@/lib/uai/stream/streamTypes';

// REV-21 §5C / D-37. M8 shipped the stage 1 kinds but never merged their
// `Rev21.stream.*` draft into web/messages, so every stream card would have
// thrown MISSING_MESSAGE in production -- and rev21Parity did not catch it,
// because it only compares the locales to EACH OTHER. This suite closes that
// hole from the other side: every kind the recipe can emit must have a label
// in every locale's shipped messages, and every fact label a leg can set
// must resolve too.

type Messages = Record<string, unknown>;

function streamNs(locale: string): Messages {
  const all = JSON.parse(readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8')) as {
    Rev21?: { stream?: Messages };
  };
  return all.Rev21?.stream ?? {};
}

/** Fact labels the ladder legs can set (non-literal ones go through i18n). */
const FACT_LABELS = [
  'editions',
  'instanceOf',
  'entity',
  'views30',
  'trend',
  'window',
  'passage',
  'population',
  'gdp',
  'gdpPerCapita',
  'lifeExpectancy',
  'internetUsers',
  'area',
  'elevation',
  'hdi',
  'events',
  'quakes',
] as const;

describe('REV-21 stream kind parity', () => {
  it('stage 1 + stage 2 make up every content kind, with no overlap', () => {
    expect(STAGE1_KINDS).toHaveLength(16);
    expect(STAGE2_KINDS).toHaveLength(11);
    expect(CONTENT_KINDS).toHaveLength(27);
    expect(new Set(CONTENT_KINDS).size).toBe(27);
    for (const k of STAGE2_KINDS) expect(STAGE1_KINDS).not.toContain(k);
  });

  it('the recipe only ever emits known kinds, and reaches every stage 2 kind', () => {
    const emitted = new Set<string>();
    for (let page = 0; page <= STREAM_PAGE_CAP; page++) {
      for (const kind of streamRecipe(page)) {
        expect(CONTENT_KINDS, `page ${page}`).toContain(kind);
        emitted.add(kind);
      }
    }
    for (const kind of STAGE2_KINDS) expect(emitted, `${kind} is unreachable`).toContain(kind);
  });

  it.each(routing.locales)('%s labels every content kind and every fact', (locale) => {
    const ns = streamNs(locale);
    const kinds = (ns.kinds ?? {}) as Record<string, unknown>;
    const fields = (ns.fields ?? {}) as Record<string, unknown>;
    const missingKinds = CONTENT_KINDS.filter((k) => typeof kinds[k] !== 'string' || !(kinds[k] as string).trim());
    const missingFields = FACT_LABELS.filter((f) => typeof fields[f] !== 'string' || !(fields[f] as string).trim());
    expect(missingKinds, `${locale}: unlabelled kinds`).toEqual([]);
    expect(missingFields, `${locale}: unlabelled fact fields`).toEqual([]);
  });

  it('every page stays inside the Wikimedia family budget', () => {
    for (let page = 1; page <= STREAM_PAGE_CAP; page++) {
      const cost = wikimediaCost(streamRecipe(page));
      expect(cost, `page ${page} costs ${cost} Wikimedia requests`).toBeLessThanOrEqual(WIKIMEDIA_PAGE_BUDGET);
    }
  });
});
