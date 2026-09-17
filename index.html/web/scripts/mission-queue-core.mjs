/**
 * THE UNITAS GLOBAL -- night-shift mission queue, pure core.
 *
 * WHY THIS EXISTS
 * ---------------
 * 2026-09-17 founder directive: a refactor that is correct but too risky to
 * land immediately before a production deploy must not simply be written down
 * in a report nobody re-reads. It must be QUEUED, and the queue must find the
 * next agent session by itself.
 *
 * WHAT THIS IS NOT
 * ----------------
 * This is not a background executor. `UnitasIdleSensorStage3` is deliberately
 * MODEL-FREE (its own header: "launching `claude -p` from here would spend
 * tokens in the background"), and Codex 제5장 caps unattended spend. So the
 * daemon does not perform missions; it proves gates. Dispatch works the same
 * way stage-3 sweep results already reach an agent:
 *
 *   founder queues the mission  (that write IS the approval -- see below)
 *     -> SessionStart hook injects the pending line (stage3-brief.mjs --hook)
 *       -> the agent reads docs/missions/READER.md and starts IMMEDIATELY at
 *          the forced tier, with the founder present to interrupt
 *
 * APPROVAL SEMANTICS (Codex v41.0 제15장, 비동기 큐 전면 자율 인계 원칙)
 * --------------------------------------------------------------------
 * Until that clause was ratified this module emitted the opposite instruction
 * on every SessionStart -- it told the agent to hold a queued mission until
 * the founder typed an approval keyword. That sentence is now retired
 * outright, quotation included, by founder directive; the only place its
 * wording still appears is the negative assertion in
 * web/__tests__/security/missionQueueCore.test.ts that keeps it from coming
 * back. 제15장 holds that WRITING a mission into config/missions/queue.json is
 * itself the 제16장 결재 (승인 사전 위임 / Pre-Delegated Approval), so the agent
 * must not ask again for work the founder already queued. The fence moved
 * rather than disappeared, and the part that matters still holds: scope that
 * is NOT in the queue, live-DB mutation, production deploys and completion
 * require an explicit keyword, and 제13장 still forbids promoting a mission to
 * `done` before every acceptance gate reads EXIT 0.
 *
 * That is a real dispatch path the founder can interrupt at any moment, not a
 * cron that rewrites the codebase at 3am unsupervised.
 *
 * PURITY CONTRACT
 * ---------------
 * No fs, no clock, no process. Callers read the JSON and pass it in. Every
 * branch is unit-testable without a fixture directory.
 */

/** Statuses a mission may hold. Anything else is a malformed queue. */
export const MISSION_STATUSES = Object.freeze(['queued', 'in-progress', 'blocked', 'done', 'cancelled']);

/** Statuses that still need an agent to do something. */
export const OPEN_STATUSES = Object.freeze(['queued', 'in-progress', 'blocked']);

/**
 * @typedef {object} Mission
 * @property {string} id
 * @property {string} title
 * @property {string} status
 * @property {string} [priority]
 * @property {string} [window]        when it may run, e.g. 'idle-night'
 * @property {string} [spec]          repo-relative path to the full spec
 * @property {string[]} [acceptance]  gates that must read EXIT 0
 * @property {string[]} [files]       the files the mission touches
 * @property {string} [authorizedBy]
 * @property {string} [authorizedAt]
 * @property {string} [notes]
 *
 * @typedef {object} Queue
 * @property {number} version
 * @property {string} [doctrine]
 * @property {Mission[]} missions
 */

/**
 * Validate and normalize a parsed queue document. Throws on a malformed queue
 * rather than silently returning an empty one -- a queue that reads as "no
 * pending work" because it failed to parse is the same false-green class of
 * bug as the credential outage this queue's first mission exists to finish
 * cleaning up.
 *
 * @param {unknown} doc
 * @returns {Queue}
 */
