const path = require('path');
const { test, expect } = require('@playwright/test');

const fileUrl = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

const ALL_40_LANGS = [
  'en', 'ko', 'ja', 'zh', 'km', 'es', 'pt', 'fr', 'de', 'ar', 'ru',
  'hi', 'vi', 'id', 'it', 'tr', 'th', 'nl', 'pl', 'uk',
  'sv', 'ro', 'hu', 'cs', 'el', 'da', 'fi', 'no',
  'sw', 'ha', 'am', 'yo', 'zu',
  'ig', 'ff', 'so', 'qu', 'gn',
  'ay', 'om',
];

const NEW_LANGS = [
  { code: 'ay', optionLabel: 'AY - Aymar Aru', sample: "5 Módulonaka Amtawi Atipt'awinaka" },
  { code: 'om', optionLabel: 'OM - Afaan Oromoo', sample: 'Moduulii 5 Daldalaa Tarsiimoo' },
];

test.describe('Batch 5: Aymara + Oromo (AY/OM)', () => {
  test('dropdown lists all 40 languages, no duplicates, code-hyphen-localname format for the new 2', async ({ page }) => {
    await page.goto(fileUrl);
    const options = await page.locator('#lang-select option').evaluateAll(opts =>
      opts.map(o => ({ value: o.value, text: o.textContent }))
    );
    expect(options.map(o => o.value)).toEqual(ALL_40_LANGS);
    expect(new Set(options.map(o => o.value)).size).toBe(options.length);

    for (const { code, optionLabel } of NEW_LANGS) {
      const opt = options.find(o => o.value === code);
      expect(opt.text).toBe(optionLabel);
    }
  });

  for (const { code, sample } of NEW_LANGS) {
    test(`selecting ${code} renders its own translation, not an English fallback`, async ({ page }) => {
      await page.goto(fileUrl);
      await page.selectOption('#lang-select', code);
      await expect(page.locator('#modules h2')).toHaveText(sample);
      await expect(page.locator('html')).toHaveAttribute('lang', code);
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    });
  }

  test('page loads with zero console/page errors after the 40-language expansion', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(fileUrl);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
