import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * THE UNITAS GLOBAL -- app-layer credential guard regression suite
 * (mission `unitas.mission.credential-guards-app-layer`, Codex ch.13 fail-closed).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `web/.env.local` has no `NEXT_PUBLIC_SUPABASE_ANON_KEY` at all, so three of
 * the four Supabase factories were ALREADY degrading before a single line of
 * this mission was written. A green local run therefore proves nothing about
 * the fix: with the key absent, a truthiness guard and a shape guard behave
 * identically. The only evidence that means anything is to INJECT the value
 * that caused the 2026-09-17 nightly-archive outage -- the literal
 * `[SENSITIVE]` that `vercel env pull` writes instead of decrypting a
 * Secret-typed variable, a NON-EMPTY string that every `||` and every
 * `if (!key)` in the repo waved through -- and then assert what each module
 * does with it.
 *
 * FOUR FACTORIES, FOUR DELIBERATELY DIFFERENT CONTRACTS. This is the part that
 * has to be pinned down, because "make them consistent" is the refactor that
 * turns a fail-closed sign-out into a global 500:
 *
 *   lib/supabase/server.ts            -> throws
 *   lib/supabase/client.ts            -> throws
 *   lib/supabase/serverComponent.ts   -> returns null   (NOT a throw: the
 *                                        (gated) layout calls it during render)
 *   lib/supabase/middlewareClient.ts  -> resolves {user:null} (NOT a throw:
 *                                        MIDDLEWARE_INVOCATION_FAILED is a 500
 *                                        on EVERY route, not a sign-out)
 *   lib/hub/hubLedger.isHubServerConfigured
 *     == lib/hub/hubChannel.isHubRealtimeConfigured -> false
 *
 * Each assertion below therefore names the DIRECTION of the degrade, not just
 * "it failed". A test that accepted any failure would be satisfied by the very
 * convergence this suite exists to prevent.
 *
 * MECHANICS. Every module here reads `process.env` at call time and three of
 * them hold module-level state (a browser-client singleton, two once-only
 * warning flags). A stale instance would make a pass meaningless, so every case
 * goes through `withEnv()`: stub the env, `vi.resetModules()`, then dynamic
 * `import()` a FRESH instance. The Supabase SDKs and `next/headers` are mocked
 * so that "took the configured path" can be asserted by inspecting the
 * arguments the factory handed the SDK -- no network, no request scope.
 *
 * NO REAL CREDENTIAL APPEARS IN THIS FILE. The fixtures are unsigned JWTs built
 * from a claims object, the same way `credentialCore.test.ts` and
 * `credentialShapeParity.test.ts` build theirs; their signatures are never
 * verified by anything under test.
 */

/* ------------------------------------------------------------------ */
/* Mocks -- hoisted above the dynamic imports they intercept.          */
/* ------------------------------------------------------------------ */

const mocks = vi.hoisted(() => {
  /** Who the mocked GoTrue reports for `auth.getUser()`. Mutable per case. */
  const session: { user: { id: string } | null } = { user: null };

  const makeChannel = () => ({
    on: vi.fn(),
    subscribe: vi.fn((cb?: (status: string) => void) => {
      cb?.('SUBSCRIBED');
    }),
    unsubscribe: vi.fn(),
    send: vi.fn(async () => 'ok'),
    track: vi.fn(async () => 'ok'),
    presenceState: vi.fn(() => ({})),
  });

  return {
    session,
    /** @supabase/supabase-js -- used by lib/supabase/server.ts */
    createClient: vi.fn(() => ({ kind: 'supabase-js' })),
    /** @supabase/ssr -- used by lib/supabase/client.ts */
    createBrowserClient: vi.fn(() => ({
      kind: 'ssr-browser',
      channel: vi.fn(() => makeChannel()),
    })),
    /** @supabase/ssr -- used by serverComponent.ts and middlewareClient.ts */
    createServerClient: vi.fn(() => ({
      kind: 'ssr-server',
      auth: {
        getUser: vi.fn(async () => ({ data: { user: session.user }, error: null })),
      },
    })),
    /** next/headers -- serverComponent.ts calls cookies() outside a request here. */
    cookies: vi.fn(() => ({ getAll: () => [], set: () => undefined })),
  };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mocks.createBrowserClient,
  createServerClient: mocks.createServerClient,
}));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const PROJECT_REF = 'fjznkonbjoierxvopiko';
const URL_OK = `https://${PROJECT_REF}.supabase.co`;

