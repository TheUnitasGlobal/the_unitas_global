#!/usr/bin/env node
// ---------------------------------------------------------------------------
// resurrection-daemon.mjs -- Codex v41.0 제4장 자율 부활 데몬 (Self-Resurrecting
// Daemon). Trust-registry id: unitas.resurrection.daemon
//
// Founder directive 2026-09-17, MISSION 2 / FINAL_REPORT A-3.
//
// WHAT IT IS. Chapter 4 requires a Node watcher that, when agent computation
// has been interrupted for 60+ minutes (a system error, an API rate limit),
// does not simply wait: it self-checks every 10 minutes and resumes the
// terminal session on its own. Before this file that chapter had an
// implementation count of zero, and the v37 and v41 audits both recorded it as
// an open blocker.
//
// WHAT IT IS NOT. It is not UnitasIdleSensorStage3. That daemon waits for 10
// minutes of QUIET in order to start heavy E2E work and kills it the moment the
// founder touches anything. This one is the mirror image: it waits for 60
// minutes of quiet that should not have happened and restarts the agent. The
// two share a house style and share nothing else.
//
// EVERY DECISION IS PURE. scripts/resurrection-core.mjs holds the verdicts
// (armed/disarmed, halt, budget, backoff); this file only reads the disk,
// inspects the process table, spawns, and writes. That split is what makes the
// logic testable at all -- __tests__/doctrine/resurrectionCore.test.ts proves
// the decision table without ever launching a session.
//
// WHY ARMED/DISARMED IS THE WHOLE DESIGN. This daemon spends money. A watcher
// that cannot distinguish "the agent was cut off mid-task" from "the founder
// went to bed" will relaunch sessions all night and bill for every one of them
// -- which is not a bug in a Micro-Burn economy (제5장, 한계 비용 0원), it is a
// doctrine violation. So DISARMED is the resting state and the bar to arm is
// objective:
//
//   * the session armed it deliberately (`npm run resurrect:arm`), or
//   * the newest transcript's last conversational turn is a `user` turn that
//     never received an `assistant` reply -- a prompt submitted and never
//     answered, which is what an interrupted computation actually looks like.
//
// and the bar to fire on top of that is: 60+ minutes of silence, no live
// `claude` process, trust attestation green, no kill switch, and budget left
// (3 resumes per rolling 24 h with 60/120/240-minute backoff).
//
// EACH TICK (default 600 s -- the doctrine's 10-minute Self-Check):
//   1. self-attest against config/security/trust-registry.json; a failure
//      disables resuming for that tick (fail-closed, 제13장).
//   2. find the newest ~/.claude/projects/**/*.jsonl, read its tail, classify
//      the last conversational turn, scan for an API-stop marker.
//   3. auto-arm if work is in flight and we are not armed; disarm if the
//      transcript advanced past the armed anchor (the founder is back).
//   4. decideResume() -> if true, spawn the resume and record it.
//
// THE RESUME. `claude --resume <sessionId> -p "<directive>"`, detached, cwd =
// the git root, stdout/stderr appended to resurrection/daemon.log. The directive
// defaults to a conservative Korean instruction to re-read the milestone report
// and continue -- never "do whatever you want".
//
// KILL SWITCH. Create test-results/resurrection/DISARMED and this daemon will
// never resume again until the file is removed. It is checked every tick,
// before anything else, and it outranks an explicit arm.
//
// Usage (run from web/):
//   node scripts/resurrection-daemon.mjs                     # long-running (the scheduled task runs this)
//   node scripts/resurrection-daemon.mjs --once --dry-run    # one decision, print, change nothing
//   node scripts/resurrection-daemon.mjs --status            # founder-facing status block
//   node scripts/resurrection-daemon.mjs --arm --directive "..."   # arm before a long autonomous run
//   node scripts/resurrection-daemon.mjs --disarm            # stand down
// npm aliases: resurrect / resurrect:once / resurrect:status / resurrect:arm /
//              resurrect:disarm / resurrect:install-task
// Install as an at-logon task: scripts/install-resurrection-task.ps1
// ---------------------------------------------------------------------------

