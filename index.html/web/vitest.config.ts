import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Module-isolation policy (see CLAUDE.md "Module-level test isolation"):
// vitest's default per-file worker isolation already guarantees one module's
// test file can never leak state into another's, so `isolate` is left at its
// default (true) rather than disabled for speed. Node environment only --
// registry/module tests here check data shape, not rendered UI, so jsdom
// would just add startup cost for nothing.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    // Vitest's 5000ms default was never a decision this repo made, and it made
    // the primary gate a coin flip. Several specs police the tree by walking it
    // synchronously -- __tests__/square/failOpenRegression.test.ts statSync's
    // every entry under app/, components/ and lib/ and readFileSync's every
    // .ts/.tsx it finds. Measured 2026-09-18 on this machine: 611ms when that
    // file runs alone, 6523ms when it runs inside the full 127-file suite under
    // worker contention -- i.e. past the default, so `npm --prefix web run test`
    // failed roughly half the time on code that was entirely correct, and
    // "EXIT 0" could not mean anything (제13장). This is a low-spec Windows
    // machine under Low-Memory Armor; I/O-bound policing specs need headroom.
    //
    // 20s still catches a genuine hang (the slowest honest test here is ~7s),
    // it just stops calling contention a failure. If a test ever needs more
    // than this, the test is wrong, not the budget.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
