import { NextResponse } from 'next/server';
import {
  bucketForScore,
  isValidUShieldNonce,
  mintUShieldToken,
  resolveUShieldSecret,
} from '@/lib/security/uShieldServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * U-Shield attestation endpoint (REV-13 spec §6 + §10 items 15-16).
 *
 * The client (`attestUSignature()` in lib/security/uSignature.ts) has already
 * scored its own behaviour and only reaches this route when that score
 * clears the floor -- the raw pointer/keyboard telemetry never leaves the
 * browser, only the derived `{ score, signals }` do. This route therefore
 * cannot re-derive the behaviour independently; its authority is:
 *   1. a per-IP sliding-window rate limit, so a script cannot mint tokens in
 *      bulk even with a spoofed high score;
 *   2. strict shape/range validation of the reported score, nonce and
 *      timestamp (replay of a stale `ts` is rejected);
 *   3. minting the actual token, whose HMAC only this server can produce
 *      (lib/security/uShieldServer.ts, domain-separated from the founder
 *      session -- see that file's header comment).
 *
 * FAIL-CLOSED: a missing signing secret, a malformed body, or a mint failure
 * all resolve to `{ ok: false, ... }` -- never `{ ok: true }` by omission.
 * Request bodies are never logged (they carry a per-visitor nonce).
 */

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 30;
/** How far a client `ts` may drift from server time before it's a replay. */
const TS_SKEW_MS = 120_000;
/** Hard cap on tracked IPs -- Low-Memory Armor; oldest-first eviction on overflow. */
const RATE_LIMIT_MAX_KEYS = 5000;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

/**
 * In-module sliding-window counter keyed by the first `x-forwarded-for` hop
 * (the caller's real IP behind Vercel's edge proxy). A plain `Map` is fine
 * here: this route runs on a single Node lambda instance, resets on every
 * cold start, and the entry set is bounded below.
 */
const hits = new Map<string, number[]>();

function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first && first.length > 0 ? first : 'unknown';
}

/** True when `key` has already used its 30-requests-per-minute budget. */
function isRateLimited(key: string, now: number): boolean {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (recent.length >= RATE_LIMIT_MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > RATE_LIMIT_MAX_KEYS) {
    for (const [k, timestamps] of hits) {
      if (timestamps.every((t) => t <= windowStart)) hits.delete(k);
    }
  }
  return false;
}

interface AttestRequestBody {
  score?: unknown;
  signals?: unknown;
  nonce?: unknown;
  ts?: unknown;
}

function badRequest(reason: string) {
  return NextResponse.json({ ok: false, reason }, { status: 400, headers: NO_STORE });
}

/** GET is not part of the contract; Next answers 405 for any unexported verb, this just makes the intent explicit. */
export function GET() {
  return NextResponse.json({ ok: false, reason: 'method_not_allowed' }, { status: 405, headers: NO_STORE });
}

export async function POST(req: Request): Promise<NextResponse> {
  const now = Date.now();
  const key = clientKey(req);
  if (isRateLimited(key, now)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429, headers: NO_STORE });
  }

  // Fail-closed configuration check BEFORE touching the body: an
  // unconfigured secret must never be reachable via a crafted request.
  const secret = resolveUShieldSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'unconfigured' }, { status: 503, headers: NO_STORE });
  }

  let body: AttestRequestBody;
  try {
    body = (await req.json()) as AttestRequestBody;
  } catch {
    return badRequest('bad_request');
  }

  const score = typeof body.score === 'number' && Number.isFinite(body.score) ? body.score : NaN;
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    return badRequest('bad_score');
  }

  const ts = typeof body.ts === 'number' && Number.isFinite(body.ts) ? body.ts : NaN;
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TS_SKEW_MS) {
    return badRequest('bad_ts');
  }

  if (!isValidUShieldNonce(body.nonce)) {
    return badRequest('bad_nonce');
  }
  const nonce = body.nonce;

  const bucket = bucketForScore(score);
  if (!bucket) {
    // Below the floor: a syntactically valid request that simply does not
    // qualify. Not a rate-limit or configuration failure, so 403 rather
    // than 429/503/500 -- still `ok: false`, never a token.
    return NextResponse.json({ ok: false, reason: 'low_score' }, { status: 403, headers: NO_STORE });
  }

  try {
    const minted = await mintUShieldToken(bucket, nonce, { secret, now });
    return NextResponse.json(
      { ok: true, token: minted.token, expiresAt: minted.expiresAt },
      { status: 200, headers: NO_STORE },
    );
  } catch {
    return NextResponse.json({ ok: false, reason: 'mint_failed' }, { status: 500, headers: NO_STORE });
  }
}
