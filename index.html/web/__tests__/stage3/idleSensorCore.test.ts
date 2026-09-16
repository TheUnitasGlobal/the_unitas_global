import { describe, expect, it } from 'vitest';
import {
  BASELINE,
  BUSY_COMMAND_PATTERN,
  DEFAULT_IDLE_MS,
  SIGNAL_NAMES,
  alreadySwept,
  buildSummary,
  busyProcessesOf,
  cancelReasons,
  classifyFailure,
  computeIdle,
  isLockStale,
  listeningPids,
  parseArgs,
  processTree,
  shouldCancel,
  stateFromLatest,
  summaryToMarkdown,
  sweepKey,
} from '../../scripts/idle-sensor-core.mjs';

// REV-35 SPEC.md D-9 / D-10 (a) -- the stage-3 idle sensor's decision table,
// proven on the pure core so the daemon (fs, processes, scheduler) carries no
// logic of its own. The signal ages below mirror the 2026-09-16 live
// measurement: transcripts move on every tool call, GetLastInputInfo read
// 85-99 min idle mid-session (necessary, never sufficient).

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const silent = (ageMin: number) => ({
  transcript: NOW - ageMin * MIN,
  git: NOW - ageMin * MIN,
  worktree: NOW - ageMin * MIN,
  osInput: NOW - ageMin * MIN,
  busyProcesses: [],
});

describe('computeIdle -- the stage-3 idle predicate', () => {
  it('names the four channels in print order and defaults to ten minutes', () => {
    expect([...SIGNAL_NAMES]).toEqual(['transcript', 'git', 'worktree', 'osInput']);
    expect(DEFAULT_IDLE_MS).toBe(10 * MIN);
  });

  it('all signals 11 min old and no busy process -> idle, no blockers', () => {
    const v = computeIdle(silent(11), NOW);
    expect(v.idle).toBe(true);
    expect(v.blockers).toEqual([]);
    expect(v.ages.transcript).toBe('11m');
  });

  it('exactly ten minutes is idle (>=), 9m59s is not', () => {
    expect(computeIdle(silent(10), NOW).idle).toBe(true);
    expect(computeIdle({ ...silent(10), transcript: NOW - 10 * MIN + 1000 }, NOW).idle).toBe(false);
  });

  it('one signal 9 min old -> not idle, that signal named as the blocker', () => {
    const v = computeIdle({ ...silent(11), transcript: NOW - 9 * MIN }, NOW);
    expect(v.idle).toBe(false);
    expect(v.blockers).toHaveLength(1);
    expect(v.blockers[0]).toMatch(/^transcript \(9m ago\)$/);
  });

  it('OS input alone being idle never suffices: a live transcript blocks (the measured false positive)', () => {
    const v = computeIdle({ ...silent(85), transcript: NOW - 12_000 }, NOW);
    expect(v.idle).toBe(false);
    expect(v.blockers).toEqual(['transcript (12s ago)']);
  });

  it('busy `next build` with 30-min-old signals -> not idle, the command named', () => {
    const v = computeIdle({ ...silent(30), busyProcesses: [{ pid: 4242, commandLine: 'node next build' }] }, NOW);
    expect(v.idle).toBe(false);
    expect(v.blockers).toEqual(['busy:node next build (pid 4242)']);
  });

  it('an unreadable signal is activity (fail-closed)', () => {
    const v = computeIdle({ ...silent(30), osInput: null }, NOW);
    expect(v.idle).toBe(false);
    expect(v.blockers).toEqual(['osInput (unreadable)']);
    expect(v.ages.osInput).toBe('unreadable');
  });

  it('honours a custom idleMs (--idle-min 0 forces a sweep)', () => {
    expect(computeIdle({ ...silent(0), transcript: NOW }, NOW, { idleMs: 0 }).idle).toBe(true);
    expect(computeIdle(silent(11), NOW, { idleMs: 20 * MIN }).blockers).toHaveLength(4);
  });
});

