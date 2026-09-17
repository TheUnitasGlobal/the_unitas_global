# REV-36 — 소버린 보안 정규화 및 하이퍼-테마 백엔드 점화 (창립자 지령 2026-09-16)

정본 위치: `index.html/docs/rev36/SPEC.md` · 기준: Codex v37.0 제1장~제14장 완결판(MISSION 0)
선행: REV-34(U-Square 20대 테마 셸) · REV-35(옴니-랭킹 통합 + 제13장 3단계 유휴 감지 데몬)

## 0. 지령

| 미션 | 요지 |
|---|---|
| M0 | v37.0 제1장~제14장만을 절대 기준으로 삼는다. |
| M1 | 유휴 감지 데몬(`UnitasIdleSensorStage3`)의 인메모리 `Add-Type`이 유발한 "Unauthorized Persistence" 오탐을 해소한다. 창립자 공식 인가 시스템 프로세스로 신뢰 목록(Trust Registry)에 영구 등록하고, 보안 룰셋을 갱신하여 정찰 에이전트·보안망이 이를 악성으로 오판해 Kill 하지 않게 한다. |
| M2 | 창립자가 수동으로 3단계 결과를 찾아보지 않게 한다. 에이전트가 새 세션으로 기동되거나 유휴에서 깨어날 때 `docs/stage3/READER.md` 절차를 백그라운드에서 즉시 실행해 "간밤의 3엔진 E2E 전수 검사: 에러 0건 통과" 형태의 1줄 브리핑을 선제 보고하는 초기화 스크립트를 구축한다. |
| M3 | U-Square 20대 테마 중 [유숏츠·유토크·유지식거래소] 3대 모듈에 실제 DB 연동(Supabase RPC/RLS) 또는 초정밀 시뮬레이션 데이터 매트릭스를 물리적으로 연결한다. 팝업을 열면 빈 화면이 아니라 살아 숨 쉬는 데이터가 폭발적으로 렌더링되어야 한다. |
| 게이트 | `npm --prefix web run typecheck` · `npm --prefix web run build` EXIT 0 → 커밋 → Vercel 프로덕션 → 최종 브리핑. |

## 1. 정찰이 확정한 전제 (2026-09-16 실측)

1. **경고의 발원지는 `security-guidance@claude-plugins-official`(v2.0.8) 플러그인의 LLM 디프 리뷰어**(Stop·commit·push 훅)다. 저장소 어디에도 "Unauthorized Persistence" 문자열은 없고, 플러그인의 정규식 패턴 목록에도 없다 — LLM 리뷰어가 `-EncodedCommand` + 인메모리 C# 컴파일(`Add-Type -TypeDefinition`) + 로그온 자동 기동 + 숨긴 창의 **조합**을 지속성(persistence) 기법으로 분류한 것이다. VibeSec은 미설치, `.github/agents/*.agent.md` 3종은 diff 리뷰어(프로세스 kill 권한 없음).
2. 플러그인은 프로젝트별 확장점을 공식 제공한다: `<cwd>/.claude/claude-security-guidance.md`(모든 LLM 리뷰 프롬프트에 첨부, "승인된 내부 패턴을 인식"시키는 용도, 8 KB 상한) + `<cwd>/.claude/security-patterns.json`(추가 정규식 경고). 세션 루트는 `c:/dev/unitas`와 `c:/dev/unitas/index.html` 둘 다 쓰이므로 **두 곳 모두**에 둔다.
3. 현재 데몬 프로브: `powershell -EncodedCommand <base64>`로 매 60초 틱마다 `Add-Type -TypeDefinition`(csc.exe 인메모리 컴파일) 실행. 예약 작업은 `Running`(Interactive/Limited, 0x41301), 세션은 비관리자, `pwsh` 없음(Windows PowerShell 5.1), `csc.exe` 존재, Defender 실시간 보호 ON.
4. 두 번째 예약 작업 `UnitasReviewAgentArchive`(`web/scripts/install-review-archive-task.ps1`)도 같은 부류의 "지속성"이므로 같은 등록부에 올린다.
5. Stage-3 산출: `test-results/stage3/{latest.json, latest.md, daemon.log, daemon.lock}`. 오늘 14:13Z 스윕은 1h40m 뒤 본 세션 시작으로 취소됨(`status: cancelled`, 합계 0 — 취소는 부분 집계). READER.md 절차 = latest.md → latest.json → `buildId`/`head`가 현재 `web/.next/BUILD_ID`·`git HEAD`와 같은지 → 취소면 판단 보류 → kind별(harness-flake / contract-drift / product-defect) 처리.
6. 3대 모듈의 현재 상태(REV-29/30): 유토크 = 22방 + Realtime 브로드캐스트 + 서명 사용자 `hub_messages` 영속(RPC 6종·RLS 5/5 라이브, 마이그레이션 21/21 local==remote 확인). 열면 "아직 대화 없음"만 보인다. 유숏츠 = 시드 14클립(축 22 중 12만 커버) + 기기 로컬 좋아요/팔로우, **DB 경로 0**. 유지식거래소 = 시드 24팩 + 기기/서버 2원장, 티커는 실거래 전까지 "신호 없음". 세 모듈 모두 E2E 계약: `[data-hub-tab-btn=shorts|rooms|exchange]`, `[data-unitas-shorts] [data-short]`, `[data-hub-rooms] [data-room]`×22, `[data-hub-packs] [data-pack]`, `[data-hub-room-input]`/`[data-hub-room-send]` → `[data-hub-msg][data-mine="1"]` 정확히 1.
7. 하우스 규칙: 시드/시뮬레이션은 FNV-1a(+fmix32)·mulberry32, `Math.random` 금지, 렌더 중 `Date.now()` 금지(state 초기화자 + 하이드레이션 후 갱신), 시드 텍스트는 전 로케일 공용 영어, UI 크롬만 20로케일 i18n(파리티 테스트 필수), 정직한 라벨(시뮬레이션은 시뮬레이션이라 말한다).

