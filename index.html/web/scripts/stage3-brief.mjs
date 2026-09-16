#!/usr/bin/env node
// ---------------------------------------------------------------------------
// stage3-brief.mjs -- Codex ch.13 stage-3 morning brief (REV-36 M2).
// Trust-registry id: unitas.stage3.brief
//
// A SessionStart hook runs `node .../stage3-brief.mjs --hook` and injects the
// output into the session context, so a fresh or resumed session opens already
// knowing last night's 3-engine sweep result and reports it to the founder
// first -- without the founder ever opening test-results/stage3 by hand
// (docs/stage3/READER.md). The decision logic is pure in stage3-brief-core.mjs;
// this file only gathers the inputs.
//
//   node scripts/stage3-brief.mjs --hook   # the hook-context block (always exit 0)
//   node scripts/stage3-brief.mjs --json    # the brief + inputs as JSON
//   node scripts/stage3-brief.mjs           # the one line + details
// ---------------------------------------------------------------------------
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildBrief, briefToHookContext } from './stage3-brief-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, '..'); // index.html/web
const REPO_DIR = path.resolve(WEB_DIR, '..'); // index.html
const STAGE3_DIR = path.join(REPO_DIR, 'test-results', 'stage3');
const LATEST_JSON = path.join(STAGE3_DIR, 'latest.json');
const LATEST_MD = path.join(STAGE3_DIR, 'latest.md');
const LOCK_FILE = path.join(STAGE3_DIR, 'daemon.lock');
const BUILD_ID_FILE = path.join(WEB_DIR, '.next', 'BUILD_ID');
const TASK_NAME = 'UnitasIdleSensorStage3';

const HEADER = '[Stage-3 자율 브리핑 · Codex 제13장 3단계 · REV-36 M2]';

/** @param {string} p */
function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** current web/.next/BUILD_ID, or null */
function readBuildId() {
  try {
    return readFileSync(BUILD_ID_FILE, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

/** git HEAD via a bounded execFileSync, or null */
function readHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_DIR, timeout: 3000, windowsHide: true }).toString().trim() || null;
  } catch {
    return null;
  }
}

/** does daemon.lock point at a process that is alive? */
function lockAlive() {
  const lock = readJson(LOCK_FILE);
  if (!lock || typeof lock.pid !== 'number') return false;
  try {
    process.kill(lock.pid, 0); // signal 0: existence check, no signal sent
    return true;
  } catch {
    return false;
  }
}

/** scheduled-task state via schtasks; { installed, state } */
function taskState() {
  try {
    const out = execFileSync('schtasks', ['/query', '/tn', TASK_NAME, '/fo', 'LIST'], { timeout: 3000, windowsHide: true }).toString();
    const m = out.split(/\r?\n/).find((l) => /^Status:/i.test(l.trim()));
    const state = m ? m.split(':').slice(1).join(':').trim() : null;
    return { installed: true, state };
  } catch (err) {
    const msg = err && err.stderr ? err.stderr.toString() : err instanceof Error ? err.message : String(err);
    // "ERROR: The system cannot find the task specified." -> not installed.
    if (/cannot find|does not exist|ERROR:.*specified/i.test(msg)) return { installed: false, state: null };
    return { installed: false, state: null };
  }
}

/** trust attestation via the CLI module, guarded (lane A owns it). */
async function attestation() {
  try {
    const mod = await import('./trust-registry.mjs');
    if (typeof mod.verifyOnDisk !== 'function') return null;
    const res = await mod.verifyOnDisk();
    return { ok: Boolean(res.ok), line: String(res.line ?? '') };
  } catch {
    return null;
  }
}

async function gather() {
  const [att] = await Promise.all([attestation()]);
  return {
    latest: readJson(LATEST_JSON),
    latestMdExists: existsSync(LATEST_MD),
    buildId: readBuildId(),
    head: readHead(),
    lockAlive: lockAlive(),
    task: taskState(),
    attestation: att,
    now: Date.now(),
  };
}

async function main(argv) {
  const hook = argv.includes('--hook');
  const json = argv.includes('--json');
  let inputs;
  try {
    inputs = await gather();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (hook) {
      console.log(`${HEADER}\n간밤의 3엔진 E2E 전수 검사: 브리핑 수집 실패 (${reason}) — docs/stage3/READER.md 절차로 수동 확인`);
      process.exit(0);
    }
    console.error(`stage3-brief: ${reason}`);
    process.exit(hook ? 0 : 1);
  }

  const brief = buildBrief(inputs);

  if (hook) {
    console.log(briefToHookContext(brief));
    process.exit(0);
  }
  if (json) {
    console.log(JSON.stringify({ brief, inputs: { ...inputs, latest: inputs.latest ? { status: inputs.latest.status, buildId: inputs.latest.buildId, head: inputs.latest.head } : null } }, null, 2));
    process.exit(0);
  }
  console.log(brief.line);
  for (const d of brief.details) console.log(`  - ${d}`);
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main(process.argv.slice(2)).catch((err) => {
    // A brief must never break a session start.
    if (process.argv.includes('--hook')) {
      console.log(`${HEADER}\n간밤의 3엔진 E2E 전수 검사: 브리핑 수집 실패 (${err instanceof Error ? err.message : String(err)}) — docs/stage3/READER.md 절차로 수동 확인`);
      process.exit(0);
    }
    console.error(err);
    process.exit(1);
  });
}
