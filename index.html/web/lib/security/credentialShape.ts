/**
 * THE UNITAS GLOBAL -- ISOMORPHIC credential shape validation (Codex ch.13 fail-closed).
 *
 * WHY THIS EXISTS AS A SECOND MODULE
 * ----------------------------------
 * `web/scripts/credential-core.mjs` already encodes this logic and is the
 * canon for the SCRIPT layer (the archive daemon, the admin runners, the
 * PowerShell preflight). The app layer cannot import it:
 *
 *   `decodeJwtClaims` there calls `Buffer.from(seg, 'base64url')`, and
 *   `validateSupabaseKey` calls it for EVERY JWT-shaped key. Next 14.2.35
 *   polyfills `Buffer` into the client and Edge bundles with `buffer@6.0.3`,
 *   which has no `base64url` encoding at all:
 *
 *       Buffer.from('eyJhIjoxfQ', 'base64url')
 *       -> TypeError: Unknown encoding: base64url
 *
 *   So importing the .mjs into a browser/Edge bundle throws on the HAPPY
 *   PATH -- a correct key fails. `web/middleware.ts` declares no runtime, so
 *   it is Edge; `lib/supabase/middlewareClient.ts` is in that bundle.
 *   It would also drag ~50 KB of Buffer polyfill into the client.
 *
 * This module therefore re-implements the same contract on `atob` +
 * `TextDecoder` only -- no `node:` imports, no `Buffer`, no `fs`, no
 * `process.env`, no clock, no network. It runs unchanged in the browser, the
 * Edge runtime, Node route handlers and vitest.
 *
 * DUPLICATION IS MADE SAFE BY A PARITY TEST, NOT BY DISCIPLINE.
 * `web/__tests__/security/credentialShapeParity.test.ts` imports BOTH modules
 * and asserts identical `{ok, code, message}` verdicts over a shared fixture
 * table. Two modules that drift is exactly the class of bug that caused the
 * 2026-09-17 outage; the test is what stops it.
 *
 * `credential-core.mjs` is pinned in `config/security/trust-registry.json`
 * (`unitas.credential.core`) and is NOT edited by this module's existence.
 *
 * PURITY CONTRACT: every function is a pure transform of its arguments.
 * Callers do the I/O and pass values in. Never log a credential value --
 * `describeCredential()` exists so a failure can be reported without putting
 * the secret in a log line.
 *
 * FORWARD-COMPAT NOTE: the shape accepted here is the legacy Supabase JWT key
 * (`eyJ...`), matching `credential-core.mjs`. Supabase's newer
 * `sb_publishable_` / `sb_secret_` key formats are deliberately NOT accepted:
 * widening only this module would break parity with the pinned canon. If the
 * project migrates key formats, widen `credential-core.mjs` first, re-stamp
 * the trust registry, then mirror it here -- in that order.
 */

/** A verdict shared by every validator here. `ok:false` never carries the value. */
export type CredentialVerdict<T = { value: string }> =
  | ({ ok: true } & T)
  | { ok: false; code: string; message: string };

export interface PlaceholderRule {
  readonly code: string;
  readonly test: (v: string) => boolean;
  readonly hint: string;
}

/**
 * Literal placeholders that tooling substitutes for a real secret. Each is a
 * NON-EMPTY string, which is exactly why truthiness checks miss them.
 *
 * Mirrors `PLACEHOLDER_RULES` in credential-core.mjs, rule for rule, in order.
 */
export const PLACEHOLDER_RULES: readonly PlaceholderRule[] = Object.freeze([
  {
    code: 'placeholder-vercel-secret',
    test: (v: string) => v === '[SENSITIVE]',
    hint: 'Vercel이 Secret 타입 변수를 `vercel env pull` 시 복호화하지 않고 넣는 자리표시자입니다. Supabase 대시보드 또는 Management API에서 실제 키를 받아오십시오.',
  },
  {
    code: 'placeholder-angle-bracket',
    test: (v: string) => v.includes('<') || v.includes('>'),
    hint: '.env.example의 `<paste-the-...>` 자리표시자가 그대로 복사된 값입니다.',
  },
  {
    code: 'placeholder-scaffold',
    test: (v: string) => /^(your[_-]|changeme|todo|replace[_-]?me|xxx+$)/i.test(v),
    hint: '스캐폴드 기본값이 교체되지 않았습니다.',
  },
]);

/**
 * @returns the matched placeholder rule, or null when the value is not a
 *          recognised placeholder (which is NOT the same as "valid").
 */
export function matchPlaceholder(value: unknown): { code: string; hint: string } | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  for (const rule of PLACEHOLDER_RULES) {
    if (rule.test(v)) return { code: rule.code, hint: rule.hint };
  }
  return null;
}

/**
 * Decode one base64url segment to bytes, reproducing Node's `Buffer` leniency
 * so the two modules cannot disagree on malformed input:
 *
 *  - base64url alphabet is mapped to base64 (`-` -> `+`, `_` -> `/`);
 *  - characters outside the alphabet are DROPPED (Buffer ignores them,
 *    `atob` would throw);
 *  - a dangling 1-char group is DROPPED (Buffer cannot form a byte from it);
 *  - the remainder is padded to a multiple of 4 for `atob`.
 *
 * Returns null when the segment cannot be decoded at all.
 */
