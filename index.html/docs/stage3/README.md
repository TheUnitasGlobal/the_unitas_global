# 3단계 유휴 감지 데몬 (Codex 제15장 3단계 실행체) -- REV-35 M2

정본 위치: `index.html/docs/stage3/README.md` · 지령: SPEC.md D-9 / D-10 / D-11 (2026-09-16)

## 무엇인가

Codex v41.0 제15장 3단계(구 v37.0 제13장) -- "최종 보고 후 또는 마지막 명령 후 10분간 활동이 없으면 백그라운드에서 3엔진(Chromium · WebKit · Mobile) 전수 검증을 조용히 구동하고, 창립자가 명령을 내리면 즉시 강제 중단" -- 의 **유일한 실행체**다. v37 감사(`memory/v37-doctrine-audit-findings.md` L30)가 확인했듯 REV-35 이전에는 하네스만 있고 그것을 부르는 주체가 0이었다.

세 파일로 구성된다.

| 파일 | 역할 |
|---|---|
| `web/scripts/idle-sensor-core.mjs` | **순수** 판정 함수(fs·process·시계 없음). `computeIdle`, `shouldCancel`/`cancelReasons`, `sweepKey`/`alreadySwept`, `classifyFailure`, `buildSummary`, `summaryToMarkdown`, `isLockStale`, `listeningPids`, `processTree`/`busyProcessesOf`, `parseArgs`. vitest `web/__tests__/stage3/idleSensorCore.test.ts`가 판정 테이블 전체를 증명한다. |
| `web/scripts/idle-sensor-daemon.mjs` | 장기 구동 Node 프로세스. 신호를 수집하고 코어가 결정한 대로 스폰·중단·기록만 한다. |
| `web/scripts/install-idle-sensor-task.ps1` | Windows 작업 스케줄러 등록기(`UnitasIdleSensorStage3`, 로그온 시 자동 기동). |

데몬은 **모델을 실행하지 않는다**(토큰 0, 0원). 제15장의 강제 티어 "SONNET 5 / HIGH"는 결과를 **읽는** 에이전트에 귀속된다 -- `docs/stage3/READER.md` 첫 줄.

## 어디에 기록되는가

모두 `index.html/test-results/stage3/` 아래(`.gitignore` L10 `test-results/`로 이미 무시됨).

| 파일 | 내용 |
|---|---|
| `<ts>.json` | Playwright JSON 리포터 원본(`PLAYWRIGHT_JSON_OUTPUT_FILE`). 리포터가 플러시하기 전에 취소되면 요약이 대신 기록된다. |
| `../stage3-artifacts/` | 스윕의 Playwright `outputDir`(`--output`). Playwright는 이 설정의 기본 outputDir을 `index.html/test-results`로 잡고 **실행 시작 시 통째로 지운다** -- 2026-09-16 첫 강제 스윕이 `stage3/`(락·로그 포함)를 데몬 밑에서 삭제한 실측. 그래서 스윕 산출은 형제 폴더로 격리한다. |
| `<ts>.log` | list 리포터 stdout/stderr. |
| `latest.json` | 마지막 스윕 요약: `status`(`passed`/`failed`/`cancelled`), `buildId`, `head`, `startedAt`/`finishedAt`/`durationMs`, `perProject`(chromium · webkit · mobile-chrome 각 expected/unexpected/flaky/skipped), `totals`, `failures[]`(project · file · title · error · kind), `cancelReason`, `exitCode`. |
| `latest.md` | 한국어 브리핑: 프로젝트별 합계표, REV-33 기준선(통과 587 · 스킵 33 · 총 621) 대비 증감, 3분류 실패 목록. |
| `daemon.log` | 틱 결정(변화 시·30틱마다 하트비트), 스윕 시작/취소/종료, 프로세스 정리 기록. |
| `daemon.lock` | `{pid, procStart, acquiredAt}` 단일 인스턴스 락. pid **와** 프로세스 생성 시각이 모두 일치하는 살아 있는 프로세스가 없으면 stale로 간주하고 인수한다. |

## 설치 / 상태 / 해제 (web/ 에서)

```
npm run idle:sensor:install-task     # 등록(멱등, -Force) + 즉시 기동
npm run idle:sensor:status           # 작업 상태 · 마지막 실행 · 락 · 최근 스윕
npm run idle:sensor:uninstall-task   # 중지 + 등록 해제
npm run idle:sensor:once             # 지금 신호와 판정만 출력(--once --dry-run), 스윕 없음
npm run idle:sensor                  # 전경에서 데몬 구동(디버그용)
node scripts/idle-sensor-daemon.mjs --once --idle-min 0 --interval-sec 20   # 강제 1회 스윕(검증용)
```

등록은 이 저장소의 어떤 것도(prebuild · Stop 훅 · CI) 자동으로 하지 않는다. D-11에 따라 "영구 각인" 지령이 곧 opt-in이며, 게이트 통과·커밋 후 본 세션이 한 번 등록한다.

