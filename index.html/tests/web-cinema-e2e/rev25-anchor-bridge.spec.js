// REV-25 MISSION 1 -- the ANCHOR BRIDGE, and the swarm it finally reaches
// (founder directive 2026-09-13).
//
// THE DEFECT. REV-24 built the omni-tech swarm and then could not reach it
// from the one surface it was built for: `bigTechPulse` is `needs: 'entity'`,
// the U-AI tower hands Explore Deeper
//   `surface.web.anchor ? entityAnchor(...) : textAnchor(surface.query, lang)`
// and `themesFor()` answers a text anchor with an EMPTY list. Measured on the
// deployed build: `data-anchor-kind="text"`, zero tiles, "아직 연결된 존재가
// 없습니다". rev24-verify.spec.js had to SKIP its live swarm case for exactly
// this reason. In a LOCAL production build the defect is not a probability but
// a constant: `NEXT_PUBLIC_UAI_WEB_SYNTHESIS` is unset, so `surface.web.anchor`
// is always undefined and the tower always falls to a text anchor.
//
// WHY THIS RUNS DETERMINISTICALLY. Whether an encyclopedia has a page for a
// given string is a third-party outcome, so the corpus is stubbed at the
// network boundary and everything else is the real shipped code: the real
// anchor, the real bridge, the real theme registry, the real Wikidata adapter,
// the real swarm layout and the real DOM. Nothing about the product is mocked;
// only the encyclopedia is.
const { test, expect } = require('@playwright/test');
const { reachReleasedHome } = require('./_rev25Home');

test.describe.configure({ timeout: 120_000 });

// The app registers a PWA service worker on first paint, and a worker-mediated
// fetch is NOT reachable from `page.route` -- measured here: a RegExp route
// over `en.wikipedia.org/w/api.php` never fired while `page.on('request')`
// reported the very same URL. Blocking workers for this file puts the
// encyclopedia back inside the test's control; nothing else in the chain
// depends on one.
test.use({ serviceWorkers: 'block' });

/** The organisation the stubbed encyclopedia knows about. */
const ORG_QID = 'Q20718';
/** `P<pid>` -> the QIDs it claims, exactly as `bigTechPulse` reads them. */
const CLAIMS = {
  P452: ['Q1226532', 'Q11661'],
  P749: ['Q20718000'],
  P355: ['Q3109175', 'Q1191142', 'Q214025'],
  P1056: ['Q17517', 'Q3962', 'Q5290'],
  P112: ['Q483382'],
  P169: ['Q16218996'],
};
const LABELS = {
  Q1226532: 'Electronics',
  Q11661: 'Information technology',
  Q20718000: 'Samsung',
  Q3109175: 'Samsung Display',
  Q1191142: 'Harman',
  Q214025: 'Samsung Semiconductor',
  Q17517: 'Smartphone',
  Q3962: 'Semiconductor',
  Q5290: 'Display',
  Q483382: 'Lee Byung-chul',
  Q16218996: 'Han Jong-hee',
};
const NODE_TOTAL = Object.values(CLAIMS).reduce((n, ids) => n + ids.length, 0);

function claimBlock() {
  const out = {};
  for (const [pid, ids] of Object.entries(CLAIMS)) {
    out[pid] = ids.map((id) => ({ mainsnak: { datavalue: { type: 'wikibase-entityid', value: { id } } } }));
  }
  out.P1128 = [{ mainsnak: { datavalue: { type: 'quantity', value: { amount: '+267937' } } } }];
  return out;
}

const json = (route, body) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });

/**
 * Stub the encyclopedia. `wikiHasPage: false` reproduces the REV-24 world -- a
 * corpus with nothing for this subject -- so one spec can assert both sides.
 *
 * A RegExp, not a glob and not a predicate: measured on Playwright 1.62.1, the
 * config sets a `baseURL`, so a glob pattern is resolved against it and
 * silently matches no cross-origin call at all -- the real encyclopedia
 * answered and the run was not deterministic.
 */
