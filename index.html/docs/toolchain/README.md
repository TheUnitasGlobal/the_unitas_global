# Sovereign Agent Toolchain (2026-09-10)

창립자 지시 "Sovereign Agent Auto-Evolution & Toolchain Integration Codex"에 따라 로컬 개발 환경에 통합된
12종 도구의 **정본 기록**입니다. 설치·검증은 `scripts/setup-toolchain.ps1`(재현 가능, 버전 고정)로 다시 실행할 수 있습니다.

```powershell
npm run setup:toolchain                        # 상태판만
npm run setup:toolchain -- -Install -PullModel # 새 노트북 전체 재설치 (Ollama·gh는 winget)
```

## 설계 원칙 (Fail-Closed · 제로 타협 · 로우메모리 아머)

1. **전역 라우팅 불가침** — `~/.claude/settings.json`, 프로젝트 `.claude/settings*.json`, `CLAUDE.md`(코덱스 정본, prebuild 드리프트 게이트)는 어떤 도구도 수정하지 않는다.
   모델 라우팅(Headroom / Ollama / OmniRoute)은 전부 `scripts/agent/*.ps1` 런처가 **자식 `claude` 프로세스의 env**에만 주입하는 opt-in 방식이다.
   프록시·게이트웨이가 죽어 있으면 런처가 기동을 거부한다(세션이 죽은 URL로 라우팅되는 일이 없음).
