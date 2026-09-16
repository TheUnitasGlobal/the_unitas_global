import { describe, expect, it } from 'vitest';
import { buildBrief, briefToHookContext, classifyFreshness, DEFAULT_BASELINE } from '../../scripts/stage3-brief-core.mjs';

// REV-36 M2 (SPEC §4.2) -- every branch of the morning brief, with the exact
// Korean line forms and the exact hook header / directive lines. KST formatting
// is deterministic because the core is handed the instant, never a live clock.

const BUILD = 'XNbZCARycWdgA0fs1rnDr';
const HEAD = 'bcbecafb5790347883b9593aa98a36b5222539f9';
const NOW = 1_790_000_000_000;
const TASK_RUNNING = { installed: true, state: 'Running' };
const TASK_STOPPED = { installed: true, state: 'Ready' };
const TASK_ABSENT = { installed: false, state: null };

function passLatest(over = {}) {
  return {
    status: 'passed',
    buildId: BUILD,
    head: HEAD,
    startedAt: '2026-09-16T02:00:00.000Z',
    finishedAt: '2026-09-16T03:40:00.000Z',
    totals: { expected: 587, unexpected: 0, flaky: 0, skipped: 33 },
    failures: [],
    ...over,
  };
}

function base(over = {}) {
  return { latest: null, buildId: BUILD, head: HEAD, lockAlive: false, task: TASK_RUNNING, attestation: null, now: NOW, ...over };
}

describe('classifyFreshness', () => {
  it('is fresh only when build AND head match', () => {
    expect(classifyFreshness(passLatest(), { buildId: BUILD, head: HEAD })).toBe('fresh');
    expect(classifyFreshness(passLatest(), { buildId: 'other', head: HEAD })).toBe('stale');
    expect(classifyFreshness(passLatest(), { buildId: BUILD, head: 'other' })).toBe('stale');
    expect(classifyFreshness(null, { buildId: BUILD, head: HEAD })).toBe('none');
  });
});

describe('buildBrief', () => {
  it('pass + fresh: 에러 0건 통과 with totals, build, head', () => {
    const b = buildBrief(base({ latest: passLatest() }));
    expect(b.severity).toBe('pass');
    expect(b.line).toContain('에러 0건 통과');
    expect(b.line).toContain('통과 587');
    expect(b.line).toContain('스킵 33');
    expect(b.line).toContain('총 620');
    expect(b.line).toContain('빌드 XNbZCAR');
    expect(b.line).toContain('HEAD bcbecaf');
    expect(b.line.startsWith('간밤의 3엔진')).toBe(true);
  });

  it('pass + stale: [옛 빌드] prefix and severity stale', () => {
    const b = buildBrief(base({ latest: passLatest(), buildId: 'newbuild123', head: 'newhead0000000' }));
    expect(b.severity).toBe('stale');
    expect(b.line.startsWith('[옛 빌드] ')).toBe(true);
    expect(b.details.join(' ')).toContain('현재 빌드 newbui');
  });

  it('fail: counts every kind, links READER, action set', () => {
    const latest = passLatest({
      status: 'failed',
      totals: { expected: 580, unexpected: 3, flaky: 0, skipped: 33 },
      failures: [
        { kind: 'product-defect' },
        { kind: 'contract-drift' },
        { kind: 'contract-drift' },
        { kind: 'harness-flake' },
      ],
    });
    const b = buildBrief(base({ latest }));
    expect(b.severity).toBe('fail');
    expect(b.line).toContain('실패 3건');
    expect(b.line).toContain('제품 결함 1');
    expect(b.line).toContain('계약 드리프트 2');
    expect(b.line).toContain('하네스 플레이크 1');
    expect(b.line).toContain('@docs/stage3/READER.md');
    expect(b.action).toBe('@docs/stage3/READER.md');
  });

  it('cancelled: 완주 없음 with the cancel reason and start time', () => {
    const latest = passLatest({ status: 'cancelled', cancelReason: 'transcript advanced 9s ago', finishedAt: '2026-09-16T03:40:00.000Z' });
    const b = buildBrief(base({ latest }));
    expect(b.severity).toBe('cancelled');
    expect(b.line).toContain('완주 없음');
    expect(b.line).toContain('transcript advanced 9s ago');
    expect(b.line).toContain('다음 유휴 창에서 재시도');
  });

  it('none: 기록 없음 with the right daemon state', () => {
    expect(buildBrief(base({ latest: null, task: TASK_RUNNING })).line).toContain('데몬 실행 중');
    expect(buildBrief(base({ latest: null, task: TASK_STOPPED, lockAlive: false })).line).toContain('데몬 정지');
    expect(buildBrief(base({ latest: null, task: TASK_ABSENT })).line).toContain('데몬 미설치');
    expect(buildBrief(base({ latest: null })).severity).toBe('none');
  });

  it('lockAlive rescues the daemon state when the task query says Ready', () => {
    expect(buildBrief(base({ latest: null, task: TASK_STOPPED, lockAlive: true })).line).toContain('데몬 실행 중');
  });

  it('attestation failure appends the warning to every branch', () => {
    const att = { ok: false, line: '신뢰 등록 검증 실패 -- 불일치 1' };
    for (const latest of [null, passLatest(), passLatest({ status: 'failed', failures: [] }), passLatest({ status: 'cancelled' })]) {
      const b = buildBrief(base({ latest, attestation: att }));
      expect(b.line).toContain('⚠ 신뢰 증명 실패: 스윕 비활성 → npm run security:trust:verify');
      expect(b.details.join(' ')).toContain('신뢰 증명:');
    }
  });

  it('KST formatting is deterministic for a given instant', () => {
    const a = buildBrief(base({ latest: passLatest() })).line;
    const b = buildBrief(base({ latest: passLatest() })).line;
    expect(a).toBe(b);
    // 03:40 UTC finish -> 12:40 KST (UTC+9).
    expect(a).toContain('12:40');
  });

  it('uses the REV-33 baseline by default', () => {
    expect(DEFAULT_BASELINE.expected).toBe(587);
    expect(buildBrief(base({ latest: passLatest() })).details.join(' ')).toContain('REV-33');
  });
});

describe('briefToHookContext', () => {
  it('carries the exact header and the exact founder directive', () => {
    const ctx = briefToHookContext(buildBrief(base({ latest: passLatest() })));
    const lines = ctx.split('\n');
    expect(lines[0]).toBe('[Stage-3 자율 브리핑 · Codex 제13장 3단계 · REV-36 M2]');
    expect(lines[1]).toContain('에러 0건 통과');
    expect(ctx).toContain('창립자에게 보내는 첫 응답의 첫 줄에 위 브리핑 한 줄을 그대로 선제 보고하라');
    expect(ctx).toContain('전수 E2E를 재실행하지 않는다');
  });
});
