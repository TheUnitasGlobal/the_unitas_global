import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { selectServerSupabaseKey, type ServerKeyRole } from '@/lib/security/credentialShape';

// Server-only by convention: import this from Route Handlers / Server
// Actions alone. (The `server-only` package would enforce this at build
// time, but it isn't part of this scaffold's dependency list.)

/**
 * Read the env and let `selectServerSupabaseKey` decide. The reads stay
 * literal `process.env.X` member accesses because that is the form Next's
 * build-time inliner recognises; the validator itself is deliberately
 * env-free (and therefore testable) and takes the values as arguments.
 *
 * The resolved key never leaves this module -- `getSupabaseServerClient`
 * hands it straight to `createClient`, and the exported probe below drops it.
 */
function resolveServerCredentials() {
  return selectServerSupabaseKey(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Which key this factory would use -- never the key itself. */
export type SupabaseServerKeyProbe =
  | { ok: true; role: ServerKeyRole }
  | { ok: false; errors: string[] };

/**
 * Ask which credential this factory WOULD resolve, without building a client
 * and without throwing.
 *
 * It exists because callers were asking that question the wrong way:
 * `process.env.SUPABASE_SERVICE_ROLE_KEY ? getSupabaseServerClient() : null`
 * is the same truthiness test that let a placeholder win the fallback below,
 * and a caller that needs the privileged `auth.admin` surface cannot tell
 * "no service key" from "a service key that will 401" by reading the env.
 * `role === 'service_role'` is the honest form of that question; `ok:false`
 * means this factory would throw, and `errors` says why in words that carry
 * `describeCredential()` output (shape, length, role claim) and never a value.
 */
export function probeSupabaseServerCredentials(): SupabaseServerKeyProbe {
  const choice = resolveServerCredentials();
  return choice.ok ? { ok: true, role: choice.role } : { ok: false, errors: choice.errors };
}

/**
 * A PRESENT BUT INVALID service key now loses the fallback to a valid anon
 * key -- which is the fix -- but losing it costs privilege, and the RLS-
 * bypassing RPCs this module exists to carry (spend_coins, credit_coins) are
 * then refused by POLICY, which reads like a migration bug rather than a
 * credential bug. So `selectServerSupabaseKey` returns the rejected key's
 * reason in `warnings` on the successful verdict and this function announces
 * it. The reason is NOT re-derived here: a second call to the validator would
 * be a second copy of the rule, and two copies drifting is precisely the
 * failure this whole mission removes.
 *
 * Once per process: `getSupabaseServerClient` is called on nearly every
 * privileged request and this must never become a per-request log. Never
 * carries a credential value (see describeCredential).
 */
let downgradeWarned = false;

function warnServiceKeyDowngradeOnce(warnings: string[]): void {
  // Empty is the silent, documented case: no service key was configured at
  // all. A non-empty warnings array means one WAS configured and lost the
  // fallback on shape -- that is the only thing worth a log line.
  if (!warnings.length || downgradeWarned) return;
  downgradeWarned = true;
  try {
    console.warn(
      `[Sovereign Shield] privileged Supabase client downgraded to the anon key :: ${warnings.join(' | ')} -- RLS-bypassing RPCs (spend_coins/credit_coins) will now be refused by policy.`,
    );
  } catch {
    // A diagnostic may never be the reason a request fails.
  }
}

/**
 * Server-side Supabase client for Route Handlers / Server Actions. Uses the
 * service role key when present (privileged, bypasses RLS -- required for
 * things like the spend_coins/credit_coins RPCs called from trusted server
 * code) and falls back to the anon key otherwise.
 *
 * THE FALLBACK IS DECIDED BY SHAPE, NOT BY TRUTHINESS. It used to read
 * `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`, and a
 * placeholder service key is a non-empty string -- `[SENSITIVE]`, which
 * `vercel env pull` writes for Secret-typed variables, or `<paste-the-...>`
 * from .env.example. It won the `||`, a perfectly good anon key never got a
 * chance, and the placeholder went to PostgREST as a bearer token: every call
 * 401'd, including the spend_coins / credit_coins RPCs this module exists to
 * carry. So `selectServerSupabaseKey` validates first and chooses second:
 *   - a VALID service_role key wins (the unchanged happy path);
 *   - an ABSENT service key falls back to the anon key silently -- that is the
 *     normal degraded mode for deployments that never had one;
 *   - a service key that is PRESENT BUT INVALID is no longer a candidate; a
 *     valid anon key then rescues the call, and `warnServiceKeyDowngradeOnce`
 *     below says so, because that rescue costs privilege.
 *
 * THROWING REMAINS THIS MODULE'S CONTRACT. The four Supabase factories
 * document deliberately different ones -- this file and client.ts throw,
 * serverComponent.ts returns null, middlewareClient.ts returns {user:null} --
 * and converging them would turn a fail-closed logout into a global 500.
 * Callers that can degrade already wrap this call in try/catch.
 *
 * The validator is the ISOMORPHIC `lib/security/credentialShape`, never
 * `web/scripts/credential-core.mjs`: the .mjs decodes claims through
 * `Buffer.from(seg, 'base64url')`, which the buffer@6.0.3 polyfill Next
 * bundles for the browser and Edge does not implement, so it throws on
 * CORRECT keys there. This file is Node-only today, but importing the .mjs
 * would leave a second copy of the rules one refactor away from those
 * bundles; the parity test is what keeps the single module honest.
 *
 * This is intentionally the plain @supabase/supabase-js client rather than
 * @supabase/ssr's cookie-synced server client: that package isn't part of
 * this scaffold's dependency list. Add it if/when this app needs
 * cookie-based session reads in Server Components (e.g. to know who's
 * signed in during SSR) rather than only privileged server-side calls.
 */
export function getSupabaseServerClient(): SupabaseClient {
  const choice = resolveServerCredentials();

  if (!choice.ok) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY are not usable (see .env.example): ${choice.errors.join(' | ')}`,
    );
  }

  warnServiceKeyDowngradeOnce(choice.warnings);

  return createClient(choice.url, choice.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next.js patches the global fetch with its Data Cache, which memoizes
    // GET responses by URL -- and every PostgREST select is a GET whose URL
    // repeats verbatim across requests. Left alone, a route handler can be
    // served a minutes-old (or hours-old) row set as if it were live; the
    // shortcut-cache batch was re-synthesizing every tier on every run
    // because its scan kept seeing the first deploy's near-empty table.
    // Privileged DB reads must always hit Postgres.
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
