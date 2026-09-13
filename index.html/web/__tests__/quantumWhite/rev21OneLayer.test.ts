import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// REV-21 SPEC.md §4.3 row 2 ("one layer") + §4B R-1 -- the white surface's
// panels carry no backdrop-filter of their own (only the nav and ONE
// viewport backdrop may), the refresh pre-stamp CSS hides the gate on a
// known phase, and the void pools no longer run a 60px filter blur.

const read = (rel: string) => readFileSync(join(__dirname, '../../app', rel), 'utf8');

/** The rule body for the first rule whose selector contains `needle`. */
function ruleBody(css: string, needle: string): string {
  const idx = css.indexOf(needle);
  if (idx < 0) return '';
  const open = css.indexOf('{', idx);
  const close = css.indexOf('}', open);
  return css.slice(open, close);
}

describe('REV-21 one-layer principle', () => {
  const rev19 = read('quantum-white-rev19.css');
  const qw = read('quantum-white.css');
  const globals = read('globals.css');

  it.each([
    ['.qw-footer {', rev19],
    ["[data-unitas-portal] .glow-box", rev19],
    ["[role='dialog'].bg-quantum\\/95", rev19],
    ['.qw-search-dropdown {', rev19],
    ['.qw-keyword-panel {', rev19],
    ['#omni-synapse-search {', qw],
    ['.qw-void-pool {', qw],
  ])('%s carries no backdrop-filter / filter blur of its own', (selector, css) => {
    const body = ruleBody(css, selector);
    expect(body.length, selector).toBeGreaterThan(0);
    expect(body, selector).not.toMatch(/backdrop-filter\s*:\s*(?!none)/);
    expect(body, selector).not.toMatch(/(^|[^-])filter\s*:\s*blur/);
  });

  it('strips the Tailwind blur utilities inside the portal and the zoom tree, keeping the light viewport backdrop', () => {
    expect(rev19).toMatch(/\[data-unitas-portal\] \.backdrop-blur-md,[\s\S]*?backdrop-filter: none;/);
    expect(rev19).not.toMatch(/\[data-unitas-portal\] \.backdrop-blur-sm/);
  });

  it('R-1: hides the entry gate on a pre-stamped non-gate phase and tints the restore void in the home ground', () => {
    expect(globals).toContain("html[data-cinema-phase]:not([data-cinema-phase='gate']) .cs-gate");
    expect(ruleBody(globals, "html[data-cinema-phase]:not([data-cinema-phase='gate']) .cs-gate")).toContain('display: none');
    expect(ruleBody(globals, "html[data-cinema-restore='released'] .cs-root")).toContain('var(--qw-bg');
    // The invariant: no rule ever hides the curtain root itself on a stamp.
    expect(globals).not.toMatch(/\[data-cinema-(phase|restore)[^\]]*\][^{]*\.cs-root[^{]*\{[^}]*display\s*:\s*none/);
  });

  it('pauses every surface keyframe while the tab is hidden', () => {
    expect(ruleBody(globals, "html[data-page-hidden='1'][data-unitas-surface='quantum-white'] *")).toContain('animation-play-state: paused');
  });
});
