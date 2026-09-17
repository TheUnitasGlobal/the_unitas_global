// ---------------------------------------------------------------------------
// resurrection-core.mjs -- Codex v41.0 제4장 자율 부활 데몬, pure decision core.
// Trust-registry id: unitas.resurrection.core
//
// 제4장, verbatim:
//   "시스템 오류나 API 토큰 리미트(Rate Limit)로 에이전트 연산이 60분 이상
//    중단될 경우에 대비하여, 단순 대기하지 않고 백그라운드에 Node.js 기반
//    자율 부활 데몬(Watcher) 스크립트를 에이전트 스스로 주입한다. 10분 간격
//    으로 가용성을 체크(Self-Check)하며 멈춤 감지 시 스스로 터미널 세션을
//    재개(Auto-Resume)하여 절대 무중단 상태를 유지한다."
//
// Until 2026-09-17 this chapter had NO implementation. UnitasIdleSensorStage3
// is a different machine entirely: it waits for 10 minutes of QUIET to start
// heavy E2E work, and cancels the instant anyone touches the keyboard. This one
// is its mirror image -- it waits for 60 minutes of quiet that should NOT have
// happened, and restarts the agent.
//
// THE DANGER THIS FILE IS SHAPED AROUND. A resurrection daemon is a loop that
// spends tokens. Chapter 5 (Micro-Burn, 한계 비용 0원) and the doctrine's own
// "로우메모리 아머" make an always-firing watcher a violation, not a feature:
// if it cannot tell "the agent was cut off mid-task" from "the founder went to
// bed", it will relaunch sessions all night and bill for them. So the daemon is
// ARMED/DISARMED, and DISARMED is the resting state:
//
//   * ARMED only while work is demonstrably in flight -- either the session
//     armed it explicitly before a long autonomous run, or the newest
//     transcript's last conversational entry is a `user` turn that never
//     received an `assistant` reply. A prompt submitted and never answered is
//     the objective signature of an interrupted computation; a conversation
//     that ends on an `assistant` turn is a conversation that finished.
//   * DISARMED by: founder activity (the transcript advances past the armed
//     point), a successful resume, the kill switch file, or the resume budget
//     running out. The budget is HARD: 3 resumes per rolling 24 h with
//     exponential backoff. A daemon that can fire forever is a bill, not a
//     safeguard.
//
// PURE BY CONSTRUCTION: no fs, no process, no clock, no network. The daemon
// shell collects signals and applies these verdicts, exactly as
// idle-sensor-core.mjs relates to idle-sensor-daemon.mjs.
// ---------------------------------------------------------------------------

/** 제4장: "60분 이상 중단". */
export const DEFAULT_HALT_MS = 60 * 60 * 1000;

/** 제4장: "10분 간격으로 가용성을 체크(Self-Check)". */
export const DEFAULT_TICK_MS = 10 * 60 * 1000;

/** Hard ceiling on autonomous resumes in one rolling window (제5장 Micro-Burn). */
export const MAX_RESUMES_PER_WINDOW = 3;

/** The rolling window the ceiling applies to. */
export const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Backoff after each resume: 60m, 120m, 240m. Never linear -- a stuck agent
 *  that is stuck for a structural reason must not be poked every hour. */
export const BACKOFF_BASE_MS = 60 * 60 * 1000;

/** Transcript entry types that represent an actual conversational turn. The
 *  rest ('mode', 'bridge-session', 'attachment', 'ai-title', 'atis-latch',
 *  'queue-operation', 'file-history-snapshot', 'system', 'last-prompt') are
 *  harness bookkeeping and say nothing about whether the agent is working.
 *  Measured against a live transcript 2026-09-17. */
export const CONVERSATIONAL_TYPES = Object.freeze(['user', 'assistant']);

/** Substrings that mark an API-side stop rather than a completed turn. Used to
 *  ANNOTATE the halt reason, never to gate it: the daemon must resume a
 *  silently-dead session too, and a schema change here must not disable it. */
export const RATE_LIMIT_MARKERS = Object.freeze([
  'rate limit',
  'rate_limit',
  'usage limit',
  'overloaded_error',
  'Claude usage limit reached',
  'API Error: 429',
  'API Error: 529',
]);

/** A live `claude` CLI process means a session is already driving this repo;
 *  resuming on top of it would double-drive the worktree. */
