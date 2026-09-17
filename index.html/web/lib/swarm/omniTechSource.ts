/**
 * REV-32 M1 (founder directive 2026-09-15) -- the omni-tech absorption source,
 * lifted out of the deleted lens framework and given its own module.
 *
 * The decomposition below is the REV-23 original, unchanged: same two
 * `wbgetentities` calls, same six Wikidata properties, same caps, same
 * newest-first ranking, same scale facts on the first page only. What changed
 * is everything ABOVE it -- it no longer implements a lens registry's adapter
 * interface, and it is no longer reachable only through a theme tile.
 *
 * REV-23 M6 -- the omni-tech absorption adapter (founder directive
 * 2026-09-13, MISSION 6 / Codex ch.7).
 *
 * "구글, MS, 글로벌 금융망 등 모든 빅테크를 모듈식으로 집어삼키는" -- taken
 * literally, at the level where it is actually possible for free: an
 * organisation is decomposed into the modules Wikidata already holds about
 * it, and each module is a chip the visitor can re-anchor on. Ask about
 * Microsoft and you get its industries, its parent and its 59 subsidiaries,
 * its products, who founded it, who runs it, how many people it employs and
 * what it earns -- and every one of those is itself an entity you can walk
 * into. That is the modular absorption, and it works identically for a
 * bank, a ministry, a university or a football club.
 *
 * SOURCE. Wikidata only: two `wbgetentities` calls (the anchor's claims,
 * then one batched label lookup for the ids they reference). Keyless, CORS
 * `*`, CC0, already an approved browser-side source in the registry. It
 * deliberately does NOT use the Query Service -- measured 2026-09-13, WDQS
 * was rate-limiting to one request per minute during an outage (see
 * lib/live/awardsThemes.ts).
 *
 * NOT GitHub. A code-footprint theme was the obvious companion, but the
 * source registry already records a prior engineering decision against the
 * GitHub search API ("homonym noise, 10 req/min -- outbound only"), and that
 * decision has not stopped being true. GitHub stays where it is: an outbound
 * destination on the brand row, not a data leg.
 */
import { compactNumber, deeperFetchJson, wikidataUrl } from '@/lib/uai/deeperFetch';
import { EMPTY_SWARM_PAGE, type SwarmCard, type SwarmContext, type SwarmItem, type SwarmPage, type SwarmSource } from './swarmTypes';

interface Snak {
  datavalue?: { type?: string; value?: unknown };
}
interface Claim {
  mainsnak?: Snak;
  rank?: string;
  qualifiers?: Record<string, Array<{ datavalue?: { value?: { time?: string } } }>>;
}
interface Entity {
  labels?: Record<string, { value?: string }>;
  claims?: Record<string, Claim[]>;
}
interface EntitiesResponse {
  entities?: Record<string, Entity>;
}

