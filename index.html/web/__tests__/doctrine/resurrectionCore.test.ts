import { describe, expect, it } from 'vitest';
import {
  BACKOFF_BASE_MS,
  DEFAULT_HALT_MS,
  DEFAULT_TICK_MS,
  MAX_RESUMES_PER_WINDOW,
  RESUME_WINDOW_MS,
  armState,
  backoffMs,
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
  resumesInWindow,
  shouldDisarm,
  summarize,
} from '../../scripts/resurrection-core.mjs';

/**
 * MISSION 2 (founder directive 2026-09-17) — FINAL_REPORT A-3.
 *
 * Codex 제4장 has demanded a Self-Resurrecting Daemon since v37.0 and had an
 * implementation count of zero until this commit. The daemon is dangerous in a
 * way the stage-3 idle sensor is not: it SPENDS TOKENS. A watcher that cannot
 * tell "the agent was cut off mid-task" from "the founder went to bed" will
 * relaunch sessions all night, which 제5장 (Micro-Burn, 한계 비용 0원) forbids
 * outright.
 *
 * So the decision table below is the safety-critical surface, and it is proven
 * here without ever launching a session. Every test that asserts the daemon
 * DOES fire is paired with the cases where it must not.
 */

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;

/** A fully green set of signals with work in flight and 61 minutes of silence. */
function haltedSignals(overrides: Record<string, unknown> = {}) {
  return {
    state: armState(emptyState(), {
      at: new Date(NOW - 2 * HOUR).toISOString(),
      anchorAt: new Date(NOW - 61 * MIN).toISOString(),
      sessionId: 'sess-1',
      transcriptPath: 'C:/x/sess-1.jsonl',
      by: 'session' as const,
      directive: '이어서 완결하라',
    }),
    lastActivityMs: NOW - 61 * MIN,
    inFlight: true,
    claudeRunning: false,
    killSwitch: false,
    trusted: true,
    rateLimit: null,
    ...overrides,
  };
}

describe('doctrine constants track 제4장 verbatim', () => {
  it('60-minute halt threshold and 10-minute self-check', () => {
    expect(DEFAULT_HALT_MS).toBe(60 * HOUR / 60);
    expect(DEFAULT_HALT_MS).toBe(3_600_000);
    expect(DEFAULT_TICK_MS).toBe(600_000);
  });

  it('caps autonomous resumes so 제5장 Micro-Burn cannot be violated by a loop', () => {
    expect(MAX_RESUMES_PER_WINDOW).toBe(3);
    expect(RESUME_WINDOW_MS).toBe(24 * HOUR);
    expect(backoffMs(0)).toBe(0);
    expect(backoffMs(1)).toBe(BACKOFF_BASE_MS);
    expect(backoffMs(2)).toBe(2 * BACKOFF_BASE_MS);
    expect(backoffMs(3)).toBe(4 * BACKOFF_BASE_MS);
  });
});

describe('in-flight detection', () => {
  it('a user turn with no reply is work in flight', () => {
    expect(isInFlight([{ type: 'user' }])).toBe(true);
    expect(isInFlight([{ type: 'assistant' }, { type: 'user' }])).toBe(true);
  });

  it('a conversation that ends on an assistant turn is finished, not halted', () => {
    expect(isInFlight([{ type: 'user' }, { type: 'assistant' }])).toBe(false);
  });

  it('harness bookkeeping after the last turn does not change the verdict', () => {
    // Measured entry types in a live transcript, 2026-09-17.
    const entries = [
      { type: 'user' },
      { type: 'assistant' },
      { type: 'ai-title' },
      { type: 'atis-latch' },
      { type: 'file-history-snapshot' },
      { type: 'mode' },
    ];
    expect(lastConversationalEntry(entries)?.type).toBe('assistant');
    expect(isInFlight(entries)).toBe(false);
  });

  it('an empty or unreadable transcript is never in flight', () => {
    expect(isInFlight([])).toBe(false);
    expect(lastConversationalEntry([])).toBeNull();
  });
});

describe('rate-limit annotation', () => {
  it('finds an API stop marker in the tail', () => {
    expect(rateLimitMarker([{ type: 'assistant', text: 'Claude usage limit reached' }])).toBeTruthy();
    expect(rateLimitMarker([{ type: 'assistant', text: 'API Error: 429 too many requests' }])).toBeTruthy();
  });

  it('is annotation only — its absence must not block a resume', () => {
    expect(rateLimitMarker([{ type: 'assistant', text: 'all done' }])).toBeNull();
    const verdict = decideResume(haltedSignals({ rateLimit: null }), NOW);
    expect(verdict.resume).toBe(true);
  });
});

