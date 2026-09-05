import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
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
 * DELETE -> clears both cookies (founder "sign out" from the debug panel).
 */
export async function GET() {
  const value = cookies().get(SOVEREIGN_SESSION_COOKIE)?.value;
  const { ok, expiresAt } = await verifySovereignSession(value, resolveSovereignSigningSecret());
  return NextResponse.json(
    { founder: ok, expiresAt: ok ? expiresAt : null },
    { headers: NO_STORE },
  );
}

export async function DELETE() {
  const response = NextResponse.json({ founder: false, expiresAt: null }, { headers: NO_STORE });
  response.cookies.set(SOVEREIGN_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  response.cookies.set(SOVEREIGN_HINT_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
