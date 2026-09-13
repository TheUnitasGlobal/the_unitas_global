# REV-23 최종 완결 종합 보고서

**창립자 지령**: 2026-09-13, 6대 미션 (초비상 보안 게이트 · U-AI 팝업 재설계 · 숏컷/뉴스 분리 · 하이퍼 로고 · 단축키 드롭다운 · 옴니-테크 확장)
**정본 지침**: `CLAUDE.md` — Ultimate Sovereign Master Codex v26.0
**설계 정본**: `docs/rev23/SPEC.md`

---

## 0. 결론 요약

6대 미션 전항 구현·실측 완료. 게이트 3종 EXIT 0, REV-23 인수 스위트 13/13,
E2E 전 스위트 129건 중 126 pass · 1 skip · 2 타이밍 플레이크(개별 재실행 전부 통과).
**가장 중요한 실측 결과**: 창립자가 보고한 "외부 링크 유입 시 메인 직행" 결함은
재현되었고, 엣지 차단으로 물리적으로 봉인되었다 — 이제 미인증 방문자에게는
메인 인터페이스 HTML이 **한 바이트도 전송되지 않는다.**

---

## 1. MISSION 1 — 초비상 보안 게이트 (최고 우선순위)

### 실측된 결함
퍼널(로고→게이트→광고1~5→커밍순)은 전적으로 **클라이언트 오버레이**였다.
`app/[locale]/layout.tsx`가 z-500 커튼을 씌우되, 서버는 그 아래에 메인 페이지
HTML 전문을 **항상 전송**하고 있었다. 딥링크·리더모드·JS 차단·개발자도구 어느
쪽으로도 커튼을 걷으면 본문이 그대로 드러났다. 커튼은 게이트가 아니다.

### 구조
| 파일 | 역할 |
|---|---|
| `web/lib/gate/funnelGate.ts` | 순수 판정 함수 — exempt 경로, 인덱서 UA 허용목록, `resolveGateVerdict` |
| `web/middleware.ts` | 로케일 확정 **후** `seal` 판정 시 `/<locale>/gateway`로 **307 redirect** |
| `web/app/[locale]/gateway/page.tsx` | 본문 0바이트, 20 로케일 정적 생성, `noindex` |
| `web/app/globals.css` | `body:has([data-unitas-gateway])` — 봉인면에서 nav·본문 컨테이너 제거 |

**재작성이 아니라 리다이렉트인 이유** (구현 중 실측으로 뒤집힌 설계): 최초 설계는
딥링크 URL 보존을 위해 `rewrite`였다. 빌드된 서버에서 측정하니 App Router
클라이언트가 라우트를 바꾸는 미들웨어 재작성을 초기 문서에서 조정하지 못해
**모든 봉인 로드가 React #418 → #423을 던지고 전체 클라이언트 재렌더로 폴백**했고
(`/<locale>/gateway` 직접 진입은 오류 0 — 이렇게 재작성을 원인으로 분리했다),
그 폴백이 헤드 부트스트랩의 `data-splash="off"` 사전 각인을 지워 창립자의 round-14
"서브뷰 새로고침 시 로고 페이지 재생 금지" 규칙까지 깨뜨렸다. 딥링크 URL 보존은
MISSION 1의 요구가 아니고 **퍼널 통과**가 요구이므로 307 리다이렉트로 확정했다
(`Cache-Control: no-store`, `Vary: Cookie, User-Agent`). `generateStaticParams`는
그대로 살아 SSG가 유지된다(레이아웃에서 `headers()`를 읽지 않는다).

### ⚠ 창립자 비상 복구 경로 (반드시 숙지)

M1 이후 **창립자 세션이 없으면 창립자도 다른 방문자와 동일하게 봉인**된다.
기존 진입은 그대로다 — `https://www.theunitas.global/?sovereign_auth=<토큰>`.
라이브에서 그 기계장치가 살아 있음을 실측 확인했다:
`/sovereign` → **404**(펜스 작동), `/api/sovereign/verify` → **200
`{"founder":false}`**, 토큰 핸드오프 블록은 REV-23이 손대지 않았고 게이트보다
**먼저** 실행된다(쿠키 읽기 위치만 위로 올림).

