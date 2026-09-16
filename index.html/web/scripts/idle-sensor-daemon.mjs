#!/usr/bin/env node
// ---------------------------------------------------------------------------
// idle-sensor-daemon.mjs -- Codex ch.13 stage-3 executor (REV-35 M2, founder
// directive 2026-09-16, SPEC.md D-9 / D-10).
//
// Until REV-35 the doctrine's stage 3 ("after 10 idle minutes, run the
// 3-engine sweep quietly in the background") had NO executor: the v37 audit
// confirmed the harness works but nobody calls it. This daemon is that
// executor, and it is deliberately LOCAL and MODEL-FREE:
//   * local, because "the founder is idle" is a property of this machine
//     (Claude transcripts, git, the worktree, the keyboard) that no CI has;
//     GitHub Actions would bill minutes (0원 doctrine), run a Linux WebKit
//     that is not comparable with the REV-26/28 Windows WebKit baseline, and
//     strain a 7 GB runner with the 826-page build -- see docs/stage3/README.md;
//   * model-free, because launching `claude -p` from here would spend tokens
//     in the background. The forced tier "SONNET 5 / HIGH" binds the agent
//     that READS test-results/stage3/latest.md (docs/stage3/READER.md), not
//     this process.
//
// Every decision is a pure function in scripts/idle-sensor-core.mjs; this
// file only collects signals, spawns, kills and writes files.
//
// Each tick (default 60 s):
//   1. signals  transcript = newest ~/.claude/projects/**/*.jsonl mtime
//               git        = newest of .git/{index,logs/HEAD,HEAD,ORIG_HEAD,refs/heads/main}
//               worktree   = newest file under web/ (minus .next, node_modules,
//                            test-results, tsconfig.tsbuildinfo)
//               osInput    = Windows GetLastInputInfo (one PowerShell probe,
//                            which also returns the process table)
//               busy       = `next build` | `tsc --noEmit` | `sync-codex` |
//                            `playwright test` outside this daemon's own tree
//   2. computeIdle: every signal >= --idle-min old AND no busy process.
//   3. If idle, and web/.next/BUILD_ID exists (the daemon NEVER builds -- a
//      background build would race the Stop hook and rewrite .next under a
//      running server), and {BUILD_ID, git HEAD} was not already swept to
//      completion: spawn the sweep at IDLE priority
//        npx playwright test --config=tests/web-cinema.config.js --reporter=list,json --output=test-results/stage3-artifacts
//      with PLAYWRIGHT_JSON_OUTPUT_FILE=test-results/stage3/<ts>.json (the
//      --output keeps Playwright's start-of-run outputDir wipe off stage3/).
//   4. While it runs, keep polling; the instant any signal advances or a busy
//      process appears: `taskkill /PID <child> /T /F`, then kill a leftover
//      `next start` listener on :3123 (Playwright's reuseExistingServer:true
//      would otherwise serve a stale build to the next sweep), write a
//      'cancelled' record. Cancelled does NOT count as swept -- the next idle
//      window retries. Never kills node.exe by name (claude-mem worker, VS
//      Code's playwright test-server).
//   5. On exit: buildSummary -> <ts>.json (raw reporter output, written by
//      Playwright), latest.json (summary), latest.md (Korean briefing),
//      daemon.log (append).
//
// Single instance: test-results/stage3/daemon.lock {pid, procStart,
// acquiredAt}; a lock whose pid+creation-time no longer match a live process
// is stale and is taken over. The scheduled task (MultipleInstances IgnoreNew)
// is the second guard.
//
// Usage (run from web/):
//   node scripts/idle-sensor-daemon.mjs                       # long-running (the scheduled task runs this)
//   node scripts/idle-sensor-daemon.mjs --once --dry-run      # print signals + decision, exit
//   node scripts/idle-sensor-daemon.mjs --once                # one decision; sweep if idle
//   node scripts/idle-sensor-daemon.mjs --idle-min 10 --interval-sec 60
// Install as an at-logon task: scripts/install-idle-sensor-task.ps1
// ---------------------------------------------------------------------------