import { execFile, spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  DEFAULT_HALT_MS,
  DEFAULT_TICK_MS,
  MAX_RESUMES_PER_WINDOW,
  armState,
  claudeProcessesOf,
  decideResume,
  disarmState,
  emptyState,
  formatAge,
  isInFlight,
  isLockStale,
  lastConversationalEntry,
  parseArgs,
  parseState,
  rateLimitMarker,
  recordResume,
  shouldDisarm,
  summarize,
} from './resurrection-core.mjs';
import { verifyOnDisk } from './trust-registry.mjs';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, '..');
const OPS_DIR = path.resolve(WEB_DIR, '..'); // index.html
const REPO_DIR = path.resolve(OPS_DIR, '..'); // git root -- the session's cwd
const STATE_DIR = path.join(OPS_DIR, 'test-results', 'resurrection');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const LOCK_FILE = path.join(STATE_DIR, 'daemon.lock');
const LOG_FILE = path.join(STATE_DIR, 'daemon.log');
const KILL_SWITCH = path.join(STATE_DIR, 'DISARMED');
const TRANSCRIPT_ROOT = path.join(os.homedir(), '.claude', 'projects');

/** Read only the tail of a transcript: these files reach tens of MB and the
 *  decision only ever looks at the last few conversational turns. */
const TRANSCRIPT_TAIL_BYTES = 256 * 1024;

const DEFAULT_DIRECTIVE =
  '자율 부활 데몬(제4장)이 60분 이상 연산 중단을 감지해 세션을 재개했다. '
  + 'docs/rev21/MILESTONE_REPORT.md와 최근 커밋을 먼저 읽고, 중단된 지점부터 이어서 완결하라. '
  + '새 작업을 임의로 시작하지 말고, 제13장 게이트(typecheck·vitest·build EXIT 0)를 통과한 것만 커밋하라.';

function ensureDirs() {
  mkdirSync(STATE_DIR, { recursive: true });
}

/** @param {string} line */
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  try {
    appendFileSync(LOG_FILE, `${stamped}\n`, 'utf8');
  } catch {
    /* logging must never take the daemon down */
  }
}

function readState() {
  try {
    return parseState(JSON.parse(readFileSync(STATE_FILE, 'utf8')));
  } catch {
    return emptyState();
  }
}

/** @param {import('./resurrection-core.mjs').ResurrectionState} state */
function writeState(state) {
  ensureDirs();
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

// --- signals ---------------------------------------------------------------

/** Newest *.jsonl under ~/.claude/projects, with its mtime. */
async function newestTranscript() {
  /** @type {{ file: string, mtimeMs: number } | null} */
  let newest = null;
  /** @param {string} dir */
  async function walk(dir) {
    /** @type {import('node:fs').Dirent[]} */
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.name.endsWith('.jsonl')) continue;
      try {
        const s = await stat(full);
        if (!newest || s.mtimeMs > newest.mtimeMs) newest = { file: full, mtimeMs: s.mtimeMs };
      } catch {
        /* a transcript can vanish mid-walk */
      }
    }
  }
  await walk(TRANSCRIPT_ROOT);
  return newest;
}

/**
 * Parse the tail of a transcript into the shape the pure core expects.
 * @param {string} file
 * @returns {import('./resurrection-core.mjs').TranscriptEntry[]}
 */
function readTranscriptTail(file) {
  let raw = '';
  try {
    const buf = readFileSync(file);
    raw = buf.subarray(Math.max(0, buf.length - TRANSCRIPT_TAIL_BYTES)).toString('utf8');
  } catch {
    return [];
  }
  const lines = raw.split('\n');
  // The first line of a byte-offset tail is very likely truncated JSON.
  lines.shift();
  /** @type {import('./resurrection-core.mjs').TranscriptEntry[]} */
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (typeof o?.type !== 'string') continue;
      out.push({ type: o.type, timestamp: typeof o.timestamp === 'string' ? o.timestamp : undefined, text: extractText(o) });
    } catch {
      /* partial line */
    }
  }
  return out;
}

/** Flattens an entry's message content to searchable text (for stop markers). */
function extractText(entry) {
  const content = entry?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c?.text === 'string' ? c.text : ''))
      .filter(Boolean)
      .join(' ');
  }
  if (typeof entry?.message?.error === 'string') return entry.message.error;
  return '';
}

/** The Windows process table as {pid, command}. Empty on any failure -- an
 *  unreadable process table must not be read as "nothing is running", so the
 *  caller treats an empty table conservatively. */
async function processTable() {
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
      ],
      { maxBuffer: 16 * 1024 * 1024, windowsHide: true },
    );
    const parsed = JSON.parse(stdout);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .filter((r) => r && typeof r.ProcessId === 'number')
      .map((r) => ({ pid: r.ProcessId, command: typeof r.CommandLine === 'string' ? r.CommandLine : '' }));
  } catch {
    return null;
  }
}

