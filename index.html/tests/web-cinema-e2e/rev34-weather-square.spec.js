const { test, expect } = require('@playwright/test');

// REV-34 acceptance measurements (founder directive 2026-09-16), measured on
// the BUILT app: the weather deep popup (M1-A), the one meta line (M1-B),
// the sixteen product families (M1-D), the dot glyph on the news chips
// (M1-E), and UNITAS SQUARE with its twenty themes (M4-A/B/C).
//
// THE WEATHER FIXTURES. The deep popup pulls three third parties -- the
// Open-Meteo forecast + air-quality endpoints, RainViewer's frame list and
// two tile hosts. None of them may decide a CI verdict, so every one is
// routed to a fixture here; the IP-positioning probes the compact panel
// fires on a cold device are aborted so the place never jumps mid-test.
// `serviceWorkers: 'block'` is REQUIRED for that: public/sw.js answers every
// non-static request with `respondWith(fetch(...))`, and a worker-mediated
// fetch is invisible to page.route (REV-25, measured).
const { reachReleasedHome } = require('./_rev25Home');

const input = (page) => page.locator('#omni-synapse-search input[type="text"]');

async function openHub(page) {
  await input(page).click();
  await page.waitForTimeout(600);
  await expect(page.locator('[data-live-hub]')).toBeVisible();
}

/** Pin one slot so which card is on screen is never a race with the clock. */
async function pin(page, slot) {
  await page.locator(`[data-slot="${slot}"]`).click();
  await page.waitForTimeout(500);
  await expect(page.locator(`[data-slot-card="${slot}"]`)).toBeVisible();
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                             */
/* ------------------------------------------------------------------ */

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/** Open-Meteo `/v1/forecast` with every series the deep layer reads: the
 *  current minute sits at 14:15, so the "from now" slice starts at the
 *  14:00 cell and 48 hourly stamps leave 24 to show; seven daily rows. */
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

const AIR_FIXTURE = { current: { european_aqi: 35, pm2_5: 8.2, pm10: 14.1 } };

/** 13 observed frames (the parser keeps the last 6) + 3 nowcast frames. */
const RADAR_PAST = 13;
const RADAR_NOWCAST = 3;
function radarFixture() {
  const base = 1_789_000_000;
  const frame = (i) => ({ time: base + i * 600, path: `/v2/radar/${base + i * 600}` });
  return {
    host: 'https://tilecache.rainviewer.com',
    radar: {
      past: Array.from({ length: RADAR_PAST }, (_, i) => frame(i)),
      nowcast: Array.from({ length: RADAR_NOWCAST }, (_, i) => frame(RADAR_PAST + i)),
    },
  };
}

/** Every third party the weather popup can reach, answered locally. */
async function routeWeather(page, { radar = 'ok' } = {}) {
  await page.route(/api\.open-meteo\.com\/v1\/forecast/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(forecastFixture()) }));
  await page.route(/air-quality-api\.open-meteo\.com/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(AIR_FIXTURE) }));
  await page.route(/geocoding-api\.open-meteo\.com/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) }));
  await page.route(/api\.rainviewer\.com\/public\/weather-maps\.json/, (route) =>
    radar === 'ok' ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(radarFixture()) }) : route.fulfill({ status: 500, body: 'down' }),
  );
  await page.route(/basemaps\.cartocdn\.com|tilecache\.rainviewer\.com/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 }));
  // The cold-device positioning probes: aborted, so the place stays put.
  await page.route(/get\.geojs\.io|ipwho\.is|api\.bigdatacloud\.net/, (route) => route.abort());
}

async function openWeatherDeep(page) {
  await openHub(page);
  await pin(page, 'weather');
  // M1-C: ONE click on the title text.
  await page.locator('[data-slot-card="weather"] .qw-hub-card-title .qw-hub-title-hit').click();
  const dialog = page.locator('[role="dialog"][aria-labelledby="slot-weather-title"]');
  await expect(dialog).toBeVisible({ timeout: 8_000 });
  return dialog;
}

