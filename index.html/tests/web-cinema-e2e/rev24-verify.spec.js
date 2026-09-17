// REV-24 acceptance measurements (founder directive 2026-09-13).
//
// Every assertion here is measured on the BUILT app rather than reasoned
// about. Four missions, in the founder's order:
//
//   M1  the paid model is deferred: no coin surface anywhere in the U-AI
//       result, and the eleven cards wear the SAME skin as the themes
//       around them (one card, three contents).
//   M2  the Sovereign Master Key: the covert header walks the funnel with no
//       cookie jar at all, upgrades itself into a session, reaches the
//       hidden console -- and `UNITAS_GATE_BYPASS` no longer exists.
//   M3  zero-cost rolling: nothing paint-tier animates while the page is
//       idle, and the rotation reads memory.
//   M4  the Omni-Tech swarm: a living, focusable, re-anchorable node field.
const { test, expect } = require('@playwright/test');
const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const { collapseSovereignPanel, walkCurtain, settleSurface } = require('./_rev25Home');

const FOUNDER_URL = `/?sovereign_auth=${TOKEN}&splash=0&dev=skip`;
const KEY_HEADER = 'x-unitas-signature';

async function founderHome(page) {
  // REV-25 M2 (founder directive 2026-09-13): this helper was CHROMIUM-DESKTOP
  // only, and REV-23/REV-24 were signed off on chromium alone -- so two
  // revisions of test defects sat here unmeasured. Measured 2026-09-14, all
  // three of them:
  //   - the founder's debug console (z-450, 272px at left 16) covers the
  //     search bar on a 412px viewport, so every click on the bar lands on the
  //     panel -> collapse it before the first paint;
  //   - a touch viewport still shows the entry curtain after `dev=skip`
  //     (`.cs-root`, opacity 1, pointer-events auto, full screen) -> walk it;
  //   - `page.evaluate(() => document.fonts.ready)` returns a FontFaceSet,
  //     which WebKit refuses to serialise, so the wait never waited and the
  //     hero was measured on fallback metrics (A=-83.6 vs A=74.22 settled --
  //     and 74.22/74.20 is what BOTH engines report once settled);
  //   - the white surface is stamped by client JS after hydration and the
  //     whole quantum-white token layer hangs off it, so a skin read before
  //     it sees the wrong radius.
  await collapseSovereignPanel(page);
  await page.goto(FOUNDER_URL, { waitUntil: 'domcontentloaded' });
  await walkCurtain(page);
  await settleSurface(page);
}

