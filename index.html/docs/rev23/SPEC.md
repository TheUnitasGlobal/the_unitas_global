# REV-23 — 초비상 보안 게이트 · U-AI 팝업 재설계 · 옴니-테크 다차원 확장

정본 지침: `CLAUDE.md` (Ultimate Sovereign Master Codex v26.0)
창립자 지령 접수: 2026-09-13 / 9대 혁신 지시 중 6대 미션 + 무결성 게이트

---

## M1 — 초비상 보안 게이트 및 라우팅 강제화 (최고 우선순위)

### 실측된 결함
- 퍼널(로고→게이트→광고1~5→커밍순)은 **전적으로 클라이언트 오버레이**다.
  `app/[locale]/layout.tsx` → `<ComingSoonCinema/>` (z-500 fixed overlay).
- 서버는 **메인 홈페이지 HTML 전문을 항상 전송**한다. 외부 딥링크(Bing 등)로
  들어온 방문자에게도 본문이 그대로 나가고, JS 차단·DOM 조작·리더모드로
  커튼을 걷어내면 메인이 노출된다. `middleware.ts`에는 퍼널 강제 로직이 없다.
- 즉 현행 게이트는 **fail-closed 시늉일 뿐 물리적 차단이 아니다.**

### 조치 (서버 강제 · fail-closed)
1. `lib/gate/funnelGate.ts` (신규, 순수 함수):
   - `GATE_PATH_SEGMENT = 'gateway'` (Next는 `_` 접두 폴더를 라우팅에서 제외하므로 `__gateway` 불가)
   - `isGateExemptPath(pathname)` — `/api/*`, `/_next/*`, 정적 자산, `sitemap`,
     `robots`, IndexNow 키, `/gateway` 자신.
   - `isIndexerAgent(ua)` — Googlebot / bingbot / YandexBot / NaverBot(Yeti) /
     SeznamBot / DuckDuckBot / Applebot / Slurp / facebookexternalhit /
     Twitterbot / LinkedInBot + `IndexNow`. SEO 제국(제13장) 보존용.
   - `resolveGateVerdict({pathname, ua, hasSovereign, bypass})`
     → `'pass' | 'seal'`.
2. `middleware.ts`: 로케일 확정 **이후**, `seal` 판정이면
   `/<locale>/gateway`로 이동시키고 `x-unitas-gate: seal|pass`를 각인한다.
   **[구현 중 정정]** 최초 설계는 주소창 URL 보존을 위해 `rewrite`였으나,
   빌드된 서버에서 실측한 결과 App Router 클라이언트가 라우트를 바꾸는
   미들웨어 재작성을 초기 문서에서 조정하지 못해 **모든 봉인 로드가 React
   #418 → #423을 던지고 전체 클라이언트 재렌더로 폴백**했다(gateway 직접
   진입은 오류 0으로, 재작성이 원인임을 분리 확인). 그 폴백이 헤드 부트스트랩의
   `data-splash="off"` 사전 각인을 지워 창립자의 round-14 "서브뷰 새로고침 시
   로고 페이지 재생 금지" 규칙까지 깨뜨렸다. 딥링크 URL 보존은 MISSION 1의
   요구가 아니고 퍼널 통과가 요구이므로 **307 리다이렉트**로 확정했다
   (`Cache-Control: no-store`, `Vary: Cookie, User-Agent`).
3. `app/[locale]/gateway/page.tsx` (신규): 정적 생성(20 로케일),
   본문 0바이트 — 레이아웃의 커튼만 그린다. `robots: noindex`.
4. `app/[locale]/layout.tsx`: `__gateway` 재작성 시 NavBar 등 크롬이 커튼
   아래에 남지 않도록 `data-unitas-sealed` 스탬프. (커튼은 이미 불투명)
5. 우회 경로는 정확히 셋: **소버린 HttpOnly 서명 세션**,
   **인덱서 UA 허용목록**, **`UNITAS_GATE_BYPASS=1` (로컬/E2E 전용)**.
   프로덕션 기본값은 강제(enforce).
6. 정적 생성 보존: 레이아웃에서 `headers()`를 읽지 않는다 — 판정은 전부
   미들웨어(엣지)에서 끝난다. 684 페이지 SSG 그대로.

### 검증
`__tests__/gate/funnelGate.test.ts` — exempt/indexer/verdict 진리표 전수.

---

## M2 — U-AI 팝업 아키텍처 및 액션 물리적 정밀 재설계

### 2.1 미입력 팝업 고정 (실측 결과 반영)
- 현행: `ouroboros = focused && !typing` 에서만 `<HotShortcutMatrixStrip/>`
  (= DiscoveryCarousel + HotIssueNewsList)가 렌더된다. **뉴스는 이미 미입력
  전용**이다. 남은 누수는 스트림(`news` 카드)이 아니라 **입력 중 드롭다운이
  ouroboros 스트립과 동시에 살아있을 수 있는 프레임** — `typing` 전환이
  `value.length>0`에만 걸려 IME 조합 첫 프레임에서 겹친다.
