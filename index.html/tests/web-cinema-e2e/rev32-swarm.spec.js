// REV-32 acceptance measurements (founder directive 2026-09-15).
//
// The omni-tech swarm was reachable by exactly one path before REV-31 -- a
// `bigTechPulse` lens tile inside the "더 깊이 탐색" block -- and by NO path
// after it. What is measured here is the opposite property: that the field is
// now reachable from three independent places, and that each entrance renders
// its own shell without depending on a third-party answer arriving.
//
// The DIVISION OF LABOUR matters. Everything a deterministic build can prove
// is asserted unconditionally: the route exists, the hub carries a sixth tab,
// the panel announces its own state, the portal's contract holds. Only the
// drawn FIELD depends on live Wikidata, and that part says so out loud rather
// than failing the suite when Wikimedia is slow -- the decomposition itself is
// proven against a mocked Wikidata in web/__tests__/uai/omniTechSwarm.test.ts.
const { test, expect } = require('@playwright/test');
const { SOVEREIGN_AUTH_TOKEN: TOKEN } = require('./_sovereignToken');
const { collapseSovereignPanel, walkCurtain, settleSurface } = require('./_rev25Home');

const FOUNDER_URL = `/?sovereign_auth=${TOKEN}&splash=0&dev=skip`;

async function founderHome(page) {
  await collapseSovereignPanel(page);
  await page.goto(FOUNDER_URL, { waitUntil: 'domcontentloaded' });
  await walkCurtain(page);
  await settleSurface(page);
}

/** The route, entered with the founder session already proven on this origin. */
async function founderRoute(page, path) {
  await founderHome(page);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await walkCurtain(page).catch(() => {});
  await settleSurface(page).catch(() => {});
}

test.describe('REV-32 M1 -- the swarm has its own address', () => {
  test('the independent route renders its own shell, with no subject and no lens framework', async ({ page }) => {
    await founderRoute(page, '/ko/omni-swarm?splash=0');

    const shell = page.locator('[data-omni-swarm-page="page"]');
    await expect(shell).toBeVisible();
    await expect(shell.locator('[data-swarm-search]')).toBeVisible();
    await expect(shell.locator('[data-swarm-search-submit]')).toBeVisible();

    // No subject yet: the panel says so instead of drawing an empty field.
    const panel = page.locator('[data-omni-swarm-panel]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-swarm-state', 'empty');
    await expect(panel.locator('[data-swarm-note="no-entity"]')).toBeVisible();

    // REV-31 deleted the lens framework; the swarm must not have dragged it back.
    expect(await page.locator('[data-explore-deeper]').count(), 'the Explore Deeper block').toBe(0);
    expect(await page.locator('[data-deeper-theme]').count(), 'a lens tile').toBe(0);
  });

  test('a ?qid= deep link pins the subject without a resolver round trip', async ({ page }) => {
    // Q2283 = Microsoft. Whether Wikidata answers in this run is its business;
    // what must hold is that the page accepted the identifier and asked.
    await founderRoute(page, '/ko/omni-swarm?qid=Q2283&q=Microsoft&splash=0');
    const panel = page.locator('[data-omni-swarm-panel]');
    await expect(panel).toBeVisible();
    // The contract is that the identifier was ACCEPTED and the subject pinned.
    // Whether Wikidata answers for it in this run is Wikidata's business, and
    // is measured by the live test at the bottom of this file.
    await expect(panel.locator('[data-swarm-crumb-current]')).toHaveText(/Microsoft/i);
    await expect(panel.locator('[data-swarm-note="no-entity"]')).toHaveCount(0);
  });

  test('a malformed ?qid= is refused rather than trusted', async ({ page }) => {
    await founderRoute(page, '/ko/omni-swarm?qid=not-a-qid&splash=0');
    const panel = page.locator('[data-omni-swarm-panel]');
    await expect(panel).toHaveAttribute('data-swarm-state', 'empty');
    await expect(panel.locator('[data-swarm-note="no-entity"]')).toBeVisible();
  });
});

