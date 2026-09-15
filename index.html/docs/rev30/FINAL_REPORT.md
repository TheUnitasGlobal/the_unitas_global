# REV-30 최종 완결 종합 보고서

**창립자 지령 2026-09-15 · THE UNITAS GLOBAL OÜ · Ultimate Sovereign Master Codex v26.0 제25장**
설계 정본: `index.html/docs/rev30/SPEC.md`

이 보고서는 **측정된 것만** 적는다. 측정하지 않은 상태를 완료로 적지 않는다(제25장).

---

## §1. 게이트 실측

| 게이트 | 명령 | 결과 |
|---|---|---|
| 타입 | `npm --prefix web run typecheck` | **EXIT 0** |
| 유닛 | `cd web && npx vitest run` | **1536 / 1536 passed · 94 files** (REV-29 1501/92 → **+35 / +2**) |
| 빌드 | `npm --prefix web run build` | **EXIT 0** · 지문 `eb09b6b8bab1d401…` |
| E2E | `npx playwright test --config=tests/web-cinema.config.js` | §4 |
| 스키마 | Management API `database/query` | §2 |

---

## §2. MISSION 1 — 서버 원장

### 2.1 적용 결과 (라이브)

```
테이블      hub_catalog · hub_credits · hub_listings · hub_purchases · hub_messages   = 5
정책                                                                                  = 7
RPC                                                                                   = 6
RLS enable + force                                                                    = 5 / 5
카탈로그 시드                                                                          = 24 행
마이그레이션 이력  supabase_migrations.schema_migrations                               = 20260916000000 기록
```

RPC 실행 권한 실측(`has_function_privilege`):

| RPC | authenticated | anon |
|---|---|---|
| `hub_sync` · `hub_buy_pack` · `hub_list_pack` · `hub_post_message` · `hub_room_history` · `hub_seller_board` | **true** (6/6) | **false** (6/6) |

### 2.2 리허설이 먼저였다

Postgres DDL은 트랜잭션이다. 마이그레이션 전체를 `begin; … rollback;`으로 감싸 **라이브에
먼저 실행**했다. 실행 통과 후 `hub_%` 테이블 **0개** — 파일이 옳다는 것을 라이브 변경 없이
증명한 뒤 본 적용을 했다.

### 2.3 라이브 RPC 프로브 (롤백되는 트랜잭션 안에서, 실제 유저를 가장)

`request.jwt.claims` + `role=authenticated`로 실존 프로필을 가장해 실제 함수를 호출했다.

| 단계 | 실측 |
|---|---|
| `hub_sync` 1회차 | `credits 1200 · starterGranted true` |
| `hub_sync` 2회차 | `credits 1200` (**재지급 없음**) |
| `hub_buy_pack('kp-03')` | `price 320`(**카탈로그 가격**) · `credits 880` · 분할 `224 / 96` = **320 정확히 일치** |
| 같은 팩 재구매 | **거부** `Already owned` |
| 없는 팩 `kp-999` | **거부** `Unknown pack: kp-999` |
| `hub_list_pack` 정상 | `status review` · `liveAt = at + 600,000ms` |
| 제목 2자 | **거부** `Title must be 3-60 characters` |
| 가격 5 | **거부** `Price must be 10-5000 credits` |
| 테마 `world` | **거부** `value for domain hub_theme violates check constraint` |
| `hub_post_message('  hello    world  ')` | 저장값 **`hello world`**(공백 정규화 실측) |
| 즉시 재전송 | **거부** `Too fast`(900ms 가드) |
| 공백만 | **거부** `Empty message` |
| `hub_room_history` | 방금 저장한 1행 반환 |
| `hub_seller_board` | `nomad.kai · sales 1 · revenue 224`(**구매 원장에서 계산된 실수익**) |
| RLS | 가장한 유저에게 보이는 `hub_credits` 행 **= 1**(자기 것만) |

프로브 종료 후 라이브 실측: `hub_credits 0 · hub_purchases 0 · hub_messages 0 ·
hub_listings 0 · hub_catalog 24` — **롤백 완결, 원장은 비어 있고 카탈로그만 남았다.**

### 2.4 클라이언트 동기화 무결성

- `lib/hub/hubLedger.ts`의 7개 매퍼는 전부 순수·검증형. 유닛 **29건**.
- `mapBuyResult`는 서버 제약과 **같은 규칙**(`creator + platform === price`)을 다시 확인 —
  분할이 어긋난 응답은 렌더되지 않는다(테스트로 증명).
- `schemaParity.test.ts` **28건**: 24팩 전 필드(가격 포함) TS↔SQL 일치, 22축 도메인 =
  `HOT_NEWS_CATEGORIES`, 스타터 1,200 · 70/30 · 제목 3~60 · 가격 10~5,000 · 요약 200 ·
  본문 280 · 플러드 900ms · 히스토리 60 양쪽 일치, 5테이블 전부 RLS 강제, 6 RPC 전부
  anon revoke + authenticated grant, **제어문자 0건**, `wallets`/`coin_ledger` 무접촉.

### 2.5 U-COIN 무접촉 (실측)

마이그레이션에 `insert into public.wallets|coin_ledger` **0건**,
`update public.wallets|coin_ledger` **0건**. 테스트가 상시 단언한다.

