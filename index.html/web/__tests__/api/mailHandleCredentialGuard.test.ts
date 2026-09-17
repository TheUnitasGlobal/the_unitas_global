import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * THE ROUTE THAT BLAMED THE VISITOR.
 *
 * Mission spec §3.3 calls `POST /api/mail/handle/claim` the only file in the
 * credential-guard sweep that returned a WRONG STATUS CODE to a real user:
 *
 *   `if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 503` passed for a
 *   placeholder (a non-empty string), a live admin client was built, GoTrue
 *   answered 401 to `getUser`, `userError` was set, and the route replied
 *   401 "not authenticated" -- telling the visitor their token was bad when
 *   the server's own configuration was.
 *
 * Its docblock had promised 503 ("ledger unreachable") for that case all along.
 * Nothing tested it. This file is that test, plus the sibling GET route's
 * quieter defect: a doomed round trip on every keystroke of the typeahead.
 *
 * Harness mirrors `__tests__/security/credentialGuardsAppLayer.test.ts` --
 * `vi.stubEnv` + `vi.resetModules()` + dynamic import, because both routes read
 * the env through a factory that caches a once-only warning flag.
 */

const mocks = vi.hoisted(() => ({
  /** Whether the mocked GoTrue accepts the bearer token. Mutable per case. */
  getUserResult: {
    data: { user: null as { id: string; user_metadata?: Record<string, unknown> } | null },
    error: null as { message: string } | null,
  },
  createClient: vi.fn(() => ({
    kind: 'supabase-js',
    auth: {
      getUser: vi.fn(async () => mocks.getUserResult),
      admin: { updateUserById: vi.fn(async () => ({ data: null, error: null })) },
    },
  })),
  /** Records what the route decided to hand the ledger: a client, or null. */
  handleAvailability: vi.fn(async (admin: unknown) => (admin ? 'available' : 'unchecked')),
  claimHandle: vi.fn(async () => 'claimed'),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

/**
 * The ledger seam is faked so the assertions are about the ROUTE's credential
 * decision, not about PostgREST. `handleAvailability`'s real body is one line
 * (`if (!admin) return 'unchecked'`), and it is exercised by its own suite.
 */
vi.mock('@/lib/auth/mailHandleServer', () => ({
  handleAvailability: mocks.handleAvailability,
  claimHandle: mocks.claimHandle,
  mailHandleAddress: (h: string) => `${h}@theunitas.global`,
  probeAllowed: () => true,
}));

const PROJECT_REF = 'fjznkonbjoierxvopiko';
const URL_OK = `https://${PROJECT_REF}.supabase.co`;

function jwt(claims: Record<string, unknown>, signature = 'sig'): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.${signature}`;
}

const ANON_KEY = jwt({ iss: 'supabase', ref: PROJECT_REF, role: 'anon' });
const SERVICE_KEY = jwt({ iss: 'supabase', ref: PROJECT_REF, role: 'service_role' });

/** All three are non-empty strings -- which is why truthiness missed them. */
const PLACEHOLDERS = ['[SENSITIVE]', '<paste-the-project-anon-key>', 'YOUR_SERVICE_KEY'] as const;

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // These routes warn on purpose; a passing run should stay quiet.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  mocks.getUserResult.data.user = null;
  mocks.getUserResult.error = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
  warn.mockRestore();
});

function warnText(): string {
  return warn.mock.calls.map((args: unknown[]) => args.map(String).join(' ')).join('\n');
}

async function loadRoute<T>(
  specifier: string,
  env: { url?: string; anon?: string; service?: string },
): Promise<T> {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', env.url);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', env.anon);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', env.service);
  vi.resetModules();
  return (await import(specifier)) as T;
}

type ClaimRoute = { POST: (req: Request) => Promise<Response> };
type CheckRoute = { GET: (req: Request) => Promise<Response> };

const claimRequest = (token = 'visitor-access-token') =>
  new Request('https://www.theunitas.global/api/mail/handle/claim', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

const checkRequest = (handle: string) =>
  new Request(`https://www.theunitas.global/api/mail/handle?handle=${encodeURIComponent(handle)}`);

/* ------------------------------------------------------------------ */
/* POST /api/mail/handle/claim -- contract: 503 when the ledger is      */
/* unreachable, 401 only when the VISITOR's token is bad                */
/* ------------------------------------------------------------------ */

describe('POST /api/mail/handle/claim -- credential guard', () => {
  for (const placeholder of PLACEHOLDERS) {
    it(`answers 503 (not 401) when the service key is the placeholder ${placeholder}`, async () => {
      const mod = await loadRoute<ClaimRoute>('@/app/api/mail/handle/claim/route', {
        url: URL_OK,
        anon: ANON_KEY,
        service: placeholder,
      });

      const res = await mod.POST(claimRequest());

      // The regression: this used to be 401 "not authenticated".
      expect(res.status).toBe(503);
      expect(res.status).not.toBe(401);
      expect(await res.json()).toEqual({ ok: false, status: 'error' });
      // And it never even built a client -- no doomed GoTrue round trip.
      expect(mocks.createClient).not.toHaveBeenCalled();
    });
  }

  it('answers 503 when the service key is absent entirely, even though an anon key would resolve', async () => {
    // probeSupabaseServerCredentials() would answer {ok:true, role:'anon'} here.
    // An anon client cannot drive auth.admin.updateUserById, so "the factory
    // works" is not the same question as "this route can proceed".
    const mod = await loadRoute<ClaimRoute>('@/app/api/mail/handle/claim/route', {
      url: URL_OK,
      anon: ANON_KEY,
      service: undefined,
    });

    const res = await mod.POST(claimRequest());
    expect(res.status).toBe(503);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('answers 503 when the URL is a placeholder but the service key is genuine', async () => {
    const mod = await loadRoute<ClaimRoute>('@/app/api/mail/handle/claim/route', {
      url: '[SENSITIVE]',
      anon: ANON_KEY,
      service: SERVICE_KEY,
    });

    const res = await mod.POST(claimRequest());
    expect(res.status).toBe(503);
  });

  it('still answers 401 when the credentials are GOOD and the VISITOR token is bad', async () => {
    mocks.getUserResult.error = { message: 'invalid JWT' };

    const mod = await loadRoute<ClaimRoute>('@/app/api/mail/handle/claim/route', {
      url: URL_OK,
      anon: ANON_KEY,
      service: SERVICE_KEY,
    });

    const res = await mod.POST(claimRequest());

    // 401 is now reserved for what it actually means.
    expect(res.status).toBe(401);
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });

  it('still answers 401 when no Authorization header is sent at all', async () => {
    const mod = await loadRoute<ClaimRoute>('@/app/api/mail/handle/claim/route', {
      url: URL_OK,
      anon: ANON_KEY,
      service: SERVICE_KEY,
    });

    const res = await mod.POST(claimRequest(''));
    expect(res.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('reaches the ledger normally when everything is valid', async () => {
    mocks.getUserResult.data.user = { id: 'user-1', user_metadata: { unitas_mail_handle: 'kai' } };

    const mod = await loadRoute<ClaimRoute>('@/app/api/mail/handle/claim/route', {
      url: URL_OK,
      anon: ANON_KEY,
      service: SERVICE_KEY,
    });

    const res = await mod.POST(claimRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: 'claimed', handle: 'kai' });
    expect(mocks.claimHandle).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ */
/* GET /api/mail/handle -- contract: status codes DO NOT MOVE.          */
/* The fix is the mechanism: null where the code documents null.        */
/* ------------------------------------------------------------------ */

describe('GET /api/mail/handle -- credential guard', () => {
  it('hands the ledger null (no round trip) when the service key is a placeholder', async () => {
    const mod = await loadRoute<CheckRoute>('@/app/api/mail/handle/route', {
      url: URL_OK,
      anon: ANON_KEY,
      service: '[SENSITIVE]',
    });

    const res = await mod.GET(checkRequest('kai'));

    // The status code deliberately does NOT move: the visitor's handle is
    // not at fault, so an unreadable ledger is still an honest 200/unchecked.
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, handle: 'kai', availability: 'unchecked' });
    // The mechanism that changed: null is passed where the code documents null.
    expect(mocks.handleAvailability).toHaveBeenCalledWith(null, 'kai');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('hands the ledger a real client when the service key is genuine', async () => {
    const mod = await loadRoute<CheckRoute>('@/app/api/mail/handle/route', {
      url: URL_OK,
      anon: ANON_KEY,
      service: SERVICE_KEY,
    });

    const res = await mod.GET(checkRequest('kai'));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ availability: 'available' });
    expect(mocks.handleAvailability).not.toHaveBeenCalledWith(null, 'kai');
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });

  it('warns once per process, not once per keystroke, and never prints a value', async () => {
    const mod = await loadRoute<CheckRoute>('@/app/api/mail/handle/route', {
      url: URL_OK,
      anon: ANON_KEY,
      service: '[SENSITIVE]',
    });

    await mod.GET(checkRequest('kai'));
    await mod.GET(checkRequest('rin'));
    await mod.GET(checkRequest('sol'));

    expect(warn).toHaveBeenCalledTimes(1);
    const text = warnText();
    expect(text).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(text).not.toContain(ANON_KEY);
    expect(text).not.toContain(SERVICE_KEY);
    expect(text).not.toContain(URL_OK);
  });

  it('rejects a malformed handle before any credential work happens', async () => {
    const mod = await loadRoute<CheckRoute>('@/app/api/mail/handle/route', {
      url: URL_OK,
      anon: ANON_KEY,
      service: '[SENSITIVE]',
    });

    const res = await mod.GET(checkRequest('!!'));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(mocks.handleAvailability).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
