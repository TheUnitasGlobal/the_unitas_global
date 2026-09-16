/**
 * REV-36 MISSION 2 -- the stage-3 morning brief, pure half (no fs, no process,
 * no clock beyond formatting a timestamp it is handed). The idle-sensor daemon
 * (Codex ch.13 stage 3) runs the 3-engine sweep overnight and writes
 * test-results/stage3/latest.json; the founder should not have to go read it.
 * This turns that file (plus the current build/HEAD, the daemon's liveness and
 * the trust attestation) into ONE Korean line the agent reports first, and a
 * hook-context block that tells the agent to do exactly that.
 *
 * The line formats are fixed (SPEC §4.2) and proven by briefCore.test.ts.
 */

/** REV-33 baseline, mirrored from idle-sensor-core BASELINE for a self-contained brief. */
export const DEFAULT_BASELINE = Object.freeze({ label: 'REV-33', expected: 587, skipped: 33, total: 621 });

/** @param {string | null | undefined} s */
function short(s) {
  return String(s ?? '').slice(0, 7);
}

/** Format an epoch/ISO instant in KST. Pure: it is handed the instant. */
function kst(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '(시각 불명)';
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '(시각 불명)';
  }
}

/**
 * Is the recorded sweep for the build/HEAD that is checked out now?
 * @param {any} latest  parsed latest.json, or null
 * @param {{ buildId: string | null, head: string | null }} current
 * @returns {'fresh' | 'stale' | 'none'}
 */
export function classifyFreshness(latest, current) {
  if (!latest || typeof latest !== 'object' || typeof latest.status !== 'string') return 'none';
  const sameBuild = latest.buildId && current.buildId && latest.buildId === current.buildId;
  const sameHead = latest.head && current.head && latest.head === current.head;
  return sameBuild && sameHead ? 'fresh' : 'stale';
}

/**
 * @typedef {object} BriefInput
 * @property {any} latest                         parsed latest.json or null
 * @property {string | null} buildId              current web/.next/BUILD_ID
 * @property {string | null} head                 current git HEAD
 * @property {boolean} lockAlive                  daemon.lock points at a live pid
 * @property {{ installed: boolean, state: string | null }} task  scheduled-task state
 * @property {{ ok: boolean, line: string } | null} attestation   trust attestation, or null when unknown
 * @property {number} now                          epoch ms (the CLI supplies it)
 * @property {{ label: string, expected: number, skipped: number, total: number }} [baseline]
 *
 * @typedef {object} Brief
 * @property {string} line
 * @property {'pass' | 'fail' | 'cancelled' | 'none' | 'stale'} severity
 * @property {string[]} details
 * @property {string | null} action
 */

/** @param {{ installed: boolean, state: string | null }} task @param {boolean} lockAlive */
function daemonState(task, lockAlive) {
  if (!task || !task.installed) return '미설치';
  if (task.state === 'Running' || lockAlive) return '실행 중';
  return '정지';
}

/**
 * The whole brief. Pure.
 * @param {BriefInput} input
 * @returns {Brief}
 */
export function buildBrief(input) {
  const { latest, buildId, head, lockAlive, task, attestation } = input;
  const baseline = input.baseline ?? DEFAULT_BASELINE;
  const details = [];
  let action = null;
  let line;
  let severity;

  if (!latest || typeof latest !== 'object' || typeof latest.status !== 'string') {
    severity = 'none';
    line = `간밤의 3엔진 E2E 전수 검사: 기록 없음 — 아직 완주한 스윕이 없습니다 (데몬 ${daemonState(task, lockAlive)})`;
    details.push(`현재 빌드 ${short(buildId) || '(없음)'} · HEAD ${short(head)}`);
  } else {
    const freshness = classifyFreshness(latest, { buildId, head });
    const t = latest.totals ?? { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
    const total = (t.expected ?? 0) + (t.unexpected ?? 0) + (t.flaky ?? 0) + (t.skipped ?? 0);
    const stalePrefix = freshness === 'stale' ? '[옛 빌드] ' : '';

    if (latest.status === 'cancelled') {
      severity = 'cancelled';
      line = `간밤의 3엔진 E2E 전수 검사: 완주 없음 — 마지막 스윕 취소(${latest.cancelReason ?? '활동 감지'}, ${kst(latest.startedAt)}) · 다음 유휴 창에서 재시도`;
      details.push(`취소 스윕 빌드 ${short(latest.buildId)} · HEAD ${short(latest.head)}`);
    } else if (latest.status === 'passed') {
      severity = freshness === 'stale' ? 'stale' : 'pass';
      line = `${stalePrefix}간밤의 3엔진 E2E 전수 검사: 에러 0건 통과 (통과 ${t.expected ?? 0} · 스킵 ${t.skipped ?? 0} · 총 ${total} · 빌드 ${short(latest.buildId)} · HEAD ${short(latest.head)} · ${kst(latest.finishedAt)})`;
      details.push(`기준선 ${baseline.label}: 통과 ${baseline.expected} · 스킵 ${baseline.skipped} · 총 ${baseline.total} (통과 ${(t.expected ?? 0) - baseline.expected >= 0 ? '+' : ''}${(t.expected ?? 0) - baseline.expected})`);
      if (freshness === 'stale') details.push(`현재 빌드 ${short(buildId)} · HEAD ${short(head)} — 스윕은 옛 빌드다. 다음 유휴 창이 새 빌드를 스윕한다.`);
    } else {
      // failed
      severity = 'fail';
      const failures = Array.isArray(latest.failures) ? latest.failures : [];
      const a = failures.filter((f) => f && f.kind === 'product-defect').length;
      const b = failures.filter((f) => f && f.kind === 'contract-drift').length;
      const c = failures.filter((f) => f && f.kind === 'harness-flake').length;
      const f = t.unexpected ?? failures.length;
      line = `${stalePrefix}간밤의 3엔진 E2E 전수 검사: 실패 ${f}건(제품 결함 ${a} · 계약 드리프트 ${b} · 하네스 플레이크 ${c}) · 통과 ${t.expected ?? 0}/${total} · HEAD ${short(latest.head)} → @docs/stage3/READER.md 절차 필요`;
      action = '@docs/stage3/READER.md';
      details.push(`실패 분류: 제품 결함 ${a} · 계약 드리프트 ${b} · 하네스 플레이크 ${c}`);
      if (freshness === 'stale') details.push(`현재 빌드 ${short(buildId)} · HEAD ${short(head)} — 스윕은 옛 빌드다.`);
    }
  }

  if (attestation && attestation.ok === false) {
    line += ' · ⚠ 신뢰 증명 실패: 스윕 비활성 → npm run security:trust:verify';
    details.push(`신뢰 증명: ${attestation.line}`);
  }

  return { line, severity, details, action };
}

/**
 * The SessionStart hook injects this string into the session context.
 * @param {Brief} brief
 * @returns {string}
 */
export function briefToHookContext(brief) {
  const lines = ['[Stage-3 자율 브리핑 · Codex 제13장 3단계 · REV-36 M2]', brief.line];
  for (const d of brief.details) lines.push(`- ${d}`);
  lines.push(
    '에이전트 지시: 창립자에게 보내는 첫 응답의 첫 줄에 위 브리핑 한 줄을 그대로 선제 보고하라. 되묻지 않는다(제4장 제로 핸즈). 실패가 있으면 READER.md 4단계로 분류만 보고하고 창립자 지시 없이 전수 E2E를 재실행하지 않는다.',
  );
  return lines.join('\n');
}
