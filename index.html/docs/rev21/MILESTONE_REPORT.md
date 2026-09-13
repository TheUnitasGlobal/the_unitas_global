# REV-21 마일스톤 보고서 (Codex v23.0 제23장 중간 결과물 영구 보존 독트린 산출물)

> 이 파일은 터미널 스크롤백과 함께 증발하던 중간 검증 수치를 디스크에 고정하기 위한 강제 기록(Flush) 대상이다.
> 규칙: 세이프티 브레이크 발동(누적 70k 초과 또는 대규모 마일스톤 완결) 시 반드시 여기에 먼저 수치를 쓴 뒤
> 지정된 브레이크 문구를 정확히 출력한다. 각 항목은 **실측한 세션에서 실측한 값만** 기록한다.

---

## REV-21 PHASE 2 — M1~M10 완결 (2026-09-13)

정본 스펙: `docs/rev21/SPEC.md` (§12 = 창립자 v2 지령 부록, §1~§11을 override)

| 항목 | 값 | 실측 시점 |
| --- | --- | --- |
| 최종 커밋 | `587db69` (M10c) | 2026-09-13 |
| M10 구성 | M10a `f2d5388`(인피니티 스트림 2단계 11종, D-37) · M10b `635ae6e`(스코프 섹션·held-on-close·터치 일시정지·rail-drag/히트박스 E2E) · M10c `587db69`(전수 E2E 게이트 복구) | — |
| `tsc --noEmit` | EXIT 0 | 2026-09-13 세션 |
| `vitest` | 75 파일 / 1122 테스트 전부 통과, EXIT 0 | 2026-09-13 세션 |
| `next build` | EXIT 0, 784 페이지, sync-codex drift 0 | 2026-09-13 세션 |
| Playwright (chromium + mobile-chrome) | **228 passed / 0 failed / 2 skipped** (230, 17.4분), EXIT 0 | 2026-09-13 세션 |
| origin push | `ff752d6..587db69` | 2026-09-13 |
| Vercel 프로덕션 | VERCEL_EXIT 0 — 라이브 `gitCommit 587db69dc049…`, `buildFingerprint 632c59de6817b47c…` 로컬과 일치, `/ko` 308 → www 200 | 2026-09-13 |

**정직 표기 (미검증 항목을 완료로 보고하지 않기 위한 명시):**
- `rev21-footer-links.spec.js:204` F-2 프리하이드레이션 경로는 조건부 자가 스킵으로 **해당 실행에서 미검증**. 메커니즘 자체는 vitest `siteLinkBootstrap.test.ts`가 커버한다.
- webkit 프로젝트는 M10 지령 범위(chromium / mobile-chrome) 밖이라 **실행하지 않았다**.
- 전수 스위트 최초 실행의 실패 20건은 **전부 낡은 테스트였고 제품 회귀는 0건**이었다(M5b가 `[data-discovery-links]`를 ExploreDeeper로 대체, M6이 §4.3 단일 블러 예산으로 푸터 blur 제거, M7의 `.qw-attach-close`가 구조 기반 sealed-X 로케이터를 가림). 교훈: **E2E 로케이터는 구조가 아니라 `data-*` 훅으로 고정한다.**

---

## Codex v23.0 각인 완결 (2026-09-13, 커밋 `c672a10`)

| 항목 | 값 |
| --- | --- |
| 루트 각인 커밋 | `8ecd592` (정본 3파일만 갱신) |
| 잔여 개정 커밋 | `c672a10` (사본 4 + 요약본 6 + 아티팩트) |
| 정규화 canon sha256 | `02cd3339d456862e…` → **`128545a5ef16e594…`** |
| 1000대 초-헌법 감사 | **1000/1000**, 슬롯 1..1000 누락 0 · 중복 0 |
| 장 구성 | 제1~24장 (구 제21장 멀티 모델 페일오버 독트린 삭제 → 제22~25장이 제21~24장으로 당겨짐) |
| sync-codex | drift=0, PASS 4/4 |
| `tsc --noEmit` | EXIT 0 |
| `vitest` | 75 파일 / 1122 테스트, EXIT 0 |
| `next build` | EXIT 0, 지문 `632c59de6817b47c` **불변** |
| 배포 | 불필요 — 독트린 파일은 web 자산이 아니므로 라이브 산출물 무변경(지문 동일로 증명) |

