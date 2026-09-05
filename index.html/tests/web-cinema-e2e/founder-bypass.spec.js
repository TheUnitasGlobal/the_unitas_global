const { test, expect } = require('@playwright/test');

// Mobile/PC re-verification of the sovereign founder gate (owner instruction
// 2026-09-04, item 4 -- replaces the retired `?dev=true` bypass). Runs on
// every configured project (chromium/webkit/mobile-chrome via
// tests/web-cinema.config.js). Unlike __tests__/gate/sovereignAuth.test.ts
// (pure HMAC/param helpers), this exercises the live middleware redirect, the
// HttpOnly signed cookie, the /api/sovereign/verify round-trip and the
// on-screen founder door in a real browser.
//
// The test server has no SOVEREIGN_AUTH_TOKEN env, so the owner default from
// web/lib/sovereignAuth.ts is the live token. `splash=0` skips the 5s intro
// splash so the gate button is clickable immediately.

const TOKEN = 'unitas_master_dooyeong_2026_secure_key';
const AUTH_URL = `/en?sovereign_auth=${TOKEN}&splash=0`;

const enterButton = (page) => page.locator('button.event-horizon-btn').last();
const skipButton = (page) => page.getByRole('button', { name: /skip/i });
const founderEnterMainButton = (page) => page.getByRole('button', { name: /enter/i }).last();

test.describe('sovereign founder gate -- mobile/PC parity', () => {
  test('token visit strips the param and mints the signed founder session', async ({
    page,
    context,
  }) => {
    await page.goto(AUTH_URL);

    // 303 redirect removed the secret from the URL, kept the other params.
    expect(page.url()).not.toContain('sovereign_auth');
    expect(page.url()).toContain('splash=0');

    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === 'unitas_sovereign');
    expect(session).toBeTruthy();
    expect(session.httpOnly).toBe(true);
    expect(session.value).toMatch(/^v1\.\d+\.[0-9a-f]{64}$/);
    expect(cookies.some((c) => c.name === 'unitas_sovereign_hint' && c.value === '1')).toBe(true);

    // The retired client-side grant must be gone for good.
    const legacy = await page.evaluate(() => window.localStorage.getItem('unitas_founder_bypass'));
    expect(legacy).toBeNull();

    // Server verification answers founder: true for this browser.
    const verify = await page.request.get('/api/sovereign/verify');
    expect((await verify.json()).founder).toBe(true);
  });

  test('sealed-screen founder door is visible with no scroll on this viewport', async ({ page }) => {
    await page.goto(AUTH_URL);
    await enterButton(page).click();
    await skipButton(page).click();

    await expect(page.getByRole('heading', { name: 'COMING SOON' })).toBeVisible({ timeout: 15_000 });

    // The founder-only entry button must be on-screen without scrolling
    // (pinned `absolute inset-x-0 bottom-24`, see ComingSoonCinema.tsx).
    const btn = founderEnterMainButton(page);
    await expect(btn).toBeVisible();
    await expect(btn).toBeInViewport();

    // The founder debug console is rendered only after server verification.
    await expect(page.getByTestId('sovereign-debug-panel')).toBeVisible();
  });

  test('signed session survives a fresh tab with no token in the URL', async ({ page, context }) => {
    await page.goto(AUTH_URL);

    // A brand-new tab in the same context (fresh sessionStorage, same
    // cookies -- the real "closed the browser, came back later" shape), no
    // query param at all: the HttpOnly cookie alone must resolve to founder.
    const page2 = await context.newPage();
    await page2.goto('/en?splash=0');
    await enterButton(page2).click();
    await skipButton(page2).click();
    await expect(founderEnterMainButton(page2)).toBeVisible({ timeout: 15_000 });
    await page2.close();
  });

  test('a wrong token, ?dev=true and a forged hint cookie all stay public', async ({
    page,
    context,
  }) => {
    await page.goto('/en?sovereign_auth=not-the-token&splash=0');
    expect(page.url()).not.toContain('sovereign_auth');
    let cookies = await context.cookies();
    expect(cookies.some((c) => c.name === 'unitas_sovereign')).toBe(false);

    // Retired bypass: no effect.
    await page.goto('/en?dev=true&splash=0');
    cookies = await context.cookies();
    expect(cookies.some((c) => c.name === 'unitas_sovereign')).toBe(false);

    // A forged hint only earns a `founder: false` answer.
    await context.addCookies([
      { name: 'unitas_sovereign_hint', value: '1', url: 'http://127.0.0.1:3123' },
    ]);
    await page.goto('/en?splash=0');
    const verify = await page.request.get('/api/sovereign/verify');
    expect((await verify.json()).founder).toBe(false);

    await enterButton(page).click();
    await skipButton(page).click();
    await expect(page.getByRole('heading', { name: 'COMING SOON' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('sovereign-debug-panel')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /founder/i })).toHaveCount(0);
  });

  test('sovereign-only routes are a bodiless 404 for the public', async ({ request }) => {
    const res = await request.get('/api/sovereign/console', { maxRedirects: 0 });
    expect(res.status()).toBe(404);
    expect((await res.text()).trim()).toBe('');
  });
});
