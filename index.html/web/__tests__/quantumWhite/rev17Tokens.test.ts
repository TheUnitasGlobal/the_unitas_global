import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Module-level test isolation (CLAUDE.md) -- pure static-CSS-text
// assertions, no Supabase, no other module's fixtures. Guards the REV-17
// token/selector surface (SPEC.md §8) as plain string-presence checks
// against the actual stylesheet text, mirroring rev15Tokens.test.ts's
// approach: cheap, and it catches an accidental rename or a regressed
// reintroduction of a retired REV-15 interior without a full CSS parser.

const QW_CSS = readFileSync(join(__dirname, '../..', 'app/quantum-white.css'), 'utf8');
const GLOBALS_CSS = readFileSync(join(__dirname, '../..', 'app/globals.css'), 'utf8');

describe('REV-17 quantum-white.css tokens (SPEC.md §8)', () => {
  it('declares the curiosity-tile tokens', () => {
    const tokens = [
      '--qw-tile-min-w',
      '--qw-tile-gap',
      '--qw-tile-pad',
      '--qw-tile-min-h',
      '--qw-tile-medallion',
      '--qw-tile-icon',
      '--qw-tile-head-gap',
      '--qw-tile-title-size',
      '--qw-tile-riddle-size',
      '--qw-tile-riddle-lines',
      '--qw-tile-cue-w',
      '--qw-tile-cue-w-hover',
    ];
    for (const token of tokens) {
      expect(QW_CSS, token).toContain(`${token}:`);
    }
  });

  it('declares the curiosity-tile selectors, and never reintroduces the retired kind-badge/coin-chip interior', () => {
    const selectors = ['.qw-tile-head', '.qw-tile-medallion', '.qw-tile-title', '.qw-tile-riddle', '.qw-tile-cue'];
    for (const selector of selectors) {
      expect(QW_CSS, selector).toContain(selector);
    }
    // Only selector/rule forms, not the bare custom-property names -- those
    // legitimately appear in this file's own prose comments documenting
    // the retirement (e.g. "`--qw-tile-kind-size`, retired along with...").
    const retired = [
      '.qw-tile-kind {',
      '.qw-tile-desc {',
      '.qw-tile-foot {',
      '.qw-module-slide {',
      '.qw-tile-grid-hidden {',
      '@keyframes qw-sheet-enter',
      '.qw-cluster-dot {',
    ];
    for (const selector of retired) {
      expect(QW_CSS, `${selector} must not reappear`).not.toContain(selector);
    }
  });

  it('declares the Singularity Core sigil tokens/selectors', () => {
    expect(QW_CSS).toContain('--qw-sigil-size:');
    expect(QW_CSS).toContain('--qw-sigil-stroke:');
    expect(QW_CSS).toContain('--qw-cluster-title:');
    expect(QW_CSS).toContain('.qw-cluster-sigil');
    expect(QW_CSS).toContain('.qw-sigil-spin');
    expect(QW_CSS).toContain('.qw-cluster-title');
    expect(QW_CSS).toContain('.qw-cluster-tagline');
  });

  it('declares the Entry Gate tokens/selectors', () => {
    expect(QW_CSS).toContain('--qw-entry-max-w:');
    expect(QW_CSS).toContain('--qw-entry-stage-h:');
    expect(QW_CSS).toContain('--qw-entry-eyebrow:');
    for (const selector of [
      '.qw-entry-scroll',
      '.qw-entry-pay',
      '.qw-entry-stage',
      '.qw-entry-scenario',
      '.qw-entry-guide',
      '.qw-entry-notice',
      '.qw-entry-legal-link',
      '.qw-popout-enigma',
    ]) {
      expect(QW_CSS, selector).toContain(selector);
    }
  });

  it("gives the pop-out panel a data-view='entry' narrowed max-width rule", () => {
    expect(QW_CSS).toContain("[data-view='entry']");
  });
});

describe('REV-17 CTA tokens (SPEC.md §2)', () => {
  it('declares the QW-scoped CTA border/ring tokens and the breathing keyframe', () => {
    expect(QW_CSS).toContain('--qw-cta-line:');
    expect(QW_CSS).toContain('--qw-cta-ring:');
    expect(QW_CSS).toMatch(/@keyframes qw-cta-breathe\s*\{/);
  });

  it('gives the base (dark-theme) install CTA a real border declaration', () => {
    const rule = GLOBALS_CSS.match(/\.unitas-install-cta\s*\{([^}]*)\}/);
    expect(rule, '.unitas-install-cta base rule').not.toBeNull();
    expect(rule![1]).toMatch(/\bborder:\s*1px solid/);
  });
});