export function parseQueue(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('mission-queue: 최상위가 객체가 아닙니다.');
  }
  const version = /** @type {any} */ (doc).version;
  if (version !== 1) throw new Error(`mission-queue: 지원하지 않는 version ${String(version)} (1이어야 합니다).`);

  const missions = /** @type {any} */ (doc).missions;
  if (!Array.isArray(missions)) throw new Error('mission-queue: missions 가 배열이 아닙니다.');

  const seen = new Set();
  for (const [i, m] of missions.entries()) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error(`mission-queue: missions[${i}] 가 객체가 아닙니다.`);
    if (typeof m.id !== 'string' || !m.id.trim()) throw new Error(`mission-queue: missions[${i}] 에 id 가 없습니다.`);
    if (seen.has(m.id)) throw new Error(`mission-queue: id 중복 "${m.id}".`);
    seen.add(m.id);
    if (typeof m.title !== 'string' || !m.title.trim()) throw new Error(`mission-queue: "${m.id}" 에 title 이 없습니다.`);
    if (!MISSION_STATUSES.includes(m.status)) {
      throw new Error(`mission-queue: "${m.id}" 의 status "${String(m.status)}" 는 허용되지 않습니다 (${MISSION_STATUSES.join(' | ')}).`);
    }
  }
  return { version, doctrine: /** @type {any} */ (doc).doctrine, missions };
}

/**
 * @param {Queue} queue
 * @returns {Mission[]} missions that still need an agent, highest priority first
 */
export function openMissions(queue) {
  const rank = { high: 0, medium: 1, low: 2 };
  return queue.missions
    .filter((m) => OPEN_STATUSES.includes(m.status))
    .slice()
    .sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1));
}

/**
 * The single line the SessionStart brief appends. Returns null when there is
 * nothing pending, so the caller appends nothing rather than a noisy "0건".
 *
 * @param {Queue} queue
 * @returns {string | null}
 */
export function missionLine(queue) {
  const open = openMissions(queue);
  if (!open.length) return null;
  const head = open[0];
  const rest = open.length - 1;
  const where = head.spec ? ` → @${head.spec}` : '';
  const win = head.window ? ` [${head.window}]` : '';
  return `대기 중인 야간 미션 ${open.length}건${win}: ${head.title}${rest > 0 ? ` 외 ${rest}건` : ''}${where}`;
}

/**
 * The block appended to the SessionStart hook context. Mirrors the stage-3
 * brief's contract: the agent reports it in its first line and then starts
 * immediately under 제15장's pre-delegated approval -- the queue entry IS the
 * founder's 결재, so re-asking is a 제6장 violation, not caution. What the
 * agent still may not do is call a mission done before every acceptance gate
 * reads EXIT 0 (제13장).
 *
 * @param {Queue} queue
 * @returns {string | null}
 */
export function missionHookContext(queue) {
  const line = missionLine(queue);
  if (!line) return null;
  const open = openMissions(queue);
  const rows = open.map((m) => {
    const bits = [`  - [${m.status}] ${m.id} — ${m.title}`];
    if (m.spec) bits.push(`      명세 @${m.spec}`);
    if (m.acceptance?.length) bits.push(`      수용 게이트: ${m.acceptance.join(' · ')}`);
    return bits.join('\n');
  });
  return [
    '[야간 미션 큐 · Codex 제15장 비동기 큐 전면 자율 인계 / 제13장 Fail-Closed]',
    line,
    ...rows,
    '에이전트 지시: 위 한 줄을 첫 응답에 선제 보고하고, 되묻지 말고 즉시 착수한다 — 창립자가 큐에 등재한 행위 자체가 제16장의 결재다(제15장 승인 사전 위임 · 제6장 제로 핸즈). 착수 즉시 상태를 in-progress 로 옮기고, acceptance 전항이 EXIT 0 을 읽고 3엔진 스윕이 새 BUILD_ID@HEAD 로 완주하기 전에는 done 으로 승격하지 않는다(제13장). 큐에 없는 신규 범위·라이브 DB 변형·프로덕션 배포·최종 완결은 여전히 창립자의 명시적 키워드를 요구한다. 데몬은 모델 무관이므로 미션을 대신 수행하지 않는다.',
  ].join('\n');
}

/**
 * Transition a mission's status, returning a NEW queue (no mutation).
 *
 * @param {Queue} queue
 * @param {string} id
 * @param {string} status
 * @returns {Queue}
 */
export function setMissionStatus(queue, id, status) {
  if (!MISSION_STATUSES.includes(status)) {
    throw new Error(`mission-queue: status "${status}" 는 허용되지 않습니다.`);
  }
  if (!queue.missions.some((m) => m.id === id)) {
    throw new Error(`mission-queue: id "${id}" 를 찾을 수 없습니다.`);
  }
  return {
    ...queue,
    missions: queue.missions.map((m) => (m.id === id ? { ...m, status } : m)),
  };
}
