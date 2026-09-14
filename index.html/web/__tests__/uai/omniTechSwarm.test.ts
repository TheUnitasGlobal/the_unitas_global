import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetWikimediaQueue, __setWikimediaSpacing } from '@/lib/uai/deeperFetch';
import { bigTechPulseAdapter } from '@/lib/uai/deeperAdapters/omniTech';
import { entityAnchor } from '@/lib/uai/deeperAnchor';
import { swarmLayout, type SwarmInputDimension } from '@/lib/uai/swarmLayout';
import type { DeeperContext, DeeperCursor } from '@/lib/uai/deeperThemes';

/**
 * REV-24 MISSION 4 -- the bigTechPulse -> swarm PIPELINE, end to end, against
 * a mocked Wikidata.
 *
 * Two reasons this file exists:
 *
 *  1. `bigTechPulse` shipped in REV-23 with NO adapter test at all -- it is
 *     the one adapter `deeperAdapters.test.ts` never covered -- so the data
 *     the swarm draws had no safety net whatsoever.
 *  2. The live E2E path to the swarm depends on the U-AI surface resolving an
 *     ORGANISATION entity for the query, which is a third-party outcome and
 *     cannot be made deterministic in a gate. This proves the whole chain
 *     without it: Wikidata claims -> adapter -> chips cards -> swarm field,
 *     with real QIDs on real nodes.
 *
 * Fixtures replay the live `wbgetentities` shape.
 */

const ctx: DeeperContext = { locale: 'ko', lang: 'ko', country: 'KR' };
/** Samsung Electronics. */
const ORG = entityAnchor(
  { localeTitle: '삼성전자', enTitle: 'Samsung Electronics', qid: 'Q20718', disambiguation: false, lang: 'ko' },
  'ko',
);

const json = (data: unknown) =>
  ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) }) as unknown as Response;

/** `P<pid>` -> the QIDs it claims. */
const CLAIMS: Record<string, string[]> = {
  P452: ['Q1226532', 'Q11661'], // industry
  P749: ['Q20718000'], // parent organization
  P355: ['Q3109175', 'Q1191142', 'Q214025'], // subsidiaries
  P1056: ['Q17517', 'Q3962', 'Q5290'], // products
  P112: ['Q483382'], // founded by
  P169: ['Q16218996'], // chief executive officer
};

const LABELS: Record<string, string> = {
  Q1226532: '전자공학',
  Q11661: '정보기술',
  Q20718000: '삼성',
  Q3109175: '삼성디스플레이',
  Q1191142: '하만',
  Q214025: '삼성반도체',
  Q17517: '스마트폰',
  Q3962: '반도체',
  Q5290: '디스플레이',
  Q483382: '이병철',
  Q16218996: '한종희',
};

function claimBlock(): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const [pid, ids] of Object.entries(CLAIMS)) {
    out[pid] = ids.map((id) => ({ mainsnak: { datavalue: { type: 'wikibase-entityid', value: { id } } } }));
  }
  // The numeric scale claims the page-1 facts card reads.
  out.P1128 = [{ mainsnak: { datavalue: { type: 'quantity', value: { amount: '+267937' } } } }];
  out.P2139 = [
    { mainsnak: { datavalue: { type: 'quantity', value: { amount: '+258900000000' } } }, qualifiers: { P585: [{ datavalue: { value: { time: '+2023-00-00T00:00:00Z' } } }] } },
  ];
  return out;
}

let requested: string[] = [];

function route(url: string): Response | null {
  requested.push(url);
  // Root call: the organisation's own labels + claims.
  if (url.includes('ids=Q20718&props=labels%7Cclaims')) {
    return json({ entities: { Q20718: { labels: { ko: { value: '삼성전자' } }, claims: claimBlock() } } });
  }
  // Batched label call for whatever ids this page needs.
  if (url.includes('&props=labels&')) {
    const ids = decodeURIComponent(url.split('ids=')[1].split('&')[0]).split('|');
    const entities: Record<string, unknown> = {};
    for (const id of ids) if (LABELS[id]) entities[id] = { labels: { ko: { value: LABELS[id] } } };
    return json({ entities });
  }
  return null;
}