**복구한 결함:** `8ecd592`가 루트 정본 3파일만 갱신하고 운영 사본 4개를 v20.0(`02cd3339…`)에 남겨, `web/package.json`의 `prebuild`에 물린 `sync-codex.mjs`가 4/4 FAIL → **로컬 프로덕션 빌드가 fail-closed로 차단된 상태**였다. Vercel은 ENOENT 폴백으로 사본끼리만 대조하므로 통과한다 — 배포 성공만으로 안심하면 놓친다.

**v23.0 실제 개정 3건:** ① 구 제21장 삭제 + 제22~24장 전면 재작성(제23장에 이 파일 강제 Flush 규칙과 정확한 브레이크 문구, 제24장에 [최종 완결 종합 보고서] 규칙 신설) ② 1000대 리스트 오탈자 3슬롯 교정(`194.초고속파이적`→`초고속파이프적`, `558.초만류인력중력장적`→`…장포스적`, `559.초삼강오륜기강적`→`…기강퍼펙트적`) ③ 버전 표기.

---

## REV-21 최종 프로덕션 배포 완결 (2026-09-13, 창립자 배포 승인 집행)

정본 종합 보고서: `docs/rev21/FINAL_REPORT.md` (제24장 산출물)

| 항목 | 값 | 실측 시점 |
| --- | --- | --- |
| 배포 커밋 | `05c5cfb` (= HEAD, origin/main과 ahead 0 / behind 0) | 2026-09-13 |
| 배포 ID | `dpl_HCyahZw3K4681MLXxM7PzoxDLJEx`, readyState `READY` | 2026-09-13 |
| 알리아스 | `www.theunitas.global` · `theunitas.global` 전환 완료 | 2026-09-13 |
| `tsc --noEmit` | EXIT 0 (11.3s) | 배포 직전 재실측 |
| `vitest` | 75 파일 / 1122 테스트 통과, EXIT 0 (18.8s) | 배포 직전 재실측 |
| `next build` | EXIT 0 (132.1s), 지문 `632c59de6817b47c…`, sync-codex drift 0 | 배포 직전 재실측 |
| Playwright (chromium + mobile-chrome) | **228 passed / 0 failed / 2 skipped (230), EXIT 0, 17.0분** | **배포한 프로덕션 빌드 위에서 재실측** |
| 라이브 `gitCommit` | `05c5cfb5ae6ccab2…` — 로컬 HEAD와 일치 | 배포 직후 HTTPS 실호출 |
| 라이브 `buildFingerprint` | `632c59de6817b47cda7b…` — 로컬 빌드와 일치 | 배포 직후 HTTPS 실호출 |
| 라이브 20로케일 | **20 / 20 HTTP 200, 실패 0건** | 배포 직후 HTTPS 실호출 |
| 소버린 IP 헤더 | `X-Unitas-Owner` / `X-Unitas-License` 라이브 응답에 존재 | 배포 직후 HTTPS 실호출 |

**스코프 정정**: 창립자 지침 원문 `--scope the-unitas-global-ou-ei` → `vercel teams ls` 실측상 정본은
`the-unitas-global-ou-e`(말미 `i` 없음). 검증된 슬러그로 집행했다.

**새로 발견한 갭**: `/sitemap.xml`·`/robots.txt`가 라이브 404이고 소스에도 부재(0건) — 제12장 익스트림 SEO 미충족.
상세와 권고는 `FINAL_REPORT.md` §7-1.

---

## REV-22 완결 — REV-21 잔여 3대 갭 격파 (2026-09-13)

정본 설계: `docs/rev22/SPEC.md` · 정본 종합 보고서: `docs/rev22/FINAL_REPORT.md` (제24장 산출물)

