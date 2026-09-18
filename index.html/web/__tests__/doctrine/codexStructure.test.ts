import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_CHAPTERS,
  EXPECTED_SLOT_COUNT,
  carriesDoctrine,
  missingChapterMentions,
  normalize,
  parseChapters,
  parseSlotGroups,
  parseSlots,
  slotStatistics,
  verifyStructure,
} from '../../scripts/codex-structure-core.mjs';

/**
 * MISSION 3 (founder directive 2026-09-17) — FINAL_REPORT A-4.
 *
 * Until this spec existed, NOTHING in the repository asserted the SHAPE of the
 * governing constitution. `scripts/sync-codex.mjs` proved that four copies
 * hash-matched the canon and that six summaries contained the string "v41.0",
 * and that is all it proved. A canon could lose a chapter, gain a chapter, be
 * renumbered end-to-end, or drop half its 1000 slots, and every gate in the
 * repo would stay green as long as the copies agreed with the damage.
 *
 * That is not a theoretical hole. It is the documented route of eight
 * consecutive recurrences (v17.0, v19.0, v20.0, v23.0, v26.0, v37.0, and both
 * v41.0 generations), the most recent being the 15-chapter -> 16-chapter
 * restructuring, which passed the drift gate untouched because the version
 * LABEL never changed.
 *
 * This spec closes it from the other side: the prebuild gate now calls
 * verifyStructure() on the canon, and these tests prove the verifier itself
 * actually fails when the document is damaged — a green structure check that
 * cannot go red is worse than no check at all.
 */

const OPS_ROOT = join(__dirname, '../../..');
const REPO_ROOT = join(OPS_ROOT, '..');

/** The three byte-identical git-root canon files. */
const CANON_FILES = [
  'CLAUDE.md',
  'THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md',
  join('.roo', 'rules', 'unitas-constitution.md'),
];

/** The four operational copies that carry the canon between markers. */
const COPY_FILES = [
  'CLAUDE.md',
  'THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md',
  join('.roo', 'rules', 'unitas-constitution.md'),
  join('.continue', 'context', 'THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md'),
];

const BEGIN_TAG = '<!-- UNITAS-CODEX-VERBATIM BEGIN -->\n';
const END_TAG = '<!-- UNITAS-CODEX-VERBATIM END -->';

function readCanon(rel: string): string {
  return normalize(readFileSync(join(REPO_ROOT, rel), 'utf8'));
}

function readCopyBlock(rel: string): string {
  const text = normalize(readFileSync(join(OPS_ROOT, rel), 'utf8'));
  const begin = text.indexOf(BEGIN_TAG);
  const end = text.indexOf(END_TAG);
  expect(begin, `${rel} is missing the VERBATIM BEGIN marker`).toBeGreaterThan(-1);
  expect(end, `${rel} is missing the VERBATIM END marker`).toBeGreaterThan(-1);
  return text.slice(begin + BEGIN_TAG.length, end);
}

const CANON = readCanon(CANON_FILES[0]);

describe('codex canon — chapter spine', () => {
  it('declares exactly 16 chapters, contiguously numbered 1..16', () => {
    const chapters = parseChapters(CANON);
    expect(chapters).toHaveLength(EXPECTED_CHAPTERS.length);
    expect(chapters.map((c) => c.n)).toEqual(EXPECTED_CHAPTERS.map((c) => c.n));
  });

  it('matches the ratified chapter titles exactly, so a silent retitle fails', () => {
    const chapters = parseChapters(CANON);
    for (const want of EXPECTED_CHAPTERS) {
      const got = chapters.find((c) => c.n === want.n);
      expect(got, `제${want.n}장 is absent from the canon`).toBeDefined();
      expect(got?.title, `제${want.n}장 title drifted from the ratified table`).toBe(want.title);
    }
  });

  it('keeps 제6장 초제로핸즈 between 제5장 and 제7장 (the v41.0 promotion that shifted 구 제6~15장 to 제7~16장)', () => {
    const chapters = parseChapters(CANON);
    const six = chapters.find((c) => c.n === 6);
    expect(six?.title).toContain('초제로핸즈');
    expect(chapters.find((c) => c.n === 7)?.title).toContain('옴니-테크');
    expect(chapters.find((c) => c.n === 16)?.title).toContain('라이브 DB');
  });
});