function entitiesUrl(ids: readonly string[], props: string, languages: string): string {
  return (
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.map(encodeURIComponent).join('|')}` +
    `&props=${props}&languages=${languages}&format=json&origin=*`
  );
}

function itemId(claim: Claim | undefined): string | undefined {
  const dv = claim?.mainsnak?.datavalue;
  if (dv?.type !== 'wikibase-entityid') return undefined;
  const v = dv.value as { id?: string } | undefined;
  return v?.id && /^Q\d+$/.test(v.id) ? v.id : undefined;
}

function quantity(claim: Claim | undefined): number | undefined {
  const dv = claim?.mainsnak?.datavalue;
  if (dv?.type !== 'quantity') return undefined;
  const amount = Number((dv.value as { amount?: string } | undefined)?.amount ?? Number.NaN);
  return Number.isFinite(amount) ? amount : undefined;
}

/** The `point in time` qualifier, as a year -- so "221,000 employees" says WHEN. */
function claimYear(claim: Claim | undefined): string | undefined {
  const m = /^[+-]?(\d{4})/.exec(claim?.qualifiers?.P585?.[0]?.datavalue?.value?.time ?? '');
  return m ? m[1] : undefined;
}

/** Most recent first when the statements are dated, best-ranked otherwise. */
function newestFirst(claims: Claim[]): Claim[] {
  return claims
    .slice()
    .sort((a, b) => (claimYear(b) ?? '0000').localeCompare(claimYear(a) ?? '0000'));
}

/**
 * The modules, in the order the card renders them. Each is one Wikidata
 * property; `f1..f6` are the dimension labels (see `Rev32.swarm.fields`
 * in messages/*.json).
 */
const MODULES: ReadonlyArray<{ pid: string; field: string; max: number }> = [
  { pid: 'P452', field: 'f1', max: 6 }, // industry
  { pid: 'P749', field: 'f2', max: 3 }, // parent organization
  { pid: 'P355', field: 'f3', max: 10 }, // subsidiary
  { pid: 'P1056', field: 'f4', max: 10 }, // product or material produced
  { pid: 'P112', field: 'f5', max: 6 }, // founded by
  { pid: 'P169', field: 'f6', max: 3 }, // chief executive officer
];

/** How many modules one page renders before the cursor moves on. */
const MODULES_PER_PAGE = 3;

export const omniTechSource: SwarmSource = {
  key: 'omniTech',
  async load(anchor, ctx: SwarmContext, cursor): Promise<SwarmPage> {
    if (!anchor.qid) return EMPTY_SWARM_PAGE();
    const offset = typeof cursor?.offset === 'number' ? cursor.offset : 0;
    if (offset >= MODULES.length) return { cards: [], cursor: null, fetchedAt: Date.now(), sources: ['wikidata'] };

    const root = await deeperFetchJson<EntitiesResponse>(
      entitiesUrl([anchor.qid], 'labels%7Cclaims', `${ctx.lang}%7Cen`),
      { signal: ctx.signal },
    );
    const entity = root?.entities?.[anchor.qid];
    if (!entity) return EMPTY_SWARM_PAGE(['wikidata']);
    const claims = entity.claims ?? {};

    const slice = MODULES.slice(offset, offset + MODULES_PER_PAGE);
    // One batched label call for every id this page will show.
    const ids: string[] = [];
    for (const mod of slice) {
      for (const claim of (claims[mod.pid] ?? []).slice(0, mod.max)) {
        const id = itemId(claim);
        if (id) ids.push(id);
      }
    }
    const labels = new Map<string, string>();
    const unique = Array.from(new Set(ids)).slice(0, 50);
    if (unique.length > 0) {
      const json = await deeperFetchJson<EntitiesResponse>(entitiesUrl(unique, 'labels', `${ctx.lang}%7Cen`), {
        signal: ctx.signal,
      });
      for (const id of unique) {
        const e = json?.entities?.[id];
        const l = e?.labels?.[ctx.lang]?.value ?? e?.labels?.en?.value;
        if (l) labels.set(id, l);
      }
    }

    const cards: SwarmCard[] = [];
    for (const mod of slice) {
      const items: SwarmItem[] = [];
      for (const claim of (claims[mod.pid] ?? []).slice(0, mod.max)) {
        const id = itemId(claim);
        const title = id ? labels.get(id) : undefined;
        if (!id || !title) continue;
        items.push({
          id: `${mod.pid}-${id}`,
          title,
          // Every module entry is itself an entity: tapping it re-anchors
          // the whole block on it, which is the "modular absorption" loop.
          qid: id,
          url: wikidataUrl(id),
          sourceId: 'wikidata',
        });
      }
      if (items.length === 0) continue;
      cards.push({
        id: `bigtech-${mod.pid}`,
        kind: 'chips',
        field: mod.field,
        items,
        sourceId: 'wikidata',
        sourceUrl: wikidataUrl(anchor.qid),
      });
    }

    // The scale facts ride the FIRST page only -- they are the header of the
    // whole block, not one module among the others.
    if (offset === 0) {
      const employees = newestFirst(claims.P1128 ?? [])[0];
      const revenue = newestFirst(claims.P2139 ?? [])[0];
      const employeeCount = quantity(employees);
      const revenueAmount = quantity(revenue);
      const facts = [
        ...(employeeCount !== undefined
          ? [
              {
                label: 'scaleEmployees',
                value: compactNumber(employeeCount),
                unit: claimYear(employees),
                emphasis: true,
              },
            ]
          : []),
        ...(revenueAmount !== undefined
          ? [{ label: 'scaleRevenue', value: compactNumber(revenueAmount), unit: claimYear(revenue) }]
          : []),
      ];
      if (facts.length > 0) {
        cards.unshift({
          id: 'bigtech-scale',
          kind: 'facts',
          facts,
          sourceId: 'wikidata',
          sourceUrl: wikidataUrl(anchor.qid),
        });
      }
    }

    const nextOffset = offset + MODULES_PER_PAGE;
    return {
      cards,
      cursor: nextOffset < MODULES.length ? { offset: nextOffset } : null,
      fetchedAt: Date.now(),
      sources: ['wikidata'],
      empty: cards.length === 0,
    };
  },
};
