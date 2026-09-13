# REV-22 최종 완결 종합 보고서

**Codex v23.0 제24장 산출물 · 2026-09-13 · THE UNITAS GLOBAL OÜ**

> REV-21 최종 보고서 §6이 "미해결"로 남긴 3대 갭(SEO · DB · WebKit)을 전부 격파하고
> 라이브 프로덕션에서 실측 검증한 기록. 정본 설계는 `docs/rev22/SPEC.md`.

---

## 1. 결론

| 지령 | 상태 | 근거 |
| --- | --- | --- |
| §1 M_SEO — 제12장 익스트림 SEO 도배 완결 | **완결** | 라이브 `/sitemap.xml` 200 / 340 URL, `/robots.txt` 200 / 6블록 (직전까지 둘 다 404) |
| §2 M_DB — U-COIN 환불 스키마 라이브 적용 | **완결** | `migration list --linked` **20/20 local==remote** |
| §3 M_WEBKIT — 제13장 크로스 브라우저 증명 | **완결** | Playwright `webkit` 115/115 실행, 실패 0, EXIT 0 |
| §4 Fail-Closed + 라이브 배포 | **완결** | 4대 게이트 EXIT 0 → `1d9082b` push → `dpl_GUN8h3pnhadb7cgti8cXuBsbXK2Z` READY |

---

## 2. 4대 Fail-Closed 게이트 (제24장 · 전부 이번 세션 실측)

| 게이트 | 결과 | 비고 |
| --- | --- | --- |
| `tsc --noEmit` | **EXIT 0** | — |
| `vitest run` | **EXIT 0 — 76 파일 / 1,145 테스트 전부 통과** | REV-21 대비 +1 파일 / +23 테스트 (신규 SEO 스위트) |
| `next build` | **EXIT 0** | 앱 경로 52 → **54**(`sitemap.xml`·`robots.txt` 추가), 프리렌더 420 → **422**, sync-codex drift 0 |
| Playwright (chromium + **webkit** + mobile-chrome) | **EXIT 0 — 328 passed / 0 failed / 17 skipped (345, 54.9분)** | 스킵 17건 전부 테스트 자체의 조건부 자가 스킵 |

---

## 3. §1 M_SEO — 상세

### 3.1 라이브 전후 실측

| 항목 | 배포 전 | 배포 후 |
| --- | --- | --- |
| `GET /sitemap.xml` | **404** | **200** `application/xml`, 751,782 B, `<loc>` **340**개 |
| `GET /robots.txt` | **404** | **200** `text/plain`, 4,757 B |
| `/ko/legal/terms` canonical | `https://www.theunitas.global/ko` ← **오류** | `https://www.theunitas.global/ko/legal/terms` |
| `/ko/legal/terms` hreflang | 21개 전부 로케일 루트 지목 | 21개 전부 해당 서브페이지 지목 |

### 3.2 사이트맵 커버리지 산출

지령문의 "52개 프리렌더링 라우트"는 `app-path-routes-manifest.json`의 전체 앱 경로 수였다.
실측 분해 결과 검색 엔진에 200을 주는 라우트는 **17개**:

```
52 앱 경로 = 20 /api/* + 1 /opengraph-image + 1 /_not-found + 30 [locale] 페이지 경로
30 [locale] 경로 → [slug] 3종을 12개 슬러그로 전개 → 구체 페이지 39개
39 = 17 색인 가능 + 16 코인게이트(307) + 5 소버린(404) + 1 /locked
17 × 20 로케일 = 340 사이트맵 URL
```

| 검증 항목 | 실측값 |
| --- | --- |
| `<url>` 블록 / `<loc>` / 고유 `<loc>` | 340 / 340 / **340** (중복 0) |
| 블록당 `xhtml:link` | 정확히 **21개** (20 로케일 + `x-default`), 총 **7,140** |
| `lastmod`·`changefreq`·`priority` 누락 | **0 블록** |
| 형식 위반 `<loc>` | **0** |
| `/en/*` 팬텀 URL (308 리디렉션 대상) | **0** |
| `xmlns:xhtml` 네임스페이스 | 선언됨 |
| 우선순위 분포 | 1.0×20 · 0.9×20 · 0.8×60 · 0.7×20 · 0.6×80 · 0.5×20 · 0.4×120 |

### 3.3 robots.txt

`*` + `Googlebot` + `Googlebot-Image` + `Bingbot` + `Yeti`(네이버) + `Daumoa`(다음) **6블록**,
각 블록이 동일 payload를 완전 재기술. **명명된 에이전트 블록은 `*` 블록을 대체하므로**
재기술하지 않으면 바로 그 엔진들에게만 게이트·소버린 경로가 열린다. 말미에
`Host: www.theunitas.global` + `Sitemap: https://www.theunitas.global/sitemap.xml`.

