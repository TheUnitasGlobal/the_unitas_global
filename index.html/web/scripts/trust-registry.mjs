#!/usr/bin/env node
// ---------------------------------------------------------------------------
// trust-registry.mjs -- Codex ch.15 stage-3 Trust Registry CLI + attestation.
// Trust-registry id: unitas.trust-registry.cli
//
// Reads config/security/trust-registry.json, hashes the pinned files off disk,
// and compares. The decision logic is pure in trust-registry-core.mjs; this
// file is the fs + process shell around it.
//
//   node scripts/trust-registry.mjs --verify   # exit 1 on mismatch/missing/unstamped
//   node scripts/trust-registry.mjs --write     # refresh every present file's sha256
//   node scripts/trust-registry.mjs --json      # the verdict as JSON
//
// The daemon imports verifyOnDisk() and self-attests at startup and on every
// heartbeat; a failed attestation disables the sweep (fail-closed).
// ---------------------------------------------------------------------------
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { attestationLine, compareDigests, fileEntries, parseRegistry, stampRegistry } from './trust-registry-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** index.html -- the root the registry's file paths are relative to. */
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..');

/** @param {string} repoRoot */
function registryPath(repoRoot) {
  return path.join(repoRoot, 'config', 'security', 'trust-registry.json');
}

/** sha256 of a file's raw bytes, or null when it is absent. @param {string} abs */
function digestOf(abs) {
  try {
    return createHash('sha256').update(readFileSync(abs)).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Read the registry and the on-disk digests of every file entry.
 * @param {string} repoRoot
 * @returns {{ reg: import('./trust-registry-core.mjs').Registry, actual: Record<string, string | null>, regPath: string }}
 */
function load(repoRoot) {
  const regPath = registryPath(repoRoot);
  const reg = parseRegistry(JSON.parse(readFileSync(regPath, 'utf8')));
  /** @type {Record<string, string | null>} */
  const actual = {};
  for (const e of fileEntries(reg)) {
    actual[e.path] = digestOf(path.join(repoRoot, e.path));
  }
  return { reg, actual, regPath };
}

/**
 * The daemon's self-attestation entry point. Never throws.
 * @param {string} [repoRoot]
 * @returns {Promise<{ ok: boolean, verdict: import('./trust-registry-core.mjs').VerifyVerdict | null, line: string }>}
 */
export async function verifyOnDisk(repoRoot = DEFAULT_REPO_ROOT) {
  try {
    const { reg, actual } = load(repoRoot);
    const verdict = compareDigests(reg, actual);
    return { ok: verdict.ok, verdict, line: attestationLine(verdict) };
  } catch (err) {
    return { ok: false, verdict: null, line: `신뢰 등록 검증 실패 -- 등록부를 읽을 수 없음 (${err instanceof Error ? err.message : String(err)})` };
  }
}

/** @param {string[]} argv */
async function main(argv) {
  const repoRoot = DEFAULT_REPO_ROOT;
  const write = argv.includes('--write');
  const json = argv.includes('--json');

  let loaded;
  try {
    loaded = load(repoRoot);
  } catch (err) {
    console.error(`trust-registry: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const { reg, actual, regPath } = loaded;

  if (write) {
    // updatedAt comes from the CLI, never from the pure core (which is
    // clock-free so it stays deterministic under test).
    const stamped = stampRegistry(reg, actual, new Date().toISOString());
    writeFileSync(regPath, `${JSON.stringify(stamped, null, 2)}\n`, 'utf8');
    const verdict = compareDigests(stamped, actual);
    console.log(`trust-registry: stamped ${verdict.verified.length} file(s)${verdict.pending.length ? `, ${verdict.pending.length} pending` : ''}`);
    console.log(attestationLine(verdict));
    process.exit(0);
  }

  const verdict = compareDigests(reg, actual);
  if (json) {
    console.log(JSON.stringify(verdict, null, 2));
    process.exit(verdict.ok ? 0 : 1);
  }

  console.log(attestationLine(verdict));
  for (const id of verdict.verified) console.log(`  OK       ${id}`);
  for (const id of verdict.pending) console.log(`  대기     ${id} (파일 아직 없음, optional)`);
  for (const id of verdict.unstamped) console.log(`  미각인   ${id} (존재하나 sha256 없음 -- --write 필요)`);
  for (const m of verdict.mismatched) console.log(`  불일치   ${m.id}  ${m.path}`);
  for (const id of verdict.missing) console.log(`  누락     ${id}`);
  process.exit(verdict.ok ? 0 : 1);
}

// Run only when invoked directly (not when the daemon imports verifyOnDisk).
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main(process.argv.slice(2));
}
