import { describe, expect, it } from 'vitest';
import { buildMarketingAssetPrompt, parseMarketingAssetResponse } from '../../lib/lifeOs/marketingAssets';

// Module-level test isolation (CLAUDE.md) -- pure functions only, no
// network. generateMarketingAssets (the fetch-calling entry point) is
// intentionally untested here, same convention as lib/uai/rankingDetail.ts.
describe('parseMarketingAssetResponse', () => {
  it('parses a well-formed JSON object', () => {
    const raw = JSON.stringify({
      headline: '헤드라인',
      body: '본문 문장입니다.',
      cta: '시작하기',
      socialCaption: '캡션입니다',
      hashtags: ['#Sovereign', ' AI '],
      visualBrief: '금색 강조의 어두운 배경',
    });
    const parsed = parseMarketingAssetResponse(raw);
    expect(parsed.headline).toBe('헤드라인');
    expect(parsed.hashtags).toEqual(['sovereign', 'ai']);
  });

  it('tolerates stray prose/markdown fences around the JSON payload', () => {
    const raw = '```json\n' + JSON.stringify({ headline: 'H', body: 'B', cta: 'C', socialCaption: 'S', hashtags: [], visualBrief: 'V' }) + '\n```';
    const parsed = parseMarketingAssetResponse(raw);
    expect(parsed.headline).toBe('H');
  });

  it('throws when no JSON object is present', () => {
    expect(() => parseMarketingAssetResponse('no json here')).toThrow();
  });

  it('caps hashtags at 5 and lowercases them', () => {
    const raw = JSON.stringify({
      headline: 'H',
      body: 'B',
      cta: 'C',
      socialCaption: 'S',
      hashtags: ['A', 'B', 'C', 'D', 'E', 'F'],
      visualBrief: 'V',
    });
    expect(parseMarketingAssetResponse(raw).hashtags).toHaveLength(5);
  });
});

describe('buildMarketingAssetPrompt', () => {
  it('embeds the brief and the founder-approved voice constraints', () => {
    const { system, user } = buildMarketingAssetPrompt('신규 모듈 출시', 'ko');
    expect(user).toContain('신규 모듈 출시');
    expect(system).toContain('제국');
    expect(system).toContain('locale "ko"');
  });

  it('truncates an overlong brief', () => {
    const { user } = buildMarketingAssetPrompt('가'.repeat(1000), 'ko');
    expect(user.length).toBeLessThan(600);
  });
});
