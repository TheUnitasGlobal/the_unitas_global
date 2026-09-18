import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * IMPECCABLE TASTE — the doctrine's own fail-closed guard.
 *
 * Founder directive 2026-09-18, MISSION 2: inject an "Impeccable Taste"
 * frontend design doctrine into the canonical rules PERMANENTLY.
 *
 * A doctrine that lives only in prose is not injected, it is merely written.
 * Prose below the UNITAS-CODEX-VERBATIM END marker in the operational
 * CLAUDE.md is hashed by no gate, `sync-codex --write` cannot repair it, and
 * `docs/` is outside every summary list — so all three surfaces this doctrine
 * lives on can be deleted, truncated or silently contradicted with a green
 * build. That is exactly the shape of the drift that has recurred nine times
 * in this repository's doctrine history.
 *
 * This spec is what makes "영구 주입" mean something: the doctrine file, its
 * binding clause in the system rules, the rule file the other engines read,
 * the motion tokens the doctrine names, and the role charters that enforce it
 * must all still be there and still agree. Remove any one of them and the
 * primary gate (`npm --prefix web run test`) goes red.
 *
 * Module-level test isolation (CLAUDE.md): pure static-text assertions, no
 * Supabase, no fixtures shared with any other module's spec.
 */

const OPS_ROOT = join(__dirname, '../../..');
const WEB = join(__dirname, '../..');

const DOCTRINE_REL = 'docs/process/IMPECCABLE_TASTE.md';
const doctrine = () => readFileSync(join(OPS_ROOT, DOCTRINE_REL), 'utf8');

/** The four motion tokens rule 7 names as the single source of truth. */
const MOTION_TOKENS = ['--qw-ease', '--qw-dur-fast', '--qw-dur', '--qw-dur-slow'];

/**
 * The tests the doctrine's §4 table claims enforce it. If one of these is
 * deleted the table becomes a false claim, which is worse than no table.
 */
const CLAIMED_GUARDS = [
  '__tests__/quantumWhite/rev15FixedLayerGuard.test.ts',
  '__tests__/quantumWhite/rev21OneLayer.test.ts',
  '__tests__/quantumWhite/impeccableTaste.test.ts',
];

describe('IMPECCABLE TASTE — the doctrine exists and is complete', () => {
  it('the canonical doctrine file is present', () => {
    expect(existsSync(join(OPS_ROOT, DOCTRINE_REL)), DOCTRINE_REL + ' is missing').toBe(true);
  });

  it('declares all fifteen rules, each exactly once', () => {
    const text = doctrine();
    for (let n = 1; n <= 15; n += 1) {
      const hits = text.split('**규칙 ' + n + ' · ').length - 1;
      expect(hits, '규칙 ' + n + ' appears ' + hits + ' time(s), expected exactly 1').toBe(1);
    }
  });

  it('every rule the table calls machine-enforced points at a spec that exists', () => {
    // §4 of the doctrine claims these files enforce rules 1, 2 and 7. A claim
    // of enforcement that cannot be executed is the failure mode rule 13 is
    // written to forbid, so the doctrine must not be able to make one.
    for (const rel of CLAIMED_GUARDS) {
      expect(existsSync(join(WEB, rel)), 'doctrine §4 claims ' + rel + ' enforces it, but it is gone').toBe(
        true,
      );
    }
  });

  it('states the two places generic design advice contradicts this repo', () => {
    const text = doctrine();
    // The whole reason the doctrine is repo-specific rather than generic.
    expect(text).toMatch(/backdrop-filter/);
    expect(text).toMatch(/eyebrow/i);
  });
});