test.describe('REV-34 M1-A -- the weather deep popup', () => {
  test.use({ serviceWorkers: 'block' });

  test('hourly, daily, radar and AQI blocks under the one meta line', async ({ page }) => {
    await routeWeather(page);
    await reachReleasedHome(page);
    const dialog = await openWeatherDeep(page);

    // The shell is the feed modal's: xl, a visible title, the new stamps.
    await expect(dialog).toHaveAttribute('data-modal-size', 'xl');
    const modal = page.locator('[data-slot-modal="weather"][data-weather-modal="weather"]');
    await expect(modal).toBeVisible();
    await expect(page.locator('#slot-weather-title')).toHaveText('Weather');

    // The compact panel keeps its controls and hides its 5-day grid.
    await expect(modal.locator('[data-weather-compact="1"]')).toBeAttached();
    expect(await modal.locator('[data-weather-compact="1"] ul.grid-cols-5').count()).toBe(0);

    // The deep panel: place lifts after the compact panel commits, then one
    // cache-first load lands the whole curve.
    const panel = modal.locator('[data-weather-panel]');
    await expect(panel).toHaveAttribute('data-weather-state', 'ready', { timeout: 20_000 });
    await expect(panel.locator('[data-weather-hourly] li')).toHaveCount(24);
    await expect(panel.locator('[data-weather-daily] li')).toHaveCount(7);
    await expect(panel.locator('[data-weather-aqi]')).toBeVisible();

    // The radar: nine basemap + nine overlay images, the frame scrubber on
    // the last observation.
    const radar = panel.locator('[data-weather-radar]');
    await expect(radar).toBeVisible();
    await expect(radar).toHaveAttribute('data-radar-state', 'ready', { timeout: 15_000 });
    await expect(radar.locator('img')).toHaveCount(18);
    await expect(radar.locator('[data-radar-frame]')).toHaveCount(Math.min(RADAR_PAST, 6) + RADAR_NOWCAST);
    await expect(radar.locator('[data-radar-frame][aria-current="step"]')).toHaveAttribute('data-radar-kind', 'now');

    // M1-B: exactly one meta line in the modal, in the news rail's shape,
    // quoting the seven forecast days once the deep load has landed.
    const meta = modal.locator('[data-meta-line]');
    await expect(meta).toHaveCount(1);
    await expect(meta).toHaveText(/건|items/);
    await expect(meta).toHaveText(/(^|\D)7(\D|$)/, { timeout: 15_000 });

    // Back closes the dialog and pins the slot it was opened from (§1.4).
    await page.goBack();
    await expect(dialog).toHaveCount(0, { timeout: 8_000 });
    await expect(page.locator('[data-slot-card="weather"]')).toBeVisible();
    await expect(page.locator('[data-live-hub] .qw-hub-progress[data-held="1"]')).toHaveCount(1);
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
  });

  test('fail-closed: no frame list means the basemap plus an "unavailable" line, never a broken map', async ({ page }) => {
    await routeWeather(page, { radar: 'down' });
    await reachReleasedHome(page);
    await openWeatherDeep(page);
    const radar = page.locator('[data-slot-modal="weather"] [data-weather-radar]');
    await expect(radar).toHaveAttribute('data-radar-state', 'unavailable', { timeout: 20_000 });
    await expect(radar.locator('[data-radar-unavailable]')).toBeVisible();
    await expect(radar.locator('img')).toHaveCount(18);
    expect(await radar.locator('[data-radar-frame]').count()).toBe(0);
  });
});

test.describe('REV-34 M1-D / M1-E -- the strip', () => {
  test('the products slot carries the sixteen family tabs', async ({ page }) => {
    await reachReleasedHome(page);
    await openHub(page);
    await pin(page, 'newProducts');
    const tabs = page.locator('[data-slot-card="newProducts"] [role="tablist"] [data-tab]');
    await expect.poll(async () => tabs.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(15);
    expect(await tabs.count()).toBe(16);
    expect(await tabs.evaluateAll((els) => new Set(els.map((el) => el.getAttribute('data-tab'))).size)).toBe(16);
  });

  test('every news chip carries the dot glyph and no picture', async ({ page }) => {
    await reachReleasedHome(page);
    await openHub(page);
    const axes = page.locator('[data-news-axes] [data-axis]');
    await expect(axes.first()).toBeVisible();
    expect(await axes.count()).toBe(22);
    expect(await axes.evaluateAll((els) => els.every((el) => el.querySelector('.qw-hub-dot') && !el.querySelector('svg')))).toBe(true);
    // The dot takes its colour from the hub accent token, never a literal.
    const painted = await axes.first().locator('.qw-hub-dot').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, w: parseFloat(cs.width), h: parseFloat(cs.height) };
    });
    expect(painted.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(painted.w).toBeGreaterThan(0);
    expect(Math.abs(painted.w - painted.h)).toBeLessThan(0.5);
  });
});