describe('codex canon — 1000 slot spine', () => {
  const { slots, duplicateNumbers, outOfRange } = parseSlots(CANON);
  const stats = slotStatistics(slots);

  it('carries every slot number 1..1000 exactly once', () => {
    expect(stats.total).toBe(EXPECTED_SLOT_COUNT);
    expect(stats.missing).toEqual([]);
    expect(duplicateNumbers).toEqual([]);
    expect(outOfRange).toEqual([]);
  });

  it('declares 14 groups whose ranges are contiguous and sum to 1000', () => {
    const groups = parseSlotGroups(CANON);
    expect(groups).toHaveLength(14);
    expect(groups.reduce((a, g) => a + g.declared, 0)).toBe(EXPECTED_SLOT_COUNT);
    expect(groups[0].from).toBe(1);
    expect(groups[groups.length - 1].to).toBe(EXPECTED_SLOT_COUNT);
    groups.forEach((g, i) => {
      expect(g.to - g.from + 1, `group [${g.from}~${g.to}] span vs declared`).toBe(g.declared);
      if (i > 0) expect(g.from, 'groups must be contiguous').toBe(groups[i - 1].to + 1);
    });
  });

  it('every group holds exactly as many slots as its header declares', () => {
    for (const g of parseSlotGroups(CANON)) {
      let actual = 0;
      for (let i = g.from; i <= g.to; i += 1) if (slots.has(i)) actual += 1;
      expect(actual, `group [${g.from}~${g.to}] declares ${g.declared}선`).toBe(g.declared);
    }
  });

  /**
   * 제2장's heading used to read "순수 고유 1000선, 중복 0", which was false as
   * worded — measured 2026-09-17: 791 distinct terms, 144 of them registered
   * across 353 slots, because the 801~1000 blocks are positional suffix
   * expansions of the earlier ones. The founder ordered the wording corrected
   * to what is actually guaranteed: slot-number integrity, plus structural
   * re-registration as a deliberate property. This test pins BOTH halves so
   * the heading and the document can never drift apart again.
   */
  it('guarantees slot-number integrity while permitting structural re-registration', () => {
    expect(stats.distinctTerms).toBeLessThan(EXPECTED_SLOT_COUNT);
    expect(stats.repeatedTerms).toBeGreaterThan(0);
    expect(stats.slotsWithRepeatedTerm).toBeGreaterThan(0);

    const heading = EXPECTED_CHAPTERS.find((c) => c.n === 2)?.title ?? '';
    expect(heading).toContain('결번 0');
    expect(heading).toContain('번호 중복 0');
    expect(heading).toContain('구조적 확장 등재 허용');
    expect(heading, '제2장 must no longer claim the terms themselves are unique').not.toContain('순수 고유 1000선');
  });
});

describe('codex canon — replication', () => {
  it('the 3 git-root canon files are identical after normalization', () => {
    const [first, ...rest] = CANON_FILES.map(readCanon);
    for (let i = 0; i < rest.length; i += 1) {
      expect(rest[i], `${CANON_FILES[i + 1]} diverged from ${CANON_FILES[0]}`).toBe(first);
    }
  });

  it('all 4 operational copies carry the canon verbatim and structurally intact', () => {
    for (const rel of COPY_FILES) {
      const block = readCopyBlock(rel);
      const verdict = verifyStructure(block);
      expect(verdict.failures, `${rel} block failed the structure check`).toEqual([]);
      expect(verdict.ok).toBe(true);
    }
  });

  it('the canon passes verifyStructure as a whole', () => {
    const verdict = verifyStructure(CANON);
    expect(verdict.failures).toEqual([]);
    expect(verdict.ok).toBe(true);
  });
});

/**
 * A structure gate that cannot fail is theatre. These mutate the real canon in
 * the ways the eight recurrences actually happened and require a red verdict.
 */
