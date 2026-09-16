// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // `testDir` is recursive, so without this the root run also collects
  // tests/web-cinema-e2e/ -- 207 specs that need the baseURL, webServer and
  // named projects only tests/web-cinema.config.js supplies. Collected here
  // they die before their first assertion ("Cannot navigate to invalid URL"),
  // which made the documented entrypoint `npm test` structurally incapable of
  // EXIT 0. Run that suite with its own config:
  //   npx playwright test --config tests/web-cinema.config.js
  testIgnore: '**/web-cinema-e2e/**',
  timeout: 30000,
  use: {
    headless: true,
  },
});