2. **사용자 스코프 스킬** — 세션은 git 루트 `C:\dev\unitas`에서 뜨고 앱은 `index.html/web`에 있어 프로젝트 스코프가 어긋난다.
   따라서 스킬은 `~/.claude/skills`(사용자 스코프)에 **복사본**으로 설치한다(Windows 정션 누락 이슈 vercel-labs/skills#851 회피). 저장소에는 설치본을 커밋하지 않는다(`.agents/`·`skill-observations/`는 gitignore).
3. **온디맨드 상주** — Ollama 모델은 5분 유휴 후 자동 언로드, OmniRoute·Headroom 프록시는 필요할 때만 기동. 상시 상주 프로세스 추가 0.
4. **키 없는 통합은 등록하지 않는다** — 21st.dev MCP는 `API_KEY_21ST`가 있을 때만 등록(없으면 매 세션 "Failed to connect" 노이즈가 생기므로 거부).

## 실측 하드웨어 상한 (창립자 노트북, 2026-09-10)

| 항목 | 값 |
|---|---|
| RAM | 7.6 GB (작업 중 가용 0.5~1 GB) |
| GPU | Intel Iris Xe (Ollama는 iGPU를 버리고 CPU 추론) |
| 로컬 모델 상한 | **4B 이하** (`qwen3:4b` Q4_K_M 2.5 GB, 32k q8_0 KV 포함 상주 5.3 GB) |
| 스모크 테스트 | `/v1/messages` → qwen3:4b 응답 성공, 로드 포함 111초(가용 RAM 0.47 GB 상태) |

로컬 추론은 **가용 RAM ≥ 3.5 GB**일 때만 실용적이다(`claude-local.ps1`이 가드). 더 큰 모델은 풀지 않는다.

## 12종 도구 매트릭스

| # | 도구 | 버전 (고정) | 설치 스코프 | 기동 / 사용 | 검증 |
|---|---|---|---|---|---|
| 1 | **Headroom** 컨텍스트 압축 프록시 | headroom-ai 0.37.0 (pip, `[proxy]` extra) | Python 3.12 Scripts | `scripts/agent/claude-headroom.ps1` (127.0.0.1:8787) | `headroom doctor`, `curl.exe http://127.0.0.1:8787/health`, 대시보드 `/dashboard` |
| 2 | **task-observer** 스킬 | rebelytics/one-skill-to-rule-them-all | `~/.claude/skills/task-observer` | `/task-observer` 또는 다단계 작업 시 자동 트리거 | 관측 로그 `skill-observations/`(gitignore) |
| 3 | **OmniRoute** 멀티모델 게이트웨이 | omniroute 3.8.50 (npm -g) | 전역 npm | `scripts/agent/omniroute-gateway.ps1` → `claude-omniroute.ps1` | `/api/monitoring/health`, `/v1/models`, 대시보드 `http://127.0.0.1:20128/` |
| 4 | **Ollama** 데스크톱 + 로컬 모델 | Ollama 0.34.0 (winget) · qwen3:4b | 사용자 설치 + User env | `scripts/agent/claude-local.ps1` (= `ollama launch claude`) | `curl.exe http://127.0.0.1:11434/api/version`, `ollama ps` |
| 5 | **Agent-Reach** 인터넷 리치 레이어 | v1.5.0 (uv tool, 태그 고정) | `~/.local/bin/agent-reach.exe` + 스킬 | `/agent-reach`, `agent-reach doctor --json` | 13채널 중 무설정 4채널(웹 Jina·RSS·GitHub·V2EX) 활성 |
| 6 | **find-skills** | vercel-labs/skills | `~/.claude/skills/find-skills` | `npx skills find <query>` | `npx skills list -g` |
| 7 | **agent-browser** | 0.37.1 (npm -g, Rust CLI) + Chrome 153 | 전역 npm + `~/.agent-browser/browsers` | `/agent-browser`, `agent-browser open <url>` | `agent-browser doctor --json` |
| 8 | **systematic-debugging** | obra/superpowers | `~/.claude/skills/systematic-debugging` | 버그·테스트 실패 시 자동 트리거 | 동반 참조 파일 포함 설치 |
| 9 | **skill-creator** | anthropics/skills | `~/.claude/skills/skill-creator` | `/skill-creator` | `pip install pyyaml` 후 `quick_validate.py` (평가 루프는 WSL 필요) |
| 10 | **UI/UX Pro Max** | ui-ux-pro-max-cli 2.15.0 (7 스킬) | `~/.claude/skills/ui-ux-pro-max` 외 6 | `python ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux` | Python stdlib, 네트워크 0 |
| 11 | **21st.dev** MCP + 레지스트리 | HTTP MCP `https://21st.dev/api/mcp` · shadcn 레지스트리 | 사용자 스코프 MCP(키 필요) | `scripts/agent/setup-21st.ps1`, `npx shadcn@latest add "https://21st.dev/r/<author>/<slug>"` | `claude mcp get 21st`, 세션 `/mcp` |
| 12 | 보조: **mcporter**, **yt-dlp**, **gh** | 0.13.10 · 2026.8.19 · winget | 전역 | Agent-Reach 검색/유튜브/GitHub 백엔드 | `gh auth login`으로 GitHub 채널 완전 개방 |

## 각 도구 요점

### 1. Headroom (토큰 다이어트)

- 프록시가 툴 출력·로그·JSON을 압축해 Anthropic으로 전달, 원본은 `headroom_retrieve`로 복원 가능. 절감 통계 `~/.headroom/proxy_savings.json`, `/stats`.
- `headroom init -g claude`와 `headroom wrap vscode-claude`는 **전역 settings.json을 수정하므로 사용 금지**. `headroom wrap claude`도 Serena/headroom MCP를 user scope에 영구 등록하므로 쓰지 않는다 → 런처는 `headroom proxy` + 프로세스 env만 사용.
- 커스텀 base URL이면 Claude Code 2.1.196+에서 Remote Control(`/rc`)이 꺼진다. Remote Control이 필요하면 일반 `claude`로 기동.
- Windows 0.25 `ConnectionRefused` 버그(#1116)는 0.37.0에서 SelectorEventLoop로 수정됨.

### 2. Task Observer (정직 표기)

- 실체는 "세션 중 교정·반복 워크플로를 `skill-observations/`에 기록해 스킬 개선 후보를 제안하는 메타 스킬"이다.
  **토큰 사용량·컨텍스트 팽창을 계측하거나 줄이는 기능은 없다**(오히려 세션당 소량 오버헤드). 토큰 최적화는 1번 Headroom이 담당.
- 매 세션 강제 활성화(CLAUDE.md 지시 또는 SessionStart 훅)는 코덱스 불가침·토큰 다이어트 원칙과 충돌하므로 적용하지 않았다. 필요 시 `/task-observer`로 수동 호출.

### 3. OmniRoute

- Anthropic 호환 `/v1/messages` + OpenAI `/v1` + 대시보드. 콤보 `auto`, `auto/coding`, `auto/fast`, `auto/cheap`, `auto/offline`, `auto/smart`.
- 런처가 `OMNIROUTE_SERVER_HOST=127.0.0.1`(업스트림 기본 0.0.0.0 = LAN 노출 차단), 초기 비밀번호를 `~/.omniroute/initial-password.txt`(사용자 전용 ACL, 데이터 디렉터리 `~/.omniroute` = `storage.sqlite` + `.env`)에 생성. 실측 콜드 스타트 195초(헬스 200 `setupComplete:true`, `/v1/models` 401 = 키 요구 정상).
- Ollama 연결: 대시보드 → Providers → Ollama 카드 → `http://localhost:11434/v1`(키 불필요) → 모델명 `ollama/qwen3:4b`. 게이트웨이 키(`oma_live_…`)는 Endpoints에서 발급해 `OMNIROUTE_API_KEY`로 주입.
- Claude Code 연결 env: `ANTHROPIC_BASE_URL=http://127.0.0.1:20128`(`/v1` 붙이지 않음), `ANTHROPIC_AUTH_TOKEN=oma_live_…`, `ANTHROPIC_MODEL=auto/coding`, `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`.

### 4. Ollama

- User env(설치 스크립트가 설정, 트레이 앱 재시작 필요): `OLLAMA_CONTEXT_LENGTH=32768`, `OLLAMA_MAX_LOADED_MODELS=1`, `OLLAMA_NUM_PARALLEL=1`, `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`, `OLLAMA_KEEP_ALIVE=5m`.
- 함정: 트레이 앱을 에이전트 도구의 샌드박스 자식으로 띄우면 서버 자식 프로세스가 기동되지 않는다(server.log 0바이트). `explorer.exe "<ollama app.exe>"`로 분리 실행하면 정상(런처에 반영).
- `ollama launch claude`는 `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN=ollama`/`ANTHROPIC_DEFAULT_*_MODEL`을 **스폰 프로세스 env에만** 설정한다(settings.json 미기록) — 런처와 동일 원리.

### 5. Agent-Reach

- 자체 스크래퍼가 아니라 Jina Reader·yt-dlp·feedparser·gh·twitter-cli 등을 선택·라우팅하는 capability layer. 무설정 4채널 활성, Twitter/Reddit/Exa 등은 쿠키·키 필요(`agent-reach configure …`).
- `install --system`은 apt/brew 전제라 Windows에서는 `--env=auto`(의존성 점검 + 스킬 등록)만 사용, gh·Node·mcporter·yt-dlp는 별도 설치.

### 7. agent-browser

- Node/Playwright 데몬 없는 네이티브 Rust CLI, CDP 직결. 기존 Playwright MCP 플러그인과 독립 공존. 지침은 `agent-browser skills get core`로 CLI 버전과 동기.

### 10. UI/UX Pro Max ↔ UNITAS 디자인 시스템 연결 규칙

- 이 스킬의 `--design-system` 산출물(범용 "Micro SaaS 인디고/에메랄드" 팔레트)은 UNITAS 브랜드(보이드 `#030305`·골드 `#d4af37`·네온 `#00f3ff`, Cinzel + JetBrains Mono, quantum-white 표면)와 충돌하므로 **팔레트/타이포는 절대 채택하지 않는다**. 정본은 `web/tailwind.config.ts` + `web/app/quantum-white*.css` + 프로젝트 스킬 `unitas-component`.
- 허용 용도: UX 가이드라인(`--domain ux`), 모션 프리셋(`--domain gsap`), 차트(`--domain chart`), 스택 규칙(`--stack nextjs`), 접근성 점검.

### 11. 21st.dev ↔ Next.js 연결점

- `web/components.json`(shadcn 스키마, `cssVariables:false`, baseColor zinc) + `web/lib/utils.ts`(`cn`) 추가 → `npx shadcn@latest add "https://21st.dev/r/<author>/<slug>"`가 `web/components/ui/`에 컴포넌트를 떨어뜨린다.
  `cssVariables:false`라 레지스트리 컴포넌트는 순수 Tailwind 팔레트 클래스로 재작성되어 UNITAS 토큰 레이어를 건드리지 않는다.
- 2026-09 변경: `@21st-dev/magic` stdio 프록시·콘솔 키는 폐기, 단일 HTTP MCP `https://21st.dev/api/mcp` + `x-api-key`(`21st_sk_…`, <https://21st.dev/settings/api-keys>). 무료 계정: search/search_logo/get_theme/get_usage, get_component 2회/일; generate 계열은 Builder/AI 플랜.

## 창립자 후속 조치(선택)

1. `$env:API_KEY_21ST = '21st_sk_…'` → `scripts/agent/setup-21st.ps1` (MCP 등록)
2. `gh auth login` (Agent-Reach GitHub 채널 완전 개방)
3. OmniRoute 대시보드에서 Ollama 프로바이더 + `oma_live_` 키 발급 → `$env:OMNIROUTE_API_KEY`
4. 로컬 추론 사용 전 브라우저/IDE를 닫아 가용 RAM ≥ 3.5 GB 확보