describe('codex structure verifier — proves it can fail', () => {
  it('fails when a chapter is deleted', () => {
    const damaged = CANON.replace('## 제6장. 초제로핸즈', '## 삭제된장. 초제로핸즈');
    expect(damaged).not.toBe(CANON);
    const verdict = verifyStructure(damaged);
    expect(verdict.ok).toBe(false);
    expect(verdict.failures.join('\n')).toMatch(/chapter count is 15|제16장 is missing|numbered/);
  });

  it('fails when the chapters are renumbered (the v41.0 15→16 shift, undone)', () => {
    // Re-collapse 제6장 into 제5장's block and shift the tail back by one --
    // the exact shape of the drift that slipped through eight times.
    let damaged = CANON;
    for (let n = 16; n >= 7; n -= 1) {
      damaged = damaged.replace(`## 제${n}장.`, `## 제${n - 1}장.`);
    }
    damaged = damaged.replace('## 제6장. 초제로핸즈', '### (merged) 초제로핸즈');
    const verdict = verifyStructure(damaged);
    expect(verdict.ok).toBe(false);
  });

  it('fails when a chapter is silently retitled', () => {
    const verdict = verifyStructure(
      CANON.replace('## 제16장. 라이브 DB 절대 동기화 및 공식 오피셜 통제 독트린', '## 제16장. 라이브 DB 동기화'),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.failures.join('\n')).toContain('title drifted');
  });

  it('fails when a slot is dropped from the 1000', () => {
    const verdict = verifyStructure(CANON.replace('1000.초광역절대마스터피스적', ''));
    expect(verdict.ok).toBe(false);
    expect(verdict.failures.join('\n')).toMatch(/1000 slot number\(s\) absent|slot number\(s\) absent: 1000|parsed 999 slots/);
  });

  it('fails when a group header under-declares its range', () => {
    const verdict = verifyStructure(CANON.replace('[901~1000 (', '[901~999 ('));
    expect(verdict.ok).toBe(false);
  });

  it('fails when 제2장 reverts to the false "순수 고유 1000선, 중복 0" wording', () => {
    const verdict = verifyStructure(
      CANON.replace(
        EXPECTED_CHAPTERS[1].title,
        '1000대 초-헌법 정본 마스터 리스트 (순수 고유 1000선, 중복 0)',
      ),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.failures.join('\n')).toContain('title drifted');
  });
});

/**
 * The summary files transcribe the chapter structure in their own prose, so
 * `--write` cannot repair them — which is precisely why they are the surface
 * that kept going stale. The drift gate now checks them; this proves the rule
 * that gate uses is the right one.
 */
