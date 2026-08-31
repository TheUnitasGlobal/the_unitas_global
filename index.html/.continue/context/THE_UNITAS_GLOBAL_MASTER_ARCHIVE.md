# Workspace Context: THE UNITAS GLOBAL

Always consult the repository root `THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md` for the operational baseline. The root archive distinguishes user-supplied enterprise claims from repository-verified implementation contracts.

## 최상위 운영 헌법 (요약 — 정본은 CLAUDE.md / THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md)

- 창립자: 황두영 (Dooyeong Hwang). 법인: 에스토니아 THE UNITAS GLOBAL OÜ.
- 사명: 무자본/소자본 · 블루오션 · 1인 절대 수행 · AI 완전 자동화의 탈중앙화 소버린 SaaS 생태계.
- 71대 '초' 헌법 코덱스 (2026-08-30 28대 → 51대 → 71대 확장, 6축[법/리스크·보안/해커/사이버·경제/결제/주식/비트코인·미래/과학/우주/삼라만상·소버린/탈중앙·예술/철학] 태도 어휘 승격): 초논리적·초독창적·초혁신적·초미래지향적·초새로운·초철학적·초지능적·초신비적·초설계적·초전문적·초AI적·초미래적·초실용적·초능력적·초공상과학적·초시뮬레이션적·초어드밴져적·초예술적·초시대적·초과학적·초보안적·초경제적·초무결성적·초개선적·초예방적·초법적·초창립자적·초전설적·초자동적·초자율적·초소버린적·초탈중앙적·초확장적·초효율적·초절약적·초회복적·초검증적·초정밀적·초투명적·초윤리적·초신뢰적·초적응적·초생성적·초통찰적·초양자적·초우주적·초영속적·초민첩적·초통합적·초궁극적·초불멸적·초리스크방어적·초장단점분석적·초미래성장적·초해커방어적·초사이버방어적·초결제통제적·초주식예측적·초비트코인분석적·초미래예측적·초삼라만상적·초포렌식적·초규제준수적·초암호화폐적·초온체인적·초지정학적·초시나리오분석적·초확률론적·초헤지전략적·초회복탄력적·초감사추적적.
- 제로 타협(Zero Feature Compromise) · 로우메모리 아머 · 페일클로즈드 게이트(typecheck+build, 300초, 실패 시 배포 중단).
- 창립자 전용 순차 검증 풀코스(게이트→30초 시네마→Coming Soon→메인) 보장. 일반 유저는 Coming Soon fail-closed 봉인.
- 대화 통제 독트린: 요청 전 셸 명령어 임의 제시 금지. 출력은 100% 한국어(코드/명령어/경로/고유명사 예외).

Core invariants:

- `config/modules.json` owns the revenue module catalog.
- Checkout sends only an allowed module name to `create-checkout-session`.
- Never expose Stripe secrets or Price IDs to browser code.
- Preserve the 40-language selector and global LTR UI baseline.
- Run focused tests first, then `npm test` before completion.
- Treat U-Pay and Gaia-Tax as named protocols/modules unless a verified implementation is added to the catalog and server contract.
