// ---------------------------------------------------------------------------
// codex-structure-core.mjs -- pure structural parser + verifier for the
// Ultimate Sovereign Master Codex canon. Trust-registry id:
// unitas.codex-structure.core
//
// WHY THIS EXISTS (founder directive 2026-09-17, MISSION 3; FINAL_REPORT A-4).
// scripts/sync-codex.mjs has guarded the canon since v16.0, but only along two
// axes: the 4 verbatim copies must hash-match, and the 6 hand-written summary
// files must cite the current "vNN.N" STRING. Neither axis can see the SHAPE of
// the document. That blind spot is not hypothetical -- it is the通路 through
// which the v41.0 15-chapter -> 16-chapter restructuring passed with the drift
// gate green, and it is the ninth instance of the same class of failure
// (v17.0, v19.0, v20.0, v23.0, v26.0, v37.0, v41.0-15장, v41.0-16장).
//
// A version string is a label. The chapter count, the chapter numbering, the
// chapter titles, and the 1..1000 slot spine are the document. This module
// asserts the document.
//
// PURE BY CONSTRUCTION: no fs, no process, no clock, no network. It takes the
// canon text and returns findings, so the same logic runs in the prebuild gate
// (scripts/sync-codex.mjs) and in vitest (__tests__/doctrine/codexStructure.test.ts)
// without either re-implementing it. Two implementations of an integrity check
// is two things that can drift.
//
// MEASURED PARSING NOTES (2026-09-18, against C:/dev/unitas/CLAUDE.md):
//   * Chapter headings are "## 제N장. <title>" at column 0. 17 of them since
//     v49.0, which inserted 제12장 (U-Square / Impeccable Taste) and pushed the
//     old 제12~16장 down to 제13~17장. The canon also carries a UTF-8 BOM from
//     this edition on; normalize() strips it, so every parser here is unaffected.
//   * The slot list lives on continuation lines of the "- 구성 (1~1000선 전문):"
//     bullet, indented two spaces, comma separated, "N.<term>".
//   * Group headers look like "  [1~28 (오리지널 태도 - 28선)]" -- and the last
//     two carry trailing prose inside the parens ("- 100선 최상위 최종 확장"),
//     so the count regex must tolerate text after "N선".
//   * The FIRST slot of every group starts its line right after the two-space
//     indent, so a slot regex anchored only on a preceding comma silently
//     loses exactly 14 slots (one per group). This was observed and fixed;
//     the anchor below accepts line-start-plus-indent as well as a comma.
// ---------------------------------------------------------------------------

/** The canonical 17 chapters of v51.0 Absolute Infinite Paradigm Edition.
 *  Titles are matched EXACTLY, so a silent retitle is a gate failure, not a
 *  stylistic edit. When the founder ratifies a new edition, this table and the
 *  canon move together in the same commit -- that coupling is the point.
 *
 *  v41.0 -> v49.0 (founder commit 27f40b5, ratified 2026-09-18): 제12장
 *  「U-Square 하이퍼-테마 생태계 및 제로-프릭션 UI/UX」 was inserted, which shifted
 *  the old 제12~16장 down by one to 제13~17장. Citing any of those five by their
 *  v41.0 number is now wrong -- the same +1 hazard the v41.0 제6장 promotion
 *  created, recurring one edition later.
 *
 *  v49.0 -> v51.0 (ratified 2026-09-18, same day): NO chapter was inserted and
 *  NO number moved -- still 17. Exactly two chapters were retitled and widened:
 *  제9장 「1억 번의 시뮬레이션 및 크로스플랫폼 무결점 반응 독트린」 became
 *  「크로스플랫폼 무결점 반응 및 옴니-환경 동기화 독트린」, and 제12장
 *  「U-Square 하이퍼-테마 생태계 및 제로-프릭션 UI/UX」 became 「유니타스 옴니-
 *  크리에이션 및 초정밀 절대 미학(Impeccable Taste) 독트린」. Because the numbering
 *  is identical across the two editions, a stale citation is detectable ONLY by
 *  those two titles -- which is why they are matched exactly here.
 *
 *  제2장's title is the one place this table does NOT simply mirror the canon as
 *  the founder first wrote it, and it has now been refused twice. Both v49.0 and
 *  the v51.0 draft shipped it as "(순수 고유 1000선, 중복 0)"; slotStatistics()
 *  measures 815 distinct terms, 140 of them repeated across 325 slots, so that
 *  wording is refuted by this very module. Ratifying it here would make the gate
 *  assert something the program disproves, which is the exact failure this gate
 *  exists to catch (제14장 미측정 완료 보고 금지), so the canon keeps the provable
 *  claim -- slot numbers 1..1000 with zero gaps and zero duplicate NUMBERS -- and
 *  this table matches that. Terms repeat by design: the upper bands promote
 *  earlier entries by positional suffix extension.
 *  @type {ReadonlyArray<{ n: number, title: string }>} */