/** This process plus its parent, so the daemon never mistakes itself for a
 *  live session. */
function ownPids() {
  return [process.pid, process.ppid].filter((n) => typeof n === 'number');
}

// --- single instance -------------------------------------------------------

async function liveProcessFor(pid) {
  const table = await processTable();
  if (!table) return null;
  const hit = table.find((p) => p.pid === pid);
  return hit ? { pid: hit.pid, procStart: null } : null;
}

async function acquireLock() {
  ensureDirs();
  /** @type {{ pid: number, procStart: string | null } | null} */
  let existing = null;
  try {
    existing = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
  } catch {
    existing = null;
  }
  if (existing) {
    const live = await liveProcessFor(existing.pid);
    if (!isLockStale(existing, live)) return false;
    log(`이전 lock(pid ${existing.pid})이 stale — 인수한다.`);
  }
  writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, procStart: null, acquiredAt: new Date().toISOString() }), 'utf8');
  return true;
}

function releaseLock() {
  try {
    const held = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
    if (held?.pid === process.pid) unlinkSync(LOCK_FILE);
  } catch {
    /* nothing to release */
  }
}

// --- the tick --------------------------------------------------------------

/**
 * @param {{ haltMs: number, dryRun: boolean }} options
 */
async function tick(options) {
  const now = Date.now();
  let state = readState();

  const attestation = await verifyOnDisk(OPS_DIR);
  const newest = await newestTranscript();
  const table = await processTable();
  const entries = newest ? readTranscriptTail(newest.file) : [];
  const inFlight = isInFlight(entries);
  const last = lastConversationalEntry(entries);
  const killSwitch = existsSync(KILL_SWITCH);

  const lastActivityMs = newest?.mtimeMs ?? 0;

  // Auto-disarm: the transcript moved past the anchor, so someone is driving.
  if (shouldDisarm(state, lastActivityMs)) {
    state = disarmState(state);
    if (!options.dryRun) writeState(state);
    log('활동 재개 감지 — DISARM.');
  }

  // Auto-arm: a user turn with no reply is work in flight.
  if (!state.armed && inFlight && newest) {
    const sessionId = path.basename(newest.file, '.jsonl');
    state = armState(state, {
      at: new Date(now).toISOString(),
      anchorAt: new Date(lastActivityMs).toISOString(),
      sessionId,
      transcriptPath: newest.file,
      by: 'auto',
      directive: state.directive ?? DEFAULT_DIRECTIVE,
    });
    if (!options.dryRun) writeState(state);
    log(`ARM (auto) — 세션 ${sessionId}, 마지막 턴 ${last?.type ?? '?'}.`);
  }

  const signals = {
    state,
    lastActivityMs,
    inFlight,
    // A process table we could not read is treated as "a session may be live",
    // which biases the daemon toward NOT resuming. Fail-closed both ways.
    claudeRunning: table === null ? true : claudeProcessesOf(table, ownPids()).length > 0,
    killSwitch,
    trusted: attestation.ok,
    rateLimit: rateLimitMarker(entries),
  };

  const verdict = decideResume(signals, now, { haltMs: options.haltMs });
  log(
    `tick: ${state.armed ? 'ARMED' : 'DISARMED'} · 무응답 ${formatAge(verdict.ageMs)} · `
    + `마지막 턴 ${last?.type ?? '없음'} · 부활 ${verdict.attempt}/${MAX_RESUMES_PER_WINDOW} · ${verdict.reason}`,
  );

  if (!verdict.resume) return { state, verdict, signals };
  if (options.dryRun) {
    log('--dry-run — 실제 부활은 수행하지 않는다.');
    return { state, verdict, signals };
  }

  const outcome = await resume(state);
  state = recordResume(state, {
    at: new Date().toISOString(),
    ok: outcome.ok,
    exitCode: outcome.exitCode,
    reason: verdict.reason,
  });
  // A resume re-anchors: the session it starts will advance the transcript,
  // and that advance must not immediately be read as "the founder is back".
  state = { ...state, anchorAt: new Date(Date.now()).toISOString() };
  writeState(state);
  return { state, verdict, signals };
}

/**
 * Spawn the resume. Detached and unref'd so the daemon's own lifetime never
 * bounds the session it just started.
 * @param {import('./resurrection-core.mjs').ResurrectionState} state
 */