만약 어떤 이유로든 토큰 진입이 실패하면, **Vercel 환경변수에
`UNITAS_GATE_BYPASS=1`을 추가하고 재배포**하면 게이트 전체가 열린다. 대시보드
접근 권한은 창립자만 가지므로 이것이 유일하고 안전한 비상구다. 복구 후 반드시
제거할 것.

> 참고: `vercel env pull`은 Secret 타입 변수를 `[SENSITIVE]`로만 내려주므로,
> 이 세션에서 프로덕션 토큰 자체로는 진입을 실측할 수 없었다. 대신 위의 세
> 가지 실측으로 세션 검증 경로가 프로덕션에서 정상 작동함을 증명했다.

### 통과 경로 — 정확히 셋, 전부 fail-closed
1. 검증된 소버린 세션(HMAC HttpOnly 쿠키)
2. 검색엔진 인덱서 UA(제13장 SEO 주권 — 340 URL 사이트맵 보존)
3. `UNITAS_GATE_BYPASS=1` (로컬/E2E 전용)

### 실측 (빌드된 서버, `curl` + Playwright)
| 시나리오 | `x-unitas-gate` | 히어로 | 검색바 | gateway 마커 |
|---|---|---|---|---|
| 사람 → `/` | `seal` | 0 | 0 | 1 |
| 사람 → `/ko/company/about` (신고된 Bing 경로) | `seal` | 0 | 0 | 1 |
| 사람 → `/u-ai`, `/ko` | `seal` | 0 | 0 | 1 |
| Googlebot → `/` | `pass` | 1 | 1 | 0 |
| 창립자 세션 → `/` | `pass` | 1 | 1 | 0 |
| `/sitemap.xml`, `/robots.txt` | 200, 미봉인 | — | — | — |

유닛 테스트 `__tests__/gate/funnelGate.test.ts` 15케이스 — exempt/인덱서/판정 진리표 전수.

---

## 2. MISSION 2 — U-AI 팝업 아키텍처

### 2.1 뉴스 = 미입력 팝업 전용
`ouroboros` 조건을 `focused && !typing && value.length === 0`으로 강화했다.
`typing`만으로는 IME 조합 첫 프레임(자모는 이미 박스에 있으나 `typing`은 아직
false)에서 뉴스 스트립이 겹칠 수 있었다. E2E 계약 속성 `data-news-scope="empty-only"`.

### 2.2 결과 팝업 다이어트 — 27종 → 11종
**유지(창립자 지명 11)**: 웹 실시간 종합(`sources`) · 다른 곳에서 탐색(`deeper`) ·
연결된 개념 · 관련 사이트 · 파생 저작 · 관심의 파동 · 커뮤니티 · 관계망 ·
세계 각 판 · 뉴스 · 본문 발췌.

**영구 삭제(16종 + 5블록)**: `essence`(무료/유료 리포터 · 3초 입체 관점 ·
편향 실드 · 3단계 액션 체크리스트 · 스웜 교차 추론), `axisSpectrum`, `chain`,
`deepGate`(심층 통찰 · The VOID), `identity`, `redesign`, `cogs`, `timeline`,
`visual`, `papers`, `backlinks`, `siblings`, `shelf`, `art`, `number`, `earthEvents`.

삭제 범위는 UI에 그치지 않는다 — 어댑터(`dataLadder2.ts` 11레그 → 3레그),
`cogsMatrix.ts` 모듈, `/api/u-ai/insight` 라우트, `deepInsight.ts`의 프롬프트
빌더·파서, `DeepReport`/`BinaryVerdict`/`ChronosPoint`/`DeepInsightApiResponse`
타입, `useUai`의 `runDeep`/`deep`/`canDeep`/`deepAvailable`/`deep-loading` 위상까지
함께 제거했다. **로케일당 72키 × 20 로케일 = 1,440 문자열 소각.**

