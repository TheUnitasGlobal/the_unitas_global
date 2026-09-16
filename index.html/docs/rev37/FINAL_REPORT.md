# REV-37 최종 완결 종합 보고서 — U-Square 데이터 스코프 무결성 완결

창립자 지령 2026-09-16 · 기준: Codex v37.0 제1장~제14장 · 선행: REV-36

## 1. 미션 결과

**MISSION 1 — `hub_shorts_counts` 스코프 잠재 충돌 원천 차단: 완결.**

- REV-36 §6이 남긴 잠재 불씨(카운트가 `target`만으로 집계되어 clip id↔handle 문자열 충돌 시 like/follow가 섞일 수 있음)를 **원천 제거**. 카운트를 **kind로 스코프**해 두 반응 공간을 완전히 격리했다.
- 새 마이그레이션 `supabase/migrations/20260918000000_hub_shorts_counts_scope.sql`: 무스코프 1인자 형식(`hub_shorts_counts(text[])`) 폐기 → kind-스코프 2인자 형식(`hub_shorts_counts(p_kind text, p_targets text[])`, `where active and kind = p_kind and target = any(...)`). 미지의 kind는 빈 객체 반환(구조적으로 누수 불가). 데이터·행·컬럼 무변경(읽기 전용 함수만 교체), 멱등, least-privilege(anon revoke).
- 클라이언트 seam `web/lib/hub/hubLedger.ts`: `hubShortsCounts(kind, targets)`로 시그니처 변경. (UI 미사용 seam이라 런타임 영향 0 — 안전.)

**렌더 계층 격리 검증**: U-Square 44 숏츠 피드/트렌딩과 22 대화방은 이미 완전 격리되어 있음을 실측·검증:
- `lib/square/*.ts` 4모듈에 **모듈 레벨 가변 상태 0**(`grep '^(let|var)'` = 없음; 전부 순수 함수 + const). 방·클립별 펄스는 `(대상, 슬롯)`의 순수 함수라 렌더 인터리빙이 서로를 오염시킬 수 없다.
- 컴포넌트는 `SectionShield`로 한 번에 한 패널만 마운트, `now`/인터벌은 인스턴스별 독립.
- 신규 테스트 `pulse.test.ts`의 "REV-37 render isolation": economy 방을 politics·science·disaster 렌더 사이에 두 번 호출해도 동일 결과, 다른 방과는 독립임을 증명.

## 2. 무결성 게이트 실측 (제11장 Fail-Closed)

| 게이트 | 결과 |
|---|---|
| `npm --prefix web run typecheck` | EXIT 0 |
| `npx vitest run` (전체) | 1901 통과 / 113 파일 |
| `npm --prefix web run build` | Compiled · 정적 826/826 · postbuild OK |
| 마이그레이션 dry-run | 파싱 OK · 전송 0 |
| `__tests__/hub/schemaParityRev37.test.ts` | 통과(스코프·폐기·격리·least-priv·비파괴·seam 강제) |

## 3. 배포·라이브 적용 — 실측 스탬프

- git commit/push: 커밋 `17740ea` → `origin/main` 푸시 완료(`76234e0..17740ea`).
- Vercel 프로덕션: 배포 `the-unitas-global-dw4ntpox4-the-unitas-global-ou-e.vercel.app` 완료(폰트 페치 경고는 비치명, 정적 826/826). `www.theunitas.global/`·`/en/u-ai` → 307(게이트, 정상).
- 마이그레이션 라이브 적용 + repair: 오토모드 분류기가 에이전트의 라이브 DB 변형을 차단(Production Deploy) → 창립자 수동 1회. seam이 UI 미사용이라 미적용 상태에서도 앱 무영향.

```
cd C:/dev/unitas/index.html
node scripts/supabase-sql.mjs --file supabase/migrations/20260918000000_hub_shorts_counts_scope.sql
npx --yes supabase@latest migration repair --status applied 20260918000000 --linked
```