import { execFile, spawn } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  alreadySwept,
  buildSummary,
  busyProcessesOf,
  cancelReasons,
  computeIdle,
  isLockStale,
  listeningPids,
  NEXT_START_PATTERN,
  parseArgs,
  SIGNAL_NAMES,
  stateFromLatest,
  summaryToMarkdown,
  sweepKey,
} from './idle-sensor-core.mjs';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, '..'); // C:/dev/unitas/index.html/web
const REPO_DIR = path.resolve(WEB_DIR, '..'); // C:/dev/unitas/index.html  (Playwright cwd)
const GIT_DIR = path.resolve(REPO_DIR, '..', '.git'); // C:/dev/unitas/.git
const STAGE3_DIR = path.join(REPO_DIR, 'test-results', 'stage3');
// Playwright resolves tests/web-cinema.config.js's default outputDir to
// <nearest package.json dir>/test-results = index.html/test-results (config
// loader: `path.join(packageJsonDir, 'test-results')`) and REMOVES that folder
// when a run starts (measured
// 2026-09-16: the first forced sweep wiped stage3/ -- lock, log and all --
// from under the daemon). The sweep therefore gets its own sibling outputDir
// via --output; only that folder is cleared, stage3/ is never inside it, and
// the config file stays untouched for hand runs.
const SWEEP_ARTIFACTS_DIR = path.join(REPO_DIR, 'test-results', 'stage3-artifacts');
const BUILD_ID_FILE = path.join(WEB_DIR, '.next', 'BUILD_ID');
const PLAYWRIGHT_CLI = path.join(REPO_DIR, 'node_modules', '@playwright', 'test', 'cli.js');
const PLAYWRIGHT_CONFIG = 'tests/web-cinema.config.js';
const SWEEP_PORT = 3123;
const LOCK_FILE = path.join(STAGE3_DIR, 'daemon.lock');
const LOG_FILE = path.join(STAGE3_DIR, 'daemon.log');
const LATEST_JSON = path.join(STAGE3_DIR, 'latest.json');
const LATEST_MD = path.join(STAGE3_DIR, 'latest.md');
const TRANSCRIPT_ROOT = path.join(os.homedir(), '.claude', 'projects');
const TRANSCRIPT_MAX_DEPTH = 4; // projects/<project>/<session>/subagents/*.jsonl
const GIT_SIGNAL_FILES = ['index', path.join('logs', 'HEAD'), 'HEAD', 'ORIG_HEAD', path.join('refs', 'heads', 'main')];
const WORKTREE_EXCLUDED_NAMES = new Set(['.next', 'node_modules', 'test-results', 'tsconfig.tsbuildinfo']);
const WORKTREE_MAX_ENTRIES = 50_000;
const PROBE_TIMEOUT_MS = 45_000;
const HEARTBEAT_TICKS = 30;

const args = parseArgs(process.argv.slice(2));

// --- logging ---------------------------------------------------------------