export const CLAUDE_PROCESS_PATTERN = /\bclaude(?:\.cmd|\.exe|")?\b(?!-mem)/i;

/** @typedef {{ type: string, timestamp?: string, text?: string }} TranscriptEntry */

/**
 * @typedef {object} ResurrectionState
 * @property {boolean} armed
 * @property {string | null} armedAt        ISO
 * @property {string | null} armedBy        'session' | 'auto'
 * @property {string | null} sessionId
 * @property {string | null} transcriptPath
 * @property {string | null} directive      what to say on resume
 * @property {string | null} anchorAt       ISO of the last transcript entry when armed
 * @property {Array<{ at: string, ok: boolean, exitCode: number | null, reason: string }>} resumes
 */

/** A DISARMED, empty state. The resting position. @returns {ResurrectionState} */
export function emptyState() {
  return {
    armed: false,
    armedAt: null,
    armedBy: null,
    sessionId: null,
    transcriptPath: null,
    directive: null,
    anchorAt: null,
    resumes: [],
  };
}

/**
 * Tolerant parse of a persisted state file. Anything unrecognised resolves to
 * the resting position rather than throwing -- a corrupt state file must
 * DISARM the daemon, never crash it into a restart loop.
 * @param {unknown} raw
 * @returns {ResurrectionState}
 */
export function parseState(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const o = /** @type {Record<string, unknown>} */ (raw);
  return {
    armed: o.armed === true,
    armedAt: typeof o.armedAt === 'string' ? o.armedAt : null,
    armedBy: o.armedBy === 'session' || o.armedBy === 'auto' ? o.armedBy : null,
    sessionId: typeof o.sessionId === 'string' ? o.sessionId : null,
    transcriptPath: typeof o.transcriptPath === 'string' ? o.transcriptPath : null,
    directive: typeof o.directive === 'string' ? o.directive : null,
    anchorAt: typeof o.anchorAt === 'string' ? o.anchorAt : null,
    resumes: Array.isArray(o.resumes)
      ? o.resumes
          .filter((r) => r && typeof r === 'object' && typeof (/** @type {any} */ (r).at) === 'string')
          .map((r) => {
            const e = /** @type {any} */ (r);
            return {
              at: e.at,
              ok: e.ok === true,
              exitCode: typeof e.exitCode === 'number' ? e.exitCode : null,
              reason: typeof e.reason === 'string' ? e.reason : '',
            };
          })
      : [],
  };
}

/**
 * The last entry that represents a conversational turn.
 * @param {TranscriptEntry[]} entries
 * @returns {TranscriptEntry | null}
 */
export function lastConversationalEntry(entries) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const e = entries[i];
    if (e && CONVERSATIONAL_TYPES.includes(e.type)) return e;
  }
  return null;
}

/**
 * Work is in flight when the newest conversational turn is a `user` turn: a
 * prompt went in and nothing came back. A transcript that ends on `assistant`
 * ended because the agent finished speaking, which is not a halt.
 * @param {TranscriptEntry[]} entries
 * @returns {boolean}
 */
export function isInFlight(entries) {
  const last = lastConversationalEntry(entries);
  return last !== null && last.type === 'user';
}

/**
 * Whether the tail of the transcript shows an API-side stop. Annotation only.
 * @param {TranscriptEntry[]} entries
 * @param {number} [tail]
 * @returns {string | null} the marker that matched, or null
 */
