import { describe, expect, it } from 'vitest';

import {
  MISSION_STATUSES,
  OPEN_STATUSES,
  missionHookContext,
  missionLine,
  openMissions,
  parseQueue,
  setMissionStatus,
} from '../../scripts/mission-queue-core.mjs';

/**
 * The queue's job is to make a deliberately-deferred mission find the next
 * session by itself. The invariant worth protecting: a queue that cannot be
 * read must FAIL, never quietly report "nothing pending" -- that is the same
 * false-green class of bug as the credential outage whose leftovers are this
 * queue's first mission.
 */

const MISSION = {
  id: 'unitas.mission.example',
  title: 'Example mission',
  status: 'queued',
  priority: 'medium',
  window: 'idle-night',
  spec: 'docs/missions/example.md',
  acceptance: ['typecheck EXIT 0'],
};

const QUEUE = { version: 1, missions: [MISSION] };

describe('parseQueue', () => {
  it('accepts a well-formed queue', () => {
    const q = parseQueue(structuredClone(QUEUE));
    expect(q.version).toBe(1);
    expect(q.missions).toHaveLength(1);
  });

  it('accepts an empty mission list', () => {
    expect(parseQueue({ version: 1, missions: [] }).missions).toEqual([]);
  });

  it('throws rather than returning an empty queue on malformed input', () => {
    expect(() => parseQueue(null)).toThrow(/객체/);
    expect(() => parseQueue([])).toThrow(/객체/);
    expect(() => parseQueue({ version: 2, missions: [] })).toThrow(/version/);
    expect(() => parseQueue({ version: 1 })).toThrow(/배열/);
    expect(() => parseQueue({ version: 1, missions: [null] })).toThrow(/객체/);
  });

  it('requires id and title on every mission', () => {
    expect(() => parseQueue({ version: 1, missions: [{ title: 'x', status: 'queued' }] })).toThrow(/id/);
    expect(() => parseQueue({ version: 1, missions: [{ id: 'a', status: 'queued' }] })).toThrow(/title/);
  });

  it('rejects a duplicate id, which would make status transitions ambiguous', () => {
    expect(() => parseQueue({ version: 1, missions: [MISSION, { ...MISSION }] })).toThrow(/중복/);
  });

  it('rejects an unknown status rather than treating it as closed', () => {
    expect(() => parseQueue({ version: 1, missions: [{ ...MISSION, status: 'maybe' }] })).toThrow(/status/);
    for (const s of MISSION_STATUSES) {
      expect(() => parseQueue({ version: 1, missions: [{ ...MISSION, status: s }] })).not.toThrow();
    }
  });
});

describe('openMissions', () => {
  it('counts queued, in-progress and blocked as open', () => {
    const q = parseQueue({
      version: 1,
      missions: OPEN_STATUSES.map((s, i) => ({ ...MISSION, id: `m${i}`, status: s })),
    });
    expect(openMissions(q)).toHaveLength(OPEN_STATUSES.length);
  });

  it('excludes done and cancelled', () => {
    const q = parseQueue({
      version: 1,
      missions: [
        { ...MISSION, id: 'a', status: 'done' },
        { ...MISSION, id: 'b', status: 'cancelled' },
      ],
    });
    expect(openMissions(q)).toEqual([]);
  });

  it('orders high before medium before low, and treats missing priority as medium', () => {
    const q = parseQueue({
      version: 1,
      missions: [
        { ...MISSION, id: 'low', priority: 'low' },
        { ...MISSION, id: 'high', priority: 'high' },
        { ...MISSION, id: 'none', priority: undefined },
      ],
    });
    expect(openMissions(q).map((m) => m.id)).toEqual(['high', 'none', 'low']);
  });
});

