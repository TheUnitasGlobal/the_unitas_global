// REV-17 Quantum White surface-state persistence (SPEC.md §3.3) -- pure
// encode/decode/validate for "which cluster pop-out (and which module inside
// it) is open right now", plus the helpers that let a caller round-trip that
// state through both a URL hash (`#core/<cluster>[/<moduleId>]`) and a
// sessionStorage mirror without ever touching Next.js's own router-private
// history keys.
//
// Nothing here writes to `window` directly -- callers own `history`/
// `sessionStorage` access so this stays unit-testable without a DOM.

import type { ClusterKey, ClusterModule, SingularityCluster } from './clusters';

export interface SurfaceState {
  cluster: ClusterKey;
  /** `ClusterModule.id` (e.g. `'ecosystem:echo'`), or absent when only the tile grid is open. */
  moduleId?: string;
}

/** sessionStorage key the mirror lives under. */
export const SURFACE_MIRROR_KEY = 'unitas.qw.surface.v1';
/** Mirror value meaning "explicitly closed" -- wins over any URL hash leftover from history navigation. */
export const SURFACE_TOMBSTONE = '-';

const HASH_PREFIX = 'core';

/** `null`/closed -> `''`; open cluster only -> `'core/<cluster>'`; open module -> `'core/<cluster>/<moduleId>'`. */
export function encodeSurface(state: SurfaceState | null): string {
  if (!state) return '';
  const parts = [HASH_PREFIX, state.cluster];
  if (state.moduleId) parts.push(state.moduleId);
  return parts.join('/');
}

/**
 * Parses either a bare encoded string (`'core/cognitive/ecosystem:echo'`) or
 * a full location hash (`'#core/cognitive'`) and validates it against the
 * live cluster registry -- an unknown cluster key, or a module id that
 * exists but isn't a member of the named cluster, both fail closed to
 * `null` rather than opening the wrong surface.
 */
export function parseSurface(text: string, clusters: readonly SingularityCluster[]): SurfaceState | null {
  const trimmed = text.replace(/^#/, '').trim();
  if (!trimmed || trimmed === SURFACE_TOMBSTONE) return null;
  const segments = trimmed.split('/').filter(Boolean);
  if (segments.length < 2 || segments[0] !== HASH_PREFIX) return null;
  const clusterKey = segments[1] as ClusterKey;
  const cluster = clusters.find((c) => c.key === clusterKey);
  if (!cluster) return null;
  const moduleId = segments[2];
  if (!moduleId) return { cluster: clusterKey };
  const found: ClusterModule | undefined = cluster.modules.find((m) => m.id === moduleId);
  if (!found) return null;
  return { cluster: clusterKey, moduleId };
}

/**
 * Resolution priority (SPEC.md §3.3): the sessionStorage mirror is the
 * source of truth whenever it exists (including its tombstone, meaning
 * "explicitly closed") because a stale URL hash can survive on the
 * ExitGuard sentinel buffer's duplicated history entries. Only when there
 * is NO mirror at all (a genuine cold/deep-link arrival) does the URL hash
 * get to open a surface.
 */
export function resolveInitialSurface(
  input: { hash: string; mirror: string | null },
  clusters: readonly SingularityCluster[],
): SurfaceState | null {
  if (input.mirror !== null) {
    if (input.mirror === SURFACE_TOMBSTONE) return null;
    return parseSurface(input.mirror, clusters);
  }
  return parseSurface(input.hash, clusters);
}

/** Next.js app-router's private history keys (see lib/exit/appExit.ts's `NEXT_ROUTER_STATE_FLAG`/`NEXT_ROUTER_TREE_KEY`). */
const NEXT_ROUTER_STATE_FLAG = '__NA';
const NEXT_ROUTER_TREE_KEY = '__PRIVATE_NEXTJS_INTERNALS_TREE';
const NEXT_LEGACY_ROUTER_FLAG = '_N';

/**
 * Strips Next's router-private keys from a `history.state` snapshot so the
 * result is safe to pass to `history.replaceState` -- WITHOUT them, Next's
 * patched `replaceState` (app-router.js) re-adopts the state verbatim and
 * re-synchronizes its own canonical URL from it (`copyNextJsInternalHistoryState`
 * + `ACTION_RESTORE`), which is what actually registers the new hash with
 * the router. WITH them present, the patched call short-circuits (treats it
 * as an internal call) and the hash is silently unregistered on the next
 * router-driven history write. Every other key -- including ExitGuard's
 * sentinel marker/depth -- is preserved untouched.
 */
export function stripRouterKeys(state: unknown): Record<string, unknown> {
  if (!state || typeof state !== 'object') return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state as Record<string, unknown>)) {
    if (key === NEXT_ROUTER_STATE_FLAG || key === NEXT_ROUTER_TREE_KEY || key === NEXT_LEGACY_ROUTER_FLAG) continue;
    result[key] = value;
  }
  return result;
}

/** The URL a `SurfaceState` should be represented as, preserving the current pathname/search and replacing only the hash. */
export function surfaceHref(location: { pathname: string; search: string }, state: SurfaceState | null): string {
  const hash = encodeSurface(state);
  return `${location.pathname}${location.search}${hash ? `#${hash}` : ''}`;
}
