import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyMasterKeyRequest } from '@/lib/sovereign/masterKey';
import {
  SOVEREIGN_HINT_COOKIE,
  SOVEREIGN_SESSION_COOKIE,
  resolveSovereignSigningSecret,
  verifySovereignSession,
} from '@/lib/sovereignAuth';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

/**
 * GET  -> `{ founder: boolean, expiresAt: number | null }` -- the ONLY way
 *         client code learns it is running for the verified founder. Reads
 *         the HttpOnly signed session cookie minted by middleware.ts and
 *         re-verifies the HMAC + expiry server-side on every call. Public,
 *         cheap, never cached, and leaks nothing but a boolean.
 *
 *         REV-24 MISSION 2: it also accepts the covert `x-unitas-signature`
 *         master key, so this doubles as the founder's PING -- a machine with
 *         no cookie jar can ask "is my key still good, and when does it
 *         expire?" in one request. The cookie is tried first; the key is only
 *         consulted when the cookie did not already answer, so nothing about
 *         the public path changes.
 * DELETE -> clears both cookies (founder "sign out" from the debug panel).
 */
export async function GET() {
  const value = cookies().get(SOVEREIGN_SESSION_COOKIE)?.value;
  const session = await verifySovereignSession(value, resolveSovereignSigningSecret());
  if (session.ok) {
    return NextResponse.json({ founder: true, expiresAt: session.expiresAt }, { headers: NO_STORE });
  }
  const key = await verifyMasterKeyRequest(headers());
  return NextResponse.json(
    { founder: key.ok, expiresAt: key.ok ? key.expiresAt : null },
    { headers: NO_STORE },
  );
}

export async function DELETE() {
  const response = NextResponse.json({ founder: false, expiresAt: null }, { headers: NO_STORE });
  response.cookies.set(SOVEREIGN_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  response.cookies.set(SOVEREIGN_HINT_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