describe('shouldCancel -- cancel-in-progress', () => {
  const sweepStartedAt = NOW - 5 * MIN;

  it('keeps sweeping while nothing moved past the sweep start', () => {
    expect(shouldCancel(silent(30), sweepStartedAt, NOW)).toBe(false);
    expect(cancelReasons(silent(30), sweepStartedAt, NOW)).toEqual([]);
  });

  it('cancels when the transcript advances mid-sweep, naming the channel', () => {
    const signals = { ...silent(30), transcript: NOW - 20_000 };
    expect(shouldCancel(signals, sweepStartedAt, NOW)).toBe(true);
    expect(cancelReasons(signals, sweepStartedAt, NOW)[0]).toMatch(/^transcript advanced 20s ago \(sweep started 5m ago\)$/);
  });

  it('cancels when a worktree file is touched (the D-10 (c) live check)', () => {
    expect(shouldCancel({ ...silent(30), worktree: sweepStartedAt + 1 }, sweepStartedAt, NOW)).toBe(true);
  });

  it('cancels when a busy process appears, and when a signal becomes unreadable', () => {
    expect(shouldCancel({ ...silent(30), busyProcesses: [{ pid: 1, commandLine: 'tsc --noEmit' }] }, sweepStartedAt, NOW)).toBe(true);
    expect(cancelReasons({ ...silent(30), git: undefined }, sweepStartedAt, NOW)).toEqual(['git became unreadable']);
  });
});

describe('sweepKey / alreadySwept -- one sweep per build', () => {
  const key = sweepKey({ buildId: 'h1C4LLpO24xmxT92IOolb', head: '8d754b5' });

  it('keys on BUILD_ID and HEAD together', () => {
    expect(key).toBe('h1C4LLpO24xmxT92IOolb@8d754b5');
    expect(sweepKey({ buildId: 'h1C4LLpO24xmxT92IOolb', head: 'deadbee' })).not.toBe(key);
  });

  it('a completed sweep marks its key; a cancelled record never does', () => {
    expect(alreadySwept({ sweptKeys: [key] }, key)).toBe(true);
    expect(alreadySwept({ sweptKeys: [] }, key)).toBe(false);
    expect(alreadySwept(null, key)).toBe(false);
    expect(stateFromLatest({ status: 'passed', buildId: 'h1C4LLpO24xmxT92IOolb', head: '8d754b5' })).toEqual({ sweptKeys: [key] });
    expect(stateFromLatest({ status: 'failed', buildId: 'h1C4LLpO24xmxT92IOolb', head: '8d754b5' })).toEqual({ sweptKeys: [key] });
    expect(stateFromLatest({ status: 'cancelled', buildId: 'h1C4LLpO24xmxT92IOolb', head: '8d754b5' })).toEqual({ sweptKeys: [] });
    expect(stateFromLatest(null)).toEqual({ sweptKeys: [] });
  });
});

describe('classifyFailure -- the three founder rules', () => {
  it('rule 1: a webkit-only failure (passed on the other projects) is a harness flake', () => {
    expect(classifyFailure({ project: 'webkit', title: 'gate opens', error: 'expect(received).toBeVisible()', otherProjectsPassed: true })).toBe(
      'harness-flake',
    );
    expect(classifyFailure({ project: 'chromium', title: 'gate opens', error: 'expect(received).toBeVisible()', otherProjectsPassed: true })).toBe(
      'product-defect',
    );
  });

  it('rule 1: WebGL / GPU / frame-wait timeout text is a harness flake', () => {
    expect(classifyFailure({ project: 'webkit', title: 'render probe', error: 'Test timeout of 240000ms exceeded.' })).toBe('harness-flake');
    expect(classifyFailure({ project: 'chromium', title: 'render probe', error: 'WebGL context lost' })).toBe('harness-flake');
    expect(classifyFailure({ project: 'mobile-chrome', title: 'probe', error: 'GPU process crashed' })).toBe('harness-flake');
    // A chromium timeout is NOT excused: only the GPU-less WebKit harness earns the frame-time clock.
    expect(classifyFailure({ project: 'chromium', title: 'probe', error: 'Test timeout of 60000ms exceeded.' })).toBe('product-defect');
  });

  it('rule 2: assertions on locale text / i18n / title copy are contract drift', () => {
    expect(classifyFailure({ project: 'chromium', title: 'ko locale hero copy', error: 'expected "x"' })).toBe('contract-drift');
    expect(classifyFailure({ project: 'chromium', title: 'hero', file: 'rev21-i18n.spec.js', error: 'boom' })).toBe('contract-drift');
    expect(
      classifyFailure({
        project: 'mobile-chrome',
        title: 'slot title',
        error: 'Error: expect(locator).toHaveText(expected)\n\nExpected string: "세계 랭킹"\nReceived string: "유랭킹"',
      }),
    ).toBe('contract-drift');
  });

  it('rule 3: everything else is a product defect', () => {
    expect(classifyFailure({ project: 'chromium', title: 'back stack pops one level', error: 'expect(received).toHaveCount(1)\nReceived: 2' })).toBe(
      'product-defect',
    );
    expect(classifyFailure({ project: 'webkit', title: 'back stack', error: 'Received: 2', otherProjectsPassed: false })).toBe('product-defect');
  });
});