## 2. 결정 사항 (제4장 제로 핸즈)

- **D-1 (M1 근본 수정)**: 프로브를 `-EncodedCommand` 인라인에서 **디스크 상의 읽을 수 있는 파일** `web/scripts/idle-sensor-probe.ps1`(`-File` 실행)로 옮기고, `GetLastInputInfo` P/Invoke 타입은 **한 번만** `%LOCALAPPDATA%\THE UNITAS GLOBAL\IdleSensor\UnitasLastInput.dll`로 컴파일(`Add-Type -OutputAssembly`)한 뒤 이후 틱은 `Add-Type -Path`로 로드한다. 이유: 인메모리 컴파일은 해시로 허용목록에 올릴 수 없어 영원히 "미확인"이지만, 디스크의 DLL은 스캔·해시·허용이 가능하다. 로드 실패 시 1회 재컴파일, 그래도 실패면 `idleMs=-1`(fail-closed: 활동으로 간주, 스윕 없음).
- **D-2 (Trust Registry)**: `index.html/config/security/trust-registry.json`(기계용) + `docs/security/TRUST_REGISTRY.md`(정책). 예약 작업 2종·파일 7종(sha256 핀)·파생 어셈블리 1종. 검증/재각인 CLI `web/scripts/trust-registry.mjs`(`--verify|--write|--json`), 순수 코어 `trust-registry-core.mjs`(vitest). **데몬은 기동 시와 하트비트마다 자기 증명(attestation)을 수행**하고 실패 시 스윕을 비활성화(fail-closed)하며 로그에 남긴다. `__tests__/security/trustRegistryParity.test.ts`가 실제 파일 해시와 등록부의 일치를 빌드 게이트로 강제한다(등록 파일 수정 후 `npm run security:trust:write` 필수 — sync-codex 드리프트 게이트와 같은 계열).
- **D-3 (룰셋)**: `.claude/claude-security-guidance.md`(두 루트 동일 내용): 등록부에 오른 프로세스는 창립자 인가 패턴으로 인식하고, 대신 ① 등록부에 없는 새 지속성(예약 작업/자동 실행/서비스/Run 키) ② 등록 프로세스의 새 네트워크 송신(127.0.0.1:3123 외)·권한 상승·저장소 밖 쓰기·`-EncodedCommand` 재도입 ③ 등록 파일 수정 후 미재각인(드리프트)을 **추가 검사**로 명시한다(플러그인 신뢰 모델: 억제 금지·추가 허용). `.claude/security-patterns.json`: `Register-ScheduledTask|schtasks /create|-EncodedCommand` 편집 시 등록부 갱신 리마인더. `.github/agents/unitas-claude-reviewer.agent.md`에 등록부 참조 1~2줄(Edit 툴 전용 — Bash 쓰기는 자기수정으로 차단됨).
- **D-4 (Defender 예외 없음)**: 사용자 쓰기 가능 폴더를 AV 스캔에서 제외하는 것은 그 자체가 구멍이다. 해법은 산출물을 **스캔 가능하게** 만드는 것(D-1)이지 보이지 않게 만드는 것이 아니다. 관리자 권한도 요구하지 않는다.
- **D-5 (M2 실행체)**: Claude Code `SessionStart` 훅(matcher `startup|resume|clear|compact`)이 `node index.html/web/scripts/stage3-brief.mjs --hook`을 실행하고, 그 stdout(1줄 브리핑 + 상세 + "첫 응답 첫 줄에 그대로 선제 보고" 지시)이 세션 컨텍스트로 주입된다. 순수 코어 `stage3-brief-core.mjs`가 READER.md 절차(신선도·상태·kind 분류)를 결정론적으로 계산한다. 훅은 20초 상한, 항상 EXIT 0(브리핑 실패가 세션을 막지 않는다). 두 루트의 `.claude/settings.json` 모두에 등록.
- **D-6 (M3 데이터 전략 = 둘 다)**: ① **하이퍼 매트릭스 엔진**(`web/lib/square/pulse.ts`·`talkPulse.ts`·`shortsPulse.ts`·`exchangePulse.ts`): 시간 슬롯(5분)과 UTC 일수에서 결정론적으로 파생되는 시뮬레이션 — 네트워크 0, 0원, 오프라인 동일, SSR/CSR 일치. ② **실 DB 경로 확장**: 새 마이그레이션 `20260917000000_hub_shorts_reactions_and_market_pulse.sql`(`hub_shorts_reactions` 테이블 + RLS + `hub_shorts_sync`/`hub_shorts_toggle`/`hub_shorts_counts`/`hub_market_pulse` RPC, authenticated 전용, anon 전면 revoke, 멱등, drop/truncate 0)로 유숏츠에 처음으로 계정 원장을 주고, 유지식거래소의 시장 지표는 서버 원장에 실거래가 있으면 실수치로 덮어쓴다. 시뮬레이션 행은 DOM(`data-*-sim="1"`)과 라벨(`Rev36.pulse.*`)로 정직하게 표시한다.
- **D-7 (i18n)**: 새 키는 `Rev36` 네임스페이스, `scripts/apply-rev36-i18n.mjs`(20로케일 실번역, SET 전용) + `__tests__/i18n/rev36Parity.test.ts`. 시뮬레이션 본문(대화 문구·클립 제목·핸들)은 하우스 규칙대로 전 로케일 공용 영어.
- **D-8 (E2E 계약 보존)**: §1-6의 기존 셀렉터·개수 계약은 그대로. 시뮬레이션 대화 행은 `[data-hub-msg]`가 **아니라** `[data-hub-msg-sim="1"]`, `data-mine`은 절대 `"1"`이 아니다. 새 스펙 `tests/web-cinema-e2e/rev36-square-ignition.spec.js`는 3엔진 모두에서 통과해야 한다(데몬이 전수 실행).
- **D-9 (실행 금지 목록 — 레인 에이전트)**: `npm run build` 금지(통합 단계 1회), `git commit/push` 금지, 마이그레이션 라이브 적용 금지, 예약 작업 재시작 금지, `messages/*.json` 직접 편집 금지(적용기 스크립트로만), 전체 E2E 금지(제13장 1단계).
- **D-10 (라이브 적용·재기동은 통합 단계에서)**: 게이트 통과 후 본 세션이 ① `node scripts/supabase-sql.mjs --file <migration>` + `supabase migration repair --status applied 20260917000000` ② `npm run security:trust:write` 최종 각인 ③ 예약 작업 Stop/Start로 새 데몬 기동 + `daemon.log`에 `attestation: OK`·`osInput` 수치 확인 ④ 커밋·푸시·배포.