/** Build an unsigned JWT. The signature is never verified by anything here. */
function jwt(claims: Record<string, unknown>, signature = 'sig'): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.${signature}`;
}

const ANON_KEY = jwt({ iss: 'supabase', ref: PROJECT_REF, role: 'anon' });
const SERVICE_KEY = jwt({ iss: 'supabase', ref: PROJECT_REF, role: 'service_role' });

/**
 * The three placeholder families that are all non-empty strings. `[SENSITIVE]`
 * is the one that actually shipped; the other two are the scaffold values that
 * would have done the same thing on any other day.
 */
const PLACEHOLDERS = ['[SENSITIVE]', '<paste-the-project-anon-key>', 'YOUR_ANON_KEY'] as const;

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

interface EnvValues {
  url?: string;
  anon?: string;
  service?: string;
}

function setEnv({ url, anon, service }: EnvValues): void {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', anon);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', service);
}

/**
 * Stub the env, drop the module registry, then load a FRESH instance. The reset
 * is not optional: `client.ts` caches its browser client and `server.ts`,
 * `serverComponent.ts` and `middlewareClient.ts` each hold a once-only warning
 * flag, so a reused instance would answer from the previous case's env.
 */
async function withEnv<T>(env: EnvValues, load: () => Promise<T>): Promise<T> {
  setEnv(env);
  vi.resetModules();
  return load();
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.user = null;
  // Swallowed rather than printed: these modules warn on purpose, and a passing
  // run should not look like a broken one.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
  vi.unstubAllEnvs();
});

/** Every `console.warn` argument this case produced, flattened to one string. */
function warnText(): string {
  return warn.mock.calls.map((args: unknown[]) => args.map(String).join(' ')).join('\n');
}

/* ------------------------------------------------------------------ */
/* The harness itself must be honest before anything it asserts is.    */
/* ------------------------------------------------------------------ */

describe('harness', () => {
  it('actually injects the placeholder into process.env', () => {
    setEnv({ url: URL_OK, anon: '[SENSITIVE]', service: undefined });
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('[SENSITIVE]');
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(URL_OK);
    // Absent must mean absent -- `''` and `undefined` take different branches in
    // selectServerSupabaseKey (present-but-invalid vs silent fallback).
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });

  it('builds fixture keys whose role claims are what the guards will read', async () => {
    const { decodeJwtClaims } = await import('@/lib/security/credentialShape');
    expect(decodeJwtClaims(ANON_KEY)).toMatchObject({ role: 'anon', ref: PROJECT_REF });
    expect(decodeJwtClaims(SERVICE_KEY)).toMatchObject({ role: 'service_role' });
  });
});

/* ------------------------------------------------------------------ */
/* lib/supabase/server.ts -- contract: THROW                           */
/* ------------------------------------------------------------------ */

describe('lib/supabase/server.ts', () => {
  for (const placeholder of PLACEHOLDERS) {
    it(`throws when the anon key is the placeholder ${placeholder}`, async () => {
      const mod = await withEnv({ url: URL_OK, anon: placeholder }, () => import('@/lib/supabase/server'));
      expect(() => mod.getSupabaseServerClient()).toThrow();
      expect(mocks.createClient).not.toHaveBeenCalled();
    });
  }

  it('throws when the URL is a placeholder even though the anon key is good', async () => {
    const mod = await withEnv({ url: '[SENSITIVE]', anon: ANON_KEY }, () => import('@/lib/supabase/server'));
    expect(() => mod.getSupabaseServerClient()).toThrow();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('probes the failure instead of throwing, and the reasons carry no value', async () => {
    const mod = await withEnv({ url: URL_OK, anon: '[SENSITIVE]' }, () => import('@/lib/supabase/server'));
    const probe = mod.probeSupabaseServerCredentials();
    expect(probe.ok).toBe(false);
    if (probe.ok) throw new Error('unreachable');
    expect(probe.errors.join(' ')).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });

  it('uses a valid service_role key when it has one (the unchanged happy path)', async () => {
    const mod = await withEnv({ url: URL_OK, anon: ANON_KEY, service: SERVICE_KEY }, () =>
      import('@/lib/supabase/server'),
    );
    expect(mod.probeSupabaseServerCredentials()).toEqual({ ok: true, role: 'service_role' });
    mod.getSupabaseServerClient();
    expect(mocks.createClient).toHaveBeenCalledWith(URL_OK, SERVICE_KEY, expect.anything());
    expect(warnText()).toBe('');
  });

  for (const placeholder of PLACEHOLDERS) {
    it(`does not let the placeholder service key ${placeholder} beat a valid anon key`, async () => {
      const mod = await withEnv({ url: URL_OK, anon: ANON_KEY, service: placeholder }, () =>
        import('@/lib/supabase/server'),
      );
      // THE BUG: `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`
      // handed this non-empty string to PostgREST as a bearer token and every
      // call 401'd -- including spend_coins / credit_coins.
      expect(mod.probeSupabaseServerCredentials()).toEqual({ ok: true, role: 'anon' });
      mod.getSupabaseServerClient();
      expect(mocks.createClient).toHaveBeenCalledWith(URL_OK, ANON_KEY, expect.anything());
    });
  }

  it('announces the privilege downgrade once, without printing any key', async () => {
    const mod = await withEnv({ url: URL_OK, anon: ANON_KEY, service: '[SENSITIVE]' }, () =>
      import('@/lib/supabase/server'),
    );
    mod.getSupabaseServerClient();
    mod.getSupabaseServerClient();
    mod.getSupabaseServerClient();

    expect(warn).toHaveBeenCalledTimes(1);
    const text = warnText();
    expect(text).toContain('[Sovereign Shield]');
    expect(text).toContain('SUPABASE_SERVICE_ROLE_KEY');
    // describeCredential(), never the value -- of either key.
    expect(text).not.toContain(ANON_KEY);
    expect(text).not.toContain(URL_OK);
  });

  it('falls back silently when the service key is simply absent', async () => {
    const mod = await withEnv({ url: URL_OK, anon: ANON_KEY, service: undefined }, () =>
      import('@/lib/supabase/server'),
    );
    expect(mod.probeSupabaseServerCredentials()).toEqual({ ok: true, role: 'anon' });
    mod.getSupabaseServerClient();
    // Absent is the documented normal degraded mode for deployments that never
    // had a service key. Warning about it every boot would train people to
    // ignore the line that matters.
    expect(warn).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* lib/supabase/client.ts -- contract: THROW                           */
/* ------------------------------------------------------------------ */

describe('lib/supabase/client.ts', () => {
  for (const placeholder of PLACEHOLDERS) {
    it(`throws on the placeholder ${placeholder} instead of building a client that 401s`, async () => {
      const mod = await withEnv({ url: URL_OK, anon: placeholder }, () => import('@/lib/supabase/client'));
      expect(() => mod.getSupabaseBrowserClient()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
      expect(mocks.createBrowserClient).not.toHaveBeenCalled();
    });
  }

  it('rejects a service_role key pasted into the NEXT_PUBLIC slot (a leak, not a config)', async () => {
    const mod = await withEnv({ url: URL_OK, anon: SERVICE_KEY }, () => import('@/lib/supabase/client'));
    expect(() => mod.getSupabaseBrowserClient()).toThrow(/role/);
    expect(mocks.createBrowserClient).not.toHaveBeenCalled();
  });

  it('builds the client from the validated pair and reuses the singleton', async () => {
    const mod = await withEnv({ url: URL_OK, anon: ANON_KEY }, () => import('@/lib/supabase/client'));
    const first = mod.getSupabaseBrowserClient();
    const second = mod.getSupabaseBrowserClient();
    expect(mocks.createBrowserClient).toHaveBeenCalledTimes(1);
    expect(mocks.createBrowserClient).toHaveBeenCalledWith(URL_OK, ANON_KEY);
    expect(second).toBe(first);
  });

  it('does not poison the singleton when validation fails', async () => {
    const mod = await withEnv({ url: URL_OK, anon: '[SENSITIVE]' }, () => import('@/lib/supabase/client'));
    expect(() => mod.getSupabaseBrowserClient()).toThrow();
    // Same module instance, repaired env: the rejected attempt must have left
    // `browserClient` null rather than caching a half-built client.
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ANON_KEY);
    expect(() => mod.getSupabaseBrowserClient()).not.toThrow();
    expect(mocks.createBrowserClient).toHaveBeenCalledWith(URL_OK, ANON_KEY);
  });
});

/* ------------------------------------------------------------------ */
/* lib/supabase/serverComponent.ts -- contract: NULL, never a throw    */
/* ------------------------------------------------------------------ */

describe('lib/supabase/serverComponent.ts', () => {
  for (const placeholder of PLACEHOLDERS) {
    it(`returns null (never throws) on the placeholder ${placeholder}`, async () => {
      const mod = await withEnv({ url: URL_OK, anon: placeholder }, () =>
        import('@/lib/supabase/serverComponent'),
      );
      let result: unknown;
      // The (gated) layout calls this during render. A throw here is a global
      // 500 on every gated route, not a sign-out -- so the shape of the failure
      // is asserted, not merely the fact of it.
      expect(() => {
        result = mod.getSupabaseServerComponentClient();
      }).not.toThrow();
      expect(result).toBeNull();
      expect(mocks.createServerClient).not.toHaveBeenCalled();
      expect(mocks.cookies).not.toHaveBeenCalled();
    });
  }

  it('warns once per process and never prints a value', async () => {
    const mod = await withEnv({ url: URL_OK, anon: '[SENSITIVE]' }, () =>
      import('@/lib/supabase/serverComponent'),
    );
    mod.getSupabaseServerComponentClient();
    mod.getSupabaseServerComponentClient();
    mod.getSupabaseServerComponentClient();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warnText()).toContain('[Sovereign Shield]');
    expect(warnText()).not.toContain(URL_OK);
  });

  it('takes the configured path with a valid pair', async () => {
    const mod = await withEnv({ url: URL_OK, anon: ANON_KEY }, () =>
      import('@/lib/supabase/serverComponent'),
    );
    expect(mod.getSupabaseServerComponentClient()).not.toBeNull();
    expect(mocks.createServerClient).toHaveBeenCalledWith(URL_OK, ANON_KEY, expect.anything());
    expect(warn).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* lib/supabase/middlewareClient.ts -- contract: {user:null}, no throw */
/* ------------------------------------------------------------------ */

function middlewarePair(): { request: NextRequest; response: NextResponse } {
  const request = new NextRequest(new Request('https://unitas.test/ko'));
  return { request, response: NextResponse.next() };
}

describe('lib/supabase/middlewareClient.ts', () => {
  for (const placeholder of PLACEHOLDERS) {
    it(`resolves {user:null} on the placeholder ${placeholder} without opening a session`, async () => {
      const mod = await withEnv({ url: URL_OK, anon: placeholder }, () =>
        import('@/lib/supabase/middlewareClient'),
      );
      const { request, response } = middlewarePair();
      // A rejection here is MIDDLEWARE_INVOCATION_FAILED -- a 500 on EVERY
      // route, including the public ones. It must resolve.
      await expect(mod.updateSession(request, response)).resolves.toEqual({ user: null });
      // ...and degrade BEFORE the network: the old truthiness guard reached
      // GoTrue with the placeholder as a bearer token on every navigation and
      // arrived at the same `user: null` one round trip later.
      expect(mocks.createServerClient).not.toHaveBeenCalled();
    });
  }

  it('warns once per Edge isolate, not once per navigation', async () => {
    const mod = await withEnv({ url: URL_OK, anon: '[SENSITIVE]' }, () =>
      import('@/lib/supabase/middlewareClient'),
    );
    for (let i = 0; i < 4; i += 1) {
      const { request, response } = middlewarePair();
      await mod.updateSession(request, response);
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warnText()).toContain('[Sovereign Shield]');
    expect(warnText()).not.toContain(URL_OK);
  });

  it('resolves the real user with a valid pair', async () => {
    mocks.session.user = { id: 'user-fixture' };
    const mod = await withEnv({ url: URL_OK, anon: ANON_KEY }, () =>
      import('@/lib/supabase/middlewareClient'),
    );
    const { request, response } = middlewarePair();
    await expect(mod.updateSession(request, response)).resolves.toEqual({ user: { id: 'user-fixture' } });
    expect(mocks.createServerClient).toHaveBeenCalledWith(URL_OK, ANON_KEY, expect.anything());
    expect(warn).not.toHaveBeenCalled();
  });

  it('still resolves {user:null} when the SDK itself throws', async () => {
    const mod = await withEnv({ url: URL_OK, anon: ANON_KEY }, () =>
      import('@/lib/supabase/middlewareClient'),
    );
    mocks.createServerClient.mockImplementationOnce(() => {
      throw new Error('GoTrue unreachable');
    });
    const { request, response } = middlewarePair();
    await expect(mod.updateSession(request, response)).resolves.toEqual({ user: null });
  });
});

/* ------------------------------------------------------------------ */
/* lib/hub -- contract: ONE boolean under two names                    */
/* ------------------------------------------------------------------ */

describe('lib/hub/hubLedger.ts + lib/hub/hubChannel.ts', () => {
  for (const placeholder of PLACEHOLDERS) {
    it(`reports NOT configured for the placeholder ${placeholder}`, async () => {
      const { ledger, channel } = await withEnv({ url: URL_OK, anon: placeholder }, async () => ({
        ledger: await import('@/lib/hub/hubLedger'),
        channel: await import('@/lib/hub/hubChannel'),
      }));
      // REV-40's `unreadable` is not `empty`: an unusable key must fall back to
      // the device ledger, not announce that the server ledger is in force and
      // then 401.
      expect(ledger.isHubServerConfigured()).toBe(false);
      expect(channel.isHubRealtimeConfigured()).toBe(false);
      expect(channel.createHubChannel('news', 'device-1')).toBeNull();
      expect(mocks.createBrowserClient).not.toHaveBeenCalled();
    });
  }

  it('reports configured and opens the live wire with a valid pair', async () => {
    const { ledger, channel } = await withEnv({ url: URL_OK, anon: ANON_KEY }, async () => ({
      ledger: await import('@/lib/hub/hubLedger'),
      channel: await import('@/lib/hub/hubChannel'),
    }));
    expect(ledger.isHubServerConfigured()).toBe(true);
    expect(channel.isHubRealtimeConfigured()).toBe(true);

    const handle = channel.createHubChannel('news', 'device-1');
    expect(handle).not.toBeNull();
    await expect(handle?.ready).resolves.toBe(true);
  });

  it('exposes ONE function under two names, so the two answers cannot drift', async () => {
    const { ledger, channel } = await withEnv({ url: URL_OK, anon: ANON_KEY }, async () => ({
      ledger: await import('@/lib/hub/hubLedger'),
      channel: await import('@/lib/hub/hubChannel'),
    }));
    // Not "they agree today" -- the same function object. There used to be two
    // copies of `Boolean(url && anonKey)`, and two copies are how answers drift.
    expect(channel.isHubRealtimeConfigured).toBe(ledger.isHubServerConfigured);
  });
});