export function rateLimitMarker(entries, tail = 6) {
  const window = entries.slice(-tail);
  for (const e of window) {
    const text = typeof e?.text === 'string' ? e.text : '';
    if (!text) continue;
    const hit = RATE_LIMIT_MARKERS.find((m) => text.toLowerCase().includes(m.toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

/**
 * Resumes inside the rolling window.
 * @param {ResurrectionState['resumes']} resumes
 * @param {number} now epoch ms
 * @param {number} [windowMs]
 * @returns {ResurrectionState['resumes']}
 */
export function resumesInWindow(resumes, now, windowMs = RESUME_WINDOW_MS) {
  return resumes.filter((r) => {
    const t = Date.parse(r.at);
    return Number.isFinite(t) && now - t < windowMs;
  });
}

/**
 * Exponential backoff after N resumes: 60m, 120m, 240m…
 * @param {number} attempt zero-based
 * @param {number} [baseMs]
 * @returns {number}
 */
export function backoffMs(attempt, baseMs = BACKOFF_BASE_MS) {
  if (attempt <= 0) return 0;
  return baseMs * 2 ** (attempt - 1);
}

/**
 * @typedef {object} HaltSignals
 * @property {ResurrectionState} state
 * @property {number} lastActivityMs   epoch ms of the newest transcript mtime
 * @property {boolean} inFlight        last conversational turn is a `user` turn
 * @property {boolean} claudeRunning   a live `claude` CLI owns this machine
 * @property {boolean} killSwitch      the DISARMED file exists
 * @property {boolean} trusted         trust-registry attestation passed
 * @property {string | null} [rateLimit]
 */

/**
 * THE decision. Returns whether to resume now, and always says why -- the
 * daemon logs the reason on every tick, so a daemon that never fires can be
 * audited without reading its source.
 *
 * @param {HaltSignals} signals
 * @param {number} now epoch ms
 * @param {{ haltMs?: number, maxResumes?: number, windowMs?: number, baseMs?: number }} [options]
 * @returns {{ resume: boolean, reason: string, ageMs: number, attempt: number, nextEligibleAt: number | null }}
 */
export function decideResume(signals, now, options = {}) {
  const haltMs = options.haltMs ?? DEFAULT_HALT_MS;
  const maxResumes = options.maxResumes ?? MAX_RESUMES_PER_WINDOW;
  const windowMs = options.windowMs ?? RESUME_WINDOW_MS;
  const baseMs = options.baseMs ?? BACKOFF_BASE_MS;

  const ageMs = Math.max(0, now - signals.lastActivityMs);
  const recent = resumesInWindow(signals.state.resumes, now, windowMs);
  const attempt = recent.length;
  const no = (reason) => ({ resume: false, reason, ageMs, attempt, nextEligibleAt: null });

  // Fail-closed first: an unattested daemon must not spawn anything.
  if (!signals.trusted) return no('신뢰 등록 검증 실패 — 부활 보류(fail-closed)');
  if (signals.killSwitch) return no('킬 스위치(DISARMED) 존재 — 부활 영구 보류');
  if (!signals.state.armed) return no('DISARMED — 진행 중인 작업 없음(토큰 소모 0)');
  if (signals.claudeRunning) return no('claude 세션이 이미 구동 중 — 이중 구동 방지');
  if (!signals.inFlight) {
    return no('마지막 턴이 assistant — 중단이 아니라 완료된 대화');
  }
  if (attempt >= maxResumes) {
    const oldest = Date.parse(recent[0].at);
    return {
      resume: false,
      reason: `24시간 부활 예산 소진(${attempt}/${maxResumes}) — 제5장 Micro-Burn 상한`,
      ageMs,
      attempt,
      nextEligibleAt: Number.isFinite(oldest) ? oldest + windowMs : null,
    };
  }
  if (ageMs < haltMs) {
    return {
      resume: false,
      reason: `중단 ${Math.floor(ageMs / 60000)}분 — 임계 ${Math.floor(haltMs / 60000)}분 미달`,
      ageMs,
      attempt,
      nextEligibleAt: signals.lastActivityMs + haltMs,
    };
  }
  const wait = backoffMs(attempt, baseMs);
  if (attempt > 0) {
    const lastAt = Date.parse(recent[recent.length - 1].at);
    if (Number.isFinite(lastAt) && now - lastAt < wait) {
      return {
        resume: false,
        reason: `백오프 대기 — ${attempt}회 부활 후 ${Math.floor(wait / 60000)}분 냉각`,
        ageMs,
        attempt,
        nextEligibleAt: lastAt + wait,
      };
    }
  }
  const why = signals.rateLimit
    ? `API 중단 흔적('${signals.rateLimit}') + ${Math.floor(ageMs / 60000)}분 무응답`
    : `${Math.floor(ageMs / 60000)}분간 user 턴 무응답 — 연산 중단으로 판정`;
  return { resume: true, reason: `제4장 Auto-Resume: ${why}`, ageMs, attempt, nextEligibleAt: null };
}

/**
 * Disarm when the transcript has moved past the point we armed at -- the
 * founder (or a successful resume) is driving again.
 * @param {ResurrectionState} state
 * @param {number} lastActivityMs
 * @returns {boolean}
 */
export function shouldDisarm(state, lastActivityMs) {
  if (!state.armed) return false;
  const anchor = state.anchorAt ? Date.parse(state.anchorAt) : NaN;
  if (!Number.isFinite(anchor)) return false;
  return lastActivityMs > anchor;
}

/**
 * @param {ResurrectionState} state
 * @param {{ directive?: string | null, sessionId?: string | null, transcriptPath?: string | null, anchorAt: string, at: string, by?: 'session' | 'auto' }} arming
 * @returns {ResurrectionState}
 */
export function armState(state, arming) {
  return {
    ...state,
    armed: true,
    armedAt: arming.at,
    armedBy: arming.by ?? 'session',
    sessionId: arming.sessionId ?? state.sessionId,
    transcriptPath: arming.transcriptPath ?? state.transcriptPath,
    directive: arming.directive ?? state.directive,
    anchorAt: arming.anchorAt,
  };
}

/** @param {ResurrectionState} state @returns {ResurrectionState} */
export function disarmState(state) {
  return { ...state, armed: false, armedAt: null, armedBy: null, anchorAt: null };
}

/**
 * @param {ResurrectionState} state
 * @param {{ at: string, ok: boolean, exitCode: number | null, reason: string }} entry
 * @param {number} [keep] how many historical resumes to retain
 * @returns {ResurrectionState}
 */
export function recordResume(state, entry, keep = 50) {
  return { ...state, resumes: [...state.resumes, entry].slice(-keep) };
}

/**
 * Processes that are a live Claude Code CLI, excluding this daemon's own tree
 * and the claude-mem worker (which is a different program whose name contains
 * "claude" and must never be mistaken for a session).
 * @param {Array<{ pid: number, command: string }>} processes
 * @param {number[]} ownPids
 * @returns {Array<{ pid: number, command: string }>}
 */
export function claudeProcessesOf(processes, ownPids) {
  return processes.filter(
    (p) =>
      !ownPids.includes(p.pid) &&
      CLAUDE_PROCESS_PATTERN.test(p.command) &&
      !/claude-mem|mcp-search|resurrection-daemon|idle-sensor/i.test(p.command),
  );
}

/**
 * A lock whose pid + process-start-time no longer match a live process is
 * stale and may be taken over. Same contract as the stage-3 sensor's lock.
 * @param {{ pid: number, procStart?: string | null } | null} lock
 * @param {{ pid: number, procStart?: string | null } | null} liveProcess
 * @returns {boolean}
 */
export function isLockStale(lock, liveProcess) {
  if (!lock || typeof lock.pid !== 'number') return true;
  if (!liveProcess) return true;
  if (liveProcess.pid !== lock.pid) return true;
  if (lock.procStart && liveProcess.procStart && lock.procStart !== liveProcess.procStart) return true;
  return false;
}

/** @param {number} ms @returns {string} */
export function formatAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '알 수 없음';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  return `${h}시간 ${m % 60}분`;
}

/**
 * Human-readable status block (Korean, founder-facing).
 * @param {ResurrectionState} state
 * @param {{ lastActivityMs: number, inFlight: boolean, claudeRunning: boolean, killSwitch: boolean, trusted: boolean }} signals
 * @param {number} now
 * @param {{ haltMs?: number, maxResumes?: number }} [options]
 * @returns {string}
 */
export function summarize(state, signals, now, options = {}) {
  const verdict = decideResume({ ...signals, state, rateLimit: null }, now, options);
  const recent = resumesInWindow(state.resumes, now);
  const lines = [
    `상태      : ${state.armed ? 'ARMED (작업 진행 중)' : 'DISARMED (대기, 토큰 소모 0)'}`,
    `마지막 활동: ${formatAge(Math.max(0, now - signals.lastActivityMs))} 전`,
    `진행 중 턴 : ${signals.inFlight ? 'user 턴 무응답 (중단 후보)' : 'assistant 턴 (정상 완료)'}`,
    `세션 구동 : ${signals.claudeRunning ? 'claude 구동 중' : '없음'}`,
    `신뢰 검증 : ${signals.trusted ? 'OK' : '실패 — 부활 비활성'}`,
    `킬 스위치 : ${signals.killSwitch ? '켜짐 (영구 보류)' : '꺼짐'}`,
    `24h 부활  : ${recent.length}/${options.maxResumes ?? MAX_RESUMES_PER_WINDOW}`,
    `판정      : ${verdict.resume ? '지금 부활' : verdict.reason}`,
  ];
  if (state.directive) lines.push(`재개 지시  : ${state.directive}`);
  return lines.join('\n');
}

/**
 * @param {string[]} argv
 * @returns {{ once: boolean, dryRun: boolean, arm: boolean, disarm: boolean, status: boolean, haltMin: number, intervalSec: number, directive: string | null }}
 */
export function parseArgs(argv) {
  const valueOf = (flag, fallback) => {
    const i = argv.indexOf(flag);
    if (i === -1 || i + 1 >= argv.length) return fallback;
    const n = Number(argv[i + 1]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const stringOf = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 && i + 1 < argv.length ? argv[i + 1] : null;
  };
  return {
    once: argv.includes('--once'),
    dryRun: argv.includes('--dry-run'),
    arm: argv.includes('--arm'),
    disarm: argv.includes('--disarm'),
    status: argv.includes('--status'),
    haltMin: valueOf('--halt-min', DEFAULT_HALT_MS / 60000),
    intervalSec: valueOf('--interval-sec', DEFAULT_TICK_MS / 1000),
    directive: stringOf('--directive'),
  };
}
