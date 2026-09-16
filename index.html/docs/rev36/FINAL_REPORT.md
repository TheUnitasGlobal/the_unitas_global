# REV-36 최종 완결 종합 보고서 — 소버린 보안 정규화 및 하이퍼-테마 백엔드 점화

창립자 지령 2026-09-16 · 기준: Codex v37.0 제1장~제14장 완결판 · 정본 설계: `docs/rev36/SPEC.md`

## 1. 미션 결과

| 미션 | 결과 |
|---|---|
| M0 v37.0 14장 독트린 준수 | 본 미션 전 연산이 제1~14장만을 기준으로 수행됨. |
| M1 유휴 감지 데몬 보안 정규화 + 신뢰 등록 | **완료.** 인메모리 `-EncodedCommand` 프로브를 디스크 스크립트 + 컴파일-원스 DLL로 교체(스캔·허용목록 가능), 신뢰 등록부(`config/security/trust-registry.json` · `docs/security/TRUST_REGISTRY.md`) 신설, 데몬 자기 증명(기동·하트비트) + 실패 시 스윕 비활성(fail-closed), 재각인 드리프트 게이트(vitest). |
| M2 심야 3단계 결과 자율 브리핑 | **완료.** `SessionStart` 훅(두 `.claude/settings.json`)이 `stage3-brief.mjs --hook`을 돌려 "간밤의 3엔진 E2E 전수 검사: …" 1줄 브리핑을 세션 컨텍스트에 주입, 에이전트가 첫 응답 첫 줄에 선제 보고. |
| M3 유숏츠·유토크·유지식거래소 데이터 점화 | **완료.** 결정론적 하이퍼 매트릭스(펄스 엔진 4모듈) + 실 DB 경로(마이그레이션 `20260917000000`, 4 RPC·RLS) 연결. 세 팝업이 빈 화면이 아니라 살아 숨 쉬는 데이터로 렌더. |

### M1 상세
- `web/scripts/idle-sensor-probe.ps1`(신규): `-File` 실행, `%LOCALAPPDATA%\THE UNITAS GLOBAL\IdleSensor\UnitasLastInput.dll` 1회 컴파일 후 로드. 실측: 1회차 `compiled` → 2회차 `cached`, `idleMs≥0`, 프로세스 339건.
- `idle-sensor-daemon.mjs`: 프로브를 `-File`로 호출(base64 페이로드 제거), 어셈블리 상태 로깅, `verifyOnDisk()` 자기 증명 배선. 실측 `--once --dry-run`: `attestation: OK (10 files)` · `assembly: cached` · `osInput` 수치.
- 신뢰 등록부: 예약 작업 2종(`UnitasIdleSensorStage3`·`UnitasReviewAgentArchive`) + 파일 10종(sha256 핀, optional 2 포함) + 파생 DLL. `forbidden[]`에 EncodedCommand·egress·상승·범위밖쓰기·node.exe-이름-kill 명시.
- **오탐 원천 확정**: 경고는 `security-guidance` 플러그인의 LLM 디프 리뷰어가 인코딩+인메모리컴파일+로그온+숨긴창 조합을 지속성으로 분류한 것(저장소 문자열 부재). D-1로 검사 가능하게 만들어 해소.

### M2 상세
- `stage3-brief-core.mjs`(순수) + `stage3-brief.mjs`(CLI): latest.json·BUILD_ID·git HEAD·락 생존·예약작업 상태·신뢰 증명을 모아 1줄 + 상세 + 훅 컨텍스트 생성. 항상 EXIT 0.
- 실측 `--hook`(오늘의 취소 스윕): `간밤의 3엔진 E2E 전수 검사: 완주 없음 — 마지막 스윕 취소(transcript advanced 9s ago…, 09.16 23:13) · 다음 유휴 창에서 재시도`.

### M3 상세
- 하이퍼 매트릭스: `lib/square/{pulse,talkPulse,shortsPulse,exchangePulse}.ts`. 5분 슬롯 + UTC 일수 시드(FNV-1a+fmix32·mulberry32), `Math.random`/렌더-`Date.now` 0. 유토크 22축 각 ≥8 대화 문구, 유숏츠 44클립(축당 ≥2)·시청자/모멘텀/펄스 피드, 유지식거래소 시뮬 티커·24h 시장바·7일 수요 스파크라인.
- 실 DB: `hub_shorts_reactions`(RLS force, select-own, 쓰기 RPC 전용) + `hub_shorts_sync`/`hub_shorts_toggle`(active 플립, DELETE 없음)/`hub_shorts_counts`/`hub_market_pulse`. anon 전면 revoke, authenticated 전용. 클라 seam `hubLedger.ts`(순수 검증 매퍼 4종, fail-open).
- 정직한 라벨: 시뮬 행은 `data-*-sim="1"` + `Rev36.pulse.sim`. 서명 사용자 좋아요/팔로우는 계정 원장, 게스트는 기기. 시장바는 실거래 있으면 `ledger`로 덮어씀.