test.describe('REV-32 M2 -- the entrances', () => {
  test('the UNITAS master hub carries the swarm as a sixth surface', async ({ page }) => {
    await founderHome(page);
    await page.locator('[data-unitas-hub-toggle]').click();
    const hub = page.locator('[role="dialog"] [data-unitas-hub]');
    await expect(hub).toBeVisible();

    const tab = hub.locator('[data-hub-tab-btn="swarm"]');
    await expect(tab, 'the swarm tab').toBeVisible();
    // Five surfaces became six, and the swarm is the new one.
    expect(await hub.locator('[data-hub-tab-btn]').count()).toBe(6);

    await tab.click();
    await expect(hub.locator('[data-hub-panel="swarm"]')).toBeVisible();
    const surface = hub.locator('[data-omni-swarm-page="hub"]');
    await expect(surface).toBeVisible();
    await expect(surface.locator('[data-swarm-search]')).toBeVisible();
    await expect(page.locator('[data-omni-swarm-panel]')).toBeVisible();
  });

  test('the U-AI result carries the swarm door, and the door costs nothing until it is opened', async ({ page }) => {
    await founderHome(page);
    const bar = page.locator('#omni-synapse-search input[type="text"]').first();
    await bar.click();
    await bar.fill('Microsoft');
    await bar.press('Enter');

    // The stream card for the swarm rides page 1 of every result.
    const card = page.locator('[data-stream-card="swarm"]').first();
    await expect.poll(async () => card.count(), { timeout: 40_000 }).toBeGreaterThan(0);

    // The door is UNCONDITIONAL: an identifier decides which of its two
    // mechanisms is drawn (open in place vs. hand the query to the route),
    // never whether there is a door at all.
    const portal = card.locator('[data-omni-swarm-portal]');
    await expect(portal).toBeVisible();
    const subject = await portal.getAttribute('data-swarm-subject');
    expect(subject, 'the door names either an entity or the query it carries').toMatch(/^(Q\d+|query)$/);

    // Closed, the door has drawn no field at all.
    expect(await page.locator('[data-omni-swarm-panel]').count(), 'the field before the door is opened').toBe(0);

    // It must not collide with the omni-open rows REV-31 put on the same page.
    const omni = page.locator('[data-omni-open]').first();
    if ((await omni.count()) > 0) {
      const boxes = await page.evaluate(() => {
        const p = document.querySelector('[data-omni-swarm-portal]');
        const o = document.querySelector('[data-omni-open]');
        if (!p || !o) return null;
        const a = p.getBoundingClientRect();
        const b = o.getBoundingClientRect();
        return { portalBottom: a.bottom, portalTop: a.top, omniBottom: b.bottom, omniTop: b.top };
      });
      if (boxes) {
        const overlaps = boxes.portalTop < boxes.omniBottom && boxes.omniTop < boxes.portalBottom;
        expect(overlaps, 'the swarm door must not overlap the omni-open rows').toBe(false);
      }
    }

    if (subject === 'query') {
      // The second door: it navigates to the route that owns a full resolver.
      const href = await portal.getAttribute('href');
      expect(href, 'the query door points at the standalone route').toContain('/omni-swarm');
      return;
    }

    await portal.click();
    const panel = page.locator('[data-omni-swarm-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-swarm-crumb-current]')).toBeVisible();
  });
});

test.describe('REV-32 -- the field itself, when Wikidata answers', () => {
  test('every node is a real focusable control and the field draws its web', async ({ page }) => {
    await founderRoute(page, '/ko/omni-swarm?qid=Q2283&q=Microsoft&splash=0');
    const panel = page.locator('[data-omni-swarm-panel]');
    await expect
      .poll(async () => panel.getAttribute('data-swarm-state'), { timeout: 45_000 })
      .not.toBe('loading');

    const state = await panel.getAttribute('data-swarm-state');
    if (state !== 'ready') {
      test.skip(true, `live Wikidata returned no modules for Q2283 in this run (state: ${state})`);
    }

    const nodes = page.locator('.qw-swarm-node');
    const n = await nodes.count();
    expect(n, 'a rendered swarm must have nodes').toBeGreaterThan(0);
    const first = nodes.first();
    expect(await first.evaluate((el) => el.tagName)).toBe('BUTTON');
    expect(await first.getAttribute('aria-label')).toBeTruthy();
    await first.focus();
    expect(await page.evaluate(() => document.activeElement?.className || '')).toContain('qw-swarm-node');
    // The field drew one edge per node -- the web, not a scatter.
    expect(await page.locator('.qw-swarm-edge').count()).toBe(n);

    // The absorption loop: activating a node walks into it and the trail
    // records where the visitor came from.
    const before = await panel.locator('[data-swarm-crumb-current]').textContent();
    await first.click();
    await expect
      .poll(async () => panel.locator('[data-swarm-crumb-current]').textContent(), { timeout: 30_000 })
      .not.toBe(before);
    await expect(panel.locator('[data-swarm-crumb="0"]'), 'the previous subject stays reachable').toBeVisible();
  });
});
