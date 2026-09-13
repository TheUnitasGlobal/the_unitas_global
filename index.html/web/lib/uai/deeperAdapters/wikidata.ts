/**
 * Explore Deeper adapters on Wikidata (SPEC §3.3 #1 dataTwin, #2 causalHack,
 * #5 zeroPoint, #9 marketMoat). Every leg is keyed on the anchor's QID --
 * never a label search -- and every label the visitor reads comes back
 * already localized by Wikidata (`languages=<lang>|en`).
 */
import { qidOfUri, sparql, wikidataUrl, deeperFetchJson, compactNumber } from '../deeperFetch';
import { EMPTY_DEEPER_PAGE, type DeeperAdapter, type DeeperCard, type DeeperContext, type DeeperCursor, type DeeperItem, type DeeperPage } from '../deeperThemes';
import type { DeeperAnchor } from '../deeperAnchor';
import { EXCLUDED_CROSS_P31 } from '../entityResolve';

/* ------------------------------------------------------------------ */
/* Shared Wikidata shapes                                               */
/* ------------------------------------------------------------------ */

interface Snak {
  datatype?: string;
  datavalue?: { type?: string; value?: unknown };
}
interface Claim {
  mainsnak?: Snak;
  rank?: string;
}
interface Entity {
  labels?: Record<string, { value?: string }>;
  descriptions?: Record<string, { value?: string }>;
  aliases?: Record<string, Array<{ value?: string }>>;
  sitelinks?: Record<string, { title?: string }>;
  claims?: Record<string, Claim[]>;
}
interface EntitiesResponse {
  entities?: Record<string, Entity>;
}