---

## §3. MISSION 2 — 모바일 생명주기

`tests/web-cinema-e2e/rev30-mobile-lifecycle.spec.js` — 9개 계약(§SPEC 2.2).

| 프로젝트 | 결과 |
|---|---|
| mobile-chrome (Pixel 7, 실제 터치) | **9 pass · 0 fail** (1.5분) |
| chromium | **13 pass · 0 fail · 7 skip** (rev30 6 + rev29 1, 전부 터치 전용 설계 스킵, rev29-verify 회귀 포함) |
| webkit | §3.1 |

핵심 실측 세 가지:

1. **키보드 재소환 0.** 입력 탭(포커스 true) → 뉴스 칩 탭(false) → 숏컷 칩 탭(**여전히 false**)
   → 입력 재탭(true). 팝업은 전 구간 visible.
2. **허브는 키보드를 들지 않는다.** 타일 탭 후 5탭 전환·방 2회 전환 전부 검색창 포커스
   **false**. 단 방 작성란 탭은 포커스를 **허용**하고(텍스트 박스이므로), 그때도 검색창은
   되찾지 않는다.
3. **뒤로가기는 허브만 닫는다.** `page.goBack()` 후 허브 0개, 검색 팝업 visible.

### 3.1 WebKit

`rev30-mobile-lifecycle` on WebKit(Desktop Safari 에뮬, REV-28 시계): **3 pass · 0 fail ·
6 skip**(59초). 스킵 6건은 터치 전용 설계 스킵 — 데스크톱 프로젝트에는 내릴 키보드도
`hasTouch`도 없다. 통과한 3건은 엔진 무관 계약이다: 로그아웃 시 `device` 원장 배지,
방의 `durable="0"` 표시, 허브 닫은 뒤 잔류 다이얼로그 0 + 타일 비활성.

---

## §4. E2E 총계

| 프로젝트 | 스펙 | 결과 |
|---|---|---|
| mobile-chrome | rev30-mobile-lifecycle | 9 / 0 |
| chromium | rev30-mobile-lifecycle + rev29-verify | 13 / 0 / 7 skip |
| webkit | rev30-mobile-lifecycle | §3.1 |

REV-29 계약은 **무변경 통과** — 허브에 서버 원장이 들어왔어도 타일·팝업·5표면·구매·전송의
기존 단언이 그대로 성립한다.

---

## §5. i18n

`web/scripts/apply-rev30-i18n.mjs` — 신규 `Rev30` 네임스페이스 **11키 × 20로케일 = 220 문자열**
(`--check` 재실행 **clean**). 6종 서버 결과는 공용 `Rev30.error.*`로 번역되어 거래소와
대화방에서 **같은 문장**으로 읽힌다.

---

## §6. 측정이 설계를 고친 지점

1. **Write 도구가 `\uXXXX`를 실제 제어 바이트로 바꿨다** — 채팅 정화기 문자 클래스에 **NUL 포함
   제어 바이트 7종**이 파일에 그대로 박혔고 Postgres로 갈 뻔했다. REV-29에서 Bash heredoc이
   `\b`를 0x08로 깨뜨린 것과 같은 부류, **다른 경로**. POSIX 클래스(`[[:cntrl:]]`)로 재작성했고
   파서 테스트가 마이그레이션 전체에 제어문자 0건을 상시 단언한다.
2. **`row`는 예약어** — `jsonb_agg(row order by at)` 별칭이 파싱을 깬다 → `payload`/`sent_at`.
3. **템플릿 리터럴이 정규식 이스케이프를 삼킨다** — 테스트의 `\s`가 `s`로 붕괴 → `String.raw`.
4. **임시 테이블은 `authenticated` 역할로 쓸 수 없다** — 라이브 프로브가 `permission denied`로
   멈췄다 → `grant insert, select on probe_out to authenticated`.

---

## §7. 배포

DEPLOY30_PLACEHOLDER

---

## §8. 미해결 (측정되지 않은 것)

1. **U-COIN 정산 잡**은 만들지 않았다. 구매 행이 70/30 분할을 영속 기록하므로 seam은 열려
   있으나, 실제 지급은 창립자의 별도 지시를 받아야 할 경제 행위다.
2. **게스트 → 계정 원장 승격**은 의도적으로 없다(SPEC §1.3 결정 3): 기기가 *주장하는* 구매를
   가져오는 것은 주장한 만큼 무상 지급하는 것과 같다.
3. **실기기 iOS Safari 가상 키보드**는 헤드리스 모바일 크로미움의 `activeElement` 전이로만
   증명된다. 실기기 확인은 창립자 손(REV-28·29와 동일 유예).
4. `hub_messages` **보존 기간 정책** 없음 — 22방이 커지면 크론 정리가 필요하다. 첫 행이 쌓이기도
   전에 삭제 경로를 넣지 않기로 했다.
5. 서버 원장 경로는 **로그인 세션이 있어야** 실행되므로, 이번 E2E는 전부 **로그아웃(기기 원장)
   상태**를 측정했다. 로그인 상태의 브라우저 왕복은 라이브 RPC 프로브(§2.3)가 대신 증명한다.
