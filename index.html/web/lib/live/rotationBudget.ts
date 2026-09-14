/**
 * REV-24 MISSION 3 -- the ZERO-COST ROLLING rule (founder directive
 * 2026-09-13; Codex ch.1 "실질 한계 비용 0원", 초오프라인결정론적 /
 * 초로우메모리적).
 *
 * THE DEFECT THIS CLOSES. The discovery carousel advances one slot every 7s,
 * and its card loader re-fetched whenever the slot it landed on had aged past
 * its per-kind TTL (15 min feed / 10 min weather / 6 h ranking). A full loop
 * of the 16 slots takes 112s, so the CLOCK -- not the visitor -- re-fetched
 * every one of the thirteen network-backed slots once per TTL, forever, for
 * someone who had done nothing but leave the search box focused. Thirteen of
 * those go straight from the browser to a third-party origin, so they never
 * appeared in our own logs either.
 *
 * THE RULE. Rotation reads memory; only a visitor spends a request.
 *
 *   cold  + anyone  -> FETCH. A slot with no cache entry has nothing to
 *                      show. The cache is written on EVERY resolve (empty
 *                      answers included), so this is the first fill and can
 *                      never repeat for that key in the session -- it is not
 *                      a re-call.
 *   fresh + anyone  -> MEMORY. Unchanged.
 *   stale + clock   -> MEMORY. The founder's "API 재호출 비용 0원": the
 *                      rotation shows what it already holds.
 *   stale + intent  -> FETCH. A pinned chip, a swipe, an arrow key, a tab
 *                      pick or a closed deep modal is a stated request for
 *                      fresh data, and is the ONLY thing that buys one.
 *
 * Pure and clock-injectable so the whole table is unit-testable without a
 * DOM, a timer or a network -- `__tests__/live/rotationBudget.test.ts`.
 */

export type RotationSource =
  /** The auto-rotation timer advanced to this slot. Spends nothing. */
  | 'clock'
  /** The visitor deliberately landed here (pin / swipe / key / tab / modal). */
  | 'intent';

export type RotationAction =
  /** Render the cache entry; issue no request. */
  | 'memory'
  /** No entry to render: request it (first fill). */
  | 'fetch'
  /** An entry exists but the visitor asked for fresh data: request it. */
  | 'refresh';

export interface RotationDecisionInput {
  /** `undefined` when the key has never been loaded in this session. */
  cachedAt: number | undefined;
  /** The slot kind's TTL in ms (`slotTtlMs`). */
  ttlMs: number;
  source: RotationSource;
  /** Injected for testability; defaults to the wall clock. */
  now?: number;
}

export interface RotationDecision {
  action: RotationAction;
  /** `true` for exactly `fetch` and `refresh` -- the only network paths. */
  spendsRequest: boolean;
  /** `true` when there is an entry worth painting while a fetch is in flight. */
  hasPaintableCache: boolean;
}

export function decideRotationLoad({
  cachedAt,
  ttlMs,
  source,
  now = Date.now(),
}: RotationDecisionInput): RotationDecision {
  const hasPaintableCache = typeof cachedAt === 'number' && Number.isFinite(cachedAt);

  if (!hasPaintableCache) {
    // Cold: nothing to paint. The first fill is not a re-call.
    return { action: 'fetch', spendsRequest: true, hasPaintableCache: false };
  }

  const fresh = now - (cachedAt as number) < ttlMs;
  if (fresh) return { action: 'memory', spendsRequest: false, hasPaintableCache: true };

  // Stale. The clock reads memory; only stated intent buys a refresh.
  return source === 'intent'
    ? { action: 'refresh', spendsRequest: true, hasPaintableCache: true }
    : { action: 'memory', spendsRequest: false, hasPaintableCache: true };
}

/**
 * Convenience for the carousel: how many requests a full unattended loop of
 * `slotCount` slots costs once every key has been filled once. It is zero by
 * construction, and the test asserts it for a simulated 24-hour idle.
 */
export function unattendedLoopRequestCost(
  entries: readonly { cachedAt: number; ttlMs: number }[],
  now: number,
): number {
  return entries.reduce(
    (spend, e) => spend + (decideRotationLoad({ ...e, source: 'clock', now }).spendsRequest ? 1 : 0),
    0,
  );
}