## 3. 파일 소유권 레인

| 레인 | 소유 파일(생성·수정) | 금지 |
|---|---|---|
| **A · M1 보안** | `web/scripts/idle-sensor-probe.ps1`(신규) · `web/scripts/idle-sensor-daemon.mjs` · `web/scripts/install-idle-sensor-task.ps1` · `web/scripts/trust-registry.mjs`(신규) · `web/scripts/trust-registry-core.mjs`(신규) · `config/security/trust-registry.json`(신규) · `docs/security/TRUST_REGISTRY.md`(신규) · `.claude/claude-security-guidance.md` + `.claude/security-patterns.json`(**두 루트**: `c:/dev/unitas/.claude/`, `index.html/.claude/`; 신규) · `.github/agents/unitas-claude-reviewer.agent.md`(Edit 툴) · `docs/stage3/README.md` · `web/package.json`(스크립트 `security:trust:verify`·`security:trust:write`·`stage3:brief`) · `web/__tests__/security/*.test.ts`(신규) | `idle-sensor-core.mjs` 시그니처 변경, READER.md, settings.json |
| **B · M2 브리핑** | `web/scripts/stage3-brief-core.mjs`(신규) · `web/scripts/stage3-brief.mjs`(신규) · `web/__tests__/stage3/briefCore.test.ts`(신규) · `docs/stage3/READER.md` · `c:/dev/unitas/.claude/settings.json` + `index.html/.claude/settings.json`(hooks.SessionStart 추가만) | package.json, README.md, 데몬 파일 |
| **C · M3 엔진+i18n** | `web/lib/square/pulse.ts`·`talkPulse.ts`·`shortsPulse.ts`·`exchangePulse.ts`(신규) · `web/lib/live/shortsSeed.ts`(카탈로그 44개로 확장) · `web/lib/hub/knowledgeExchange.ts`(`TradeEvent.sim?: true` 1필드만) · `web/scripts/apply-rev36-i18n.mjs`(신규, 실행) · `web/__tests__/square/pulse.test.ts`(신규) · `web/__tests__/i18n/rev36Parity.test.ts`(신규) | 컴포넌트, CSS, hubLedger.ts, 마이그레이션 |
| **D · M3 DB+seam** | `supabase/migrations/20260917000000_hub_shorts_reactions_and_market_pulse.sql`(신규) · `web/lib/hub/hubLedger.ts`(추가만) · `web/__tests__/hub/hubLedger.test.ts`(추가) · `web/__tests__/hub/schemaParityRev36.test.ts`(신규) | 컴포넌트, lib/square, 라이브 적용 |
| **E · M3 UI** (C·D 완료 후) | `web/components/home/hub/UnitasShorts.tsx` · `ThemeChatRooms.tsx` · `KnowledgeExchange.tsx` · `web/app/unitas-hub.css`(REV-36 섹션 추가) · `tests/web-cinema-e2e/rev36-square-ignition.spec.js`(신규) | lib, i18n, 마이그레이션 |

