# REV-30 — 지식 거래소 백엔드 스키마 통합 및 소셜 생태계 실기기 고도화

**창립자 지령 2026-09-15 · THE UNITAS GLOBAL OÜ · Ultimate Sovereign Master Codex v26.0**
정본: `index.html/docs/rev30/SPEC.md` · 실측 보고: `index.html/docs/rev30/FINAL_REPORT.md`

이 문서는 **실측 뒤에 쓰였다.** 설계 의도가 아니라 실제로 코드·스키마에 들어간 것과,
측정이 설계를 뒤집은 지점을 기록한다(제25장).

---

## §0. 두 미션의 구현 좌표

| 미션 | 지령 요지 | 구현 정본 |
|---|---|---|
| M1 | 지식 거래소·22대화방 서버 원장(테이블·RPC·RLS) 구축 및 적용, 클라이언트↔서버 동기화 무결성 | `supabase/migrations/20260916000000_hub_exchange_and_rooms.sql`, `web/lib/hub/hubLedger.ts`, `web/components/home/hub/KnowledgeExchange.tsx`, `.../ThemeChatRooms.tsx` |
| M2 | 모바일 터치/포커스 환경에서 U-AI 검색 팝업·UNITAS 허브 팝업 생명주기 E2E 확장 | `tests/web-cinema-e2e/rev30-mobile-lifecycle.spec.js` |

부수 정본: `index.html/scripts/supabase-sql.mjs`(라이브 SQL 러너, 파괴적 구문 거부),
`web/scripts/apply-rev30-i18n.mjs`(20로케일 × 11키 신규 `Rev30` 네임스페이스).

---

## §1. MISSION 1 — 서버 원장

### 1.1 REV-29가 남긴 것

REV-29 보고서 §10.1 원문: *"지식 거래소·대화방 서버 원장(테이블·RPC·RLS·정산 잡)은
스키마 변경이라 이번 구간 밖 — 현재는 기기 원장 + 실시간 브로드캐스트."* REV-30은
**정확히 그것만** 닫는다.

### 1.2 스키마 (5 테이블 · 7 정책 · 6 RPC)

| 테이블 | 무엇 | RLS |
|---|---|---|
| `hub_catalog` | 24팩 카탈로그. **가격의 정본** | select all(authenticated), 쓰기 service_role |
| `hub_credits` | 유저당 크레딧 1행 + 스타터 지급 여부 | select own **only** — insert/update/delete 정책 **없음** |
| `hub_listings` | 창작자가 올린 팩(제목·테마·가격·요약·심사/판매) | select own + select live |
| `hub_purchases` | 구매 원장(append-only, 70/30 분할 기록) | select own |
| `hub_messages` | 22방 영속 히스토리 | select all + delete own |

| RPC | 무엇을 보장하는가 |
|---|---|
| `hub_sync()` | 최초 1회 스타터 1,200 크레딧 지급(`starter_granted`로 멱등) + 전체 원장 반환 |
| `hub_buy_pack(pack_id)` | **가격을 카탈로그에서 읽어** 원장 잠금 → 잔액 검사 → 차감 → 70/30 기록, 한 트랜잭션 |
| `hub_list_pack(title, theme, price, summary)` | 제목 3~60 · 가격 10~5,000 정수 · 요약 ≤200 · 테마 22축 · 작성자당 50건 상한 **서버 재검증** |
| `hub_post_message(room, body, author)` | 공백 정규화 + 제어문자 제거 + 280자 클립 + **900ms 플러드 가드** → 저장된 행 반환 |
| `hub_room_history(room, limit)` | 방의 최근 N개(오래된 순), 상한은 서버가 결정(최대 200) |
| `hub_seller_board(limit)` | 구매 원장 기반 **실제** 창작자 수익 |

모든 RPC는 `security definer` + `set search_path = public`, `anon`·`public` **revoke**,
`authenticated`에만 **grant**(20260905000000 최소권한 자세 계승).

### 1.3 이 마이그레이션이 내린 다섯 결정

1. **거래소 크레딧은 U-COIN이 아니다.** `hub_credits`는 자체 원장이며 `public.wallets`·
   `public.coin_ledger`를 **건드리지 않는다.** 코인 경제의 마진 독트린(제1장 U-COIN
   Micro-Burn)이 그 두 테이블에 걸려 있고, 마켓플레이스 구매로 U-COIN을 조용히 발행하는
   것은 지시받지 않은 경제 개편이다. 대신 구매 행에 `creator_share`/`platform_share`를
   **영속 기록**하여 이후 정산 잡이 지급할 수 있게 seam만 남겼다.