// ---------------------------------------------------------------------------
// M2 -- the Sovereign Master Key
// ---------------------------------------------------------------------------
test.describe('REV-24 M2 -- the Sovereign Master Key', () => {
  test('the covert header walks the funnel with no cookie at all', async ({ browser }) => {
    const ctx = await browser.newContext();
    // Baseline: this context is sealed like any stranger.
    const sealed = await ctx.request.get('/', { maxRedirects: 0 });
    expect(sealed.status()).toBe(307);
    expect(sealed.headers()['x-unitas-gate']).toBe('seal');

    // The same context, same (absent) cookies, plus the key.
    const passed = await ctx.request.get('/', { maxRedirects: 0, headers: { [KEY_HEADER]: TOKEN } });
    expect(passed.status(), 'the master key must not be sealed').toBe(200);
    expect(passed.headers()['x-unitas-gate']).toBe('pass');
    await ctx.close();
  });

  test('a wrong key is indistinguishable from no key', async ({ browser }) => {
    const ctx = await browser.newContext();
    for (const bad of [`${TOKEN}x`, TOKEN.slice(0, -1), 'v1.1.' + 'a'.repeat(64), '', 'Bearer nonsense']) {
      const res = await ctx.request.get('/', { maxRedirects: 0, headers: { [KEY_HEADER]: bad } });
      expect(res.status(), JSON.stringify(bad)).toBe(307);
      expect(res.headers()['x-unitas-gate'], JSON.stringify(bad)).toBe('seal');
    }
    await ctx.close();
  });

  test('Authorization: Bearer is accepted, for monitors that can set nothing else', async ({ browser }) => {
    const ctx = await browser.newContext();
    const res = await ctx.request.get('/', { maxRedirects: 0, headers: { authorization: `Bearer ${TOKEN}` } });
    expect(res.status()).toBe(200);
    expect(res.headers()['x-unitas-gate']).toBe('pass');
    await ctx.close();
  });

  test('a key-authenticated navigation UPGRADES itself into a session cookie', async ({ browser }) => {
    // The fail-proof half: after one keyed request the browser holds the
    // ordinary signed session, so prefetches and form posts -- which cannot
    // carry a custom header -- pass on the cookie alone.
    const ctx = await browser.newContext();
    await ctx.request.get('/', { maxRedirects: 0, headers: { [KEY_HEADER]: TOKEN } });
    const cookies = await ctx.cookies();
    const session = cookies.find((c) => c.name === 'unitas_sovereign');
    expect(session, 'the master key must mint a session').toBeTruthy();
    expect(session.httpOnly, 'the session cookie must stay HttpOnly').toBe(true);

    // And now, with NO header, the same context walks through.
    const followUp = await ctx.request.get('/ko', { maxRedirects: 0 });
    expect(followUp.status()).toBe(200);
    expect(followUp.headers()['x-unitas-gate']).toBe('pass');
    await ctx.close();
  });

  test('the key opens the hidden console, and its absence still 404s', async ({ browser }) => {
    // `/sovereign`, not `/en/sovereign`: routing.localePrefix is 'as-needed',
    // so English is the bare path and `/en/*` 307s to it BEFORE the gate is
    // even consulted (that redirect carries no x-unitas-gate header at all --
    // measured 2026-09-13, which is how this assertion was corrected).
    //
    // A FRESH context per probe, deliberately: a keyed request mints the
    // session cookie into whatever context made it, so reusing one context
    // would make the second "public" probe a founder. (Measured -- it
    // returned 200, which is the upgrade in `a key-authenticated navigation
    // UPGRADES itself` working exactly as designed.)
    for (const path of ['/sovereign', '/ko/sovereign']) {
      const anon = await browser.newContext();
      const shut = await anon.request.get(path, { maxRedirects: 0 });
      expect(shut.status(), `${path} must not exist for the public`).toBe(404);
      await anon.close();

      const keyed = await browser.newContext();
      const open = await keyed.request.get(path, { maxRedirects: 0, headers: { [KEY_HEADER]: TOKEN } });
      expect(open.status(), `${path} must open on the key alone`).toBe(200);
      expect(open.headers()['x-unitas-gate'], path).toBe('pass');
      await keyed.close();
    }
  });

  test('/api/sovereign/verify answers the key, so a monitor can check its own expiry', async ({ browser }) => {
    const ctx = await browser.newContext();
    const anon = await ctx.request.get('/api/sovereign/verify');
    expect((await anon.json()).founder).toBe(false);

    const keyed = await browser.newContext();
    const res = await keyed.request.get('/api/sovereign/verify', { headers: { [KEY_HEADER]: TOKEN } });
    expect((await res.json()).founder).toBe(true);
    await ctx.close();
    await keyed.close();
  });

  test('an indexer still reads the real pages (Codex ch.7 survives M2)', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
    const res = await ctx.request.get('/', { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['x-unitas-gate']).toBe('pass');
    await ctx.close();
  });
});