function entitiesUrl(ids: readonly string[], props: string, languages: string, sitefilter?: string): string {
  return (
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.map(encodeURIComponent).join('|')}` +
    `&props=${props}&languages=${languages}${sitefilter ? `&sitefilter=${sitefilter}` : ''}&format=json&origin=*`
  );
}

function label(e: Entity | undefined, lang: string): string | undefined {
  return e?.labels?.[lang]?.value ?? e?.labels?.en?.value;
}

/** Labels for up to 50 ids in one call (properties and items alike). */
async function labelsFor(ids: string[], ctx: DeeperContext): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(ids)).slice(0, 50);
  if (unique.length === 0) return out;
  const json = await deeperFetchJson<EntitiesResponse>(entitiesUrl(unique, 'labels', `${ctx.lang}|en`), { signal: ctx.signal });
  for (const id of unique) {
    const l = label(json?.entities?.[id], ctx.lang);
    if (l) out.set(id, l);
  }
  return out;
}

/** Human-readable value of a claim: an item id (to be labelled), a quantity,
 *  a time, a string, a coordinate. */
function snakValue(snak: Snak | undefined): { text?: string; itemId?: string } {
  const dv = snak?.datavalue;
  if (!dv) return {};
  const v = dv.value as Record<string, unknown> | string | undefined;
  switch (dv.type) {
    case 'wikibase-entityid':
      return { itemId: typeof v === 'object' && v ? String((v as { id?: string }).id ?? '') : undefined };
    case 'quantity': {
      const amount = typeof v === 'object' && v ? String((v as { amount?: string }).amount ?? '') : '';
      const n = Number(amount);
      return { text: Number.isFinite(n) ? compactNumber(n) : amount };
    }
    case 'time': {
      const t = typeof v === 'object' && v ? String((v as { time?: string }).time ?? '') : '';
      const m = /^([+-]?\d{1,4})-(\d{2})-(\d{2})/.exec(t);
      if (!m) return { text: t };
      const year = m[1].replace(/^\+/, '');
      return { text: m[2] === '00' ? year : `${year}-${m[2]}${m[3] === '00' ? '' : `-${m[3]}`}` };
    }
    case 'globecoordinate': {
      const c = v as { latitude?: number; longitude?: number };
      return { text: `${c.latitude?.toFixed(3)}, ${c.longitude?.toFixed(3)}` };
    }
    case 'monolingualtext':
      return { text: String((v as { text?: string }).text ?? '') };
    case 'string':
      return { text: typeof v === 'string' ? v : '' };
    default:
      return {};
  }
}

/* ------------------------------------------------------------------ */
/* #1 dataTwin -- 삼라만상 데이터 트윈                                  */
/* ------------------------------------------------------------------ */

const TWIN_CHUNK = 6;
/** Identifier-type properties are listed, not explained. */
const ID_PROPS = new Set(['P31', 'P279', 'P17', 'P131', 'P361', 'P527', 'P18', 'P373', 'P625']);

export const dataTwinAdapter: DeeperAdapter = {
  key: 'dataTwin',
  async load(anchor, ctx, cursor) {
    if (!anchor.qid) return EMPTY_DEEPER_PAGE();
    const chunk = typeof cursor?.chunk === 'number' ? cursor.chunk : 0;
    const json = await deeperFetchJson<EntitiesResponse>(entitiesUrl([anchor.qid], 'claims|sitelinks|labels|descriptions', `${ctx.lang}|en`), { signal: ctx.signal });
    const e = json?.entities?.[anchor.qid];
    if (!e?.claims) return EMPTY_DEEPER_PAGE(['wikidata']);
    const props = Object.keys(e.claims).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    const external = props.filter((p) => e.claims![p]?.[0]?.mainsnak?.datatype === 'external-id');
    const stated = props.filter((p) => !external.includes(p));
    const page = stated.slice(chunk * TWIN_CHUNK, (chunk + 1) * TWIN_CHUNK);
    const itemIds: string[] = [];
    const rows = page.map((p) => {
      const claims = (e.claims![p] ?? []).filter((c) => c.rank !== 'deprecated').slice(0, 3);
      const values = claims.map((c) => snakValue(c.mainsnak));
      values.forEach((v) => v.itemId && itemIds.push(v.itemId));
      return { p, values };
    });
    const labels = await labelsFor([...page, ...itemIds], ctx);
    const cards: DeeperCard[] = [];
    if (chunk === 0) {
      cards.push({
        id: 'twin-head',
        kind: 'facts',
        scope: 'global',
        field: 'f1',
        sourceId: 'wikidata',
        sourceUrl: wikidataUrl(anchor.qid),
        facts: [
          { label: 'f1', value: String(stated.length), emphasis: true },
          { label: 'f2', value: String(Object.keys(e.sitelinks ?? {}).filter((s) => s.endsWith('wiki')).length) },
          { label: 'f6', value: String(external.length) },
          ...(e.descriptions?.[ctx.lang]?.value || e.descriptions?.en?.value
            ? [{ label: 'f3', value: e.descriptions?.[ctx.lang]?.value ?? e.descriptions?.en?.value ?? '' }]
            : []),
        ],
      });
    }
    if (rows.length > 0) {
      cards.push({
        id: `twin-${chunk}`,
        kind: 'facts',
        scope: 'global',
        field: 'f4',
        sourceId: 'wikidata',
        sourceUrl: wikidataUrl(anchor.qid),
        facts: rows.map(({ p, values }) => ({
          label: labels.get(p) ?? p,
          literal: true,
          value: values
            .map((v) => (v.itemId ? labels.get(v.itemId) ?? v.itemId : v.text ?? ''))
            .filter(Boolean)
            .join(' · '),
        })),
        items: rows
          .flatMap(({ values }) => values)
          .filter((v) => v.itemId && labels.get(v.itemId))
          .slice(0, 6)
          .map((v) => ({ id: v.itemId!, title: labels.get(v.itemId!)!, qid: v.itemId, url: wikidataUrl(v.itemId!) })),
      });
    }
    const next = (chunk + 1) * TWIN_CHUNK < stated.length ? { chunk: chunk + 1 } : null;
    return { cards, cursor: next, fetchedAt: Date.now(), sources: ['wikidata'], empty: cards.length === 0 };
  },
};

/* ------------------------------------------------------------------ */
/* #2 causalHack -- 인과율 해킹                                          */
/* ------------------------------------------------------------------ */

const CAUSAL_PROPS = ['P828', 'P1542', 'P1536', 'P1537'] as const; // has cause · has effect · immediate cause · contributing factor
const STRUCTURAL_PROPS = ['P279', 'P361', 'P527', 'P1269'] as const; // subclass of · part of · has part · facet of
const CAUSAL_FIELD: Record<string, string> = { P828: 'f1', P1542: 'f2', P1536: 'f3', P1537: 'f4', P279: 'f5', P361: 'f5', P527: 'f6', P1269: 'f6' };
const HOP_LIMIT = 12;

function neighbourQuery(qid: string, props: readonly string[], lang: string, offset: number): string {
  const values = props.map((p) => `wdt:${p}`).join(' ');
  return `SELECT ?p ?item ?itemLabel ?dir WHERE {
  VALUES ?p { ${values} }
  { wd:${qid} ?p ?item . BIND("out" AS ?dir) } UNION { ?item ?p wd:${qid} . BIND("in" AS ?dir) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". }
} LIMIT ${HOP_LIMIT} OFFSET ${offset}`;
}

export const causalHackAdapter: DeeperAdapter = {
  key: 'causalHack',
  async load(anchor, ctx, cursor) {
    if (!anchor.qid) return EMPTY_DEEPER_PAGE();
    const stage = cursor?.stage === 'structure' ? 'structure' : 'causal';
    const offset = typeof cursor?.offset === 'number' ? cursor.offset : 0;
    const props = stage === 'causal' ? CAUSAL_PROPS : STRUCTURAL_PROPS;
    const json = await sparql(neighbourQuery(anchor.qid, props, ctx.lang, offset), { signal: ctx.signal });
    const rows = json?.results?.bindings ?? [];
    const byField = new Map<string, DeeperItem[]>();
    for (const b of rows) {
      const p = /P\d+$/.exec(b.p?.value ?? '')?.[0];
      const id = qidOfUri(b.item?.value);
      const title = b.itemLabel?.value;
      if (!p || !id || !title || /^Q\d+$/.test(title)) continue;
      const field = CAUSAL_FIELD[p] ?? 'f5';
      const list = byField.get(field) ?? [];
      list.push({ id: `${p}:${id}:${b.dir?.value}`, title, meta: b.dir?.value === 'in' ? '←' : '→', qid: id, url: wikidataUrl(id) });
      byField.set(field, list);
    }
    const cards: DeeperCard[] = Array.from(byField.entries()).map(([field, items]) => ({
      id: `causal-${stage}-${offset}-${field}`,
      kind: 'list',
      scope: 'global',
      field,
      items,
      sourceId: 'wikidataQuery',
      sourceUrl: wikidataUrl(anchor.qid!),
    }));
    // Causal edges are sparse ('공기' has one): fall through to the
    // structural neighbourhood on the same page when the causal leg is thin.
    if (stage === 'causal' && rows.length < HOP_LIMIT) {
      const structural = await sparql(neighbourQuery(anchor.qid, STRUCTURAL_PROPS, ctx.lang, 0), { signal: ctx.signal });
      const sRows = structural?.results?.bindings ?? [];
      const sItems = sRows
        .map((b) => ({ p: /P\d+$/.exec(b.p?.value ?? '')?.[0], id: qidOfUri(b.item?.value), title: b.itemLabel?.value, dir: b.dir?.value }))
        .filter((r) => r.p && r.id && r.title && !/^Q\d+$/.test(r.title!));
      const grouped = new Map<string, DeeperItem[]>();
      for (const r of sItems) {
        const field = CAUSAL_FIELD[r.p!] ?? 'f5';
        const list = grouped.get(field) ?? [];
        list.push({ id: `${r.p}:${r.id}:${r.dir}`, title: r.title!, meta: r.dir === 'in' ? '←' : '→', qid: r.id, url: wikidataUrl(r.id!) });
        grouped.set(field, list);
      }
      for (const [field, items] of grouped) cards.push({ id: `causal-structure-0-${field}`, kind: 'list', scope: 'global', field, items, sourceId: 'wikidataQuery', sourceUrl: wikidataUrl(anchor.qid) });
      const next = sRows.length >= HOP_LIMIT ? { stage: 'structure', offset: HOP_LIMIT } : null;
      return { cards, cursor: next, fetchedAt: Date.now(), sources: ['wikidataQuery'], empty: cards.length === 0 };
    }
    const next = rows.length >= HOP_LIMIT ? { stage, offset: offset + HOP_LIMIT } : stage === 'causal' ? { stage: 'structure', offset: 0 } : null;
    return { cards, cursor: next, fetchedAt: Date.now(), sources: ['wikidataQuery'], empty: cards.length === 0 };
  },
};

/* ------------------------------------------------------------------ */
/* #5 zeroPoint -- 제로베이스 진리                                        */
/* ------------------------------------------------------------------ */

export const ZERO_POINT_LANGS = ['en', 'ko', 'et', 'ja', 'zh', 'es', 'km', 'fr', 'de', 'pt', 'vi', 'id', 'ru', 'hi', 'it', 'tr', 'th', 'pl', 'nl', 'tl'] as const;

interface WiktionaryDefinition {
  partOfSpeech?: string;
  definitions?: Array<{ definition?: string }>;
}

async function wiktionarySenses(term: string, lang: string, ctx: DeeperContext): Promise<DeeperItem[]> {
  if (lang === 'en') {
    const json = await deeperFetchJson<Record<string, WiktionaryDefinition[]>>(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(term.replace(/ /g, '_'))}`,
      { signal: ctx.signal },
    );
    const en = json?.en ?? [];
    return en.flatMap((pos, i) =>
      (pos.definitions ?? []).slice(0, 2).map((d, j) => ({
        id: `sense-en-${i}-${j}`,
        title: (d.definition ?? '').replace(/<[^>]+>/g, '').trim(),
        meta: pos.partOfSpeech,
        url: `https://en.wiktionary.org/wiki/${encodeURIComponent(term.replace(/ /g, '_'))}`,
      })),
    ).filter((s) => s.title);
  }
  const json = await deeperFetchJson<{ query?: { pages?: Array<{ extract?: string; missing?: boolean }> } }>(
    `https://${lang}.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(term)}&prop=extracts&explaintext=1&exsectionformat=plain&format=json&formatversion=2&redirects=1&origin=*`,
    { signal: ctx.signal },
  );
  const extract = json?.query?.pages?.[0]?.extract ?? '';
  return extract
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 6 && l.length < 200 && !/^=+.*=+$/.test(l))
    .slice(0, 6)
    .map((l, i) => ({ id: `sense-${lang}-${i}`, title: l, url: `https://${lang}.wiktionary.org/wiki/${encodeURIComponent(term)}` }));
}

