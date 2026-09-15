# REV-32 최종 완결 종합 보고서 — 옴니-테크 스웜 독립 모듈 부활 및 하이퍼-진입로 창조

창립자 지령일 2026-09-15 · 설계 정본 `docs/rev32/SPEC.md` · 대상 `index.html/web`

---

## 1. 2대 미션 결과

| 미션 | 지령 | 결과 |
|---|---|---|
| **M1** | 스웜을 독립 라우트·모듈로 신설, 기존 로직·렌더링 100% 보존, 최상위 아키텍처로 격상 | **완료** — 기하·렌더·해체 로직 **원본 그대로**, `/<locale>/omni-swarm` 독립 라우트 신설 |
| **M2** | 새롭고 직관적인 진입로 창조, 기존 "다른플랫폼에서열기"와 충돌 없이 배치 | **완료** — 진입로 **3종**(라우트·허브 6번째 탭·U-AI 포털), 겹침 0 실측 |

---

## 2. 무결성 게이트 실측 (제25장 Fail-Closed)

| 게이트 | 명령 | 결과 |
|---|---|---|
| 타입 | `npx tsc --noEmit` | **EXIT 0** |
| 단위 | `npx vitest run` | **1486 / 1486 pass · 92 / 92 파일 · 실패 0** |
| 빌드 | `npm run build` (prebuild 3단 + postbuild) | **EXIT 0** · fingerprint `eb09b6b8bab1d401` |
| E2E (3엔진) | `npx playwright test --config=tests/web-cinema.config.js` | **567 pass · 33 skip · 0 fail** (1.5h) |
| E2E (REV-32 타깃) | 동일 하네스 `--project=chromium rev32-swarm` | **6 / 6 pass** |

단위 테스트는 REV-31의 1465에서 1486으로 올랐다(+21). 복원한 스웜 스위트 2종 — `swarmLayout.test.ts`(순수 기하)와 `omniTechSwarm.test.ts`(목 위키데이터 해체) — 이 돌아온 결과다.

전체 변경: **67 파일 · +3,525 / −75 줄**.

---

## 3. M1 — 무엇을 보존했고 무엇을 뜯어고쳤는가

### 3.1 보존 (원본 그대로)

| 모듈 | 줄 | 변경 |
|---|---|---|
| `lib/swarm/swarmLayout.ts` | 168 | **0** — 순수 기하, import 없음. 섹터·3중 껍질·id 해시 스캐터·결정론 전부 REV-24 원본 |
| `components/swarm/OmniTechSwarm.tsx` | 209 | import 경로 **1줄** — WebGL 0 · 렌더루프 0 · 실버튼 · 포인터 패럴랙스(CSS 변수 2개) |
| `lib/swarm/omniTechSource.ts` | 215 | import + 형상 이름 — `wbgetentities` 2회, 6프로퍼티(P452·P749·P355·P1056·P112·P169), 동일 상한·newest-first 랭킹·첫 페이지 스케일 팩트 |

`omniTechSource.ts`를 원본과 diff하면 남는 차이는 **의도한 `scope` 2줄 제거와 import·타입명뿐**이다.

### 3.2 뜯어고침 (천장)

- **`lib/swarm/swarmTypes.ts` 신규** — 삭제된 렌즈 프레임워크의 `DeeperPage` 계열 6종 대신 스웜이 소유하는 4개 형상. 의존성 역전.
- **`lib/swarm/useOmniSwarm.ts` 신규** — `useDeeperPage`(218줄 범용 렌즈 페이저: 무한 스크롤·IntersectionObserver·TTL 캐시·재시도 문구)를 대체. 스웜은 피드가 아니다: 반쯤 그려진 필드는 짧은 필드가 아니라 **틀린 그래프**다(섹터가 차원 수에서 나온다). 그래서 커서를 끝까지 걸어 한 번에 공개한다. 모듈 캐시 + in-flight 맵으로 두 진입로가 한 번의 해석을 나눠 쓴다.
- **`components/swarm/OmniSwarmPanel.tsx` 신규** — `DeeperThemePage`(361줄, 6종 카드 렌더러) 대체. 필드가 곧 페이지다.
- **`app/[locale]/omni-swarm/page.tsx` 신규** — `?qid=Q…`(정규식 검증) / `?q=<이름>`(자체 해석), 자체 canonical + 20로케일 hreflang, 사이트맵 등록(340 → 360 URL).