- 조치: 스트립 렌더 조건을 `ouroboros && !hasText` 로 강화하고,
  `data-news-scope="empty-only"` 계약 속성을 심어 E2E로 고정한다.

### 2.2 검색 결과 팝업 다이어트 (27 kind → 11)
| 유지 | 현행 kind | 라벨 정정 |
|---|---|---|
| 웹 실시간 종합 | `sources` | `kinds.sources` = "웹 실시간 종합" |
| 다른 곳에서 탐색 | `deeper` | OutboundRow 흡수 + MS 등 신규 테마 |
| 연결된 개념 | `concepts` | — |
| 관련 사이트 | `sites` | — |
| 파생 저작 | `derived` | — |
| 관심의 파동 | `attention` | — |
| 커뮤니티 | `community` | — |
| 관계망 | `graph` | — |
| 세계 각 판 | `global` | — |
| 뉴스 | `news` | — |
| 본문 발췌 | `extracts` | — |

**영구 삭제 (16 kind + 5 블록)**: `essence`(무료/유료 리포터·3초 입체 관점·
편향 실드·3단계 액션 체크리스트·스웜 교차 추론), `axisSpectrum`, `chain`,
`deepGate`(심층 통찰·The VOID), `identity`, `redesign`, `cogs`, `timeline`,
`visual`, `papers`, `backlinks`, `siblings`, `shelf`, `art`, `number`,
`earthEvents`.
- `lib/uai/stream/streamTypes.ts` — `StreamCardKind` 유니온에서 제거,
  `streamRecipe`/`basePageKinds` 11종 순환으로 재작성, `WIKIMEDIA_LEG_COST`
  정리, `LOCAL_KINDS` 축소.
- `components/uai/stream/StreamLocalCards.tsx` — `EssenceCard`/
  `AxisSpectrumCard`/`ChainCard`/`RedesignCard`/`DeepGateCard` 삭제,
  `SourcesCard`만 남기고 OutboundRow 제거(→ deeper로 흡수).
- `components/uai/stream/StreamCards.tsx` — 삭제 kind의 case 제거,
  `CogsCardView`/`OutboundRow` 삭제.
- `lib/uai/stream/dataLadder*.ts` — 삭제 kind 어댑터 제거.
- `UaiHyperStream.tsx` — deepGate/insight/redesign 배선 및 props 제거.
- i18n: 삭제 kind 라벨 20 로케일 동시 제거, `kinds.sources` 재라벨.

### 2.3 클릭 UX — Two-step 액션
- 카드 셸(`CardShell`)의 **여백 클릭 오픈 제거**: 오픈 트리거를
  `[data-stream-title]` 텍스트 영역으로만 한정.
- 우측 상단 화살표 단축키(`qw-stream-open-arrow` / `ArrowUpRight`) 전면 삭제.
- 1회 클릭 = `data-selected="1"` 하이라이트/포커스, 2회째(또는 dblclick) =
  팝업 오픈. 순수 상태머신 `lib/uai/twoStepSelect.ts` + 유닛 테스트.
- 동일 규칙을 대제목/소제목/세부 연관 제목 전부에 적용.

### 2.4 뒤로가기 생명주기
`lib/uai/searchLevels.ts`의 3층(focus/typing/text)을 5층으로 확장:
`focus → typing → text → tower → card`.
back 순서: 카드 팝업 → 결과 타워 → 입력 텍스트 초기화 → 드롭다운 →
메인 홈 → (추가 back) ExitGuard 종료 팝업.

---

## M3 — 숏컷/뉴스 분리 및 하이퍼 수상 테마

### 3.1 역할 분리 (중복 0%)
- 실측 중복원: 숏컷 캐러셀의 9개 `HubThemeKey`(game·sports·movie·bestseller·
  shopping·stock·webtoon·fashion·food)는 **전부 Google/Bing 뉴스 RSS 와이어**다.
  실시간 뉴스(21축)와 동일 데이터원 → 중복.
- 조치: 숏컷 = **비(非)뉴스 실측 데이터/유틸리티**, 뉴스 = **뉴스 전용**.
  9개 hub 슬롯을 데이터형으로 재정의하거나 뉴스 레일로 이관.

### 3.2 타이틀 클렌징
- `HotNews.category.*` 21개에서 접두사 "세계" 전면 삭제 (20 로케일).
- `HotNews.all`("전체") 칩 및 `category.world`("세계실시간") 박스 폐기 —
  기능은 개별 테마로 흡수(첫 테마 자동 활성 + 각 테마가 자체 실시간 와이어).