| 항목 | 값 | 실측 시점 |
| --- | --- | --- |
| 배포 커밋 | `1d9082b` (`425bd89..1d9082b main -> main`) | 2026-09-13 |
| 배포 ID | `dpl_GUN8h3pnhadb7cgti8cXuBsbXK2Z`, readyState `READY`, target `production` | 2026-09-13 |
| `tsc --noEmit` | EXIT 0 | 이번 세션 |
| `vitest` | **76 파일 / 1,145 테스트** 통과, EXIT 0 (신규 SEO 스위트 23건 포함) | 이번 세션 |
| `next build` | EXIT 0 — 앱 경로 52 → **54**, 프리렌더 420 → **422**, sync-codex drift 0 | 이번 세션 |
| Playwright (chromium + **webkit** + mobile-chrome) | **328 passed / 0 failed / 17 skipped (345), EXIT 0, 54.9분** | 배포한 빌드 위에서 실측 |
| 라이브 `gitCommit` | `1d9082b0f41be1cf…` — 푸시 커밋과 일치 | 배포 직후 HTTPS 실호출 |
| 라이브 `buildFingerprint` | `632c59de6817b47cda7b…` — 로컬 빌드와 일치 | 배포 직후 HTTPS 실호출 |
| 라이브 20로케일 | **20 / 20 HTTP 200** | 배포 직후 HTTPS 실호출 |

**갭 격파 결과 (직전 대비):**

| 갭 | 배포 전 | 배포 후 |
| --- | --- | --- |
| G-1 제12장 SEO | `/sitemap.xml` 404 · `/robots.txt` 404 · 소스 0건 | `/sitemap.xml` **200, 340 URL / 7,140 hreflang, 751,782 B** · `/robots.txt` **200, 6블록(`*`+Googlebot+Googlebot-Image+Bingbot+Yeti+Daumoa), 4,757 B** |
| G-2 U-COIN 환불 스키마 | `migration list` 19/20 | **20/20 local == remote** (`refund_coins` ACL `service_role` 전용 실측 확인) |
| G-3 WebKit 미실행 | 0건 실행 | **115/115 실행, 실패 0** |

**부수 발견 및 수복 (사이트맵의 전제 조건):** REV-21 프로덕션은 `/ko/legal/terms`가
`canonical=https://www.theunitas.global/ko`를 선언하고 있었다. Next 메타데이터의 얕은 병합 때문에
`alternates` 미선언 서브페이지가 로케일 레이아웃의 루트 canonical을 상속한 결과로,
**320개 서브페이지가 "20개 홈의 중복"이라고 자기 신고**하던 상태였다. 사이트맵만 추가했다면
제출 340건 중 320건이 색인에서 제외됐을 것이다. 전 색인 대상 페이지에 자체 canonical +
21개 hreflang을 부여하고, 비색인 라우트에는 `robots: noindex, nofollow`를 3중으로 걸어 수복했다.

**정직 표기:**
- WebKit 스킵 15건은 전부 스펙 내부 조건부 `test.skip()`이며 **제품 결함이 아니고 이번 개정이
  만든 것도 아니다** — 헤드리스 WebKit의 WebGL 컨텍스트 손실(6) · Web Audio 오토플레이 정책(5) ·
  드래그 관성/60fps 계측(2) · 설치형 App 콜드 재기동(1) · 프리하이드레이션 F-2(1).
  R3F에 `webglcontextlost` 핸들러를 붙이면 6건 회수 가능(REV-23 후보).
- `migration repair`는 auto-mode 분류기가 `[Production Deploy]`로 1차 차단 → **창립자 승인 후 실행**.
- 검색 엔진 색인은 사이트맵 존재만으로 시작되지 않는다. Google Search Console / Bing Webmaster /
  네이버 서치어드바이저 **수동 제출 + 소유 확인**이 남아 있으며, 확인 토큰은 창립자만 발급 가능하다.
- WebKit 전수 1차 실행은 `| tail` 파이프 버퍼링으로 진행 상황이 보이지 않아 35분 지점에서
  정지로 오판해 중단시켰다(당시 103/115, 실패 0). 교훈: **장시간 백그라운드 실행은 파이프가 아니라
  파일 리다이렉션으로 로그를 남긴다.**

---

## SEO-GSC — 구글 서치 콘솔 소유권 인증 각인 (2026-09-13, 창립자 지령)

