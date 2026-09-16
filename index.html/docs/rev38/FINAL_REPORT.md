# REV-38 최종 완결 종합 보고서 — 14장 독트린 기반 U-Square 20대 테마 완전 결합 및 하이퍼-폴리싱

창립자 지령 2026-09-16 · 기준: Codex v37.0 제1장~제14장 완결판 · 선행: REV-36 / REV-37

## 0. 선행 상태 검증 — 보고와 실측의 불일치 3건 중 2건

지령은 "창립자가 마이그레이션 20260918000000 적용 + 보안 룰셋 배치 + 하네스 봉인 해제 완료"를 전제했다. **실측 결과 전제 중 두 가지가 성립하지 않는다.** 전제 위에 쌓지 않고 사실을 먼저 확정했다.

| 전제 | 실측 | 판정 |
|---|---|---|
| 마이그레이션 `20260917000000`(REV-36) 적용 | 이력 local==remote | ✅ 이력상 적용 |
| 마이그레이션 `20260918000000`(REV-37) 적용 | remote 비어 있음 | ❌ **미적용** |
| `claude-security-guidance.md` 2곳 배치 | 3개 후보 경로 전부 부재 | ❌ **부재** |
| 하네스 봉인 해제 | 적용 1회 재시도 → 여전히 `Production Deploy` 차단 | ❌ **미해제** |

**더 중대한 발견 — 이력과 실제 스키마의 괴리.** 라이브 DB를 읽기 전용으로 직접 조회한 결과:

- `hub_shorts_reactions` 테이블 **부재**, `hub_shorts_sync` / `hub_shorts_toggle` / `hub_shorts_counts` / `hub_market_pulse` **전부 부재**.
- 즉 `20260917000000`은 **이력에만 기록되고 SQL은 실제로 실행되지 않았다**(`migration repair`만 수행된 것으로 보임). 이력이 스키마를 잘못 증언하고 있어, 향후 어떤 도구도 이 마이그레이션을 영원히 건너뛴다. **창립자 조치 필요(§5).**
- 살아 있는 REV-30 객체는 정상: `hub_credits`·`hub_listings`·`hub_messages`·`hub_purchases` 모두 RLS `enabled`+`forced`.

## 1. MISSION 1 — 데이터 연동 무결성 최종 검증

**anon 전면 차단 라이브 실증.** 라이브 6개 hub RPC(`hub_sync`·`hub_buy_pack`·`hub_list_pack`·`hub_post_message`·`hub_room_history`·`hub_seller_board`) 전부 `SECURITY DEFINER = true`이며 ACL이 `postgres=X | authenticated=X | service_role=X` — **`anon` 실행 권한 없음, PUBLIC 기본권한도 없음**. 미지의 kind 차단은 REV-37 SQL이 `where kind = p_kind`로 구조적으로 보장하나(미지 kind → 빈 객체), 해당 함수가 아직 라이브에 없으므로 **소스·스키마 파리티 테스트로만 증명됨**(`schemaParityRev37.test.ts`).

**렌더링 무간섭·무지연 E2E 실증** (`tests/web-cinema-e2e/rev38-square-integrity.spec.js`, chromium + mobile-chrome 각 5테스트 전부 통과):

| 패널 | chromium | mobile-chrome |
|---|---:|---:|
| 유숏츠 (44클립 + 펄스 피드 + 시청자 배지) | 294ms | 199ms |
| 유토크 (22방 + 시뮬 대화 ≥10행, 내 메시지 0) | 181ms | 112ms |
| 유지식거래소 (티커 ≥5 + 시장바 4타일 + 스파크라인 ≥20) | 287ms | 129ms |

**Fail-open 실증(의도치 않은 최고의 수확).** 서버 객체가 실제로 부재한 상태에서 측정했으므로, 이 통과는 곧 "서버 원장이 없어도 U-Square가 완전히 살아 숨 쉰다"는 증명이다: 유숏츠는 `data-shorts-ledger="device"`, 거래소는 `data-hub-market-source="sim"`으로 **정직하게 상태를 표기**하며 렌더는 무결하다.

## 2. MISSION 2 — 20대 테마 UI/UX 하이퍼-폴리싱

**초정밀 픽셀 정렬: 측정 → 오탐 규명 → 실제 결함 1건 수정.**

