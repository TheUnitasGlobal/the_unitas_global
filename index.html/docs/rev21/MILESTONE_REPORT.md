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
