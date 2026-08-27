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
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
