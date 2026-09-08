import { describe, expect, it } from 'vitest';
import { applyBrandVoice, checkBrandVoice } from '../../lib/lifeOs/brandKit';

// Module-level test isolation (CLAUDE.md) -- pure functions only, no
// Supabase, no other module's fixtures.
describe('checkBrandVoice', () => {
  it('flags "주권" but not the adjective form "주권적"', () => {
    const findings = checkBrandVoice('우리의 주권 SaaS는 주권적 철학을 따른다.');
    expect(findings).toHaveLength(1);
    expect(findings[0].match).toBe('주권');
    expect(findings[0].suggestion).toBe('소버린');
  });

  it('flags "제국" and "바로 입장"', () => {
    const findings = checkBrandVoice('이 제국에 바로 입장 하십시오.');
    const matches = findings.map((f) => f.match);
    expect(matches).toContain('제국');
    expect(matches).toContain('바로 입장');
  });

  it('returns no findings for already-sovereign-toned copy', () => {
    expect(checkBrandVoice('소버린 네트워크에 시작합니다.')).toHaveLength(0);
  });
});

describe('applyBrandVoice', () => {
  it('substitutes every rule in one pass', () => {
    expect(applyBrandVoice('주권 제국에 바로 입장')).toBe('소버린 네트워크에 시작');
  });
});
