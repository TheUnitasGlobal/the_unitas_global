/**
 * THE UNITAS GLOBAL -- shared credential validation core (Codex ch.13 fail-closed).
 *
 * WHY THIS EXISTS
 * ---------------
 * 2026-09-17: the nightly UnitasReviewAgentArchive daemon died at 04:20 with
 * `REST 401: Invalid API key`, and the PowerShell preflight built specifically
 * to prevent that had reported a green light minutes earlier.
 *
 * Root cause: Vercel stores SUPABASE_SERVICE_ROLE_KEY as a **Secret**-typed
 * variable, and `vercel env pull` does NOT decrypt Secret-typed values -- it
 * writes the literal 11-character string `[SENSITIVE]` in their place. Every
 * credential guard in this repo was a bare truthiness test (`!url || !key`),
 * and `[SENSITIVE]` is a non-empty string, so it passed all of them silently
 * and was posted to PostgREST as a bearer token.
 *
 * The lesson is not "handle [SENSITIVE]" -- it is that presence is not
 * validity. This module validates SHAPE, so a value that cannot possibly be a
 * credential is rejected before it is ever sent anywhere.
 *
 * PURITY CONTRACT
 * ---------------
 * No fs, no process.env, no clock, no network. Every function is a pure
 * transform of its arguments, so `web/__tests__/security/credentialCore.test.ts`
 * can exercise every branch without a fixture. Callers do the I/O.
 *
 * Never log a credential value. `describeCredential()` exists so callers can
 * report what went wrong without putting the secret in a log line.
 */

/**
 * Literal placeholders that tooling substitutes for a real secret. Each of
 * these is a NON-EMPTY string, which is exactly why truthiness checks miss
 * them.
 *
 * - `[SENSITIVE]`  -- `vercel env pull` for a Secret-typed variable
 * - `<...>`        -- this repo's own .env.example convention
 * - `YOUR_...`     -- the near-universal scaffold convention
 * @type {ReadonlyArray<{ code: string, test: (v: string) => boolean, hint: string }>}
 */
export const PLACEHOLDER_RULES = Object.freeze([
  {
    code: 'placeholder-vercel-secret',
    test: (v) => v === '[SENSITIVE]',
    hint: 'Vercel이 Secret 타입 변수를 `vercel env pull` 시 복호화하지 않고 넣는 자리표시자입니다. Supabase 대시보드 또는 Management API에서 실제 키를 받아오십시오.',
  },
  {
    code: 'placeholder-angle-bracket',
    test: (v) => v.includes('<') || v.includes('>'),
    hint: '.env.example의 `<paste-the-...>` 자리표시자가 그대로 복사된 값입니다.',
  },
  {
    code: 'placeholder-scaffold',
    test: (v) => /^(your[_-]|changeme|todo|replace[_-]?me|xxx+$)/i.test(v),
    hint: '스캐폴드 기본값이 교체되지 않았습니다.',
  },
]);

/**
 * @param {unknown} value
 * @returns {{ code: string, hint: string } | null} the matched rule, or null
 */
export function matchPlaceholder(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  for (const rule of PLACEHOLDER_RULES) {
    if (rule.test(v)) return { code: rule.code, hint: rule.hint };
  }
  return null;
}

/**
 * Decode a JWT payload without verifying the signature. We are not
 * authenticating the token here -- the server does that. We only need the
 * claims to tell a service_role key apart from an anon key, which is the
 * difference between "works" and "silently reads nothing through RLS".
 *
 * @param {string} token
 * @returns {Record<string, unknown> | null}
 */
export function decodeJwtClaims(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const claims = JSON.parse(json);
    return claims && typeof claims === 'object' && !Array.isArray(claims) ? claims : null;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} value
 * @returns {boolean} true when the value is structurally a three-segment JWT
 */
export function isJwtShaped(value) {
  return typeof value === 'string' && /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(value.trim());
}

/**
 * A safe, loggable description of a credential. NEVER returns the value.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function describeCredential(value) {
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

/**
 * Validate a Supabase project URL.
 *
 * @param {unknown} value
 * @returns {{ ok: true, value: string } | { ok: false, code: string, message: string }}
 */
export function validateSupabaseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, code: 'missing', message: 'NEXT_PUBLIC_SUPABASE_URL 미설정' };
  }
  const v = value.trim().replace(/\/$/, '');
  const ph = matchPlaceholder(v);
  if (ph) {
    return { ok: false, code: ph.code, message: `NEXT_PUBLIC_SUPABASE_URL 이 자리표시자입니다. ${ph.hint}` };
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

/**
 * Validate a Supabase API key (service_role or anon).
 *
 * @param {unknown} value
 * @param {{ name?: string, expectRole?: string, projectRef?: string }} [opts]
 * @returns {{ ok: true, value: string, claims: Record<string, unknown> | null }
 *          | { ok: false, code: string, message: string }}
 */
export function validateSupabaseKey(value, opts = {}) {
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

/**
 * The gate every credential-consuming script should call before its first
 * network request.
 *
 * @param {{ url?: unknown, serviceKey?: unknown, projectRef?: string, expectRole?: string }} input
 * @returns {{ ok: true, url: string, serviceKey: string } | { ok: false, errors: string[] }}
 */
export function assertSupabaseCredentials(input) {
  const errors = [];
  const url = validateSupabaseUrl(input.url);
  if (!url.ok) errors.push(url.message);

  const key = validateSupabaseKey(input.serviceKey, {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    expectRole: input.expectRole === undefined ? 'service_role' : input.expectRole,
    projectRef: input.projectRef,
  });
  if (!key.ok) errors.push(key.message);

  if (errors.length) return { ok: false, errors };
  return { ok: true, url: url.value, serviceKey: key.value };
}

/**
 * Render the failure into the multi-line block a CLI should print. Kept here
 * so the archive daemon, the admin script and the PowerShell preflight all
 * say the same thing about the same failure.
 *
 * @param {string[]} errors
 * @returns {string}
 */
export function formatCredentialErrors(errors) {
  return [
    '✖ Supabase 자격 증명 검증 실패 -- 요청을 보내지 않고 중단합니다 (Codex 제13장 fail-closed).',
    ...errors.map((e) => `   · ${e}`),
    '',
    '   web/.env.local 을 확인하십시오. 주의: `vercel env pull` 은 Secret 타입 변수를',
    '   복호화하지 않고 "[SENSITIVE]" 를 씁니다 -- 그 파일은 유효한 소스가 아닙니다.',
  ].join('\n');
}
