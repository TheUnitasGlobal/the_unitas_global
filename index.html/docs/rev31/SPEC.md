# REV-31 — U-AI 팝업 옴니-오픈 대공사 (창립자 지령 2026-09-15)

정본 위치: `index.html/docs/rev31/SPEC.md`
대상: `index.html/web` (Next.js 14 App Router, 20 로케일)

---

## 0. 지령 원문 3대 미션

| 미션 | 지령 | 범위 |
|---|---|---|
| **M1** | "더 깊이 탐색" 구역 영구 삭제 — 타이틀 글자·UI 박스·연결된 하위 기능 및 렌더링 로직을 코드베이스에서 100% 삭제, DOM 트리 최적화 | U-AI 검색창 1회 클릭 팝업, 글자 입력 전/후 팝업, 연동되는 모든 세부 팝업 전역 |
| **M2** | "출처" → **"다른출처에서열기"** 개명 + "다른플랫폼에서열기" 타이틀과 100% 픽셀 동일 + **직상단 강제 배치** + 무조건 쌍 렌더링 | 동일 |
| **M3** | "다른곳에서열기" 폐기 → **"다른플랫폼에서열기"** 신규 창조 (앞뒤 문자 동일 라임, 옴니-테크 철학) | 동일 |

---

## 1. 실측 기반 설계 근거 (PHASE 1)

### 1.1 삭제 대상의 도달 경로 실측

`<ExploreDeeper>`는 **7개 파일 · 12개 JSX 마운트 지점**에서 렌더되고 있었다. 감사 실측 결과:

- 렌즈 타일(테마)은 15종, 그중 13종이 `needs: 'entity'` — 즉 앵커에 Wikidata QID가 있어야만 노출.
- 옴니-테크 스웜(`OmniTechSwarm`)의 **유일한 도달 경로**는 `bigTechPulse` 렌즈 타일 클릭 1개뿐. 라우트·API·동적 import 없음.
- 앵커 브릿지(`anchorBridge.ts`, REV-25)의 **존재 이유**는 텍스트 앵커를 엔티티로 승격시켜 렌즈를 열어주는 것. 렌즈가 사라지면 존재 이유가 사라진다.

→ **결론**: 렌즈 기계 전체가 M1의 "연결된 하위 기능"에 해당한다.

### 1.2 M2가 만들어내는 구조적 함정 — 빈 출처 행

기존 "출처" 행의 링크는 전부 `effective.qid` 게이트에 묶여 있었다. M2가 요구하는 "무조건 쌍 렌더링"을 그대로 구현하면, QID 없는 앵커에서 **타이틀만 있고 링크가 0개인 행**이 발생한다. 실측한 마운트 지점별 판정:

| 판정 | 지점 | 원인 |
|---|---|---|
| **구조적 항상 빈 행 (4)** | `UnitasModuleRankings:193`, `UnitasShorts:245`, `HotIssueNewsList:679`, `DiscoveryCarousel:930`(unitasRanking 분기) | `textAnchor` + `bridge={false}` |
| **구조적 항상 빈 행 (1, 은닉)** | `DiscoveryCarousel:861`(`nearby` 슬롯) | `placeAnchor`에 QID 폴백 인자 누락 + `needsAnchorBridge`가 place 앵커를 원천 거부 |
| **조건부 빈 행 (4)** | 타워/`uaiPage` 스트림, `keywordTier` 루트 티어, `globalRankingDetail` 11~20위, `feed`의 history/mostRead | 브릿지 미스·타임아웃 |

→ **해결 설계**: 출처 행을 **용어(term) 기반 키리스 검색 URL**로 재정의한다. 식별자는 *정밀도*를 사는 것이지 *존재*를 사는 것이 아니다. QID가 있으면 정확한 문서로, 없으면 같은 코퍼스의 검색으로 — 어느 쪽이든 링크는 반드시 있다.

### 1.3 M2 픽셀 동기화의 실측 기준

| 요소 | 기존 "출처" | 기존 "다른 곳에서 열기" |
|---|---|---|
| 클래스 | `font-bold uppercase tracking-widest` | `qw-deeper-label inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-accent` |
| 크기 | 부모 상속 `text-[11px]` | `text-[12px]` |
| 색 | 부모 상속 `text-gray-500` | `text-accent` (화이트 표면: `--qw-gold-deep`) |
| 아이콘 | 없음 | `ExternalLink size={13}` |

→ 두 타이틀은 **폰트 크기·색·아이콘 유무가 전부 달랐다**. "맞춘다"가 아니라 **단일 상수에서 파생시켜 드리프트 자체를 불가능하게** 만든다.

### 1.4 게이트 함정 실측

