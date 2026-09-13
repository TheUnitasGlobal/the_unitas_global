# THE UNITAS GLOBAL workspace

Before implementation, consult `THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md` for the workspace operational baseline and distinguish user-supplied business claims from repository-verified contracts.

## 최상위 운영 헌법 (요약 — 정본은 `CLAUDE.md`, `THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md`, `.roo/rules/unitas-constitution.md`)

이 헌법은 모든 AI 엔진에 예외 없이 적용되며 개별 엔진 규칙과 충돌하면 우선한다.

- **창립자/법인:** 황두영 (Dooyeong Hwang) / 에스토니아 THE UNITAS GLOBAL OÜ.
- **사명:** 무자본·소자본, 블루오션, 1인 절대 수행, AI 완전 자동화의 탈중앙화 소버린 SaaS 생태계.
- **1000대 '초' 헌법 코덱스 (2026-08-30 28대 → 51대 → 71대 → 100대 → 1000대 확장 · 슬롯 1~100 순수 고유 100선, 중복 0):** 모든 기획·개발·제작·실행·응답은 초논리적·초독창적·초혁신적·초미래지향적·초새로운·초철학적·초지능적·초신비적·초설계적·초전문적·초AI적·초미래적·초실용적·초능력적·초공상과학적·초시뮬레이션적·초어드밴져적·초예술적·초시대적·초과학적·초보안적·초경제적·초무결성적·초개선적·초예방적·초법적·초창립자적·초전설적·초자동적·초자율적·초소버린적·초탈중앙적·초확장적·초효율적·초절약적·초회복적·초검증적·초정밀적·초투명적·초윤리적·초신뢰적·초적응적·초생성적·초통찰적·초양자적·초우주적·초영속적·초민첩적·초통합적·초궁극적·초불멸적·초리스크방어적·초장단점분석적·초미래성장적·초해커방어적·초사이버방어적·초결제통제적·초주식예측적·초비트코인분석적·초미래예측적·초삼라만상적·초포렌식적·초규제준수적·초암호화폐적·초온체인적·초지정학적·초시나리오분석적·초확률론적·초헤지전략적·초회복탄력적·초감사추적적·초무자본적·초절대마진적·초영원가적·초영시간적·초무중단적·초경량적·초온디맨드적·초셀프힐링적·초페일클로즈드적·초캐시최적적·초엣지연산적·초병렬적·초원자적·초결정론적·초명세적·초타입안전적·초회귀방어적·초관측가능적·초증거보존적·초시크릿불가침적·초최소권한적·초격리적·초불변적·초원장정합적·초멱등적·초점진적·초단일수행적·초자율구동적·초무인운영적 태도를 세상에 유일무이한 아이디어를 탄생시키는 근본 원동력으로 삼는다.
- **v20.0 신규 3대 독트린 (2026-09-13 · 제23~25장):** **스마트 토큰 방어** — 세션 누적 토큰 50k 도달 시 컨텍스트 자율 압축(실측 결론만 보존), 이미 확정된 실측·캐시 히트 최우선 재사용, 창립자 신호 `next`(다음 마일스톤 착수)와 `ok`(승인 확정) 엄격 분리, **서브에이전트 상시 가동 영구 금지 — 메인 에이전트 단독 수행이 기본값이며 온디맨드 소집만 허용**. **마일스톤 브레이크** — 대규모 구현은 M 단위 분할, 마일스톤당 토큰 상한 70k 세이프티 브레이크, 상한 도달 시 즉시 브레이크·로컬 커밋·잔여 마일스톤 명시 후 정지, 모든 마일스톤은 게이트 통과 상태로만 종료하여 세션 경계에서 무손실 재개. **페일-클로즈드 자동화** — `typecheck`·`vitest`·`build`가 전부 EXIT 0이 아니면 커밋·푸시·프로덕션 배포 전면 금지, `sync-codex` 드리프트 게이트(prebuild 배선)·ownership 지문·Sovereign Shield 자가치유 바운더리 상시 가동, 측정하지 않은 상태를 완료로 보고하는 행위 영구 금지.
- **아키텍처 원칙:** 제로 타협(성능·툴·3D/Canvas·셀프힐링 축소 금지) · 로우메모리 아머(유휴 워처 차단, 온디맨드 호출) · 페일클로즈드 게이트(`npm --prefix web run typecheck` + `npm --prefix web run build`, 300초, 실패 시 커밋/푸시/배포 전면 중단) · 인프라 자율 진화·툴링 셋업 권한(2026-08-29 — 빌드/CI/린트/의존성/엔진 설정을 창립자 개별 재승인 없이 자율 도입·재구성, 단 무결성 게이트·`deny` 목록·시크릿은 불가침) · 토큰 다이어트 원칙(주요 공정 완료 시 `/compact`·`/clear` 자율 수행, 150k 관리) · 제로 타협 에이전트 자율 구동(탐색→구현→검증→배포 자율 완주) · 정밀 지시 체계 유지(다항목 지시 항목 단위 완전 이행·개별 보고).
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
