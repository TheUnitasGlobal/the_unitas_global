// @ts-check
// On-demand, full-power E2E config for the /web pre-launch flow (entry gate ->
// 30s cinematic -> sealed screen). Deliberately SEPARATE from the root
// playwright.config.js (which targets the legacy static site) and NOT wired
// into any Stop hook / watcher -- run it by hand when the gate/cinema/audio
// or scroll behaviour changes:
//
//   npx playwright test --config=tests/web-cinema.config.js
//
// It boots a one-shot `next start` on :3123, runs the checks once, and the
// server is torn down when the run exits (Low-Memory Armor: no lingering
// process). Requires `npm --prefix web run build` to have run first.
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const PORT = 3123;
const REPO = path.join(__dirname, '..');

module.exports = defineConfig({
  testDir: './web-cinema-e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    trace: 'off',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // REV-28: WebKit gets a bigger clock, once, instead of ten scattered
    // per-file budgets.
    //
    // Playwright's defaults -- a 5s expect, a per-action budget inside a 60s
    // test -- assume frames are cheap. This harness's WebKit has no GPU path
    // and rasterises the released page at 555-698ms PER FRAME, measured by the
    // REV-26 render probe (`page 582ms vs floor 17ms`, 34x). Every actionability
    // check wants the same bounding box across two consecutive animation
    // frames, so one check costs over a second there, and a 5s expect is about
    // eight frames.
    //
    // This is a CLOCK, not a budget: no assertion in the suite changes, and
    // nothing here is tolerated that would not be tolerated on chromium. The
    // product claims are identical on all three projects -- chromium and
    // mobile-chrome still run on the defaults, so a real regression cannot hide
    // behind this.
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], actionTimeout: 45_000 },
      timeout: 240_000,
      expect: { timeout: 20_000 },
    },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm --prefix web run start -- -p ${PORT}`,
    cwd: REPO,
    url: `http://127.0.0.1:${PORT}/en`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