**배경:** 바로 위 REV-22 항목의 "정직 표기" 마지막에서 남겨 둔 개방 과제 —
*"검색 엔진 색인은 사이트맵 존재만으로 시작되지 않는다 … 소유 확인 토큰은 창립자만 발급 가능하다"* —
중 **구글 절반이 닫혔다.** 창립자가 서치 콘솔에서 HTML 태그 토큰을 발급해 하달했다.

**설계 판단 (토큰을 어디에 두는가):**

| 선택지 | 채택 | 사유 |
| --- | --- | --- |
| `app/layout.tsx` JSX `<head>`에 `<meta>` 직접 삽입 | ✗ | Next 공식 문서가 루트 레이아웃의 수동 `<head>` 태그를 **비권장**으로 명시 — 메타데이터 태그의 중복 제거·스트리밍을 Next가 소유한다 (Context7 실조회 확인) |
| `metadata.verification.google` (Metadata API) | **✓** | 동일한 `<meta name="google-site-verification">`를 Next가 직접 렌더 |
| 토큰 리터럴을 레이아웃에 인라인 | ✗ | 소유권과 사이트맵은 **한 개의 사실**이다 |
| 토큰을 `lib/seo/routes.ts`에 상수로 | **✓** | `SITE_URL` / `SITEMAP_URL` / robots 지시어 옆 — REV-22가 세운 SEO 단일 정본 유지 |

**전 페이지 상속의 근거:** Next 메타데이터 병합은 **얕다** — 자식은 자신이 선언한 필드만 교체한다.
`app/` 아래 어떤 라우트도 `verification`을 선언하지 않으므로(전수 grep 확인), 태그는 홈 1장이 아니라
**전 페이지에 상속**된다. REV-22에서 320개 서브페이지의 canonical을 조용히 파괴했던 바로 그 병합
의미론이, 이번에는 우리 편에서 작동한다. 이 전제가 무너지면 즉시 깨지도록 회귀 테스트 2건으로 고정했다.

**4대 게이트 실측 (전부 EXIT 0):**

| 게이트 | 결과 |
| --- | --- |
| `tsc --noEmit` | **EXIT 0** |
| `vitest run` | **76 파일 / 1147 테스트 통과** (직전 1145 → 신규 2건 추가) |
| `next build` | **EXIT 0** (postbuild 지문 `632c59de6817b47c…`) |
| 빌드 산출물 실측 | **사전렌더 421개 HTML 전수 각인, 누락 0**, 문서당 렌더된 `<meta>` 정확히 1개 |

**라이브 실측 (배포 후 HTTPS 실호출):**

| 항목 | 실측값 |
| --- | --- |
| 배포 | `dpl_7E2Burcx7hVzYzzG9gG6vSust94v` READY (production) |
| 라이브 `gitCommit` | `d461c7b6679c132e…` — 푸시 커밋과 일치 |
| 라이브 `buildFingerprint` | `632c59de6817b47c…` — 로컬 빌드와 일치 |
| 20로케일 루트 | **20 / 20 HTTP 200, 20 / 20 태그 각인** (누락·중복 0) |
| 서브페이지 표본 | `/u-ai` `/ko/u-ai` `/legal/terms` `/ko/company/about` 전부 200 + 태그 1 |
| REV-22 회귀 | `/sitemap.xml` 200 · **340 URL**, `/robots.txt` 200 · **6블록 + Sitemap 1행** — 무손상 |

**정직 표기:**
- 검증 중 `/ar/support/contact` 404를 결함으로 의심했으나 **오탐**이었다. `ar`(아랍어)는 지원 20로케일
  (`en ko et ja zh es km fr de pt vi id ru hi it tr th pl nl tl`)에 **없다**. 사이트맵도 `/ar/` URL을
  0건 광고하므로 404가 정상 동작이다. 같은 확인 중 배포 URL이 반환한 200은 앱이 아니라
  **Vercel Deployment Protection SSO 로그인 페이지**였다 — 배포 URL 직접 호출은 검증 근거로 쓸 수 없다.
- 태그 존재는 **소유권 확인의 필요조건일 뿐 충분조건이 아니다.** 서치 콘솔에서 창립자가
  **[확인] 버튼을 눌러야** 소유권이 성립하고, 그 다음에야 `/sitemap.xml` 제출이 가능하다.
  이 두 동작은 창립자 계정에서만 가능하며 코드로 대행할 수 없다.