> **창립자 확인 요청 사항**: 심층 통찰 폐지로 U-AI 검색의 **유일한 U-COIN 번(burn)
> 표면이 사라졌다.** 코인 경제는 이제 전적으로 페이지 레벨 모듈 접근 게이트
> (`app/[locale]/(gated)/layout.tsx`)를 통해서만 돈다. 제1장·제8~10장의 마이크로
> 번 모델을 U-AI에서 다시 세우려면 별도 지령이 필요하다.

### 2.3 Two-step 액션
`lib/uai/twoStepSelect.ts` 순수 상태머신 + 12케이스 유닛 테스트.
- 여백 클릭 오픈 **삭제**: `DiscoveryCarousel`의 카드 컨테이너에서
  `role="button"` + `onClick` 제거, 헤더 패딩·여백은 완전 불활성.
- 우측 상단 화살표 단축키 **삭제**(`ArrowUpRight` 버튼 제거).
- 제목 텍스트 영역만 타깃: 1회 클릭 = `data-selected="1"` 하이라이트,
  2회째(또는 dblclick) = 오픈. 카드 셸의 대제목에도 동일 적용(`TwoStepTitle`).

### 2.4 뒤로가기 생명주기
히스토리 사다리를 창립자 요구대로 정확히 재구성했다:
`카드 팝업 → 결과 타워 → 검색창 내용 초기화 → 메인 홈 → 종료 팝업`.
- `typing` 레이어를 히스토리 스택에서 제거(4단 → 3단 꼬리).
- `text` 레이어를 `focused`가 아닌 **쿼리 존재**에 걸었다 — 제출 시 포커스가
  풀스크린 타워로 넘어가면서 이 레이어가 해제되면, 타워를 닫은 순간 홈으로
  튀며 "초기화" 단계를 건너뛰었다.
- `closeSearchTower`가 입력창으로 포커스를 되돌려 하위 레이어를 되살린다.

---

## 3. MISSION 3 — 숏컷/뉴스 분리 및 수상 테마

### 3.1 역할 분리 (중복 0%)
**실측된 중복원**: 숏컷 캐러셀의 9개 슬롯(game·sports·movie·bestseller·shopping·
stock·webtoon·fashion·food)은 전부 Google/Bing 뉴스 RSS 와이어였다 — 바로 아래
실시간 뉴스 레일과 **같은 엔진의 같은 종류 콘텐츠**.

조치: 9개 슬롯과 그 와이어 서브시스템(`hubThemes.ts` · `hubNews.ts` ·
`hubNewsClient.ts` · `/api/live/hub-news` · `NewsDeepModal`)을 **전면 삭제**.
숏컷 레일 = 실측 데이터/유틸리티, 뉴스 레일 = 뉴스. 캐러셀 24슬롯 → **16슬롯**.

### 3.2 타이틀 클렌징
- `HotNews.category.*` 20개에서 "세계/World/世界/全球/mundial/…" 접두·수식어
  **전면 제거**, 20 로케일 × 20 축 = **400 문자열을 각 언어 주격으로 재작성**
  (단순 문자열 절단이 아니다 — es/fr/it/pt/pl은 일치 형용사, ru는 격변화,
  tr은 소유격 접미사가 붙어 있어 언어별 실제 번역이 필요했다).
- "전체" 칩 **폐기** — 항상 개별 축이 선택된 상태로 시작.
- "세계실시간"(`world` 캐치올 축) **폐기** — 분류기 폴백을 `society`로 옮겨
  어떤 기사도 사라진 박스에 갇히지 않는다. 21축 → **20축**.