작업 설정과 그 이유: `-AtLogOn` 현재 사용자 · principal `-LogonType Interactive -RunLevel Limited`(`GetLastInputInfo`는 대화형 세션의 입력만 본다; 세션 0에서는 유휴를 증명할 수 없어 fail-closed로 영원히 스윕 0) · `ExecutionTimeLimit 0`(데몬이지 잡이 아님) · `RestartCount 3 / 1분` · `MultipleInstances IgnoreNew`(락의 2차 가드) · `Priority 9` · 배터리 시 중단은 스케줄러 기본값 유지 · `powershell -WindowStyle Hidden -Command "& node ..."`(node.exe 콘솔 창 은폐).

## 유휴 판정표 (`computeIdle`)

유휴 ⇔ **네 신호 모두** 나이 ≥ `--idle-min`(기본 10분) **그리고** 바쁜 프로세스 0. 하나라도 못 읽으면 활동으로 간주(fail-closed).

| 신호 | 출처 | 근거(2026-09-16 실측) |
|---|---|---|
| `transcript` | `~/.claude/projects/**/*.jsonl` 최신 mtime(깊이 4, 서브에이전트 포함, **모든 프로젝트**) | 창립자 메시지·툴 호출마다 전진 -- 1차 신호. 다른 프로젝트 세션도 활동(D-11). |
| `git` | `.git/{index, logs/HEAD, HEAD, ORIG_HEAD, refs/heads/main}` 최대 mtime | `FETCH_HEAD` 제외 -- 백그라운드 fetch가 08:54에 갱신됐을 때 HEAD/index는 08:20이었다. |
| `worktree` | `web/` 아래 최신 파일(`.next` · `node_modules` · `test-results` · `tsconfig.tsbuildinfo` 제외, 5만 엔트리 상한) | 편집·postbuild(`ownership-manifest.json`)가 여기 찍힌다. |
| `osInput` | Windows `GetLastInputInfo` — **REV-36 M1: 디스크 프로브** `web/scripts/idle-sensor-probe.ps1`(`-File` 실행)이 반환. 네이티브 인터롭 타입은 `%LOCALAPPDATA%\THE UNITAS GLOBAL\IdleSensor\UnitasLastInput.dll`로 **1회 컴파일** 후 로드(더는 인메모리 `-EncodedCommand` 아님 → 스캔·허용목록 가능). 프로세스 표도 같은 프로브가 함께 반환. | 세션 작업 중에도 85~110분 유휴로 읽힘 → **필요조건일 뿐 충분조건이 아님**. 조회·컴파일 실패 시 `idleMs=-1`(활동으로 간주, fail-closed). |
| `busy` | `Win32_Process` 명령줄이 `next build` · `tsc --noEmit` · `sync-codex` · `playwright test`(`test-server` 제외)와 일치, 데몬 자기 트리 제외 | Stop 훅이 파일을 건드리기 전 첫 몇 초를 막는다. |

추가 전제: `web/.next/BUILD_ID`가 없으면 "no build"만 기록하고 **절대 빌드하지 않는다**(백그라운드 빌드는 Stop 훅과 경쟁하며 구동 중 서버 밑의 `.next`를 다시 쓴다). 같은 `BUILD_ID@HEAD`는 완주 1회만 스윕한다(`latest.json`에서 복원).

## 신뢰 등록·자기 증명 (REV-36 M1)

데몬은 창립자가 공식 인가한 상주 자동화다. `-EncodedCommand` 인메모리 컴파일이 "비인가 지속성"으로 오탐되던 문제를 없애기 위해 프로브를 디스크 스크립트로, 인터롭 타입을 디스크 DLL(컴파일-원스)로 옮겼고, 인가 사실을 **신뢰 등록부** `config/security/trust-registry.json`에 각인했다(정책: `docs/security/TRUST_REGISTRY.md`).

- **자기 증명**: 데몬은 기동 시와 30틱마다 `verifyOnDisk()`(`web/scripts/trust-registry.mjs`)로 자기 파일 해시를 등록부와 대조한다. 일치하면 `attestation: OK (<n> files)`, 불일치·누락·미각인이면 `ATTESTATION FAILED: …`를 로그에 남기고 **스윕을 비활성화(fail-closed)** 하며 틱 결정은 `NOT idle -- blockers: attestation`이 된다. 정지 없이 다음 `--write` 재각인으로 자동 회복한다.
- **재각인 게이트**: 등록된 파일(데몬·코어·프로브·등록기·CLI 등)을 수정하면 `cd web && npm run security:trust:write`로 해시를 다시 각인해야 한다. 안 하면 `__tests__/security/trustRegistryParity.test.ts`가 빌드를 실패시킨다.
- **확인 명령**: `npm run security:trust:verify`(불일치 시 EXIT 1), `npm run idle:sensor:status`(작업 상태 + DLL 존재 + 신뢰 검증).

## 취소 의미론 (`shouldCancel`)

스윕 중 매 `--interval-sec`(기본 60초)마다 신호를 다시 수집한다. 어떤 신호든 스윕 시작 시각을 넘어 전진했거나, 못 읽게 됐거나, 바쁜 프로세스가 나타나면:

