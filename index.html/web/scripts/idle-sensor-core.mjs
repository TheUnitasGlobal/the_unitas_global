/**
 * REV-35 M2 -- Codex ch.13 stage-3 idle sensor, PURE core (founder directive
 * 2026-09-16, SPEC.md D-9).
 *
 * Every decision the daemon (scripts/idle-sensor-daemon.mjs) makes lives here
 * as a function of plain values: no fs, no process, no clock. The daemon only
 * collects signals and executes what this module decides, so the whole
 * predicate table can be proven in vitest (__tests__/stage3) without a
 * scheduler, a browser or a running Next server -- SPEC.md D-10 (a).
 *
 * Signal model. A signal is the epoch-ms timestamp of the LAST activity seen
 * on one channel. Four channels, measured live on 2026-09-16 (SPEC.md §1.7):
 *   transcript -- newest Claude transcript (~/.claude/projects/** /*.jsonl);
 *                 advances on every founder message and every tool call, so it
 *                 is the primary signal. Other Claude projects count too
 *                 (D-11): a session elsewhere still means the founder is here.
 *   git        -- .git/{index,logs/HEAD,HEAD,ORIG_HEAD,refs/heads/main};
 *                 FETCH_HEAD is deliberately absent (background fetches would
 *                 make the machine never idle).
 *   worktree   -- newest file under web/ (minus .next, node_modules,
 *                 test-results, tsconfig.tsbuildinfo).
 *   osInput    -- Windows GetLastInputInfo. It read 85-99 min idle WHILE a
 *                 Claude session was mid-work, so it is a necessary condition,
 *                 never a sufficient one -- hence the AND across all four.
 * Plus a busy-process veto: `next build`, `tsc --noEmit`, `sync-codex` and
 * `playwright test` running anywhere outside the daemon's own tree block a
 * sweep even before they touch a file (the Stop hook's first seconds).
 *
 * Fail-closed (Codex ch.4 / ch.11): a signal that could not be read is treated
 * as activity NOW. A sweep that cannot prove idleness never starts.
 */

/** @typedef {'transcript' | 'git' | 'worktree' | 'osInput'} SignalName */

/**
 * @typedef {object} BusyProcess
 * @property {number} pid
 * @property {string} commandLine
 */

/**
 * @typedef {object} Signals
 * @property {number | null | undefined} [transcript]
 * @property {number | null | undefined} [git]
 * @property {number | null | undefined} [worktree]
 * @property {number | null | undefined} [osInput]
 * @property {BusyProcess[]} [busyProcesses]
 */

/**
 * @typedef {'harness-flake' | 'contract-drift' | 'product-defect'} FailureKind
 */

/**
 * @typedef {object} FailureRecord
 * @property {string} project
 * @property {string} file
 * @property {string} title
 * @property {string} error
 * @property {FailureKind} kind
 */

/**
 * @typedef {object} ProjectCounts
 * @property {number} expected
 * @property {number} unexpected
 * @property {number} flaky
 * @property {number} skipped
 */

/**
 * @typedef {'passed' | 'failed' | 'cancelled'} SweepStatus
 */

/**
 * @typedef {object} SweepSummary
 * @property {SweepStatus} status
 * @property {string} buildId
 * @property {string} head
 * @property {string} startedAt   ISO 8601
 * @property {string} finishedAt  ISO 8601
 * @property {number} durationMs
 * @property {Record<string, ProjectCounts>} perProject
 * @property {ProjectCounts} totals
 * @property {FailureRecord[]} failures
 * @property {string | null} cancelReason
 * @property {number | null} exitCode
 */

/**
 * @typedef {object} LockRecord
 * @property {number} pid
 * @property {string} procStart
 * @property {number} acquiredAt
 */

/** The four activity channels, in the order the daemon prints them. */
export const SIGNAL_NAMES = /** @type {const} */ (['transcript', 'git', 'worktree', 'osInput']);

/** Codex ch.13 stage 3: ten minutes of silence on every channel. */
export const DEFAULT_IDLE_MS = 10 * 60 * 1000;

/** The three engines tests/web-cinema.config.js runs, in config order. */
export const PROJECT_NAMES = /** @type {const} */ (['chromium', 'webkit', 'mobile-chrome']);

