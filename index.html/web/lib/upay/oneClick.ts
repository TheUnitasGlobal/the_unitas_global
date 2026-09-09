import type { ClusterModule, ModuleKind } from '@/lib/quantumWhite/clusters';

/**
 * REV-13 U-Pay "1-Click Holographic Gateway" -- the pure state machine and
 * pure decision functions behind `components/upay/UPayGateway.tsx` (spec
 * section 4 + section 10 items 6/7).
 *
 * Nothing in this file touches React, Supabase, or the DOM: every function
 * is a total, deterministic mapping from its inputs to an output, which is
 * what makes `reduceOneClick` / `classifySpendError` / `planInvestment`
 * exhaustively unit-testable without a browser.
 *
 * `ClusterModule` / `ModuleKind` are imported TYPE-ONLY -- `lib/quantumWhite/
 * clusters.ts` imports the universal access/cost maps from `lib/upay/
 * universal.ts` at runtime, so a value import back from this file would
 * create a circular module graph. `UPAY_UNIVERSAL_ACCESS` / `UPAY_UNIVERSAL_
 * COSTS` themselves live in `lib/upay/universal.ts` -- import them from
 * there directly; this file only consumes the already-resolved
 * `ClusterModule.accessName` / `.coinCost` fields.
 */

/**
 * Cluster kinds a 1-click investment can execute unconditionally (founder
 * status never enters into it): every module of these kinds lands on a real,
 * publicly reachable page once burned, including `b2b`'s Coming-Soon
 * placeholder route. `lifeos` is deliberately NOT in this set -- it is
 * executable only when the caller is a verified founder (see
 * `planInvestment`'s `opts.founder`), because its destination 404s for
 * everyone else and there is no refund path for a burn spent on a page a
 * visitor can never reach.
 */
export const UPAY_OPEN_KINDS: ReadonlySet<ModuleKind> = new Set(['ecosystem', 'b2c', 'lockin', 'b2b']);

/** Why a one-click attempt was refused before (or instead of) the RPC firing. */
export type OneClickBlockReason =
  | 'signin'
  | 'guest'
  | 'insufficient'
  | 'shield'
  | 'unlisted'
  | 'phone';

export type OneClickState =
  | { status: 'idle' }
  | { status: 'arming' }
  | { status: 'executing' }
  | { status: 'success'; balanceAfter: number | null; reused?: boolean }
  | { status: 'blocked'; reason: OneClickBlockReason }
  | { status: 'failed'; message: string };

export type OneClickEvent =
  | { type: 'arm' }
  | { type: 'disarm' }
  | { type: 'execute' }
  | { type: 'succeed'; balanceAfter: number | null; reused?: boolean }
  | { type: 'block'; reason: OneClickBlockReason }
  | { type: 'fail'; message: string }
  | { type: 'reset' };

/**
 * Total, deterministic reducer: every event fully determines the next state
 * on its own (it carries everything the new state needs), so this is a pure
 * function of the EVENT, not of the previous state -- there is no
 * unreachable/undefined transition to guard against, which keeps the "one
 * click, no confirm dialog" flow in `UPayGateway` a straight-line sequence
 * of dispatches (`arm` -> micro-press -> `execute` -> `succeed` / `block` /
 * `fail`, with `reset` / `disarm` always available to return to `idle`).
 */
export function reduceOneClick(state: OneClickState, event: OneClickEvent): OneClickState {
  switch (event.type) {
    case 'arm':
      return { status: 'arming' };
    case 'disarm':
      return { status: 'idle' };
    case 'execute':
      return { status: 'executing' };
    case 'succeed':
      return { status: 'success', balanceAfter: event.balanceAfter, reused: event.reused };
    case 'block':
      return { status: 'blocked', reason: event.reason };
    case 'fail':
      return { status: 'failed', message: event.message };
    case 'reset':
      return { status: 'idle' };
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

export type SpendErrorKind = 'insufficient' | 'unlisted' | 'phone' | 'auth' | 'unknown';

/**
 * Maps a `spend_coins()` PostgREST error message (see the four `raise
 * exception` messages in `supabase/migrations/20260914000000_upay_
 * universal_allowlist.sql`, verbatim from `20260908000000_u_ai_genesis_
 * memory.sql`) to the `OneClickBlockReason` / failure the gateway shows.
 * Matching is substring + case-insensitive so a Postgres-appended detail
 * ("Unknown module: lockin:nexus") still classifies correctly.
 */
export function classifySpendError(message: string): SpendErrorKind {
  const m = message.toLowerCase();
  if (m.includes('insufficient')) return 'insufficient';
  if (m.includes('unknown module')) return 'unlisted';
  if (m.includes('phone verification')) return 'phone';
  if (m.includes('not authenticated')) return 'auth';
  return 'unknown';
}

export interface InvestmentPlan {
  /** Exact `spend_coins()` / ledger name; '' when the module has none. */
  accessName: string;
  amount: number;
  executable: boolean;
  reason?: 'unlisted' | 'free';
}

export interface PlanInvestmentOptions {
  /**
   * Live-verified founder session (see `hasSovereignHint()` in
   * `@/lib/foundersGate`). Gates `lifeos` executability ONLY -- Life-OS
   * pages sit behind `middleware.ts`'s hard 404 fence for anyone without the
   * founder cookie, so opening the burn to the public would let a visitor
   * pay U-COIN (no refund path exists, see `spend_coins()`) and then land on
   * a real 404. `ecosystem` / `b2c` / `lockin` / `b2b` never consult this --
   * their destinations are always reachable once paid for.
   */
  founder?: boolean;
}

/**
 * Decides whether a one-click burn should even attempt the RPC for this
 * module. `ecosystem` / `b2c` / `lockin` / `b2b` modules with a real access
 * name and a positive cost are always executable -- all four land on a real,
 * publicly reachable page once burned (b2b's Coming-Soon placeholder is
 * still a live route, not a dead end). `lifeos` is executable ONLY when
 * `opts.founder` is true, because its destination 404s for anyone else (see
 * `PlanInvestmentOptions.founder`). Anything with no access name at all
 * still returns a fully-formed plan -- `UPayGateway` renders it and shows
 * `QuantumWhite.unlisted` rather than hiding the button.
 */
export function planInvestment(module: ClusterModule, opts: PlanInvestmentOptions = {}): InvestmentPlan {
  const accessName = module.accessName ?? '';
  const amount = module.coinCost;

  if (!accessName) {
    return { accessName, amount, executable: false, reason: 'unlisted' };
  }
  const kindOpen = module.kind === 'lifeos' ? opts.founder === true : UPAY_OPEN_KINDS.has(module.kind);
  if (!kindOpen) {
    return { accessName, amount, executable: false, reason: 'unlisted' };
  }
  if (amount <= 0) {
    return { accessName, amount, executable: false, reason: 'free' };
  }
  return { accessName, amount, executable: true };
}