export const EXPECTED_CHAPTERS = Object.freeze([
  { n: 1, title: '기업 정체성 및 소버린 SaaS 철학' },
  { n: 2, title: '1000대 초-헌법 정본 마스터 리스트 (슬롯 1~1000 결번 0 · 슬롯 번호 중복 0 · 구조적 확장 등재 허용)' },
  { n: 3, title: '유니타스 연산 매트릭스 및 실무 제작 아키텍처' },
  { n: 4, title: '단일 절대 지배 에이전트 및 권한 한계 돌파 독트린' },
  { n: 5, title: '불멸 경제, 탈중앙 팩토리 정산 및 글로벌 소버린 통제' },
  { n: 6, title: '초제로핸즈(Zero-Hands) 자율 진화 및 대화형 통제' },
  { n: 7, title: '초수속적 옴니-테크 글로벌 SEO 및 다크 시네마틱 아키텍처' },
  { n: 8, title: '글로벌 옴니채널 무결성 및 절대 보안 방어' },
  { n: 9, title: '크로스플랫폼 무결점 반응 및 옴니-환경 동기화 독트린' },
  { n: 10, title: '초광역 인피니티 넥서스 자가 증식 및 싱귤래리티 독트린' },
  { n: 11, title: '소버린 기억 백업망 및 영구 보존 아키텍처' },
  { n: 12, title: '유니타스 옴니-크리에이션 및 초정밀 절대 미학(Impeccable Taste) 독트린' },
  { n: 13, title: '스마트 자율 압축 및 중간 결과물 영구 보존 독트린' },
  { n: 14, title: 'Fail-Closed 무결성 검증 및 초자동화 자율 승인 독트린' },
  { n: 15, title: '자율 진화형 영구 기억, 초정밀 예측(ETA) 및 무한 개선 독트린' },
  { n: 16, title: '초민첩 3단계 스마트 검증 및 샤드 캐싱 독트린' },
  { n: 17, title: '라이브 DB 절대 동기화 및 공식 오피셜 통제 독트린' },
]);

/** The constitution has exactly this many numbered slots. */
export const EXPECTED_SLOT_COUNT = 1000;

/** `## 제N장. title` */
const CHAPTER_RE = /^## 제(\d{1,3})장\. (.+?)\s*$/gm;

/** `  [801~1000 (label - 100선 최상위 최종 확장)]` -- trailing prose tolerated. */
const GROUP_RE = /^\s*\[(\d{1,4})~(\d{1,4}) \((.*?)-\s*(\d{1,4})선(?:[^\]]*)\)\]\s*$/gm;

/** `N.term`, anchored on line-start-plus-indent OR a preceding comma. */
const SLOT_RE = /(?:^\s*|,\s*)(\d{1,4})\.([^,\n]+?)(?=\s*,|\s*$)/gm;

/** CRLF -> LF, BOM stripped. Every parser here assumes normalized text.
 *  @param {string} raw @returns {string} */
export function normalize(raw) {
  let s = raw;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.replace(/\r\n/g, '\n');
}

/** @param {string} text @returns {Array<{ n: number, title: string }>} */
export function parseChapters(text) {
  return [...text.matchAll(CHAPTER_RE)].map((m) => ({ n: Number(m[1]), title: m[2] }));
}