test.describe('REV-34 M4 -- UNITAS SQUARE', () => {
  test('twenty themes in the founder order, 유랭킹 first, a descriptor panel per theme', async ({ page }) => {
    await reachReleasedHome(page);
    const toggle = page.locator('[data-unitas-hub-toggle]');
    await expect(toggle).toHaveAttribute('data-unitas-square-toggle', '');
    expect(await page.locator('[data-unitas-hub-toggle] .qw-attach-roll-icon').count()).toBe(21);
    await toggle.click();
    const hub = page.locator('[role="dialog"] [data-unitas-hub][data-unitas-square]');
    await expect(hub).toBeVisible();

    // Twenty tabs, ordered 1..20, every one a real tab.
    const tabs = hub.locator('[role="tab"][data-hub-tab-btn][data-square-tab]');
    expect(await tabs.count()).toBe(20);
    const order = await tabs.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-square-tab'))));
    expect(order).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    // The six surviving panels keep their legacy DOM keys (D-10).
    for (const [n, key] of [[1, 'rankings'], [2, 'shorts'], [3, 'rooms'], [4, 'exchange'], [5, 'social'], [12, 'swarm']]) {
      await expect(hub.locator(`[data-square-tab="${n}"]`)).toHaveAttribute('data-hub-tab-btn', key);
    }

    // Default: theme 1 -- the U-Rankings rail (M4-C), no world-ranking tab.
    await expect(hub).toHaveAttribute('data-hub-tab', 'rankings');
    await expect(hub).toHaveAttribute('data-square-theme', 'uRanking');
    await expect(hub.locator('[data-hub-panel="rankings"] [data-hub-rankings] [data-urank-rail] [data-urank]').first()).toBeVisible();
    expect(await hub.locator('[data-hub-ranking-tab]').count()).toBe(0);

    // Theme 6 (uAcademy): the descriptor panel -- four signal tiles, three
    // features, one CTA into an existing (gated) route.
    await hub.locator('[data-square-tab="6"]').click();
    await expect(hub).toHaveAttribute('data-hub-tab', 'uAcademy');
    const panel = hub.locator('[data-hub-panel="uAcademy"] [data-square-panel="uAcademy"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-square-signals] [data-square-signal]')).toHaveCount(4);
    await expect(panel.locator('[data-square-features] li')).toHaveCount(3);
    const cta = panel.locator('a[data-square-cta]');
    await expect(cta).toHaveCount(1);
    await expect(cta).toHaveAttribute('data-square-cta', 'arche');
    await expect(cta).toHaveAttribute('data-gated', '1');
    expect(await cta.getAttribute('href')).toContain('/arche');

    // Theme 20 (uMaster) is founder-only. This harness holds the founder
    // session cookie, so the sovereign CTA is what renders; a browser
    // without the hint sees the locked state. Either way: one CTA, and the
    // lock flag agrees with it.
    await hub.locator('[data-square-tab="20"]').click();
    const master = hub.locator('[data-square-panel="uMaster"]');
    await expect(master).toBeVisible();
    const locked = await master.getAttribute('data-square-locked');
    const ctaKind = await master.locator('[data-square-cta]').getAttribute('data-square-cta');
    expect(locked === '1' ? ctaKind === 'locked' : ctaKind === 'sovereign').toBe(true);
    expect(await master.locator('[data-square-cta]').count()).toBe(1);

    // Escape closes the square (one history layer) and nothing else.
    await page.keyboard.press('Escape');
    await expect(hub).toHaveCount(0, { timeout: 8_000 });
    await expect(toggle).toHaveAttribute('data-active', '0');
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
  });

  test('the square remembers the last theme on this device', async ({ page }) => {
    await reachReleasedHome(page);
    await page.locator('[data-unitas-hub-toggle]').click();
    const hub = page.locator('[role="dialog"] [data-unitas-hub][data-unitas-square]');
    await expect(hub).toBeVisible();
    await hub.locator('[data-square-tab="8"]').click();
    await expect(hub).toHaveAttribute('data-square-theme', 'uOracle');
    await page.keyboard.press('Escape');
    await expect(hub).toHaveCount(0, { timeout: 8_000 });
    await page.locator('[data-unitas-hub-toggle]').click();
    await expect(hub).toBeVisible();
    await expect(hub).toHaveAttribute('data-square-theme', 'uOracle');
    await expect(hub.locator('[data-square-last-theme]')).toBeAttached();
  });
});