// ---------------------------------------------------------------------------
// M3 -- zero-cost rolling / frame budget
// ---------------------------------------------------------------------------
test.describe('REV-24 M3 -- nothing paint-tier runs while the page is idle', () => {
  test('the search ring and the hero rule are STILL at rest, and live on engage', async ({ page }) => {
    await founderHome(page);

    const ringAtRest = await page.evaluate(() => getComputedStyle(document.querySelector('#omni-synapse-search')).animationName);
    expect(ringAtRest, 'the search ring must not flow while nobody is at the bar').toBe('none');

    const ruleAtRest = await page.evaluate(() => {
      const h1 = document.querySelector('.qw-hero-wrap h1');
      return h1 ? getComputedStyle(h1, '::after').animationName : 'none';
    });
    expect(ruleAtRest, 'the hero underline must not sweep while idle').toBe('none');

    // Engaging brings the ring back -- the motion was narrowed, not deleted.
    await page.locator('#omni-synapse-search').hover();
    await page.waitForTimeout(120);
    const ringOnHover = await page.evaluate(() => getComputedStyle(document.querySelector('#omni-synapse-search')).animationName);
    expect(ringOnHover, 'the ring must flow when the visitor is at the bar').toBe('qw-search-ring-flow');
  });

  test('the nav install CTA does not pulse until it is engaged', async ({ page }) => {
    await founderHome(page);
    const cta = page.locator('.app-download-pulse').first();
    if ((await cta.count()) === 0) test.skip(true, 'install CTA not mounted on this viewport');
    const atRest = await cta.evaluate((el) => ({
      animation: getComputedStyle(el).animationName,
      shadow: getComputedStyle(el).boxShadow,
    }));
    // Two keyframes used to run here forever, one per surface:
    // `app-download-pulse` (globals.css, dark route) and its white-surface
    // REPLACEMENT `qw-cta-breathe` (quantum-white.css). Both animate
    // box-shadow + border-color on an element that is in the nav of every
    // page. Neither may run while nothing is touching it.
    expect(atRest.animation, 'the CTA must not repaint a shadow every frame while idle').toBe('none');
    // The affordance survives: engaging still changes how it reads. POLLED,
    // not a fixed 160ms wait -- measured 2026-09-14, WebKit had not finished
    // the transition at 160ms and reported the at-rest shadow, while at 400ms
    // both engines report the identical engaged value
    // (`rgba(184,150,46,.14) 0 0 0 0` -> `rgba(11,92,255,.14) 0 0 0 3px`,
    // border `rgba(10,10,12,.45)` -> `rgb(8,71,201)`). The product is the
    // same on both; only the clock differed.
    await cta.hover();
    await expect
      .poll(async () => cta.evaluate((el) => getComputedStyle(el).boxShadow), { timeout: 5_000 })
      .not.toBe(atRest.shadow);
  });

  test('no request is issued while the page sits idle and unattended', async ({ page }) => {
    await founderHome(page);
    // Let anything the first paint kicked off settle.
    await page.waitForTimeout(2500);
    const seen = [];
    page.on('request', (r) => seen.push(r.url()));
    await page.waitForTimeout(8000);
    const chatty = seen.filter((u) => !u.startsWith('data:') && !u.startsWith('blob:'));
    expect(chatty, `idle page issued ${chatty.length} request(s):\n${chatty.slice(0, 10).join('\n')}`).toEqual([]);
  });

  test('the idle frame budget is honoured -- the app schedules no frames and the main thread stays free', async ({ page, browserName }, testInfo) => {
    // Three measured passes run back to back here; on a software rasteriser
    // each one is paced by a ~555ms frame. This is measurement time, not a
    // performance budget.
    if (browserName === 'webkit') test.setTimeout(180_000);
    await founderHome(page);
    await page.waitForTimeout(600);

    // WHY THIS TEST CHANGED (REV-25 M2, measured 2026-09-14).
    //
    // It used to assert `rAF p95 < 120ms` on chromium alone. Run on WebKit for
    // the first time it read 444ms, and the bisect says that number is about
    // the HARNESS, not the product:
    //
    //   webkit  about:blank        p95  17.0 / median 16.0
    //   webkit  /robots.txt        p95  17.0 / median 16.0
    //   webkit  released home      p95 425.0 / median 363.0
    //   webkit  home, body hidden              median  15.0
    //   webkit  setTimeout(0) latency on the home            15 ms
    //   webkit  live intervals: one, at 600000ms. app rAF registrations: 0
    //   chromium released home     p95  33.4 / median 16.7 (flat under every
    //                                    bisect step -- nothing costs anything)
    //
    // So: rAF itself is not throttled in this WebKit, the main thread is FREE,
    // the application asks for no frames -- and hiding the page body takes the
    // cadence from 366ms to 15ms. What costs 350ms a frame is RASTERISING the
    // full released home in a headless WebKit that has no GPU, and it is
    // diffuse (hiding the rings, the nav, the hero and the search bar together
    // only recovers 375 -> 292ms). A GPU-composited Safari is NOT measured by
    // this harness either way.
    //
    // REV-24 already faced this exact shape in rev21-rail-drag: when the
    // estimator turns out to measure something other than what the assertion
    // claims, REPLACE THE ESTIMATOR -- do not widen the budget. So the
    // runaway-loop claim is now made directly and portably, and the p95
    // ceiling is kept unchanged where it measures the product.

    // 1) THE RUNAWAY-LOOP DETECTOR. While nothing touches the page, the
    //    application must not ask for a single animation frame.
    const scheduled = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let n = 0;
          const raf = window.requestAnimationFrame.bind(window);
          window.requestAnimationFrame = (cb) => {
            n += 1;
            return raf(cb);
          };
          setTimeout(() => {
            window.requestAnimationFrame = raf;
            resolve(n);
          }, 3000);
        }),
    );

    // 2) THE MAIN THREAD IS FREE: a zero-delay task must land promptly.
    const latency = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const out = [];
          let n = 0;
          const step = () => {
            const t = performance.now();
            setTimeout(() => {
              out.push(performance.now() - t);
              if (++n < 20) step();
              else {
                out.sort((a, b) => a - b);
                resolve(out[Math.floor(out.length / 2)]);
              }
            }, 0);
          };
          step();
        }),
    );

    // 3) The cadence, measured everywhere and logged for the record.
    //
    // TIME-bounded, not FRAME-bounded (REV-28). Asking for 90 frames assumes a
    // frame rate, and this harness's WebKit rasterises the released page at
    // ~555ms per frame -- 90 frames is ~50 seconds there, which walked this
    // test straight into the 60s budget. Collecting for a fixed wall clock
    // instead means a slow engine simply contributes fewer samples. The p95
    // ASSERTION is chromium-only and chromium reaches 90 frames in ~1.5s, so
    // nothing about the claim changes; only the patience does.
    const p95 = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const gaps = [];
          let last = performance.now();
          const deadline = last + 6_000;
          const tick = (now) => {
            gaps.push(now - last);
            last = now;
            if (gaps.length < 90 && now < deadline) requestAnimationFrame(tick);
            else {
              gaps.sort((a, b) => a - b);
              resolve(gaps[Math.floor(gaps.length * 0.95)]);
            }
          };
          requestAnimationFrame(tick);
        }),
    );
    console.log(
      `[REV-24 M3][${testInfo.project.name}] idle rAF p95 = ${p95.toFixed(1)}ms · frames scheduled by the app in 3s = ${scheduled} · setTimeout(0) median = ${latency.toFixed(1)}ms`,
    );

    expect(scheduled, 'an idle page must not schedule animation frames').toBeLessThanOrEqual(2);
    expect(latency, 'an idle page must leave the main thread free').toBeLessThan(50);
    if (browserName === 'chromium') {
      // Unchanged budget, on the engine where it measures the product.
      expect(p95).toBeLessThan(120);
    }
  });
});

