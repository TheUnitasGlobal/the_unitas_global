const path = require('path');
const { test, expect } = require('@playwright/test');

const fileUrl = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

const ALL_28_LANGS = [
  'en', 'ko', 'ja', 'zh', 'km', 'es', 'pt', 'fr', 'de', 'ar', 'ru',
  'hi', 'vi', 'id', 'it', 'tr', 'th', 'nl', 'pl', 'uk',
  'sv', 'ro', 'hu', 'cs', 'el', 'da', 'fi', 'no',
];

const BATCH_2_LANGS = [
  { code: 'hi', sample: '5 रणनीतिक व्यवसाय मॉड्यूल' },
  { code: 'vi', sample: '5 MÔ-ĐUN KINH DOANH CHIẾN LƯỢC' },
  { code: 'id', sample: '5 MODUL BISNIS STRATEGIS' },
  { code: 'it', sample: '5 MODULI AZIENDALI STRATEGICI' },
  { code: 'tr', sample: '5 STRATEJİK İŞ MODÜLÜ' },
  { code: 'th', sample: '5 โมดูลธุรกิจเชิงกลยุทธ์' },
  { code: 'nl', sample: '5 STRATEGISCHE BEDRIJFSMODULES' },
  { code: 'pl', sample: '5 STRATEGICZNYCH MODUŁÓW BIZNESOWYCH' },
  { code: 'uk', sample: '5 СТРАТЕГІЧНИХ БІЗНЕС-МОДУЛІВ' },
  { code: 'sv', sample: '5 STRATEGISKA AFFÄRSMODULER' },
  { code: 'ro', sample: '5 MODULE STRATEGICE DE AFACERI' },
  { code: 'hu', sample: '5 STRATÉGIAI ÜZLETI MODUL' },
  { code: 'cs', sample: '5 STRATEGICKÝCH OBCHODNÍCH MODULŮ' },
  { code: 'el', sample: '5 ΣΤΡΑΤΗΓΙΚΕΣ ΕΠΙΧΕΙΡΗΜΑΤΙΚΕΣ ΕΝΟΤΗΤΕΣ' },
  { code: 'da', sample: '5 STRATEGISKE FORRETNINGSMODULER' },
  { code: 'fi', sample: '5 STRATEGISTA LIIKETOIMINTAMODUULIA' },
  { code: 'no', sample: '5 STRATEGISKE FORRETNINGSMODULER' },
];

test.describe('Batch 2 language expansion (17 more languages)', () => {
  test('dropdown includes all 28 languages from this batch (plus later additions), no duplicates', async ({ page }) => {
    await page.goto(fileUrl);
    const values = await page.locator('#lang-select option').evaluateAll(opts => opts.map(o => o.value));
    for (const code of ALL_28_LANGS) {
      expect(values).toContain(code);
    }
    expect(new Set(values).size).toBe(values.length);
  });

  for (const { code, sample } of BATCH_2_LANGS) {
    test(`selecting ${code} renders its translation without falling back to English`, async ({ page }) => {
      await page.goto(fileUrl);
      await page.selectOption('#lang-select', code);
      await expect(page.locator('#modules h2')).toHaveText(sample);
      await expect(page.locator('html')).toHaveAttribute('lang', code);
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    });
  }

  test('page still loads with zero console/page errors after the full 28-language expansion', async ({ page }) => {
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
