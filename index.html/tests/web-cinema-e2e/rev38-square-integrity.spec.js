const { test, expect } = require('@playwright/test');

// REV-38 (founder directive 2026-09-16) -- the U-Square 20-theme integration
// proof, measured on the BUILT app.
//
// MISSION 1: the three core panels (유숏츠 · 유토크 · 유지식거래소) must render
// their structural truth immediately and must FAIL OPEN when the server ledger
// objects are absent -- which is the live state today (hub_purchases and
// hub_messages are empty and the REV-36/37 shorts RPCs are not in the database
// yet), so this doubles as the fail-open proof.
//
// RE-CUT FOR THE REV-40 HONESTY CONTRACT: "fail open" used to mean "fall back
// to a seeded simulation", and this file asserted that the fabricated rows were
// present. REV-40 deleted the simulation, so failing open now means *declaring*
// the state rather than inventing content for it. Every assertion that pinned
// fiction in place has been replaced by the declared-state claim -- loading,
// empty, unreadable, or real rows -- which holds today and still holds on the
// day the founder applies the migrations and real rows arrive.
//
// REV-40 follow-up: `empty` narrowed to its literal meaning ("the ledger
// answered and it holds no rows"); a source that could not be read at all now
// says `unreadable`. Since every hub RPC is `authenticated`-only and this suite
// runs SIGNED OUT, the market bar and the shorts reaction counts settle on
// `unreadable` -- which is what failing open honestly looks like from here.
//
// MISSION 2: pixel alignment of the twenty tabs, the zero-friction scroller
// contract, the responsive grid contract, and ESC unwinding the nested short
// popup before the square itself. (Unchanged -- REV-40 touched data, not layout.)
//
// COVERAGE, STATED HONESTLY: tests/web-cinema.config.js declares SIX projects
// (chromium, webkit, mobile-chrome, tablet, inapp-kakao, inapp-instagram). As of
// REV-40 this file has only ever been MEASURED on chromium -- the 제14장 2단계
// target run. The remaining five projects are the 제14장 3단계 idle-daemon
// sweep's business, and nothing here may be claimed for them until it reports.
const { reachReleasedHome } = require('./_rev25Home');

/**
 * The modal panel enters with a scale+rise transform (measured on chromium:
 * `matrix(0.9666, 0, 0, 0.9666, 0, 8)` mid-flight). Any pixel measurement taken
 * before it settles reads the SCALED box -- a 36px pill measures 35.1px -- which
 * is an artefact of the entrance, not a layout defect. Wait for every ancestor
 * transform to reach identity before measuring anything.
 */
async function settleSquare(page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[role="dialog"] [data-unitas-hub][data-unitas-square]');
      if (!el) return false;
      for (let n = el; n; n = n.parentElement) {
        const t = getComputedStyle(n).transform;
        if (t && t !== 'none') {
          const m = t.match(/matrix\(([-\d.]+)/);
          if (m && Math.abs(parseFloat(m[1]) - 1) > 0.001) return false;
        }
      }
      return true;
    },
    null,
    { timeout: 20_000 },
  );
}

async function openSquare(page) {
  await reachReleasedHome(page);
  await page.locator('[data-unitas-hub-toggle]').click();
  const hub = page.locator('[role="dialog"] [data-unitas-hub][data-unitas-square]');
  await expect(hub).toBeVisible();
  await settleSquare(page);
  return hub;
}

async function openTab(hub, key) {
  await hub.locator(`[data-hub-tab-btn="${key}"]`).click();
  await expect(hub.locator(`[data-hub-panel="${key}"]`)).toBeVisible();
}

/**
 * The REV-40 rows-or-declared-empty gate, for the two containers whose
 * emptiness is still a single fact: the U-Talk room list and the U-Exchange
 * ticker both read state this page can always see (device history, the
 * broadcast channel), so "read it and found none" is the only empty they have.
 * Wait out `loading` (a real, transient state), then require either real rows
 * or the declared `data-hub-empty="1"`. A container that goes blank with
 * neither is the regression this guards -- silence dressed up as content.
 */
async function expectRowsOrEmpty(container, rowSelector, label) {
  await expect(async () => {
    if ((await container.locator(rowSelector).count()) > 0) return;
    await expect(
      container,
      `${label}: no ${rowSelector} rows and no data-hub-empty="1" -- a blank panel is not an honest empty state`,
    ).toHaveAttribute('data-hub-empty', '1');
  }).toPass({ timeout: 15_000 });
  // Which branch proved the contract. Read while the panel is still mounted:
  // switching tabs unmounts it and every later read would hang.
  return (await container.locator(rowSelector).count()) > 0 ? 'data' : 'empty';
}

