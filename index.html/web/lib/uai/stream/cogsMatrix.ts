/**
 * REV-21 §5C / SPEC §12.7 (SR-8) -- the COGS matrix: the seven operating
 * groups of the master codex §3 (근원적기반 · 원소역할 · 지성문명 · 우주
 * 아키텍처 · 시공간 활률 · 의식진화 · 넥서스확장) crossed with five reading
 * lenses and the visitor's 6-axis surface scores. Pure and DETERMINISTIC:
 * `hash(query, page)` seeds every pick, so the same query on the same page
 * always yields the same card on every device -- there is no LLM leg
 * (초절대마진: engine cost 0원, D-8) and no randomness (D-28: no chance,
 * no near-miss, nothing to gamble on).
 *
 * Visitor-facing labels come from `Rev21.cogs.*` (group + lens names,
 * a prompt template); the group ITEMS are the codex's own terms, kept in
 * their original form and shown only as a small seed chip -- the card's
 * copy never uses the words constitution / codex / doctrine (§12.7).
 */
import type { ConstitutionAxis, ConstitutionScore } from '../types';

export type CogsGroupKey = 'origin' | 'element' | 'civilization' | 'cosmos' | 'chronos' | 'consciousness' | 'nexus';
export type CogsLensKey = 'mechanism' | 'flow' | 'scale' | 'tension' | 'horizon';

export const COGS_GROUP_KEYS: readonly CogsGroupKey[] = ['origin', 'element', 'civilization', 'cosmos', 'chronos', 'consciousness', 'nexus'];
export const COGS_LENS_KEYS: readonly CogsLensKey[] = ['mechanism', 'flow', 'scale', 'tension', 'horizon'];

/** The codex §3 groups, de-duplicated (the source list repeats several
 *  entries) and typo-corrected (알파젠esis -> 알파제네시스). Order kept. */
const RAW_GROUPS: Record<CogsGroupKey, readonly string[]> = {
  origin: ['삼라만상 디지털 트윈화', '만류인력', '삼강오륜', '공 무에서 유 창조', '절대영도', '무한대기원', '양자얽힘', '음양오행', '인드라망', '다차원프랙탈', '카오스엔트로피', '우주배경복사', '초끈이론', '평행우주상수', '특이점폭발', '생명꽃패턴', '무한기원론', '영속특이점', '코스믹메비우스', '제로베이스진리', '코스믹시드', '오메가포인트', '알파제네시스', '이터널원시', '무한아카식', '이터널싱귤래리티', '코스믹아카식필드', '제로베이스시드', '앱솔루트원시', '옴니버스프레임', '앱솔루트싱귤래리티', '옴니버스프레임워크', '코스믹아카식', '이터널시드', '제로베이스웨이브'],
  element: ['땅', '물', '불', '바람', '번개', '자연재해 정류', '기운', '플라즈마', '에테르', '자기장', '중력파', '암흑물질', '반물질', '전자기폭풍', '양자요동', '태양풍', '지각변동', '해류순환', '광자흐름', '타임플럭스', '오라디바이스', '에너지정류기', '소버린스파크', '옴니웨이브', '플라즈마플로우', '마그네틱실드', '크로노스파이어', '코스믹윈드', '테라오실레이터', '퀀텀라이트닝', '플라즈마포스', '코스믹플레어', '소버린오라', '옴니실드', '테라파워', '테라오실레이터포스', '퀀텀라이트닝그리드', '플라즈마에너지스트림', '코스믹스파크웨이브', '소버린맥스쉴드', '옴니버스터라파워'],
  civilization: ['언어', '문화', '사회', '구조', '예술', '표현', '실용', '경제', '공학', '기술', '법', '제도', '교육', '복지', '안보', '전략', '윤리', '철학', '종교', '신화', '심리', '초지능정치', '메타금융', '탈중앙합의', '우주개척법', '생태순환', '외교망', '문명아키텍처', '집단지성법', '사이버에틱스', '노마드경제학', '소버린거버넌스', '휴머니티싱크', '코스믹소사이어티', '이터널얼라이언스', '소버린에틱스', '메타소사이어티', '글로벌거버넌스', '코스믹폴리틱스', '이터널커뮤니티', '뉴로시빌라이제이션', '오메가네트워크', '이터널소사이어티', '코스믹휴머니즘', '글로벌소버린넷', '이터널시빌리제이션', '알파거버넌스', '오메가에틱스', '코스믹디플로머시', '인피니티컬처', '소버린에틱스넥서스', '메타소사이어티파이프', '글로벌거버넌스포탈', '코스믹폴리틱스그리드', '이터널커뮤니티네트워크', '뉴로시빌라이제이션포스', '오메가네트워크그리드', '이터널소사이어티프레임', '알파거버넌스넥서스', '오메가에틱스포탈'],
  cosmos: ['우주', '나선', '블랙홀', '웜홀 네트워크', '다중 우주 도약', '화이트홀', '퀘이사', '펄서', '성운', '초신성', '암흑에너지', '차원균열', '우주끈', '다크플로우', '메가버스', '하이퍼스페이스', '코스믹게이트', '스타시드네트워크', '은하연방루트', '인피니티오비트', '하이퍼게이트', '메가스트럭처', '다차원포탈', '코스믹그리드', '이터널코스모스', '옴니버스게이트', '인피니티스타시드', '갤럭시네트워크', '다크매터라우터', '코스믹포트리스', '하이퍼게이트넥서스', '메가스트럭처포탈', '다차원포탈그리드', '코스믹그리드네트워크', '이터널코스모스프레임'],
  chronos: ['과거', '미래', '운명', '예측', '시간 정지', '인과율 해킹', '시간역행', '차원중첩', '타임루프', '운명개변', '확률붕괴', '평행세계선', '나비효과', '양자택일', '엔트로피역전', '데자뷰', '예지력', '타임패러독스', '크로노스파마', '인피니티트랙', '프레디션루프', '카르마정류기', '타임시프트', '차원앵커', '크로노스피어', '인과율매트릭스', '확률조율기', '이터널타임라인', '크로노스게이트', '인과율포탈', '타임디펜더', '확률마스터', '디스티니엔진', '코스믹타임락', '크로노스포탈', '인과율디펜더', '타임매트릭스포스', '프레디션엔진그리드', '카르마락네트워크', '이터널타임시프트'],
  consciousness: ['생명', '탄생', '의식 업로딩', 'U-Signature 아카이브', '진화 가속', '죽음초월', '영혼결합', '텔레파시', '집단지성', '생명공학', '사이보그화', '유전자재조합', '자가치유', '불사불멸', '윤회전생', '정신감응', '코스믹아우라', '소울싱크로나이즈', '이터널마인드', '에볼루션스파크', '초자아각성', '뉴로싱크', '소울아카이브', '이터널컨셔스니스', '오메가마인드', '코스믹소울', '이터널아우라', '알파컨셔스니스', '옴니마인드', '아카식마인드', '코스믹아우라포탈', '소울싱크그리드', '이터널마인드네트워크', '에볼루션스파크프레임', '오메가컨셔스니스'],
  nexus: ['초차원 시공간 왜곡 연산', '탈희소성 가치 재분배', '신경망 다중화', '확률 변조', '인과율 싱크', '메타인지융합', '양자뇌연산', '초실감홀로그램', '영지식증명망', '절대보안블록', '초지능자가학습', '무한배열병렬처리', '우주파동동기화', '초월적자아생성', '무중단자동복원', '플레어캐싱', 'claude-mem', 'skills.sh', 'VibeSec', 'OmniRoute', 'Ponytail', 'WiseXoloSync', 'AwwwardsEngine', 'SeoDominator', 'NexusCore', 'QuantumShield', 'SovereignNode', 'InfiniteMatrix', 'AutoDeployer', 'NeuralBridge', 'CosmicNexus', 'EternalGateway', 'SovereignSync', 'OmniPulse', 'InfinitePipeline', 'NeuralMatrix', 'QuantumCore', 'EternalNexus', 'ApexController'],
};