export const zeroPointAdapter: DeeperAdapter = {
  key: 'zeroPoint',
  async load(anchor, ctx, cursor) {
    if (!anchor.qid) return EMPTY_DEEPER_PAGE();
    const stage = cursor?.stage === 'senses' ? 'senses' : 'labels';
    if (stage === 'labels') {
      const json = await deeperFetchJson<EntitiesResponse>(entitiesUrl([anchor.qid], 'labels|descriptions|aliases', ZERO_POINT_LANGS.join('|')), { signal: ctx.signal });
      const e = json?.entities?.[anchor.qid];
      if (!e) return EMPTY_DEEPER_PAGE(['wikidata']);
      const labels: DeeperItem[] = ZERO_POINT_LANGS.filter((l) => e.labels?.[l]?.value).map((l) => ({ id: `label-${l}`, title: e.labels![l]!.value!, meta: l }));
      const aliases = (e.aliases?.[ctx.lang] ?? e.aliases?.en ?? []).map((a) => a.value).filter((v): v is string => Boolean(v));
      const cards: DeeperCard[] = [
        {
          id: 'zero-labels',
          kind: 'chips',
          scope: 'global',
          field: 'f1',
          items: labels,
          sourceId: 'wikidata',
          sourceUrl: wikidataUrl(anchor.qid),
        },
      ];
      const desc = e.descriptions?.[ctx.lang]?.value ?? e.descriptions?.en?.value;
      if (desc || aliases.length > 0) {
        cards.push({
          id: 'zero-desc',
          kind: 'facts',
          scope: 'country',
          field: 'f2',
          facts: [...(desc ? [{ label: 'f2', value: desc, emphasis: true }] : []), ...(aliases.length > 0 ? [{ label: 'f3', value: aliases.slice(0, 6).join(' · ') }] : [])],
          sourceId: 'wikidata',
          sourceUrl: wikidataUrl(anchor.qid),
        });
      }
      return { cards, cursor: { stage: 'senses' }, fetchedAt: Date.now(), sources: ['wikidata'] };
    }
    const term = anchor.localeTitle ?? anchor.term;
    const own = await wiktionarySenses(term, ctx.lang, ctx);
    const en = ctx.lang !== 'en' && anchor.enTitle ? await wiktionarySenses(anchor.enTitle, 'en', ctx) : [];
    const cards: DeeperCard[] = [];
    if (own.length > 0) cards.push({ id: 'zero-senses-own', kind: 'list', scope: 'country', field: 'f4', items: own, sourceId: 'wiktionary', sourceUrl: own[0].url });
    if (en.length > 0) cards.push({ id: 'zero-senses-en', kind: 'list', scope: 'global', field: 'f6', items: en, sourceId: 'wiktionary', sourceUrl: en[0].url });
    return { cards, cursor: null, fetchedAt: Date.now(), sources: ['wiktionary'], empty: cards.length === 0 };
  },
};

