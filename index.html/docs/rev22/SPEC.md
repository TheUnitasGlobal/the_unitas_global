# REV-22 SPEC — 앱솔루트 완결 (REV-21 §6 잔여 3대 갭 격파)

> 정본. 창립자 지령(2026-09-13)의 §1 M_SEO / §2 M_DB / §3 M_WEBKIT / §4 Fail-Closed·배포를
> 실행 가능한 설계로 고정한 문서다. REV-21 최종 보고서 §6이 "미해결"로 남긴 항목만 다루며,
> 그 밖의 기능 추가·리팩터링은 본 개정의 범위가 아니다.

---

## §0. 배경 — REV-21이 남긴 것

`docs/rev21/FINAL_REPORT.md` §6이 기록한 잔여 갭 3건:

| # | 갭 | 증빙 |
| --- | --- | --- |
| G-1 | `/sitemap.xml` · `/robots.txt` 라이브 404, 소스 0건 → Codex v23.0 **제12장(익스트림 SEO 도배) 미충족** | 라이브 HTTP 404 + 전체 소스 grep 0 hit |
| G-2 | `20260915000000_u_ai_deep_insight_refund.sql` 라이브 미적용 | `migration list --linked` 19/20 |
| G-3 | Playwright `webkit` 프로젝트 미실행 → 제13장(옴니채널 무결성) 사파리/iOS 미증명 | REV-21 M10 지령 범위가 chromium·mobile-chrome |

---

## §1. M_SEO — 제12장 완결

### 1.1 실측으로 드러난 진짜 범위

지령문의 "52개 프리렌더링 라우트"는 `.next/app-path-routes-manifest.json`의 **전체 앱 경로 수**다.
실측 분해:

```
52 앱 경로
 ├ 20  /api/*            route handler  → 검색 결과가 될 수 없음
 ├  1  /opengraph-image  이미지 route
 ├  1  /_not-found
 └ 30  [locale] 페이지 경로
      ├  1  /                          (홈)
      ├  4  /u-ai /u-key /u-pay /u-signature
      ├  3  /company/[slug] /legal/[slug] /support/[slug]  → 실제 12개 슬러그로 전개
      ├  1  /locked                    코인 게이트 거부 착지점
      ├  5  /sovereign*                미들웨어가 공개 요청에 무본문 404
      └ 16  (gated)/*                  코인 게이트 — 미승인 방문자에 307 → /locked
```

전개 후 구체 페이지 39개. 이 중 **크롤러에 200을 주는 라우트는 17개**:

`/` · `/u-ai` · `/u-signature` · `/u-key` · `/u-pay` ·
`/company/{about,careers,press}` · `/support/{help-center,contact,system-status}` ·
`/legal/{patent-notice,compliance,security,privacy,cookies,terms}`

**17 × 20 로케일 = 340 URL**이 사이트맵 정본이다.

### 1.2 제외 결정과 근거 (전부 크롤러가 직접 검증 가능)

| 제외 대상 | 실측 응답 | 사이트맵에 넣었을 때의 손해 |
| --- | --- | --- |
| 16 코인 게이트 모듈 | `307 → /{locale}/locked` | Search Console "리디렉션이 포함된 페이지" 제외 + 크롤 예산 낭비 |
| `/locked` | 200이지만 독립 콘텐츠 없음 | 모듈명 검색이 잠금 화면에 착지 |
| `/sovereign*` | `404` (무본문) | 하드 404를 사이트맵에 제출 = 순수 크롤 예산 누수 |
| `/api/*` | JSON | — |
| `/{locale}` 중 `/en/*` | `307 → 프리픽스 없는 경로` | `localePrefix: 'as-needed'` — 20개 팬텀 리디렉션 URL |

이들은 **3중 방어**로 색인에서 차단한다: (1) 사이트맵 미수록, (2) `robots.txt` `Disallow`,
(3) 페이지 메타 `robots: noindex, nofollow`.

### 1.3 발견된 치명 결함 — 서브페이지 canonical 붕괴

Next.js 메타데이터는 세그먼트 트리를 따라 **얕게 병합**된다. `alternates`를 선언하지 않은 페이지는
부모 레이아웃의 것을 그대로 상속한다. `app/[locale]/layout.tsx`는 **로케일 루트**의 canonical을
선언하므로, REV-21 빌드 산출물은 실제로 다음을 내보내고 있었다:

```
.next/server/app/ko/legal/terms.html
  <link rel="canonical" href="https://www.theunitas.global/ko"/>
  (hreflang 21개도 전부 로케일 루트를 가리킴)
```