## 4. 계약 (레인 간 인터페이스)

### 4.1 Trust Registry (레인 A → B·통합)
- `config/security/trust-registry.json`: `{ version: 1, doctrine, authorizedBy, authorizedAt, updatedAt, entries: Entry[] }`. `Entry.kind ∈ 'scheduled-task' | 'file' | 'derived-assembly'`. `file`은 `path`(index.html 기준 상대, `/` 구분자)·`sha256`(소문자 hex 64)·`purpose`·`doctrine`; `scheduled-task`는 `name`·`trigger`·`principal`·`action`·`allowed[]`·`forbidden[]`; `derived-assembly`는 `path`(환경변수 표기 허용)·`source`(엔트리 id)·`pinned: false`.
- `web/scripts/trust-registry-core.mjs`(순수): `parseRegistry(json) → Registry`(형식 오류는 throw), `fileEntries(reg)`, `compareDigests(reg, actual: Record<path, sha256|null>) → { ok, verified: string[], mismatched: {path, expected, actual}[], missing: string[] }`, `stampRegistry(reg, actual, updatedAt) → Registry`, `attestationLine(verdict) → string`(한국어 1줄).
- `web/scripts/trust-registry.mjs`: CLI(`--verify` 불일치/누락 시 EXIT 1, `--write`, `--json`) + `export async function verifyOnDisk(repoRoot?: string) → { ok, verdict, line }`. 메인 판별은 `import.meta.url === pathToFileURL(process.argv[1]).href`.
- 데몬 로그 형식: `attestation: OK (<n> files)` / `ATTESTATION FAILED: <line>`; 실패 중 틱 결정 로그는 `decision: NOT idle -- blockers: attestation`.