- **Bing Webmaster Tools / 네이버 서치어드바이저 토큰은 여전히 미발급 상태다.** 발급되면
  `lib/seo/routes.ts`에 같은 방식으로 각인하고 `metadata.verification`에 `other` 필드로 확장한다.

---

## SEO-NAVER — 네이버 서치어드바이저 소유권 인증 각인 (2026-09-13, 창립자 지령)

**배경:** 바로 위 SEO-GSC 항목이 남긴 개방 과제 중 **네이버 몫이 닫혔다.** 제12장이 지목한
3대 콘솔(구글·네이버·빙) 가운데 두 번째다. REV-22가 robots.txt에 이미 `Yeti` 전용 블록을
세워 두었으므로, 소유권 확인이 그 블록을 실제 색인으로 전환하는 마지막 스위치다.

**하달 명령을 그대로 실행하지 않은 이유 (결함 4건):**

| # | 하달된 형태 | 실제 결과 |
| --- | --- | --- |
| 1 | `verification: { naver: '…' }` | Next 14.2.35 `Verification` 타입은 정확히 `{ google, yahoo, yandex, me, other }` (`next/dist/lib/metadata/types/metadata-types.d.ts:92`). `naver` 필드는 **없다** — 조용히 무시되는 키가 아니라 **`tsc` 컴파일 에러** |
| 2 | `.Replace('metadata = {', …)` | 같은 객체 리터럴에 **두 번째 `verification:` 키**를 덧붙인다. 중복 프로퍼티 에러이며, 설령 컴파일됐다면 나중 키가 이겨 **전날 각인한 구글 토큰이 조용히 소거**된다 |
| 3 | 멱등 가드 `-notmatch 'naver-site-verification'` | 삽입 문자열은 `naver: '…'`라 가드 문자열을 포함하지 않는다 → **재실행마다 중복 삽입 누적** |
| 4 | `Set-Content -Encoding utf8` | Windows PowerShell 5.1에서 이 옵션은 **BOM을 붙인다**. `layout.tsx`는 BOM이 없으며, BOM은 이 저장소에서 반복 사고를 낸 함정이다 |

**집행한 형태:** 토큰을 `verification.other`에 **리터럴 meta 이름**으로 선언 —
`other: { 'naver-site-verification': NAVER_SITE_VERIFICATION }`. Next는 `other`의 키를
그대로 `<meta name>`으로 렌더한다. 토큰 정본은 `lib/seo/routes.ts`의
`NAVER_SITE_VERIFICATION`(= `GOOGLE_SITE_VERIFICATION` / `SITE_URL` / `SITEMAP_URL` 옆).
부수 효과로 `layout.tsx`에 `naver-site-verification` 문자열이 실재하게 되어, **하달 명령을
그대로 재실행해도 가드가 정상 작동해 무해하게 통과**한다.

**회귀 테스트 4건:** 토큰 값 · 40자 소문자 hex 형식 · 두 콘솔 토큰의 비동일성(한쪽이 다른
쪽 토큰을 가리키면 양쪽 모두 "존재함"으로 읽히고 **양쪽 다 확인 실패**한다) ·
`verification: {` 출현 **정확히 1회**(위 결함 2의 실패 양식을 영구 차단).

**4대 게이트 실측 (전부 EXIT 0):**

| 게이트 | 결과 |
| --- | --- |
| `tsc --noEmit` | **EXIT 0** — `verification.other` 형태의 타입 적합성 증명 |
| `vitest run` | **76 파일 / 1149 테스트 통과** (1147 → 신규 2건) |
| `next build` | **EXIT 0** |
| 빌드 산출물 | **사전렌더 421 HTML 전수 — 구글 421/421 · 네이버 421/421**, 누락 0, 문서당 각 `<meta>` 정확히 1개 |

**라이브 실측 (배포 후 HTTPS 실호출):**

