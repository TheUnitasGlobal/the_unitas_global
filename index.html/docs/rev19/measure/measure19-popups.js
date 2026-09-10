// REV-19 PHASE 1: popup inventory screenshots + history-state probes.
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join('c:/dev/unitas/index.html/node_modules/playwright'));

const BASE = 'http://127.0.0.1:3123';
const TOKEN = process.env.SOVEREIGN_AUTH_TOKEN || 'unitas_master_dooyeong_2026_secure_key';
const OUT = path.join(__dirname, 'measure19');

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
const hist = (page) => page.evaluate(() => ({ len: history.length, state: Object.keys(history.state || {}).filter((k) => k.startsWith('unitas')).map((k) => `${k}=${JSON.stringify(history.state[k])}`).join(','), dialogs: document.querySelectorAll('[role="dialog"]').length }));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const log = {};
  await reachHome(page);
  log.home = await hist(page);

  // 1. cluster popout (level 1) + entry gate (level 2)
  await page.evaluate(() => document.querySelectorAll('.qw-cluster-card')[0].click());
  await page.waitForSelector('.qw-tile', { timeout: 15000 });
  await page.waitForTimeout(600);
  log.popout = await hist(page);
  await page.screenshot({ path: path.join(OUT, 'popup-cluster.png') });
  await page.evaluate(() => document.querySelector('.qw-tile').click());
  await page.waitForSelector("[data-view='entry']", { timeout: 10000 });
  await page.waitForTimeout(600);
  log.entryGate = await hist(page);
  await page.screenshot({ path: path.join(OUT, 'popup-entry-gate.png') });
  // back once
  await page.goBack(); await page.waitForTimeout(500);
  log.afterBack1 = { ...(await hist(page)), entryOpen: await page.locator("[data-view='entry']").count(), popoutOpen: await page.locator('.qw-popout-panel').count(), exitDialog: await page.locator('#exit-guard-title').count() };
  await page.goBack(); await page.waitForTimeout(500);
  log.afterBack2 = { ...(await hist(page)), popoutOpen: await page.locator('.qw-popout-panel').count(), exitDialog: await page.locator('#exit-guard-title').count() };
  await page.screenshot({ path: path.join(OUT, 'popup-after-back2.png') });
  if (await page.locator('#exit-guard-title').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  if (await page.locator('#exit-guard-title').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }

  // 2. nav popups
  const navShots = [
    ['lang', 'button[aria-haspopup]', null],
  ];
  // language switcher
  const navButtons = await page.evaluate(() => Array.from(document.querySelectorAll('#unitas-nav button')).map((b) => ({ label: b.getAttribute('aria-label') || b.textContent.trim().slice(0, 30), cls: b.className.slice(0, 60) })));
  log.navButtons = navButtons;
  for (const [i, nb] of navButtons.entries()) {
    if (![3,4,5,6].includes(i)) continue;
    try {
      await page.evaluate((idx) => document.querySelectorAll('#unitas-nav button')[idx].click(), i);
      await page.waitForTimeout(700);
      log[`nav-${i}`] = { label: nb.label, ...(await hist(page)) };
      await page.screenshot({ path: path.join(OUT, `popup-nav-${i}.png`) });
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      if (await page.locator('#exit-guard-title').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
      // close any modal by clicking close button
      const closeBtn = page.locator('[role="dialog"] button[aria-label="Close"]');
      if (await closeBtn.count()) { await closeBtn.first().click(); await page.waitForTimeout(300); }
      await page.evaluate(() => { document.querySelectorAll('div.fixed.inset-0').forEach((d) => { if (d.getAttribute('aria-hidden') === 'true' && d.className.includes('z-[130]')) d.click(); }); });
      await page.waitForTimeout(200);
      log[`nav-${i}-after`] = await hist(page);
    } catch (e) { log[`nav-${i}-err`] = String(e).slice(0, 120); }
  }

  fs.writeFileSync(path.join(OUT, 'popups.json'), JSON.stringify(log, null, 2));
  await page.reload(); await page.waitForTimeout(2500);
  log.afterReload = await hist(page);
  // 3. search base popup -> global rankings theme -> entry detail
  await page.locator('#omni-synapse-search input[type="text"]').click();
  await page.waitForTimeout(800);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.relative.z-30 button')).find((x) => x.textContent.includes('유네스코')); b && b.click(); }); await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'popup-ranking-theme.png') });
  log.rankingTheme = await hist(page);
  const rows = page.locator('.relative.z-30 [role="button"]');
  log.rankingRows = await rows.count();
  if (await rows.count()) { await rows.first().click(); await page.waitForTimeout(800); await page.screenshot({ path: path.join(OUT, 'popup-ranking-detail.png') }); log.rankingDetail = await hist(page); const closeBtn = page.locator('[role="dialog"] button[aria-label="Close"]'); if (await closeBtn.count()) { await closeBtn.first().click(); await page.waitForTimeout(400); } }

  // unitas rankings: click first module chip
  const uChip = page.locator('.relative.z-30 button', { hasText: /에코|Echo/i }).first();
  if (await uChip.count()) { await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.relative.z-30 button')).find((x) => /에코|Echo/i.test(x.textContent)); b && b.click(); }); await page.waitForTimeout(600); await page.screenshot({ path: path.join(OUT, 'popup-unitas-ranking.png') }); const r2 = page.locator('.relative.z-30 [role="button"]'); if (await r2.count()) { await r2.first().click(); await page.waitForTimeout(700); await page.screenshot({ path: path.join(OUT, 'popup-unitas-profile.png') }); log.unitasProfile = await hist(page); const closeBtn = page.locator('[role="dialog"] button[aria-label="Close"]'); if (await closeBtn.count()) { await closeBtn.first().click(); await page.waitForTimeout(400); } } }

  // news list screenshot
  const news = page.locator('.relative.z-30').locator('text=실시간 뉴스').first();
  if (await news.count()) { await news.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, 'popup-news.png') }); }

  // 4. shortcut tower via hot-issue chip 게임
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#omni-synapse-search input[type="text"]').click();
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.relative.z-30 button')).find((x) => x.textContent.trim() === '게임'); b && b.click(); }); await page.waitForTimeout(1500);
  log.shortcutTower = await hist(page);
  await page.screenshot({ path: path.join(OUT, 'popup-shortcut-tower.png') });
  await page.goBack(); await page.waitForTimeout(600);
  log.shortcutTowerAfterBack = { ...(await hist(page)), exitDialog: await page.locator('#exit-guard-title').count() };
  if (await page.locator('#exit-guard-title').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }

  // 5. U-AI result tower
  await page.locator('#omni-synapse-search input[type="text"]').click();
  await page.keyboard.type('블록체인'); await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
  log.uaiTower = await hist(page);
  await page.screenshot({ path: path.join(OUT, 'popup-uai-tower.png') });

  // 6. footer legal link click (routing)
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.locator('#site-footer a', { hasText: '이용약관' }).click(); await page.waitForTimeout(1500);
  log.termsUrl = page.url();
  await page.screenshot({ path: path.join(OUT, 'popup-terms-page.png') });

  fs.writeFileSync(path.join(OUT, 'popups.json'), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
