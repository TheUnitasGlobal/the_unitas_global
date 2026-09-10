// REV-19 PHASE 1 measurement harness (scratch). Founder path -> home -> hero/search/footer/watermark/popups.
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require(path.join('c:/dev/unitas/index.html/node_modules/playwright'));

const BASE = 'http://127.0.0.1:3123';
const TOKEN = process.env.SOVEREIGN_AUTH_TOKEN || 'unitas_master_dooyeong_2026_secure_key';
const OUT = path.join(__dirname, 'measure19');
fs.mkdirSync(OUT, { recursive: true });

async function reachHome(page) {
  await page.addInitScript(() => { try { sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1'); } catch {} });
  await page.goto(`${BASE}/ko?sovereign_auth=${TOKEN}&splash=0`);
  const enterBtn = page.locator('button.event-horizon-btn').last();
  await enterBtn.waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  await enterBtn.click();
  await page.locator('button:has(.cs-skip-aurora)').click();
  await page.getByRole('heading', { name: 'COMING SOON' }).waitFor({ timeout: 15000 });
  await page.locator('button.event-horizon-btn').last().click();
  await page.waitForSelector('.qw-cluster-card', { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.cs-root'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
}

async function run(name, viewport, opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...(opts.device || {}), viewport, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const report = { name, viewport };
  await reachHome(page);

  report.hero = await page.evaluate(() => {
    const r = (b) => ({ x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), cx: +(b.x + b.width / 2).toFixed(1), b: +(b.y + b.height).toFixed(1) });
    const nav = document.querySelector('#unitas-nav');
    const h1 = document.querySelector('.qw-hero-wrap h1');
    const search = document.querySelector('#omni-synapse-search');
    const cs = getComputedStyle(h1);
    const text = h1.firstChild; // text node "UNITAS" (+invisible mark appended)
    const glyphs = [];
    const raw = text.textContent;
    for (let i = 0; i < 6; i++) {
      const range = document.createRange();
      range.setStart(text, i); range.setEnd(text, i + 1);
      glyphs.push({ ch: raw[i], ...r(range.getBoundingClientRect()) });
    }
    const it = document.createRange(); it.setStart(text, 2); it.setEnd(text, 4);
    const whole = document.createRange(); whole.setStart(text, 0); whole.setEnd(text, 6);
    const after = getComputedStyle(h1, '::after');
    // content box of h1 (padding 0) -> underline centred in it
    const hb = h1.getBoundingClientRect();
    const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    const contentCx = hb.x + pl + (hb.width - pl - pr) / 2;
    return {
      navBottom: +nav.getBoundingClientRect().bottom.toFixed(1),
      h1: r(hb), fontSize: cs.fontSize, letterSpacing: cs.letterSpacing, textIndent: cs.textIndent, font: cs.fontFamily,
      glyphs, it: r(it.getBoundingClientRect()), whole: r(whole.getBoundingClientRect()),
      underline: { width: after.width, marginTop: after.marginTop, cx: +contentCx.toFixed(1) },
      search: r(search.getBoundingClientRect()),
      heroWrap: r(document.querySelector('.qw-hero-wrap').getBoundingClientRect()),
      heroInner: r(document.querySelector('.qw-hero-wrap > div > div, .qw-hero-wrap div.mx-auto').getBoundingClientRect()),
    };
  });
  await page.screenshot({ path: path.join(OUT, `${name}-home-top.png`) });

  // Watermark
  report.watermark = await page.evaluate(() => {
    const el = document.querySelector('.qw-watermark');
    if (!el) return null;
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, color: cs.color, opacity: cs.opacity, blend: cs.mixBlendMode, text: el.textContent.replace(/[\u200b-\u200d\u2060]/g, '') };
  });

  // Footer
  const footer = page.locator('#site-footer');
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  report.footer = await page.evaluate(() => {
    const f = document.querySelector('#site-footer');
    const cs = getComputedStyle(f);
    const h3 = f.querySelector('h3'); const a = f.querySelector('a');
    const brand = f.querySelector('p.font-serif');
    return { bg: cs.backgroundColor, border: cs.borderTopColor, h3: { color: getComputedStyle(h3).color, size: getComputedStyle(h3).fontSize }, link: { color: getComputedStyle(a).color, size: getComputedStyle(a).fontSize }, brand: { color: getComputedStyle(brand).color }, headers: Array.from(f.querySelectorAll('h3')).map((h) => h.textContent), links: Array.from(f.querySelectorAll('a')).map((x) => x.textContent) };
  });
  await footer.screenshot({ path: path.join(OUT, `${name}-footer.png`) });
  await page.screenshot({ path: path.join(OUT, `${name}-footer-viewport.png`) });

  // Search focus -> base popup
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.locator('#omni-synapse-search input[type="text"]').click();
  await page.waitForTimeout(900);
  report.basePopup = await page.evaluate(() => {
    const strip = document.querySelector('#omni-synapse-search')?.closest('form')?.parentElement?.querySelector('.relative.z-30');
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map((t) => ({ text: t.textContent, size: getComputedStyle(t).fontSize }));
    const labels = Array.from(document.querySelectorAll('.relative.z-30 p')).slice(0, 12).map((p) => ({ text: p.textContent.slice(0, 40), size: getComputedStyle(p).fontSize, color: getComputedStyle(p).color }));
    return { strip: strip ? r(strip) : null, tabs, labels, historyState: JSON.stringify(history.state), historyLength: history.length };
  });
  await page.screenshot({ path: path.join(OUT, `${name}-search-base.png`), fullPage: false });
  await page.screenshot({ path: path.join(OUT, `${name}-search-base-full.png`), fullPage: true });

  // typing popup
  await page.keyboard.type('서울');
  await page.waitForTimeout(1200);
  report.typingPopup = await page.evaluate(() => {
    const dd = document.querySelector('#omni-synapse-search')?.closest('form')?.nextElementSibling;
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const sections = dd ? Array.from(dd.querySelectorAll(':scope > section')).map((s) => ({ label: s.querySelector('p')?.textContent?.slice(0, 40), labelSize: s.querySelector('p') ? getComputedStyle(s.querySelector('p')).fontSize : null, h: s.getBoundingClientRect().height })) : null;
    const enter = document.querySelector('#omni-synapse-search button[type="submit"]');
    const ecs = enter ? getComputedStyle(enter) : null;
    return { dropdown: dd ? r(dd) : null, sections, enter: enter ? { rect: r(enter), color: ecs.color, border: ecs.borderColor, bg: ecs.backgroundColor, shadow: ecs.boxShadow, opacity: ecs.opacity } : null, historyState: JSON.stringify(history.state), historyLength: history.length };
  });
  await page.screenshot({ path: path.join(OUT, `${name}-search-typing.png`) });

  // Enter icon idle
  await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
  report.enterIdle = await page.evaluate(() => { const b = document.querySelector('#omni-synapse-search button[type="submit"]'); const cs = getComputedStyle(b); return { color: cs.color, border: cs.borderColor, opacity: cs.opacity, disabled: b.disabled }; });

  // Rankings: open first global theme
  const themeBtn = page.locator('.relative.z-30 button', { hasText: /YouTube|유튜브|랭킹|Top/i }).first();
  const rankingSection = await page.evaluate(() => {
    const heads = Array.from(document.querySelectorAll('.relative.z-30 p, .relative.z-30 h3, .relative.z-30 h4')).map((p) => p.textContent.trim()).filter(Boolean);
    return heads.slice(0, 40);
  });
  report.stripHeadings = rankingSection;
  await page.screenshot({ path: path.join(OUT, `${name}-search-base-after-clear.png`) });

  // Try opening the global rankings first theme + first entry
  try {
    const themeButtons = page.locator('[data-ranking-theme], .relative.z-30 button[aria-pressed]');
    const count = await themeButtons.count();
    report.themeButtonCount = count;
  } catch (e) { report.themeErr = String(e); }

  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(report, null, 2));
  await browser.close();
}

(async () => {
  await run('desk1366', { width: 1366, height: 768 });
  await run('pixel7', devices['Pixel 7'].viewport, { device: devices['Pixel 7'] });
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
