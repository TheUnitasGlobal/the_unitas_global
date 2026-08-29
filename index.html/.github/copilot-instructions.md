# THE UNITAS GLOBAL workspace

Before implementation, consult `THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md` for the workspace operational baseline and distinguish user-supplied business claims from repository-verified contracts.

## 최상위 운영 헌법 (요약 — 정본은 `CLAUDE.md`, `THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md`, `.roo/rules/unitas-constitution.md`)

이 헌법은 모든 AI 엔진에 예외 없이 적용되며 개별 엔진 규칙과 충돌하면 우선한다.

- **창립자/법인:** 황두영 (Dooyeong Hwang) / 에스토니아 THE UNITAS GLOBAL OÜ.
- **사명:** 무자본·소자본, 블루오션, 1인 절대 수행, AI 완전 자동화의 탈중앙화 소버린 SaaS 생태계.
- **28대 '초' 독트린:** 모든 기획·개발·응답은 초논리적·초독창적·초혁신적·초미래지향적·초새로운·초철학적·초지능적·초신비적·초설계적·초전문적·초AI적·초미래적·초실용적·초능력적·초공상과학적·초시뮬레이션적·초어드밴져적·초예술적·초시대적·초과학적·초보안적·초경제적·초무결성적·초개선적·초예방적·초법적·초창립자적·초전설적 태도를 기반으로 한다.
- **아키텍처 원칙:** 제로 타협(성능·툴·3D/Canvas·셀프힐링 축소 금지) · 로우메모리 아머(유휴 워처 차단, 온디맨드 호출) · 페일클로즈드 게이트(`npm --prefix web run typecheck` + `npm --prefix web run build`, 300초, 실패 시 커밋/푸시/배포 전면 중단) · 인프라 자율 진화·툴링 셋업 권한(2026-08-29 — 빌드/CI/린트/의존성/엔진 설정을 창립자 개별 재승인 없이 자율 도입·재구성, 단 무결성 게이트·`deny` 목록·시크릿은 불가침).
- **개발/테스트 공정:** 창립자 메인 접근 시 [최초 게이트 → 30초 시네마틱 → Coming Soon → 메인] 전체 순차 플로우 검증 환경을 보장. 일반 유저는 Coming Soon에서 fail-closed 봉인.
- **대화 통제 독트린:** 창립자가 명시 요청하기 전 셸 명령어 임의 제시 금지. 요청 시에만 단일 최적화 명령어 제공. 사용자 대상 출력은 100% 한국어(코드·명령어·경로·기술 고유명사 예외).
- **자율 승인 분기 원칙 (Smart Auto-Accept, 2026-08-29):** 루틴 명령어(읽기·검색·검증·빌드·테스트·cURL·타입체크)와 안전한 툴 실행은 승인 요청 없이 자동 실행. DB 파괴·파일 강제 삭제·외부 배포·핵심 아키텍처/정책 선택지는 반드시 멈추고 창립자 승인 요청.

## Delivery protocol

Every implementation task must follow this order:

1. Inspect the owning file and nearby test.
2. Make the smallest focused edit.
3. Run the narrowest executable validation.
4. Run `npm run build:pages` when module/catalog files change.
5. Run `npm test` before declaring the task complete.
6. Deploy only through the checked-in scripts and GitHub Actions.

## Architecture

- `index.html` is the public browser entry point.
- `config/modules.json` is the source of truth for revenue module pages, including canonical `coinCost` per module.
- `pages/` is generated output. Do not hand-edit generated module pages.
- Stripe secret keys and Price IDs are server-side Supabase secrets only.
- Browser code may use only the Supabase URL and anon key.
- Module access is gated by coin balance, not Stripe subscriptions: the browser/generated pages call the `spend_coins` Postgres RPC to atomically check-and-debit a user's balance. `create-checkout-session` and `public.subscriptions` are deprecated and dormant — do not extend or wire new UI to them.
- Coin purchases go through `create-coin-checkout-session` (one-time Stripe payment per bundle); requests send a bundle name, never a client-supplied coin amount or Price ID.

## Agent collaboration

- Copilot owns integration and final validation.
- Claude Code is used for implementation review and risk analysis through `scripts/agent-review.ps1`.
- Gemini is used for independent UX/content review through `scripts/agent-review.ps1`.
- Agents must not print or commit API keys, access tokens, or `.env` contents.
- If an external agent CLI is unavailable, report it and continue with local validation.
