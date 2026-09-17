import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import * as core from '../../scripts/credential-core.mjs';
import * as shape from '../../lib/security/credentialShape';

/**
 * The app layer and the script layer must never disagree about what a
 * credential is.
 *
 * `web/scripts/credential-core.mjs` is the pinned canon (trust registry entry
 * `unitas.credential.core`) but cannot be imported by the app: its
 * `decodeJwtClaims` uses `Buffer.from(seg, 'base64url')`, and the `buffer@6.0.3`
 * polyfill Next ships to the client and Edge bundles has no `base64url`
 * encoding -- so a CORRECT key throws there. `web/lib/security/credentialShape.ts`
 * re-implements the same contract on `atob` + `TextDecoder`.
 *
 * Two modules that drift is the exact class of bug that produced the
 * 2026-09-17 nightly-archive outage. This suite is what makes the duplication
 * safe: every fixture below is put through BOTH modules and the verdicts must
 * be identical, field for field.
 *
 * Same technique as `trustRegistryParity.test.ts`.
 */

const PROJECT_REF = 'fjznkonbjoierxvopiko';
const OTHER_REF = 'zzzzzzzzzzzzzzzzzzzz';
const URL_OK = `https://${PROJECT_REF}.supabase.co`;

/** Build an unsigned JWT. The signature is never verified by either module. */
function jwt(claims: Record<string, unknown>, signature = 'sig'): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.${signature}`;
}

const SERVICE_KEY = jwt({ iss: 'supabase', ref: PROJECT_REF, role: 'service_role' });
const ANON_KEY = jwt({ iss: 'supabase', ref: PROJECT_REF, role: 'anon' });
const FOREIGN_ANON = jwt({ iss: 'supabase', ref: OTHER_REF, role: 'anon' });
const ROLELESS = jwt({ iss: 'supabase', ref: PROJECT_REF });
const UNICODE_CLAIMS = jwt({ iss: 'supabase', ref: PROJECT_REF, role: 'anon', note: '한글·émoji·🜂' });

/**
 * Every value both modules must judge identically. Deliberately includes
 * non-strings, whitespace, all three placeholder families, malformed JWTs and
 * the base64url edge cases where Node's `Buffer` is lenient and `atob` is not.
 */
const VALUES: ReadonlyArray<unknown> = Object.freeze([
  undefined,
  null,
  '',
  '   ',
  0,
  123,
  true,
  {},
  [],
  '[SENSITIVE]',
  ' [SENSITIVE] ',
  '<paste-the-project-anon-key>',
  'sk_live_<redacted>',
  'YOUR_SUPABASE_KEY',
  'your-key-here',
  'changeme',
  'TODO',
  'replace_me',
  'xxxxxxxx',
  'xxx-not-a-placeholder',
  'abcdef',
  'https://example.com',
  URL_OK,
  `${URL_OK}/`,
  ` ${URL_OK} `,
  'http://insecure.supabase.co',
  'https://has space.supabase.co',
  'https://ref.supabase.co/rest/v1',
  SERVICE_KEY,
  ANON_KEY,
  ` ${ANON_KEY} `,
  FOREIGN_ANON,
  ROLELESS,
  UNICODE_CLAIMS,
  // JWT-shaped but undecodable / not an object payload
  'eyJhbGciOiJIUzI1NiJ9.eyJ9.sig',
  'eyJhbGciOiJIUzI1NiJ9.W10.sig', // payload is `[]` -> not an object
  'eyJhbGciOiJIUzI1NiJ9.bnVsbA.sig', // payload is `null`
  'eyJhbGciOiJIUzI1NiJ9..sig', // empty payload segment
  'eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.', // empty signature segment (allowed by the shape)
  'eyJhbGciOiJIUzI1NiJ9.eyJ9x.sig', // payload length % 4 === 1 -- Buffer drops the dangling char
  'eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQxy.sig',
  'eyJonly.two', // two segments
  'eyJ.a.b.c', // four segments
  'notjwt.notjwt.notjwt', // right arity, wrong prefix
]);

/** The option sets `validateSupabaseKey` is called with anywhere in the repo. */
const KEY_OPTS: ReadonlyArray<Record<string, unknown>> = Object.freeze([
  {},
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY' },
  { expectRole: 'service_role' },
  { expectRole: 'anon' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', expectRole: 'anon' },
  { expectRole: 'service_role', projectRef: PROJECT_REF },
  { expectRole: 'anon', projectRef: PROJECT_REF },
  { projectRef: OTHER_REF },
]);

/**
 * `credential-core.mjs` declares `@param {string} token` on `decodeJwtClaims`,
 * but its BODY opens with `if (typeof token !== 'string') return null` -- the
 * JSDoc is narrower than the implementation. We are comparing runtime behaviour
 * on hostile input, so widen the call site rather than narrow the fixtures.
 * Every other exported function already declares `@param {unknown}`.
 */
const coreDecodeJwtClaims = core.decodeJwtClaims as (token: unknown) => Record<string, unknown> | null;

/** A stable label for a fixture, so a failure names the value that broke. */
function label(v: unknown): string {
  if (typeof v !== 'string') return `${Object.prototype.toString.call(v)}:${String(v)}`;
  return v.length > 40 ? `${v.slice(0, 37)}...(${v.length})` : v;
}

describe('credentialShape.ts <-> credential-core.mjs parity', () => {
  it('matchPlaceholder agrees on every fixture', () => {
    for (const v of VALUES) {
      expect(shape.matchPlaceholder(v), label(v)).toEqual(core.matchPlaceholder(v));
    }
  });

  it('isJwtShaped agrees on every fixture', () => {
    for (const v of VALUES) {
      expect(shape.isJwtShaped(v), label(v)).toBe(core.isJwtShaped(v));
    }
  });

  it('decodeJwtClaims agrees on every fixture -- including the base64url edge cases', () => {
    for (const v of VALUES) {
      expect(shape.decodeJwtClaims(v), label(v)).toEqual(coreDecodeJwtClaims(v));
    }
  });

  it('describeCredential produces the identical loggable string', () => {
    for (const v of VALUES) {
      expect(shape.describeCredential(v), label(v)).toBe(core.describeCredential(v));
    }
  });

  it('validateSupabaseUrl returns the identical verdict', () => {
    for (const v of VALUES) {
      expect(shape.validateSupabaseUrl(v), label(v)).toEqual(core.validateSupabaseUrl(v));
    }
  });

  it('validateSupabaseKey returns the identical verdict across every option set', () => {
    for (const v of VALUES) {
      for (const opts of KEY_OPTS) {
        expect(shape.validateSupabaseKey(v, opts), `${label(v)} :: ${JSON.stringify(opts)}`).toEqual(
          core.validateSupabaseKey(v, opts),
        );
      }
    }
  });

  it('assertSupabaseCredentials returns the identical verdict for url x key pairs', () => {
    const urls = [undefined, '', '[SENSITIVE]', URL_OK, 'http://insecure.supabase.co'];
    const keys = [undefined, '', '[SENSITIVE]', SERVICE_KEY, ANON_KEY, FOREIGN_ANON];
    for (const url of urls) {
      for (const serviceKey of keys) {
        const input = { url, serviceKey, projectRef: PROJECT_REF };
        expect(shape.assertSupabaseCredentials(input), `${label(url)} + ${label(serviceKey)}`).toEqual(
          core.assertSupabaseCredentials(input),
        );
        const anonInput = { url, serviceKey, expectRole: 'anon' };
        expect(shape.assertSupabaseCredentials(anonInput), `anon ${label(url)} + ${label(serviceKey)}`).toEqual(
          core.assertSupabaseCredentials(anonInput),
        );
      }
    }
  });

  it('formatCredentialErrors renders the identical block', () => {
    for (const errors of [[], ['하나'], ['하나', '둘'], ['a'.repeat(200)]]) {
      expect(shape.formatCredentialErrors(errors)).toBe(core.formatCredentialErrors(errors));
    }
  });

  it('exports the same placeholder rule codes in the same order', () => {
    expect(shape.PLACEHOLDER_RULES.map((r) => r.code)).toEqual(
      core.PLACEHOLDER_RULES.map((r: { code: string }) => r.code),
    );
  });
});

describe('credentialShape.ts stays importable from the browser and the Edge runtime', () => {
  const SRC = readFileSync(join(__dirname, '../../lib/security/credentialShape.ts'), 'utf8');
  /** Strip comments so the prose explaining WHY Buffer is banned is not a hit. */
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('imports nothing at all -- no node: builtins, no packages', () => {
    expect(CODE).not.toMatch(/\bimport\s/);
    expect(CODE).not.toMatch(/\brequire\s*\(/);
  });

  it('never touches Buffer -- buffer@6.0.3 has no base64url encoding', () => {
    expect(CODE).not.toMatch(/\bBuffer\b/);
  });

  it('never reads process.env -- callers pass values in (purity contract)', () => {
    expect(CODE).not.toMatch(/process\s*\.\s*env/);
  });
});

describe('app-layer helpers built on the parity surface', () => {
  it('validatePublicSupabaseEnv accepts a real anon pair', () => {
    const v = shape.validatePublicSupabaseEnv(URL_OK, ANON_KEY);
    expect(v.ok).toBe(true);
    expect(v.ok && v.anonKey).toBe(ANON_KEY);
  });

  it('validatePublicSupabaseEnv rejects the placeholder that passed every truthiness check', () => {
    const v = shape.validatePublicSupabaseEnv(URL_OK, '[SENSITIVE]');
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.errors.join(' ')).toContain('자리표시자');
  });

  it('validatePublicSupabaseEnv rejects a service_role key handed to the browser', () => {
    const v = shape.validatePublicSupabaseEnv(URL_OK, SERVICE_KEY);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.errors.join(' ')).toContain('role');
  });

  it('selectServerSupabaseKey prefers a valid service_role key, with nothing to warn about', () => {
    const v = shape.selectServerSupabaseKey(URL_OK, SERVICE_KEY, ANON_KEY);
    expect(v).toEqual({ ok: true, url: URL_OK, key: SERVICE_KEY, role: 'service_role', warnings: [] });
  });

  it('THE OUTAGE: a placeholder service key no longer beats a valid anon key', () => {
    const v = shape.selectServerSupabaseKey(URL_OK, '[SENSITIVE]', ANON_KEY);
    expect(v.ok).toBe(true);
    expect(v.ok === true && { url: v.url, key: v.key, role: v.role }).toEqual({
      url: URL_OK,
      key: ANON_KEY,
      role: 'anon',
    });
  });

  it('the privilege downgrade is LOUD -- the rejected service key travels in warnings', () => {
    const v = shape.selectServerSupabaseKey(URL_OK, '[SENSITIVE]', ANON_KEY);
    expect(v.ok === true && v.warnings).toHaveLength(1);
    expect(v.ok === true && v.warnings[0]).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(v.ok === true && v.warnings[0]).toContain('자리표시자');
    // The reason describes the credential; it never contains it.
    expect(v.ok === true && v.warnings.join(' ')).not.toContain(ANON_KEY);
  });

  it('but an ABSENT service key falls back SILENTLY -- that is the normal degraded mode', () => {
    expect(shape.selectServerSupabaseKey(URL_OK, undefined, ANON_KEY)).toEqual({
      ok: true,
      url: URL_OK,
      key: ANON_KEY,
      role: 'anon',
      warnings: [],
    });
    expect(shape.selectServerSupabaseKey(URL_OK, '   ', ANON_KEY)).toEqual({
      ok: true,
      url: URL_OK,
      key: ANON_KEY,
      role: 'anon',
      warnings: [],
    });
  });

  it('reports BOTH failures when neither key is usable', () => {
    const v = shape.selectServerSupabaseKey(URL_OK, '[SENSITIVE]', '<paste-the-project-anon-key>');
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.errors).toHaveLength(2);
  });

  it('fails when the URL is a placeholder even with two good keys', () => {
    const v = shape.selectServerSupabaseKey('[SENSITIVE]', SERVICE_KEY, ANON_KEY);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.errors.join(' ')).toContain('NEXT_PUBLIC_SUPABASE_URL');
  });
});