### 3.3 뷰포트 고정 (Scroll-Jumping 박멸)
- 원인: 자동 회전/갱신 시 카드 높이 변화 + 포커스 이동이 스크롤 앵커를 파괴.
- 조치: 회전 컨테이너에 `overflow-anchor: none` + 고정 `min-height` 예약,
  갱신 전 `scrollY` 스냅샷 → `requestAnimationFrame` 복원
  (`lib/ui/scrollAnchor.ts` 신규 + 유닛 테스트).
- 뉴스 레일도 숏컷과 동일한 `DraggableCarouselRow` 오토 롤링으로 전환.

### 3.4 수상 테마 창조 (신규)
`lib/live/awardsThemes.ts` — 전 세계 최고 수상 레지스트리:
노벨 6개 부문(물리·화학·생리의학·문학·평화·경제), 튜링상, 필즈상,
아카데미상, 칸 황금종려, 그래미, 빌보드 뮤직 어워드, 퓰리처상, 부커상,
프리츠커상, 발롱도르, FIFA 올해의 선수, 타임 올해의 인물.
Wikidata SPARQL/`wbgetentities` 무키 호출 + 24h 소버린 캐싱. 0원.

---

## M4 — UNITAS 하이퍼 로고 브랜딩 (신규 창조)

- 실측 대상: `components/home/Hero.tsx` → `.qw-hero-wrap h1`,
  `app/quantum-white.css` L423 `color: var(--qw-ink)` = **Rich Black 평문**.
- 조치: `components/brand/UnitasWordmark.tsx` 신규 —
  다크 글래스모피즘 패널(backdrop-filter + inset 하이라이트) 위에
  네온 실버 메탈릭 림(1px conic-gradient 보더) + 딥 스페이스 그라데이션
  타이포(#f4f7ff → #9fb4d8 → #4a6ba8, 60fps GPU 합성 sheen 스윕).
  `prefers-reduced-motion` 정지, 다크/화이트 서피스 양쪽 대응.
- REV-20에서 실측 고정한 **수직 대칭 0.02px / 밑줄 폭 --qw-title-rule-h**
  계약을 깨지 않는다(회귀 금지).

---

## M5 — 단축키 드롭다운 전환 및 시각 밸런스

- `components/home/AttachMenu.tsx`: 모바일 바텀시트(팝업) 경로 폐기 →
  전 폭 즉시 드롭다운(150ms cubic-bezier, `position:absolute` 앵커).
  시트 헤더/닫기 버튼 삭제(드롭다운엔 불필요).
- `.qw-enter-key`: `border-accent/50 text-accent` → `border-white/25
  text-gray-300`, hover/포커스에서만 accent. `.qw-attach-toggle`과
  동일 박스 크기·보더 굵기·radius로 좌우 대칭.

---

## M6 — 옴니-테크 수속 확장 및 다차원 UI 재창조

- `lib/uai/deeperThemes.ts` 14 테마 → **+6 신규 다차원 테마**:
  `bigTechPulse`(MS/Google/AWS 생태계 신호), `sovereignFinance`(글로벌 금융망),
  `patentOrbit`(특허/IP 궤도), `standardsGrid`(국제 표준·규격),
  `talentFlux`(인재·고용 파동), `energyGrid`(에너지·기후 그리드).
  전부 무키 공개 API + 소버린 캐싱, 0원.
- `OUTBOUND_BRAND_ROW` 확장: Microsoft Bing/Copilot, Google Scholar,
  Wolfram Alpha, arXiv, Crunchbase, Statista 등.

---

## 무결성 게이트 (제25장)
`npm --prefix web run typecheck` · `cd web && npx vitest run` ·
`npm --prefix web run build` — 3종 EXIT 0 아니면 커밋·푸시·배포 전면 금지.


---

## 구현 중 확정된 정정 (실측 기반)

| 항목 | SPEC 초안 | 확정 | 근거 |
|---|---|---|---|
| M1 봉인 방식 | rewrite (URL 보존) | **307 redirect** | 재작성이 히드레이션을 깨뜨림(React #418/#423 → 전체 재렌더 → `data-splash` 각인 소실). gateway 직접 진입은 오류 0 |
| M1 라우트명 | `__gateway` | `gateway` | Next가 `_` 접두 폴더를 라우팅에서 제외 |
| M3.4 수상 소스 | Wikidata SPARQL | **CirrusSearch `haswbstatement` + `wbgetentities`** | 2026-09-13 실측 WDQS 전면 `429 … 1 req/min … active wdqs outage` |
| M6 신규 테마 | 6종 | **1종(`bigTechPulse`) + 수상 테마 + 아웃바운드 14종** | patentOrbit·standardsGrid·talentFlux는 키 없는 공개 API가 존재하지 않음; codeGenome은 소스 레지스트리에 GitHub 검색 API 반려 선행 판단이 기록되어 있어 뒤집지 않음 |
| M2.4 백 사다리 | focus/typing/text/tower/card 5층 | **focus/text/tower/card 4층** | 창립자 요구 꼬리가 정확히 3단(초기화→홈→종료)이므로 `typing` 히스토리 층 폐기 |