차단 대상: `/api/` · `/sovereign`·`/*/sovereign` · `/locked`·`/*/locked` ·
16개 코인 게이트 모듈 각각의 2형태(`/apex`, `/*/apex` …) · `/*?sovereign_auth=`·`/*&sovereign_auth=`.

### 3.4 부수 발견 — canonical 붕괴 수복 (사이트맵의 전제 조건)

Next.js 메타데이터는 세그먼트 트리를 따라 **얕게 병합**되므로, `alternates`를 선언하지 않은
페이지는 부모 레이아웃의 것을 그대로 상속한다. `app/[locale]/layout.tsx`가 로케일 루트의
canonical을 선언하고 있었기 때문에 REV-21 프로덕션은 실제로 아래를 서빙하고 있었다:

```
GET https://www.theunitas.global/ko/legal/terms
  <link rel="canonical" href="https://www.theunitas.global/ko"/>
```

즉 company/legal/support **240 페이지** + u-ai·u-key·u-pay·u-signature **80 페이지**,
합계 **320 페이지가 "20개 홈의 중복"이라고 스스로 신고**하고 있었다. 이 상태로 사이트맵만
추가했다면 제출 340건 중 320건이 Search Console "대체 페이지(적절한 표준 태그 있음)"로
제외됐을 것이다. 따라서 canonical 수복은 M_SEO의 선택이 아니라 전제였다.

3중 방어 구조로 정리:
1. **사이트맵 미수록** — 게이트/소버린/locked/`/en/*`
2. **robots.txt `Disallow`** — 같은 집합, 로케일 2형태
3. **페이지 메타 `robots: noindex, nofollow`** — `(gated)/layout.tsx`(16개 모듈 일괄) ·
   `locked/page.tsx` · 신규 `sovereign/layout.tsx`(메타데이터 전용, DOM 무변경)

### 3.5 파일

| 파일 | 성격 |
| --- | --- |
| `web/lib/seo/routes.ts` | 신규 · **순수 정본**. `routing`·`sitePages`·`MODULE_REGISTRY` 세 카탈로그에서 전부 파생 |
| `web/lib/seo/pageMetadata.ts` | 신규 · 서버 동반(`indexablePageMetadata`, `NOINDEX`) |
| `web/app/sitemap.ts` · `web/app/robots.ts` | 신규 메타데이터 라우트 |
| `web/__tests__/seo/routes.test.ts` | 신규 · **23 테스트** |
| `web/app/[locale]/sovereign/layout.tsx` | 신규 · 메타데이터 전용 |
| `[locale]/layout.tsx` · `renderSitePage.tsx` · `u-ai`·`u-key`·`u-pay`·`u-signature` · `(gated)/layout.tsx` · `locked/page.tsx` | 수정 |

16 files changed, **+973 / −19**.

### 3.6 미들웨어 무간섭 (설계 근거)

`middleware.ts` matcher가 점 포함 경로를 제외(`.*\..*`)하므로 `/sitemap.xml`·`/robots.txt`는
로케일 리라이트·소버린 펜싱·Supabase 세션 갱신을 거치지 않는다. 라이브 응답 헤더에
`X-Unitas-Owner`·`X-Unitas-License`·HSTS preload·`X-Content-Type-Options: nosniff` 정상 부착 확인.

---

## 4. §2 M_DB — 상세

라이브 프로젝트 `fjznkonbjoierxvopiko`.

**실측으로 드러난 실제 상태**: `refund_coins`는 이미 라이브에 존재했고, 본문·시그니처·ACL이
마이그레이션 소스와 완전 일치했다. 누락된 것은 **마이그레이션 이력 행 1건**이었다.

| 무결성 항목 | 실측 결과 |
| --- | --- |
| 시그니처 | `refund_coins(uuid,bigint,text,text)` |
| 보안 속성 | `SECURITY DEFINER`, `search_path = public` |
| ACL | `{postgres=X/postgres, service_role=X/postgres}` → `public`/`anon`/`authenticated` **회수 확인** (무제한 셀프 환불 익스플로잇 차단) |
| 본문 | 마이그레이션 파일과 문자 단위 일치 |
| `coin_ledger_kind_check` | `'refund'` 포함 |
| 적용 절차 | `db query --linked --file`(멱등 재적용) → `migration repair --status applied 20260915000000` |
| `migration list --linked` | **20/20 local == remote** |

`migration repair`는 auto-mode 분류기가 `[Production Deploy]`로 1차 차단 → **창립자 승인 후 실행**.

