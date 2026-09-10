const path = require('path');
const { chromium, devices } = require(path.join('c:/dev/unitas/index.html/node_modules/playwright'));
const TOKEN = process.env.SOVEREIGN_AUTH_TOKEN || 'unitas_master_dooyeong_2026_secure_key';
(async () => {
  const browser = await chromium.launch();
  for (const [name, vp, dev] of [['desk', { width: 1366, height: 768 }, {}], ['pixel', devices['Pixel 7'].viewport, devices['Pixel 7']]]) {
    const ctx = await browser.newContext({ ...dev, viewport: vp, locale: 'ko-KR' });
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { sessionStorage.setItem('unitas_sovereign_panel_collapsed', '1'); } catch {} });
    await page.goto(`http://127.0.0.1:3123/ko?sovereign_auth=${TOKEN}&splash=0`);
    await page.locator('button.event-horizon-btn').last().waitFor({ timeout: 20000 });
    await page.waitForTimeout(800);
    await page.locator('button.event-horizon-btn').last().click();
    await page.locator('button:has(.cs-skip-aurora)').click();
    await page.getByRole('heading', { name: 'COMING SOON' }).waitFor({ timeout: 15000 });
    await page.locator('button.event-horizon-btn').last().click();
    await page.waitForSelector('.qw-cluster-card', { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector('.cs-root'), null, { timeout: 15000 });
    await page.waitForTimeout(800);
    const m = await page.evaluate(async () => {
      const h1 = document.querySelector('.qw-hero-wrap h1');
      const cs = getComputedStyle(h1);
      const f = parseFloat(cs.fontSize);
      await document.fonts.ready;
      const canvas = document.createElement('canvas'); const c = canvas.getContext('2d');
      c.font = `${cs.fontWeight} ${f}px ${cs.fontFamily}`;
      const mt = c.measureText('UNITAS');
      const mtH = c.measureText('H');
      // baseline probe: inline-block zero-height aligned to baseline inside a clone
      const probe = document.createElement('span'); probe.textContent = 'UNITAS';
      probe.style.cssText = `font:${cs.fontWeight} ${f}px ${cs.fontFamily};line-height:${cs.lineHeight};letter-spacing:${cs.letterSpacing};display:inline-block;position:absolute;left:-9999px;top:0;`;
      const marker = document.createElement('span'); marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;';
      probe.appendChild(marker); document.body.appendChild(probe);
      const pr = probe.getBoundingClientRect(); const mr = marker.getBoundingClientRect();
      const lineTop = pr.top; const baseline = mr.top; // marker box bottom = baseline (height 0)
      probe.remove();
      const zoom = pr.height / (parseFloat(cs.lineHeight)); // screen/css
      const nav = document.querySelector('#unitas-nav').getBoundingClientRect();
      const h1r = h1.getBoundingClientRect();
      const search = document.querySelector('#omni-synapse-search').getBoundingClientRect();
      const text = h1.firstChild; const range = document.createRange(); range.setStart(text,0); range.setEnd(text,6);
      const rr = range.getBoundingClientRect();
      return { f, lineHeight: cs.lineHeight, fontFamily: cs.fontFamily, weight: cs.fontWeight, ascent: mt.actualBoundingBoxAscent, descent: mt.actualBoundingBoxDescent, capH: mtH.actualBoundingBoxAscent, fontAsc: mt.fontBoundingBoxAscent, fontDesc: mt.fontBoundingBoxDescent,
        probe: { lineTop, baseline, height: pr.height, k2: (baseline - lineTop) / pr.height }, zoom, navBottom: nav.bottom, navHeight: nav.height, h1: { top: h1r.top, bottom: h1r.bottom, height: h1r.height }, rangeTop: rr.top, rangeH: rr.height, searchTop: search.top, dashboardZoom: getComputedStyle(document.querySelector('.dashboard-zoom')).zoom };
    });
    console.log(name, JSON.stringify(m));
    await ctx.close();
  }
  await browser.close();
})();
