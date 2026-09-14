/**
 * REV-24 MISSION 2 -- the SOVEREIGN MASTER KEY (founder directive 2026-09-13).
 *
 * THE DEFECT THIS CLOSES. REV-23 sealed the funnel at the edge, and the only
 * ways past it were a browser cookie, an indexer user-agent, or the blunt
 * `UNITAS_GATE_BYPASS=1` environment flag. That flag is an all-or-nothing
 * switch: setting it in production opens the funnel for the entire planet, so
 * the founder's own direct access -- a `curl` health ping, an uptime monitor,
 * a deploy smoke test, a second device with no cookie jar -- had no permanent
 * home. It was a temporary crutch, and it is now DELETED
 * (`GATE_BYPASS_ENV` / `isGateBypassed` no longer exist).
 *
 * WHAT REPLACES IT. One covert, cryptographic, per-request credential that
 * works everywhere the founder actually is:
 *
 *   1. HEADER  `x-unitas-signature: <credential>`  -- the primary path. Any
 *      HTTP client can carry it; nothing about the name advertises what it
 *      unlocks, and an absent/wrong value is indistinguishable from an
 *      ordinary public request (same response, no timing tell, no log line).
 *   2. COOKIE  `unitas_sovereign`                  -- the browser path that
 *      already existed (`lib/sovereignAuth.ts`), unchanged.
 *   3. PARAM   `?sovereign_auth=<token>`           -- the bootstrap that mints
 *      the cookie, unchanged.
 *
 * A `credential` is EITHER of two shapes, both constant-time compared:
 *
 *   - a SIGNED CAPSULE `v1.<expiresAtSec>.<hmac-sha256 hex>` -- exactly the
 *     session-cookie format, so one minting routine serves both. Expiring,
 *     revocable by rotating the secret, and safe to paste into a third-party
 *     monitor because it carries no secret. Mint one with
 *     `node scripts/sovereign-master-key.mjs --days 365`.
 *   - the RAW MASTER TOKEN (`SOVEREIGN_AUTH_TOKEN`) -- for a one-off shell
 *     ping where minting a capsule is more ceremony than the task deserves.
 *
 * FAIL-PROOF, BOTH DIRECTIONS. Fail-closed for the public: a null secret (the
 * production posture when `SOVEREIGN_AUTH_TOKEN` is unset), a malformed
 * value, an expired capsule or a bad signature all resolve to "not the
 * founder", and the caller is sealed like anyone else. Fail-OPEN for the
 * founder in the sense that matters: the three paths are independent, so
 * losing the cookie jar (incognito, a new device, an in-app browser that
 * drops cookies) never locks the founder out -- the header still works, and
 * middleware UPGRADES a header-authenticated navigation into a cookie so the
 * rest of the session needs no header at all.
 *
 * Edge-safe: Web Crypto only, no Node API, no DOM. Pure helpers are
 * unit-tested in `__tests__/gate/masterKey.test.ts`.
 */
import {
  resolveSovereignSigningSecret,
  resolveSovereignToken,
  timingSafeEqualString,
  verifySovereignSession,
} from '../sovereignAuth';

/**
 * The credential header. Deliberately named like an ordinary vendor
 * provenance header -- it sits next to the `X-Unitas-Owner` /
 * `X-Unitas-License` headers every response already carries, so its presence
 * on a request reads as telemetry rather than as a key.
 */
export const SOVEREIGN_MASTER_HEADER = 'x-unitas-signature';

/**
 * Accepted as an alias so a client that can only set `Authorization` (some
 * uptime monitors, some CI runners) is not shut out. `Bearer <credential>`
 * and a bare `<credential>` both work.
 */
export const SOVEREIGN_MASTER_AUTHORIZATION_SCHEME = 'Bearer';

/** How long a capsule minted by `mintMasterKey` lives when unspecified. */
export const SOVEREIGN_MASTER_DEFAULT_TTL_SEC = 60 * 60 * 24 * 365;

export type MasterKeyVerdict = 'capsule' | 'token' | 'reject';

export interface MasterKeyCheck {
  ok: boolean;
  /** Which shape verified -- observability only, never sent to a client. */
  via: MasterKeyVerdict;
  /** Unix seconds, only meaningful for a verified capsule. */
  expiresAt: number | null;
}

const REJECTED: MasterKeyCheck = { ok: false, via: 'reject', expiresAt: null };

/** Strips an optional `Bearer ` scheme; returns the bare credential. */
export function normalizeMasterCredential(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const prefix = `${SOVEREIGN_MASTER_AUTHORIZATION_SCHEME.toLowerCase()} `;
  if (trimmed.toLowerCase().startsWith(prefix)) return trimmed.slice(prefix.length).trim();
  return trimmed;
}

/**
 * Reads the credential a request is offering, header first. Returns `''` when
 * the request offers nothing -- the overwhelmingly common case, which
 * `verifyMasterKey` then answers without touching crypto at all.
 */
export function readMasterCredential(headers: Headers | null | undefined): string {
  if (!headers) return '';
  const direct = normalizeMasterCredential(headers.get(SOVEREIGN_MASTER_HEADER));
  if (direct) return direct;
  return normalizeMasterCredential(headers.get('authorization'));
}

/** A capsule is `v1.<digits>.<64 hex>`; anything else is treated as a token. */
export function looksLikeCapsule(credential: string): boolean {
  return /^v1\.\d+\.[0-9a-f]{64}$/.test(credential);
}

/**
 * THE decision. Order: nothing offered -> reject without crypto; capsule ->
 * HMAC + expiry via the session verifier (one format, one implementation);
 * otherwise -> constant-time compare against the raw master token.
 *
 * `secret` and `token` are injected so this stays pure and testable; the
 * request-time wrapper below resolves them from the environment.
 */
export async function verifyMasterKey(
  credential: string,
  secret: string | null,
  token: string | null,
  nowSec?: number,
): Promise<MasterKeyCheck> {
  const value = normalizeMasterCredential(credential);
  if (!value) return REJECTED;

  if (looksLikeCapsule(value)) {
    const check = await verifySovereignSession(value, secret, nowSec);
    return check.ok ? { ok: true, via: 'capsule', expiresAt: check.expiresAt } : REJECTED;
  }

  // A raw token comparison must still run in constant time, and must be
  // unreachable when the environment has no token (production with
  // SOVEREIGN_AUTH_TOKEN unset) -- "no token" can never be matched.
  if (!token) return REJECTED;
  return timingSafeEqualString(value, token)
    ? { ok: true, via: 'token', expiresAt: null }
    : REJECTED;
}

/**
 * Request-time wrapper: resolves the secret/token from the environment and
 * verifies whatever the request offered. Short-circuits to `reject` before any
 * environment read when no credential is present, so the public path costs
 * one `headers.get()`.
 */
export async function verifyMasterKeyRequest(
  headers: Headers | null | undefined,
  env: Record<string, string | undefined> = process.env,
): Promise<MasterKeyCheck> {
  const credential = readMasterCredential(headers);
  if (!credential) return REJECTED;
  return verifyMasterKey(credential, resolveSovereignSigningSecret(env), resolveSovereignToken(env));
}