describe('IMPECCABLE TASTE — the doctrine is bound into the rules the engines load', () => {
  it('the operational CLAUDE.md carries the binding clause and points at the canon', () => {
    const text = readFileSync(join(OPS_ROOT, 'CLAUDE.md'), 'utf8');
    expect(text, 'CLAUDE.md lost the §0 부록-B IMPECCABLE TASTE section').toMatch(
      /§0 부록-B\. IMPECCABLE TASTE/,
    );
    expect(text, 'CLAUDE.md no longer points at ' + DOCTRINE_REL).toContain(DOCTRINE_REL);
  });

  it('the binding clause carries the three non-negotiables inline, not just a pointer', () => {
    // A pointer alone fails open: an engine that never opens the linked file
    // still reads CLAUDE.md every session. The three most expensive rules are
    // therefore duplicated into the clause on purpose.
    const text = readFileSync(join(OPS_ROOT, 'CLAUDE.md'), 'utf8');
    expect(text, 'the containing-block ban is gone from the binding clause').toMatch(
      /dashboard-zoom[\s\S]{0,400}backdrop-filter[\s\S]{0,400}will-change/,
    );
    expect(text, 'the one-layer glass rule is gone from the binding clause').toContain('#unitas-nav');
    expect(text, 'the motion-token rule is gone from the binding clause').toContain('--qw-ease');
  });

  it('the .roo rule file relays the same binding to the other engines', () => {
    const rel = join('.roo', 'rules', 'unitas-impeccable-taste.md');
    expect(existsSync(join(OPS_ROOT, rel)), rel + ' is missing').toBe(true);
    const text = readFileSync(join(OPS_ROOT, rel), 'utf8');
    expect(text, rel + ' no longer points at ' + DOCTRINE_REL).toContain(DOCTRINE_REL);
    // Chapter 4 forbids auxiliary agent CLIs; this file living under .roo/ must
    // keep saying why that is not what it is.
    expect(text, rel + ' must state that .roo/ is a doctrine path, not a Roo Code integration').toMatch(
      /제4장/,
    );
  });

  it('the review lenses that enforce the reviewable rules cite the doctrine', () => {
    // Rules 3,4,5,6,8,9,10,11,12,13,14,15 are review-enforced. A charter that
    // does not name the doctrine cannot enforce it.
    for (const charter of ['unitas-code-reviewer.agent.md', 'unitas-ux-reviewer.agent.md']) {
      const text = readFileSync(join(OPS_ROOT, '.github', 'agents', charter), 'utf8');
      expect(text, charter + ' does not cite ' + DOCTRINE_REL).toContain(DOCTRINE_REL);
    }
  });
});

describe('IMPECCABLE TASTE — rule 7: the motion vocabulary is a single source of truth', () => {
  const globals = () => readFileSync(join(WEB, 'app/globals.css'), 'utf8');

  it('globals.css declares every motion token the doctrine names', () => {
    const css = globals();
    for (const token of MOTION_TOKENS) {
      // `--qw-dur:` must not be satisfied by `--qw-dur-fast:`, so anchor on the
      // colon that ends the declaration's property name.
      expect(css, token + ' is not declared in web/app/globals.css').toMatch(
        new RegExp(token.replace(/-/g, '\\-') + '\\s*:'),
      );
    }
  });

  it('the motion tokens live on the surface-independent :root, not behind the white-surface prefix', () => {
    // Rule 3 governs tokens whose VALUE differs per surface. Timing is not a
    // color: if these were declared only under the quantum-white prefix they
    // would silently not exist on /omni-swarm and every other dark route
    // (rule 4's failure mode).
    const css = globals();
    const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
    for (const token of MOTION_TOKENS) {
      expect(rootBlock, token + ' is not in the bare :root block of globals.css').toContain(token + ':');
    }
  });

  it('the plurality easing curve is the one promoted, not a newly invented one', () => {
    // The tokens were chosen by census (cubic-bezier(0.2, 0.8, 0.2, 1) was
    // already the 7x plurality across the shipped sheets). Replacing the value
    // with a fresh curve would re-time every NEW animation site-wide, which is
    // a visual decision, not a refactor.
    expect(globals()).toMatch(/--qw-ease:\s*cubic-bezier\(0\.2,\s*0\.8,\s*0\.2,\s*1\)/);
  });
});
