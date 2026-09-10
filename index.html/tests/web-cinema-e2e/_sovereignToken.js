// Single source for the founder-bypass token every E2E spec in this
// directory needs to reach the released Quantum White home. Reads
// `SOVEREIGN_AUTH_TOKEN` from the environment first (so CI/production-like
// runs can point at a real, rotated secret); the fallback below MUST stay
// byte-identical to `web/lib/sovereignAuth.ts`'s exported
// `SOVEREIGN_AUTH_TOKEN_DEFAULT` -- that file, not this one, is the actual
// source of truth (it is what `resolveSovereignToken()` itself falls back
// to server-side when the env var is unset), duplicated here only because
// these specs run as plain CommonJS under Playwright's own loader and
// cannot cheaply `require()` a sibling TypeScript module across the
// `tests/` <-> `web/` package boundary.
const SOVEREIGN_AUTH_TOKEN = process.env.SOVEREIGN_AUTH_TOKEN || 'unitas_master_dooyeong_2026_secure_key';

module.exports = { SOVEREIGN_AUTH_TOKEN };
