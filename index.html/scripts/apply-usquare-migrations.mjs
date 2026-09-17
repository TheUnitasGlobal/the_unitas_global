#!/usr/bin/env node
// ---------------------------------------------------------------------------
// apply-usquare-migrations.mjs -- REV-40 MISSION 3: land the two U-Square
// migrations on the live database, in the only order that works, and then
// prove they are actually there.
//
// THE DEFECT THIS EXISTS TO CLOSE. supabase_migrations.schema_migrations claims
// 20260917000000 is applied. It is not: hub_shorts_reactions and all four
// hub_shorts_*/hub_market_pulse functions are absent from the live schema. At
// some point `migration repair` was run without the SQL ever being sent, so the
// history testifies to a schema that does not exist. Every audit since REV-38
// has rediscovered this, and every attempt to fix it by hand has used a
// filename that does not exist -- `20260917000000_hub_exchange_and_rooms.sql`
// (that is the name of 20260916000000). readFileSync then throws ENOENT, the
// process dies before sending anything, and nothing is applied while the
// terminal shows an error that looks unrelated. Hence one script with the real
// names baked in.
//
// WHY THE ORDER IS NOT NEGOTIABLE. 20260917000000 creates
// hub_shorts_counts(p_targets text[]). 20260918000000 drops exactly that
// one-argument signature and creates hub_shorts_counts(p_kind text, p_targets
// text[]). Postgres treats a different argument list as a NEW overload, not a
// replacement, so running 917 after 918 resurrects the retired one-argument
// function and leaves PostgREST with two candidates for the same call.
//
// WHY `supabase db push` IS NOT USED. The live project was hand-built through
// the Dashboard and has no complete migration history; db push would replay all
// 23 local files against a schema that does not match them. Everything here
// goes through the Management API runner (scripts/supabase-sql.mjs), which also
// refuses irreversible statement shapes.
//
//   npm run db:usquare -- --dry-run   # parse + gate check, send nothing
//   npm run db:usquare                # apply, verify, repair history
//   npm run db:usquare -- --verify    # verify only, change nothing
// ---------------------------------------------------------------------------
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

/** In dependency order. Both are idempotent on their own; the pair is not commutative. */
export const USQUARE_MIGRATIONS = [
  'supabase/migrations/20260917000000_hub_shorts_reactions_and_market_pulse.sql',
  'supabase/migrations/20260918000000_hub_shorts_counts_scope.sql',
];

/** The objects that must exist afterwards, and the only honest proof the run worked. */
export const EXPECTED_FUNCTIONS = [
  'hub_market_pulse',
  'hub_shorts_counts',
  'hub_shorts_sync',
  'hub_shorts_toggle',
];
export const EXPECTED_TABLE = 'hub_shorts_reactions';

/** Pure: the shape of hub_shorts_counts we expect once BOTH files are applied. */
export function isScopedCountsSignature(args) {
  return /p_kind\s+text/.test(args) && /p_targets\s+text\[\]/.test(args);
}

/** Pure: turn the verification rows into a pass/fail verdict with a reason. */
export function verdictFor(tables, functions) {
  const missingTable = tables.includes(EXPECTED_TABLE) ? null : EXPECTED_TABLE;
  const names = functions.map((f) => f.proname);
  const missingFns = EXPECTED_FUNCTIONS.filter((f) => !names.includes(f));
  const counts = functions.filter((f) => f.proname === 'hub_shorts_counts');
  const overloaded = counts.length > 1;
  const scoped = counts.length === 1 && isScopedCountsSignature(counts[0].args ?? '');
  const ok = !missingTable && missingFns.length === 0 && !overloaded && scoped;
  const reasons = [];
  if (missingTable) reasons.push(`table ${missingTable} is missing`);
  if (missingFns.length) reasons.push(`functions missing: ${missingFns.join(', ')}`);
  if (overloaded) reasons.push(`hub_shorts_counts has ${counts.length} overloads -- 20260917 was applied after 20260918`);
  if (!overloaded && counts.length === 1 && !scoped) reasons.push('hub_shorts_counts is still the retired one-argument form -- 20260918 did not apply');
  return { ok, reasons };
}