describe('doctrine summaries — chapter map currency', () => {
  // The role charters are DISCOVERED here for the same reason the gate itself
  // discovers them (scripts/sync-codex.mjs): MISSION 1 (2026-09-18) grew the
  // review pass from two lenses into a five-stage role pipeline, and a
  // hand-written list of charters silently stops covering the role added
  // tomorrow. A test that enumerates what it checks cannot notice what it is
  // not checking.
  const AGENT_CHARTERS = readdirSync(join(OPS_ROOT, '.github', 'agents'))
    .filter((name) => name.endsWith('.agent.md'))
    .sort()
    .map((name) => join('.github', 'agents', name));

  const SUMMARY_FILES = [
    join('.github', 'copilot-instructions.md'),
    join('.continue', 'config.yaml'),
    ...AGENT_CHARTERS,
  ];

  // The pipeline stages named in scripts/agent-review.ps1. These are not
  // optional discoveries -- each one is read by the review driver as the single
  // source of its criteria, so a missing charter means a stage with no rules.
  const PIPELINE_CHARTERS = [
    'unitas-planner.agent.md',
    'unitas-code-reviewer.agent.md',
    'unitas-security-reviewer.agent.md',
    'unitas-ux-reviewer.agent.md',
    'unitas-e2e-runner.agent.md',
  ];
  const LAST = EXPECTED_CHAPTERS[EXPECTED_CHAPTERS.length - 1].n;

  it('every present summary that enumerates the structure reaches 제16장', () => {
    for (const rel of SUMMARY_FILES) {
      let text: string;
      try {
        text = normalize(readFileSync(join(OPS_ROOT, rel), 'utf8'));
      } catch {
        continue; // not guaranteed in every checkout, same as the gate
      }
      const cited = new Set([...text.matchAll(/제(\d{1,2})장/g)].map((m) => Number(m[1])));
      if (cited.size < 5) continue;
      expect(cited.has(LAST), `${rel} enumerates chapters but never reaches 제${LAST}장`).toBe(true);
    }
  });

  it('no summary claims a Gemini integration that 제4장 destroyed', () => {
    for (const rel of SUMMARY_FILES) {
      let text: string;
      try {
        text = normalize(readFileSync(join(OPS_ROOT, rel), 'utf8'));
      } catch {
        continue;
      }
      // Naming Gemini in order to EXCLUDE it is the doctrine itself and must
      // survive; describing it as something this repo uses must not.
      expect(text, `${rel} still describes Gemini as an active reviewer`).not.toMatch(
        /Gemini is used for|Claude Code and Gemini|Gemini CLI when available/,
      );
    }
  });

  it('carriesDoctrine() skips a claude-mem stub and gates a real summary', () => {
    expect(carriesDoctrine('<claude-mem-context>\n# claude-mem\n</claude-mem-context>')).toBe(false);
    expect(carriesDoctrine('no doctrine here, just notes')).toBe(false);
    expect(carriesDoctrine(readFileSync(join(OPS_ROOT, '.github', 'copilot-instructions.md'), 'utf8'))).toBe(true);
  });

  it('missingChapterMentions() reports the gap when a chapter map is truncated', () => {
    const fifteen = EXPECTED_CHAPTERS.slice(0, 15).map((c) => `제${c.n}장`).join(' ');
    expect(missingChapterMentions(fifteen)).toEqual([16]);
    const all = EXPECTED_CHAPTERS.map((c) => `제${c.n}장`).join(' ');
    expect(missingChapterMentions(all)).toEqual([]);
  });

  /**
   * MISSION 1 (founder directive 2026-09-18) — the role pipeline.
   *
   * scripts/agent-review.ps1 reads each stage's criteria out of its charter
   * file and duplicates none of them. That single-source design has one failure
   * mode: a stage whose charter is missing or renamed has no criteria at all,
   * and the driver only discovers it at run time, mid-release. These assert it
   * at test time instead.
   */
  it('every stage of the role pipeline has a charter on disk', () => {
    for (const name of PIPELINE_CHARTERS) {
      expect(
        AGENT_CHARTERS.includes(join('.github', 'agents', name)),
        name + ' is a pipeline stage but has no charter in .github/agents/',
      ).toBe(true);
    }
  });

  it('every charter on disk still carries doctrine, so the drift gate keeps watching it', () => {
    // The charters are gated CONDITIONALLY (content-based, like the git-root
    // copilot file). Stripping the chapter map out of a real charter would
    // therefore drop it out of the gate silently -- unless this fails first.
    //
    // This deliberately loops over the DISCOVERED charters, not the five
    // pipeline stages: a backstop that enumerates what it protects leaves
    // unitas-orchestrator.agent.md and every future role unprotected, which is
    // the same hardcoded-list failure the glob above exists to end.
    for (const rel of AGENT_CHARTERS) {
      const text = readFileSync(join(OPS_ROOT, rel), 'utf8');
      expect(carriesDoctrine(text), rel + ' no longer carries doctrine; the drift gate would skip it').toBe(true);
    }
  });

  it('every charter the review driver names actually exists', () => {
    const driver = readFileSync(join(OPS_ROOT, 'scripts', 'agent-review.ps1'), 'utf8');
    const named = [...driver.matchAll(/'(unitas-[a-z0-9-]+\.agent\.md)'/g)].map((m) => m[1]);
    expect(named.length, 'agent-review.ps1 names no charters at all').toBeGreaterThanOrEqual(
      PIPELINE_CHARTERS.length,
    );
    for (const name of named) {
      expect(
        AGENT_CHARTERS.includes(join('.github', 'agents', name)),
        'agent-review.ps1 drives ' + name + ', which is not in .github/agents/',
      ).toBe(true);
    }
  });
});