| 항목 | 실측값 |
| --- | --- |
| 커밋 | `89ac830` → origin/main 푸시 완료 |
| 배포 | `the-unitas-global-obe92qrv7` (production) |
| 라이브 `gitCommit` | `89ac830e50197a3c…` — 푸시 커밋과 일치 |
| 라이브 `buildFingerprint` | `632c59de6817b47c…` — 로컬 빌드와 일치 |
| 20로케일 루트 | **20/20 HTTP 200 · 구글 20/20 · 네이버 20/20** |
| 서브페이지 표본 | `/u-ai` `/ko/u-ai` `/legal/terms` `/ko/company/about` `theunitas.global/` 전부 200 + 두 태그 각 1 |
| REV-22 회귀 | `/sitemap.xml` 200 · **340 URL**, `/robots.txt` 200 · **6블록 + Sitemap 1행** — 무손상 |

**정직 표기:**
- 작업 중 유닛 테스트 1건이 실패했다. 원인은 제품이 아니라 **내가 작성한 테스트**로,
  패치 스크립트의 정규식이 셸을 거치며 백슬래시를 잃어 `/^s*verification: {/`로 기록됐다.
  정규식을 문자열 카운트(`split(…).length - 1`)로 대체해 재발 여지를 제거했다.
  **교훈: 힙독 경유 패치 스크립트에는 정규식 리터럴을 넣지 않는다.**
- **태그 각인은 필요조건일 뿐이다.** 구글 서치 콘솔과 네이버 서치어드바이저 양쪽에서
  **창립자가 [소유확인] 버튼을 눌러야** 소유권이 성립하고, 그 다음에야 `/sitemap.xml`(340 URL)
  제출이 가능하다. 두 동작 모두 창립자 계정 전용이다.
- **빙 웹마스터 도구 토큰은 여전히 미발급.** 발급 시 `verification.other`에 같은 방식으로
  `'msvalidate.01'` 키를 추가하면 된다 — 구조 변경 없이 한 줄.

---

## SEO-YANDEX — 얀덱스 웹마스터 소유권 인증 + YandexBot 크롤 정합 (2026-09-13, 창립자 지령)

**배경:** 제12장이 지목한 3대 콘솔(구글·네이버·빙) 밖의 **자발적 확장**이다. 지원 20로케일에
`ru`가 있으므로 동유럽·중앙아시아 검색 시장을 비워 둘 이유가 없다는 창립자 판단.

**첫 지령은 토큰 없이 하달되어 집행하지 않았다.** 임의 값을 넣으면 `tsc`·`build`·배포까지 전부
EXIT 0으로 통과하고 **소유확인 버튼에서만 조용히 실패**한다 — 저장소 어디에도 오류가 남지 않는
실패 양식이라, 추정 대신 토큰을 요청했다. 창립자가 `d742cced34827f97`을 하달하며 집행.

**네이버와 다른 점 (구조적):** 얀덱스는 Next `Verification` 타입의 **일급 필드**다
(`yandex?: null | string | number | (string|number)[]`, `metadata-types.d.ts:95`).
따라서 네이버가 필요로 했던 `verification.other` 우회가 불필요하며, `verification.yandex`
한 줄이 곧바로 `<meta name="yandex-verification">`을 렌더한다.

**YandexBot 크롤 정합 (창립자 승인):** 소유권만 세우고 robots.txt가 그 엔진의 크롤러를
전혀 호명하지 않으면 **선언과 크롤 지시어가 서로 다른 말을 하게 된다.** `NAMED_CRAWLERS`에
`YandexBot`을 합류시켜 6블록 → **7블록**. 명명 블록은 `*` 블록을 **대체**하므로 payload
재진술이 필수이며, 로컬 프로덕션 서버와 라이브 양쪽에서 **7블록 × 39 disallow** 실측 확인.

**4대 게이트 실측 (전부 EXIT 0):**

| 게이트 | 결과 |
| --- | --- |
| `tsc --noEmit` | **EXIT 0** |
| `vitest run` | **76 파일 / 1150 테스트 통과** (1149 → 신규 1건, 기존 1건 승격) |
| `next build` | **EXIT 0** |
| 빌드 산출물 | 사전렌더 **421 HTML 전수 — 구글 421/421 · 네이버 421/421 · 얀덱스 421/421**, 누락 0, 문서당 각 1개 |

**라이브 실측 (배포 후 HTTPS 실호출):**

