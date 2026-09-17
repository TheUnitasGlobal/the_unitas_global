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
  // REV-40. CI uploads index.html/playwright-report when the E2E step fails --
  // and until now no reporter here ever wrote that directory, so the artifact
  // was structurally guaranteed to be empty. Playwright's DEFAULT reporter is
  // list locally and dot on CI; neither produces an html report, and a default
  // is not a declaration, so the workflow was uploading a path nothing owned.
  //
  // Local behaviour is unchanged: CI is unset, so this is 'list' -- exactly the
  // default it replaces. The stage-3 idle daemon is unaffected for a different
  // reason: it passes `--reporter=list,json` on the command line, and the CLI
  // flag overrides the config entirely.
  //
  // outputFolder is pinned rather than defaulted. Playwright resolves the
  // default against the nearest package.json above the CONFIG dir, which is
  // index.html/ today and would silently become index.html/tests/ the day
  // anyone adds a package.json there -- moving the report out from under the
  // workflow's upload path with no error anywhere.
  reporter: process.env.CI
    ? [['dot'], ['html', { open: 'never', outputFolder: path.join(REPO, 'playwright-report') }]]
    : 'list',
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
    // REV-39 M3 (v37 audit, [high] "태블릿 뷰포트 측정 0"): the 768-1024 band
    // WITH TOUCH. quantum-white.css branches at `max-width: 767px`, so 768+ is
    // exactly the boundary that had never been rendered, and "wide viewport +
    // finger" is a combination none of the first three projects produce
    // (1280 mouse, 1280 mouse, 412 touch). 820x1180 is iPad-Air portrait: it
    // sits inside the band and takes the DESKTOP css branch with hasTouch.
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true, deviceScaleFactor: 2 },
    },
    // REV-39 M3 (v37 audit, [high] "인앱 브라우저 커버리지 0"): embedded WebView
    // containers. The user agent is what lib/pwa/inAppBrowser.ts sniffs to stamp
    // `<html data-inapp="<vendor>">`; specs seed the escape throttle key so the
    // auto hand-off does not navigate away and the in-app layout can be measured.
    {
      name: 'inapp-kakao',
      use: { ...devices['Pixel 7'], userAgent: `${devices['Pixel 7'].userAgent} KAKAOTALK/10.4.0` },
    },
    {
      name: 'inapp-instagram',
      use: { ...devices['Pixel 7'], userAgent: `${devices['Pixel 7'].userAgent} Instagram 300.0.0.0.0 Android` },
    },
  ],
  // The daemon sweeps these in order, one project per shard, checkpointing
  // after each so a cancelled window never loses completed work (REV-39 M1).
  metadata: { sweepProjects: ['chromium', 'webkit', 'mobile-chrome', 'tablet', 'inapp-kakao', 'inapp-instagram'] },
  webServer: {
    command: `npm --prefix web run start -- -p ${PORT}`,
    cwd: REPO,
    url: `http://127.0.0.1:${PORT}/en`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
