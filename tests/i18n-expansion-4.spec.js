const path = require('path');
const { test, expect } = require('@playwright/test');

const fileUrl = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

const ALL_38_LANGS = [
  'en', 'ko', 'ja', 'zh', 'km', 'es', 'pt', 'fr', 'de', 'ar', 'ru',
  'hi', 'vi', 'id', 'it', 'tr', 'th', 'nl', 'pl', 'uk',
  'sv', 'ro', 'hu', 'cs', 'el', 'da', 'fi', 'no',
  'sw', 'ha', 'am', 'yo', 'zu',
  'ig', 'ff', 'so', 'qu', 'gn',
];

const NEW_LANGS = [
  { code: 'ig', optionLabel: 'IG - Asụsụ Igbo', sample: 'Modul 5 Nke Atụmatụ Azụmahịa' },
  { code: 'ff', optionLabel: 'FF - Fulfulde', sample: 'Kudi 5 Fii Golle Faggudu' },
  { code: 'so', optionLabel: 'SO - Soomaaliga', sample: '5 Modiyuulo Ganacsi oo Istaraatiiji ah' },
  { code: 'qu', optionLabel: 'QU - Runa Simi', sample: "5 Módulokuna Ruray Llamkaykunapaq" },
  { code: 'gn', optionLabel: "GN - Avañe'ẽ", sample: '5 Módulo Ñemuha Estratégica' },
];

test.describe('Batch 4: remaining Africa + South America languages (IG/FF/SO/QU/GN)', () => {
  test('dropdown includes all 38 languages from this batch (plus later additions), no duplicates, code-hyphen-localname format for the new 5', async ({ page }) => {
    await page.goto(fileUrl);
    const options = await page.locator('#lang-select option').evaluateAll(opts =>
      opts.map(o => ({ value: o.value, text: o.textContent }))
    );
    for (const code of ALL_38_LANGS) {
      expect(options.map(o => o.value)).toContain(code);
    }
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

  test('page loads with zero console/page errors after the 38-language expansion', async ({ page }) => {
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
