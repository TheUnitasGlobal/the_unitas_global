# REV-21 최종 완결 종합 보고서

> Codex v23.0 **제24장** (Fail-Closed 무결성 검증, 배포 및 최종 완결 종합 보고 독트린) 산출물.
> 창립자(황두영) 2026-09-13 배포 승인 지침 §2에 따른 정본 레퍼런스.
> 규칙: **이 세션에서 실측한 값만** 기록한다. 미검증 항목은 §7에 명시적으로 분리한다.

- **작성 시각**: 2026-09-13
- **정본 스펙**: `docs/rev21/SPEC.md` (§12 = 창립자 v2 지령 부록, §1~§11을 override)
- **마일스톤 중간 기록**: `docs/rev21/MILESTONE_REPORT.md` (제23장 강제 Flush 대상)

---

## §1. 최종 라이브 배포

| 항목 | 값 |
| --- | --- |
| 배포 ID | `dpl_HCyahZw3K4681MLXxM7PzoxDLJEx` |
| readyState | `READY` / target `production` |
| 배포 URL | https://the-unitas-global-a36ktso8i-the-unitas-global-ou-e.vercel.app |
| **프로덕션 알리아스** | **https://www.theunitas.global** · **https://theunitas.global** |
| Inspector | https://vercel.com/the-unitas-global-ou-e/the-unitas-global-o/HCyahZw3K4681MLXxM7PzoxDLJEx |
| 배포 커밋 | `05c5cfb5ae6ccab24970518efae164dc882bbaa9` |
| Vercel CLI | 59.16.0 / Node.js 24.19.0, 계정 `ceo-7455` |
| 팀 스코프 | `the-unitas-global-ou-e` |
| 배포 소요 | 116.1s, `VERCEL_EXIT 0` |

**스코프 정정 기록**: 창립자 지침 원문의 `--scope the-unitas-global-ou-ei`는 `vercel teams ls` 실측 결과
실제 팀 슬러그가 `the-unitas-global-ou-e`(말미 `i` 없음)여서, 검증된 정본 슬러그로 집행했다.
`index.html/CLAUDE.md:125` · `docs/rev18|19|20/SPEC.md`의 기록과도 일치한다.

### 라이브 무결성 실측 (배포 직후 HTTPS 실호출)