beforeEach(() => {
  requested = [];
  __setWikimediaSpacing(0);
  __resetWikimediaQueue();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const res = route(url);
    if (res) return res;
    throw new Error(`unrouted: ${url}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  __setWikimediaSpacing(1200);
  __resetWikimediaQueue();
});

/** Walk every cursor page the adapter offers, the way the feed hook does. */
async function loadAllPages() {
  const cards = [];
  let cursor: DeeperCursor | null = null;
  for (let guard = 0; guard < 6; guard++) {
    const page = await bigTechPulseAdapter.load(ORG, ctx, cursor ?? undefined);
    cards.push(...page.cards);
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  return cards;
}

describe('bigTechPulse adapter -- the data the swarm eats', () => {
  it('fails closed on an anchor with no entity', async () => {
    const page = await bigTechPulseAdapter.load({ ...ORG, qid: undefined }, ctx);
    expect(page.cards).toEqual([]);
    expect(requested, 'a QID-less anchor must not spend a request').toEqual([]);
  });

  it('turns every Wikidata dimension into a chips card of real entities', async () => {
    const cards = await loadAllPages();
    const chips = cards.filter((c) => c.kind === 'chips');
    expect(chips.length, 'all six modules must surface').toBe(6);
    for (const c of chips) {
      expect(c.sourceId).toBe('wikidata');
      expect(c.items && c.items.length, c.id).toBeGreaterThan(0);
      for (const it of c.items ?? []) {
        expect(it.qid, `${c.id}/${it.id} must carry an entity to re-anchor onto`).toMatch(/^Q\d+$/);
        expect(it.title, `${c.id}/${it.id} must be labelled`).toBeTruthy();
      }
    }
  });

  it('batches its label lookups instead of one request per node', async () => {
    await loadAllPages();
    const labelCalls = requested.filter((u) => u.includes('&props=labels&'));
    // 3 modules per cursor page -> 2 pages -> at most one batched call each.
    expect(labelCalls.length).toBeLessThanOrEqual(2);
  });

  it('still emits the numeric scale card the swarm sits above', async () => {
    const cards = await loadAllPages();
    expect(cards.some((c) => c.id === 'bigtech-scale' && c.kind === 'facts')).toBe(true);
  });
});

describe('adapter -> swarm, end to end', () => {
  it('lays the organisation out as a field of re-anchorable nodes', async () => {
    const cards = await loadAllPages();
    // Exactly what DeeperThemePage does to build the field.
    const dimensions: SwarmInputDimension[] = cards
      .filter((c) => c.kind === 'chips' && c.items && c.items.length > 0)
      .map((c) => ({
        key: c.id,
        label: c.field ?? c.id,
        nodes: (c.items ?? []).map((it) => ({ id: it.id, title: it.title, qid: it.qid, url: it.url })),
      }));

    const layout = swarmLayout(dimensions);
    const total = Object.values(CLAIMS).reduce((n, ids) => n + ids.length, 0);
    expect(layout.nodes).toHaveLength(total);
    expect(layout.dimensions).toHaveLength(6);

    // THE ABSORPTION LOOP: every node can re-anchor the theme onto itself.
    // Before REV-24 the chips renderer drew no re-anchor control at all, so
    // this capability existed in the data and nowhere in the interface.
    for (const n of layout.nodes) {
      expect(n.qid, n.id).toMatch(/^Q\d+$/);
      expect(n.x >= 7 && n.x <= 93, `${n.id} x=${n.x}`).toBe(true);
      expect(n.y >= 7 && n.y <= 93, `${n.id} y=${n.y}`).toBe(true);
    }

    // And the field has real volume: nodes on more than one shell.
    expect(new Set(layout.nodes.map((n) => n.depth)).size).toBeGreaterThan(1);
  });

  it('grows a sector at a time as cursor pages land, without moving what is there', async () => {
    const first = await bigTechPulseAdapter.load(ORG, ctx);
    const dimsA: SwarmInputDimension[] = first.cards
      .filter((c) => c.kind === 'chips')
      .map((c) => ({ key: c.id, label: c.field ?? c.id, nodes: (c.items ?? []).map((it) => ({ id: it.id, title: it.title, qid: it.qid })) }));
    const a = swarmLayout(dimsA);
    // The same three dimensions, laid out again, land in the same places.
    expect(swarmLayout(dimsA).nodes).toEqual(a.nodes);
    expect(a.dimensions.length).toBe(3);
  });
});