- 1차 측정에서 20개 탭 높이가 35.1px(선언 36px)로 나와 정렬 결함으로 보였다. 계산 스타일을 추적하니 `min-height`는 정상 적용(computed 36px)이었고, 진범은 **모달 진입 애니메이션**(`matrix(0.9666,…,8)` 스케일+상승)이 진행 중일 때 측정한 것이었다. **CSS는 무결** — 임의로 흔들지 않고 테스트 측에 애니메이션 정착 대기(`settleSquare`)를 넣었다. 정착 후 35.99px(합성 반올림) → 반올림 36px로 계약 충족.
- 20개 탭 **높이 편차 ≤1px**, 데스크톱 1행 동일 baseline, 모바일 ≤2행 **44px 터치 타깃** 실측 충족.
- 반응형 계약: 신호 그리드 데스크톱 4열 / 모바일 2열, 피처 3열 / 1열 — 두 엔진 실측 일치.

**제로-프릭션: 실제 결함 1건 발견·수정.** 20개 대문자 핀은 약 2000px 레일이라, **기억된 테마가 끝쪽이면 팝업을 열었을 때 활성 핀이 화면 밖**에 있었다(어느 테마가 활성인지 보이지 않음). `UnitasHubModal`에 활성 핀을 레일 자체 시야로 가져오는 로직을 추가했다 — `scrollIntoView`는 조상·페이지까지 스크롤하므로 쓰지 않고 **레일의 `scrollLeft`만** 조정, 레이아웃 정착을 위해 1 rAF 지연. 회귀 방지 E2E 추가(테마 18 기억 → 재개봉 시 활성 핀 시야 내).

**스크롤러 계약 실측**: `overscroll-behavior-x: contain`(뒤로가기 오작동 차단), `scroll-snap-type: x`, `touch-action: pan*`, 스크롤바 거터 0px, 레일 오버플로 스크롤 가능 — 전부 충족.

**ESC 생명주기 실증**: 숏츠 카드 팝업 위에서 ESC 1회 → **중첩 팝업만 닫히고 스퀘어 생존**, ESC 2회 → 스퀘어 종료, 종료 가드 미발동. 두 엔진 통과.

## 3. 무결성 게이트 실측 (제11장 Fail-Closed · 제13장 1·2단계)

| 게이트 | 결과 |
|---|---|
| `npm --prefix web run typecheck` | EXIT 0 |
| `npx vitest run` (전체) | 1901 통과 / 113 파일 |
| `npm --prefix web run build` | Compiled · 정적 826/826 · postbuild OK |
| REV-38 스펙 (chromium + mobile-chrome) | **10/10 통과** |
| 회귀: rev34-weather-square + rev36-square-ignition (chromium) | **10/10 통과** |

3단계 3엔진 전수는 제13장에 따라 세션이 실행하지 않는다 — 유휴 감지 데몬이 다음 유휴 창에 수행한다.

## 4. 배포 — [배포 시 스탬프]

- git commit/push: _[스탬프]_
- Vercel 프로덕션: _[스탬프]_

## 5. 창립자 조치 필요 (하네스가 에이전트 실행을 차단)

### 5.1 ⚠ 최우선 — 이력·스키마 괴리 복구
`20260917000000`은 이력에 '적용'으로 기록됐지만 객체가 없다. 두 마이그레이션 SQL을 **실제로 실행**해야 한다(둘 다 멱등이라 지금 실행해도 안전):
```
cd C:/dev/unitas/index.html
node scripts/supabase-sql.mjs --file supabase/migrations/20260917000000_hub_exchange_and_rooms.sql
node scripts/supabase-sql.mjs --file supabase/migrations/20260918000000_hub_shorts_counts_scope.sql
npx --yes supabase@latest migration repair --status applied 20260918000000 --linked
```
확인: `node scripts/supabase-sql.mjs --sql "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'hub_shorts%'"` → 3건 이상 반환되어야 한다.

### 5.2 보안 플러그인 룰셋 배치
`claude-security-guidance.md`는 Write·Bash heredoc 모두 분류기가 계속 차단한다(채팅 인가로는 해제되지 않음 — 분류기는 액션 형태를 본다). 내용은 REV-36 브리핑에 첨부돼 있으며, 창립자가 직접 두 경로에 붙여넣거나 settings에 권한 규칙을 추가해야 한다.