| 검증 | 결과 |
| --- | --- |
| `/ownership-manifest.json` | HTTP 200 |
| 라이브 `gitCommit` | `05c5cfb5ae6ccab24970518efae164dc882bbaa9` — **로컬 HEAD와 완전 일치** |
| 라이브 `buildFingerprint` | `632c59de6817b47cda7b6bd7269424719027532a919efbfccee99be2797d6581` — **로컬 빌드와 완전 일치** |
| `fileCount` / `algorithm` | 12 / `sha256` |
| **20로케일 라이브 응답** | **20 / 20 → HTTP 200, 실패 0건** (de en es et fr hi id it ja km ko nl pl pt ru th tl tr vi zh) |
| `/manifest.json` (PWA) | 200 (1,407 B) |
| `/api/live/hot-news` | 200 (5,027 B) — 라이브 API 경로 정상 |
| 보안 헤더 | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` · `X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` |
| 소버린 IP 헤더 | `X-Unitas-Owner: THE UNITAS GLOBAL OU` · `X-Unitas-License: Proprietary -- All Rights Reserved. See /legal/terms.` |

---

## §2. Fail-Closed 게이트 전수 실측 (제24장, 배포 직전 + 배포 산출물 대상)

| 게이트 | 결과 | 소요 |
| --- | --- | --- |
| `tsc --noEmit` | **EXIT 0** | 11.3s |
| `vitest run` | **75 파일 / 1122 테스트 전부 통과, EXIT 0** | 18.8s |
| `next build` (prebuild sync-codex drift=0 포함) | **EXIT 0**, postbuild 지문 `632c59de6817b47c…` | 132.1s |
| `playwright` chromium + mobile-chrome | **228 passed / 0 failed / 2 skipped (230), EXIT 0** | 17.0m |

E2E는 **배포한 바로 그 프로덕션 빌드**(`next start -p 3123`) 위에서 재실행해 측정했다.
실행 전 고아 `next dev`/`next start` 프로세스 0건, 포트 3123 미점유를 확인했다
(`reuseExistingServer:true`가 구버전 빌드를 서빙하는 함정 차단).

---

## §3. 아키텍처 스펙 실측

| 항목 | 값 |
| --- | --- |
| 프레임워크 | Next.js 14 App Router + TypeScript + Supabase |
| 앱 라우트 엔트리 | 52 |
| 프리렌더 정적 라우트 | 420 |
| 동적 라우트 그룹 | 12 |
| 공유 First Load JS | 87.6 kB (`chunks/2117` 31.9 kB + `chunks/fd9d1056` 53.6 kB + 기타 2.1 kB) |
| Middleware | 99.3 kB |
| 지원 로케일 | **20** (`web/messages/*.json`) |
| vitest 스위트 | 75 파일 / 1122 테스트 |
| E2E 스펙 | 22 파일 (`tests/web-cinema-e2e/`), REV-21 신규 3 (`rev21-footer-links` · `rev21-hub-card` · `rev21-rail-drag`) |
| DB 마이그레이션 | **0건** — REV-21은 D-9에 따라 스키마 무변경 |
| 소유권 매니페스트 | `sha256`, 12파일, 지문 `632c59de6817b47c…` |

---

## §4. 총 커밋 내역 (REV-21 PHASE 2 전 구간)

| 커밋 | 마일스톤 / 내용 |
| --- | --- |
| `d1ae8e1` | **M1~M4 그라운드워크** — 레일 물리, 24슬롯 레지스트리, Rev21 i18n 부트스트랩 (codex v19.0 각인 커밋에 혼입) |
| `56e46ee` | **M4** — §1 L1 팝업 재설계 (카드 전체 히트박스, 칩 레일 grab-drag, 랭킹 슬롯 서브탭, 크로스페이드) |
| `57585a6` | docs — SPEC §12에 창립자 v2 지령 반영 (M5~M10 재편) |
| `1da110d` | **M5a** — 앵커 배관, 옴니-테크 소스 레지스트리, Frankfurter v2, `THEME_QID`/`AXIS_QID` 사전 |
| `bc99f93` | **M5b** — 전 U-AI 팝업에 ExploreDeeper 14렌즈 + `/api/live/entity-news` |
| `7b4da3f` | **M6** — §4 렌더링 무결성: 무음 로케일 전환, 새로고침 프리스탬프, 한 겹 블러 예산 |
| `007cdc0` | **M7** — §5A 통합 액션 박스, §5B 글로벌 우선 키워드 사다리(SI-5), D-38 인-타워 컴포저 |
| `bf09ae4` | **M8** — §5C 인피니티 스트림 1단계 16종, COGS 매트릭스, 몰입 헌장, `/u-ai` 공유 |
| `ff752d6` | **M9** — §6 기관 페이지, 레지스트리 생성 공시, 20로케일 동기화 |
| `f2d5388` | **M10a** — 인피니티 스트림 2단계 11종 (D-37) |
| `635ae6e` | **M10b** — 스코프 섹션, held-on-close, 터치 일시정지, rail-drag + 히트박스 E2E |
| `587db69` | **M10c** — 전수 E2E 게이트 그린, 낡은 어서션 3건 수리 |
| `8ecd592` | Codex v23.0 루트 각인 (정본 3파일) |
| `c672a10` | Codex v23.0 개정 완결 — 운영 사본 4 + 요약본 6 동기화, prebuild drift 게이트 해제 |
| `05c5cfb` | 제23장 산출물 `docs/rev21/MILESTONE_REPORT.md` 추가 — **현재 HEAD = 배포 커밋** |

**총 변경량** (`d1ae8e1~1..587db69`, `web`/`tests`/`docs` 기준):
**215 파일, +46,427 / −2,845 라인**

| 영역 | 변경 파일 수 |
| --- | --- |
| `web/lib` | 48 |
| `web/components` | 36 |
| `web/__tests__` | 27 |
| `web/messages` (20로케일) | 20 |
| `web/app` | 12 |
| `tests/web-cinema-e2e` | 7 |
| `docs/rev21` | 41 |

Git 동기화 상태: `local == origin/main == 05c5cfb` (ahead 0 / behind 0), 작업 트리 클린.

---

## §5. Codex v23.0 각인 정산

| 항목 | 값 |
| --- | --- |
| 장 구성 | 제1~24장 (구 제21장 멀티 모델 페일오버 삭제 → 제22~25장이 제21~24장으로 당겨짐) |
| 1000대 초-헌법 | **1000 / 1000**, 슬롯 누락 0 · 중복 0 |
| 정규화 canon sha256 | `128545a5ef16e594…` |
| sync-codex 드리프트 | **drift = 0**, PASS 4/4 |
| 동기화 범위 | 정본 3 + 운영 사본 4 + 요약본 6 + 에이전트 파일 3 |

---

## §6. 창립자 지령 §12 D-항목 정산

REV-20 잔여 D-3~D-6은 `deb1a65`에서 종결됐고, REV-21은 §12 v2 지령의 D-33 / D-36 / D-37 / D-38을
M5~M10 구간에서 전항 구현 완료했다 (D-37 스트림 24종은 1단계 16종 `bf09ae4` + 2단계 11종 `f2d5388`로 분할 집행).

---

## §7. 후속 과제 및 정직 표기 (미검증·미구현을 완료로 보고하지 않기 위한 명시)

### 7-1. 실측으로 새로 발견한 갭 — `sitemap.xml` / `robots.txt` 부재
라이브 실호출 결과 `https://www.theunitas.global/sitemap.xml`과 `/robots.txt`가 **둘 다 HTTP 404**다.
소스 전수 검색 결과 `web/app`·`web/lib`·`web/middleware.ts`·`web/next.config.*` 및 레거시 정적 사이트
어디에도 sitemap/robots 라우트나 파일이 **존재하지 않는다**(0건).
- 영향: **제12장(익스트림 SEO 도배) 미충족** — 구글/네이버/빙 크롤 지시자와 20로케일 URL 색인 진입로가 없다.
- 기구현 자산: `app/[locale]/layout.tsx`의 `alternates.canonical` + hreflang, `app/opengraph-image.tsx`는 정상 존재.
  따라서 갭은 **sitemap/robots 두 라우트에 한정**된다.
- 권고: `app/sitemap.ts`(20로케일 × 52라우트 전개) + `app/robots.ts` 신설. REV-22 최우선 후보.

### 7-2. 이번 실행에서 검증하지 않은 항목
- **webkit 프로젝트 미실행**: M10 지령 범위(chromium / mobile-chrome) 밖. 실행하지 않았으므로 통과/실패 모두 주장하지 않는다.
- **조건부 자가 스킵 2건**: `rev21-footer-links.spec.js:204` F-2 프리하이드레이션 경로가 chromium·mobile-chrome 각 1건씩
  `test.skip(!preHydrationClick, ...)`으로 자가 스킵했다(= 230건 중 2건). 메커니즘 자체는 vitest `siteLinkBootstrap.test.ts`가 커버한다.
- **`20260915000000_u_ai_deep_insight_refund.sql` (REV-20 D-6 `refund_coins`)**: 파일은 `supabase/migrations/`에 존재하나
  **라이브 DB 적용 여부를 이번 세션에서 검증하지 않았다**. 기존 메모리 기록상 미적용이며, 별도 적용 절차가 필요하다.
- **빌드 로그의 "784 페이지" 카운터**: 이번 실행에서는 빌드 출력 tail만 보존해 재측정하지 않았다.
  이번 세션이 실측한 값은 매니페스트 기준 **프리렌더 라우트 420 / 앱 라우트 엔트리 52 / 동적 12**다.

### 7-3. 재발 방지 각인 (이번 구간의 교훈)
- **E2E 로케이터는 구조가 아니라 `data-*` 훅으로 고정한다.** M10c에서 수리한 낡은 어서션 20건은 전부 구조 기반 로케이터였고
  제품 회귀는 0건이었다. 전수 스위트를 미루면 테스트가 코드보다 뒤처져 쌓인다.
- **`sync-codex --write`는 마커 밖 산문(버전 배너·sha 인용·Rev 번호)을 갱신하지 않는다.** 코덱스 개정 후 구버전 전수 grep 필수
  (동일 사고 4회 재발 이력). Vercel은 ENOENT 폴백으로 통과하므로 **배포 성공만으로 안심하면 놓친다.**
- **E2E 전 고아 `next dev`/`next start` 정리 필수** — `reuseExistingServer:true`가 구버전 빌드를 테스트한다.

---

## §8. 결론

REV-21 PHASE 2는 M1~M10 전 마일스톤이 구현·커밋·푸시되었고, Fail-Closed 4대 게이트
(`tsc` / `vitest` / `build` / `playwright`)가 전부 **EXIT 0**으로 실측 증명되었으며,
Vercel 프로덕션 배포가 `READY` 상태로 `www.theunitas.global`에 알리아스 전환 완료되었다.
라이브 산출물의 `gitCommit`과 `buildFingerprint`가 로컬 빌드와 **완전 일치**하므로,
배포된 바이너리가 검증된 바로 그 빌드임이 증명된다.

잔여 리스크는 §7의 세 항목(sitemap/robots 부재, webkit 미실행, D-6 마이그레이션 미적용)이며,
어느 것도 이번 배포의 무결성을 훼손하지 않는다.