// A trimmed Playwright JSON reporter document: suites -> specs -> tests -> results,
// with a describe() block nested one level down, in the reporter's real shape.
function fixtureReport() {
  const test = (projectName: string, status: 'expected' | 'unexpected' | 'skipped' | 'flaky', error?: string) => ({
    timeout: 60000,
    annotations: [],
    expectedStatus: 'passed',
    projectName,
    projectId: projectName,
    status,
    results: [
      {
        workerIndex: 0,
        parallelIndex: 0,
        status: status === 'expected' ? 'passed' : status === 'skipped' ? 'skipped' : 'failed',
        duration: 1200,
        error: error ? { message: error } : undefined,
        errors: error ? [{ message: error }] : [],
        stdout: [],
        stderr: [],
        retry: 0,
        startTime: '2026-09-16T00:00:00.000Z',
        attachments: [],
      },
    ],
  });
  return {
    config: {},
    suites: [
      {
        title: 'rev19-back-stack.spec.js',
        file: 'rev19-back-stack.spec.js',
        line: 0,
        column: 0,
        specs: [
          {
            title: 'card opens the deep modal',
            ok: false,
            tags: [],
            id: 'a',
            file: 'rev19-back-stack.spec.js',
            line: 84,
            column: 5,
            tests: [
              test('chromium', 'expected'),
              test('webkit', 'unexpected', '\u001b[31mTest timeout of 240000ms exceeded.\u001b[0m'),
              test('mobile-chrome', 'expected'),
            ],
          },
        ],
        suites: [
          {
            title: 'nested describe',
            file: 'rev19-back-stack.spec.js',
            line: 100,
            column: 1,
            specs: [
              {
                title: 'back pops one level',
                ok: false,
                tags: [],
                id: 'b',
                file: 'rev19-back-stack.spec.js',
                line: 120,
                column: 5,
                tests: [
                  test('chromium', 'unexpected', 'expect(received).toHaveCount(1)\nReceived: 2'),
                  test('webkit', 'unexpected', 'expect(received).toHaveCount(1)\nReceived: 2'),
                  test('mobile-chrome', 'skipped'),
                ],
              },
            ],
          },
        ],
      },
      {
        title: 'rev21-hub-card.spec.js',
        file: 'rev21-hub-card.spec.js',
        line: 0,
        column: 0,
        specs: [
          {
            title: 'ko locale slot title',
            ok: false,
            tags: [],
            id: 'c',
            file: 'rev21-hub-card.spec.js',
            line: 10,
            column: 5,
            tests: [
              test('chromium', 'unexpected', 'Expected string: "세계 랭킹"\nReceived string: "유랭킹"'),
              test('webkit', 'skipped'),
              test('mobile-chrome', 'flaky'),
            ],
          },
        ],
      },
    ],
    errors: [],
    stats: { startTime: '2026-09-16T00:00:00.000Z', duration: 5000, expected: 2, unexpected: 4, flaky: 1, skipped: 2 },
  };
}

const META = { buildId: 'h1C4LLpO24xmxT92IOolb', head: '8d754b558ea3d53f798eede7a6c5cf4b8e879af3', startedAt: NOW, finishedAt: NOW + 90 * MIN, exitCode: 1 };