즉 **company/legal/support 240 페이지 + u-ai/u-key/u-pay/u-signature 80 페이지가 전부
"20개 홈페이지의 중복"이라고 구글에 선언**하고 있었다. 사이트맵만 추가했다면 340개 URL을 제출하고
320개가 "대체 페이지(적절한 표준 태그 있음)"로 제외되는 결과가 됐을 것이다.
따라서 canonical 수복은 M_SEO의 선택 사항이 아니라 **전제 조건**이다.

### 1.4 설계

| 파일 | 역할 |
| --- | --- |
| `web/lib/seo/routes.ts` | **순수 정본.** `routing`(20 로케일 + `as-needed`) · `sitePages` 슬러그 3종 · `MODULE_REGISTRY`(coinGated) 세 카탈로그만 입력으로 받아 공개 라우트 목록 / 로케일 경로 / hreflang 클러스터 / 사이트맵 엔트리 / robots Disallow를 파생. `next/*` 런타임 import 없음 → vitest node 환경에서 직접 검증 |
| `web/lib/seo/pageMetadata.ts` | 서버 전용 동반 파일. `indexablePageMetadata()`(title·description·canonical·hreflang·OG·Twitter 일괄) + `NOINDEX` 상수 |
| `web/app/sitemap.ts` | 340 URL, 엔트리마다 21개 `xhtml:link`. 50,000 URL 상한 초과 시 빌드를 깨는 fail-closed 가드 포함 |
| `web/app/robots.ts` | `*` + `Googlebot`·`Googlebot-Image`·`Bingbot`·`Yeti`(네이버)·`Daumoa`(다음) 6블록. **명명된 블록은 `*` 블록을 대체하므로** 동일 payload를 반드시 재기술 |

수정 파일: `app/[locale]/layout.tsx`(공용 헬퍼로 이관) · `components/layout/renderSitePage.tsx`
(슬러그별 alternates, try/catch 양쪽 경로에서 반환) · `u-ai`/`u-key`/`u-pay`/`u-signature`
(자체 `generateMetadata`) · `(gated)/layout.tsx`·`locked/page.tsx`·신규 `sovereign/layout.tsx`
(`robots: noindex, nofollow`).

### 1.5 미들웨어 간섭 없음 (설계 근거)

`middleware.ts`의 matcher는 점이 들어간 경로를 제외한다(`.*\..*`). 따라서 `/sitemap.xml`과
`/robots.txt`는 로케일 리라이트·소버린 펜싱·Supabase 세션 갱신을 **전혀 거치지 않고** 정적 파일로
서빙된다. 별도 예외 규칙을 추가할 필요가 없다.

---

## §2. M_DB — U-COIN 환불 스키마 라이브 정합화

라이브 프로젝트 `fjznkonbjoierxvopiko`. 적용 절차는 기존 정본(`db query --linked --file` →
`migration repair --status applied`)을 그대로 따른다. `db push`는 사용하지 않는다.

무결성 판정 기준(전부 실측):
1. `public.refund_coins(uuid,bigint,text,text)` 존재 + `SECURITY DEFINER` + `search_path=public`
2. ACL이 `service_role`에만 EXECUTE — `public`/`anon`/`authenticated` 회수됨
   (무제한 셀프 환불 익스플로잇 차단)
3. `coin_ledger_kind_check`에 `'refund'` 포함
4. `migration list --linked` 20/20 local==remote

---

## §3. M_WEBKIT — 제13장 크로스 브라우저 증명

`tests/web-cinema.config.js`의 `webkit` 프로젝트(Desktop Safari)를 전수 구동한다.
설정·스펙 파일은 수정하지 않는다 — REV-21이 chromium·mobile-chrome에서 통과시킨 것과
**동일한 스위트를 동일 빌드 위에서** 돌려 사파리/iOS 엔진 차이만 분리해 본다.

기존 인지 사항: `app-exit-collapse.spec.js`는 헤드리스 WebKit의 WebGL 컨텍스트 손실로
루트 에러 바운더리 플레이크가 보고된 이력이 있다(R3F `webglcontextlost` 미처리 갭).
실패가 나오면 **제품 회귀인지 헤드리스 환경 한계인지 분리해 정직하게 기록**한다.

---

## §4. Fail-Closed 게이트 (제24장)

`tsc --noEmit` · `vitest run` · `next build` · Playwright 4종 전부 EXIT 0 이전에는
커밋·푸시·배포하지 않는다. 배포는 `git push origin main` +
`cd web && npx vercel --prod --yes --scope the-unitas-global-ou-e`(CLI 수동 배포 영구 유지 결정).
