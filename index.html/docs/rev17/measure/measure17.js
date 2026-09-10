// REV-17 PHASE 1 measurement harness (scratch). Founder path -> gate -> home -> popup -> module panel.
const path = require('path');
const { chromium, devices } = require(path.join('c:/dev/unitas/index.html/node_modules/playwright'));

const BASE = 'http://127.0.0.1:3123';
// Founder bypass token: never hardcode -- read from the same env var lib/sovereignAuth.ts resolves.
// Run:  SOVEREIGN_AUTH_TOKEN=<token> node measure17.js   (the next start on :3123 must share the same value)
const TOKEN = process.env.SOVEREIGN_AUTH_TOKEN;
if (!TOKEN) throw new Error('SOVEREIGN_AUTH_TOKEN is required (founder path); refusing to run with a hardcoded default');
const OUT = __dirname;

const rect = (el) => {
  const r = el.getBoundingClientRect();
  return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), r: +(r.x + r.width).toFixed(1), b: +(r.y + r.height).toFixed(1) };
};

async function run(name, viewport, opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...(opts.device || {}), viewport, locale: 'en-US' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1'); } catch {} });
  const report = { name, viewport };

  await page.goto(`${BASE}/en?sovereign_auth=${TOKEN}&splash=0`);
  const enterBtn = page.locator('button.event-horizon-btn').last();
  await enterBtn.waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  // GATE: founder QA note
  report.gate = await page.evaluate(() => {
    const btn = document.querySelector('button.event-horizon-btn');
    const note = btn && btn.nextElementSibling;
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    return { btn: btn ? rect(btn) : null, noteText: note ? note.textContent : null, note: note ? rect(note) : null, noteClass: note ? note.className : null };
  });
  await page.screenshot({ path: path.join(OUT, `${name}-gate.png`) });

  await enterBtn.click();
  await page.locator('button:has(.cs-skip-aurora)').click();
  await page.getByRole('heading', { name: 'COMING SOON' }).waitFor({ timeout: 15000 });
  await page.locator('button.event-horizon-btn').last().click();
  await page.waitForSelector('.qw-cluster-card', { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.cs-root'), null, { timeout: 15000 });
  await page.waitForTimeout(800);

  // NAV CTA
  report.nav = await page.evaluate(() => {
    const cta = document.querySelector('#unitas-nav .unitas-install-cta');
    const cs = getComputedStyle(cta);
    const nav = document.querySelector('#unitas-nav');
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    return { rect: r(cta), border: cs.border, boxShadow: cs.boxShadow, bg: cs.backgroundColor, radius: cs.borderRadius, anim: cs.animationName, navBg: getComputedStyle(nav).backgroundColor,
      brand: getComputedStyle(cta.querySelector('.unitas-install-cta__brand')).color, label: getComputedStyle(cta.querySelector('.unitas-install-cta__label')).color,
      brandSize: getComputedStyle(cta.querySelector('.unitas-install-cta__brand')).fontSize, labelSize: getComputedStyle(cta.querySelector('.unitas-install-cta__label')).fontSize };
  });
  await page.screenshot({ path: path.join(OUT, `${name}-home-top.png`) });

  // CLUSTER CARDS
  const section = page.locator('.qw-cluster-section');
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  report.clusters = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    return Array.from(document.querySelectorAll('.qw-cluster-card')).map((c) => {
      const spans = Array.from(c.querySelectorAll(':scope > span'));
      return { rect: r(c), orbit: r(spans[0]), title: { text: spans[1].textContent, rect: r(spans[1]), size: getComputedStyle(spans[1]).fontSize, color: getComputedStyle(spans[1]).color, weight: getComputedStyle(spans[1]).fontWeight },
        tagline: { text: spans[2].textContent, rect: r(spans[2]), size: getComputedStyle(spans[2]).fontSize, color: getComputedStyle(spans[2]).color },
        count: { text: spans[3].textContent, rect: r(spans[3]), size: getComputedStyle(spans[3]).fontSize, color: getComputedStyle(spans[3]).color }, dots: c.querySelectorAll('.qw-cluster-dot').length };
    });
  });
  await section.screenshot({ path: path.join(OUT, `${name}-clusters.png`) });

  // OPEN COGNITIVE POPUP
  await page.evaluate(() => document.querySelectorAll('.qw-cluster-card')[0].click());
  await page.waitForSelector('.qw-popout-panel', { timeout: 10000 });
  await page.waitForTimeout(900);
  report.popout = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), right: +(b.x + b.width).toFixed(1) }; };
    const panel = document.querySelector('.qw-popout-panel');
    const header = panel.querySelector('header');
    const count = header.querySelector('p');
    const hint = panel.querySelector(':scope > p');
    const grid = panel.querySelector('.qw-tile-grid');
    const tiles = Array.from(grid.querySelectorAll('.qw-tile')).slice(0, 8).map((t) => {
      const med = t.querySelector('.qw-tile-medallion'), kind = t.querySelector('.qw-tile-kind'), title = t.querySelector('.qw-tile-title'), desc = t.querySelector('.qw-tile-desc'), foot = t.querySelector('.qw-tile-foot'), chip = t.querySelector('.qw-upay-chip'), chev = foot.querySelector('svg');
      return { tile: r(t), med: r(med), kind: { text: kind.textContent, rect: r(kind) }, title: { text: title.textContent, rect: r(title) }, desc: { text: desc.textContent.slice(0, 60), rect: r(desc) }, chip: { text: chip.textContent, rect: r(chip) }, chev: r(chev), display: getComputedStyle(t).display, pad: getComputedStyle(t).padding };
    });
    return { panel: r(panel), headerCount: { text: count.textContent, rect: r(count) }, hint: { text: hint.textContent, rect: r(hint) }, grid: r(grid), gridCols: getComputedStyle(grid).gridTemplateColumns, tiles };
  });
  await page.screenshot({ path: path.join(OUT, `${name}-popout.png`) });

  // OPEN FIRST MODULE PANEL
  await page.evaluate(() => document.querySelector('.qw-tile').click());
  await page.waitForSelector('.qw-module-panel', { timeout: 10000 });
  await page.waitForTimeout(700);
  report.modulePanel = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    const slide = document.querySelector('.qw-module-slide');
    const panel = document.querySelector('.qw-module-panel');
    const gw = panel.querySelector('.qw-upay-gateway');
    const btn = gw.querySelector('.qw-upay-btn');
    const grid = document.querySelector('.qw-tile-grid');
    return { slide: r(slide), panel: r(panel), gateway: r(gw), btn: { text: btn.textContent, rect: r(btn), state: btn.dataset.state, cs: { bg: getComputedStyle(btn).backgroundColor, color: getComputedStyle(btn).color, fontSize: getComputedStyle(btn).fontSize } }, chips: Array.from(gw.querySelectorAll('.qw-upay-chip')).map((c) => c.textContent), status: gw.querySelector('.qw-upay-status').textContent, gridHidden: getComputedStyle(grid).display, h3: panel.querySelector('h3').textContent, desc: panel.querySelector('p').textContent };
  });
  await page.screenshot({ path: path.join(OUT, `${name}-module.png`) });

  // RELOAD with the module panel open -> what survives?
  const before = await page.evaluate(() => ({ phase: sessionStorage.getItem('unitas_cinema_phase'), href: location.href, histLen: history.length, state: JSON.stringify(history.state) }));
  await page.reload();
  await page.waitForTimeout(3500);
  const after = await page.evaluate(() => ({ phase: sessionStorage.getItem('unitas_cinema_phase'), href: location.href, navType: performance.getEntriesByType('navigation')[0] && performance.getEntriesByType('navigation')[0].type, curtain: !!document.querySelector('.cs-root'), popout: !!document.querySelector('.qw-popout-panel'), modulePanel: !!document.querySelector('.qw-module-panel'), cinemaPhase: document.documentElement.dataset.cinemaPhase, scrollY: window.scrollY }));
  report.reload = { before, after };
  await page.screenshot({ path: path.join(OUT, `${name}-after-reload.png`) });

  // NAVIGATION TYPE probe: leave to another origin-less page and come back
  await page.goto('about:blank');
  await page.goBack();
  await page.waitForTimeout(3500);
  report.backForward = await page.evaluate(() => ({ navType: performance.getEntriesByType('navigation')[0] && performance.getEntriesByType('navigation')[0].type, phase: sessionStorage.getItem('unitas_cinema_phase'), curtain: !!document.querySelector('.cs-root'), cinemaPhase: document.documentElement.dataset.cinemaPhase, wasDiscarded: document.wasDiscarded, splash: document.documentElement.getAttribute('data-splash') }));
  await page.screenshot({ path: path.join(OUT, `${name}-after-back.png`) });

  await browser.close();
  return report;
}

(async () => {
  const reports = [];
  // desk done
  reports.push(await run('pixel7', { width: 412, height: 915 }, { device: { ...devices['Pixel 7'], deviceScaleFactor: 1 } }));
  require('fs').writeFileSync(path.join(OUT, 'measure17-mobile.json'), JSON.stringify(reports, null, 1));
  console.log(JSON.stringify(reports, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