### 3.3 뷰포트 고정 (Scroll-Jumping 박멸)
`lib/ui/scrollAnchor.ts` 신설 + 유닛 테스트 6케이스.
원인은 **둘**이고 하나만 고치면 절반은 남는다:
1. **높이** — 회전 시 카드 높이가 줄면 읽고 있던 지점 위에서 문서가 수축한다.
   브라우저 스크롤 앵커링은 `key`로 리마운트되는 서브트리에서 붙잡을 노드가
   없어 포기하고 튄다. → `captureScroll()` 스냅샷 + rAF 복원, `reserveHeight()`
   단조 증가 최소 높이 예약, `.qw-no-anchor { overflow-anchor: none }`.
2. **포커스** — 자동 전환이 포커스를 옮기면 브라우저가 스크롤해 들여온다.
   → 방문자가 축을 직접 고르는 순간 자동 회전을 영구 정지(`userPicked`).

뉴스 축 레일도 숏컷과 동일한 오토 롤링(9s, 호버/백그라운드/딥 블록 시 정지)으로
전환하되, **자동 전환은 네트워크를 쓰지 않는다**: 회전은 당일 피처드 보드가 이미
커버하는 축만 순회하고, 월드와이드 라이브 와이어는 방문자가 축을 직접 고를 때만
호출한다. (최초 구현은 9초마다 `/api/live/axis-news`를 때려 REV-21 §1A 레일
드래그 프레임 예산을 깨뜨렸다 — §7 참조.)

### 3.4 수상 테마 창조 (신규)
`lib/live/awardsThemes.ts` — 16대 수상 레지스트리(노벨 6개 부문, 튜링상, 필즈상,
아카데미 작품상, 칸 황금종려, 그래미 올해의 레코드, 퓰리처, 부커, 프리츠커,
발롱도르, 타임 올해의 인물). 하루 1개 결정론적 회전.

**소스 결정의 실측 근거**: "누가 이 상을 받았는가"는 역방향 조회라 SPARQL이
정석이지만, 2026-09-13 실측에서 `query.wikidata.org`가 모든 요청에
`429 Aggressively rate-limiting to 1 req/min — active wdqs outage`를 반환했다.
분당 1회 응답하는 엔드포인트 위에 사용자 화면을 올릴 수는 없다. 그래서 일반
MediaWiki API 2콜로 대체했다: `haswbstatement:P166=<award>` CirrusSearch +
`wbgetentities`(로케일 라벨 + P585 연도 한정자). **실호출 검증 5/5**
(노벨 물리학상 → 안톤 차일링거 2022 · 튜링상 → 제프리 울먼 2020 · 아카데미
작품상 · 퓰리처 · 부커, 전부 한국어 라벨로 반환). 나머지 11개는 동일 쿼리
패턴에 라벨 검증된 QID.

---

## 4. MISSION 4 — UNITAS 하이퍼 로고

`app/unitas-wordmark.css` 신설. 히어로는 `color: var(--qw-ink)` — 흰 배경 위
Rich Black 평문이었다. 이제:
- **다크 글래스모피즘 플레이트**: h1의 절대 위치 `::before`(레이아웃 영향 0),
  방사형+선형 그라데이션, 이너 하이라이트, 네온 실버 림 링, 데스크톱 전용
  `backdrop-filter`(모바일 블러 예산 보존).
- **딥 스페이스 그라데이션 타이포**: `background-clip: text` + 투명 필,
  `-webkit-text-stroke`로 네온 실버 메탈릭 림, `drop-shadow` 글로우.
- **쉰(sheen) 스윕 — 호버 전용, 이것은 측정 결과다.** 최초 구현은 7.5초
  무한 루프였다. 빌드된 페이지에서 실측하니 유휴 상태 rAF **p95 50.1ms →
  83.2ms**, 평균 36.5 → 42.8ms로 프레임 예산의 1/3을 먹고 있었다
  (`background-position`은 paint 계층 속성이라 136px 글리프 런을 매 프레임
  재도색한다). 정지 상태에서는 플레이트·그라데이션·네온 림만 — 비용 0 — 이
  정체성을 이루고, 스윕은 손을 댄 사람에게만 1.6초 1회 보상으로 준다.
  reduced-motion / 모바일에서는 아예 돌지 않는다.

