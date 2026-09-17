#!/usr/bin/env node
// ---------------------------------------------------------------------------
// mission-queue.mjs -- night-shift mission queue CLI (founder directive
// 2026-09-17, Codex 제15장 3단계 / 제16장).
//
// The queue is the durable record of work that is correct but deliberately
// NOT done yet. `stage3-brief.mjs --hook` surfaces it at SessionStart so a
// queued mission finds the next agent session on its own; this CLI is where a
// malformed queue is meant to shout, and where status transitions happen.
//
// Usage:
//   node scripts/mission-queue.mjs              # human listing
//   node scripts/mission-queue.mjs --json       # machine listing
//   node scripts/mission-queue.mjs --line       # the one-line SessionStart form
//   node scripts/mission-queue.mjs --set <id> <status>
//
// npm aliases: mission:list / mission:json / mission:set
//
// Exit codes: 0 always for listings (an empty queue is not an error); 1 on a
// malformed queue or an unknown id -- fail-closed, because a queue that reads
// as "nothing pending" because it failed to parse is the same false-green
// class of bug as the credential outage that produced its first mission.
// ---------------------------------------------------------------------------
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MISSION_STATUSES,
  missionLine,
  openMissions,
  parseQueue,
  setMissionStatus,
} from './mission-queue-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(__dirname, '..', '..');
const QUEUE_FILE = path.join(REPO_DIR, 'config', 'missions', 'queue.json');

function load() {
  if (!existsSync(QUEUE_FILE)) {
    console.error(`✖ 미션 큐가 없습니다: ${QUEUE_FILE}`);
    process.exit(1);
  }
  try {
    return parseQueue(JSON.parse(readFileSync(QUEUE_FILE, 'utf8')));
  } catch (err) {
    console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

const argv = process.argv.slice(2);
const queue = load();

if (argv[0] === '--set') {
  const [, id, status] = argv;
  if (!id || !status) {
    console.error(`사용법: node scripts/mission-queue.mjs --set <id> <${MISSION_STATUSES.join('|')}>`);
    process.exit(1);
  }
  let next;
  try {
    next = setMissionStatus(queue, id, status);
  } catch (err) {
    console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  writeFileSync(QUEUE_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`✓ ${id} → ${status}`);
  process.exit(0);
}

if (argv.includes('--line')) {
  const line = missionLine(queue);
  if (line) console.log(line);
  process.exit(0);
}

if (argv.includes('--json')) {
  console.log(JSON.stringify({ line: missionLine(queue), missions: queue.missions }, null, 2));
  process.exit(0);
}

const open = openMissions(queue);
console.log('[야간 미션 큐 · Codex 제15장 3단계]');
console.log(`  총 ${queue.missions.length}건 · 열린 미션 ${open.length}건`);
if (!open.length) {
  console.log('  대기 중인 미션 없음.');
  process.exit(0);
}
for (const m of open) {
  console.log('');
  console.log(`  [${m.status}] ${m.id}`);
  console.log(`      ${m.title}`);
  if (m.priority) console.log(`      우선순위 : ${m.priority}${m.window ? ` · 창 ${m.window}` : ''}`);
  if (m.spec) console.log(`      명세     : @${m.spec}`);
  if (m.files?.length) console.log(`      대상     : ${m.files.length}파일`);
  if (m.acceptance?.length) console.log(`      수용 게이트:\n${m.acceptance.map((a) => `        · ${a}`).join('\n')}`);
  if (m.authorizedBy) console.log(`      결재     : ${m.authorizedBy}`);
}
console.log('');
console.log('  실행은 창립자의 명시적 승인 키워드 이후에만 착수한다(제16장). 데몬은 모델 무관이라 미션을 대신 수행하지 않는다.');
process.exit(0);
