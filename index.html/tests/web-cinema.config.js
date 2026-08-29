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
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
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
