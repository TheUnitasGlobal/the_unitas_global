const path = require('path');
const { test, expect } = require('@playwright/test');

const fileUrl = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

const ALL_33_LANGS = [
  'en', 'ko', 'ja', 'zh', 'km', 'es', 'pt', 'fr', 'de', 'ar', 'ru',
  'hi', 'vi', 'id', 'it', 'tr', 'th', 'nl', 'pl', 'uk',
  'sv', 'ro', 'hu', 'cs', 'el', 'da', 'fi', 'no',
  'sw', 'ha', 'am', 'yo', 'zu',
];

const AFRICAN_LANGS = [
  { code: 'sw', optionLabel: 'SW - Kiswahili', sample: 'MODULI 5 ZA KIMKAKATI ZA BIASHARA' },
  { code: 'ha', optionLabel: 'HA - Hausa', sample: 'MODULES 5 NA DABARUN KASUWANCI' },
  { code: 'am', optionLabel: 'AM - አማርኛ', sample: '5 ስትራቴጂካዊ የንግድ ሞዱሎች' },
  { code: 'yo', optionLabel: "YO - Yorùbá", sample: 'MODULU 5 IṢẸ́ ÒWÒ ÀLÀ-KÍKỌ́' },
  { code: 'zu', optionLabel: 'ZU - isiZulu', sample: 'AMAMODYULA A-5 EBHIZINISI ESIHLELWE' },
];

test.describe('Batch 3: African regional languages (SW/HA/AM/YO/ZU)', () => {
  test('dropdown includes all 33 languages from this batch (plus later additions), no duplicates, code-hyphen-localname format for the new 5', async ({ page }) => {
    await page.goto(fileUrl);
    const options = await page.locator('#lang-select option').evaluateAll(opts =>
      opts.map(o => ({ value: o.value, text: o.textContent }))
    );
    for (const code of ALL_33_LANGS) {
      expect(options.map(o => o.value)).toContain(code);
    }
    expect(new Set(options.map(o => o.value)).size).toBe(options.length);

    for (const { code, optionLabel } of AFRICAN_LANGS) {
      const opt = options.find(o => o.value === code);
      expect(opt.text).toBe(optionLabel);
    }
  });

  for (const { code, sample } of AFRICAN_LANGS) {
    test(`selecting ${code} renders its own translation, not an English fallback`, async ({ page }) => {
      await page.goto(fileUrl);
      await page.selectOption('#lang-select', code);
      await expect(page.locator('#modules h2')).toHaveText(sample);
      await expect(page.locator('html')).toHaveAttribute('lang', code);
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    });
  }

  test('page loads with zero console/page errors after the 33-language expansion', async ({ page }) => {
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