### 4.2 Stage-3 브리핑 (레인 B)
- `stage3-brief-core.mjs`(순수): `classifyFreshness(latest, {buildId, head}) → 'fresh'|'stale'|'none'`; `buildBrief({ latest, buildId, head, lockAlive, task: {installed, state}, attestation: {ok, line}|null, now, baseline }) → { line, severity: 'pass'|'fail'|'cancelled'|'none'|'stale', details: string[], action: string|null }`; `briefToHookContext(brief) → string`.
- 1줄 형식(정확히):
  - 통과·신선: `간밤의 3엔진 E2E 전수 검사: 에러 0건 통과 (통과 N · 스킵 S · 총 T · 빌드 <buildId 앞 7> · HEAD <head 앞 7> · <종료 시각 KST>)`
  - 실패: `간밤의 3엔진 E2E 전수 검사: 실패 F건(제품 결함 a · 계약 드리프트 b · 하네스 플레이크 c) · 통과 N/T · HEAD <7> → @docs/stage3/READER.md 절차 필요`
  - 취소: `간밤의 3엔진 E2E 전수 검사: 완주 없음 — 마지막 스윕 취소(<cancelReason>, <시작 KST>) · 다음 유휴 창에서 재시도`
  - 기록 없음: `간밤의 3엔진 E2E 전수 검사: 기록 없음 — 아직 완주한 스윕이 없습니다 (데몬 <실행 중|정지|미설치>)`
  - 옛 빌드(통과/실패인데 buildId 또는 head 불일치): 앞에 `[옛 빌드] ` 접두 + details에 현재 빌드/HEAD.
  - 증명 실패 시 어느 경우든 뒤에 ` · ⚠ 신뢰 증명 실패: 스윕 비활성 → npm run security:trust:verify` 추가.
- 훅 컨텍스트: 첫 줄 `[Stage-3 자율 브리핑 · Codex 제15장 3단계 · REV-36 M2]`, 둘째 줄 위 1줄, 이어서 details(`- ` 목록), 마지막 줄 `에이전트 지시: 창립자에게 보내는 첫 응답의 첫 줄에 위 브리핑 한 줄을 그대로 선제 보고하라. 되묻지 않는다(제6장 제로 핸즈). 실패가 있으면 READER.md 4단계로 분류만 보고하고 창립자 지시 없이 전수 E2E를 재실행하지 않는다.`

### 4.3 하이퍼 매트릭스 (레인 C → E)
- `web/lib/square/pulse.ts`: `PULSE_SLOT_MS = 300_000`, `pulseSlot(now)`, `dayIndexOf(now)`, `seedHash(s)`(FNV-1a + fmix32), `mulberry32(seed)`, `PULSE_HANDLES: readonly string[]`(40개, 기존 시드의 셀러/크리에이터 핸들 포함, `/^[a-z0-9.]+$/`), `pickHandle(rand)`.
- `talkPulse.ts`: `TALK_PULSE_COUNT = 12`, `TALK_PULSE_WINDOW_MS = 5_400_000`, `TALK_PHRASES: Record<HotNewsCategory, readonly string[]>`(축당 ≥ 8, 자연스러운 영어, 시의성 있되 시간 무관), `talkPulse(room, now): ChatMessage[]`(id `sim:<room>:<slot>:<i>`, `authorId` `sim:<handle>`, `author` 핸들, `at` 오름차순, 마지막은 now−0~4분, 전부 `isChatMessagePayload` 통과), `talkPresence(room, now): number`(7~63), `isSimulatedMessage(m)`.
- `shortsPulse.ts`: `ShortPulseStats { views, likes, followers, watching, momentum }`, `shortsPulseStats(short, now)`(views는 `shortStats` 기반 + 슬롯 성장, 시간에 대해 단조 비감소), `shortsTrending(clips, now)`, `ShortsFeedEvent { id, kind: 'like'|'follow'|'watch', handle, shortId, at }`, `shortsPulseFeed(now, count = 8)`.
- `exchangePulse.ts`: `exchangePulseTrades(now, count = 6): TradeEvent[]`(`sim: true`, 최근 60분), `packDemandSeries(pack, dayIndex): number[]`(7개, 0~100), `packMomentum(pack, dayIndex): 'up'|'flat'|'down'`, `MarketStats { volume24h, trades24h, traders24h, topTheme: HotNewsCategory }`, `exchangeMarketStats(now)`.
- `shortsSeed.ts`: `SHORTS_SEED` 44개(축 22 × 2 이상, id `/^[a-z0-9-]+$/` 유일, 기존 14개 유지).
- `knowledgeExchange.ts`: `TradeEvent.sim?: true`(선택), `isTradeEvent`는 그대로 통과.
- i18n `Rev36`(en 원문): `pulse.label` "Network pulse" · `pulse.sim` "simulation" · `pulse.note` "Simulated network pulse — deterministic, refreshed every 5 minutes. Your own actions and the account ledger are real." · `talk.presence` "{count} in the room" · `talk.pulseRoom` "Room pulse" · `shorts.watching` "{count} watching" · `shorts.trending` "Trending now" · `shorts.feed` "Live pulse" · `shorts.feedLike` "{handle} liked {title}" · `shorts.feedFollow` "{handle} followed @{creator}" · `shorts.feedWatch` "{handle} is watching {title}" · `shorts.sortTrending` "Trending" · `shorts.sortCatalogue` "Catalogue" · `shorts.account` "Likes and follows saved to your account" · `shorts.device` "Likes and follows on this device" · `exchange.market` "Market pulse" · `exchange.volume24h` "24h volume" · `exchange.trades24h` "24h trades" · `exchange.traders24h` "Active traders" · `exchange.topTheme` "Hot theme" · `exchange.demand` "7-day demand" · `exchange.momentumUp` "Rising" · `exchange.momentumFlat` "Steady" · `exchange.momentumDown` "Cooling" · `exchange.ledgerLive` "Live ledger figures".

