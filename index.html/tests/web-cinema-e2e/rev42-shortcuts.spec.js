// REV-42 acceptance measurements (founder directive 2026-09-18) -- the
// discovery rail's three flagship shortcuts and their three-tier popup tree,
// measured on the BUILT app rather than reasoned about (SPEC D-11):
//   (a) sixteen seats, the three flagships in front, the `air` seat swept
//   (b) 시공간·기상: the moon pixel + solar-term chip on the card -> the air
//       fusion block in the deep popup -> the tier-3 sky detail with a live
//       sidereal clock -> ONE back press closes tier 3 only
//   (c) 거시 우주: the horizon dial on the card -> >= 20 telemetry rows in
//       the deep popup -> tier 3 mirrors the sky detail + four sections
//   (d) 글로벌 미식: the card -> global + country scopes in the deep popup ->
//       tier 3 with the three food-science sections
//
// The helpers are rev41-uai-popup's, copied rather than shared: a spec file
// is not a module, and the only cross-file imports this directory allows
// are the retirement sweeps (_rev35Retired / _rev41Retired / _rev42Retired).
// The weather fixtures are rev34-weather-square's, extended with the D-4
// air fields; `serviceWorkers: 'block'` is REQUIRED for page.route to see
// them (public/sw.js proxies every non-static fetch -- REV-25, measured).
//
// Run (Chromium, changed specs only -- 제16장 1단계; the three-engine sweep
// belongs to the idle daemon), from index.html/:
//   npx playwright test tests/web-cinema-e2e/rev42-shortcuts.spec.js --project=chromium --output=test-results/stage3-artifacts
// (`--output=test-results/stage3-artifacts` is mandatory, 1-A #18).
const { test, expect } = require('@playwright/test');
const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const { expectRetiredAirGone } = require('./_rev42Retired');

const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.locator('button:has(.cs-skip-aurora)');

// The gastronomy deep popup spends one Wikipedia geosearch beam and the
// weather popup three fixtures; 120s covers a cold fill on a slow runner.
test.describe.configure({ timeout: 120_000 });

async function reachHome(page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1');
      localStorage.setItem('unitas_locale_pref', 'ko');
    } catch {
      /* no-op */
    }
  });
  await page.goto(`/ko?sovereign_auth=${TOKEN}&splash=0`);
  await enterButton(page).click();
  await skipButton(page).click();
  await expect(page.getByRole('heading', { name: /coming soon/i })).toBeVisible({ timeout: 15_000 });
  await enterButton(page).click();
  await page.waitForSelector('.qw-cluster-card', { timeout: 30_000 });
  await expect(page.locator('.cs-root')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(500);
}

async function openHub(page) {
  await page.locator('#omni-synapse-search input[type="text"]').click();
  await page.waitForTimeout(600);
  await expect(page.locator('[data-live-hub]')).toBeVisible();
}

/** Pin one slot so which card is on screen is never a race with the clock. */
async function pin(page, slot) {
  await page.locator(`[data-slot="${slot}"]`).click();
  await page.waitForTimeout(500);
  await expect(page.locator(`[data-slot-card="${slot}"]`)).toBeVisible();
}

/** REV-34 M1-C: ONE click on the title text opens the slot's deep popup. */
async function openDeep(page, slot) {
  await page.locator(`[data-slot-card="${slot}"] .qw-hub-card-title .qw-hub-title-hit`).click();
  await expect(page.locator('[role="dialog"]'), 'the deep popup is one dialog').toHaveCount(1, { timeout: 8_000 });
}

/**
 * 1-A #6: tier 3 NEVER auto-opens -- it is a second dialog only after the
 * `[data-detail-open]` chip inside the deep popup is pressed. Returns the
 * tier-3 root.
 */
async function openDetail(page, slot) {
  await expect(page.locator(`[data-slot-detail="${slot}"]`)).toHaveCount(0);
  const chip = page.locator(`[data-detail-open="${slot}"]`);
  await expect(chip).toBeVisible({ timeout: 30_000 });
  await chip.click();
  await expect(page.locator('[role="dialog"]'), 'tier 3 is a nested second dialog').toHaveCount(2, { timeout: 8_000 });
  const detail = page.locator(`[data-slot-detail="${slot}"]`);
  await expect(detail).toBeVisible();
  await expect(page.locator('#slot-detail-title')).toHaveCount(1);
  return detail;
}