| 항목 | 실측값 |
| --- | --- |
| 커밋 | `63ede66` → origin/main |
| 배포 | `the-unitas-global-22wrl3eqg` (production) |
| 라이브 `gitCommit` | `63ede661e1a2c7fe…` — 푸시 커밋과 일치 |
| 라이브 `buildFingerprint` | `632c59de6817b47c…` — 로컬 빌드와 일치 |
| 20로케일 루트 | **20/20 HTTP 200 · 구글 20/20 · 네이버 20/20 · 얀덱스 20/20** |
| 라이브 `/robots.txt` | **7블록**(`*`+Googlebot+Googlebot-Image+Bingbot+Yeti+Daumoa+**YandexBot**) · 각 39 disallow · Sitemap 1 · Host 1 · 5,539 B |
| 라이브 `/sitemap.xml` | **340 URL** 무손상 |
| 서브페이지 표본 | `/ru` `/ru/u-ai` `/legal/terms` `theunitas.global/` 전부 200 + 3태그 각 1 |

**회귀 테스트 승격:** 기존 2자 비동일성 검사를 **3자 집합 크기 검사**로 승격했다 —
한 콘솔이 다른 콘솔의 토큰을 가리키면 양쪽 모두 "존재함"으로 읽히고 **양쪽 다 확인 실패**한다.
콘솔이 늘수록 이 실패 양식의 확률이 커지므로 집합 검사가 정본이다.

**정직 표기:**
- **3개 콘솔 모두 태그 각인은 끝났으나, 소유권은 아직 성립하지 않았다.** 구글·네이버·얀덱스
  각 콘솔에서 **창립자가 [소유확인]을 눌러야** 하며, 그 다음에야 `/sitemap.xml` 제출이 가능하다.
- **빙 웹마스터 토큰만 미발급.** 발급 시 `verification.other`에 `'msvalidate.01'` 한 줄이면
  끝난다 — `Bingbot` 블록은 REV-22부터 이미 서 있다.
- 3대 콘솔 지령(제12장) 대비 현재 상태: 구글 ✓ · 네이버 ✓ · 빙 ✗(토큰 대기) · 얀덱스 ✓(초과 달성).

---

## SEO-BING — 빙 웹마스터 소유권: 메타 태그 불필요 확정 (2026-09-13, 창립자 실측 보고)

**결론: 빙은 코드 변경 없이 완결된다.** 직전 SEO-YANDEX 항목이 남긴 "빙 토큰 미발급,
`verification.other['msvalidate.01']` 한 줄 대기"는 **사실이 아니며 이 항목이 이를 폐기한다.**

**창립자 실측:** 빙 웹마스터 대시보드의 CONFIGURATION 하위에 Crawl Control / Block URLs만
노출되고 독립 소유권 확인 메뉴가 뜨지 않는다. 이유는 **구글 서치 콘솔 계정 연동(Import)으로
이미 소유권이 통과**되었기 때문이다. 빙은 GSC에서 이미 검증된 속성을 가져올 때 자체 검증
레코드를 생성하므로 별도 메타 태그를 발급하지 않는다.

**저장소에 미치는 영향: 없음.**
- `verification`에 추가할 항목 없음 — 빙은 4대 콘솔 중 **유일하게 코드를 한 줄도 요구하지 않는다.**
- `NAMED_CRAWLERS`의 `Bingbot` 블록은 REV-22부터 이미 존재하며 **소유권 방식과 무관하게
  유효하다** — robots 지시어는 크롤러에게 말하는 것이고, 소유권은 콘솔에게 말하는 것이다.
- 따라서 게이트 재실행도 배포도 불필요. 라이브는 `63ede66` 그대로 정상.

**파생 사실 (중요):** 빙의 GSC 연동은 **구글 속성이 이미 검증된 경우에만** 가져올 수 있다.
빙 등록이 통과했다는 것은 곧 **구글 서치 콘솔 소유권이 이미 성립했다**는 뜻이다.

**4대 콘솔 최종 현황판:**

| 콘솔 | 배선 | 소유권 |
| --- | --- | --- |
| 구글 | `verification.google` | ✓ (빙 연동 성공이 곧 증거) |
| 네이버 | `verification.other['naver-site-verification']` | 창립자 [소유확인] 클릭 대기 |
| 얀덱스 | `verification.yandex` | 창립자 [소유확인] 클릭 대기 |
| 빙 | **코드 없음 — GSC 연동 상속** | ✓ |