/**
 * Which state a ledger-fed container DECLARES, read in one DOM pass.
 *
 * `data-hub-loading`, `data-hub-empty` and `data-hub-unreadable` are mutually
 * exclusive by construction, so reading them with three separate locator calls
 * could straddle a re-render and "prove" a combination that never existed on
 * screen. No flag at all means real rows are showing, which the exchange calls
 * `ledger`. A `multiple:` result is returned rather than thrown so the caller's
 * failure message names what it really saw.
 */
async function declaredState(locator) {
  return locator.evaluate((el) => {
    const on = ['loading', 'empty', 'unreadable'].filter((k) => el.getAttribute(`data-hub-${k}`) === '1');
    if (on.length > 1) return `multiple:${on.join('+')}`;
    return on[0] || 'data';
  });
}

test.describe('REV-38 M1 -- data integrity and render', () => {
  test('the three panels render their structural truth and fail open with no server ledger', async ({ page }) => {
    const hub = await openSquare(page);

    // --- 유숏츠 -------------------------------------------------------------
    const t0 = Date.now();
    await openTab(hub, 'shorts');
    const shorts = hub.locator('[data-unitas-shorts]');
    await expect(shorts.locator('[data-short]').first()).toBeVisible();
    const shortsMs = Date.now() - t0;
    expect(await shorts.locator('[data-short]').count()).toBeGreaterThanOrEqual(40);
    // The invented pulse rows and per-card watcher badges are gone; what stands
    // in their place is one declared empty section.
    const pulse = shorts.locator('[data-shorts-pulse]');
    await expect(pulse).toHaveAttribute('data-hub-empty', '1');
    expect(await pulse.locator('[data-shorts-pulse-row]').count()).toBe(0);
    await expect(pulse.locator('[data-shorts-feed-empty]')).toBeVisible();
    expect(await shorts.locator('[data-short-watching]').count()).toBe(0);
    // The real like counter survives on the card (em dash while loading).
    await expect(shorts.locator('[data-short]').first().locator('[data-short-likes]')).toBeVisible();
    // Fail-open: with hub_shorts_* absent (or signed out) the panel says "this
    // device" rather than claiming an account ledger it does not have.
    await expect(shorts.locator('[data-shorts-ledger]')).toHaveAttribute('data-shorts-ledger', 'device');

    // --- 유토크 -------------------------------------------------------------
    const t1 = Date.now();
    await openTab(hub, 'rooms');
    const rooms = hub.locator('[data-hub-rooms]');
    const roomList = rooms.locator('[data-hub-room-list]');
    await expect(roomList).toBeVisible();
    const roomsMs = Date.now() - t1;
    expect(await rooms.locator('[data-room]').count()).toBe(22);
    // Fail-open: no simulated conversation, a real shell plus a declared state.
    expect(await rooms.locator('[data-hub-msg-sim]').count()).toBe(0);
    await expect(rooms.locator('[data-hub-room-input]')).toBeVisible();
    await expect(rooms.locator('[data-hub-room-send]')).toBeVisible();
    const roomsBranch = await expectRowsOrEmpty(roomList, '[data-hub-msg]', 'U-Talk room list');
    // Authorship. As a bare "= 0" against an empty list this was a 0-of-0
    // vacuity: `[data-hub-msg]` is 0 in a fresh context, so `data-mine` was
    // never evaluated on a single row. Send one message (the rev29-verify
    // precedent) so the predicate has a population -- then it fails if the row
    // the visitor typed is NOT theirs, and it fails if any other row becomes
    // theirs.
    const mineBefore = await rooms.locator('[data-hub-msg][data-mine="1"]').count();
    const probe = `rev40 authorship probe ${Date.now()}`;
    await rooms.locator('[data-hub-room-input]').fill(probe);
    await rooms.locator('[data-hub-room-send]').click();
    await expect(
      rooms.locator('[data-hub-msg][data-mine="1"]').filter({ hasText: probe }),
      'the message the visitor just sent is not attributed to them',
    ).toHaveCount(1, { timeout: 15_000 });
    expect(
      await rooms.locator('[data-hub-msg][data-mine="1"]').count(),
      'a message the visitor did not write is being attributed to them',
    ).toBe(mineBefore + 1);

    // --- 유지식거래소 -------------------------------------------------------
    const t2 = Date.now();
    await openTab(hub, 'exchange');
    const ex = hub.locator('[data-hub-exchange]');
    await expect(ex.locator('[data-hub-packs] [data-pack]').first()).toBeVisible();
    const exMs = Date.now() - t2;
    const tickerBranch = await expectRowsOrEmpty(ex.locator('[data-hub-ticker]'), '[data-hub-trade]', 'U-Exchange ticker');
    expect(await ex.locator('[data-hub-trade-sim]').count()).toBe(0);
    expect(await ex.locator('[data-hub-market] [data-market-stat]').count()).toBe(4);
    // The PRNG demand sparkline had no demand signal behind it. Element deleted.
    expect(await ex.locator('svg[data-pack-demand]').count()).toBe(0);
    expect(await ex.locator('[data-pack-momentum]').count()).toBe(0);
    // No live ledger -> the bar says which kind of "no": 'empty' only when the
    // RPC answered with zero trades, 'unreadable' when there was no readable
    // source at all (signed out, or hub_market_pulse absent/refused). Both are
    // fail-open; neither invents a figure. 'sim' is no longer emittable.
    const market = ex.locator('[data-hub-market]');
    await expect(async () => {
      await expect(market, 'the 24h market bar never left the loading state').toHaveAttribute(
        'data-hub-market-source',
        /^(ledger|empty|unreadable)$/,
      );
    }).toPass({ timeout: 15_000 });
    const marketSource = await market.getAttribute('data-hub-market-source');
    expect(marketSource, 'the simulated market source was deleted in REV-40').not.toBe('sim');
    // The word and the flag are one fact said twice; they may not disagree, and
    // only one flag may be lit. 'ledger' is the word for the flagless state.
    expect(
      await declaredState(market),
      `the market bar says source="${marketSource}" while its state flags say something else`,
    ).toBe(marketSource === 'ledger' ? 'data' : marketSource);
    // Fail-open proof at the tile level: an unreadable bar prints em dashes, and
    // a bar that claims it read the ledger prints real figures (0 included).
    const figures = await market.locator('[data-market-stat]:not([data-market-stat="topTheme"]) strong').allInnerTexts();
    expect(figures.length, 'the three numeric market tiles').toBe(3);
    for (const raw of figures) {
      const fig = raw.trim();
      if (marketSource === 'unreadable') {
        expect(fig, 'an unreadable market bar printed a figure it never read').toBe('—');
      } else {
        expect(fig, `a "${marketSource}" market bar printed "—" instead of the figure it says it read`).toMatch(/\d/);
      }
    }

    console.log(`[rev38] live ledger state -- rooms ${roomsBranch}, ticker ${tickerBranch}, market ${marketSource}`);

    // Panel switches are local-state only (no fetch on the critical path), so
    // they must be well under a second even on the slow harness engines.
    console.log(`[rev38] panel render ms -- shorts ${shortsMs}, rooms ${roomsMs}, exchange ${exMs}`);
    for (const [name, ms] of [['shorts', shortsMs], ['rooms', roomsMs], ['exchange', exMs]]) {
      expect(ms, `${name} panel render`).toBeLessThan(8_000);
    }
  });
});