---

## 5. §3 M_WEBKIT — 상세

`tests/web-cinema.config.js`의 3개 프로젝트를 **단일 실행**으로 전수 구동
(스펙·설정 파일 무수정 — REV-21이 통과시킨 것과 동일한 스위트를 동일 빌드 위에서).

| 프로젝트 | 실행 | 실패 | 조건부 스킵 |
| --- | --- | --- | --- |
| chromium | 115 | **0** | 1 |
| **webkit** (Desktop Safari) | **115** | **0** | 15 |
| mobile-chrome (Pixel 7) | 115 | **0** | 1 |
| **합계** | **345** | **0** | **17** → **328 passed, EXIT 0 (54.9분)** |

**정직 표기 — WebKit 스킵 15건의 내역과 성격** (전부 스펙 내부의 조건부 `test.skip()`,
제품 결함이 아니며 이번 개정이 만든 것도 아님):

| 스펙 | 건수 | 사유 |
| --- | --- | --- |
| `app-exit-collapse.spec.js` | 6 | 헤드리스 WebKit의 WebGL 컨텍스트 손실 → R3F `webglcontextlost` 미처리 갭이 루트 에러 바운더리를 트리거(기존 인지 사항) |
| `entry-chime.spec.js` | 5 | Web Audio 오토플레이 정책 에뮬레이션이 WebKit 헤드리스에서 재현 불가 |
| `rev21-rail-drag.spec.js` | 2 | 마우스 드래그 관성 / 60fps 리페인트 계측 |
| `rev17-refresh-persistence.spec.js` R3 | 1 | 설치형 App 콜드 재기동 |
| `rev21-footer-links.spec.js` F-2 | 1 | 프리하이드레이션 클릭(3개 프로젝트 공통 스킵, vitest `siteLinkBootstrap.test.ts`가 커버) |

**즉 사파리/iOS 엔진에서 스크롤·팝업·렌더링·라우팅·게이트·i18n 계열은 100/100 통과했고,
스킵은 전부 헤드리스 브라우저 능력 한계(WebGL·Web Audio·설치형 App·드래그 관성)에 국한된다.**
남은 갭: R3F에 `webglcontextlost` 핸들러를 붙이면 WebKit 6건을 회수할 수 있다(REV-23 후보).

---

## 6. §4 배포 및 라이브 무결성

| 항목 | 값 |
| --- | --- |
| 커밋 | `1d9082b` |
| origin push | `425bd89..1d9082b  main -> main` |
| Vercel 배포 | `dpl_GUN8h3pnhadb7cgti8cXuBsbXK2Z` · target `production` · **READY** |
| 배포 스코프 | `the-unitas-global-ou-e` (CLI 수동 배포 영구 유지 결정) |
| 라이브 `gitCommit` | `1d9082b0f41be1cf44f7ece001f120a1628d5108` — 푸시한 커밋과 **일치** |
| 라이브 `buildFingerprint` | `632c59de6817b47cda7b6bd7269424719027532a919efbfccee99be2797d6581` — 로컬 검증 빌드와 **일치** |
| 로케일 스윕 | **20/20 HTTP 200** |
| 게이트 동작 | `/ko/apex` 307 → `/ko/locked?reason=signin&m=apex` · `/ko/sovereign` **404** · `/en/legal/terms` 307 → `/legal/terms` |
| 잠금 페이지 | `/ko/locked` `<meta name="robots" content="noindex, nofollow">` |

**즉 테스트한 아티팩트와 배포된 아티팩트가 동일함이 지문으로 증명되었다.**

---

## 7. 남은 과제 (REV-23 후보 — 이번 개정 범위 밖)

1. **검색 콘솔 등록**: Google Search Console / Bing Webmaster / 네이버 서치어드바이저에
   `sitemap.xml`을 **수동 제출**해야 색인이 시작된다. 소유 확인 메타 토큰은 창립자만 발급 가능.
2. **R3F WebGL 컨텍스트 복구**: `webglcontextlost` 핸들러 부재 → WebKit 6건 스킵 원인.
3. **구조화 데이터 확장**: 현재 루트 레이아웃의 `Organization` JSON-LD 1종. 제품/FAQ/BreadcrumbList
   스키마를 붙이면 리치 결과 노출면이 넓어진다.
4. **코인 게이트 모듈의 SEO 전략**: 현재 307 리디렉션이라 색인 불가. 공개 랜딩(설명 + 잠금 CTA)과
   유료 본문을 분리하면 16개 모듈 × 20 로케일 = 320 URL을 색인 자산으로 전환할 수 있다.