function resume(state) {
  return new Promise((resolve) => {
    const directive = state.directive ?? DEFAULT_DIRECTIVE;
    const args = state.sessionId
      ? ['--resume', state.sessionId, '-p', directive]
      : ['--continue', '-p', directive];
    log(`부활 실행: claude ${args.slice(0, 2).join(' ')} -p "<directive ${directive.length}자>" (cwd ${REPO_DIR})`);
    let child;
    try {
      child = spawn('claude', args, {
        cwd: REPO_DIR,
        detached: true,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32', // `claude` is a .cmd shim on Windows
      });
    } catch (err) {
      log(`부활 실패 — spawn 오류: ${err instanceof Error ? err.message : String(err)}`);
      resolve({ ok: false, exitCode: null });
      return;
    }
    const sink = (buf) => {
      try {
        appendFileSync(LOG_FILE, buf.toString('utf8'), 'utf8');
      } catch {
        /* ignore */
      }
    };
    child.stdout?.on('data', sink);
    child.stderr?.on('data', sink);
    child.on('error', (err) => {
      log(`부활 실패 — ${err.message}`);
      resolve({ ok: false, exitCode: null });
    });
    child.on('exit', (code) => {
      log(`부활 세션 종료 코드 ${code}.`);
      resolve({ ok: code === 0, exitCode: code });
    });
    child.unref();
  });
}

// --- entry points ----------------------------------------------------------

async function statusBlock(haltMs) {
  const now = Date.now();
  const state = readState();
  const newest = await newestTranscript();
  const entries = newest ? readTranscriptTail(newest.file) : [];
  const table = await processTable();
  const attestation = await verifyOnDisk(OPS_DIR);
  const block = summarize(
    state,
    {
      lastActivityMs: newest?.mtimeMs ?? 0,
      inFlight: isInFlight(entries),
      claudeRunning: table === null ? true : claudeProcessesOf(table, ownPids()).length > 0,
      killSwitch: existsSync(KILL_SWITCH),
      trusted: attestation.ok,
    },
    now,
    { haltMs },
  );
  console.log('[자율 부활 데몬 · Codex 제4장]');
  console.log(block);
  console.log(`상태 파일  : ${STATE_FILE}`);
  console.log(`로그       : ${LOG_FILE}`);
  console.log(`킬 스위치  : ${KILL_SWITCH} ${existsSync(KILL_SWITCH) ? '(존재)' : '(없음)'}`);
  console.log(attestation.line);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const haltMs = args.haltMin * 60000;
  ensureDirs();

  if (args.status) {
    await statusBlock(haltMs);
    return;
  }

  if (args.disarm) {
    writeState(disarmState(readState()));
    log('DISARM (수동).');
    return;
  }

  if (args.arm) {
    const newest = await newestTranscript();
    const state = armState(readState(), {
      at: new Date().toISOString(),
      anchorAt: new Date(newest?.mtimeMs ?? Date.now()).toISOString(),
      sessionId: newest ? path.basename(newest.file, '.jsonl') : null,
      transcriptPath: newest?.file ?? null,
      by: 'session',
      directive: args.directive ?? DEFAULT_DIRECTIVE,
    });
    writeState(state);
    log(`ARM (수동) — 세션 ${state.sessionId ?? '미상'} · 임계 ${args.haltMin}분.`);
    return;
  }

  if (args.once) {
    await tick({ haltMs, dryRun: args.dryRun });
    return;
  }

  if (!(await acquireLock())) {
    console.error('자율 부활 데몬이 이미 구동 중이다 (daemon.lock). 종료.');
    process.exitCode = 0;
    return;
  }
  const shutdown = () => {
    releaseLock();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', releaseLock);

  log(`자율 부활 데몬 기동 — 임계 ${args.haltMin}분, Self-Check ${args.intervalSec}초 (제4장).`);
  // eslint-disable-next-line no-constant-condition
  for (;;) {
    try {
      await tick({ haltMs, dryRun: false });
    } catch (err) {
      log(`tick 실패(계속 구동): ${err instanceof Error ? err.message : String(err)}`);
    }
    await new Promise((r) => setTimeout(r, args.intervalSec * 1000));
  }
}

main().catch((err) => {
  log(`치명적 오류: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  releaseLock();
  process.exitCode = 1;
});

export { DEFAULT_DIRECTIVE, DEFAULT_HALT_MS, DEFAULT_TICK_MS };
