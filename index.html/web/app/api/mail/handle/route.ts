import { NextResponse } from 'next/server';
import { getSupabaseServerClient, probeSupabaseServerCredentials } from '@/lib/supabase/server';
import { handleAvailability, mailHandleAddress, probeAllowed } from '@/lib/auth/mailHandleServer';
import { normalizeHandle, validateHandle, type HandleCheckResponse } from '@/lib/auth/unitasHandle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

function respond(body: HandleCheckResponse, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * One line per server process, never per keystroke: a misconfigured ledger is
 * a standing condition, not an event. The reason string comes from the server
 * factory's own credential probe, which describes a credential without ever
 * containing it (see `describeCredential`), so this is safe in any log sink.
 */
let warnedLedgerOffline = false;
function warnLedgerOfflineOnce(reason: string) {
  if (warnedLedgerOffline) return;
  warnedLedgerOffline = true;
  console.warn(`Mail handle ledger offline -- availability stays "unchecked": ${reason}`);
}

/**
 * GET /api/mail/handle?handle=kai
 *
 * REV-19 follow-up: live availability of a `@theunitas.global` handle
 * while the visitor types it into the sign-up form. Format + reserved
 * rules are the pure `validateHandle`; uniqueness is the service-role
 * ledger (lib/auth/mailHandleServer.ts). Never cached, lightly rate
 * limited per client. With no ledger reachable the answer is honest:
 * `unchecked` (the claim at sign-in re-checks atomically).
 *
 * `admin` is null EXACTLY when the ledger cannot be read, which is what
 * `handleAvailability(null, ...)` is written for -- it short-circuits to
 * `unchecked` without a request. That only held while the service-role key
 * was absent; a PLACEHOLDER key (`[SENSITIVE]`, `<paste-the-...>`) is a
 * non-empty string, so the truthiness check put a live client here instead
 * and every keystroke of the typeahead paid for a round trip that PostgREST
 * was always going to answer 401. Shape validation restores the documented
 * null. The status code does not move: an unreadable ledger is still
 * 200 + `unchecked`, because the visitor's handle is not at fault.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('handle') ?? '';
  const handle = normalizeHandle(raw).slice(0, 64);
  const verdict = validateHandle(handle);
  if (verdict !== 'ok') return respond({ ok: true, handle, verdict });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'anon';
  if (!probeAllowed(ip)) {
    return respond({ ok: false, handle, verdict, availability: 'unchecked', address: mailHandleAddress(handle) }, 429);
  }

  // Uniqueness is a service-role read. An anon client would not fail loudly
  // here -- it would return a WRONG answer through RLS -- so anything other
  // than a resolved service_role key means the ledger is unreadable and the
  // honest reply stays `unchecked`. Asking the factory (rather than re-reading
  // process.env here) keeps ONE expression of the rule: a second copy is what
  // produced the 2026-09-17 outage.
  const probe = probeSupabaseServerCredentials();
  let admin: ReturnType<typeof getSupabaseServerClient> | null = null;
  if (probe.ok && probe.role === 'service_role') {
    try {
      admin = getSupabaseServerClient();
    } catch {
      admin = null;
    }
  } else {
    warnLedgerOfflineOnce(
      probe.ok
        ? `SUPABASE_SERVICE_ROLE_KEY did not resolve -- the server factory fell back to role=${probe.role}`
        : probe.errors.join(' | '),
    );
  }
  const availability = await handleAvailability(admin, handle);
  return respond({ ok: true, handle, verdict, availability, address: mailHandleAddress(handle) });
}
