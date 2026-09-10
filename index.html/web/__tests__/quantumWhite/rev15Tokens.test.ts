import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Module-level test isolation (CLAUDE.md) -- pure static-CSS-text
// assertions, no Supabase, no other module's fixtures. Guards the REV-15
// token surface (SPEC.md §5) as plain string-presence checks against the
// actual stylesheet text -- cheap, and it catches an accidental rename or
// deletion during a later refactor without needing a full CSS parser.

const QW_CSS = readFileSync(join(__dirname, '../..', 'app/quantum-white.css'), 'utf8');
const GLOBALS_CSS = readFileSync(join(__dirname, '../..', 'app/globals.css'), 'utf8');

describe('REV-15 quantum-white.css tokens (SPEC.md §1, §4, §5)', () => {
  it('declares --qw-lum-pct with a 100% default', () => {
    expect(QW_CSS).toContain('--qw-lum-pct: 100%;');
  });

  it('color-mix()-composites --qw-bg/-bg-2/-glass-solid/-nav-bg under an @supports gate', () => {
    expect(QW_CSS).toMatch(/@supports \(color: color-mix\(in srgb, #fff 50%, #000\)\) \{/);
    expect(QW_CSS).toContain('--qw-bg: color-mix(in srgb, #ffffff var(--qw-lum-pct), #000000);');
    expect(QW_CSS).toContain('--qw-bg-2: color-mix(in srgb, #f6f7fa var(--qw-lum-pct), #000000);');
    expect(QW_CSS).toContain('--qw-glass-solid: color-mix(in srgb, rgba(255, 255, 255, 0.86) var(--qw-lum-pct), rgba(0, 0, 0, 0.86));');
    expect(QW_CSS).toContain('--qw-nav-bg: color-mix(in srgb, rgba(255, 255, 255, 0.94) var(--qw-lum-pct), rgba(0, 0, 0, 0.94));');
  });

  it('the Quantum White body rule no longer sets `filter`', () => {
    const bodyRuleMatch = QW_CSS.match(/html\[data-unitas-surface='quantum-white'\] body \{([^}]*)\}/);
    expect(bodyRuleMatch, 'quantum-white.css should still have a `body {}` rule').not.toBeNull();
    expect(bodyRuleMatch![1]).not.toMatch(/\bfilter\s*:/);
  });

  // The REV-15 "rich tile interior" token/selector list (--qw-tile-desc-*,
  // --qw-tile-kind-size, .qw-tile-kind, .qw-tile-desc, .qw-tile-foot) was
  // retired REV-17 along with the kind badge / coin-chip tile interior --
  // see __tests__/quantumWhite/rev17Tokens.test.ts for its successor.

  it('gives .qw-popout-body/.qw-tile-grid an explicit stretch/min-height:0 geometry fix (SPEC.md §4.1)', () => {
    const bodyRule = QW_CSS.match(/html\[data-unitas-surface='quantum-white'\] \.qw-popout-body \{([^}]*)\}/);
    expect(bodyRule, '.qw-popout-body base rule').not.toBeNull();
    expect(bodyRule![1]).toMatch(/align-items:\s*stretch/);

    const gridRule = QW_CSS.match(/html\[data-unitas-surface='quantum-white'\] \.qw-tile-grid \{([^}]*)\}/);
    expect(gridRule, '.qw-tile-grid base rule').not.toBeNull();
    expect(gridRule![1]).toMatch(/grid-auto-rows:\s*max-content/);
    expect(gridRule![1]).toMatch(/width:\s*100%/);
  });
});

describe('REV-15 globals.css tokens (SPEC.md §2, §3, §5)', () => {
  it('declares --u-flag-radius / --u-flag-ring on :root', () => {
    expect(GLOBALS_CSS).toContain('--u-flag-radius: 3px;');
    expect(GLOBALS_CSS).toMatch(/--u-flag-ring:\s*0 0 0 1px rgba\(255, 255, 255, 0\.38\)/);
  });

  it('declares .u-flag / .cs-root / .cs-gate utility classes', () => {
    expect(GLOBALS_CSS).toMatch(/\.u-flag\s*\{/);
    expect(GLOBALS_CSS).toMatch(/\.cs-root\s*\{/);
    expect(GLOBALS_CSS).toMatch(/\.cs-gate\s*\{/);
  });

  it('gives the short-landscape founder sealed variant a media override (SPEC.md §2.4)', () => {
    expect(GLOBALS_CSS).toMatch(/@media \(max-height:\s*480px\)\s*\{/);
    expect(GLOBALS_CSS).toContain('.cs-sealed[data-founder] .cs-founder-door');
    expect(GLOBALS_CSS).toContain('.cs-sealed[data-founder] .cs-founder-note');
  });
});