/** @param {string} line */
function log(line) {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.log(stamped);
  if (args.dryRun) return;
  try {
    mkdirSync(STAGE3_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${stamped}\n`, 'utf8');
  } catch {
    /* the console line is enough when the log is unwritable */
  }
}

// --- Windows probe: last input + process table in ONE PowerShell call --------

/**
 * Add-Type + Get-CimInstance in a single process so a tick costs one
 * PowerShell start (~1 s), not two. Passed as -EncodedCommand: no quoting
 * layer between Node and PowerShell, and the daemon's own command line never
 * contains the busy-process pattern text.
 */
const PROBE_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$idle = -1
try {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class UnitasLastInput {
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  public static long IdleMs() {
    var info = new LASTINPUTINFO();
    info.cbSize = (uint)Marshal.SizeOf(info);
    if (!GetLastInputInfo(ref info)) return -1;
    return (long)(unchecked((uint)Environment.TickCount) - info.dwTime);
  }
}
'@
  $idle = [UnitasLastInput]::IdleMs()
} catch { $idle = -1 }
$procs = @(Get-CimInstance Win32_Process | ForEach-Object {
  $start = $null
  if ($_.CreationDate) { $start = [string]$_.CreationDate.ToFileTimeUtc() }
  [pscustomobject]@{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; start = $start; cmd = [string]$_.CommandLine }
})
[pscustomobject]@{ idleMs = [long]$idle; procs = $procs } | ConvertTo-Json -Compress -Depth 3
`;
const PROBE_ENCODED = Buffer.from(PROBE_SCRIPT, 'utf16le').toString('base64');

/**
 * @typedef {{ pid: number, ppid: number, procStart: string | null, commandLine: string }} LiveProcess
 */

/**
 * @returns {Promise<{ osInputAt: number | null, processes: LiveProcess[] | null }>}
 * Failure of either half is reported as null so computeIdle treats it as
 * activity (fail-closed) instead of guessing.
 */
async function probeWindows() {
  const now = Date.now();
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', PROBE_ENCODED],
      { windowsHide: true, timeout: PROBE_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout);
    const idleMs = Number(parsed?.idleMs);
    const osInputAt = Number.isFinite(idleMs) && idleMs >= 0 ? now - idleMs : null;
    const raw = Array.isArray(parsed?.procs) ? parsed.procs : null;
    const processes = raw
      ? raw
          .filter((p) => Number.isInteger(p?.pid))
          .map((p) => ({
            pid: Number(p.pid),
            ppid: Number.isInteger(p?.ppid) ? Number(p.ppid) : 0,
            procStart: typeof p?.start === 'string' && p.start ? p.start : null,
            commandLine: typeof p?.cmd === 'string' ? p.cmd : '',
          }))
      : null;
    return { osInputAt, processes };
  } catch (err) {
    log(`probe failed: ${err instanceof Error ? err.message : String(err)}`);
    return { osInputAt: null, processes: null };
  }
}

// --- file-system signals ----------------------------------------------------

/**
 * Newest Claude transcript across ALL projects (D-11), subagent transcripts
 * included: every founder message and every tool call bumps one of these.
 * @returns {Promise<{ at: number | null, file: string | null }>}
 */
async function transcriptSignal() {
  let newest = { at: /** @type {number | null} */ (null), file: /** @type {string | null} */ (null) };
  /** @param {string} dir @param {number} depth */
  const walk = async (dir, depth) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < TRANSCRIPT_MAX_DEPTH) await walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        try {
          const s = await stat(full);
          if (newest.at === null || s.mtimeMs > newest.at) newest = { at: s.mtimeMs, file: full };
        } catch {
          /* removed between readdir and stat */
        }
      }
    }
  };
  await walk(TRANSCRIPT_ROOT, 1);
  return newest;
}

/**
 * Git activity + the HEAD sha the sweep is keyed on. FETCH_HEAD is excluded
 * on purpose (background fetches). A missing optional file (ORIG_HEAD) is not
 * an error; an unreadable .git as a whole is (fail-closed via null).
 * @returns {Promise<{ at: number | null, head: string }>}
 */
async function gitSignal() {
  let at = /** @type {number | null} */ (null);
  let readable = 0;
  for (const rel of GIT_SIGNAL_FILES) {
    try {
      const s = await stat(path.join(GIT_DIR, rel));
      readable += 1;
      if (at === null || s.mtimeMs > at) at = s.mtimeMs;
    } catch {
      /* optional file absent */
    }
  }
  return { at: readable === 0 ? null : at, head: readHead() };
}

/** Resolve HEAD -> sha without spawning git (loose ref, then packed-refs). */
function readHead() {
  try {
    const head = readFileSync(path.join(GIT_DIR, 'HEAD'), 'utf8').trim();
    const ref = head.startsWith('ref: ') ? head.slice(5).trim() : null;
    if (!ref) return head;
    try {
      return readFileSync(path.join(GIT_DIR, ref), 'utf8').trim();
    } catch {
      const packed = readFileSync(path.join(GIT_DIR, 'packed-refs'), 'utf8');
      const line = packed.split(/\r?\n/).find((l) => l.endsWith(` ${ref}`));
      return line ? line.split(' ')[0] : 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

/**
 * Newest file under web/ minus build output, deps, test output and the tsc
 * incremental file (tsc --noEmit rewrites it -- that is what the busy-process
 * veto is for). Bounded walk; the tree is ~570 files today.
 * @returns {Promise<{ at: number | null, file: string | null }>}
 */
async function worktreeSignal() {
  let newest = { at: /** @type {number | null} */ (null), file: /** @type {string | null} */ (null) };
  let seen = 0;
  /** @param {string} dir */
  const walk = async (dir) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (WORKTREE_EXCLUDED_NAMES.has(entry.name)) continue;
      if (++seen > WORKTREE_MAX_ENTRIES) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        try {
          const s = await stat(full);
          if (newest.at === null || s.mtimeMs > newest.at) newest = { at: s.mtimeMs, file: full };
        } catch {
          /* removed mid-walk */
        }
      }
    }
  };
  await walk(WEB_DIR);
  return newest;
}