describe('buildSummary -- from the Playwright JSON reporter shape', () => {
  it('counts per project (all three keys always present) and totals', () => {
    const s = buildSummary(fixtureReport(), META);
    expect(Object.keys(s.perProject)).toEqual(['chromium', 'webkit', 'mobile-chrome']);
    expect(s.perProject.chromium).toEqual({ expected: 1, unexpected: 2, flaky: 0, skipped: 0 });
    expect(s.perProject.webkit).toEqual({ expected: 0, unexpected: 2, flaky: 0, skipped: 1 });
    expect(s.perProject['mobile-chrome']).toEqual({ expected: 1, unexpected: 0, flaky: 1, skipped: 1 });
    expect(s.totals).toEqual({ expected: 2, unexpected: 4, flaky: 1, skipped: 2 });
    expect(s.status).toBe('failed');
    expect(s.durationMs).toBe(90 * MIN);
    expect(s.startedAt).toBe(new Date(NOW).toISOString());
    expect(s.buildId).toBe(META.buildId);
    expect(s.head).toBe(META.head);
    expect(s.exitCode).toBe(1);
    expect(s.cancelReason).toBeNull();
  });

  it('classifies each failure with the describe path folded into the title and ANSI stripped', () => {
    const s = buildSummary(fixtureReport(), META);
    const byTitle = Object.fromEntries(s.failures.map((f) => [`${f.project}:${f.title}`, f]));
    expect(byTitle['webkit:card opens the deep modal'].kind).toBe('harness-flake');
    expect(byTitle['webkit:card opens the deep modal'].error).toBe('Test timeout of 240000ms exceeded.');
    expect(byTitle['chromium:nested describe › back pops one level'].kind).toBe('product-defect');
    // webkit failed the same spec chromium failed -> not webkit-only -> still a defect
    expect(byTitle['webkit:nested describe › back pops one level'].kind).toBe('product-defect');
    expect(byTitle['chromium:ko locale slot title'].kind).toBe('contract-drift');
    expect(s.failures).toHaveLength(4);
    expect(s.failures.every((f) => f.file.endsWith('.spec.js'))).toBe(true);
  });

  it('a clean report is passed; a missing report with exit 0 is still failed (nothing was proven)', () => {
    const clean = fixtureReport();
    for (const suite of clean.suites) {
      for (const spec of [...suite.specs, ...(suite.suites ?? []).flatMap((s) => s.specs)]) {
        for (const t of spec.tests) {
          t.status = 'expected';
          t.results[0].status = 'passed';
          t.results[0].error = undefined;
          t.results[0].errors = [];
        }
      }
    }
    expect(buildSummary(clean, { ...META, exitCode: 0 }).status).toBe('passed');
    expect(buildSummary(null, { ...META, exitCode: 0 }).status).toBe('failed');
  });

  it('a cancelled sweep is recorded as cancelled with its reason, never as passed', () => {
    const s = buildSummary(null, { ...META, finishedAt: NOW + 3 * MIN, cancelled: true, cancelReason: 'worktree advanced 5s ago', exitCode: 1 });
    expect(s.status).toBe('cancelled');
    expect(s.cancelReason).toBe('worktree advanced 5s ago');
    expect(s.totals).toEqual({ expected: 0, unexpected: 0, flaky: 0, skipped: 0 });
    expect(s.failures).toEqual([]);
    expect(stateFromLatest(s)).toEqual({ sweptKeys: [] });
  });
});

describe('summaryToMarkdown -- latest.md', () => {
  it('renders Korean headings, the totals table, the REV-33 baseline delta and the classified list', () => {
    const md = summaryToMarkdown(buildSummary(fixtureReport(), META));
    expect(md).toContain('# 3단계 전수 검증 결과');
    expect(md).toContain('## 프로젝트별 합계');
    expect(md).toContain('| 프로젝트 | 통과 | 실패 | 플레이크 | 스킵 |');
    expect(md).toContain('| chromium | 1 | 2 | 0 | 0 |');
    expect(md).toContain('| **합계** | **2** | **4** | **1** | **2** |');
    expect(md).toContain(`## 기준선 대비 (REV-33: 통과 ${BASELINE.expected} · 스킵 ${BASELINE.skipped} · 총 ${BASELINE.total})`);
    expect(md).toContain(`- 통과 2 (${2 - BASELINE.expected})`);
    expect(md).toContain('## 실패 분류');
    expect(md).toContain('### 제품 결함 (2)');
    expect(md).toContain('### 계약 드리프트 (1)');
    expect(md).toContain('### 하네스 플레이크 (1)');
    expect(md).toContain('- **상태:** 실패');
    expect(md).toContain('docs/stage3/READER.md');
  });

  it('marks a cancelled sweep and refuses to compare it with the baseline', () => {
    const md = summaryToMarkdown(buildSummary(null, { ...META, cancelled: true, cancelReason: 'transcript advanced 3s ago' }));
    expect(md).toContain('- **상태:** 취소됨 (활동 감지)');
    expect(md).toContain('- **취소 사유:** transcript advanced 3s ago');
    expect(md).toContain('기준선과 직접 비교하지 않는다');
    expect(md).toContain('_(취소 시점까지 실패 없음)_');
  });
});

