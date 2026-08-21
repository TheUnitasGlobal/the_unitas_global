const path = require('path');
const { test, expect } = require('@playwright/test');

const fileUrl = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

const NEW_LANGS = [
  { code: 'km', sample: '៥ម៉ូឌុលអាជីវកម្មយុទ្ធសាស្ត្រ', dir: 'ltr' },
  { code: 'es', sample: '5 MÓDULOS ESTRATÉGICOS DE NEGOCIO', dir: 'ltr' },
  { code: 'pt', sample: '5 MÓDULOS ESTRATÉGICOS DE NEGÓCIO', dir: 'ltr' },
  { code: 'fr', sample: "5 MODULES STRATÉGIQUES D'ENTREPRISE", dir: 'ltr' },
  { code: 'de', sample: '5 STRATEGISCHE GESCHÄFTSMODULE', dir: 'ltr' },
  { code: 'ar', sample: '٥ وحدات أعمال استراتيجية', dir: 'rtl' },
  { code: 'ru', sample: '5 СТРАТЕГИЧЕСКИХ БИЗНЕС-МОДУЛЕЙ', dir: 'ltr' },
];

test.describe('7-language expansion (KM/ES/PT/FR/DE/AR/RU)', () => {
  test('dropdown lists the 11 languages from this batch (plus later additions)', async ({ page }) => {
    await page.goto(fileUrl);
    const values = await page.locator('#lang-select option').evaluateAll(opts => opts.map(o => o.value));
    for (const code of ['en', 'ko', 'ja', 'zh', 'km', 'es', 'pt', 'fr', 'de', 'ar', 'ru']) {
      expect(values).toContain(code);
    }
  });

  for (const { code, sample, dir } of NEW_LANGS) {
    test(`selecting ${code} renders its translation and sets dir=${dir}`, async ({ page }) => {
      await page.goto(fileUrl);
      await page.selectOption('#lang-select', code);
      await expect(page.locator('#modules h2')).toHaveText(sample);
      await expect(page.locator('html')).toHaveAttribute('lang', code);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
    });
  }

  test('switching back to a LTR language resets dir', async ({ page }) => {
    await page.goto(fileUrl);
    await page.selectOption('#lang-select', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.selectOption('#lang-select', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });
});