- **i18n 드리프트 게이트**: `Rev21` 네임스페이스 리프가 213 → 70으로 줄면 허용치가 `floor(N*0.05)` = 10 → **3**으로 조여진다. 실측 시뮬레이션 결과 **fr이 5/3으로 탈락**. 원인은 오역이 아니라 정당한 동형어(`modules`, `Relations`, `Nexus`, `UNITAS`, `Suggestions`)가 허용목록에 없던 것.
- **i18n 정본 체인**: `docs/rev21/i18n/*.json`(플랫 점표기) → `scripts/i18n/apply-rev21.mjs` → `web/messages/*.json`. 이 스크립트는 **네임스페이스를 통째로 치환**(`messages[NS] = ns`)한다.
- **드래프트 화석**: 드래프트에는 후속 리비전이 `messages`에서 이미 삭제한 **56개 키**(구 스트림 kind 16종, `cogs.*` 네임스페이스 등)가 화석으로 남아 있었다. 그대로 apply하면 **폐기 키가 부활**한다.
- **`deeperFetch.ts`는 렌즈 전용이 아니다**: 이름과 달리 전역 위키미디어 레이트리밋 큐(`WIKIMEDIA_SPACING_MS`)를 소유하며 `awardsThemes`, `dataLadder`, `dataLadder2`가 의존한다. **삭제 금지**.
- **`deeperAdapters/open.ts` 타입 누수**: `app/api/live/entity-news/route.ts`가 `EntityNewsItem`/`EntityNewsResponse`를 type-import 한다. 이 라우트 파일은 인코딩 때문에 일반 `grep`이 "Binary file"로 보고하여 **누락되기 쉽다**(`grep -a` 필수).

---

## 2. 구현 설계 (PHASE 2)

### 2.1 M1 — 소거 목록

**삭제 (19 파일)**

| 분류 | 파일 |
|---|---|
| 컴포넌트 | `components/home/ExploreDeeper.tsx`, `components/home/deeper/DeeperThemePage.tsx`, `components/home/deeper/OmniTechSwarm.tsx` |
| 렌즈 엔진 | `lib/uai/deeperThemes.ts`, `lib/uai/useDeeperPage.ts`, `lib/uai/swarmLayout.ts` |
| 앵커 브릿지 | `lib/uai/anchorBridge.ts`, `lib/uai/useAnchorBridge.ts` |
| 어댑터 | `lib/uai/deeperAdapters/{index,omniTech,open,wikidata,wikipedia}.ts` |
| 단위 테스트 | `__tests__/uai/{anchorBridge,deeperAdapters,deeperThemes,omniTechSwarm,swarmLayout}.test.ts` |
| E2E | `tests/web-cinema-e2e/rev25-anchor-bridge.spec.js` |

**보존 (감사가 지목한 오삭제 위험)**: `deeperAnchor.ts`(앵커 원시형, 14곳 의존), `entityResolve.ts`, `sourceRegistry.ts`, `deeperFetch.ts`(위키미디어 공용 큐).

**타입 이전**: `EntityNewsItem`/`EntityNewsResponse` → `lib/live/entityNews.ts`(라우트가 이미 import 중인 모듈), 라우트 1줄 재지정, 인코딩 보존.

**CSS**: `globals.css` 렌즈 레이아웃 + 스웜 블록(310줄) 삭제, `quantum-white-rev19.css` §22 재지정 + §24 스웜 블록(36줄) 삭제.

**i18n**: `Rev21.deeper` 하위 **143키 삭제**(테마 112 + 렌즈 UI 31), 20 로케일 동시. 생존 키는 `sourcesLabel`·`outboundLabel`·`loginHint`·`scope.*`(후자는 `DiscoveryCarousel`이 사용).

**스트림 kind**: `'deeper'` → `'omni'`, `STREAM_DEEPER_EVERY` → `STREAM_OMNI_EVERY`, `data-stream-card="omni"`, `stream.kinds.omni`("출처와 플랫폼", 20 로케일 신규 번역).

**출하 DOM 속성**: `anchorDataAttrs`의 `data-deeper-*` → `data-anchor-*`.

**외부 송출 문자열**: 위키미디어 User-Agent `UNITAS-ExploreDeeper/1.0` → `UNITAS-OmniOpen/1.0`.

### 2.2 신규 컴포넌트 — `components/home/OmniOpen.tsx`

3대 불변식을 **구조로 강제**한다(리뷰가 아니라 구조로).

1. **하나의 타이틀, 두 자리** — 두 헤딩이 단일 상수 `ROW_TITLE_CLASS`에서 파생. 동일 아이콘(`ExternalLink size={13}`), 동일 박스. 픽셀 동일성이 "맞춘 상태"가 아니라 **드리프트가 불가능한 상태**가 된다.
2. **항상 쌍** — 두 행은 함께 렌더되거나 함께 렌더되지 않는다. 한쪽만 나오는 prop도, 앵커 형태도 존재하지 않는다. 주제가 없으면(`term` 공백) `null` 반환 — DOM 트리 최적화.
3. **빈 행 없음** — 두 행 모두 맨 용어로부터 키리스 검색 URL을 만든다. §1.2의 구조적 결함 5곳이 원천 무효화된다.

**한계비용 0원**: fetch 0회, resolve 0회, 캐시 0개. 모든 href는 넘겨받은 앵커에서 동기적으로 파생된다.

### 2.3 M2/M3 — 행 구성