describe('decideResume — the safety-critical table', () => {
  it('fires when armed, in flight, silent past the threshold, nothing running', () => {
    const v = decideResume(haltedSignals(), NOW);
    expect(v.resume).toBe(true);
    expect(v.reason).toContain('제4장 Auto-Resume');
  });

  it('DISARMED is the resting state and spends nothing', () => {
    const v = decideResume({ ...haltedSignals(), state: emptyState() }, NOW);
    expect(v.resume).toBe(false);
    expect(v.reason).toContain('DISARMED');
  });

  it('never fires while a claude session is already driving the repo', () => {
    const v = decideResume(haltedSignals({ claudeRunning: true }), NOW);
    expect(v.resume).toBe(false);
    expect(v.reason).toContain('이중 구동');
  });

  it('never fires when the conversation ended on an assistant turn', () => {
    const v = decideResume(haltedSignals({ inFlight: false }), NOW);
    expect(v.resume).toBe(false);
  });

  it('fails closed when the trust registry attestation fails (제13장)', () => {
    const v = decideResume(haltedSignals({ trusted: false }), NOW);
    expect(v.resume).toBe(false);
    expect(v.reason).toContain('신뢰 등록');
  });

  it('the kill switch outranks an explicit arm', () => {
    const v = decideResume(haltedSignals({ killSwitch: true }), NOW);
    expect(v.resume).toBe(false);
    expect(v.reason).toContain('킬 스위치');
  });

  it('does not fire one minute before the 60-minute threshold', () => {
    const v = decideResume(haltedSignals({ lastActivityMs: NOW - 59 * MIN }), NOW);
    expect(v.resume).toBe(false);
    expect(v.reason).toContain('임계');
    expect(v.nextEligibleAt).toBe(NOW - 59 * MIN + DEFAULT_HALT_MS);
  });

  it('honours exponential backoff after a resume', () => {
    const state = recordResume(haltedSignals().state, {
      at: new Date(NOW - 30 * MIN).toISOString(),
      ok: true,
      exitCode: 0,
      reason: 'first',
    });
    const cooling = decideResume({ ...haltedSignals(), state }, NOW);
    expect(cooling.resume).toBe(false);
    expect(cooling.reason).toContain('백오프');

    const cooled = decideResume({ ...haltedSignals(), state }, NOW + 40 * MIN);
    expect(cooled.resume).toBe(true);
  });

  it('stops permanently once the 24h budget is spent', () => {
    let state = haltedSignals().state;
    for (let i = 0; i < MAX_RESUMES_PER_WINDOW; i += 1) {
      state = recordResume(state, {
        at: new Date(NOW - (10 - i) * HOUR).toISOString(),
        ok: false,
        exitCode: 1,
        reason: `attempt ${i}`,
      });
    }
    const v = decideResume({ ...haltedSignals(), state }, NOW);
    expect(v.resume).toBe(false);
    expect(v.reason).toContain('예산 소진');
    expect(v.nextEligibleAt).toBeGreaterThan(NOW);
  });

  it('lets the budget recover once resumes age out of the rolling window', () => {
    let state = haltedSignals().state;
    for (let i = 0; i < MAX_RESUMES_PER_WINDOW; i += 1) {
      state = recordResume(state, {
        at: new Date(NOW - (30 + i) * HOUR).toISOString(),
        ok: false,
        exitCode: 1,
        reason: `old ${i}`,
      });
    }
    expect(resumesInWindow(state.resumes, NOW)).toHaveLength(0);
    expect(decideResume({ ...haltedSignals(), state }, NOW).resume).toBe(true);
  });
});