async function stubCorpus(page, { wikiHasPage = true, counters } = {}) {
  await page.route(/^https:\/\/[a-z-]+\.wikipedia\.org\/w\/api\.php/, async (route) => {
    const url = route.request().url();
    if (!url.includes('generator=search')) return route.continue();
    const term = decodeURIComponent((/gsrsearch=([^&]*)/.exec(url) || [, ''])[1]).replace(/\+/g, ' ');
    if (counters) {
      counters.entitySearch += 1;
      counters.terms.push(term);
    }
    if (!wikiHasPage) return json(route, { query: { pages: [] } });
    return json(route, {
      query: {
        pages: [
          {
            title: term,
            index: 1,
            pageprops: { wikibase_item: ORG_QID },
            langlinks: [{ lang: 'en', title: 'Samsung Electronics' }],
          },
        ],
      },
    });
  });

  await page.route(/^https:\/\/(?:www\.)?wikidata\.org\/w\/api\.php/, async (route) => {
    const url = route.request().url();
    if (!url.includes('action=wbgetentities')) return json(route, { entities: {} });
    const ids = decodeURIComponent((/[?&]ids=([^&]*)/.exec(url) || [, ''])[1]).split('|');
    if (url.includes('props=labels%7Cclaims') || url.includes('props=labels|claims')) {
      if (counters) counters.claims += 1;
      // Echo whichever entity was asked for, so the absorption loop keeps
      // working after a node re-anchors the lens onto itself.
      const subject = ids[0] || ORG_QID;
      return json(route, { entities: { [subject]: { labels: { en: { value: LABELS[subject] || 'Samsung Electronics' } }, claims: claimBlock() } } });
    }
    const entities = {};
    for (const id of ids) if (LABELS[id]) entities[id] = { labels: { en: { value: LABELS[id] } } };
    return json(route, { entities });
  });
}

/**
 * Ask the tower a question and reach its Explore Deeper block.
 *
 * The block lives on STREAM PAGE 1 -- page 0 is the surface report and its
 * recipe is `['sources']` (`streamRecipe`, lib/uai/stream/streamTypes.ts), and
 * page 1 is where "다른 곳에서 탐색" opens. Page 1 arrives on its own through
 * the feed's IntersectionObserver; `[data-stream-more]` is the keyboard path
 * and the one this walk drives, because a headless feed may never scroll.
 */
async function openTowerDeeper(page, query = 'Samsung Electronics') {
  const input = page.locator('#omni-synapse-search input[type="text"]').first();
  await input.click();
  await input.fill(query);
  await input.press('Enter');
  const root = page.locator('[data-stream-root]').first();
  await expect(root, 'the tower must open').toBeVisible({ timeout: 40_000 });

  const block = page.locator('[data-explore-deeper][data-host="tower"]').first();
  for (let i = 0; i < 25; i++) {
    if ((await block.count()) > 0) break;
    const more = page.locator('[data-stream-more]').first();
    if (await more.isVisible().catch(() => false)) {
      await more.click({ timeout: 5_000 }).catch(() => {});
    } else {
      await root.evaluate((el) => el.scrollTo({ top: el.scrollHeight })).catch(() => {});
    }
    await page.waitForTimeout(1000);
  }
  await expect(block, 'the tower must reach stream page 1, which carries Explore Deeper').toBeVisible({ timeout: 30_000 });
  return block;
}

/**
 * The tower mounts one Explore Deeper block PER PAGE, and each re-lays-out the
 * moment its own bridge lands. Clicking a tile before they have all settled
 * hits whatever slid under the pointer -- measured: the outbound row, then the
 * "+N more" chip, then the overlay.
 */
async function settleDeeper(page) {
  await expect
    .poll(async () => page.locator('[data-explore-deeper][data-anchor-bridging]').count(), { timeout: 30_000 })
    .toBe(0);
  await page.waitForTimeout(900);
}