/* ------------------------------------------------------------------ */
/* #9 marketMoat -- 시장 해자                                             */
/* ------------------------------------------------------------------ */

const MOAT_LIMIT = 12;
const WB_INDICATORS: Array<{ code: string; field: string; fmt: (v: number) => string }> = [
  { code: 'NY.GDP.MKTP.CD', field: 'f3', fmt: (v) => `$${compactNumber(v)}` },
  { code: 'SP.POP.TOTL', field: 'f4', fmt: (v) => compactNumber(v) },
  { code: 'IT.NET.USER.ZS', field: 'f5', fmt: (v) => `${v.toFixed(0)}%` },
];

function industryQuery(qid: string, lang: string, offset: number): string {
  return `SELECT ?org ?orgLabel ?country ?countryLabel WHERE {
  ?org (wdt:P452|wdt:P1056) wd:${qid} .
  OPTIONAL { ?org wdt:P17 ?country . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". }
} LIMIT ${MOAT_LIMIT} OFFSET ${offset}`;
}

function hqQuery(placeQid: string, lang: string, offset: number): string {
  return `SELECT ?org ?orgLabel ?industry ?industryLabel WHERE {
  ?org wdt:P159 wd:${placeQid} ; wdt:P452 ?industry .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". }
} LIMIT ${MOAT_LIMIT} OFFSET ${offset}`;
}