### 4.4 DB seam (레인 D → E)
- `hubLedger.ts` 추가: `ShortsSync { liked: string[]; followed: string[] }`, `ShortsToggleResult { kind: 'like'|'follow'; target: string; on: boolean }`, `ShortsCounts = Record<string, number>`, `MarketPulse { volume24h: number; trades24h: number; traders24h: number; topTheme: HotNewsCategory | null }`; 순수 매퍼 `mapShortsSync`, `mapShortsToggle`, `mapShortsCounts`, `mapMarketPulse`; 호출 `hubShortsSync()`, `hubShortsToggle(kind, target)`, `hubShortsCounts(targets)`, `hubMarketPulse()` — 전부 기존 `rpc()` 경유(fail-open, `HubResult`).
- RPC 이름·인자: `hub_shorts_sync()`, `hub_shorts_toggle(p_kind text, p_target text)`, `hub_shorts_counts(p_targets text[])`, `hub_market_pulse()`; 오류 문구는 기존 화이트리스트(`Not authenticated`, `Too fast`) 재사용.

## 5. 검증 계약

| 단계 | 내용 |
|---|---|
| 레인 자체 | `npm run typecheck` EXIT 0 + 자기 레인의 `npx vitest run <dir>` EXIT 0 (web/에서). 빌드 금지. |
| 통합 1단계 | typecheck · `npx vitest run` 전체 · `npm run build` EXIT 0 · `node scripts/trust-registry.mjs --verify` EXIT 0 · `node scripts/stage3-brief.mjs --hook` 출력 확인. |
| 통합 2단계 | Chromium 단일 엔진: `rev36-square-ignition` + `rev29-verify` + `rev30-mobile-lifecycle` + `rev34-weather-square`. |
| 3단계 | 데몬이 다음 유휴 창에서 3엔진 전수(세션은 실행하지 않는다). |

## 6. 배포·라이브 적용 순서(통합, D-10)

1. 게이트 EXIT 0 → `security:trust:write` 최종 각인 → `git commit` → `git push origin main`.
2. `node scripts/supabase-sql.mjs --file supabase/migrations/20260917000000_hub_shorts_reactions_and_market_pulse.sql` → `npx supabase migration repair --status applied 20260917000000 --linked` → `migration list` 22/22.
3. `cd web && npx vercel --prod --yes --scope the-unitas-global-ou-e` → 프로덕션 200 확인.
4. `Stop-ScheduledTask`/`Start-ScheduledTask UnitasIdleSensorStage3` → `daemon.log`에 `attestation: OK`·`osInput` 수치·고아 프로세스 0 확인.
5. `docs/rev36/FINAL_REPORT.md` 각인 + 메모리 갱신 + 최종 브리핑.
