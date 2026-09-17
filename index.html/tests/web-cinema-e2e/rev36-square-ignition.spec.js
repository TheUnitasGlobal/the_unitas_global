const { test, expect } = require('@playwright/test');

// REV-36 M3 acceptance, RE-CUT FOR THE REV-40 HONESTY CONTRACT.
//
// The original cut of this file asserted that the three U-Square panels
// (유숏츠 · 유토크 · 유지식거래소) opened on *living* data: a rolling pulse feed,
// a simulated conversation in every room, a ticker already carrying trades and
// a demand sparkline per pack. Every one of those rows was fabricated by a
// seeded PRNG. REV-40 deleted the simulation outright, so those assertions were
// pinning fiction in place.
//
// What is asserted now is the truth contract that replaced it: the structural
// catalogue that really is constant (44 clips, 22 rooms, the pack grid, the
// four market tiles, the composer) plus, for every panel fed by a ledger, the
// DECLARED-STATE claim -- loading, empty, unreadable, or real rows -- and never
// a fifth, invented one.
//
// REV-40 follow-up: "empty" was doing two jobs and lying in one of them. It now
// means strictly "the ledger answered and it holds no rows"; a source that could
// not be read at all says `unreadable`. Every hub RPC is granted to
// `authenticated` only and this suite runs SIGNED OUT, so the panels that need
// one settle on `unreadable` today -- not on `empty`. The day the founder
// applies the migrations and a signed-in session reads real rows, the data
// branch satisfies the same assertions and this file keeps passing untouched.
//
// The square is opened exactly the way rev34-weather-square.spec.js opens it
// (the founder session cookie + released-home helper).
//
// COVERAGE, STATED HONESTLY: tests/web-cinema.config.js declares SIX projects
// (chromium, webkit, mobile-chrome, tablet, inapp-kakao, inapp-instagram). As of
// REV-40 this file has only ever been MEASURED on chromium -- the 제14장 2단계
// target run. The other five projects are the 제14장 3단계 idle-daemon sweep's
// business, and nothing here may be claimed for them until that sweep reports.
// (The previous header claimed "every assertion runs on chromium, webkit and
// mobile-chrome": wrong in the count and wrong in the tense.)
const { reachReleasedHome } = require('./_rev25Home');

async function openSquare(page) {
  await reachReleasedHome(page);
  const toggle = page.locator('[data-unitas-hub-toggle]');
  await toggle.click();
  const hub = page.locator('[role="dialog"] [data-unitas-hub][data-unitas-square]');
  await expect(hub).toBeVisible();
  return hub;
}

async function openTab(hub, key) {
  await hub.locator(`[data-hub-tab-btn="${key}"]`).click();
  await expect(hub.locator(`[data-hub-panel="${key}"]`)).toBeVisible();
}

/**
 * The REV-40 rows-or-declared-empty gate for a container whose emptiness is
 * still a single fact: the U-Talk room list and the U-Exchange ticker, both fed
 * from state this page can always see (device history, the broadcast channel),
 * so "read it and found none" is the only kind of empty they have.
 *
 * `loading` is a real, transient state (the session probe, the RPC or the
 * realtime channel has not answered yet), so it is waited out rather than
 * asserted against. What must hold once the source has answered is that the
 * container either carries real rows or declares itself empty -- there is no
 * third rendering. A container that simply goes blank with no `data-hub-empty`
 * flag is the exact regression this guards: silence dressed up as content.
 */
async function expectRowsOrEmpty(container, rowSelector, label) {
  await expect(async () => {
    if ((await container.locator(rowSelector).count()) > 0) return;
    await expect(
      container,
      `${label}: no ${rowSelector} rows and no data-hub-empty="1" -- a blank panel is not an honest empty state`,
    ).toHaveAttribute('data-hub-empty', '1');
  }).toPass({ timeout: 15_000 });
}

