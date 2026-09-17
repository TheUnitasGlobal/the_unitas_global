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
// Each run is also mirrored as a companion `<date>-<id>.md` file (founder
// directive 2026-09-08) — a skimmable executive-briefing document (status,
// the LLM-generated one-paragraph briefing if one was generated, and the
// findings list) rather than raw JSON. To run this nightly without a
// manual trigger, see scripts/install-review-archive-task.ps1 (Windows
// Task Scheduler installer — not run automatically by anything in this
// repo; the founder runs it once, opt-in).
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

import { assertSupabaseCredentials, describeCredential, formatCredentialErrors } from './credential-core.mjs';

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

// Shape-validate before the first request. A truthiness check here used to let
// the literal "[SENSITIVE]" placeholder -- which `vercel env pull` writes for
// Secret-typed variables -- through to PostgREST as a bearer token, so the
// nightly run failed with an opaque `REST 401: Invalid API key` instead of
// naming the misconfigured variable. See scripts/credential-core.mjs.
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;
const credentials = assertSupabaseCredentials({ url: rawUrl, serviceKey: rawKey });

const args = process.argv.slice(2);

// `--check-credentials` is the preflight the task installer calls. Keeping it
// here rather than reimplementing the rules in PowerShell is deliberate: the
// 2026-09-17 outage happened because the PowerShell preflight and the worker
// disagreed about what counts as a credential, and the preflight was the one
// that was wrong. One implementation, two callers, no drift.
if (args.includes('--check-credentials')) {
  console.log(`  ${'NEXT_PUBLIC_SUPABASE_URL'.padEnd(30)} ${describeCredential(rawUrl)}`);
  console.log(`  ${'SUPABASE_SERVICE_ROLE_KEY'.padEnd(30)} ${describeCredential(rawKey)}`);
  if (!credentials.ok) {
    console.error('');
    console.error(formatCredentialErrors(credentials.errors));
    process.exit(78); // EX_CONFIG
  }
  console.log('  -> 자격 증명 형식 검증 통과 -- 야간 구동이 인증할 수 있습니다.');
  process.exit(0);
}

if (!credentials.ok) {
  console.error(formatCredentialErrors(credentials.errors));
  process.exit(1);
}

const URL_BASE = credentials.url;
const SERVICE_KEY = credentials.serviceKey;

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

function findingsToMarkdown(findings) {
  if (!Array.isArray(findings) || findings.length === 0) return '_(no findings)_';
  return findings.map((f) => `- **${String(f.level).toUpperCase()}** \`${f.code}\` -- ${f.message}`).join('\n');
}

/**
 * Companion human-readable markdown file, alongside the raw JSON archive.
 * This is the actual "executive briefing stream" artifact under
 * ~/life/review/ -- one skimmable file per run instead of raw JSON, per
 * founder directive 2026-09-08 to fully automate the briefing stream.
 */
function briefingMarkdown(run) {
  const lines = [
    `# Review Agent -- ${run.run_at}`,
    '',
    `**Status:** ${String(run.status).toUpperCase()}  `,
    `**Triggered by:** ${run.triggered_by}`,
    '',
    `> ${run.summary}`,
    '',
  ];
  if (run.briefing) {
    lines.push('## Executive Briefing', '', run.briefing, '');
  }
  lines.push('## Findings', '', findingsToMarkdown(run.findings), '');
  return lines.join('\n');
}

function archiveRun(run) {
  const date = run.run_at.slice(0, 10);
  const fileName = `${date}-${run.id}.json`;
  const mdFileName = `${date}-${run.id}.md`;
  const filePath = path.join(ARCHIVE_DIR, fileName);
  const mdFilePath = path.join(ARCHIVE_DIR, mdFileName);
  if (existsSync(filePath)) return { fileName, wrote: false };
  writeFileSync(filePath, `${JSON.stringify(run, null, 2)}\n`, 'utf8');
  writeFileSync(mdFilePath, briefingMarkdown(run), 'utf8');
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
  // NOT process.exit(1). Calling it synchronously in the microtask turn where a
  // fetch() rejection settles tears down the libuv loop while undici still has
  // background teardown in flight; the worker then posts to a closing
  // uv_async_t and Node aborts with
  //   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c:94
  // turning our intended exit 1 into a 127 abort. Measured 5/5 on this host.
  // Setting exitCode lets the loop drain and exits 1 deterministically.
  process.exitCode = 1;
});