1. `taskkill /PID <playwright> /T /F` -- 자기 자식 트리(워커·브라우저·`next start` 웹서버)만.
2. `netstat -ano`로 `:3123` LISTENING 소유자를 찾아, 명령줄이 `next start`인 경우에만 `taskkill /T /F`(`reuseExistingServer: true`라 고아가 남으면 다음 스윕이 옛 빌드를 검사한다). **node.exe를 이름으로 죽이지 않는다**(claude-mem 워커, VS Code의 playwright test-server가 node.exe다).
3. `status: 'cancelled'` 기록(`latest.json`/`latest.md`/`<ts>.json`). **취소는 스윕으로 세지 않는다** -- 다음 유휴 창에서 재시도.

SIGINT/SIGTERM/SIGBREAK/SIGHUP도 같은 경로로 정리한 뒤 락을 해제한다. 스윕 자식은 `os.setPriority(pid, 19)`(IDLE 클래스, 트리 상속)로 실행되어 창립자 작업과 CPU를 다투지 않는다.

## 실패 3분류 (`classifyFailure`)

| 종류 | 규칙 |
|---|---|
| `harness-flake` | WebKit에서만 실패(같은 spec이 다른 프로젝트에서 통과) **또는** 오류 텍스트가 WebGL · GPU · 프레임 대기 타임아웃(REV-26/28: 이 하네스의 WebKit은 GPU 경로가 없어 555~698ms/프레임) |
| `contract-drift` | 로케일 텍스트 · i18n · 타이틀 카피에 대한 단언(제목/파일명이 i18n·locale·copy 등을 담거나 `toHaveText`/`toContainText`/`toHaveTitle`/`Expected string:` 매처) |
| `product-defect` | 그 외 전부 |

## 왜 로컬인가 (0원) -- GitHub Actions를 거부한 이유

- **유휴의 정의가 이 머신에 있다.** Claude 트랜스크립트 · git · 워크트리 · 키보드는 CI가 알 수 없는 신호다. Actions에는 "창립자가 쉬고 있다"는 개념 자체가 없다.
- **0원 위반.** 3엔진 전수는 1.5시간 급이고 Linux 러너는 분 단위로 과금된다(프라이빗 저장소 무료 2,000분/월). 로컬 데몬의 한계 비용은 0원이다.
- **기준선과 비교 불가.** REV-26/28 렌더 프로브 기준선은 Windows WebKit(555~698ms/프레임)에서 측정됐다. Linux WebKit은 다른 하네스라 수치가 이어지지 않는다.
- **러너 한계.** 826페이지 `next build`는 7GB 러너에서 한계선이고, 데몬은 애초에 빌드하지 않는 설계다.
- 저장소의 CI는 이제 루트 `.github/workflows/quality-gates.yml` 하나뿐이고, 그 게이트는 typecheck · vitest · build · **Chromium 단독** E2E만 돌린다. 3엔진(실제로는 6프로젝트) 전수는 의도적으로 거기에 없다 -- 온디맨드 Chromium 2차 의견(`workflow_dispatch`)이라면 몰라도, 3단계 본체는 아니다. (레거시 `deploy-site.yml`/`deploy-supabase.yml`은 REV-40에서 파기됐다: `index.html/.github/workflows/`에 있어 GitHub이 한 번도 읽은 적이 없었다.)

## 활성 세션 재검증 (D-10) -- 2026-09-16 실측

- (b) `--once --dry-run` 세션 중(13:21Z): `NOT idle -- blockers: transcript (4s ago), worktree (12s ago)`; 같은 순간 `osInput`은 1h 50m 유휴로 읽혔다.
- (c) `--once --idle-min 0 --interval-sec 5` 강제 스윕(13:30:35Z 시작) → t+14s에 `0.0.0.0:3123 LISTENING`(pid 24252)과 IDLE 트리(데몬 → `@playwright/test/cli.js test` → `workerProcessEntry.js` → `chrome-headless-shell.exe`, `cmd /c next start -p 3123`) 및 락 `{pid:25500, procStart}` 확인 → `web/__tests__/stage3/idleSensorCore.test.ts` 터치(13:30:48Z; `docs/` 는 `web/` 밖이라 워크트리 신호가 아님) → 13:30:57Z `cancelling sweep: worktree advanced 8s ago` → `killed process tree 28228` → `port 3123 is free` → 종료 코드 0, `:3123` LISTENING 없음, Playwright 프로세스 0, 락 해제, `latest.json.status === 'cancelled'`.
- 앞선 두 강제 스윕(13:25Z · 13:28Z)은 각각 22~23초 만에 `transcript advanced`로 취소됐다 -- claude-mem 옵저버 세션의 트랜스크립트가 세션 활동을 40~60초 지연으로 기록하기 때문이며, 이는 "다른 Claude 세션도 활동"(D-11)이 실제로 작동한다는 증거다. 첫 스윕에서 Playwright의 outputDir 와이프가 `stage3/`를 삭제한 사실이 드러나 `--output` 격리를 추가했다(위 표).