/** @returns {string | null} */
function readBuildId() {
  try {
    const id = readFileSync(BUILD_ID_FILE, 'utf8').trim();
    return id || null;
  } catch {
    return null;
  }
}

/**
 * @typedef {object} Snapshot
 * @property {import('./idle-sensor-core.mjs').Signals} signals
 * @property {LiveProcess[] | null} processes
 * @property {string} head
 * @property {Record<string, string | null>} sources
 * @property {number} now
 */

/** @returns {Promise<Snapshot>} */
async function collectSignals() {
  const [transcript, git, worktree, probe] = await Promise.all([transcriptSignal(), gitSignal(), worktreeSignal(), probeWindows()]);
  const busyProcesses = probe.processes
    ? busyProcessesOf(probe.processes, process.pid)
    : [{ pid: 0, commandLine: '(process table unreadable -- fail-closed)' }];
  return {
    signals: { transcript: transcript.at, git: git.at, worktree: worktree.at, osInput: probe.osInputAt, busyProcesses },
    processes: probe.processes,
    head: git.head,
    sources: { transcript: transcript.file, git: GIT_DIR, worktree: worktree.file, osInput: 'GetLastInputInfo' },
    now: Date.now(),
  };
}

/** @param {Snapshot} snap @param {ReturnType<typeof computeIdle>} verdict */
function describeSnapshot(snap, verdict) {
  const lines = SIGNAL_NAMES.map((name) => {
    const src = snap.sources[name];
    const shown = name === 'transcript' && src ? path.relative(TRANSCRIPT_ROOT, src) : name === 'worktree' && src ? path.relative(WEB_DIR, src) : '';
    return `  ${name.padEnd(10)} ${verdict.ages[name].padEnd(10)} ${shown}`.trimEnd();
  });
  const busy = snap.signals.busyProcesses ?? [];
  lines.push(`  ${'busy'.padEnd(10)} ${busy.length}${busy.length ? `  ${busy.map((b) => `[${b.pid}] ${b.commandLine}`).join(' | ')}` : ''}`);
  return lines.join('\n');
}

// --- lock -------------------------------------------------------------------

/** @returns {import('./idle-sensor-core.mjs').LockRecord | null} */
function readLock() {
  try {
    return JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {LiveProcess[] | null} processes
 * @returns {'acquired' | 'held-elsewhere'}
 */
function acquireLock(processes) {
  const existing = readLock();
  if (existing && existing.pid !== process.pid) {
    const live = processes?.find((p) => p.pid === existing.pid) ?? null;
    if (!isLockStale(existing, live && live.procStart ? { pid: live.pid, procStart: live.procStart } : null)) {
      return 'held-elsewhere';
    }
    log(`stale lock from pid ${existing.pid} taken over`);
  }
  const self = processes?.find((p) => p.pid === process.pid);
  mkdirSync(STAGE3_DIR, { recursive: true });
  writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, procStart: self?.procStart ?? 'unknown', acquiredAt: Date.now() }), 'utf8');
  return 'acquired';
}

function releaseLock() {
  try {
    const lock = readLock();
    if (lock && lock.pid === process.pid) unlinkSync(LOCK_FILE);
  } catch {
    /* already gone */
  }
}

// --- process control --------------------------------------------------------