function base64UrlToBytes(segment: string): Uint8Array | null {
  const cleaned = segment.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
  const usable = cleaned.length % 4 === 1 ? cleaned.slice(0, -1) : cleaned;
  if (!usable) return new Uint8Array(0);
  const padded = usable + '='.repeat((4 - (usable.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Decode a JWT payload WITHOUT verifying the signature. We are not
 * authenticating the token -- the server does that. We only need the claims to
 * tell a service_role key apart from an anon key, which is the difference
 * between "works" and "silently reads nothing through RLS".
 */
export function decodeJwtClaims(token: unknown): Record<string, unknown> | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const bytes = base64UrlToBytes(parts[1]);
    if (!bytes) return null;
    const json = new TextDecoder('utf-8').decode(bytes);
    const claims: unknown = JSON.parse(json);
    return claims && typeof claims === 'object' && !Array.isArray(claims)
      ? (claims as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** True when the value is structurally a three-segment JWT. */
export function isJwtShaped(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(value.trim())
  );
}

/** A safe, loggable description of a credential. NEVER returns the value. */
export function describeCredential(value: unknown): string {
  if (value === undefined || value === null) return '(미설정)';
  if (typeof value !== 'string') return `(${typeof value} 타입)`;
  const v = value.trim();
  if (!v) return '(빈 문자열)';
  const ph = matchPlaceholder(v);
  if (ph) return `(자리표시자 "${v.length <= 16 ? v : v.slice(0, 13) + '...'}" · ${v.length}자)`;
  if (isJwtShaped(v)) {
    const claims = decodeJwtClaims(v);
    const role = claims && typeof claims.role === 'string' ? claims.role : '역할없음';
    return `(JWT · ${v.length}자 · role=${role})`;
  }
  return `(${v.length}자 · JWT 아님)`;
}

/** Validate a Supabase project URL. */
export function validateSupabaseUrl(value: unknown): CredentialVerdict {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, code: 'missing', message: 'NEXT_PUBLIC_SUPABASE_URL 미설정' };
  }
  const v = value.trim().replace(/\/$/, '');
  const ph = matchPlaceholder(v);
  if (ph) {
    return {
      ok: false,
      code: ph.code,
      message: `NEXT_PUBLIC_SUPABASE_URL 이 자리표시자입니다. ${ph.hint}`,
    };
  }
  if (!/^https:\/\/[^\s/]+$/.test(v)) {
    return {
      ok: false,
      code: 'malformed-url',
      message: `NEXT_PUBLIC_SUPABASE_URL 형식 오류 -- https://<ref>.supabase.co 형태여야 합니다 ${describeCredential(v)}`,
    };
  }
  return { ok: true, value: v };
}

export interface ValidateKeyOptions {
  /** Env-var name used in the message, e.g. `NEXT_PUBLIC_SUPABASE_ANON_KEY`. */
  name?: string;
  /** Required `role` claim -- `anon` or `service_role`. Omit to skip. */
  expectRole?: string;
  /** Required `ref` claim, when the project ref is known. Omit to skip. */
  projectRef?: string;
}

/** Validate a Supabase API key (service_role or anon). */
export function validateSupabaseKey(
  value: unknown,
  opts: ValidateKeyOptions = {},
): CredentialVerdict<{ value: string; claims: Record<string, unknown> | null }> {
  const name = opts.name || 'SUPABASE_SERVICE_ROLE_KEY';
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, code: 'missing', message: `${name} 미설정` };
  }
  const v = value.trim();
  const ph = matchPlaceholder(v);
  if (ph) {
    return { ok: false, code: ph.code, message: `${name} 이 자리표시자입니다. ${ph.hint}` };
  }
  if (!isJwtShaped(v)) {
    return {
      ok: false,
      code: 'not-jwt',
      message: `${name} 이 JWT 형태가 아닙니다 -- 3세그먼트 eyJ... 토큰이어야 합니다 ${describeCredential(v)}`,
    };
  }
  const claims = decodeJwtClaims(v);
  if (opts.expectRole && (!claims || claims.role !== opts.expectRole)) {
    const actual = claims && typeof claims.role === 'string' ? claims.role : '(없음)';
    return {
      ok: false,
      code: 'wrong-role',
      message: `${name} 의 role 클레임이 "${actual}" 입니다 -- "${opts.expectRole}" 이어야 합니다.`,
    };
  }
  if (opts.projectRef && claims && typeof claims.ref === 'string' && claims.ref !== opts.projectRef) {
    return {
      ok: false,
      code: 'wrong-project',
      message: `${name} 이 다른 프로젝트의 키입니다 -- ref=${claims.ref}, 기대값=${opts.projectRef}`,
    };
  }
  return { ok: true, value: v, claims };
}

export interface AssertCredentialsInput {
  url?: unknown;
  serviceKey?: unknown;
  projectRef?: string;
  expectRole?: string;
}