**DOM 변경 0.** REV-20이 0.02px까지 고정한 히어로 수직 대칭 계약을 지키기 위한
의도적 제약이다. **실측 재확인**: |A − B| < 1.5px 통과(웹폰트 로드 후 측정).

---

## 5. MISSION 5 — 단축키 드롭다운 + 시각 밸런스

- `AttachMenu`: 768px 미만 **바텀 시트 폐기**. 전 폭에서 동일한 앵커드
  드롭다운(140ms `cubic-bezier(0.16,1,0.3,1)`), 시트 헤더·닫기 버튼·
  VisualViewport 연출·`sheetTitle`/`close` 라벨 전부 제거.
- 엔터 키 강조 하향: 2px 채도 높은 블루 림 + 블루 필 + 이중 글로우 + 2.6초
  `qw-enter-flux` 스트로브 → 단축키 토글과 **동일한 박스**(같은 크기·1.5px 림·
  10px 라디우스·같은 중립 톤). 블루는 호버·포커스·입력 중에만 얻는다.
- **실측**: 두 박스의 폭/높이 차 ≤ 1px.

---

## 6. MISSION 6 — 옴니-테크 수속 확장

- **신규 딥 테마 `bigTechPulse`** (`lib/uai/deeperAdapters/omniTech.ts`):
  조직을 위키데이터가 보유한 모듈로 해체한다 — 산업(P452) · 모회사(P749) ·
  자회사(P355) · 제품(P1056) · 창립자(P112) · 최고경영자(P169) + 임직원 수 ·
  매출 규모. **각 항목이 다시 재앵커 칩**이라, 마이크로소프트에서 그 59개
  자회사 중 하나로 걸어 들어갈 수 있다. 이것이 "모듈식으로 집어삼키는" 구조다.
  실호출 검증: Q2283(Microsoft) → P355 n=59, P1056 n=14, P2139 n=19.
  키 없음, CORS `*`, CC0, WDQS 미사용.
- **`OUTBOUND_BRAND_ROW` 확장** (M2의 "MS 등 신규 테마 확장 추가"):
  9종 → **14종**, Microsoft Bing · Google Scholar · Wolfram Alpha · arXiv ·
  GitHub · Reddit 추가. 전부 키 없는 로그인 프리 검색 URL, 페치는 하지 않는다.
- **`awards` 디스커버리 테마**(§3.4) 역시 M6의 다차원 확장에 해당한다.

**의도적으로 하지 않은 것**: GitHub 검색 API 기반 코드-풋프린트 테마.
소스 레지스트리에 이미 선행 판단이 기록되어 있다 —
`Search API rejected (homonym noise, 10 req/min) -- outbound only`.
그 판단은 여전히 유효하므로 조용히 뒤집지 않았다. GitHub는 아웃바운드
목적지로만 남는다.

---

## 7. 무결성 게이트 실측 (제25장)

| 게이트 | 명령 | 결과 |
|---|---|---|
| 타입체크 | `npm --prefix web run typecheck` | **EXIT 0** |
| 유닛 | `cd web && npx vitest run` | **78 files / 1,214 tests 전항 통과** |
| 빌드 | `npm --prefix web run build` | **EXIT 0** (gateway 20/20 로케일 SSG, 미들웨어 99.9 kB) |
| REV-23 인수 | `playwright ... rev23-verify` | **13/13 통과 (chromium)** |
| E2E 전 스위트 | `playwright --config=tests/web-cinema.config.js --project=chromium` | **129건 중 126 pass · 1 skip · 2 flake** |

`sync-codex` 드리프트 게이트 `drift=0`, ownership 지문 `4af93cbd70f3aa44…`.

### E2E 12건 실패 → 전수 판별 및 처리

최초 완주에서 12건이 실패했다. `UNITAS_GATE_BYPASS=1`로 재실행해 **게이트가
원인인 5건**과 **계약 변경이 원인인 7건**을 분리 측정한 뒤 전부 처리했다.

