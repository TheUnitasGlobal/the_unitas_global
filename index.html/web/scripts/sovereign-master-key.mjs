#!/usr/bin/env node
/**
 * REV-24 MISSION 2 -- mint a SOVEREIGN MASTER KEY capsule.
 *
 * The capsule is an expiring, revocable credential the founder can paste into
 * anything that speaks HTTP -- curl, an uptime monitor, a CI smoke test, a
 * phone shortcut -- to walk straight through the funnel gate and reach the
 * hidden `/[locale]/sovereign` console. It carries NO secret: it is
 * `v1.<expiresAtSec>.<hmac-sha256 hex>`, so a leaked capsule expires on its
 * own and rotating `SOVEREIGN_AUTH_TOKEN` (or
 * `SOVEREIGN_AUTH_SIGNING_SECRET`) revokes every capsule at once.
 *
 *   node scripts/sovereign-master-key.mjs                 # 365 days
 *   node scripts/sovereign-master-key.mjs --days 30
 *   node scripts/sovereign-master-key.mjs --days 7 --json
 *
 * The signing secret is resolved exactly the way the server resolves it:
 * SOVEREIGN_AUTH_SIGNING_SECRET, else SOVEREIGN_AUTH_TOKEN, else -- outside
 * production only -- the public dev default. Set the real secret in the
 * environment before minting a production key:
 *
 *   $env:SOVEREIGN_AUTH_TOKEN = '<the production token>'
 *   node scripts/sovereign-master-key.mjs --days 365
 */
import { createHmac } from 'node:crypto';

const SESSION_VERSION = 'v1';
const DEV_DEFAULT = 'unitas_master_dooyeong_2026_secure_key';
const HEADER = 'x-unitas-signature';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const value = process.argv[i + 1];
  return value && !value.startsWith('--') ? value : fallback;
}

const days = Number(arg('days', '365'));
if (!Number.isFinite(days) || days <= 0) {
  console.error('--days must be a positive number');
  process.exit(1);
}

const token = (process.env.SOVEREIGN_AUTH_TOKEN || '').trim();
const explicitSecret = (process.env.SOVEREIGN_AUTH_SIGNING_SECRET || '').trim();
const usingDevDefault = !token && !explicitSecret;
if (usingDevDefault && process.env.VERCEL_ENV === 'production') {
  console.error('refusing to mint with the public dev default in a production environment');
  process.exit(1);
}
const secret = explicitSecret || `${token || DEV_DEFAULT}::unitas-sovereign-hmac-${SESSION_VERSION}`;

const expiresAt = Math.floor(Date.now() / 1000) + Math.round(days * 86_400);
const message = `unitas-sovereign|${SESSION_VERSION}|${expiresAt}`;
const signature = createHmac('sha256', secret).update(message).digest('hex');
const capsule = `${SESSION_VERSION}.${expiresAt}.${signature}`;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ capsule, header: HEADER, expiresAt, days, usingDevDefault }, null, 2));
} else {
  console.log('');
  console.log('  SOVEREIGN MASTER KEY');
  console.log(`  expires   ${new Date(expiresAt * 1000).toISOString()}  (${days} days)`);
  console.log(`  secret    ${usingDevDefault ? 'DEV DEFAULT -- local use only' : explicitSecret ? 'SOVEREIGN_AUTH_SIGNING_SECRET' : 'SOVEREIGN_AUTH_TOKEN'}`);
  console.log('');
  console.log(`  ${HEADER}: ${capsule}`);
  console.log('');
  console.log('  curl -sI https://www.theunitas.global/ \\');
  console.log(`    -H "${HEADER}: ${capsule}"`);
  console.log('');
  console.log('  A passing request answers 200 with x-unitas-gate: pass.');
  console.log('  A sealed one answers 307 to /<locale>/gateway.');
  console.log('');
}