interface WorldBankPoint {
  date?: string;
  value?: number | null;
  country?: { value?: string };
}

async function worldBankLatest(iso2: string, code: string, ctx: DeeperContext): Promise<WorldBankPoint | null> {
  const json = await deeperFetchJson<[unknown, WorldBankPoint[] | undefined] | undefined>(
    `https://api.worldbank.org/v2/country/${iso2}/indicator/${code}?format=json&per_page=12&source=2`,
    { signal: ctx.signal },
  );
  const points = Array.isArray(json) ? json[1] ?? [] : [];
  return points.find((p) => typeof p.value === 'number') ?? null;
}

export const marketMoatAdapter: DeeperAdapter = {
  key: 'marketMoat',
  async load(anchor, ctx, cursor) {
    if (!anchor.qid) return EMPTY_DEEPER_PAGE();
    const mode = cursor?.mode === 'hq' || (!cursor && anchor.kind === 'place') ? 'hq' : 'industry';
    const offset = typeof cursor?.offset === 'number' ? cursor.offset : 0;
    const json = await sparql(mode === 'hq' ? hqQuery(anchor.qid, ctx.lang, offset) : industryQuery(anchor.qid, ctx.lang, offset), { signal: ctx.signal });
    const rows = json?.results?.bindings ?? [];
    const items: DeeperItem[] = rows
      .map((b) => ({ id: qidOfUri(b.org?.value), title: b.orgLabel?.value, meta: b.countryLabel?.value ?? b.industryLabel?.value }))
      .filter((r) => r.id && r.title && !/^Q\d+$/.test(r.title!))
      .map((r) => ({ id: r.id!, title: r.title!, meta: r.meta, qid: r.id, url: wikidataUrl(r.id!) }));
    const cards: DeeperCard[] = [];
    if (items.length > 0) {
      cards.push({ id: `moat-${mode}-${offset}`, kind: 'list', scope: 'global', field: 'f1', items, sourceId: 'wikidataQuery', sourceUrl: wikidataUrl(anchor.qid) });
      if (mode === 'industry') {
        const byCountry = new Map<string, number>();
        rows.forEach((b) => {
          const c = b.countryLabel?.value;
          if (c) byCountry.set(c, (byCountry.get(c) ?? 0) + 1);
        });
        if (byCountry.size > 0) {
          cards.push({
            id: `moat-countries-${offset}`,
            kind: 'facts',
            scope: 'global',
            field: 'f2',
            facts: Array.from(byCountry.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([c, n]) => ({ label: c, literal: true, value: String(n) })),
            sourceId: 'wikidataQuery',
          });
        }
      }
    }
    // Country section (REV-21 §2A): the selected country's headline
    // indicators, once, on the first page.
    if (offset === 0) {
      const points = await Promise.all(WB_INDICATORS.map((i) => worldBankLatest(ctx.country, i.code, ctx)));
      const facts = WB_INDICATORS.map((i, k) => ({ i, p: points[k] })).filter((x) => x.p && typeof x.p.value === 'number');
      if (facts.length > 0) {
        cards.push({
          id: 'moat-country',
          kind: 'facts',
          scope: 'country',
          field: 'f3',
          facts: [
            { label: 'f6', value: facts[0].p!.country?.value ?? ctx.country, emphasis: true },
            ...facts.map(({ i, p }) => ({ label: i.field, value: i.fmt(p!.value as number), unit: p!.date ? ` (${p!.date})` : undefined })),
          ],
          sourceId: 'worldBank',
          sourceUrl: `https://data.worldbank.org/country/${ctx.country}`,
        });
      }
    }
    const next = rows.length >= MOAT_LIMIT ? { mode, offset: offset + MOAT_LIMIT } : null;
    return { cards, cursor: next, fetchedAt: Date.now(), sources: cards.some((c) => c.sourceId === 'worldBank') ? ['wikidataQuery', 'worldBank'] : ['wikidataQuery'], empty: cards.length === 0 };
  },
};

/** Shared with ventureSignal / marketMoat: an anchor that is a person or a
 *  work has no market or launch signal worth a page. */
export function isSignalEligible(p31: readonly string[]): boolean {
  return !p31.some((q) => EXCLUDED_CROSS_P31.has(q));
}

export type { DeeperPage as WikidataDeeperPage, DeeperCursor as WikidataDeeperCursor, DeeperAnchor as WikidataDeeperAnchor };