test.describe('REV-25 M1 -- the anchor bridge, in the tower', () => {
  test('THE DEFECT: with nothing in the corpus the tower is still a text anchor with no lenses', async ({ page }) => {
    await stubCorpus(page, { wikiHasPage: false });
    await reachReleasedHome(page);
    const block = await openTowerDeeper(page);
    await settleDeeper(page);
    expect(await block.getAttribute('data-anchor-kind')).toBe('text');
    expect(await block.getAttribute('data-anchor-bridged')).toBeNull();
    expect(await block.locator('[data-deeper-theme]').count(), 'a text anchor feeds no lens').toBe(0);
    await expect(block.locator('[data-deeper-noanchor]')).toBeVisible();
  });

  test('THE BRIDGE: the same tower becomes an ENTITY anchor and offers the swarm', async ({ page }) => {
    await stubCorpus(page);
    await reachReleasedHome(page);
    const block = await openTowerDeeper(page);
    await expect(block).toHaveAttribute('data-anchor-bridged', '', { timeout: 30_000 });
    expect(await block.getAttribute('data-anchor-kind'), 'the anchor must carry an identity now').toBe('entity');
    expect(await block.locator('[data-deeper-theme]').count()).toBeGreaterThan(0);
    await expect(block.locator('[data-deeper-theme="bigTechPulse"]')).toHaveCount(1);
    await expect(block.locator('[data-deeper-noanchor]')).toHaveCount(0);
  });

  test('THE SWARM: the bridged anchor opens a field of real, re-anchorable nodes', async ({ page }) => {
    await stubCorpus(page);
    await reachReleasedHome(page);
    const block = await openTowerDeeper(page);
    await expect(block).toHaveAttribute('data-anchor-bridged', '', { timeout: 30_000 });
    await settleDeeper(page);
    await block.locator('[data-deeper-theme="bigTechPulse"]').click();

    const swarm = page.locator('[data-omni-swarm]');
    await expect(swarm).toBeVisible({ timeout: 30_000 });
    // The lens ran on the BRIDGED identity, not on the typed string: this is
    // the whole mission in one attribute.
    expect(await page.locator('[data-deeper-page="bigTechPulse"]').first().getAttribute('data-deeper-anchor')).toBe(ORG_QID);

    const nodes = page.locator('.qw-swarm-node');
    // bigTechPulse pages three Wikidata modules at a time, so the field grows
    // as the sentinel pulls the second cursor page: the first page is six
    // nodes, the complete organisation is fifteen.
    await expect.poll(async () => nodes.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(6);
    const n = await nodes.count();
    expect(n).toBeLessThanOrEqual(NODE_TOTAL);
    expect(Number(await swarm.getAttribute('data-swarm-nodes'))).toBe(n);
    // The field drew its web: one edge per node, back to the burning core.
    expect(await page.locator('.qw-swarm-edge').count()).toBe(n);
    await expect(page.locator('[data-omni-swarm] .qw-swarm-core')).toHaveCount(1);

    // Real buttons -- focusable inside the Modal's Tab trap, and labelled.
    const first = nodes.first();
    expect(await first.evaluate((el) => el.tagName)).toBe('BUTTON');
    expect(await first.getAttribute('aria-label')).toBeTruthy();
    await first.focus();
    expect(await page.evaluate(() => document.activeElement?.className || '')).toContain('qw-swarm-node');

    // Every node sits inside the field, on one of the depth shells.
    const geometry = await page.evaluate(() => {
      const field = document.querySelector('[data-omni-swarm]').getBoundingClientRect();
      const shells = new Set();
      let outside = 0;
      document.querySelectorAll('.qw-swarm-node').forEach((el) => {
        shells.add(el.style.getPropertyValue('--d'));
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        if (cx < field.left - 1 || cx > field.right + 1 || cy < field.top - 1 || cy > field.bottom + 1) outside += 1;
      });
      return { shells: shells.size, outside };
    });
    expect(geometry.outside, 'no node may fall outside its own field').toBe(0);
    expect(geometry.shells, 'the field must have volume, not be a disc').toBeGreaterThan(1);
  });

  test('THE ABSORPTION LOOP: activating a node re-anchors the whole lens onto it', async ({ page }) => {
    await stubCorpus(page);
    await reachReleasedHome(page);
    const block = await openTowerDeeper(page);
    await expect(block).toHaveAttribute('data-anchor-bridged', '', { timeout: 30_000 });
    await settleDeeper(page);
    await block.locator('[data-deeper-theme="bigTechPulse"]').click();
    await expect(page.locator('[data-omni-swarm]')).toBeVisible({ timeout: 30_000 });

    const lens = page.locator('[data-deeper-page="bigTechPulse"]').first();
    expect(await lens.getAttribute('data-deeper-anchor')).toBe(ORG_QID);

    const target = page.locator('.qw-swarm-node[data-swarm-absorb="1"]').first();
    const nodeLabel = (await target.innerText()).trim();
    await target.click();

    await expect.poll(async () => lens.getAttribute('data-deeper-anchor'), { timeout: 30_000 }).not.toBe(ORG_QID);
    const absorbed = await lens.getAttribute('data-deeper-anchor');
    expect(absorbed, `"${nodeLabel}" must be absorbed as an entity`).toMatch(/^Q\d+$/);
    expect(Object.values(CLAIMS).flat(), 'the new anchor must be one of the nodes').toContain(absorbed);
    // And the field re-forms around its new core rather than collapsing.
    await expect(page.locator('[data-omni-swarm]')).toBeVisible({ timeout: 30_000 });
  });

  test('한계비용 0원: the identity is resolved ONCE, however many blocks ask', async ({ page }) => {
    const counters = { entitySearch: 0, claims: 0, terms: [] };
    await stubCorpus(page, { counters });
    await reachReleasedHome(page);
    const block = await openTowerDeeper(page);
    await expect(block).toHaveAttribute('data-anchor-bridged', '', { timeout: 30_000 });
    await settleDeeper(page);
    const afterFirst = counters.entitySearch;
    // The honest claim is not "one request" -- a result can carry more than one
    // Explore Deeper block on more than one subject. It is ONE REQUEST PER
    // SUBJECT, never a repeat, however many blocks the tower mounts.
    expect(afterFirst, 'the bridge must actually consult the corpus').toBeGreaterThan(0);
    expect(new Set(counters.terms).size, `each subject resolved once: ${counters.terms.join(' | ')}`).toBe(afterFirst);

    // RELOAD and come back: this proves the DURABLE tier, not just the module
    // Map -- a returning visitor pays nothing at all.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#omni-synapse-search', { state: 'visible', timeout: 45_000 });
    await page.waitForTimeout(800);
    const again = await openTowerDeeper(page);
    await expect(again).toHaveAttribute('data-anchor-bridged', '', { timeout: 30_000 });
    await settleDeeper(page);
    expect(counters.entitySearch, 'a second visit must cost nothing').toBe(afterFirst);
  });
});

test.describe('REV-25 M1 -- a deliberate sources-only host keeps its decision', () => {
  test('a UNITAS module name is NOT resolved to an unrelated encyclopedia entry (D-23)', async ({ page }) => {
    // REV-21 SPEC §12.2 D-23 put `unitasProfile` in sources-only mode on
    // purpose: "no entity behind a pseudonymous operator". Resolving the
    // module "Echo" to the Greek nymph would reopen the '공기 → Thai film'
    // drift REV-21 §2.2 closed, in a new place. The corpus below WOULD answer
    // -- that is the point: the block must refuse to ask.
    await stubCorpus(page);
    await reachReleasedHome(page);
    await page.locator('#omni-synapse-search input[type="text"]').first().click();
    await page.waitForTimeout(500);
    await page.locator('[data-slot="unitasRanking"]').first().click();
    await expect(page.locator('[data-slot-card="unitasRanking"]')).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => {
      const row = document.querySelector('[data-slot-card="unitasRanking"] .qw-hub-headline');
      if (row) row.click();
    });
    await expect(page.locator('#ranking-deep-title')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(3000);

    let checked = 0;
    for (const host of ['unitasProfile', 'rankingDeep']) {
      const block = page.locator(`[data-explore-deeper][data-host="${host}"]`).first();
      if ((await block.count()) === 0) continue;
      checked += 1;
      expect(await block.getAttribute('data-anchor-kind'), `${host} must stay sources-only`).toBe('text');
      expect(await block.getAttribute('data-anchor-bridged'), `${host} must not have been bridged`).toBeNull();
      expect(await block.locator('[data-deeper-theme]').count(), `${host} must offer no lens`).toBe(0);
    }
    expect(checked, 'at least one sources-only block must have been on screen').toBeGreaterThan(0);
  });
});
