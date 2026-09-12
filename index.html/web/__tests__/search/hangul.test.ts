import { describe, expect, it } from 'vitest';
import { decomposeHangul, hasHangul, isChoseongJamo, progressiveMatch, splitHighlight } from '@/lib/hangul';

describe('hangul progressive matcher', () => {
  it('decomposes a syllable into 초성/중성/종성 indexes', () => {
    expect(decomposeHangul('사')).toEqual({ cho: 9, jung: 0, jong: 0 });
    expect(decomposeHangul('살')).toEqual({ cho: 9, jung: 0, jong: 8 });
    expect(decomposeHangul('a')).toBeNull();
    expect(isChoseongJamo('ㅅ')).toBe(true);
    expect(isChoseongJamo('ㅏ')).toBe(false);
    expect(hasHangul('U-AI 사랑')).toBe(true);
    expect(hasHangul('unitas')).toBe(false);
  });

  it("keeps matching '사랑' through every IME shape of the keystroke sequence", () => {
    for (const step of ['ㅅ', '사', '살', '사라', '사랑']) {
      expect(progressiveMatch(step, '사랑'), step).not.toBeNull();
    }
    expect(progressiveMatch('사랑', '사랑')).toEqual({ start: 0, end: 2 });
  });

  it("treats a closed last syllable as the next syllable's 초성 in flight", () => {
    // '살' on the way to '사라' -> two target syllables consumed.
    expect(progressiveMatch('살', '사라')).toEqual({ start: 0, end: 2 });
    // ...but a genuinely closed target still matches exactly.
    expect(progressiveMatch('살', '살림')).toEqual({ start: 0, end: 1 });
    // A closed syllable that is NOT last must be exact.
    expect(progressiveMatch('살랑', '사라')).toBeNull();
  });

  it('splits compound finals across the syllable boundary', () => {
    // '닭' typed while heading for '달기' (ㄹ stays, ㄱ moves on).
    expect(progressiveMatch('닭', '달기')).toEqual({ start: 0, end: 2 });
    expect(progressiveMatch('닭', '닭고기')).toEqual({ start: 0, end: 1 });
  });

  it('matches anywhere inside the target and reports the range', () => {
    // An open last syllable matches any 종성, so '산' (index 2) is the first hit.
    expect(progressiveMatch('사', '부동산 사기')).toEqual({ start: 2, end: 3 });
    expect(progressiveMatch('사기', '부동산 사기')).toEqual({ start: 4, end: 6 });
    expect(splitHighlight('법', '헌법 개정')).toEqual(['헌', '법', ' 개정']);
  });

  // REV-21 §5.2: ranking candidates must match at a word start, so a single
  // syllable cannot surface an entry because it sits inside another word.
  it("'word' mode only matches at offset 0 or after a word boundary", () => {
    expect(progressiveMatch('사', '부동산 사기', { mode: 'word' })).toEqual({ start: 4, end: 5 });
    expect(progressiveMatch('사', '매칭 (사람)', { mode: 'word' })).toEqual({ start: 4, end: 5 });
    // '서사' (narrative) contains '사' mid-word -- not a word-mode hit.
    expect(progressiveMatch('사', '영화 서사', { mode: 'word' })).toBeNull();
    // '살아' inside '함께 살아가는' is fine only because it starts a word.
    expect(progressiveMatch('사', '함께 살아가는', { mode: 'word' })).toEqual({ start: 3, end: 4 });
    expect(progressiveMatch('ㅅ', '스포츠', { mode: 'word' })).toEqual({ start: 0, end: 1 });
    expect(progressiveMatch('rent', 'Real-time Rental Market', { mode: 'word' })).toEqual({ start: 10, end: 14 });
    expect(progressiveMatch('ime', 'Real-time Rental Market', { mode: 'word' })).toBeNull();
  });

  it("'prefix' mode only matches at offset 0", () => {
    expect(progressiveMatch('사', '사회', { mode: 'prefix' })).toEqual({ start: 0, end: 1 });
    expect(progressiveMatch('사', '부동산 사기', { mode: 'prefix' })).toBeNull();
    expect(progressiveMatch('uni', 'UNITAS', { mode: 'prefix' })).toEqual({ start: 0, end: 3 });
    expect(progressiveMatch('uni', 'The UNITAS', { mode: 'prefix' })).toBeNull();
  });

  it('falls back to case-insensitive substring for non-Hangul text', () => {
    expect(progressiveMatch('uni', 'The UNITAS Global')).toEqual({ start: 4, end: 7 });
    expect(progressiveMatch('xyz', 'The UNITAS Global')).toBeNull();
    expect(progressiveMatch('', 'anything')).toBeNull();
  });

  it('never matches a syllable with a different 중성 or 초성', () => {
    expect(progressiveMatch('서', '사랑')).toBeNull();
    expect(progressiveMatch('ㅈ', '사랑')).toBeNull();
  });
});