function runner(args, { quiet = false } = {}) {
  const res = spawnSync(process.execPath, [path.join(here, 'supabase-sql.mjs'), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (!quiet && res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  return res;
}

function query(sql) {
  const res = runner(['--sql', sql], { quiet: true });
  if (res.status !== 0) throw new Error(`verification query failed (exit ${res.status})`);
  try {
    return JSON.parse(res.stdout);
  } catch {
    throw new Error(`verification query returned unparseable output: ${res.stdout.slice(0, 200)}`);
  }
}

function verify() {
  const tables = query(
    `select table_name from information_schema.tables where table_schema='public' and table_name='${EXPECTED_TABLE}'`,
  ).map((r) => r.table_name);
  const functions = query(
    `select p.proname, pg_get_function_identity_arguments(p.oid) as args
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname in (${EXPECTED_FUNCTIONS.map((f) => `'${f}'`).join(', ')})
      order by 1`,
  );
  return { tables, functions, ...verdictFor(tables, functions) };
}

function report(v) {
  console.log(`  table    ${EXPECTED_TABLE}: ${v.tables.length ? 'present' : 'MISSING'}`);
  for (const f of EXPECTED_FUNCTIONS) {
    const hits = v.functions.filter((x) => x.proname === f);
    if (!hits.length) console.log(`  function ${f}: MISSING`);
    else for (const h of hits) console.log(`  function ${f}(${h.args})`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const verifyOnly = argv.includes('--verify');

  for (const file of USQUARE_MIGRATIONS) {
    if (!existsSync(path.join(repoRoot, file))) {
      console.error(`apply-usquare: ${file} does not exist. Refusing to run a partial sequence.`);
      process.exit(2);
    }
  }

  if (verifyOnly) {
    console.log('apply-usquare: verifying live schema (nothing will be sent).');
    const v = verify();
    report(v);
    console.log(v.ok ? '\napply-usquare: VERIFIED -- both migrations are live.' : `\napply-usquare: NOT APPLIED -- ${v.reasons.join('; ')}`);
    process.exit(v.ok ? 0 : 1);
  }

  console.log(`apply-usquare: ${dryRun ? 'DRY RUN' : 'applying'} ${USQUARE_MIGRATIONS.length} migrations in dependency order.\n`);
  for (const [i, file] of USQUARE_MIGRATIONS.entries()) {
    console.log(`--- [${i + 1}/${USQUARE_MIGRATIONS.length}] ${path.basename(file)}`);
    const res = runner(dryRun ? ['--file', file, '--dry-run'] : ['--file', file]);
    if (res.status !== 0) {
      console.error(`\napply-usquare: STOPPED at ${path.basename(file)} (exit ${res.status}).`);
      console.error('Nothing further was sent. The order matters, so a partial run is not resumed automatically --');
      console.error('fix the cause and re-run; both files are idempotent when applied in this order.');
      process.exit(res.status || 1);
    }
    console.log('');
  }

  if (dryRun) {
    console.log('apply-usquare: dry run complete. Both files parse and pass the runner gate.');
    return;
  }

  console.log('--- verifying live schema');
  const v = verify();
  report(v);
  if (!v.ok) {
    console.error(`\napply-usquare: FAILED verification -- ${v.reasons.join('; ')}`);
    process.exit(1);
  }

  // The history table already claims 20260917000000 (that ghost entry is what
  // made this whole situation invisible), so only 20260918000000 needs marking.
  // repair is idempotent, so re-stating both costs nothing and self-heals if the
  // ghost is ever cleaned up.
  console.log('\n--- reconciling migration history');
  for (const version of ['20260917000000', '20260918000000']) {
    const res = spawnSync('npx', ['--yes', 'supabase@latest', 'migration', 'repair', '--status', 'applied', version], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    process.stdout.write(res.stdout || '');
    if (res.status !== 0) {
      process.stderr.write(res.stderr || '');
      console.error(`apply-usquare: history repair for ${version} failed. The schema IS applied; only the CLI ledger is behind.`);
      process.exit(1);
    }
  }

  console.log('\napply-usquare: DONE. Schema verified live and history reconciled.');
  console.log('U-Square now reads real reaction counts and market pulse instead of nothing.');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('apply-usquare-migrations.mjs')) {
  await main();
}
