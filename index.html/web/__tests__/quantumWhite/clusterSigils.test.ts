import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Module-level test isolation (CLAUDE.md) -- static-source-text assertions
// only, mirroring how rev15/rev17Tokens.test.ts guard quantum-white.css:
// clusterSigils.tsx is JSX, and this suite's vitest config (deliberately,
// per CLAUDE.md "Module-level test isolation" -- data-shape checks, not a
// rendering harness) has no `@vitejs/plugin-react`/esbuild JSX override, so
// importing it directly fails Vite's transform under `tsconfig.json`'s
// `jsx: "preserve"` (Next's own SWC does that transform at build time, not
// Vite/esbuild here). Reading the source as text sidesteps that entirely.

const SIGILS_SOURCE = readFileSync(
  join(__dirname, '../../lib/quantumWhite/clusterSigils.tsx'),
  'utf8',
);

const ALL_KEYS = ['cognitive', 'live', 'lockin', 'enterprise'] as const;

describe('clusterSigils.tsx (SPEC.md §4.2)', () => {
  it('maps all four cluster keys to a sigil in SIGILS', () => {
    for (const key of ALL_KEYS) {
      expect(SIGILS_SOURCE, key).toMatch(new RegExp(`${key}:\\s*\\w+Sigil`));
    }
  });

  it('gives every sigil the common decorative SVG contract', () => {
    expect(SIGILS_SOURCE).toContain("viewBox: VIEW_BOX");
    expect(SIGILS_SOURCE).toContain("fill: 'none'");
    expect(SIGILS_SOURCE).toContain("'aria-hidden': true");
    expect(SIGILS_SOURCE).toContain("const VIEW_BOX = '0 0 64 64'");
  });

  it("regenerates the lock-in 'Trefoil' path identically via scripts/gen-sigils.mjs", () => {
    const scriptPath = join(__dirname, '../../../scripts/gen-sigils.mjs');
    const regenerated = execFileSync('node', [scriptPath], { encoding: 'utf8' }).trim();
    expect(SIGILS_SOURCE, 'TREFOIL_PATH literal').toContain(regenerated);
  });
});