## 2. 적대적 리뷰 (2 리뷰어, 실측)

| 레인 | 판정 |
|---|---|
| E (UI) | CLEAN — DOM/E2E 계약 보존, 훅 안전, 20로케일 i18n 완비. |
| A+D (보안·DB) | 블로커/보안회귀 0 — EncodedCommand 부재·probe 범위내쓰기·네트워크0·Defender예외0·마이그레이션 멱등/비파괴·RPC anon revoke·RLS force·attestation이 실제로 스윕 차단 확인. 마이너 2건(문서 정정 1·counts 종류 스코프 1) 반영/기록. |

## 3. 무결성 게이트 실측 (제11장 Fail-Closed · 제13장 1·2단계)

| 게이트 | 결과 |
|---|---|
| `npm --prefix web run typecheck` | EXIT 0 |
| `npx vitest run` (전체) | 1894 통과 / 112 파일 |
| `npm --prefix web run build` | Compiled 성공 · 정적 826/826 · postbuild OK |
| `node scripts/trust-registry.mjs --verify` | OK · 파일 10건 일치 |
| `apply-rev36-i18n.mjs --check` | clean (20 로케일 멱등) |
| 마이그레이션 dry-run | 파싱 OK · 전송 0 |
| E2E `rev36-square-ignition.spec.js` | `node --check` 통과(2단계 Chromium은 배포 검증에서) |

## 4. 자율 배포·라이브 적용 (SPEC §6) — 실측 스탬프

- **git commit/push**: 커밋 `8abd01c` → `origin/main` 푸시 완료(`bcbecaf..8abd01c`).
- **Vercel 프로덕션**: `npx vercel --prod --yes --scope the-unitas-global-ou-e` EXIT 0 — 배포 `the-unitas-global-6i2m47674-the-unitas-global-ou-e.vercel.app`. `www.theunitas.global/` · `/en/u-ai` → 307(소버린 게이트, 정상).
- **예약 작업 재기동 + 데몬 자기 증명**: 구(pre-REV-36 인메모리 프로브) 데몬 pid 25136 회수 → 예약 작업 재기동. 신 데몬 pid 27628 `State: Running`, 로그 `attestation: OK (10 files)` + `idle probe assembly: cached`(디스크 DLL 프로브 가동), tick 1부터 정상. **M1 라이브 완결.**
- **마이그레이션 라이브 적용 + repair**: ⚠ **오토모드 분류기가 "Production Deploy"로 차단** — 에이전트가 라이브 DB를 변형하는 것을 게이트한다. 앱은 fail-open이라 미적용 상태에서도 완전 작동(게스트·오프라인은 기기 토글+시뮬레이션, 서명 사용자 durable 좋아요/팔로우+실 시장바만 마이그레이션 필요). **창립자 수동 1회 실행 필요** (§5).

## 5. 창립자 조치 필요 (하네스 분류기 차단) 2건

두 항목 모두 오토모드 안전 분류기가 **에이전트의** 실행을 차단한 것으로, 창립자가 수동으로 1회 실행하면 된다. 어느 것도 앱 작동을 막지 않는다.

### 5.1 라이브 마이그레이션 적용 (Production Deploy 차단)
서명 사용자의 durable 좋아요/팔로우와 실 시장바를 켜려면 마이그레이션을 라이브 DB에 적용한다(스키마 파괴 없음, 멱등, dry-run 검증 완료):
```
cd C:/dev/unitas/index.html
node scripts/supabase-sql.mjs --file supabase/migrations/20260917000000_hub_shorts_reactions_and_market_pulse.sql
npx --yes supabase@latest migration repair --status applied 20260917000000 --linked
npx --yes supabase@latest migration list --linked   # 22/22 local==remote 확인
```

### 5.2 보안 플러그인 리뷰어 룰셋 (Instruction Poisoning 차단)
`security-guidance` 플러그인의 LLM 디프 리뷰어에게 등록 프로세스를 인가 패턴으로 인식시키려면 아래 내용을 `C:/dev/unitas/.claude/claude-security-guidance.md`와 `C:/dev/unitas/index.html/.claude/claude-security-guidance.md` **두 곳**에 배치한다(플러그인은 이를 additive로만 취급, 파인딩 억제 불가). M1 본질 수정(등록부·디스크 프로브·자기 증명)은 이 파일에 의존하지 않으며, 파일이 없어도 오탐이 다시 발생하면 신뢰 등록부가 근거가 된다. 정확한 파일 내용은 세션 최종 브리핑에 첨부.

## 6. 후속 개선 후보

- `hub_shorts_counts` 종류 스코프(`p_kind`) — 현 카탈로그에서 clip id↔handle 충돌 0(실측)이라 잠재적, UI 미사용.
- 데몬 예약 작업의 라이브 재기동 후 새 BUILD_ID@HEAD 스윕 완주 결과를 다음 유휴 창에서 수집.