/** @param {string} text
 *  @returns {Array<{ from: number, to: number, label: string, declared: number }>} */
export function parseSlotGroups(text) {
  return [...text.matchAll(GROUP_RE)].map((m) => ({
    from: Number(m[1]),
    to: Number(m[2]),
    label: m[3].trim(),
    declared: Number(m[4]),
  }));
}

/**
 * Slots, in document order. Only lines that belong to the slot list are
 * scanned (two-space indent starting with a digit or a `[` group header), so
 * ordinary prose containing "3.5" elsewhere in the codex can never be mistaken
 * for a slot.
 * @param {string} text
 * @returns {{ slots: Map<number, string>, duplicateNumbers: number[], outOfRange: number[] }}
 */
export function parseSlots(text) {
  /** @type {Map<number, string>} */
  const slots = new Map();
  /** @type {number[]} */
  const duplicateNumbers = [];
  /** @type {number[]} */
  const outOfRange = [];
  for (const line of text.split('\n')) {
    if (!/^\s{2}\d+\./.test(line)) continue;
    for (const m of line.matchAll(SLOT_RE)) {
      const n = Number(m[1]);
      const term = m[2].trim();
      if (!Number.isInteger(n) || n < 1 || n > EXPECTED_SLOT_COUNT) {
        outOfRange.push(n);
        continue;
      }
      if (slots.has(n)) duplicateNumbers.push(n);
      else slots.set(n, term);
    }
  }
  return { slots, duplicateNumbers, outOfRange };
}

/**
 * The measured shape of the constitution list.
 * @param {Map<number, string>} slots
 * @returns {{ total: number, missing: number[], distinctTerms: number, repeatedTerms: number, slotsWithRepeatedTerm: number }}
 */
export function slotStatistics(slots) {
  /** @type {number[]} */
  const missing = [];
  for (let i = 1; i <= EXPECTED_SLOT_COUNT; i += 1) if (!slots.has(i)) missing.push(i);
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const term of slots.values()) counts.set(term, (counts.get(term) ?? 0) + 1);
  let repeatedTerms = 0;
  let slotsWithRepeatedTerm = 0;
  for (const c of counts.values()) {
    if (c > 1) {
      repeatedTerms += 1;
      slotsWithRepeatedTerm += c;
    }
  }
  return { total: slots.size, missing, distinctTerms: counts.size, repeatedTerms, slotsWithRepeatedTerm };
}

/**
 * Full structural verdict for one canon text.
 * @param {string} rawText
 * @param {{ expectedChapters?: ReadonlyArray<{ n: number, title: string }> }} [options]
 * @returns {{ ok: boolean, failures: string[], chapters: Array<{ n: number, title: string }>, groups: Array<{ from: number, to: number, label: string, declared: number }>, stats: ReturnType<typeof slotStatistics> }}
 */
