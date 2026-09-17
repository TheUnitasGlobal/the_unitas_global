import { describe, expect, it } from 'vitest';

import {
  assertSupabaseCredentials,
  decodeJwtClaims,
  describeCredential,
  formatCredentialErrors,
  isJwtShaped,
  matchPlaceholder,
  validateSupabaseKey,
  validateSupabaseUrl,
} from '../../scripts/credential-core.mjs';

/**
 * Regression suite for the 2026-09-17 nightly-archive outage.
 *
 * `vercel env pull` does not decrypt Secret-typed variables -- it writes the
 * literal string `[SENSITIVE]`. Every credential guard in the repo was a
 * truthiness test, and `[SENSITIVE]` is a non-empty string, so it reached
 * PostgREST as a bearer token and the daemon died on an opaque 401.
 *
 * The invariant these tests protect: presence is not validity.
 */

const PROJECT_REF = 'fjznkonbjoierxvopiko';
const URL = `https://${PROJECT_REF}.supabase.co`;

/** Build an unsigned JWT with the given claims. Signature is never verified. */
function jwt(claims: Record<string, unknown>, signature = 'sig'): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.${signature}`;
}

const SERVICE_KEY = jwt({ iss: 'supabase', ref: PROJECT_REF, role: 'service_role' });
const ANON_KEY = jwt({ iss: 'supabase', ref: PROJECT_REF, role: 'anon' });

describe('matchPlaceholder', () => {
  it('catches the Vercel Secret-type placeholder that caused the outage', () => {
    expect(matchPlaceholder('[SENSITIVE]')?.code).toBe('placeholder-vercel-secret');
  });

  it('catches the .env.example angle-bracket convention', () => {
    expect(matchPlaceholder('<paste-the-project-anon-key>')?.code).toBe('placeholder-angle-bracket');
  });

  it('catches scaffold defaults', () => {
    for (const v of ['YOUR_KEY_HERE', 'your-service-role-key', 'changeme', 'TODO', 'xxxxx']) {
      expect(matchPlaceholder(v), v).not.toBeNull();
    }
  });

  it('does not flag a real key or a real URL', () => {
    expect(matchPlaceholder(SERVICE_KEY)).toBeNull();
    expect(matchPlaceholder(URL)).toBeNull();
  });

  it('returns null for empty and non-string input rather than throwing', () => {
    expect(matchPlaceholder('')).toBeNull();
    expect(matchPlaceholder('   ')).toBeNull();
    expect(matchPlaceholder(undefined)).toBeNull();
    expect(matchPlaceholder(42)).toBeNull();
  });
});

describe('isJwtShaped / decodeJwtClaims', () => {
  it('accepts a three-segment token and decodes its claims', () => {
    expect(isJwtShaped(SERVICE_KEY)).toBe(true);
    expect(decodeJwtClaims(SERVICE_KEY)).toMatchObject({ role: 'service_role', ref: PROJECT_REF });
  });

  it('rejects the placeholder, which has zero segments', () => {
    expect(isJwtShaped('[SENSITIVE]')).toBe(false);
    expect(decodeJwtClaims('[SENSITIVE]')).toBeNull();
  });

  it('rejects a token with the wrong segment count', () => {
    expect(isJwtShaped('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYSJ9')).toBe(false);
    expect(decodeJwtClaims('a.b.c.d')).toBeNull();
  });

  it('returns null for an undecodable payload instead of throwing', () => {
    expect(decodeJwtClaims('eyJhbGciOiJIUzI1NiJ9.!!!notbase64!!!.sig')).toBeNull();
  });

  it('returns null when the payload decodes to a non-object', () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    expect(decodeJwtClaims(`${b64({ alg: 'HS256' })}.${b64([1, 2, 3])}.sig`)).toBeNull();
  });
});

describe('validateSupabaseUrl', () => {
  it('accepts a project URL and strips the trailing slash', () => {
    const v = validateSupabaseUrl(`${URL}/`);
    expect(v).toEqual({ ok: true, value: URL });
  });

  it('rejects the placeholder with a code naming the cause', () => {
    const v = validateSupabaseUrl('[SENSITIVE]');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('placeholder-vercel-secret');
  });

  it('rejects an unset value', () => {
    const v = validateSupabaseUrl('');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('missing');
  });

  it('rejects plain http and non-URL junk', () => {
    for (const bad of ['http://x.supabase.co', 'fjznkonbjoierxvopiko', 'https://has space']) {
      const v = validateSupabaseUrl(bad);
      expect(v.ok, bad).toBe(false);
      if (!v.ok) expect(v.code).toBe('malformed-url');
    }
  });
});

describe('validateSupabaseKey', () => {
  it('accepts a service_role key', () => {
    const v = validateSupabaseKey(SERVICE_KEY, { expectRole: 'service_role' });
    expect(v.ok).toBe(true);
  });

  it('rejects the placeholder', () => {
    const v = validateSupabaseKey('[SENSITIVE]');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('placeholder-vercel-secret');
  });

  it('rejects a non-JWT string that a truthiness check would accept', () => {
    const v = validateSupabaseKey('definitely-a-key-honest');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('not-jwt');
  });

  it('rejects an anon key handed in where service_role is required', () => {
    const v = validateSupabaseKey(ANON_KEY, { expectRole: 'service_role' });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.code).toBe('wrong-role');
      expect(v.message).toContain('anon');
    }
  });

  it("rejects another project's key", () => {
    const foreign = jwt({ ref: 'someotherprojectref', role: 'service_role' });
    const v = validateSupabaseKey(foreign, { expectRole: 'service_role', projectRef: PROJECT_REF });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('wrong-project');
  });

  it('names the variable in the message so the operator knows which one to fix', () => {
    const v = validateSupabaseKey('', { name: 'SUPABASE_ANON_KEY' });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toContain('SUPABASE_ANON_KEY');
  });
});

describe('assertSupabaseCredentials', () => {
  it('passes a well-formed pair through', () => {
    const v = assertSupabaseCredentials({ url: URL, serviceKey: SERVICE_KEY, projectRef: PROJECT_REF });
    expect(v).toEqual({ ok: true, url: URL, serviceKey: SERVICE_KEY });
  });

  it('reproduces the outage: both values placeholder-poisoned, both reported', () => {
    const v = assertSupabaseCredentials({ url: '[SENSITIVE]', serviceKey: '[SENSITIVE]' });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors).toHaveLength(2);
      expect(v.errors.join('\n')).toContain('vercel env pull');
    }
  });

  it('reproduces the exact outage shape: good URL, placeholder key', () => {
    const v = assertSupabaseCredentials({ url: URL, serviceKey: '[SENSITIVE]' });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors).toHaveLength(1);
      expect(v.errors[0]).toContain('SUPABASE_SERVICE_ROLE_KEY');
    }
  });

  it('defaults to requiring service_role, so an anon key cannot slip in', () => {
    const v = assertSupabaseCredentials({ url: URL, serviceKey: ANON_KEY });
    expect(v.ok).toBe(false);
  });

  it('honours an explicit expectRole override for anon-key callers', () => {
    const v = assertSupabaseCredentials({ url: URL, serviceKey: ANON_KEY, expectRole: 'anon' });
    expect(v.ok).toBe(true);
  });
});

describe('describeCredential', () => {
  it('never returns the secret itself', () => {
    const d = describeCredential(SERVICE_KEY);
    expect(d).not.toContain(SERVICE_KEY);
    expect(d).toContain('role=service_role');
    expect(d).toContain(String(SERVICE_KEY.length));
  });

  it('labels a placeholder as such', () => {
    expect(describeCredential('[SENSITIVE]')).toContain('자리표시자');
  });

  it('handles unset, empty and non-string input', () => {
    expect(describeCredential(undefined)).toBe('(미설정)');
    expect(describeCredential(null)).toBe('(미설정)');
    expect(describeCredential('  ')).toBe('(빈 문자열)');
    expect(describeCredential(7)).toContain('number');
  });

  it('does not leak a long non-JWT value', () => {
    const secretish = 'a'.repeat(200);
    const d = describeCredential(secretish);
    expect(d).not.toContain(secretish);
    expect(d).toContain('200자');
  });
});

describe('formatCredentialErrors', () => {
  it('names vercel env pull as the cause so the next operator does not repeat it', () => {
    const out = formatCredentialErrors(['SUPABASE_SERVICE_ROLE_KEY 이 자리표시자입니다.']);
    expect(out).toContain('vercel env pull');
    expect(out).toContain('[SENSITIVE]');
    expect(out).toContain('fail-closed');
  });
});