| 스펙 | 판정 | 처리 |
|---|---|---|
| `module-gate` ×3 | 퍼널 게이트가 코인 게이트보다 먼저 봉인 | 새 계약으로 재작성. 코인 게이트 자체는 **인덱서 UA로 구동**해 여전히 307→/locked 검증 |
| `omni-exit` ×2 | **진짜 결함** — 재작성이 히드레이션을 깨 `data-splash` 각인 소실 | 리다이렉트로 교체해 근본 해결(§1) |
| `rev21-hub-card` ×4 | M2.3이 whole-card 히트박스를 폐기 | 반대 계약(모서리는 열리지 않는다)으로 재작성 + 2단계 오픈 검증 추가 |
| `rev19-back-stack` ×1 | M2.3 오픈 제스처 + M3.1 뉴스 모달 삭제 | 제목 2단계로 구동, 뉴스 모달 부재를 가드로 추가 |
| `rev19-search-back` ×2 | M2.4 3단 꼬리 + M5 엔터 강조 하향 | 새 계약으로 재작성 |

추가로 재실행 과정에서 **REV-21 §1A 레일 드래그 프레임 예산 초과**를 포착했다
(드래그 p95 오버헤드 +33.3ms, 예산 +25ms). 원인은 내가 넣은 뉴스 축 자동
회전이 9초마다 `/api/live/axis-news`를 호출한 것이었다 — 프레임 예산 위반이자
제1장 한계 비용 0원 위반. 자동 회전이 **당일 피처드 보드가 이미 커버하는 축만
순회**하도록 바꿔 무비용화했고, 라이브 와이어는 방문자가 축을 직접 고를 때만
호출한다. 재측정 **+16.6ms (예산 내), 4/4 통과.**

잔여 2건(`cinema-flow` ENTER 오디오, `rev21-hub-card` country-only 스코프)은
**개별 재실행에서 10/10 통과** — 라이브 데이터/머신 부하에 의존하는 타이밍
플레이크이며, 두 차례 완주에서 서로 다른 조합이 흔들렸다.

---

## 8. 라이브 실측 (배포 후, `www.theunitas.global`)

배포 커밋 `4879b45` = 라이브 `ownership-manifest.json`의 `gitCommit` 일치.

| 검사 | 결과 |
|---|---|
| 사람 → `/`, `/ko`, `/ko/company/about`, `/u-ai` | **307 → `/<locale>/gateway`, `x-unitas-gate: seal`** (전부) |
| 봉인 응답 본문 | gateway 마커 1 · **검색바 0 · 히어로 0** |
| Googlebot → `/` | **200, `pass`**, 히어로 1 |
| `/sitemap.xml` | 200, **`<loc>` 340개** (REV-22 규모 그대로) |
| `/robots.txt` | 200, 5,539B |
| `/sovereign` (쿠키 없음) | **404** — 소버린 펜스 정상 |

---

## 9. 후속 과제

1. **U-COIN 번 표면** — §2.2의 창립자 확인 요청. U-AI 유료 티어를 다시 세울지,
   코인 경제를 모듈 게이트로 단일화할지 결정 필요.
2. **WDQS 복구 시** — `awardsThemes`를 SPARQL 경로로 되돌리면 "최신 수상자"가
   근사치가 아니라 전역 최댓값이 된다(현재는 "가장 널리 기록된 50인 중 최신").
   카드에 그 한계를 명시해 두었다.
3. **`gateway` 경로명** — Next는 `_` 접두 폴더를 라우팅에서 제외하므로
   `__gateway`를 쓸 수 없었다. 더 은닉된 이름을 원하시면 상수 한 곳
   (`GATE_PATH_SEGMENT`)만 바꾸면 된다.
4. **WebKit/모바일 E2E** — chromium 전 스위트 실행 결과를 본 보고서 갱신 시 반영.
