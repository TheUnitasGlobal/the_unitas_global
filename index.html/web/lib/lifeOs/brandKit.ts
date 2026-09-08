// Brand Kit module (founder directive 2026-09-08): single source of truth
// for THE UNITAS GLOBAL's sovereign tone-of-voice and visual tokens, plus a
// pure, testable "voice injection" checker that flags legal-risk phrasing
// per the founder's standing substitution rules (auto-memory
// `legal-risk-language`: 주권->소버린, 제국->네트워크, "바로 입장"->"시작").
//
// Deliberately references the EXISTING tokens (tailwind.config.ts colors,
// the Cinzel/JetBrains Mono font pairing already wired in
// app/[locale]/layout.tsx, the single master logo at
// public/assets/svg/unitas-mark.svg per auto-memory `master-logo-asset`)
// rather than inventing a parallel palette -- "automated style/asset
// injection" means surfacing the one real brand system, not a second one.

export interface BrandColorToken {
  name: string;
  value: string;
  usage: string;
}

export const BRAND_COLOR_TOKENS: BrandColorToken[] = [
  { name: 'Void', value: '#030305', usage: '기본 배경 -- 심연/우주적 톤' },
  { name: 'Quantum', value: '#0f1016', usage: '패널·카드 표면' },
  { name: 'Accent (Gold)', value: '#d4af37', usage: '주력 강조색 -- 타이틀 글로우, CTA, 신뢰/격조 신호' },
  { name: 'Neon', value: '#00f3ff', usage: '실시간 데이터·기술 포인트 강조' },
];

export interface BrandTypographyToken {
  role: string;
  family: string;
  usage: string;
}

export const BRAND_TYPOGRAPHY: BrandTypographyToken[] = [
  { role: 'Heading', family: 'Cinzel (font-serif)', usage: '모듈 타이틀·헤드라인 -- 장엄하고 시대를 초월한 인상' },
  { role: 'Body / UI', family: 'JetBrains Mono (font-sans)', usage: '본문·라벨·수치 -- 정밀하고 기술적인 신뢰감' },
];

export interface BrandAsset {
  key: string;
  path: string;
  usage: string;
}

export const BRAND_ASSET_MANIFEST: BrandAsset[] = [
  { key: 'master-mark', path: 'assets/svg/unitas-mark.svg', usage: '단일 소스 마스터 로고 (금 프리즘 + 청록 홀로그램 지구본 + 번개 삼각형, "T.L.S")' },
];

export interface VoiceRule {
  key: string;
  pattern: RegExp;
  replacement: string;
  reason: string;
}

/**
 * Founder-approved substitution rules. Kept intentionally small and
 * literal -- these mirror decisions already made for the public site copy,
 * not speculative new policy. Extend this table (never the checker logic
 * below) when the founder approves a new rule.
 */
export const VOICE_RULES: VoiceRule[] = [
  {
    key: 'sovereignty-word',
    pattern: /주권(?!적)/g,
    replacement: '소버린',
    reason: '"주권"은 국가주권을 연상시켜 법적 리스크가 있음 -- 브랜드 고유어 "소버린"으로 순화 (형용사형 "주권적"은 헌법 용어라 제외)',
  },
  {
    key: 'empire-word',
    pattern: /제국/g,
    replacement: '네트워크',
    reason: '"제국"은 과장된 지배 이미지를 준다 -- "네트워크"로 순화',
  },
  {
    key: 'instant-entry',
    pattern: /바로\s*입장/g,
    replacement: '시작',
    reason: '"바로 입장"은 즉시성을 과장한다 -- "시작"으로 순화',
  },
];

export interface VoiceFinding {
  ruleKey: string;
  match: string;
  index: number;
  suggestion: string;
  reason: string;
}

/** Pure, unit-tested (see __tests__/lifeOs/brandKit.test.ts) -- no DOM, no I/O. */
export function checkBrandVoice(text: string): VoiceFinding[] {
  const findings: VoiceFinding[] = [];
  for (const rule of VOICE_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      findings.push({
        ruleKey: rule.key,
        match: match[0],
        index: match.index,
        suggestion: rule.replacement,
        reason: rule.reason,
      });
      if (match[0].length === 0) re.lastIndex += 1;
    }
  }
  return findings.sort((a, b) => a.index - b.index);
}

/** Applies every rule once, in order -- used for a "미리보기: 순화된 문장" preview. */
export function applyBrandVoice(text: string): string {
  return VOICE_RULES.reduce((out, rule) => out.replace(rule.pattern, rule.replacement), text);
}