2. **가격은 DB에 있고 요청에 없다.** `hub_buy_pack`은 팩 id만 받는다. 클라이언트가 가격을
   선언하면 320 크레딧 팩을 1에 사는 클라이언트가 된다. TS↔SQL 어긋남은
   `__tests__/hub/schemaParity.test.ts`가 빌드를 깬다.
3. **로그인 유저는 서버 원장, 게스트는 기기 원장.** RLS는 `auth.uid()`로 행을 지키는데
   익명 방문자에겐 그것이 없다. RLS가 실제로 방어할 수 없는 가짜 신원을 만드는 대신
   두 원장을 분리하고 **화면에 어느 쪽인지 표시**한다. 병합하지 않는 이유: 기기가 *주장하는*
   구매를 가져오는 것은 주장한 만큼 무상 지급하는 것과 같다.
4. **채팅은 로그인 작성자에게 영속, 모두에게 브로드캐스트.** REV-29의 Realtime
   브로드캐스트는 **무변경** — 방의 생동감은 그것이다. 추가된 것은 영속성뿐이다.
5. **서버 검증은 순수 규칙을 미러링하되 신뢰하지 않는다.** 길이·범위·22축·280자·900ms를
   전부 서버가 다시 본다. TS 사본은 즉시 피드백용, SQL 사본이 결정한다.

### 1.4 클라이언트 seam

`web/lib/hub/hubLedger.ts` — 모든 매퍼가 **순수 + 검증형**이다. RPC 응답은 네트워크에서
온 데이터이므로 필드 단위로 검사하고 맞지 않으면 버린다(브로드캐스트 페이로드 가드와 동일
자세). `mapBuyResult`는 서버 제약과 같은 규칙(`creator + platform === price`)을 다시
확인해서, 깨진 정산이 정상처럼 렌더되지 못하게 한다. 실패는 전부 **fail-open**:
`null` 반환 → 호출부가 기기 원장을 유지 → 허브는 오프라인에서도 살아 있다.

`HubServerError` 6종(`unauthenticated`/`owned`/`insufficient`/`too-fast`/`rejected`/
`offline`)은 공용 `Rev30.error.*` 네임스페이스로 번역되어 **모든 허브 표면에서 같은 문장**으로
읽힌다.

### 1.5 적용 절차 (그리고 왜 `db push`가 아닌가)

라이브 프로젝트는 대시보드로 손수 만들어져 완전한 마이그레이션 이력이 없다 — `db push`는
스키마와 맞지 않는 로컬 파일 전부를 재생하려 든다. 20260902000000 이후 모든 마이그레이션과
동일하게 **Management API `database/query`** 로 단독 적용하고 이력을 기록했다.

신규 `scripts/supabase-sql.mjs`가 그 절차를 스크립트로 고정한다. 이 러너는
`DROP TABLE`/`DROP SCHEMA`/`DROP COLUMN`/`TRUNCATE`/`DELETE FROM`이 든 구문을 **전송 거부**한다 —
비가역 변경은 그 구문 자체에 대한 창립자 승인을 받아 손으로 적용한다.

**리허설 먼저.** Postgres DDL은 트랜잭션이므로 마이그레이션 전체를 `begin; … rollback;`으로
감싸 라이브에 **먼저 실행**했다. 파싱·실행이 통과하고 롤백되면 그 파일은 옳다. 실측: 통과 후
`hub_%` 테이블 0개(§FINAL_REPORT §2.2).

---

## §2. MISSION 2 — 모바일 생명주기 E2E

### 2.1 무엇이 측정된 적 없었나

REV-29 M1은 터치 기기만 증명할 수 있는 약속을 했다 — *"키보드는 텍스트 박스를 만졌을 때만,
그리고 팝업은 그대로."* `rev29-verify`는 **칩 한 번 탭**이라는 단일 케이스를 증명한다.
측정된 적 없는 것은 **생명주기**다: 입력 → 지우기 → 허브 열기 → 탭 전환 → 방 스크롤 →
메시지 → 허브 닫기 → 바 복귀. 각 단계가 포커스를 되돌리거나(=키보드 재소환) 팝업을 무너뜨릴
수 있고, 6단계의 결함은 1단계만 보는 테스트에 보이지 않는다.

