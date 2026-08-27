const path = require('path');
const { test, expect } = require('@playwright/test');

const fileUrl = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

test.describe('UNITAS site', () => {
  test('loads without console/page errors', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(fileUrl);
    await expect(page).toHaveTitle(/UNITAS/);
    await expect(page.locator('h1')).toContainText('UNITAS');

    expect(pageErrors, `Uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `Console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  test('renders all 5 modules with coin-cost access buttons', async ({ page }) => {
    await page.goto(fileUrl);
    await expect(page.locator('#modules button:has-text("ENTER MODULE")')).toHaveCount(5);
  });

  test('keeps the language selector compact and centers the main header and footer', async ({ page }) => {
    await page.goto(fileUrl);
    const layout = await page.evaluate(() => {
      const selector = document.getElementById('lang-select');
      const header = document.querySelector('header');
      const title = document.querySelector('header h1');
      const footer = document.querySelector('footer');
      return {
        selectorWidth: selector.getBoundingClientRect().width,
        selectorMaxWidth: getComputedStyle(selector).maxWidth,
        headerDisplay: getComputedStyle(header).display,
        headerAlign: getComputedStyle(header).alignItems,
        titleAlign: getComputedStyle(title).textAlign,
        footerDisplay: getComputedStyle(footer).display,
        footerAlign: getComputedStyle(footer).alignItems,
        footerTextAlign: getComputedStyle(footer).textAlign,
      };
    });

    expect(layout.selectorWidth).toBeLessThanOrEqual(192);
    expect(layout.selectorMaxWidth).not.toBe('none');
    expect(layout.headerDisplay).toBe('flex');
    expect(layout.headerAlign).toBe('center');
    expect(layout.titleAlign).toBe('center');
    expect(layout.footerDisplay).toBe('flex');
    expect(layout.footerAlign).toBe('center');
    expect(layout.footerTextAlign).toBe('center');
  });

  test('centers the modules and portal section headings with their subtitles', async ({ page }) => {
    await page.goto(fileUrl);
    const alignment = await page.evaluate(() => ['#modules', '#portal'].map((sectionSelector) => {
      const section = document.querySelector(sectionSelector);
      const headingContainer = section.querySelector('.section-heading');
      const heading = section.querySelector('h2');
      const subtitle = section.querySelector('h2 + p');
      return {
        sectionSelector,
        containerAlign: getComputedStyle(headingContainer).textAlign,
        headingAlign: getComputedStyle(heading).textAlign,
        subtitleAlign: getComputedStyle(subtitle).textAlign,
      };
    }));

    for (const section of alignment) {
      expect(section.containerAlign).toBe('center');
      expect(section.headingAlign).toBe('center');
      expect(section.subtitleAlign).toBe('center');
    }
  });

  test('locks core containers to 1200px on desktop and fluid width on mobile', async ({ page }) => {
    const viewports = [
      { width: 390, height: 844, expectFluid: true },
      { width: 1440, height: 900, expectFluid: false },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(fileUrl);
      const layout = await page.evaluate(() => {
        const containers = [...document.querySelectorAll('header, #modules, #portal, footer')];
        const buttons = [...document.querySelectorAll('#modules button')];
        return {
          viewport: window.innerWidth,
          bodyWidth: document.body.scrollWidth,
          containers: containers.map((element) => ({
            width: element.getBoundingClientRect().width,
            maxWidth: getComputedStyle(element).maxWidth,
            marginLeft: getComputedStyle(element).marginLeft,
            marginRight: getComputedStyle(element).marginRight,
          })),
          buttonsWithinModules: buttons.every((button) => button.getBoundingClientRect().right <= window.innerWidth),
        };
      });

      expect(layout.bodyWidth).toBeLessThanOrEqual(viewport.width);
      expect(layout.buttonsWithinModules).toBe(true);
      for (const container of layout.containers) {
        expect(container.maxWidth).toBe('1200px');
        expect(container.marginLeft).toBe(container.marginRight);
        if (viewport.expectFluid) expect(container.width).toBeLessThan(viewport.width);
        else expect(container.width).toBeLessThanOrEqual(1200);
      }
    }
  });

  test('toggling to register mode reveals extra fields with terms locked', async ({ page }) => {
    await page.goto(fileUrl);
    await expect(page.locator('#register-extra-fields')).toBeHidden();

    await page.click('#toggle-btn');
    await expect(page.locator('#register-extra-fields')).toBeVisible();
    await expect(page.locator('#check-terms')).toBeDisabled();
    await expect(page.locator('#check-privacy')).toBeDisabled();
    await expect(page.locator('#auth-btn')).toHaveText(/Complete Registration/);
  });

  test('submitting register form without required fields shows validation message and does not crash (Supabase unconfigured)', async ({ page }) => {
    await page.goto(fileUrl);
    await page.click('#toggle-btn');
    await page.fill('#auth-email', 'test@example.com');
    await page.fill('#auth-password', 'password123');
    await page.click('#auth-btn');

    await expect(page.locator('#auth-msg')).toContainText('required fields');
  });

  test('language switcher updates visible text', async ({ page }) => {
    await page.goto(fileUrl);
    await page.selectOption('#lang-select', 'ko');
    await expect(page.locator('h2', { hasText: '5대 전략 비즈니스 모듈' })).toBeVisible();
  });

  test('entering a module while signed out prompts sign-in instead of spending coins', async ({ page }) => {
    await page.goto(fileUrl);
    let alertText = '';
    page.on('dialog', async (dialog) => {
      alertText = dialog.message();
      await dialog.dismiss();
    });
    await page.locator('#modules button:has-text("ENTER MODULE")').first().click();
    await expect.poll(() => alertText).toContain('Sovereign Secure Portal');
    // Should not have called the spend_coins RPC without a session.
    await expect(page.locator('#portal')).toBeInViewport();
  });

  test('reaches the configured Supabase project (bad-credential login returns a real Auth API error, not a network/config failure)', async ({ page }) => {
    const authResponses = [];
    page.on('response', (res) => {
      if (res.url().includes('/auth/v1/token')) authResponses.push(res);
    });

    await page.goto(fileUrl);
    await page.fill('#auth-email', 'nonexistent-probe@example.com');
    await page.fill('#auth-password', 'definitely-wrong-password');
    await page.click('#auth-btn');

    await expect(page.locator('#auth-msg')).not.toHaveText('', { timeout: 10000 });
    const msg = await page.locator('#auth-msg').innerText();

    // A reachable, correctly-configured project responds with a real Auth error
    // (invalid credentials / project not found would come back as JSON, not a network failure).
    expect(msg).not.toContain('Supabase URL and Anon Key must be configured');
    expect(authResponses.length).toBeGreaterThan(0);
    expect(authResponses[0].status()).toBeGreaterThanOrEqual(400);
    expect(authResponses[0].status()).toBeLessThan(500);
  });
});