/**
 * Which state a ledger-fed container DECLARES, read in one DOM pass.
 *
 * `data-hub-loading`, `data-hub-empty` and `data-hub-unreadable` are mutually
 * exclusive by construction, so reading them with three separate locator calls
 * could straddle a re-render and "prove" a combination that never existed on
 * screen. No flag at all means real rows are showing, which the exchange calls
 * `ledger` and everything else calls `data`. A `multiple:` result is returned
 * rather than thrown so the caller's failure message names what it really saw.
 */
async function declaredState(locator) {
  return locator.evaluate((el) => {
    const on = ['loading', 'empty', 'unreadable'].filter((k) => el.getAttribute(`data-hub-${k}`) === '1');
    if (on.length > 1) return `multiple:${on.join('+')}`;
    return on[0] || 'data';
  });
}

test.describe('REV-36 M3 -- U-Square truth contract (REV-40 re-cut)', () => {
  test('U-Shorts opens on the 44-clip catalogue with honest empty/loading reaction states', async ({ page }) => {
    const hub = await openSquare(page);
    await openTab(hub, 'shorts');
    const shorts = hub.locator('[data-unitas-shorts]');

    // The seed catalogue is a TS constant, not a ledger read: it is the one
    // part of this panel that is allowed to be present unconditionally.
    await expect(shorts.locator('[data-short]').first()).toBeVisible();
    expect(await shorts.locator('[data-short]').count()).toBeGreaterThanOrEqual(40);

    // The reaction stream. There is no event table and no presence channel
    // behind it, so it is a permanently declared empty section -- NOT six
    // invented "{handle} liked {title}" rows.
    const pulse = shorts.locator('[data-shorts-pulse]');
    await expect(pulse).toBeVisible();
    await expect(pulse).toHaveAttribute('data-hub-empty', '1');
    expect(
      await pulse.locator('[data-shorts-pulse-row]').count(),
      'the fabricated pulse rows were deleted in REV-40 and must not return',
    ).toBe(0);
    await expect(pulse.locator('[data-shorts-feed-empty]')).toBeVisible();

    // Per-card watcher badges were invented figures with no source. Gone.
    expect(await shorts.locator('[data-short-watching]').count()).toBe(0);
    // What is left on a card is the real like total ("—" until the RPC answers,
    // then the genuine number, zero included).
    await expect(shorts.locator('[data-short]').first().locator('[data-short-likes]')).toBeVisible();

    // The like/follow ledger's own status line. `loading` must clear; what
    // remains is a single element declaring exactly one state -- `empty` (the
    // RPC answered and holds no rows) or `unreadable` (there is no readable
    // source from here, which is what a signed-out visitor gets because
    // hub_shorts_counts is `authenticated`-only) -- or NO line at all, which is
    // legitimate only once the figures have moved onto the cards themselves.
    //
    // The old shape here was `countsEmpty === 1 || countsAny === 0`: an OR whose
    // right arm went green the moment the element vanished, so deleting the
    // honest empty line outright was a PASS. Absence must now be earned -- the
    // card badge has to print a real figure instead of the em dash it shows
    // whenever the ledger has not been read -- and presence must name a state.
    await expect(async () => {
      expect(
        await shorts.locator('[data-shorts-counts][data-hub-loading="1"]').count(),
        'the reaction counts never left the loading state',
      ).toBe(0);
    }).toPass({ timeout: 15_000 });
    const counts = shorts.locator('[data-shorts-counts]');
    const countsAny = await counts.count();
    const cardLikes = (await shorts.locator('[data-short] [data-short-likes]').first().innerText()).trim();
    expect(countsAny, 'the reaction status line must be a single element').toBeLessThanOrEqual(1);
    // Printed so the run states which branch proved the claim, and what the card
    // badge said while it did, rather than leaving "it passed" to mean either.
    console.log(
      `[rev36] reaction counts state -- ${countsAny === 1 ? await declaredState(counts) : 'absent (data branch)'}, card likes "${cardLikes}"`,
    );
    if (countsAny === 1) {
      expect(
        await declaredState(counts),
        'the reaction status line is on screen without naming which state it is in',
      ).toMatch(/^(empty|unreadable)$/);
    } else {
      expect(
        cardLikes,
        'the reaction status line is gone while the cards still print "—": the honest empty/unreadable line was deleted, not outgrown by real figures',
      ).toMatch(/\d/);
    }

    // The two sort chips. REV-40 renamed "trending" (which ranked on invented
    // momentum) to "liked" (which ranks on the real like ledger).
    await expect(shorts.locator('[data-shorts-sort="liked"]')).toBeVisible();
    await expect(shorts.locator('[data-shorts-sort="catalogue"]')).toBeVisible();
    expect(await shorts.locator('[data-shorts-sort="trending"]').count()).toBe(0);

    // The guest/account ledger badge stays honest either way.
    await expect(shorts.locator('[data-shorts-ledger]')).toHaveAttribute('data-shorts-ledger', /^(device|account)$/);
  });

  test('U-Talk opens 22 rooms on the honest three-state list, never counted as mine', async ({ page }) => {
    const hub = await openSquare(page);
    await openTab(hub, 'rooms');
    const rooms = hub.locator('[data-hub-rooms]');
    expect(await rooms.locator('[data-room]').count()).toBe(22);

    // The room is a real shell whatever the ledger says: a header that states
    // which room, whether realtime answered and whether history is durable,
    // plus a working composer. That is what replaced the fake conversation.
    const roomBody = rooms.locator('[data-hub-room]');
    await expect(roomBody).toBeVisible();
    await expect(rooms.locator('[data-hub-live]')).toBeVisible();
    await expect(rooms.locator('[data-hub-durable]')).toHaveAttribute('data-hub-durable', /^[01]$/);
    await expect(rooms.locator('[data-hub-room-input]')).toBeVisible();
    await expect(rooms.locator('[data-hub-room-send]')).toBeVisible();

    // The simulated rows are gone -- not renamed, not hidden, absent.
    expect(
      await rooms.locator('[data-hub-msg-sim]').count(),
      'the simulated conversation was deleted in REV-40 and must not return',
    ).toBe(0);

    // The message list is three-state: real rows, or a declared empty, after
    // loading clears. Today a signed-out visitor with no device history is empty.
    const list = rooms.locator('[data-hub-room-list]');
    await expect(list).toBeVisible();
    await expectRowsOrEmpty(list, '[data-hub-msg]', 'U-Talk room list');

    // Nothing the visitor did not write may ever be attributed to them.
    //
    // Asserted against an EMPTY list this was a 0-of-0 vacuity: `[data-hub-msg]`
    // is 0 in a fresh context, so `data-mine` was never evaluated on a single
    // row and flipping every message to mine would still have been green. So
    // write one. Sending a real message (rev29-verify.spec.js:287-290 is the
    // precedent -- fill the composer, click send) gives the predicate a
    // population, and the claim then has two halves that can actually fail:
    // the message this visitor typed IS theirs, and the count of "mine" rose by
    // exactly one, so no pre-existing row was re-attributed along the way.
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

    // Switching rooms really switches the room the panel is bound to.
    const firstKey = await roomBody.getAttribute('data-hub-room');
    const nextKey = await rooms.locator('[data-room]').nth(1).getAttribute('data-room');
    expect(nextKey).not.toBe(firstKey);
    await rooms.locator('[data-room]').nth(1).click();
    await expect(roomBody).toHaveAttribute('data-hub-room', nextKey, { timeout: 10_000 });
    await expectRowsOrEmpty(list, '[data-hub-msg]', 'U-Talk room list after switching rooms');
  });

  test('U-Exchange opens on a truthful ticker and a 24h market bar, with no sparklines', async ({ page }) => {
    const hub = await openSquare(page);
    await openTab(hub, 'exchange');
    const ex = hub.locator('[data-hub-exchange]');

    // The pack grid is catalogue truth and is always there.
    await expect(ex.locator('[data-hub-packs] [data-pack]').first()).toBeVisible();

    // The ticker: real broadcast trades or a declared empty. hub_purchases has
    // no rows today, so the empty branch is what renders -- but a genuine
    // purchase (see rev29-verify) puts a real row here and still satisfies this.
    const ticker = ex.locator('[data-hub-ticker]');
    await expect(ticker).toBeVisible();
    await expectRowsOrEmpty(ticker, '[data-hub-trade]', 'U-Exchange ticker');
    expect(
      await ex.locator('[data-hub-trade-sim]').count(),
      'the simulated ticker rows were deleted in REV-40 and must not return',
    ).toBe(0);

    // Two orderings, both facts about the catalogue. "Trending" ranked packs on
    // a seeded PRNG draw, so REV-40 removed the tab rather than re-labelling it;
    // the row opens on 'newest'.
    const sortTabs = ex.locator('.qw-hub-tabs[role="tablist"] [role="tab"]');
    await expect(sortTabs, 'the PRNG "trending" ordering must not return').toHaveCount(2);
    await expect(sortTabs.first()).toHaveAttribute('aria-selected', 'true');

    // The 24h market bar: still exactly four stat tiles, and its source is now
    // named. REV-40 plus its follow-up give it four truthful words -- 'ledger'
    // (it read the purchase ledger), 'empty' (it read it and there were no
    // trades in 24h), 'unreadable' (no readable source from here: no session, or
    // hub_market_pulse absent/refused) and the transient 'loading'. 'sim' is not
    // a value this component can emit any more. Signed out, which is how this
    // suite runs, the honest settling state is 'unreadable'.
    const market = ex.locator('[data-hub-market]');
    await expect(market).toBeVisible();
    expect(await market.locator('[data-market-stat]').count()).toBe(4);
    await expect(async () => {
      await expect(market, 'the 24h market bar never left the loading state').toHaveAttribute(
        'data-hub-market-source',
        /^(ledger|empty|unreadable)$/,
      );
    }).toPass({ timeout: 15_000 });
    const source = await market.getAttribute('data-hub-market-source');
    expect(source, 'the simulated market source was deleted in REV-40').not.toBe('sim');
    // The word and the flag are one fact said twice, so they may not disagree,
    // and only one flag may be lit. 'ledger' is the word for the flagless state.
    expect(
      await declaredState(market),
      `the market bar says source="${source}" while its state flags say something else`,
    ).toBe(source === 'ledger' ? 'data' : source);

    // And the tiles have to agree with the word too: 'unreadable' means nothing
    // was read, so the figures stay em dashes; 'empty' and 'ledger' both mean
    // the ledger answered, so they are real numbers -- a genuine 0 included.
    const figures = await market.locator('[data-market-stat]:not([data-market-stat="topTheme"]) strong').allInnerTexts();
    console.log(`[rev36] market source -- ${source}, tiles ${JSON.stringify(figures.map((f) => f.trim()))}`);
    expect(figures.length, 'the three numeric market tiles').toBe(3);
    for (const raw of figures) {
      const fig = raw.trim();
      if (source === 'unreadable') {
        expect(fig, 'an unreadable market bar printed a figure it never read').toBe('—');
      } else {
        expect(fig, `a "${source}" market bar printed "—" instead of the figure it says it read`).toMatch(/\d/);
      }
    }

    // The demand sparkline and the momentum chip were drawn from a seeded PRNG
    // with no demand signal behind them. The element tree is deleted.
    expect(await ex.locator('svg[data-pack-demand]').count()).toBe(0);
    expect(await ex.locator('[data-pack-momentum]').count()).toBe(0);
  });
});
