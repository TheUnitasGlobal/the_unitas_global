/**
 * Supabase live SQL runner (Management API `database/query`).
 *
 * The house procedure every migration since 20260902000000 has used, written
 * down as a script instead of a shell one-liner retyped each time:
 *
 *   node scripts/supabase-sql.mjs --file supabase/migrations/<name>.sql
 *   node scripts/supabase-sql.mjs --sql "select 1"
 *   node scripts/supabase-sql.mjs --file <name>.sql --dry-run
 *
 * WHY THE MANAGEMENT API AND NOT `supabase db push`. The live project
 * (fjznkonbjoierxvopiko) was hand-built through the Dashboard and has no
 * complete migration history; `db push` would try to replay every local file
 * against a schema that does not match them. Every migration from
 * 20260902000000 on is therefore written fully idempotent and applied on its
 * own through this endpoint, then recorded with `supabase migration repair`.
 *
 * SAFETY. This runner refuses to send a statement that drops or truncates a
 * table, or drops a column/schema -- the irreversible shapes. A migration
 * that genuinely needs one must be applied by hand, deliberately, with the
 * founder's explicit approval for that specific statement. `--dry-run`
 * prints the parsed statement list and sends nothing.
 *
 * Credentials come from index.html/.env (SUPABASE_ACCESS_TOKEN,
 * SUPABASE_PROJECT_REF) or the process environment. Nothing is ever printed.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function loadEnvFile() {
  const out = {};
  try {
    const raw = readFileSync(path.join(repoRoot, '.env'), 'utf8').replace(/^﻿/, '');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const i = trimmed.indexOf('=');
      out[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // no .env -- the process environment is the only source then
  }
  return out;
}

const fileEnv = loadEnvFile();
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || fileEnv.SUPABASE_PROJECT_REF;

if (!TOKEN || !REF) {
  console.error('supabase-sql: SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF must be set (index.html/.env or the environment).');
  process.exit(2);
}

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1] ?? '';
}
const dryRun = args.includes('--dry-run');
const filePath = flag('file');
const inlineSql = flag('sql');

if (!filePath && !inlineSql) {
  console.error('supabase-sql: pass --file <path> or --sql "<statement>".');
  process.exit(2);
}

const sql = inlineSql ?? readFileSync(path.resolve(repoRoot, filePath), 'utf8').replace(/^﻿/, '');

/**
 * Irreversible shapes this runner will not send. Deliberately matched on the
 * statement text rather than a parse: a false positive costs one manual
 * application, a false negative costs live data.
 */
const FORBIDDEN = [
  [/\bdrop\s+table\b/i, 'DROP TABLE'],
  [/\bdrop\s+schema\b/i, 'DROP SCHEMA'],
  [/\bdrop\s+database\b/i, 'DROP DATABASE'],
  [/\btruncate\b/i, 'TRUNCATE'],
  [/\balter\s+table\s+[^;]*\bdrop\s+column\b/i, 'ALTER TABLE ... DROP COLUMN'],
  [/\bdelete\s+from\b/i, 'DELETE FROM'],
];

for (const [re, label] of FORBIDDEN) {
  if (re.test(sql)) {
    console.error(`supabase-sql: refusing to send -- the statement contains ${label}.`);
    console.error('Irreversible changes are applied by hand, with the founder approving that exact statement.');
    process.exit(3);
  }
}

if (dryRun) {
  const lines = sql.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('--'));
  console.log(`supabase-sql: DRY RUN -- ${sql.length} chars, ${lines.length} non-comment lines, nothing sent.`);
  process.exit(0);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`supabase-sql: HTTP ${res.status}`);
  console.error(text.slice(0, 4000));
  process.exit(1);
}

try {
  console.log(JSON.stringify(JSON.parse(text), null, 2).slice(0, 12000));
} catch {
  console.log(text.slice(0, 12000));
}