/**
 * REV-33 FINAL_REPORT L24-27: the last hand-run 3-engine sweep, the yardstick
 * latest.md compares every automated sweep against.
 */
export const BASELINE = Object.freeze({ label: 'REV-33', expected: 587, skipped: 33, total: 621 });

/**
 * Busy-process veto. Anchored so that VS Code's `@playwright/test test-server`
 * does NOT match (`test\b(?!-)` rejects `test-server`) while `playwright test`,
 * `playwright.cmd test` and `cli.js test` do.
 */
export const BUSY_COMMAND_PATTERN =
  /\bnext(?:\.js|\.cmd|")?\s+build\b|\btsc(?:\.js|\.cmd|")?\s+--noEmit\b|sync-codex|playwright(?:\S*)\s+test\b(?!-)/i;

/**
 * A `next start` listener on the sweep port, the only thing the daemon may
 * kill by PID besides its own tree (Playwright's `reuseExistingServer: true`
 * would otherwise let a cancelled sweep's orphan serve the NEXT sweep a stale
 * build).
 */
export const NEXT_START_PATTERN = /\bnext(?:\.js|\.cmd|")?\s+start\b/i;

/** @param {unknown} v */
function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Human-readable age; `null` for an unreadable signal.
 * @param {number | null | undefined} lastActivityMs
 * @param {number} now
 */
export function formatAge(lastActivityMs, now) {
  if (!isFiniteNumber(lastActivityMs)) return 'unreadable';
  const s = Math.max(0, Math.round((now - lastActivityMs) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60 ? ` ${s % 60}s` : ''}`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * The stage-3 idle predicate: every signal at least `idleMs` old AND no busy
 * process anywhere. Blockers name what stops the sweep so the daemon log (and
 * the D-10 live check) says exactly which channel is alive.
 *
 * @param {Signals} signals
 * @param {number} now
 * @param {{ idleMs?: number }} [options]
 * @returns {{ idle: boolean, blockers: string[], ages: Record<SignalName, string> }}
 */
export function computeIdle(signals, now, options = {}) {
  const idleMs = isFiniteNumber(options.idleMs) ? options.idleMs : DEFAULT_IDLE_MS;
  /** @type {string[]} */
  const blockers = [];
  /** @type {Record<string, string>} */
  const ages = {};
  for (const name of SIGNAL_NAMES) {
    const ts = signals[name];
    ages[name] = formatAge(ts, now);
    if (!isFiniteNumber(ts)) {
      blockers.push(`${name} (unreadable)`);
    } else if (now - ts < idleMs) {
      blockers.push(`${name} (${ages[name]} ago)`);
    }
  }
  for (const proc of signals.busyProcesses ?? []) {
    blockers.push(`busy:${proc.commandLine.trim()} (pid ${proc.pid})`);
  }
  return { idle: blockers.length === 0, blockers, ages: /** @type {Record<SignalName, string>} */ (ages) };
}

/**
 * Why a running sweep must stop: a signal timestamp newer than the moment the
 * sweep started, an unreadable signal (fail-closed), or a busy process that
 * appeared. Empty array = keep sweeping.
 *
 * @param {Signals} signals
 * @param {number} sweepStartedAt
 * @param {number} now
 * @returns {string[]}
 */
export function cancelReasons(signals, sweepStartedAt, now) {
  /** @type {string[]} */
  const reasons = [];
  for (const name of SIGNAL_NAMES) {
    const ts = signals[name];
    if (!isFiniteNumber(ts)) {
      reasons.push(`${name} became unreadable`);
    } else if (ts > sweepStartedAt) {
      reasons.push(`${name} advanced ${formatAge(ts, now)} ago (sweep started ${formatAge(sweepStartedAt, now)} ago)`);
    }
  }
  for (const proc of signals.busyProcesses ?? []) {
    reasons.push(`busy process appeared: ${proc.commandLine.trim()} (pid ${proc.pid})`);
  }
  return reasons;
}

/**
 * Cancel-in-progress predicate (Codex ch.13 stage 3 "준비"/new-command rule):
 * true the instant any channel moves past the sweep start or a busy process
 * shows up.
 *
 * @param {Signals} signals
 * @param {number} sweepStartedAt
 * @param {number} now
 */
export function shouldCancel(signals, sweepStartedAt, now) {
  return cancelReasons(signals, sweepStartedAt, now).length > 0;
}

/**
 * One sweep per build: the identity of what was tested.
 * @param {{ buildId: string, head: string }} ids
 */
export function sweepKey({ buildId, head }) {
  return `${buildId}@${head}`;
}

/**
 * A key counts as swept only when a sweep RAN TO COMPLETION for it; cancelled
 * records never enter `sweptKeys`, so the next idle window retries (D-9).
 *
 * @param {{ sweptKeys?: readonly string[] } | null | undefined} state
 * @param {string} key
 */
export function alreadySwept(state, key) {
  return Array.isArray(state?.sweptKeys) && state.sweptKeys.includes(key);
}

/**
 * Derive the persisted swept-set from the last summary on disk, so a daemon
 * restart (logon, RestartCount) does not re-run a build it already finished.
 * @param {Partial<SweepSummary> | null | undefined} latest
 * @returns {{ sweptKeys: string[] }}
 */
export function stateFromLatest(latest) {
  if (!latest || (latest.status !== 'passed' && latest.status !== 'failed')) return { sweptKeys: [] };
  if (typeof latest.buildId !== 'string' || typeof latest.head !== 'string') return { sweptKeys: [] };
  return { sweptKeys: [sweepKey({ buildId: latest.buildId, head: latest.head })] };
}

const ANSI_PATTERN = /\[[0-9;]*[A-Za-z]/g;

/** Playwright colours its error text; the summary must be plain. @param {string} s */
export function stripAnsi(s) {
  return s.replace(ANSI_PATTERN, '');
}

/**
 * Rule 1 text: the REV-26/28 WebKit harness has no GPU path (555-698 ms per
 * frame), so WebGL/GPU probes and frame-wait timeouts there are the harness,
 * not the product.
 */
const FLAKE_ERROR_PATTERN =
  /WebGL|\bGPU\b|Test timeout of \d+ms exceeded|Timeout \d+ms exceeded|waiting for [^\n]*frame|requestAnimationFrame|Target (?:page|context|browser)[^\n]*closed/i;

/** Rule 2 text: the assertion is about copy, not behaviour. */
const DRIFT_TITLE_PATTERN = /\bi18n\b|\blocale\b|\btranslation\b|\bcopy\b|\bwording\b|\bmessages?\.json\b/i;
const DRIFT_ERROR_PATTERN =
  /toHaveText|toContainText|toHaveTitle|toHaveAccessibleName|toHaveAttribute\((?:"|')(?:aria-label|title|alt|placeholder)|Expected (?:string|substring|pattern):/i;

/**
 * The three founder rules (SPEC.md D-9), in priority order:
 *   1. harness-flake   -- webkit-only failure (same spec passed on every other
 *                         project that ran it) OR error text about WebGL / GPU
 *                         / a frame-wait timeout.
 *   2. contract-drift  -- the assertion is on locale text, i18n keys or title
 *                         copy (test title or file names it, or the matcher is
 *                         a text matcher).
 *   3. product-defect  -- everything else.
 *
 * @param {{ project: string, file?: string, title: string, error?: string, otherProjectsPassed?: boolean }} test
 * @returns {FailureKind}
 */
export function classifyFailure(test) {
  const error = stripAnsi(test.error ?? '');
  const isWebkit = test.project === 'webkit';
  if (isWebkit && test.otherProjectsPassed === true) return 'harness-flake';
  if (isWebkit && FLAKE_ERROR_PATTERN.test(error)) return 'harness-flake';
  if (/WebGL|\bGPU\b/i.test(error)) return 'harness-flake';
  const titleAndFile = `${test.title} ${test.file ?? ''}`;
  if (DRIFT_TITLE_PATTERN.test(titleAndFile) || DRIFT_ERROR_PATTERN.test(error)) return 'contract-drift';
  return 'product-defect';
}

/** @returns {ProjectCounts} */
function emptyCounts() {
  return { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
}

/**
 * Depth-first walk of the Playwright JSON reporter tree
 * (suites -> specs -> tests -> results; suites nest for describe blocks).
 * Yields one row per (spec, project) with the describe path folded into the
 * title, which is what a reader greps for in the list-reporter log.
 *
 * @param {any} json
 * @returns {Array<{ file: string, title: string, project: string, status: string, error: string }>}
 */
function flattenTests(json) {
  /** @type {Array<{ file: string, title: string, project: string, status: string, error: string }>} */
  const rows = [];
  /** @param {any} suite @param {string[]} path */
  const walk = (suite, path) => {
    if (!suite || typeof suite !== 'object') return;
    const file = typeof suite.file === 'string' ? suite.file : '';
    // Playwright names the file-level suite after the file itself; only
    // describe() titles below it belong in the path.
    const nextPath = suite.title && suite.title !== file ? [...path, String(suite.title)] : path;
    for (const spec of Array.isArray(suite.specs) ? suite.specs : []) {
      const title = [...nextPath, String(spec?.title ?? '')].filter(Boolean).join(' › ');
      for (const test of Array.isArray(spec?.tests) ? spec.tests : []) {
        const results = Array.isArray(test?.results) ? test.results : [];
        const lastError = results.map((r) => r?.error?.message ?? r?.errors?.[0]?.message ?? '').filter(Boolean).pop();
        rows.push({
          file: typeof spec?.file === 'string' ? spec.file : file,
          title,
          project: String(test?.projectName ?? 'unknown'),
          status: String(test?.status ?? 'unknown'),
          error: stripAnsi(lastError ?? ''),
        });
      }
    }
    for (const child of Array.isArray(suite.suites) ? suite.suites : []) walk(child, nextPath);
  };
  for (const suite of Array.isArray(json?.suites) ? json.suites : []) walk(suite, []);
  return rows;
}

/**
 * Turn a raw Playwright JSON report (possibly absent, when the sweep was
 * killed before the reporter flushed) plus run metadata into the stage-3
 * summary that latest.json persists.
 *
 * @param {any} playwrightJson  parsed JSON reporter output, or null
 * @param {{ buildId: string, head: string, startedAt: string | number | Date, finishedAt: string | number | Date, cancelled?: boolean, cancelReason?: string | null, exitCode?: number | null }} meta
 * @returns {SweepSummary}
 */
export function buildSummary(playwrightJson, meta) {
  /** @type {Record<string, ProjectCounts>} */
  const perProject = {};
  for (const name of PROJECT_NAMES) perProject[name] = emptyCounts();
  const rows = flattenTests(playwrightJson);

  /** @type {Map<string, Map<string, string>>} spec id -> project -> status */
  const byId = new Map();
  for (const row of rows) {
    const id = `${row.file}::${row.title}`;
    if (!byId.has(id)) byId.set(id, new Map());
    byId.get(id)?.set(row.project, row.status);
    const bucket = perProject[row.project] ?? (perProject[row.project] = emptyCounts());
    if (row.status === 'expected' || row.status === 'unexpected' || row.status === 'flaky' || row.status === 'skipped') {
      bucket[row.status] += 1;
    }
  }

  /** @type {FailureRecord[]} */
  const failures = rows
    .filter((row) => row.status === 'unexpected')
    .map((row) => {
      const others = [...(byId.get(`${row.file}::${row.title}`)?.entries() ?? [])].filter(([p]) => p !== row.project);
      const otherProjectsPassed = others.length > 0 && others.every(([, s]) => s === 'expected' || s === 'flaky');
      const kind = classifyFailure({ project: row.project, file: row.file, title: row.title, error: row.error, otherProjectsPassed });
      return { project: row.project, file: row.file, title: row.title, error: row.error, kind };
    });

  const totals = emptyCounts();
  for (const counts of Object.values(perProject)) {
    totals.expected += counts.expected;
    totals.unexpected += counts.unexpected;
    totals.flaky += counts.flaky;
    totals.skipped += counts.skipped;
  }

  const started = new Date(meta.startedAt);
  const finished = new Date(meta.finishedAt);
  const cancelled = meta.cancelled === true;
  /** @type {SweepStatus} */
  const status = cancelled ? 'cancelled' : totals.unexpected > 0 || !playwrightJson || (meta.exitCode ?? 0) !== 0 ? 'failed' : 'passed';

  return {
    status,
    buildId: meta.buildId,
    head: meta.head,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: Math.max(0, finished.getTime() - started.getTime()),
    perProject,
    totals,
    failures,
    cancelReason: cancelled ? (meta.cancelReason ?? 'activity detected') : null,
    exitCode: isFiniteNumber(meta.exitCode) ? meta.exitCode : null,
  };
}

/** @type {Record<FailureKind, string>} */
const KIND_LABEL = {
  'harness-flake': '하네스 플레이크',
  'contract-drift': '계약 드리프트',
  'product-defect': '제품 결함',
};

/** @type {Record<SweepStatus, string>} */
const STATUS_LABEL = { passed: '통과', failed: '실패', cancelled: '취소됨 (활동 감지)' };

/** @param {number} ms */
function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m ${s % 60}s` : m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

/** @param {number} n */
function signed(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * latest.md -- the human page the READER.md agent opens first. Korean
 * headings (the founder's language), a per-project totals table, the delta
 * against the REV-33 baseline and the classified failure list.
 *
 * @param {SweepSummary} summary
 */
export function summaryToMarkdown(summary) {
  const lines = [
    '# 3단계 전수 검증 결과 (Codex 제13장 · 3엔진)',
    '',
    `- **상태:** ${STATUS_LABEL[summary.status] ?? summary.status}`,
    `- **빌드:** \`${summary.buildId}\` · **HEAD:** \`${summary.head}\``,
    `- **시작:** ${summary.startedAt} · **종료:** ${summary.finishedAt} · **소요:** ${formatDuration(summary.durationMs)}`,
  ];
  if (summary.status === 'cancelled') lines.push(`- **취소 사유:** ${summary.cancelReason ?? ''}`);
  if (summary.exitCode !== null) lines.push(`- **Playwright 종료 코드:** ${summary.exitCode}`);
  lines.push('', '## 프로젝트별 합계', '', '| 프로젝트 | 통과 | 실패 | 플레이크 | 스킵 |', '|---|---:|---:|---:|---:|');
  for (const [name, c] of Object.entries(summary.perProject)) {
    lines.push(`| ${name} | ${c.expected} | ${c.unexpected} | ${c.flaky} | ${c.skipped} |`);
  }
  const t = summary.totals;
  lines.push(`| **합계** | **${t.expected}** | **${t.unexpected}** | **${t.flaky}** | **${t.skipped}** |`);

  lines.push(
    '',
    `## 기준선 대비 (${BASELINE.label}: 통과 ${BASELINE.expected} · 스킵 ${BASELINE.skipped} · 총 ${BASELINE.total})`,
    '',
    `- 통과 ${t.expected} (${signed(t.expected - BASELINE.expected)})`,
    `- 스킵 ${t.skipped} (${signed(t.skipped - BASELINE.skipped)})`,
    `- 총 ${t.expected + t.unexpected + t.flaky + t.skipped} (${signed(t.expected + t.unexpected + t.flaky + t.skipped - BASELINE.total)})`,
  );
  if (summary.status === 'cancelled') lines.push('- 취소된 스윕은 부분 집계이므로 기준선과 직접 비교하지 않는다.');

  lines.push('', '## 실패 분류', '');
  if (summary.failures.length === 0) {
    lines.push(summary.status === 'cancelled' ? '_(취소 시점까지 실패 없음)_' : '_(실패 없음)_');
  } else {
    for (const kind of /** @type {FailureKind[]} */ (['product-defect', 'contract-drift', 'harness-flake'])) {
      const group = summary.failures.filter((f) => f.kind === kind);
      if (group.length === 0) continue;
      lines.push(`### ${KIND_LABEL[kind]} (${group.length})`, '');
      for (const f of group) {
        const firstLine = f.error.split(/\r?\n/).find((l) => l.trim()) ?? '';
        lines.push(`- **[${f.project}]** \`${f.file}\` -- ${f.title}${firstLine ? `  \n  \`${firstLine.trim()}\`` : ''}`);
      }
      lines.push('');
    }
  }
  lines.push('', '_읽는 법: docs/stage3/READER.md_', '');
  return lines.join('\n');
}

/**
 * A lock is stale when nothing alive matches BOTH its pid and its process
 * creation time (Windows recycles PIDs, so pid alone could point at an
 * unrelated process that happens to reuse the number).
 *
 * @param {Partial<LockRecord> | null | undefined} lock
 * @param {{ pid: number, procStart: string | number } | null | undefined} liveProcess  the live process with lock.pid, or null
 */
export function isLockStale(lock, liveProcess) {
  if (!lock || !isFiniteNumber(lock.pid) || lock.procStart === undefined || lock.procStart === null) return true;
  if (!liveProcess || liveProcess.pid !== lock.pid) return true;
  return String(liveProcess.procStart) !== String(lock.procStart);
}

/**
 * PIDs that own a LISTENING socket on `port`, from `netstat -ano` text.
 * Parsed here so the daemon's only process-killing decision besides its own
 * tree is unit-testable.
 *
 * @param {string} netstatText
 * @param {number} port
 * @returns {number[]}
 */
export function listeningPids(netstatText, port) {
  /** @type {Set<number>} */
  const pids = new Set();
  for (const line of netstatText.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5 || cols[0] !== 'TCP' || cols[3] !== 'LISTENING') continue;
    if (!new RegExp(`:${port}$`).test(cols[1])) continue;
    const pid = Number(cols[4]);
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

/**
 * Transitive descendants of `rootPid` (plus the root) from a {pid, ppid}
 * list -- the daemon excludes its own tree (the PowerShell probe, the
 * Playwright child, its browsers and the `next start` webServer) from the
 * busy-process veto, otherwise the sweep would cancel itself.
 *
 * @param {ReadonlyArray<{ pid: number, ppid: number }>} processes
 * @param {number} rootPid
 * @returns {Set<number>}
 */
export function processTree(processes, rootPid) {
  const tree = new Set([rootPid]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of processes) {
      if (!tree.has(p.pid) && tree.has(p.ppid)) {
        tree.add(p.pid);
        grew = true;
      }
    }
  }
  return tree;
}

/**
 * The busy-process veto over a live process list, excluding the daemon's own
 * tree.
 *
 * @param {ReadonlyArray<{ pid: number, ppid: number, commandLine: string }>} processes
 * @param {number} selfPid
 * @returns {BusyProcess[]}
 */
export function busyProcessesOf(processes, selfPid) {
  const own = processTree(processes, selfPid);
  return processes
    .filter((p) => !own.has(p.pid) && BUSY_COMMAND_PATTERN.test(p.commandLine ?? ''))
    .map((p) => ({ pid: p.pid, commandLine: p.commandLine.length > 160 ? `${p.commandLine.slice(0, 157)}...` : p.commandLine }));
}

/**
 * CLI flags for the daemon: `--once`, `--dry-run`, `--idle-min N`,
 * `--interval-sec N`. Unknown flags are ignored; malformed numbers fall back
 * to the defaults rather than throwing (a typo must not stop the logon task).
 *
 * @param {readonly string[]} argv
 * @returns {{ once: boolean, dryRun: boolean, idleMs: number, intervalMs: number }}
 */
export function parseArgs(argv) {
  /** @param {string} flag @param {number} fallback */
  const num = (flag, fallback) => {
    const i = argv.indexOf(flag);
    if (i === -1) return fallback;
    const v = Number(argv[i + 1]);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  return {
    once: argv.includes('--once'),
    dryRun: argv.includes('--dry-run'),
    idleMs: num('--idle-min', DEFAULT_IDLE_MS / 60000) * 60000,
    intervalMs: num('--interval-sec', 60) * 1000,
  };
}

/* ------------------------------------------------------------------ */
/* REV-39 M1 -- sweep SHARDING + RESUME                                 */
/*
 * Why this exists: every sweep the daemon has ever run ended `cancelled`.
 * A 3-engine pass takes ~1.5 h and the founder returns long before that, so
 * the run was thrown away and the next idle window started again from zero --
 * the suite could never complete, and REV-39 adds three more projects on top.
 *
 * The fix is Codex ch.13's own "준비" semantic: stop, SAVE THE POINT, and
 * resume from it. The sweep is sharded per PROJECT; a finished project is
 * checkpointed to progress.json and never re-run for that BUILD_ID@HEAD, so
 * each idle window only has to survive one project (~15-25 min), and progress
 * accumulates across interruptions until the whole suite is done.
 */

/** The projects the nightly sweep walks, in order. Mirrored by
 *  tests/web-cinema.config.js `metadata.sweepProjects` (drift-gated by test). */
export const SWEEP_PROJECTS = /** @type {const} */ ([
  'chromium',
  'webkit',
  'mobile-chrome',
  'tablet',
  'inapp-kakao',
  'inapp-instagram',
]);

/**
 * @typedef {object} ShardRecord
 * @property {number} expected
 * @property {number} unexpected
 * @property {number} flaky
 * @property {number} skipped
 * @property {FailureRecord[]} failures
 * @property {string} finishedAt
 *
 * @typedef {object} SweepProgress
 * @property {string} key                       sweepKey this progress belongs to
 * @property {Record<string, ShardRecord>} shards
 */

/** Pure: a normalised progress record; anything malformed becomes an empty one. */
export function shardState(raw, key) {
  const empty = { key, shards: {} };
  if (!raw || typeof raw !== 'object') return empty;
  const r = /** @type {Record<string, unknown>} */ (raw);
  // A different build or HEAD invalidates every shard -- never mix results
  // from two different artefacts into one verdict.
  if (r.key !== key) return empty;
  const shards = {};
  if (r.shards && typeof r.shards === 'object') {
    for (const [name, v] of Object.entries(/** @type {Record<string, any>} */ (r.shards))) {
      if (!v || typeof v !== 'object') continue;
      if (!isFiniteNumber(v.expected) || !isFiniteNumber(v.unexpected)) continue;
      shards[name] = {
        expected: v.expected,
        unexpected: v.unexpected,
        flaky: isFiniteNumber(v.flaky) ? v.flaky : 0,
        skipped: isFiniteNumber(v.skipped) ? v.skipped : 0,
        failures: Array.isArray(v.failures) ? v.failures : [],
        finishedAt: typeof v.finishedAt === 'string' ? v.finishedAt : '',
      };
    }
  }
  return { key, shards };
}

/** Pure: the next project to sweep, or null when the suite is complete. */
export function nextShard(progress, projects = SWEEP_PROJECTS) {
  for (const p of projects) {
    if (!progress.shards[p]) return p;
  }
  return null;
}

/** Pure: progress with one project's result checkpointed in. */
export function recordShard(progress, project, summary, finishedAt) {
  const counts = summary?.perProject?.[project] ?? summary?.totals ?? { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
  return {
    key: progress.key,
    shards: {
      ...progress.shards,
      [project]: {
        expected: counts.expected ?? 0,
        unexpected: counts.unexpected ?? 0,
        flaky: counts.flaky ?? 0,
        skipped: counts.skipped ?? 0,
        failures: Array.isArray(summary?.failures) ? summary.failures : [],
        finishedAt,
      },
    },
  };
}

/** Pure: has every project been checkpointed for this key? */
export function shardsComplete(progress, projects = SWEEP_PROJECTS) {
  return projects.every((p) => Boolean(progress.shards[p]));
}

/**
 * Pure: fold the checkpointed shards into one SweepSummary -- the record the
 * READER agent and the morning brief consume, identical in shape to a single
 * uninterrupted run.
 */
export function aggregateShards(progress, meta, projects = SWEEP_PROJECTS) {
  const perProject = {};
  const totals = emptyCounts();
  const failures = [];
  for (const p of projects) {
    const s = progress.shards[p];
    if (!s) continue;
    perProject[p] = { expected: s.expected, unexpected: s.unexpected, flaky: s.flaky, skipped: s.skipped };
    totals.expected += s.expected;
    totals.unexpected += s.unexpected;
    totals.flaky += s.flaky;
    totals.skipped += s.skipped;
    for (const f of s.failures) failures.push(f);
  }
  return {
    status: totals.unexpected > 0 ? 'failed' : 'passed',
    buildId: meta.buildId,
    head: meta.head,
    startedAt: meta.startedAt,
    finishedAt: meta.finishedAt,
    durationMs: Math.max(0, new Date(meta.finishedAt).getTime() - new Date(meta.startedAt).getTime()),
    perProject,
    totals,
    failures,
    cancelReason: null,
    exitCode: 0,
    shardedProjects: projects.filter((p) => Boolean(progress.shards[p])),
  };
}