/** The gate a privileged consumer calls before its first network request. */
export function assertSupabaseCredentials(
  input: AssertCredentialsInput,
): { ok: true; url: string; serviceKey: string } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const url = validateSupabaseUrl(input.url);
  if (!url.ok) errors.push(url.message);

  const key = validateSupabaseKey(input.serviceKey, {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    expectRole: input.expectRole === undefined ? 'service_role' : input.expectRole,
    projectRef: input.projectRef,
  });
  if (!key.ok) errors.push(key.message);

  if (errors.length) return { ok: false, errors };
  return { ok: true, url: (url as { ok: true; value: string }).value, serviceKey: (key as { ok: true; value: string }).value };
}

/** Render a failure into the multi-line block a CLI should print. */
export function formatCredentialErrors(errors: string[]): string {
  return [
    '✖ Supabase 자격 증명 검증 실패 -- 요청을 보내지 않고 중단합니다 (Codex 제13장 fail-closed).',
    ...errors.map((e) => `   · ${e}`),
    '',
    '   web/.env.local 을 확인하십시오. 주의: `vercel env pull` 은 Secret 타입 변수를',
    '   복호화하지 않고 "[SENSITIVE]" 를 씁니다 -- 그 파일은 유효한 소스가 아닙니다.',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* App-layer helpers -- NOT part of the .mjs parity surface.           */
/* They compose the validators above; they add no new shape rules, so  */
/* the parity test still covers everything that decides validity.      */
/* ------------------------------------------------------------------ */

/** The public (browser-safe) pair every Supabase factory in this app needs. */
export type PublicSupabaseEnvVerdict =
  | { ok: true; url: string; anonKey: string }
  | { ok: false; errors: string[] };

/**
 * Validate the NEXT_PUBLIC pair. The caller reads `process.env` and passes the
 * values in, so this module stays env-free and testable.
 *
 * Fail-closed: a placeholder anon key is REJECTED here rather than handed to
 * `createBrowserClient`, which would happily build a client that 401s on every
 * call and report itself as "configured".
 */
export function validatePublicSupabaseEnv(url: unknown, anonKey: unknown): PublicSupabaseEnvVerdict {
  const errors: string[] = [];
  const u = validateSupabaseUrl(url);
  if (!u.ok) errors.push(u.message);
  const k = validateSupabaseKey(anonKey, {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    expectRole: 'anon',
  });
  if (!k.ok) errors.push(k.message);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    url: (u as { ok: true; value: string }).value,
    anonKey: (k as { ok: true; value: string }).value,
  };
}

/** Which key a privileged server client ended up using. */
export type ServerKeyRole = 'service_role' | 'anon';

export type ServerKeyVerdict =
  /**
   * `warnings` is empty on the normal paths -- a valid service key, or an
   * ABSENT one falling back as designed. It is non-empty in exactly one case:
   * a service key that was PRESENT BUT INVALID and lost the fallback to a
   * valid anon key. That case resolves successfully yet costs privilege, so
   * the reason has to travel WITH the verdict; a caller that had to re-derive
   * it would be a second copy of the rule, which is the drift this module
   * exists to prevent.
   */
  | { ok: true; url: string; key: string; role: ServerKeyRole; warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * Pick the key `lib/supabase/server.ts` should use.
 *
 * THE BUG THIS REPLACES: `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * is a truthiness fallback, so a PLACEHOLDER service key -- a non-empty string --
 * beat a perfectly good anon key and was posted to PostgREST as a bearer token.
 *
 * The fallback choice therefore happens AFTER shape validation: an invalid
 * service key is not a candidate at all. A missing service key falls back
 * SILENTLY (`warnings: []`) because that is the documented, normal degraded
 * mode. A service key that is PRESENT BUT INVALID travels back in `warnings`
 * on the successful anon verdict: the call is rescued, but it is rescued at
 * the cost of privilege, and an RLS-bypassing RPC that is now refused by
 * POLICY reads like a migration bug rather than a credential bug unless
 * someone is told why.
 */
export function selectServerSupabaseKey(
  url: unknown,
  serviceKey: unknown,
  anonKey: unknown,
): ServerKeyVerdict {
  const errors: string[] = [];
  const warnings: string[] = [];
  const u = validateSupabaseUrl(url);
  if (!u.ok) errors.push(u.message);

  const servicePresent = typeof serviceKey === 'string' && serviceKey.trim().length > 0;
  const service = validateSupabaseKey(serviceKey, {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    expectRole: 'service_role',
  });

  if (service.ok && u.ok) {
    return { ok: true, url: u.value, key: service.value, role: 'service_role', warnings };
  }
  if (servicePresent && !service.ok) {
    errors.push(service.message);
    warnings.push(service.message);
  }

  const anon = validateSupabaseKey(anonKey, {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    expectRole: 'anon',
  });
  if (!anon.ok) {
    errors.push(anon.message);
    return { ok: false, errors };
  }
  if (!u.ok) return { ok: false, errors };
  return { ok: true, url: u.value, key: anon.value, role: 'anon', warnings };
}