**남은 것은 소유권이 아니라 제출이다.** 소유 확인과 사이트맵 제출은 별개 동작이며,
340개 URL의 색인은 각 콘솔에 `/sitemap.xml`이 등록되어야 개시된다. 빙의 경우 GSC 연동이
사이트맵까지 함께 가져왔는지 **빙의 Sitemaps 섹션에서 별도 확인이 필요**하다.

---

## SEO-SUBMIT — 4대 콘솔 소유권 전부 성립 · 제출 직전 라이브 적격성 실측 (2026-09-13)

**창립자 보고:** 네이버·얀덱스 [소유확인] 클릭 완료. 구글은 빙 GSC 연동 성공이 증거,
빙은 그 연동으로 상속. **4대 콘솔 소유권 전부 성립 — 저장소 측 인증 공사 완결.**

**제출 직전 실측을 한 이유:** 소유권과 색인은 별개다. 사이트맵에 실린 URL이 리디렉션되거나
자기 자신이 아닌 canonical을 선언하면, 제출은 성공하고 **색인 단계에서 "Page with redirect" /
"Duplicate, submitted URL not selected as canonical"로 조용히 배제**된다. REV-21이 실제로
이 상태였다(320페이지). 제출 전에 잡는 것이 가장 싸다.

| 검사 | 결과 |
| --- | --- |
| XML 적격성 | well-formed, 네임스페이스 `sitemaps.org/schemas/sitemap/0.9` |
| `<url>` 수 | **340** |
| `lastmod` / `priority` / `changefreq` | **340 / 340 / 340** (전수 보유) |
| `xhtml:link` alternates | **전 URL 정확히 21개** (20 로케일 + x-default), min=max=21 |
| 중복 `<loc>` | **0** |
| 비-HTTPS·타 호스트 | **0** |
| 표본 25개 URL 직접 호출 | **200 = 25 / 리디렉션 0 / 오류 0** (`-L` 미사용, 리디렉션 검출 목적) |
| 자기 canonical | `/ko/legal/terms` `/ja/u-pay` `/es/company/careers` 전부 **자기 URL 선언** (REV-21 결함 미재발) |
| 사이트맵의 비공개 경로 | `sovereign` **0건**, `locked` **0건** |
| `/ko/locked` robots | `noindex, nofollow` |
| 엔드포인트 | `/sitemap.xml` 200 `application/xml` 751,782 B · `/robots.txt` 200 `text/plain` 5,539 B |

**정직 표기 — 측정 실패 2회와 그 원인:** 표본 검사 1·2차에서 전 URL이 `HTTP 000`으로 나와
장애를 의심했으나, **사이트가 아니라 측정 도구의 결함**이었다. Python이 Windows 텍스트 모드로
URL 목록 파일을 쓰면서 각 줄 끝에 `\r`을 붙였고, 그것이 URL 끝에 딸려 들어가
`curl: (3) URL rejected: Malformed input to a URL function`을 유발했다. 1차에서는 curl이
에러 문구를 삼켜 `000`만 보였기 때문에 "연결 고갈"로 오진했다.
**교훈 두 가지: (1) Windows에서 파일을 쓸 때는 `newline=''`를 명시할 것 — 이 저장소는 파일마다
줄바꿈이 달라 이미 여러 차례 사고를 냈다. (2) `curl -s`는 에러를 숨긴다. 배치 검증에는
반드시 `-sS`를 써서 실패 사유를 보이게 할 것 — `000`을 HTTP 응답으로 오독하면 존재하지 않는
장애를 보고하게 된다.** 교정 후 25/25 200.

**남은 것은 전부 창립자 콘솔 동작이며 코드로 대행 불가:**
1. 구글 서치 콘솔 — 사이트맵 제출
2. 빙 — GSC 연동이 사이트맵까지 가져왔는지 Sitemaps 섹션 확인 (누락 시 수동 제출)
3. 네이버 서치어드바이저 — 사이트맵 제출
4. 얀덱스 웹마스터 — 사이트맵 제출

제출 URL은 4곳 모두 동일: `https://www.theunitas.global/sitemap.xml`
