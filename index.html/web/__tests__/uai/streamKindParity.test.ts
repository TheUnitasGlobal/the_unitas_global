import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';
import {
  CONTENT_KINDS,
  STREAM_PAGE_CAP,
  WIKIMEDIA_PAGE_BUDGET,
  streamRecipe,
  wikimediaCost,
} from '@/lib/uai/stream/streamTypes';

// A stream kind with no label in some locale throws MISSING_MESSAGE in
// production, and the rev21Parity check cannot see it -- that one only
// compares the locales to EACH OTHER, so a key missing from all of them
// passes. This suite closes the hole from the other side: every kind the
// recipe can emit must have a label in every locale's SHIPPED messages.
//
// REV-23 M2.2 rewrote it for the eleven-kind diet: the assertion is no
// longer "stage 1 + stage 2 = 27" but "the surviving eleven, and nothing
// else, ever reaches the renderer".

type Messages = Record<string, unknown>;

function streamNs(locale: string): Messages {
  const all = JSON.parse(readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8')) as {
    Rev21?: { stream?: Messages };
  };
  return all.Rev21?.stream ?? {};
}

/** Fact labels the surviving ladder legs can set (non-literal ones go
 *  through i18n). Trimmed with the legs that produced the others. */
const FACT_LABELS = ['views30', 'trend', 'window', 'passage', 'editions'] as const;

/** The kinds of the founder's directive, spelled out here so the test fails
 *  loudly if a deleted kind is ever reintroduced by accident. REV-23 named
 *  eleven; REV-32 M2 added the swarm's door as a twelfth -- a NEW kind the
 *  founder asked for, not one of the sixteen REV-23 retired (those are still
 *  listed in DELETED_KINDS below and still may never come back). */
const FOUNDER_KINDS = [
  'sources',
  'omni',
  'swarm',
  'concepts',
  'sites',
  'news',
  'derived',
  'attention',
  'community',
  'graph',
  'global',
  'extracts',
] as const;

/** Kinds REV-23 deleted. None of these may come back through the recipe. */
const DELETED_KINDS = [
  'essence',
  'axisSpectrum',
  'chain',
  'deepGate',
  'identity',
  'redesign',
  'cogs',
  'timeline',
  'visual',
  'papers',
  'backlinks',
  'siblings',
  'shelf',
  'art',
  'number',
  'earthEvents',
] as const;

describe('stream kind parity (REV-23 eleven-kind diet)', () => {
  it('the content kinds are exactly the founder-named twelve', () => {
    expect([...CONTENT_KINDS].sort()).toEqual([...FOUNDER_KINDS].sort());
    expect(new Set(CONTENT_KINDS).size).toBe(12);
  });

  it('the recipe only ever emits those eleven, and reaches every one of them', () => {
    const emitted = new Set<string>();
    for (let page = 0; page <= STREAM_PAGE_CAP; page++) {
      for (const kind of streamRecipe(page)) {
        expect(CONTENT_KINDS, `page ${page}`).toContain(kind);
        emitted.add(kind);
      }
    }
    for (const kind of FOUNDER_KINDS) expect(emitted, `${kind} is unreachable`).toContain(kind);
  });

  it('no deleted kind can reappear in any page of the recipe', () => {
    const emitted = new Set<string>();
    for (let page = 0; page <= STREAM_PAGE_CAP; page++) streamRecipe(page).forEach((k) => emitted.add(k));
    for (const dead of DELETED_KINDS) expect(emitted, `${dead} was resurrected`).not.toContain(dead);
  });

  it('page 0 is the web synthesis and nothing else', () => {
    expect(streamRecipe(0)).toEqual(['sources']);
  });

  it('page 1 always carries the single outbound surface, the omni-open pair', () => {
    expect(streamRecipe(1)).toContain('omni');
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

  it.each(routing.locales)('%s carries no label for a deleted kind', (locale) => {
    const kinds = (streamNs(locale).kinds ?? {}) as Record<string, unknown>;
    const zombies = DELETED_KINDS.filter((k) => typeof kinds[k] === 'string');
    expect(zombies, `${locale}: copy left behind for deleted kinds`).toEqual([]);
  });

  it('every page stays inside the Wikimedia family budget', () => {
    for (let page = 1; page <= STREAM_PAGE_CAP; page++) {
      const cost = wikimediaCost(streamRecipe(page));
      expect(cost, `page ${page} costs ${cost} Wikimedia requests`).toBeLessThanOrEqual(WIKIMEDIA_PAGE_BUDGET);
    }
  });
});
