#!/usr/bin/env node
// ---------------------------------------------------------------------------
// review-agent-archive.mjs — Review Agent local archive mirror
// (founder directive 2026-09-08).
//
// The Review Agent module's nightly audit (POST /api/life/review/run,
// triggered by the Vercel cron in web/vercel.json) archives every run into
// public.review_agent_logs — that's the durable source of truth, since a
// serverless function has no persistent filesystem to write to, let alone a
// literal `~/life/review/` home-directory path (Vercel's Lambda runtime has
// no stable HOME across invocations, and even within one invocation
// anything written to disk is gone the moment it ends).
//
// This script is the other half: run it FROM THE FOUNDER'S OWN MACHINE
// (locally, or from a personal cron/Task Scheduler entry) to pull the
// recent runs and mirror each one as a JSON file under
// `~/life/review/<date>-<id>.json` — a real, durable, browsable local
// archive, satisfying the literal request without pretending a serverless
// route can write to a home directory it doesn't have.
//
// Dependency-free (Node >= 18 `fetch`), same .env.local-loading convention
// as scripts/admin-verify-phone.mjs. Never wired into build/prebuild —
// this is a founder-run op, not part of the app.
//
// Usage:
//   node scripts/review-agent-archive.mjs            # archive the last 20 runs
//   node scripts/review-agent-archive.mjs --limit 5   # archive the last 5
//
// Env (from web/.env.local or the shell):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
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

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) || 20 : 20;

const ARCHIVE_DIR = path.join(homedir(), 'life', 'review');

async function fetchRecentRuns() {
  const res = await fetch(
    `${URL_BASE}/rest/v1/review_agent_logs?select=*&order=run_at.desc&limit=${limit}`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
  return res.json();
}

function archiveRun(run) {
  const date = run.run_at.slice(0, 10);
  const fileName = `${date}-${run.id}.json`;
  const filePath = path.join(ARCHIVE_DIR, fileName);
  if (existsSync(filePath)) return { fileName, wrote: false };
  writeFileSync(filePath, `${JSON.stringify(run, null, 2)}\n`, 'utf8');
  return { fileName, wrote: true };
}

async function main() {
  mkdirSync(ARCHIVE_DIR, { recursive: true });
  const runs = await fetchRecentRuns();

  let written = 0;
  for (const run of runs) {
    const { fileName, wrote } = archiveRun(run);
    console.log(`${wrote ? '✓ archived' : '· already present'}  ${fileName}`);
    if (wrote) written += 1;
  }

  console.log(`\n[review-agent-archive] ${written}/${runs.length} new run(s) written to ${ARCHIVE_DIR}`);
}

main().catch((err) => {
  console.error('✖', err.message);
  process.exit(1);
});