```
<section data-omni-open data-anchor-kind data-host>
  <p data-omni-row="sources">    [⧉] 다른출처에서열기   Wikipedia · Wikidata · Wiktionary · Wikimedia Commons · Open Library
  <p data-omni-row="platforms">  [⧉] 다른플랫폼에서열기 Google · Bing · Scholar · WolframAlpha · arXiv · GitHub · YouTube · Reddit · X · LinkedIn · Facebook · Instagram · Threads · TikTok
</section>
```

- 출처(코퍼스)와 플랫폼(빅테크)은 **교집합 0**. 의미 분리가 명칭 분리와 일치한다.
- `compact`(키워드 티어·랭킹 팝업): 출처 3 + 플랫폼 3.
- URL 정책은 `sourceRegistry.omniOpenUrl()` 단일 정본 — 순수 함수라 단위 테스트가 가능하다.

### 2.4 M3 — 20 로케일 라임 동기화

두 라벨은 **앞뒤 구조가 동일한 문장**으로 창조되었다.

| | 다른출처에서열기 | 다른플랫폼에서열기 |
|---|---|---|
| ko | 다른출처에서열기 | 다른플랫폼에서열기 |
| en | Open from other sources | Open from other platforms |
| ja | 他の出典で開く | 他のプラットフォームで開く |
| zh | 在其他来源打开 | 在其他平台打开 |
| de | Andere Quellen öffnen | Andere Plattformen öffnen |
| fr | Ouvrir dans d'autres sources | Ouvrir dans d'autres plateformes |
| es | Abrir en otras fuentes | Abrir en otras plataformas |
| pt | Abrir em outras fontes | Abrir em outras plataformas |
| it | Apri in altre fonti | Apri in altre piattaforme |
| nl | Openen in andere bronnen | Openen in andere platforms |
| pl | Otwórz w innych źródłach | Otwórz w innych platformach |
| ru | Открыть в других источниках | Открыть в других платформах |
| tr | Diğer kaynaklarda aç | Diğer platformlarda aç |
| et | Ava teised allikad | Ava teised platvormid |
| vi | Mở ở nguồn khác | Mở ở nền tảng khác |
| th | เปิดในแหล่งอื่น | เปิดในแพลตฟอร์มอื่น |
| id | Buka di sumber lain | Buka di platform lain |
| tl | Buksan sa ibang pinagmulan | Buksan sa ibang platform |
| hi | अन्य स्रोतों में खोलें | अन्य प्लेटफ़ॉर्मों में खोलें |
| km | បើកនៅប្រភពផ្សេង | បើកនៅវេទិកាផ្សេង |

---

## 3. 검증 계약

| 계약 | 위치 | 무엇을 못 박는가 |
|---|---|---|
| 데이터 규칙 | `web/__tests__/uai/omniOpen.test.ts` (8) | 출처·플랫폼 교집합 0, 모든 항목이 맨 용어로 검색 URL 생성(홈페이지 폴백 금지), 식별자 있을 때만 정확 문서로 승격, 언어 접두가 언어별 위키 호스트에 도달 |
| DOM 규칙 | `tests/web-cinema-e2e/rev29-verify.spec.js` "M2.4 / REV-31" | 렌즈 잔재 0건(`data-explore-deeper`/`data-deeper-theme`/`data-omni-swarm`), 두 행 가시, 출처 행이 **직전 형제**(`nextElementSibling`), 출처가 위, 두 타이틀의 fontSize·color·weight·textTransform·letterSpacing·fontFamily·columnGap·height 8항목 일치 |
| i18n 패리티 | `web/__tests__/i18n/rev21Parity.test.ts` | 20 로케일 키셋 동일, ICU 보존, 빈 문자열 0, 드리프트 허용목록은 브랜드·동형어만 |

---

## 4. 미해결 / 창립자 판단 필요

1. **옴니-테크 스웜 소멸** — REV-24 M4로 신설되고 REV-25 M1(앵커 브릿지)이 도달성을 복구했던 스웜은, 유일한 진입로인 `bigTechPulse` 렌즈 타일과 함께 소멸했다. M1 지령의 직접적 귀결이며, 재도입을 원하실 경우 독립 진입로(전용 모듈/라우트)가 필요하다.
2. **`nearby` 슬롯 QID 폴백 누락** — `DiscoveryCarousel:674`의 `placeAnchor(...)`는 날씨 슬롯(`:620`)과 달리 QID 폴백 인자가 없다. REV-31의 용어 기반 URL이 증상(빈 행)은 원천 차단했으나, 정확 문서 링크는 여전히 얻지 못한다. 인자 1개 추가로 해결 가능하나 본 지령 범위 밖이라 보류했다.
3. **레거시 모듈 파일명** — `deeperAnchor.ts`(앵커 원시형)·`deeperFetch.ts`(위키미디어 큐)는 이름만 레거시이고 기능은 "더 깊이 탐색"과 무관한 공용 기반이다. 14곳·5곳이 의존하므로 개명은 별도 구간으로 분리했다. 출하되는 DOM·문자열·i18n에는 잔재가 0건이다.
