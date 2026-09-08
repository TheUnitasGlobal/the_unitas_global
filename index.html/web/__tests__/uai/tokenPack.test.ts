import { describe, expect, it } from 'vitest';
import { estimateTokenSavings, estimateTokens, packRecordsForPrompt } from '@/lib/uai/tokenPack';

describe('tokenPack', () => {
  it('packs a uniform record array into a header + row CSV block', () => {
    const packed = packRecordsForPrompt([
      { code: 'a', level: 'ok', message: 'first' },
      { code: 'b', level: 'warn', message: 'second' },
    ]);
    expect(packed).toBe('code,level,message\na,ok,first\nb,warn,second');
  });

  it('returns an empty string for an empty array', () => {
    expect(packRecordsForPrompt([])).toBe('');
  });

  it('quotes fields containing commas, quotes, or newlines', () => {
    const packed = packRecordsForPrompt([{ message: 'has, a comma' }, { message: 'has a "quote"' }]);
    expect(packed).toBe('message\n"has, a comma"\n"has a ""quote"""');
  });

  it('JSON-stringifies nested values inline rather than expanding columns', () => {
    const packed = packRecordsForPrompt([{ tags: ['a', 'b'] }]);
    expect(packed).toBe('tags\n"[""a"",""b""]"');
  });

  it('estimates fewer tokens than raw JSON for a uniform array', () => {
    const records = Array.from({ length: 10 }, (_, i) => ({ code: `c${i}`, level: 'ok', message: `finding number ${i}` }));
    const savings = estimateTokenSavings(records);
    expect(savings.packedTokens).toBeLessThan(savings.jsonTokens);
    expect(savings.savedPercent).toBeGreaterThan(0);
  });

  it('estimateTokens scales with string length', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('a'.repeat(40))).toBe(10);
  });
});