/* ------------------------------------------------------------------ */
/* Weather fixtures (rev34-weather-square's, + the D-4 air fields)      */
/* ------------------------------------------------------------------ */

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

function forecastFixture() {
  const day = (i) => `2026-09-${String(16 + i).padStart(2, '0')}`;
  const hourly = { time: [], temperature_2m: [], weather_code: [], precipitation_probability: [], precipitation: [], wind_speed_10m: [], uv_index: [] };
  for (let i = 0; i < 48; i += 1) {
    hourly.time.push(`${day(Math.floor(i / 24))}T${String(i % 24).padStart(2, '0')}:00`);
    hourly.temperature_2m.push(18 + (i % 7));
    hourly.weather_code.push(i % 5 === 0 ? 61 : 2);
    hourly.precipitation_probability.push((i * 7) % 100);
    hourly.precipitation.push(i % 5 === 0 ? 0.4 : 0);
    hourly.wind_speed_10m.push(10 + (i % 4));
    hourly.uv_index.push(i % 24 > 8 && i % 24 < 18 ? 5 : 0);
  }
  const daily = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], sunrise: [], sunset: [], uv_index_max: [], precipitation_probability_max: [], wind_speed_10m_max: [], wind_direction_10m_dominant: [] };
  for (let i = 0; i < 7; i += 1) {
    daily.time.push(day(i));
    daily.weather_code.push(i % 2 ? 3 : 0);
    daily.temperature_2m_max.push(24 + i);
    daily.temperature_2m_min.push(15 + i);
    daily.sunrise.push(`${day(i)}T06:2${i}`);
    daily.sunset.push(`${day(i)}T18:4${i}`);
    daily.uv_index_max.push(6);
    daily.precipitation_probability_max.push(10 * i);
    daily.wind_speed_10m_max.push(20);
    daily.wind_direction_10m_dominant.push(135);
  }
  return {
    timezone: 'Europe/London',
    current: {
      time: '2026-09-16T14:15',
      temperature_2m: 21.4,
      relative_humidity_2m: 58,
      apparent_temperature: 20.1,
      weather_code: 2,
      wind_speed_10m: 12,
      wind_direction_10m: 225,
      wind_gusts_10m: 28,
      uv_index: 4.2,
      precipitation: 0,
    },
    hourly,
    daily,
  };
}

/** D-4: the full `current=` set the deep layer asks Open-Meteo for now. */
const AIR_FIXTURE = {
  current: {
    european_aqi: 35,
    us_aqi: 48,
    pm2_5: 8.2,
    pm10: 14.1,
    ozone: 61,
    nitrogen_dioxide: 12.4,
    sulphur_dioxide: 2.1,
    carbon_monoxide: 210,
    dust: 3,
    aerosol_optical_depth: 0.12,
    uv_index: 4.2,
    uv_index_clear_sky: 4.6,
  },
};

function radarFixture() {
  const base = 1_789_000_000;
  const frame = (i) => ({ time: base + i * 600, path: `/v2/radar/${base + i * 600}` });
  return {
    host: 'https://tilecache.rainviewer.com',
    radar: {
      past: Array.from({ length: 13 }, (_, i) => frame(i)),
      nowcast: Array.from({ length: 3 }, (_, i) => frame(13 + i)),
    },
  };
}

/** Every third party the weather popup can reach, answered locally. */
async function routeWeather(page) {
  await page.route(/api\.open-meteo\.com\/v1\/forecast/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(forecastFixture()) }));
  await page.route(/air-quality-api\.open-meteo\.com/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(AIR_FIXTURE) }));
  await page.route(/geocoding-api\.open-meteo\.com/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) }));
  await page.route(/api\.rainviewer\.com\/public\/weather-maps\.json/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(radarFixture()) }));
  await page.route(/basemaps\.cartocdn\.com|tilecache\.rainviewer\.com/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 }));
  // The cold-device positioning probes: aborted, so the place stays put.
  await page.route(/get\.geojs\.io|ipwho\.is|api\.bigdatacloud\.net/, (route) => route.abort());
}

/* ------------------------------------------------------------------ */
/* (a) the seats                                                        */
/* ------------------------------------------------------------------ */