test.describe('REV-38 M2 -- hyper polish', () => {
  test('twenty tabs align to the pixel on one zero-friction scroller', async ({ page }) => {
    const hub = await openSquare(page);
    const tabs = hub.locator('[role="tab"][data-hub-tab-btn][data-square-tab]');
    expect(await tabs.count()).toBe(20);

    const boxes = await tabs.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top * 100) / 100, h: Math.round(r.height * 100) / 100 };
      }),
    );
    // Every pill is the same height (no 1px jitter between selected/unselected).
    const heights = boxes.map((b) => b.h);
    expect(Math.max(...heights) - Math.min(...heights), `tab heights ${JSON.stringify(heights)}`).toBeLessThanOrEqual(1);

    const width = page.viewportSize().width;
    const rows = Array.from(new Set(boxes.map((b) => Math.round(b.top)))).sort((a, b) => a - b);
    // Heights are read off a composited layer, so they land a hundredth of a
    // pixel under the declared minimum (35.99 for a 36px pill). Round to the
    // device pixel: the claim is "renders at the declared size", not "the
    // float is never 0.01 low".
    const shortest = Math.round(Math.min(...heights));
    if (width >= 768) {
      // Desktop: one row, so every pill shares a baseline.
      expect(rows.length, `desktop rows ${JSON.stringify(rows)}`).toBe(1);
      expect(shortest, `desktop pill height ${Math.min(...heights)}`).toBeGreaterThanOrEqual(36);
    } else {
      // Phone: the documented two-row column-flow grid, 44px touch targets.
      expect(rows.length, `mobile rows ${JSON.stringify(rows)}`).toBeLessThanOrEqual(2);
      expect(shortest, `mobile pill height ${Math.min(...heights)}`).toBeGreaterThanOrEqual(44);
    }

    // Zero-friction scroller contract on the rail itself.
    const rail = hub.locator('.qw-square-nav');
    const scroll = await rail.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        overscrollX: cs.overscrollBehaviorX,
        snap: cs.scrollSnapType,
        touch: cs.touchAction,
        overflowX: cs.overflowX,
        scrollable: el.scrollWidth > el.clientWidth,
        barHeight: el.offsetHeight - el.clientHeight,
      };
    });
    expect(scroll.overscrollX).toBe('contain'); // no accidental back-navigation
    expect(scroll.snap).toContain('x');
    expect(scroll.touch).toContain('pan');
    expect(scroll.scrollable, 'the twenty-pill rail must overflow and scroll').toBe(true);
    expect(scroll.barHeight, 'no visible scrollbar gutter').toBeLessThanOrEqual(1);
  });

  test('the descriptor panel grids follow the responsive contract', async ({ page }) => {
    const hub = await openSquare(page);
    await hub.locator('[data-square-tab="6"]').click(); // uAcademy: a descriptor panel
    const panel = hub.locator('[data-square-panel="uAcademy"]');
    await expect(panel).toBeVisible();

    const cols = await panel.evaluate((el) => {
      const g = (sel) => {
        const n = el.querySelector(sel);
        return n ? getComputedStyle(n).gridTemplateColumns.split(' ').filter(Boolean).length : 0;
      };
      return { signals: g('[data-square-signals]'), features: g('[data-square-features]') };
    });
    const width = page.viewportSize().width;
    expect(cols.signals).toBe(width >= 768 ? 4 : 2);
    expect(cols.features).toBe(width >= 768 ? 3 : 1);

    // Four tiles and three features are always present, whatever the columns.
    await expect(panel.locator('[data-square-signals] [data-square-signal]')).toHaveCount(4);
    await expect(panel.locator('[data-square-features] li')).toHaveCount(3);
  });

  test('a remembered far theme opens with its pill already in view', async ({ page }) => {
    const hub = await openSquare(page);
    // Theme 18 sits deep in a ~2000px rail; remember it, then reopen.
    await hub.locator('[data-square-tab="18"]').click();
    await expect(hub).toHaveAttribute('data-square-theme', 'uSpace');
    await page.keyboard.press('Escape');
    await expect(hub).toHaveCount(0, { timeout: 8_000 });

    await page.locator('[data-unitas-hub-toggle]').click();
    await expect(hub).toBeVisible();
    await settleSquare(page);
    await expect(hub).toHaveAttribute('data-square-theme', 'uSpace');

    const m = await hub.locator('.qw-square-nav').evaluate((rail) => {
      const a = rail.querySelector('[aria-selected="true"]');
      if (!a) return null;
      const left = a.offsetLeft;
      const right = left + a.offsetWidth;
      return {
        visible: left >= rail.scrollLeft - 1 && right <= rail.scrollLeft + rail.clientWidth + 1,
        left,
        right,
        scrollLeft: rail.scrollLeft,
        clientWidth: rail.clientWidth,
      };
    });
    expect(m, 'active pill metrics').not.toBeNull();
    expect(m.visible, `active pill out of view: ${JSON.stringify(m)}`).toBe(true);
  });

  test('ESC unwinds the nested short popup before the square', async ({ page }) => {
    const hub = await openSquare(page);
    await openTab(hub, 'shorts');
    await hub.locator('[data-unitas-shorts] [data-short]').first().click();

    const shortModal = page.locator('[data-short-modal]');
    await expect(shortModal).toBeVisible();

    // First ESC: the short only.
    await page.keyboard.press('Escape');
    await expect(shortModal).toHaveCount(0, { timeout: 8_000 });
    await expect(hub, 'the square survives closing the short').toBeVisible();

    // Second ESC: the square, and nothing beyond it (no exit guard).
    await page.keyboard.press('Escape');
    await expect(hub).toHaveCount(0, { timeout: 8_000 });
    await expect(page.locator('#exit-guard-title')).toHaveCount(0);
  });
});