### 3.3 새로 더한 단 하나 — 흡수 경로

노드를 활성화하면 앵커가 조용히 바뀌던 과거에는 Microsoft → OpenAI → Sam Altman으로 걸어가도 **돌아올 길도, 걸어왔다는 감각도 없었다.** 경로(breadcrumb)가 기록되면서 REV-23이 광고했던 "모듈식 흡수" 루프가 마침내 **가역적이고 가시적**이 됐다. E2E가 실측한다: 노드 클릭 후 현재 주제가 바뀌고 **이전 주제가 클릭 가능한 채로 남는다**.

---

## 4. M2 — 진입로 3종

| 진입로 | 선택자 | 성격 |
|---|---|---|
| 독립 라우트 | `/<locale>/omni-swarm` | 주소 그 자체 — 북마크·공유·딥링크 가능 |
| UNITAS 마스터 허브 | `[data-hub-tab-btn="swarm"]` | 6번째 탭. 허브는 모든 페이지에서 닿는 유일한 표면 |
| U-AI 결과 메인 팝업 | `[data-stream-card="swarm"]` | 페이지 1의 포털 카드 |

### 4.1 자율 해결한 결함 — 사라지는 진입로

첫 구현은 QID 없는 앵커에서 포털을 지웠다("비활성 컨트롤은 부재보다 낫다"). **chromium E2E가 즉시 반증했다**: 라이브 웹 합성은 최선노력 키리스 패스라서 "Microsoft" 검색조차 텍스트 앵커로 떨어졌고, 창립자가 요구한 "가장 눈에 띄는 독립된 구역"이 결과에서 **통째로 사라졌다**. REV-32가 고치려던 병 그 자체였다.

재설계: 식별자는 **문의 유무가 아니라 문의 방식**만 정한다.

| 앵커 | 문 | 동작 |
|---|---|---|
| QID 있음 | `<button>` | 제자리 중첩 모달 — 스크롤 위치 보존, 히스토리 1층 |
| QID 없음 | `<Link>` | 질의를 실어 독립 라우트로 — 거기엔 스트림 합성이 건너뛰는 **위키데이터 폴백까지 갖춘 완전 해석기**가 있다 |

둘 중 하나는 **항상** 있고, 어느 쪽도 막다른 길이 아니다.

### 4.2 충돌 회피 — 실측

포털은 스트림 카드 계열에 속한다(동일 radius·테두리·바탕). 구분되는 것은 액센트와 정적 radial bloom 하나뿐. E2E가 "다른플랫폼에서열기" 행과의 **기하학적 겹침 0**을 매 실행 단언한다.

### 4.3 한계비용 0원 (Codex §2 #160·#309·#409)

U-AI 결과 페이지에는 `WIKIMEDIA_PAGE_BUDGET = 2`라는 하드 예산이 있고 단위 테스트가 스트림 캡까지 전 페이지에 대해 단언한다. 스웜은 자신을 그리는 데 위키데이터 4호출을 쓴다. 인라인 렌더는 **한 번도 보지 않을 방문자까지 포함해** 모든 방문자의 비용을 두 배로 만든다.

→ 페이지 위의 카드는 **비용 0**(문이지 창이 아니다). 4호출은 누군가 문을 통과할 때만 쓰인다. E2E가 단언한다: 문이 닫혀 있는 동안 `[data-omni-swarm-panel]` 카운트는 **0**.

---

## 5. 게이트 함정 — 감사가 잡아낸 빌드 블로커