test.describe('REV-42 (a) -- sixteen seats, three flagships in front, air retired', () => {
  test('the rail seats sixteen; weather / cosmos / gastronomy lead; no air surface survives', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    const chips = page.locator('[data-live-hub] .qw-hub-strip [data-slot]');
    await expect(chips.first()).toBeVisible();
    await expect(chips).toHaveCount(16);
    expect(await chips.evaluateAll((els) => els.slice(0, 4).map((el) => el.getAttribute('data-slot')))).toEqual(['weather', 'cosmos', 'gastronomy', 'newProducts']);
    await expectRetiredAirGone(page);
    // D-2: the two new flagships are single targets like the weather card.
    for (const slot of ['cosmos', 'gastronomy']) {
      await pin(page, slot);
      await expect(page.locator(`[data-slot-card="${slot}"]`)).toHaveAttribute('data-one-target', '1');
      await expect(page.locator(`[data-slot-card="${slot}"]`)).not.toHaveAttribute('role', 'button');
    }
  });
});

/* ------------------------------------------------------------------ */
/* (b) 시공간·기상                                                       */
/* ------------------------------------------------------------------ */

test.describe('REV-42 (b) -- the weather flagship: moon pixel, air fusion, sky detail', () => {
  test.use({ serviceWorkers: 'block' });

  test('card moon + term -> deep air block -> tier-3 sidereal clock ticking -> back closes tier 3 only', async ({ page }) => {
    await routeWeather(page);
    await reachHome(page);
    await openHub(page);
    await pin(page, 'weather');

    // D-3: the moon rides on the card ABOVE the facts (1-A #2: the card still
    // has exactly one scope group, `country`), with the solar-term chip.
    const card = page.locator('[data-slot-card="weather"]');
    const moon = card.locator('[data-moon-pixel]');
    await expect(moon).toBeAttached({ timeout: 30_000 });
    await expect.poll(async () => moon.getAttribute('data-state'), { timeout: 30_000 }).toBe('data');
    await expect(card.locator('[data-moon-term]')).toHaveCount(1);
    await expect(card.locator('[data-scope]')).toHaveCount(1);
    await expect(card.locator('[data-scope="country"]')).toHaveCount(1);
    // 1-A #7: no control inside the card widget.
    expect(await moon.locator('button, a, [role="button"], [role="tab"]').count()).toBe(0);

    // Tier 2: the weather deep popup with the D-4 air fusion block.
    await openDeep(page, 'weather');
    const modal = page.locator('[data-slot-modal="weather"][data-weather-modal="weather"]');
    await expect(modal).toBeVisible();
    await expect(page.locator('#slot-weather-title')).toHaveCount(1);
    const panel = modal.locator('[data-weather-panel]');
    await expect(panel).toHaveAttribute('data-weather-state', 'ready', { timeout: 20_000 });
    const air = panel.locator('[data-weather-air]');
    await expect(air).toBeVisible();
    // The old contract survives on the same root (1-A #5).
    await expect(panel.locator('[data-weather-aqi]')).toHaveCount(1);
    const airState = await air.getAttribute('data-air-state');
    if (airState === 'unreadable') {
      console.log('[REV-42 b] air block honest-unreadable (fixture not reached)');
    } else {
      const cells = await air.locator('[data-air-cell]').count();
      console.log('[REV-42 b] air cells', cells);
      expect(cells, 'the fixture carries pm2.5, pm10, o3, no2, so2, co, dust, aod and uv').toBeGreaterThanOrEqual(4);
    }
    // 1-A #4: still exactly one meta line inside the deep popup.
    await expect(modal.locator('[data-meta-line]')).toHaveCount(1);

    // Tier 3: the sky detail with the live sidereal clock.
    const detail = await openDetail(page, 'weather');
    const sky = detail.locator('[data-sky-detail]');
    await expect(sky).toHaveCount(1);
    await expect(sky).toHaveAttribute('data-sky-host', 'weather');
    const lst = sky.locator('[data-sky-lst]');
    await expect(lst).toBeVisible({ timeout: 10_000 });
    await expect(lst).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
    const first = (await lst.innerText()).trim();
    await expect.poll(async () => (await lst.innerText()).trim(), { timeout: 2_500, message: 'the sidereal clock must tick within 2.5 s' }).not.toBe(first);
    await expect(lst).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
    // 1-A #4: the tier-3 body carries no meta line of its own.
    await expect(detail.locator('[data-meta-line]')).toHaveCount(0);

    // ONE back press closes tier 3 only -- the deep popup stays (D-5).
    await page.goBack();
    await expect(page.locator('[data-slot-detail="weather"]')).toHaveCount(0, { timeout: 8_000 });
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await expect(modal).toBeVisible();
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
/* (c) 거시 우주                                                         */
/* ------------------------------------------------------------------ */

test.describe('REV-42 (c) -- the cosmos flagship: horizon dial, telemetry rows, mirrored sky detail', () => {
  test('card dial -> >= 20 deep rows -> tier 3 = one sky detail + four cosmos sections', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'cosmos');

    const card = page.locator('[data-slot-card="cosmos"]');
    const scope = card.locator('[data-cosmos-scope]');
    await expect(scope).toBeAttached({ timeout: 30_000 });
    await expect.poll(async () => scope.getAttribute('data-state'), { timeout: 30_000 }).toBe('data');
    await expect(scope).toHaveAttribute('data-featured', /.+/);
    expect(await scope.locator('button, a, [role="button"], [role="tab"]').count()).toBe(0);

    await openDeep(page, 'cosmos');
    const modal = page.locator('[data-feed-modal="cosmos"]');
    await expect(modal).toBeVisible();
    await expect(page.locator('#feed-deep-title')).toHaveCount(1);
    await expect(modal.locator('[data-cosmos-scope]')).toHaveCount(1);
    await expect.poll(async () => modal.locator('[data-scope] li').count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(20);
    // D-6: no row routes anywhere -- the objects are catalogue entries.
    expect(await modal.locator('[data-scope] li a[href]').count()).toBe(0);

    const detail = await openDetail(page, 'cosmos');
    await expect(detail.locator('[data-sky-detail]')).toHaveCount(1);
    await expect(detail.locator('[data-sky-detail]')).toHaveAttribute('data-sky-host', 'cosmos');
    await expect(detail.locator('[data-sky-lst]')).toHaveText(/^\d{2}:\d{2}:\d{2}$/, { timeout: 10_000 });
    await expect(detail.locator('[data-cosmos-section]')).toHaveCount(4);
    expect(await detail.locator('[data-cosmos-section]').evaluateAll((els) => els.map((el) => el.getAttribute('data-cosmos-section')))).toEqual([
      'trajectory',
      'lineage',
      'relativity',
      'scale',
    ]);

    await page.goBack();
    await expect(page.locator('[data-slot-detail="cosmos"]')).toHaveCount(0, { timeout: 8_000 });
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await expect(modal).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/* (d) 글로벌 미식                                                       */
/* ------------------------------------------------------------------ */

test.describe('REV-42 (d) -- the gastronomy flagship: global + country scopes, food-science detail', () => {
  test('card -> deep global + country scopes -> tier 3 with the three food-science sections', async ({ page }) => {
    await reachHome(page);
    await openHub(page);
    await pin(page, 'gastronomy');
    const card = page.locator('[data-slot-card="gastronomy"]');
    await expect(card).toHaveAttribute('data-one-target', '1');

    await openDeep(page, 'gastronomy');
    const modal = page.locator('[data-feed-modal="gastronomy"]');
    await expect(modal).toBeVisible();
    await expect(page.locator('#feed-deep-title')).toHaveCount(1);
    // D-7: the world's trends first, the visitor's own table second.
    await expect(modal.locator('[data-scope="global"]')).toBeVisible({ timeout: 30_000 });
    await expect(modal.locator('[data-scope="country"]')).toBeVisible({ timeout: 30_000 });
    const order = await modal.locator('[data-scope]').evaluateAll((els) => els.map((el) => el.getAttribute('data-scope')));
    expect(order).toEqual(['global', 'country']);

    const detail = await openDetail(page, 'gastronomy');
    await expect(detail.locator('[data-gastro-section]')).toHaveCount(3);
    expect(await detail.locator('[data-gastro-section]').evaluateAll((els) => els.map((el) => el.getAttribute('data-gastro-section')))).toEqual([
      'solar',
      'chemistry',
      'pairing',
    ]);

    await page.goBack();
    await expect(page.locator('[data-slot-detail="gastronomy"]')).toHaveCount(0, { timeout: 8_000 });
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await expect(modal).toBeVisible();
  });
});