### 2.2 9개 계약

| # | 계약 |
|---|---|
| 1 | 입력 탭 → 포커스 · 타이핑 → 드롭다운 전환 · 수동 비우기 → 스트립 복귀 · 뉴스 칩 탭 → **blur + 팝업 유지** · 숏컷 칩 탭(키보드 이미 내려간 상태) → **재소환 없음** · 입력 재탭 → 포커스 복귀 |
| 2 | 키보드가 내려간 상태에서 검색 표면 **바깥** 탭 → 팝업 닫힘(일반 blur 경로가 아닌 외부 탭 리스너가 닫는 상태) |
| 3 | 허브 타일 탭 → 키보드 없이 열림 · 5탭 전환 전부 키보드 없음 · 방 전환 2회 · **방 작성란 탭은 포커스 허용**(텍스트 박스이므로)하되 검색창은 되찾지 않음 · 닫기 → 팝업 생존 → 바 재사용 가능 |
| 4 | 기기 뒤로가기 → **허브만** 닫히고 팝업은 남음 |
| 5 | 포털 내부 오버플로 리스트 스크롤 → 아무것도 닫히지 않음 |
| 6 | 첨부 스케치 터치 선택 → 무장 유지 · 무첨부 닫기 → 해제 · 팝업 생존 |
| 7 | (전 엔진) 로그아웃 상태 → `data-hub-ledger="device"` 배지 |
| 8 | (전 엔진) 방 → `data-hub-durable="0"` 표시 |
| 9 | (전 엔진) 허브 닫은 뒤 잔류 다이얼로그 0 + 타일 `data-active="0"` |

---

## §3. 측정이 설계를 고친 지점

1. **Write 도구가 `\uXXXX` 이스케이프를 실제 제어 바이트로 바꿨다.** 채팅 정화기의 문자
   클래스에 **NUL을 포함한 제어 바이트 7종**이 그대로 파일에 들어갔고, 그대로 Postgres로
   갈 뻔했다. REV-29에서 Bash heredoc이 `\b`를 0x08로 깨뜨린 것과 **같은 부류, 다른 경로**다.
   정화기를 POSIX 클래스(`[[:cntrl:]]`)만으로 재작성하고, `schemaParity.test.ts`가
   마이그레이션 전체에 제어문자 0건을 **상시 단언**한다.
2. **`row`는 예약어다.** `jsonb_agg(row order by at)`의 별칭이 파싱을 깬다 → `payload`/
   `sent_at`으로 개명. 리허설이 아니라 정적 검토에서 잡았고, 리허설이 확증했다.
3. **템플릿 리터럴이 정규식 이스케이프를 삼킨다.** 테스트의 `` `price\s+integer` ``에서
   `\s`가 `s`로 붕괴 → `String.raw`로 재작성. 정렬된 SQL 컬럼 정의를 텍스트로 단언하려다
   생긴 문제이며, 공백 비의존 패턴이 정답이었다.
4. **임시 테이블은 `authenticated` 역할로 쓸 수 없다.** 라이브 RPC 프로브가
   `permission denied for table probe_out`으로 멈췄다 — 역할을 바꾼 채 결과를 적으려 했기
   때문. `grant insert, select on probe_out to authenticated`로 해결.

---

## §4. 미해결 (측정되지 않은 것)

1. **U-COIN 정산 잡**은 만들지 않았다. 구매 행이 분할을 영속 기록하므로 seam은 열려 있으나,
   실제 지급은 창립자의 별도 지시를 받아야 할 경제 행위다.
2. **게스트 원장 → 계정 원장 승격**은 의도적으로 없다(§1.3 결정 3).
3. **실기기 iOS Safari 가상 키보드**는 여전히 헤드리스 모바일 크로미움의 `activeElement`
   전이로만 증명된다. 실기기 확인은 창립자 손에 남는다(REV-28·REV-29와 동일 유예).
4. `hub_messages`에 **보존 기간 정책**(오래된 행 정리)은 없다. 22방이 커지면 크론 잡이
   필요하지만, 지금 만들면 첫 행이 쌓이기도 전에 삭제 경로를 넣는 셈이라 보류했다.