/** @param {number} pid */
async function killTree(pid) {
  try {
    await execFileAsync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 30_000 });
    log(`killed process tree ${pid}`);
  } catch (err) {
    log(`taskkill ${pid}: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
}

/**
 * After a cancel, the webServer may survive as an orphan; kill ONLY a listener
 * on :3123 whose command line is a `next start` (never node.exe by name).
 * @param {LiveProcess[] | null} processes  fresh table, so the command line is checked, not assumed
 */
async function reapSweepPort(processes) {
  let netstat = '';
  try {
    netstat = (await execFileAsync('netstat.exe', ['-ano', '-p', 'TCP'], { windowsHide: true, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout;
  } catch (err) {
    log(`netstat failed: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  const pids = listeningPids(netstat, SWEEP_PORT);
  if (pids.length === 0) {
    log(`port ${SWEEP_PORT} is free`);
    return;
  }
  for (const pid of pids) {
    const proc = processes?.find((p) => p.pid === pid);
    if (proc && NEXT_START_PATTERN.test(proc.commandLine)) {
      log(`orphan next start on :${SWEEP_PORT} (pid ${pid}) -- killing`);
      await killTree(pid);
    } else {
      log(`pid ${pid} listens on :${SWEEP_PORT} but is not a next start (${proc ? proc.commandLine.slice(0, 80) : 'unknown command'}) -- left alone`);
    }
  }
}

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- the sweep --------------------------------------------------------------

/** @type {{ child: import('node:child_process').ChildProcess | null, cancelRequested: string | null }} */
const running = { child: null, cancelRequested: null };

/**
 * @param {{ buildId: string, head: string }} ids
 * @returns {Promise<import('./idle-sensor-core.mjs').SweepSummary>}
 */
async function runSweep(ids) {
  mkdirSync(STAGE3_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const rawJson = path.join(STAGE3_DIR, `${ts}.json`);
  const listLog = path.join(STAGE3_DIR, `${ts}.log`);
  const env = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: rawJson };
  delete env.CI; // CI mode would flip Playwright's `forbidOnly`/retry semantics away from the hand-run baseline
  const logFd = openSync(listLog, 'a');
  const startedAt = Date.now();
  const sweepArgs = ['test', `--config=${PLAYWRIGHT_CONFIG}`, '--reporter=list,json', `--output=${SWEEP_ARTIFACTS_DIR}`];
  log(`sweep started ${ts} for ${sweepKey(ids)} -- npx playwright ${sweepArgs.join(' ')} (cwd ${REPO_DIR})`);

  // `npx playwright` resolves to node + @playwright/test/cli.js; spawning that
  // directly makes child.pid the real Playwright process (so the IDLE priority
  // set below is what its workers, browsers and the webServer inherit) instead
  // of a cmd.exe shim whose grandchildren might be created before we lower it.
  const child = spawn(process.execPath, [PLAYWRIGHT_CLI, ...sweepArgs], {
    cwd: REPO_DIR,
    env,
    stdio: ['ignore', logFd, logFd],
    windowsHide: true,
  });
  closeSync(logFd);
  running.child = child;
  running.cancelRequested = null;

  const childPid = child.pid;
  if (childPid) {
    try {
      os.setPriority(childPid, os.constants.priority.PRIORITY_LOW); // 19 = Windows IDLE_PRIORITY_CLASS, inherited by the tree
    } catch (err) {
      log(`setPriority failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** @type {{ code: number | null, signal: NodeJS.Signals | null } | null} */
  let exit = null;
  const exited = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      exit = { code, signal };
      resolve(undefined);
    });
    child.once('error', (err) => {
      log(`spawn error: ${err.message}`);
      exit = { code: -1, signal: null };
      resolve(undefined);
    });
  });

  /** @type {LiveProcess[] | null} */
  let lastProcesses = null;
  while (exit === null) {
    await Promise.race([exited, sleep(args.intervalMs)]);
    if (exit !== null) break;
    if (running.cancelRequested === null) {
      const snap = await collectSignals();
      lastProcesses = snap.processes;
      const reasons = cancelReasons(snap.signals, startedAt, snap.now);
      if (reasons.length > 0) running.cancelRequested = reasons.join('; ');
    }
    if (running.cancelRequested !== null && childPid) {
      log(`cancelling sweep ${ts}: ${running.cancelRequested}`);
      await killTree(childPid);
      await exited;
      break;
    }
  }
  running.child = null;

  const cancelled = running.cancelRequested !== null;
  if (cancelled) {
    const fresh = lastProcesses ?? (await probeWindows()).processes;
    await reapSweepPort(fresh);
  }

  /** @type {unknown} */
  let raw = null;
  if (existsSync(rawJson)) {
    try {
      raw = JSON.parse(readFileSync(rawJson, 'utf8'));
    } catch (err) {
      log(`raw report unreadable: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const finishedAt = Date.now();
  const finalExit = /** @type {{ code: number | null, signal: NodeJS.Signals | null } | null} */ (exit);
  const summary = buildSummary(raw, {
    buildId: ids.buildId,
    head: ids.head,
    startedAt,
    finishedAt,
    cancelled,
    cancelReason: running.cancelRequested,
    exitCode: finalExit?.code ?? null,
  });
  if (raw === null) writeFileSync(rawJson, `${JSON.stringify(summary, null, 2)}\n`, 'utf8'); // killed before the reporter flushed
  writeFileSync(LATEST_JSON, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(LATEST_MD, summaryToMarkdown(summary), 'utf8');
  log(
    `sweep ${summary.status} ${ts} in ${Math.round(summary.durationMs / 1000)}s -- ` +
      `pass ${summary.totals.expected} fail ${summary.totals.unexpected} flaky ${summary.totals.flaky} skip ${summary.totals.skipped}` +
      (summary.status === 'cancelled' ? ' (not counted as swept)' : ''),
  );
  running.cancelRequested = null;
  return summary;
}

// --- main loop --------------------------------------------------------------

/** @type {{ sweptKeys: string[] }} */
let state = { sweptKeys: [] };
try {
  state = stateFromLatest(JSON.parse(readFileSync(LATEST_JSON, 'utf8')));
} catch {
  /* first run */
}

let lastDecisionLine = '';
let tickCount = 0;

/** One tick: collect, decide, log (verbosely in --once, on change otherwise), sweep when due. */
async function tick() {
  tickCount += 1;
  const snap = await collectSignals();
  const verdict = computeIdle(snap.signals, snap.now, { idleMs: args.idleMs });
  const buildId = readBuildId();
  const key = buildId ? sweepKey({ buildId, head: snap.head }) : null;
  const decision = !verdict.idle ? 'blocked' : !buildId ? 'no-build' : key && alreadySwept(state, key) ? 'swept' : 'idle';
  const decisionLine =
    decision === 'blocked'
      ? `NOT idle -- blockers: ${verdict.blockers.join(', ')}`
      : decision === 'no-build'
        ? 'idle, but no build (web/.next/BUILD_ID missing) -- the daemon never builds; skipped'
        : decision === 'swept'
          ? `idle, ${key} already swept -- waiting for a new BUILD_ID or HEAD`
          : `IDLE -- sweep due for ${key}`;

  const verbose = args.once || decisionLine !== lastDecisionLine || tickCount % HEARTBEAT_TICKS === 0;
  if (verbose) {
    log(`tick ${tickCount} idle-min ${args.idleMs / 60000} build ${buildId ?? '(none)'} head ${snap.head.slice(0, 7)}`);
    console.log(describeSnapshot(snap, verdict));
    if (!args.dryRun) {
      try {
        appendFileSync(LOG_FILE, `${describeSnapshot(snap, verdict)}\n`, 'utf8');
      } catch {
        /* console has it */
      }
    }
    log(`decision: ${decisionLine}`);
  }
  lastDecisionLine = decisionLine;

  if (decision !== 'idle' || args.dryRun || !buildId || !key) {
    if (decision === 'idle' && args.dryRun) log('dry-run: sweep NOT started');
    return;
  }
  const summary = await runSweep({ buildId, head: snap.head });
  if (summary.status !== 'cancelled') state = { sweptKeys: [...state.sweptKeys, key].slice(-20) };
}

async function shutdown(signalName) {
  log(`received ${signalName} -- shutting down`);
  if (running.child?.pid) {
    running.cancelRequested = `daemon received ${signalName}`;
    await killTree(running.child.pid);
    await reapSweepPort((await probeWindows()).processes);
  }
  releaseLock();
  process.exit(0);
}

async function main() {
  log(`idle-sensor daemon pid ${process.pid} -- ${args.once ? 'once' : 'loop'}${args.dryRun ? ' dry-run' : ''}, idle-min ${args.idleMs / 60000}, interval ${args.intervalMs / 1000}s`);
  if (!existsSync(PLAYWRIGHT_CLI)) {
    log(`Playwright CLI missing at ${PLAYWRIGHT_CLI} -- run npm install in ${REPO_DIR}`);
    process.exit(2);
  }

  if (!args.dryRun) {
    const first = await probeWindows();
    if (acquireLock(first.processes) === 'held-elsewhere') {
      log(`another daemon holds ${LOCK_FILE} -- exiting`);
      process.exit(3);
    }
    for (const sig of /** @type {NodeJS.Signals[]} */ (['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP'])) {
      process.on(sig, () => void shutdown(sig));
    }
    process.on('exit', releaseLock);
  }

  if (args.once) {
    await tick();
    releaseLock();
    return;
  }
  for (;;) {
    try {
      await tick();
    } catch (err) {
      log(`tick failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    }
    await sleep(args.intervalMs);
  }
}

main().catch((err) => {
  log(`fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  releaseLock();
  process.exit(1);
});