1. **`validate-module-registry.mjs`가 prebuild에서 `exit 1`** — `app/[locale]/` 아래 미등록 최상위 폴더를 거부한다. `INFRA_ROUTES`에 `omni-swarm`을 등록하지 않으면 Next가 컴파일을 시작하기도 전에 빌드가 닫힌다. 감사가 아니었으면 원인 불명의 빌드 실패로 시간을 잃었을 지점이다.
2. **고정 카운트 3개** — `PUBLIC_ROUTES` 17→18, 사이트맵 340→360, 스트림 kind 11→12. 마지막 것은 `FOUNDER_ELEVEN` → `FOUNDER_KINDS`로 계약을 명시적으로 갱신했고, **REV-23이 폐기한 16종 부활 방지 목록(`DELETED_KINDS`)은 손대지 않았다.**
3. **`Rev21.stream.kinds.swarm`은 드래프트에 넣어야 한다** — `apply-rev21.mjs`가 네임스페이스를 통째로 치환하므로 `messages`에 직접 쓰면 조용히 되돌려진다([[REV-31에서 배운 것]]).
4. **허브 토글 아이콘 롤이 개수에 묶여 있었다** — `@keyframes qw-unitas-roll`이 5스텝 하드코딩. 6번째 surface를 추가하면서 **스텝 2.4초는 상수로 두고 루프를 12s → 14.4s로** 늘렸다. 케이던스가 계약이지 루프 길이가 계약이 아니기 때문.

---

## 6. i18n

- `Rev32.swarm.*` 신규 네임스페이스 **28키 × 20 로케일** — 적용기 `web/scripts/apply-rev32-i18n.mjs`(멱등, 플레이스홀더 fail-closed).
- **차원 라벨·스케일 팩트·브랜드 타이틀·재앵커 문구는 pre-REV-31 트리에서 회수**해 각 로케일이 이미 갖고 있던 표현을 그대로 유지했다 — 재번역이 아니라 복원이다.
- `Rev21.stream.kinds.swarm`(드래프트 경유) + `Rev29.hub.tabs.swarm` 각 20 로케일.

---

## 7. 프로덕션 배포 검증 (제25장)

| 항목 | 값 |
|---|---|
| 코드 커밋 | `7f95f324c24e9f600e75d318e1fd881429b5c656` |
| origin push | `6d837b0..7f95f32  main -> main` |
| Vercel 배포 | `the-unitas-global-cq7oazp1b-the-unitas-global-ou-e.vercel.app` · Production · **Ready** (빌드 2m) |
| 라이브 `gitCommit` | `7f95f324c24e9f600e75d318e1fd881429b5c656` — **로컬 HEAD와 바이트 일치** |
| 라이브 `buildFingerprint` | `eb09b6b8bab1d401e89662dc070f15e680f3dbd60b7758e8180a5cc6226b2904` |
| 생성 시각 | 2026-09-15T21:08:29.265Z |
| IndexNow | **360 URL · HTTP 200** (340 → 360, 신규 라우트 20 로케일) |

### 7.1 신규 라우트 라이브 실측

`https://www.theunitas.global` 실호출(인덱서 UA):

| 검증 | 결과 |
|---|---|
| `/omni-swarm` (영문, 무접두) | **HTTP 200** |
| `/ko/omni-swarm` | **HTTP 200** |
| 한국어 브랜드 타이틀 "옴니 테크 펄스" | 12건 |
| 검색 라벨 "해체할 조직" | 2건 |
| 셸 마커 `data-omni-swarm-page` | 1건 |
| 차원 라벨 "자회사" | 9건 |
| `sitemap.xml` 내 `omni-swarm` | 440건 (20 URL × hreflang 21 클러스터 + URL) |

REV-31에서 도달 불가가 됐던 모듈이 프로덕션에서 **자기 주소로 200을 응답하고, 20개 로케일 전부 색인 대상**이 되었음을 문자열 단위로 확인했다.