// ---------------------------------------------------------------------------
// M1 -- one card skin, and no coin anywhere in the result
// ---------------------------------------------------------------------------
test.describe('REV-24 M1 -- the paid model is deferred, the skeleton is one', () => {
  test('the theme card and the U-AI card resolve to the SAME skin', async ({ page }) => {
    await founderHome(page);
    const skin = await page.evaluate(() => {
      const probe = (cls) => {
        const el = document.createElement('div');
        el.className = cls;
        document.body.appendChild(el);
        const cs = getComputedStyle(el);
        const out = {
          radius: cs.borderTopLeftRadius,
          border: cs.borderTopWidth + ' ' + cs.borderTopStyle,
          background: cs.backgroundImage + '|' + cs.backgroundColor,
          shadow: cs.boxShadow,
        };
        el.remove();
        return out;
      };
      return { hub: probe('qw-hub-card'), stream: probe('qw-stream-card'), tier: probe('qw-tier-card') };
    });
    console.log('[REV-24 M1] skins', JSON.stringify(skin, null, 2));
    expect(skin.stream.radius, 'U-AI card radius must match the theme card').toBe(skin.hub.radius);
    expect(skin.stream.background, 'U-AI card ground must match the theme card').toBe(skin.hub.background);
    expect(skin.stream.shadow, 'U-AI card shadow must match the theme card').toBe(skin.hub.shadow);
    expect(skin.tier.radius).toBe(skin.hub.radius);
    expect(skin.tier.background).toBe(skin.hub.background);
  });

  test('the U-AI result carries no coin, price or paid-tier surface', async ({ page }) => {
    await founderHome(page);
    const QUERY = 'quantum computing';
    const bar = page.locator('#omni-synapse-search input').first();
    await bar.click();
    await bar.fill(QUERY);
    await bar.press('Enter');
    await page.waitForSelector('.qw-stream-card, [data-stream-card], .qw-stream', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    // REV-40. This contract forbids the SHAPE OF MONEY, not a vocabulary.
    //
    // It used to be a bare substring sweep for ['U-COIN', 'UCOIN', '코인',
    // 'Micro-Burn', 'Deep Insight · The VOID'], and REV-24's own SPEC warns
    // against precisely that twice (docs/rev24/SPEC.md §1.2: "Coin Pulse" and
    // `coinGecko` are CONTENT, not payment UI; the `cost` in
    // `WIKIMEDIA_LEG_COST` is a latency budget, not money).
    //
    // "Micro-Burn" is this company's margin architecture (Codex ch.1) and,
    // since REV-35 33411bb swapped `.qw-stream-rankings` from
    // UnitasModuleRankings to URankingsShorts, it is also the NAME of a
    // leaderboard metric rendered as a percentage (lib/square/uRankings.ts
    // seeds it 42-100). Naming the architecture is not selling it. Balances,
    // prices, top-up CTAs and lock badges sell it -- and those are what is
    // banned below, measured WIDER than the old needle list rather than
    // narrower: 'Charge Coins' and 'Unlock for 500' both walked straight past
    // the substring sweep and are caught now, as is any clickable that offers
    // coins before it carries a number.
    const paid = await page.evaluate((query) => {
      const root = document.querySelector('.qw-stream');
      if (!root) return { missing: true, violations: [], stray: [] };
      // The result speaks the visitor's own words back at them (swarm blurbs,
      // the refine input, outbound search links). The visitor's words are not
      // the product's paid surface, so they come out before the scan.
      const strip = (s) => (s || '').split(query).join(' ');
      const text = strip(root.innerText);
      const AMOUNT = String.raw`(?:\d[\d,.  ]*|—)`;
      const CURRENCY = String.raw`(?:U-?COIN|코인)`;
      const rules = [
        [
          'a coin amount (price or balance chip)',
          new RegExp(`${AMOUNT}\\s*[·:]?\\s*${CURRENCY}|${CURRENCY}\\s*[·:]?\\s*${AMOUNT}`, 'i'),
        ],
        ['the deleted paid tier label', /Deep Insight\s*·\s*The VOID/],
        [
          'a payment / unlock affordance',
          /(?:charge|buy|top\s*-?\s*up)\s+coins|충전하|결제하|구매하|unlock\s+(?:for|with)|잠금\s*해제/i,
        ],
      ];
      const violations = rules.filter(([, re]) => re.test(text)).map(([name]) => name);
      // Stronger than the old text-only sweep: a clickable that offers coins is
      // a paid surface even before it grows a number.
      const affordance = new RegExp(`${CURRENCY}|충전|결제`, 'i');
      const clickable = Array.from(root.querySelectorAll('button, a, [role="button"]'))
        .map((el) => strip(el.innerText).trim())
        .filter((label) => affordance.test(label))
        .map((label) => label.slice(0, 60));
      if (clickable.length) violations.push(`a coin affordance: ${clickable.join(' | ')}`);
      // The architecture term is content ONLY inside the U-Square leaderboard
      // the owner pinned into the result (UaiHyperStream `.qw-stream-rankings`,
      // owner instruction 2026-09-04 round 2). Anywhere else in the stream it is
      // a regression -- the needle was not deleted, it was nailed in place.
      const stray = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!/Micro-?Burn/i.test(node.nodeValue || '')) continue;
        if (node.parentElement && node.parentElement.closest('.qw-stream-rankings')) continue;
        stray.push((node.nodeValue || '').trim().slice(0, 80));
      }
      return { missing: false, violations, stray };
    }, QUERY);
    expect(paid.missing, 'the U-AI stream did not render').toBe(false);
    expect(paid.violations, `the U-AI result grew a paid surface: ${paid.violations.join('; ')}`).toEqual([]);
    expect(paid.stray, `Micro-Burn escaped the leaderboard: ${paid.stray.join(' | ')}`).toEqual([]);
    // And no dead paid-tier class survived the purge.
    for (const cls of ['qw-stream-deep-cta', 'qw-stream-reporter-paid', 'qw-stream-deep-locked', 'qw-stream-spine-cta']) {
      expect(await page.locator(`.${cls}`).count(), cls).toBe(0);
    }
  });
});


