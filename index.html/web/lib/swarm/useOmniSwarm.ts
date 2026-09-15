'use client';

/**
 * REV-32 M1 (founder directive 2026-09-15) -- the swarm's own loader.
 *
 * It replaces `useDeeperPage`, which was a generic lens pager: infinite
 * scroll, a per-theme TTL cache keyed by theme, an IntersectionObserver in
 * the view, retry copy, and a cursor the visitor advanced by scrolling. The
 * swarm never wanted any of that. It has exactly TWO cursor pages (six
 * Wikidata dimensions, three per page) and it is not a feed -- a half-drawn
 * field is not a shorter field, it is a WRONG graph, because the sectors are
 * laid out from the dimension count. So this hook walks the cursor to the end
 * itself and publishes once.
 *
 * 한계비용 0원 (Codex §2 #160, #309, #409). A module-level cache keyed on
 * (qid, lang) answers a revisit with zero requests, and an in-flight map
 * means two entrances opening the same subject at once -- the hub tile and
 * the U-AI region, say -- spend one resolution between them, not two.
 *
 * Fail-open: a failed load leaves `failed` true and the field empty; nothing
 * here can throw into the render tree.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SourceId } from '@/lib/uai/sourceRegistry';
import type { SwarmInputDimension } from './swarmLayout';
import { omniTechSource } from './omniTechSource';
import type { SwarmAnchor, SwarmCard, SwarmContext, SwarmFact } from './swarmTypes';

/** A resolved organisation is stable; hold it for the session. */
const memory = new Map<string, SwarmResult>();
const inFlight = new Map<string, Promise<SwarmResult>>();

/** Safety rail: the source declares two pages, never trust it blindly. */
const MAX_PAGES = 6;

export interface SwarmResult {
  cards: SwarmCard[];
  sources: SourceId[];
  empty: boolean;
}

export interface OmniSwarmState {
  /** Localized sectors, ready for `swarmLayout()`. */
  dimensions: SwarmInputDimension[];
  /** The scale header (employees, revenue) -- may be empty. */
  facts: SwarmFact[];
  sources: SourceId[];
  loading: boolean;
  failed: boolean;
  /** True when the source answered but the entity has no modules. */
  empty: boolean;
}

const cacheKey = (qid: string, lang: string) => `${qid}|${lang}`;

/** Walk the cursor to the end and hand back every card at once. */
async function loadAll(anchor: SwarmAnchor, ctx: SwarmContext): Promise<SwarmResult> {
  const cards: SwarmCard[] = [];
  const sources = new Set<SourceId>();
  let cursor = undefined as Parameters<typeof omniTechSource.load>[2];
  let empty = true;
  for (let page = 0; page < MAX_PAGES; page++) {
    const next = await omniTechSource.load(anchor, ctx, cursor);
    cards.push(...next.cards);
    for (const s of next.sources) sources.add(s);
    if (next.cards.length > 0) empty = false;
    if (!next.cursor) break;
    cursor = next.cursor;
  }
  return { cards, sources: Array.from(sources), empty };
}

/**
 * @param anchor the organisation to take apart; `null` or QID-less = idle.
 * @param label  localizes a dimension's `f1..f6` field key. Must be stable.
 */
export function useOmniSwarm(anchor: SwarmAnchor | null, lang: string, locale: string, label: (field: string) => string): OmniSwarmState {
  const [result, setResult] = useState<SwarmResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const labelRef = useRef(label);
  labelRef.current = label;

  const qid = anchor?.qid ?? '';
  const term = anchor?.term ?? '';

  useEffect(() => {
    if (!qid) {
      setResult(null);
      setLoading(false);
      setFailed(false);
      return;
    }
    const key = cacheKey(qid, lang);
    const cached = memory.get(key);
    if (cached) {
      setResult(cached);
      setLoading(false);
      setFailed(false);
      return;
    }
    let live = true;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    // Two entrances on the same subject share one resolution.
    let work = inFlight.get(key);
    if (!work) {
      work = loadAll({ qid, term, lang }, { locale, lang, signal: controller.signal })
        .then((r) => {
          memory.set(key, r);
          return r;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, work);
    }
    work
      .then((r) => {
        if (!live) return;
        setResult(r);
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setResult(null);
        setLoading(false);
        setFailed(true);
      });
    return () => {
      live = false;
      // Never abort the SHARED work -- another mount may still want it.
      if (!inFlight.has(key)) controller.abort();
    };
    // `term` only travels with the qid; it never re-triggers a load on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qid, lang, locale]);

  const dimensions = useMemo<SwarmInputDimension[]>(() => {
    if (!result) return [];
    return result.cards
      .filter((c) => c.kind === 'chips' && c.items && c.items.length > 0)
      .map((c) => ({
        key: c.id,
        label: (c.field ? labelRef.current(c.field) : '') || c.id,
        nodes: (c.items ?? []).map((it) => ({ id: it.id, title: it.title, qid: it.qid, url: it.url })),
      }));
    // `locale` is a dependency even though it is not read here: two locales can
    // map to the SAME wiki language, so a language switch would hit the same
    // cache entry, hand back the same `result` object, and leave the previous
    // locale's dimension labels standing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, locale]);

  const facts = useMemo<SwarmFact[]>(
    () => (result?.cards.find((c) => c.kind === 'facts')?.facts ?? []),
    [result],
  );

  return {
    dimensions,
    facts,
    sources: result?.sources ?? [],
    loading,
    failed,
    empty: Boolean(result?.empty),
  };
}

/** Test seam: drop every cached organisation. */
export function __resetSwarmCache(): void {
  memory.clear();
  inFlight.clear();
}
