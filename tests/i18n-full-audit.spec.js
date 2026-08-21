const path = require('path');
const { test, expect } = require('@playwright/test');

const fileUrl = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

const EXPECTED_LANGS = [
  'en', 'ko', 'ja', 'zh', 'km', 'es', 'pt', 'fr', 'de', 'ar', 'ru',
  'hi', 'vi', 'id', 'it', 'tr', 'th', 'nl', 'pl', 'uk',
  'sv', 'ro', 'hu', 'cs', 'el', 'da', 'fi', 'no',
  'sw', 'ha', 'am', 'yo', 'zu',
  'ig', 'ff', 'so', 'qu', 'gn',
  'ay', 'om',
];

test.describe('Full audit: all 40 languages', () => {
  test('SUPPORTED_LANGS has exactly 40 unique codes matching the expected roster', async ({ page }) => {
    await page.goto(fileUrl);
    const langs = await page.evaluate(() => SUPPORTED_LANGS);
    expect(langs).toEqual(EXPECTED_LANGS);
    expect(new Set(langs).size).toBe(40);
  });

  test('dropdown options match SUPPORTED_LANGS 1:1, no duplicates, no orphans', async ({ page }) => {
    await page.goto(fileUrl);
    const dropdownValues = await page.locator('#lang-select option').evaluateAll(opts => opts.map(o => o.value));
    const dropdownLabels = await page.locator('#lang-select option').evaluateAll(opts => opts.map(o => o.textContent));
    const supportedLangs = await page.evaluate(() => SUPPORTED_LANGS);
    expect(dropdownValues).toEqual(supportedLangs);
    expect(new Set(dropdownValues).size).toBe(dropdownValues.length);
    expect(dropdownLabels.slice(0, 3)).toEqual(['EN - English', 'KO - 한국어', 'JA - 日本語']);
  });

  test('every language object has all 62 English keys present and non-empty (no silent fallback gaps)', async ({ page }) => {
    await page.goto(fileUrl);
    const audit = await page.evaluate(() => {
      const enKeys = Object.keys(I18N.en);
      const problems = {};
      for (const lang of SUPPORTED_LANGS) {
        const obj = I18N[lang];
        if (!obj) {
          problems[lang] = { fatal: 'language object missing from I18N entirely' };
          continue;
        }
        const missingKeys = enKeys.filter((k) => !Object.prototype.hasOwnProperty.call(obj, k));
        const emptyKeys = Object.entries(obj)
          .filter(([, v]) => typeof v === 'string' && v.trim() === '')
          .map(([k]) => k);
        if (missingKeys.length || emptyKeys.length) {
          problems[lang] = { missingKeys, emptyKeys };
        }
      }
      return { enKeyCount: enKeys.length, problems };
    });

    expect(audit.enKeyCount).toBeGreaterThan(0);
    expect(audit.problems).toEqual({});
  });

  test('no two languages accidentally share byte-identical translation objects (copy-paste guard)', async ({ page }) => {
    await page.goto(fileUrl);
    const dupes = await page.evaluate(() => {
      const seen = new Map();
      const collisions = [];
      for (const lang of SUPPORTED_LANGS) {
        if (lang === 'en') continue; // en is the fallback source, never compared
        const serialized = JSON.stringify(I18N[lang]);
        if (seen.has(serialized)) {
          collisions.push([seen.get(serialized), lang]);
        } else {
          seen.set(serialized, lang);
        }
      }
      return collisions;
    });
    expect(dupes).toEqual([]);
  });

  for (const lang of EXPECTED_LANGS) {
    test(`[${lang}] selecting it renders translated content, sets html lang/dir, no console errors`, async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto(fileUrl);
      await page.selectOption('#lang-select', lang);

      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

      // Every data-i18n node's rendered text must match what t() would produce for this
      // language (own translation if present, else the documented English fallback) --
      // never garbage, never the raw i18n key itself.
      const mismatches = await page.evaluate((currentLang) => {
        const bad = [];
        document.querySelectorAll('[data-i18n]').forEach((el) => {
          const key = el.getAttribute('data-i18n');
          const expected = (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
          if (el.textContent !== expected) {
            bad.push({ key, expected, actual: el.textContent });
          }
        });
        return bad;
      }, lang);
      expect(mismatches).toEqual([]);

      // localStorage should persist the chosen language for next visit.
      const stored = await page.evaluate(() => localStorage.getItem('unitas_lang'));
      expect(stored).toBe(lang);

      // Toggling to register mode exercises refreshAuthModeLabels(), which also calls t() --
      // make sure that path doesn't throw or leave stale English text behind.
      // Compare via textContent (not innerText) since the button has a CSS uppercase
      // transform that would otherwise make an exact-string comparison fail spuriously.
      await page.click('#toggle-btn');
      const { registerBtnText, expectedRegisterText } = await page.evaluate((currentLang) => {
        return {
          registerBtnText: document.getElementById('auth-btn').textContent,
          expectedRegisterText: (I18N[currentLang] && I18N[currentLang].btn_register) || I18N.en.btn_register,
        };
      }, lang);
      expect(registerBtnText).toBe(expectedRegisterText);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }
});