describe('arm / disarm lifecycle', () => {
  it('disarms as soon as the transcript advances past the anchor', () => {
    const state = haltedSignals().state;
    expect(shouldDisarm(state, NOW - 61 * MIN)).toBe(false);
    expect(shouldDisarm(state, NOW - 10 * MIN)).toBe(true);
  });

  it('a disarmed state is never disarmed again (no churn)', () => {
    expect(shouldDisarm(emptyState(), NOW)).toBe(false);
  });

  it('disarmState clears the anchor so a stale anchor cannot re-fire', () => {
    const off = disarmState(haltedSignals().state);
    expect(off.armed).toBe(false);
    expect(off.anchorAt).toBeNull();
    expect(decideResume({ ...haltedSignals(), state: off }, NOW).resume).toBe(false);
  });

  it('a corrupt state file resolves to the resting position, never a throw', () => {
    expect(parseState(null).armed).toBe(false);
    expect(parseState('nonsense').armed).toBe(false);
    expect(parseState({ armed: 'yes', resumes: 'nope' }).armed).toBe(false);
    expect(parseState({ armed: true, resumes: [{ at: 1 }, { at: '2026-01-01T00:00:00Z', ok: true }] }).resumes).toHaveLength(1);
  });

  it('keeps the resume ledger bounded', () => {
    let s = emptyState();
    for (let i = 0; i < 80; i += 1) {
      s = recordResume(s, { at: new Date(NOW + i).toISOString(), ok: true, exitCode: 0, reason: 'x' }, 50);
    }
    expect(s.resumes).toHaveLength(50);
  });
});

describe('process-table safety', () => {
  const own = [1000, 1001];

  it('recognises a live claude CLI', () => {
    const hits = claudeProcessesOf(
      [{ pid: 2000, command: 'C:\\Users\\x\\AppData\\Roaming\\npm\\claude.cmd --resume abc' }],
      own,
    );
    expect(hits).toHaveLength(1);
  });

  it('never mistakes the claude-mem worker or its own daemons for a session', () => {
    const hits = claudeProcessesOf(
      [
        { pid: 2001, command: 'node C:\\x\\claude-mem\\worker.js' },
        { pid: 2002, command: 'node C:\\x\\web\\scripts\\resurrection-daemon.mjs' },
        { pid: 2003, command: 'node C:\\x\\web\\scripts\\idle-sensor-daemon.mjs' },
        { pid: 1000, command: 'claude' },
      ],
      own,
    );
    expect(hits).toEqual([]);
  });
});

describe('single instance', () => {
  it('takes over a lock whose process is gone', () => {
    expect(isLockStale({ pid: 42 }, null)).toBe(true);
    expect(isLockStale({ pid: 42 }, { pid: 43 })).toBe(true);
    expect(isLockStale(null, { pid: 42 })).toBe(true);
  });

  it('respects a live lock', () => {
    expect(isLockStale({ pid: 42, procStart: 'a' }, { pid: 42, procStart: 'a' })).toBe(false);
  });

  it('treats a recycled pid with a different start time as stale', () => {
    expect(isLockStale({ pid: 42, procStart: 'a' }, { pid: 42, procStart: 'b' })).toBe(true);
  });
});

describe('cli + reporting', () => {
  it('parses the flags the scheduled task and the founder use', () => {
    expect(parseArgs([])).toMatchObject({ once: false, dryRun: false, haltMin: 60, intervalSec: 600 });
    expect(parseArgs(['--once', '--dry-run'])).toMatchObject({ once: true, dryRun: true });
    expect(parseArgs(['--halt-min', '90', '--interval-sec', '300'])).toMatchObject({ haltMin: 90, intervalSec: 300 });
    expect(parseArgs(['--arm', '--directive', '이어서 완결하라']).directive).toBe('이어서 완결하라');
    expect(parseArgs(['--halt-min', '-5']).haltMin, 'a hostile value falls back to the doctrine default').toBe(60);
  });

  it('formats ages for the founder-facing status block', () => {
    expect(formatAge(30 * MIN)).toBe('30분');
    expect(formatAge(95 * MIN)).toBe('1시간 35분');
    expect(formatAge(-1)).toBe('알 수 없음');
  });

  it('summarize() reports DISARMED without claiming a pending resume', () => {
    const text = summarize(
      emptyState(),
      { lastActivityMs: NOW - 5 * HOUR, inFlight: false, claudeRunning: false, killSwitch: false, trusted: true },
      NOW,
    );
    expect(text).toContain('DISARMED');
    expect(text).not.toContain('지금 부활');
  });

  it('summarize() states the verdict when armed and halted', () => {
    const s = haltedSignals();
    const text = summarize(s.state, s, NOW);
    expect(text).toContain('ARMED');
    expect(text).toContain('지금 부활');
  });
});
