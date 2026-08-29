#!/usr/bin/env node
// ---------------------------------------------------------------------------
// admin-verify-phone.mjs  —  TEST / OPS helper (owner request 2026-08-29)
//
// spend_coins() now hard-refuses any account with phone_verified = false
// (migration 20260907000000, the Zero-Trust guard). The 5 existing live
// profiles are all unverified, so coin-spend / module-gate flows cannot be
// exercised end-to-end without going through a real SMS OTP.
//
// This script is the sanctioned bypass for a TEST environment: it uses the
// service-role key to set profiles.phone_verified directly. That write is
// allowed by the protect_profile_identity() trigger *only* for service_role
// (see 20260823000000_zero_trust_identity.sql) — a normal authenticated
// client PATCH is silently reverted, which is the whole point of the guard.
// The same service-role path the /api/account/delete route already uses.
//
// Dependency-free (Node >= 18 `fetch`). Never wired into build/prebuild.
//
// Usage:
//   node scripts/admin-verify-phone.mjs --list
//   node scripts/admin-verify-phone.mjs <email|user-uuid>            # verify
//   node scripts/admin-verify-phone.mjs <email|user-uuid> --revoke   # un-verify
//   node scripts/admin-verify-phone.mjs <email|user-uuid> --phone +37212345678
//
// Env (from web/.env.local or the shell):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const out = {};
  for (const rel of ['../.env.local', '../.env']) {
    try {
      const txt = readFileSync(path.resolve(__dirname, rel), 'utf8');
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in out)) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }
    } catch {
      /* file optional */
    }
  }
  return out;
}

const fileEnv = loadEnvLocal();
const URL_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY || '';

if (!URL_BASE || !SERVICE_KEY) {
  console.error('✖ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (web/.env.local or shell).');
  process.exit(1);
}

const H = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const phoneIdx = args.indexOf('--phone');
const phoneArg = phoneIdx !== -1 ? args[phoneIdx + 1] : null;
const target = args.find((a) => !a.startsWith('--') && a !== phoneArg);

async function rest(pathAndQuery, init) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...H, ...(init?.headers || {}) } });
  const body = await res.text();
  if (!res.ok) throw new Error(`REST ${res.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

async function listProfiles() {
  const rows = await rest('profiles?select=id,full_name,phone,phone_verified,deleted_at&order=created_at.asc');
  console.table(
    rows.map((r) => ({
      id: r.id,
      name: r.full_name ?? '—',
      phone: r.phone ?? '—',
      phone_verified: r.phone_verified,
      deleted: r.deleted_at ? 'yes' : '',
    })),
  );
}

async function resolveUserId(ident) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ident)) return ident;
  // treat as email — look it up via the Auth admin API
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=200`, { headers: H });
  if (!res.ok) throw new Error(`Auth admin ${res.status}: ${await res.text()}`);
  const { users } = await res.json();
  const hit = users.find((u) => (u.email || '').toLowerCase() === ident.toLowerCase());
  if (!hit) throw new Error(`No auth user with email ${ident}`);
  return hit.id;
}

async function setVerified(ident, verified) {
  const userId = await resolveUserId(ident);
  const patch = { phone_verified: verified };
  // A verified phone must be unique among live profiles (partial unique idx).
  // If we're verifying and the row has no phone, require/accept one so the
  // guard's `phone_verified = true` state is actually reachable & consistent.
  if (verified) {
    const [row] = await rest(`profiles?id=eq.${userId}&select=phone,deleted_at`);
    if (!row) throw new Error(`No profiles row for ${userId}`);
    if (row.deleted_at) throw new Error(`profiles row for ${userId} is soft-deleted (deleted_at set)`);
    if (phoneArg) patch.phone = phoneArg;
    else if (!row.phone) {
      console.error('✖ profile has no phone on file — pass --phone <e164> so the verified-phone uniqueness index is satisfiable.');
      process.exit(1);
    }
  }
  const updated = await rest(`profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  const after = Array.isArray(updated) ? updated[0] : updated;
  if (!after || after.phone_verified !== verified) {
    throw new Error(`write did not stick (phone_verified=${after?.phone_verified}). protect_profile_identity() only lets service_role through — check the key is really the service_role key.`);
  }
  console.log(`✔ ${userId}  phone_verified => ${verified}${patch.phone ? `  (phone ${patch.phone})` : ''}`);
}

(async () => {
  try {
    if (flags.has('--list') || !target) {
      if (!target) console.log('(no account given — listing current state)\n');
      await listProfiles();
      if (!target) console.log('\nverify:  node scripts/admin-verify-phone.mjs <email|uuid> [--phone +3721234567]');
      return;
    }
    await setVerified(target, !flags.has('--revoke'));
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(1);
  }
})();
