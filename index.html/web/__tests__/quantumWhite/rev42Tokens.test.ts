import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Module-level test isolation (CLAUDE.md) -- pure static-text assertions
// over the shipped stylesheet and the retired-slot surface, no Supabase, no
// other module's fixtures. Guards the REV-42 selector families (SPEC.md D-9,
// 1-A #9) the way rev15Tokens / rev17Tokens guard theirs: the six new
// prefixes must exist inside the §30 block of quantum-white-rev19.css, the
// block must stay blur-free (doctrine rule: glass is one layer), the white
// surface must be re-keyed for the new families, and nothing may style the
// retired `air` slot again (IMPECCABLE TASTE rule 13: a new selector family
// ships with its guard in the same commit).

const WEB = join(__dirname, '../..');
const SHEET = readFileSync(join(WEB, 'app/quantum-white-rev19.css'), 'utf8');
const BEGIN = '§30 REV-42';
const END = '§30 REV-42 -- END';

function rev42Block(): string {
  const b = SHEET.indexOf(BEGIN);
  const e = SHEET.indexOf(END);
  expect(b, 'the §30 REV-42 block BEGIN marker is missing from quantum-white-rev19.css').toBeGreaterThanOrEqual(0);
  expect(e, 'the §30 REV-42 block END marker is missing from quantum-white-rev19.css').toBeGreaterThan(b);
  return SHEET.slice(b, e);
}

describe('REV-42 quantum-white-rev19.css §30 selector families (SPEC.md D-9)', () => {
  it('declares the six REV-42 families inside the §30 block', () => {
    const block = rev42Block();
    for (const prefix of ['.qw-moon', '.qw-air', '.qw-sky', '.qw-cosmos', '.qw-gastro', '.qw-detail-open']) {
      expect(block, prefix).toContain(prefix);
    }
  });

  it('keeps the §30 block blur-free and never reuses the radar / fx families', () => {
    const block = rev42Block();
    expect(block).not.toMatch(/backdrop-filter\s*:/);
    expect(block).not.toMatch(/(^|[^-\w])filter\s*:\s*blur/);
    // The rain radar (§28) and the omni-radar / fx hero (§29) own these names.
    expect(block).not.toMatch(/\.qw-radar-[a-z]/);
    expect(block).not.toMatch(/\.qw-fx-[a-z]/);
  });

  it('re-keys the new families for the white surface', () => {
    const block = rev42Block();
    const white = block.match(/html\[data-unitas-surface='quantum-white'\][^{]*\{/g) ?? [];
    expect(white.length, 'no white-surface re-key inside §30').toBeGreaterThan(0);
    for (const prefix of ['.qw-moon', '.qw-air', '.qw-sky', '.qw-cosmos', '.qw-gastro', '.qw-detail-open']) {
      expect(white.some((rule) => rule.includes(prefix)), `${prefix} has no quantum-white re-key`).toBe(true);
    }
  });

  it('never styles the retired air slot again, in any shipped sheet', () => {
    for (const sheet of ['globals.css', 'quantum-white.css', 'quantum-white-rev19.css', 'unitas-hub.css']) {
      const css = readFileSync(join(WEB, 'app', sheet), 'utf8');
      expect(css, `${sheet} styles [data-slot="air"]`).not.toMatch(/data-slot(?:-card)?=["']air["']/);
    }
  });
});
