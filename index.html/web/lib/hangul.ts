/**
 * IME-aware Hangul progressive matcher -- the maths behind the "글자 조합별
 * 실시간 검색" (owner instruction 2026-09-03): as a Korean keystroke sequence
 * composes ('ㅅ' -> '사' -> '살' -> '사라' -> '사랑'), every intermediate
 * shape must keep matching the words it is on its way to, so the live result
 * list narrows instead of blinking empty between syllables.
 *
 * Pure string maths -- no React, no locale data -- so it is shared by the
 * search bar's live index and unit tests alike. Non-Hangul text falls back to
 * a case-insensitive substring match, so the same call serves every locale.
 */

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JUNG_COUNT = 21;
const JONG_COUNT = 28;

/** Compatibility jamo (what an IME shows for a lone consonant) -> 초성 index. */
const CHOSEONG_INDEX: Record<string, number> = {
  ㄱ: 0, ㄲ: 1, ㄴ: 2, ㄷ: 3, ㄸ: 4, ㄹ: 5, ㅁ: 6, ㅂ: 7, ㅃ: 8, ㅅ: 9,
  ㅆ: 10, ㅇ: 11, ㅈ: 12, ㅉ: 13, ㅊ: 14, ㅋ: 15, ㅌ: 16, ㅍ: 17, ㅎ: 18,
};

/** 종성 index -> the 초성 index the same consonant has when it starts the
 *  next syllable (0 = no 종성; compound finals map to their two halves). */
const JONG_TO_CHO: Array<number | [number, number] | null> = [
  null,      // 0  (none)
  0,         // 1  ㄱ
  1,         // 2  ㄲ
  [0, 9],    // 3  ㄳ
  2,         // 4  ㄴ
  [2, 12],   // 5  ㄵ
  [2, 18],   // 6  ㄶ
  3,         // 7  ㄷ
  5,         // 8  ㄹ
  [5, 0],    // 9  ㄺ
  [5, 6],    // 10 ㄻ
  [5, 7],    // 11 ㄼ
  [5, 9],    // 12 ㄽ
  [5, 16],   // 13 ㄾ
  [5, 17],   // 14 ㄿ
  [5, 18],   // 15 ㅀ
  6,         // 16 ㅁ
  7,         // 17 ㅂ
  [7, 9],    // 18 ㅄ
  9,         // 19 ㅅ
  10,        // 20 ㅆ
  11,        // 21 ㅇ
  12,        // 22 ㅈ
  14,        // 23 ㅊ
  15,        // 24 ㅋ
  16,        // 25 ㅌ
  17,        // 26 ㅍ
  18,        // 27 ㅎ
];

/** 초성 index -> the 종성 index of the same consonant (for "same final" checks). */
const CHO_TO_JONG: number[] = [1, 2, 4, 7, 0, 8, 16, 17, 0, 19, 20, 21, 22, 0, 23, 24, 25, 26, 27];

export interface Syllable {
  cho: number;
  jung: number;
  /** 0 = open syllable (no final consonant). */
  jong: number;
}

export function decomposeHangul(ch: string): Syllable | null {
  const code = ch.codePointAt(0);
  if (code === undefined || code < HANGUL_BASE || code > HANGUL_LAST) return null;
  const offset = code - HANGUL_BASE;
  return {
    cho: Math.floor(offset / (JUNG_COUNT * JONG_COUNT)),
    jung: Math.floor((offset % (JUNG_COUNT * JONG_COUNT)) / JONG_COUNT),
    jong: offset % JONG_COUNT,
  };
}

export function isChoseongJamo(ch: string): boolean {
  return Object.prototype.hasOwnProperty.call(CHOSEONG_INDEX, ch);
}

/** True when the string contains any Hangul syllable or compatibility jamo. */
export function hasHangul(s: string): boolean {
  return /[ㄱ-ㆎ가-힣]/.test(s);
}

export interface MatchRange {
  start: number;
  end: number;
}

/**
 * Does the (possibly mid-composition) `query` match `target` starting at
 * code-point offset `at`? Returns the matched length in code points, or -1.
 *
 * Per query character:
 *  - a lone 초성 ('ㅅ')                -> any syllable with that 초성
 *  - a full syllable that is NOT last -> exact syllable only
 *  - the LAST syllable, open ('사')    -> same 초성+중성, any 종성 ('사'/'삼'/'살')
 *  - the LAST syllable, closed ('살')  -> exact, OR an open syllable whose NEXT
 *                                        syllable starts with that 종성 ('사라')
 *                                        (compound finals split across two)
 *  - anything else                    -> case-insensitive equality
 */
function matchAt(query: string[], target: string[], at: number): number {
  let ti = at;
  for (let qi = 0; qi < query.length; qi += 1) {
    const q = query[qi];
    const t = target[ti];
    if (t === undefined) return -1;
    const isLast = qi === query.length - 1;

    const choIdx = CHOSEONG_INDEX[q];
    if (choIdx !== undefined) {
      const ts = decomposeHangul(t);
      if (t === q || (ts && ts.cho === choIdx)) {
        ti += 1;
        continue;
      }
      return -1;
    }

    const qs = decomposeHangul(q);
    if (!qs) {
      if (q.toLowerCase() !== t.toLowerCase()) return -1;
      ti += 1;
      continue;
    }

    if (q === t) {
      ti += 1;
      continue;
    }
    if (!isLast) return -1;

    const ts = decomposeHangul(t);
    if (!ts || ts.cho !== qs.cho || ts.jung !== qs.jung) return -1;

    if (qs.jong === 0) {
      // '사' typed, '삼'/'살'/'상' in the target: the 종성 is still to come.
      ti += 1;
      continue;
    }

    // '살' typed while heading for '사라': the query's 종성 is really the
    // next syllable's 초성 the IME hasn't been able to move yet.
    const split = JONG_TO_CHO[qs.jong];
    const next = target[ti + 1];
    const ns = next ? decomposeHangul(next) : null;
    if (typeof split === 'number') {
      if (ts.jong === 0 && ns && ns.cho === split) {
        ti += 2;
        continue;
      }
      return -1;
    }
    if (split) {
      const [first, second] = split;
      const firstAsJong = CHO_TO_JONG[first];
      if (ts.jong === firstAsJong && ns && ns.cho === second) {
        ti += 2;
        continue;
      }
      return -1;
    }
    return -1;
  }
  return ti - at;
}

/**
 * Find the first progressive match of `query` inside `target`. Returns the
 * matched code-point range (for highlighting) or null. An empty query never
 * matches -- the caller decides what an empty search bar shows.
 */
export function progressiveMatch(query: string, target: string): MatchRange | null {
  const q = Array.from(query.trim());
  if (q.length === 0) return null;
  const t = Array.from(target);
  for (let at = 0; at + q.length <= t.length + 1 && at < t.length; at += 1) {
    const len = matchAt(q, t, at);
    if (len > 0) return { start: at, end: at + len };
  }
  return null;
}

/**
 * Split `target` into [before, matched, after] code-point slices for a
 * highlight render. Returns null when there is no match.
 */
export function splitHighlight(query: string, target: string): [string, string, string] | null {
  const range = progressiveMatch(query, target);
  if (!range) return null;
  const chars = Array.from(target);
  return [
    chars.slice(0, range.start).join(''),
    chars.slice(range.start, range.end).join(''),
    chars.slice(range.end).join(''),
  ];
}