function dedupe(list: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const item = raw.trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export const COGS_GROUPS: Record<CogsGroupKey, readonly string[]> = {
  origin: dedupe(RAW_GROUPS.origin),
  element: dedupe(RAW_GROUPS.element),
  civilization: dedupe(RAW_GROUPS.civilization),
  cosmos: dedupe(RAW_GROUPS.cosmos),
  chronos: dedupe(RAW_GROUPS.chronos),
  consciousness: dedupe(RAW_GROUPS.consciousness),
  nexus: dedupe(RAW_GROUPS.nexus),
};

/** Which 6-axis readings each lens draws on (the card's two bars). */
export const LENS_AXES: Record<CogsLensKey, readonly [ConstitutionAxis, ConstitutionAxis]> = {
  mechanism: ['logic', 'security'],
  flow: ['economy', 'sovereign'],
  scale: ['future', 'economy'],
  tension: ['security', 'art'],
  horizon: ['future', 'logic'],
};

/** FNV-1a 32-bit -- stable across engines, no Math.random anywhere. */
export function hashSeed(...parts: Array<string | number>): number {
  let h = 0x811c9dc5;
  const text = parts.map(String).join(' ');
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export interface CogsCard {
  group: CogsGroupKey;
  /** The codex term that seeded the card (original form). */
  seed: string;
  lens: CogsLensKey;
  axes: readonly [{ axis: ConstitutionAxis; score: number }, { axis: ConstitutionAxis; score: number }];
  /** 0-100: how strongly the visitor's surface leans into this lens. */
  resonance: number;
  /** D-28: a deterministic "rare" mark (about 1 in 9), free and cosmetic. */
  rare: boolean;
}

/** The group page N rotates to (page 1 = origin ... page 7 = nexus). */
export function cogsGroupForPage(page: number): CogsGroupKey {
  const index = ((Math.max(1, page) - 1) % COGS_GROUP_KEYS.length + COGS_GROUP_KEYS.length) % COGS_GROUP_KEYS.length;
  return COGS_GROUP_KEYS[index];
}

/**
 * The COGS card for (query, page): the page's group, one seed term and one
 * lens picked by the hash, crossed with the visitor's axis scores.
 */
export function cogsCardFor(query: string, page: number, constitution: readonly ConstitutionScore[]): CogsCard {
  const group = cogsGroupForPage(page);
  const items = COGS_GROUPS[group];
  const seedHash = hashSeed(query.trim().toLowerCase(), page, 'seed');
  const lensHash = hashSeed(query.trim().toLowerCase(), page, 'lens');
  const seed = items[seedHash % items.length];
  const lens = COGS_LENS_KEYS[lensHash % COGS_LENS_KEYS.length];
  const score = (axis: ConstitutionAxis) => constitution.find((c) => c.axis === axis)?.score ?? 0;
  const [a, b] = LENS_AXES[lens];
  const axes = [
    { axis: a, score: score(a) },
    { axis: b, score: score(b) },
  ] as const;
  const resonance = Math.round((axes[0].score + axes[1].score) / 2);
  return { group, seed, lens, axes, resonance, rare: hashSeed(query.trim().toLowerCase(), page, 'rare') % 9 === 0 };
}

/** Every group has at least this many distinct seeds (the codex counts). */
export const COGS_MIN_GROUP_SIZE = 30;