describe('isLockStale -- pid + creation time', () => {
  const lock = { pid: 12628, procStart: '134321927378273210', acquiredAt: NOW };

  it('live when the same pid has the same creation time', () => {
    expect(isLockStale(lock, { pid: 12628, procStart: '134321927378273210' })).toBe(false);
  });

  it('stale when the pid is gone, was recycled (different creation time) or the lock is malformed', () => {
    expect(isLockStale(lock, null)).toBe(true);
    expect(isLockStale(lock, { pid: 12628, procStart: '134321999999999999' })).toBe(true);
    expect(isLockStale(lock, { pid: 999, procStart: '134321927378273210' })).toBe(true);
    expect(isLockStale(null, { pid: 12628, procStart: '134321927378273210' })).toBe(true);
    expect(isLockStale({ pid: 12628 }, { pid: 12628, procStart: '134321927378273210' })).toBe(true);
  });
});

describe('process helpers -- what the daemon may veto or kill', () => {
  it('BUSY_COMMAND_PATTERN matches the four build/test commands and not the VS Code playwright test-server', () => {
    expect(BUSY_COMMAND_PATTERN.test('node C:\\x\\node_modules\\next\\dist\\bin\\next build')).toBe(true);
    expect(BUSY_COMMAND_PATTERN.test('"C:\\Program Files\\nodejs\\node.exe" tsc.js --noEmit')).toBe(true);
    expect(BUSY_COMMAND_PATTERN.test('node ../scripts/sync-codex.mjs --write')).toBe(true);
    expect(BUSY_COMMAND_PATTERN.test('"C:\\Program Files\\nodejs\\node.exe" C:\\dev\\unitas\\index.html\\node_modules\\@playwright\\test\\cli.js test --config=tests/web-cinema.config.js')).toBe(true);
    expect(BUSY_COMMAND_PATTERN.test('npx playwright test')).toBe(true);
    expect(BUSY_COMMAND_PATTERN.test('node @playwright/test/cli.js test-server --port 1234')).toBe(false);
    expect(BUSY_COMMAND_PATTERN.test('node next start -p 3123')).toBe(false);
    expect(BUSY_COMMAND_PATTERN.test('node scripts/idle-sensor-daemon.mjs')).toBe(false);
  });

  it('excludes the daemon\'s own tree (probe, Playwright child, browsers, webServer) from the veto', () => {
    const table = [
      { pid: 100, ppid: 1, commandLine: 'node scripts/idle-sensor-daemon.mjs' },
      { pid: 101, ppid: 100, commandLine: 'powershell.exe -EncodedCommand ...' },
      { pid: 102, ppid: 100, commandLine: 'node node_modules\\@playwright\\test\\cli.js test --config=tests/web-cinema.config.js' },
      { pid: 103, ppid: 102, commandLine: 'node next start -p 3123' },
      { pid: 104, ppid: 103, commandLine: 'chrome.exe --headless' },
      { pid: 200, ppid: 1, commandLine: 'node next build' },
      { pid: 201, ppid: 1, commandLine: 'node node_modules\\@playwright\\test\\cli.js test --config=x' },
    ];
    expect([...processTree(table, 100)].sort()).toEqual([100, 101, 102, 103, 104]);
    expect(busyProcessesOf(table, 100).map((b) => b.pid)).toEqual([200, 201]);
  });

  it('listeningPids parses netstat -ano for LISTENING sockets on the sweep port only', () => {
    const netstat = [
      'Active Connections',
      '',
      '  Proto  Local Address          Foreign Address        State           PID',
      '  TCP    0.0.0.0:3123           0.0.0.0:0              LISTENING       4321',
      '  TCP    127.0.0.1:3123         127.0.0.1:50001        ESTABLISHED     4321',
      '  TCP    [::]:3123              [::]:0                 LISTENING       4321',
      '  TCP    0.0.0.0:31230          0.0.0.0:0              LISTENING       9999',
      '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       8888',
      '  UDP    0.0.0.0:3123           *:*                                    7777',
    ].join('\r\n');
    expect(listeningPids(netstat, 3123)).toEqual([4321]);
    expect(listeningPids('', 3123)).toEqual([]);
  });
});

describe('parseArgs -- daemon flags', () => {
  it('defaults: loop mode, 10 min, 60 s', () => {
    expect(parseArgs([])).toEqual({ once: false, dryRun: false, idleMs: 10 * MIN, intervalMs: 60_000 });
  });

  it('reads --once --dry-run --idle-min --interval-sec and ignores malformed numbers', () => {
    expect(parseArgs(['--once', '--dry-run', '--idle-min', '0', '--interval-sec', '15'])).toEqual({ once: true, dryRun: true, idleMs: 0, intervalMs: 15_000 });
    expect(parseArgs(['--idle-min', 'ten']).idleMs).toBe(10 * MIN);
  });
});
