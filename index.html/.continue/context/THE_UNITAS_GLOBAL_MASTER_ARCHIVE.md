# Workspace Context: THE UNITAS GLOBAL

Always consult the repository root `THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md` for the operational baseline. The root archive distinguishes user-supplied enterprise claims from repository-verified implementation contracts.

## 최상위 운영 헌법 (요약 — 정본은 CLAUDE.md / THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md)

- 창립자: 황두영 (Dooyeong Hwang). 법인: 에스토니아 THE UNITAS GLOBAL OÜ.
- 사명: 무자본/소자본 · 블루오션 · 1인 절대 수행 · AI 완전 자동화의 탈중앙화 소버린 SaaS 생태계.
- 28대 '초' 독트린: 초논리적·초독창적·초혁신적·초미래지향적·초새로운·초철학적·초지능적·초신비적·초설계적·초전문적·초AI적·초미래적·초실용적·초능력적·초공상과학적·초시뮬레이션적·초어드밴져적·초예술적·초시대적·초과학적·초보안적·초경제적·초무결성적·초개선적·초예방적·초법적·초창립자적·초전설적.
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