describe('missionLine', () => {
  it('returns null on an empty queue so the hook appends nothing', () => {
    expect(missionLine(parseQueue({ version: 1, missions: [] }))).toBeNull();
  });

  it('returns null when every mission is closed', () => {
    const q = parseQueue({ version: 1, missions: [{ ...MISSION, status: 'done' }] });
    expect(missionLine(q)).toBeNull();
  });

  it('names the count, the window and the spec path', () => {
    const line = missionLine(parseQueue(structuredClone(QUEUE)));
    expect(line).toContain('1건');
    expect(line).toContain('[idle-night]');
    expect(line).toContain('@docs/missions/example.md');
  });

  it('summarises the tail rather than listing everything', () => {
    const q = parseQueue({
      version: 1,
      missions: [MISSION, { ...MISSION, id: 'b' }, { ...MISSION, id: 'c' }],
    });
    expect(missionLine(q)).toContain('외 2건');
  });

  it('omits the spec suffix when a mission has no spec', () => {
    const q = parseQueue({ version: 1, missions: [{ ...MISSION, spec: undefined }] });
    expect(missionLine(q)).not.toContain('@');
  });
});

describe('missionHookContext', () => {
  it('returns null when nothing is open', () => {
    expect(missionHookContext(parseQueue({ version: 1, missions: [] }))).toBeNull();
  });

  /**
   * Codex v41.0 제15장 「비동기 큐 전면 자율 인계 원칙」 (founder directive
   * 2026-09-17). This block used to assert the OPPOSITE contract -- that the
   * hook tells the agent not to start without an explicit approval keyword.
   * The ratified clause makes the founder's queue write the 제16장 결재 itself,
   * so the hook must now dispatch rather than gate. The negative assertion is
   * the load-bearing half: the superseded sentence shipped in every single
   * SessionStart for weeks, and a partial edit that left it behind would keep
   * contradicting the canon at runtime while this suite stayed green.
   */
  it('dispatches the mission under 제15장 pre-delegated approval', () => {
    const ctx = missionHookContext(parseQueue(structuredClone(QUEUE)));
    expect(ctx).toContain('제15장');
    expect(ctx).toContain('제16장');
    expect(ctx).toContain('즉시 착수');
    expect(ctx).not.toContain('명시적 승인 키워드 없이');
    expect(ctx).not.toContain('착수하지 않는다');
  });

  it('keeps the 제16장 fence on scope the founder never queued', () => {
    const ctx = missionHookContext(parseQueue(structuredClone(QUEUE)));
    expect(ctx).toContain('큐에 없는 신규 범위');
    expect(ctx).toContain('프로덕션 배포');
  });

  it('refuses to let 즉각 착수 become a completion claim (제13장)', () => {
    const ctx = missionHookContext(parseQueue(structuredClone(QUEUE)));
    expect(ctx).toContain('EXIT 0');
    expect(ctx).toContain('done');
    expect(ctx).toContain('제13장');
  });

  it('states that the daemon does not execute missions', () => {
    const ctx = missionHookContext(parseQueue(structuredClone(QUEUE)));
    expect(ctx).toContain('모델 무관');
  });

  it('lists every open mission with its acceptance gates', () => {
    const ctx = missionHookContext(parseQueue(structuredClone(QUEUE)));
    expect(ctx).toContain('unitas.mission.example');
    expect(ctx).toContain('typecheck EXIT 0');
  });
});

describe('setMissionStatus', () => {
  it('returns a new queue and does not mutate the original', () => {
    const q = parseQueue(structuredClone(QUEUE));
    const next = setMissionStatus(q, MISSION.id, 'done');
    expect(next.missions[0].status).toBe('done');
    expect(q.missions[0].status).toBe('queued');
  });

  it('rejects an unknown status', () => {
    const q = parseQueue(structuredClone(QUEUE));
    expect(() => setMissionStatus(q, MISSION.id, 'finished')).toThrow(/status/);
  });

  it('rejects an unknown id rather than silently doing nothing', () => {
    const q = parseQueue(structuredClone(QUEUE));
    expect(() => setMissionStatus(q, 'nope', 'done')).toThrow(/찾을 수 없습니다/);
  });

  it('closing the last open mission empties the brief', () => {
    const q = parseQueue(structuredClone(QUEUE));
    expect(missionLine(setMissionStatus(q, MISSION.id, 'done'))).toBeNull();
  });
});