export function verifyStructure(rawText, options = {}) {
  const expected = options.expectedChapters ?? EXPECTED_CHAPTERS;
  const text = normalize(rawText);
  /** @type {string[]} */
  const failures = [];

  // --- chapters -----------------------------------------------------------
  const chapters = parseChapters(text);
  if (chapters.length !== expected.length) {
    failures.push(`chapter count is ${chapters.length}, expected ${expected.length}`);
  }
  for (let i = 0; i < Math.max(chapters.length, expected.length); i += 1) {
    const got = chapters[i];
    const want = expected[i];
    if (!got) {
      failures.push(`제${want.n}장 is missing`);
      continue;
    }
    if (!want) {
      failures.push(`제${got.n}장 is an extra chapter beyond the ratified table`);
      continue;
    }
    if (got.n !== want.n) failures.push(`chapter #${i + 1} is numbered 제${got.n}장, expected 제${want.n}장 (renumbering drift)`);
    if (got.title !== want.title) {
      failures.push(`제${want.n}장 title drifted\n      canon:    ${got.title}\n      ratified: ${want.title}`);
    }
  }

  // --- slot groups --------------------------------------------------------
  const groups = parseSlotGroups(text);
  if (groups.length === 0) failures.push('no slot group headers found (the "[1~28 (... - 28선)]" spine is gone)');
  const declaredSum = groups.reduce((a, g) => a + g.declared, 0);
  if (groups.length > 0 && declaredSum !== EXPECTED_SLOT_COUNT) {
    failures.push(`slot group headers declare ${declaredSum} slots in total, expected ${EXPECTED_SLOT_COUNT}`);
  }
  groups.forEach((g, i) => {
    const span = g.to - g.from + 1;
    if (span !== g.declared) failures.push(`group [${g.from}~${g.to}] spans ${span} slots but declares ${g.declared}선`);
    const prev = groups[i - 1];
    if (i === 0) {
      if (g.from !== 1) failures.push(`first slot group starts at ${g.from}, expected 1`);
    } else if (g.from !== prev.to + 1) {
      failures.push(`slot groups are not contiguous: [${prev.from}~${prev.to}] is followed by [${g.from}~${g.to}]`);
    }
  });
  if (groups.length > 0 && groups[groups.length - 1].to !== EXPECTED_SLOT_COUNT) {
    failures.push(`last slot group ends at ${groups[groups.length - 1].to}, expected ${EXPECTED_SLOT_COUNT}`);
  }

  // --- slots --------------------------------------------------------------
  const { slots, duplicateNumbers, outOfRange } = parseSlots(text);
  const stats = slotStatistics(slots);
  if (stats.total !== EXPECTED_SLOT_COUNT) {
    failures.push(`parsed ${stats.total} slots, expected ${EXPECTED_SLOT_COUNT}`);
  }
  if (stats.missing.length > 0) {
    failures.push(`${stats.missing.length} slot number(s) absent: ${stats.missing.slice(0, 20).join(', ')}${stats.missing.length > 20 ? ' …' : ''}`);
  }
  if (duplicateNumbers.length > 0) {
    failures.push(`slot number(s) registered twice: ${[...new Set(duplicateNumbers)].join(', ')}`);
  }
  if (outOfRange.length > 0) {
    failures.push(`slot number(s) outside 1..${EXPECTED_SLOT_COUNT}: ${[...new Set(outOfRange)].join(', ')}`);
  }
  // Per-group actual counts must match the declared counts too -- a group can
  // be internally contiguous and still be short if a slot was deleted.
  for (const g of groups) {
    let actual = 0;
    for (let i = g.from; i <= g.to; i += 1) if (slots.has(i)) actual += 1;
    if (actual !== g.declared) failures.push(`group [${g.from}~${g.to}] declares ${g.declared}선 but ${actual} slot(s) are present`);
  }

  return { ok: failures.length === 0, failures, chapters, groups, stats };
}

/**
 * A summary file does not carry the verbatim canon, so it cannot be hashed --
 * but if it transcribes the chapter structure in its own prose, every chapter
 * must appear in it. Returns the chapter numbers it fails to name.
 * @param {string} rawText
 * @param {ReadonlyArray<{ n: number, title: string }>} [expected]
 * @returns {number[]}
 */
export function missingChapterMentions(rawText, expected = EXPECTED_CHAPTERS) {
  const text = normalize(rawText);
  return expected.filter((c) => !text.includes(`제${c.n}장`)).map((c) => c.n);
}

/**
 * True when a file is a doctrine-bearing summary rather than a generated stub.
 *
 * The git-root `.github/copilot-instructions.md` is NOT the operational
 * doctrine summary of the same name -- it is rewritten by the claude-mem
 * plugin and normally holds a `<claude-mem-context>` block. Hash-gating or
 * chapter-gating a file a plugin owns would turn every plugin write into a red
 * build. So the rule is content-based, not path-based: a file is gated when it
 * actually cites the codex, and skipped when it does not.
 * @param {string} rawText
 * @returns {boolean}
 */
export function carriesDoctrine(rawText) {
  const text = normalize(rawText);
  if (text.includes('<claude-mem-context>')) return false;
  return /Ultimate Sovereign Master Codex|제\d{1,2}장|1000대/.test(text);
}
