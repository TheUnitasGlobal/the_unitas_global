# REV-43 — 비즈니스 자동화 확장 스킬셋 자율 인스톨 및 Fail-Closed 연동 (창립자 지령 2026-09-18, 제6장 자율 감지·툴 확장)

정본 위치: `index.html/docs/rev43/SPEC.md` · 기준: Codex v51.0 제1장~제17장 · 선행: 소버린 툴체인 12종(`docs/toolchain/README.md`, 2026-09-10) · Figma 스탠바이 패턴(`scripts/agent/setup-figma.ps1 -Standby`, 2026-09-18)

## 0. 지령

| 타겟 | 요구 역량 | 용도 |
|---|---|---|
| UI/UX 아키텍처 | web-artifacts-builder · theme-factory | U-Square 하이퍼-테마 렌더링 |
| 데이터/재무 | 데이터 분석 · 재무(Finance) | Wise/Xolo 회계 파이프라인 · 마이크로 번 마진 추적 |
| 보안/법무 | Legal · PDF 파싱 | U-Signature 문서 무결성 검증 |
| 글로벌 자동화 | 데이터 스크래핑(Bright Data 호환) · Marketing/Sales 파이프라인 | 비즈니스 오토메이션 |
| 규약 | 창립자 웹 클릭 0 · PowerShell 온디맨드 인스톨 · 작업 직후 `npm --prefix web run typecheck`·`build` EXIT 0 → Vercel·Git 동기화 | Fail-Closed |

## 1. 정찰 실측 (2026-09-18, `npx skills find`, 읽기 전용)

| 요구 | 채택 패키지 (`owner/repo@skill`) | 설치 수 | 근거 |
|---|---|---|---|
| web-artifacts-builder | `anthropics/skills@web-artifacts-builder` | 101.9K | 공식 |
| theme-factory | `anthropics/skills@theme-factory` | 85.5K | 공식 |
| 데이터 분석 | `anthropics/skills@xlsx` · `anthropics/knowledge-work-plugins@explore-data` · `@data-visualization` | 170.3K · 5.5K · 12.1K | 공식(재무 시트 = xlsx) |
| 재무 | `anthropics/knowledge-work-plugins@financial-statements` · `@close-management` · `@invoice-chase` | 4.1K · 2.8K · 1.7K | 공식(Wise/Xolo 월마감·청구 추적) |
| Legal | `anthropics/knowledge-work-plugins@legal-risk-assessment` · `@review-contract` | 4.7K · 3.3K | 공식 |
| PDF | `anthropics/skills@pdf` | 197.9K | 공식(pypdf·pdfplumber 파이썬 스크립트 동봉) |
| 스크래핑(Bright Data) | `brightdata/skills@scrape` · `@search` · `@bright-data-mcp` | 10.7K · 7.4K · 1K | 벤더 공식; MCP는 키 필요 → 스탠바이 |
| Marketing | `coreyhaines31/marketingskills@copywriting` · `@seo-audit` · `@content-strategy` | 203K · 209.6K · 141.9K | 리더보드 1~3위 |
| Sales | `coreyhaines31/marketingskills@sales-enablement` · `anthropics/knowledge-work-plugins@draft-outreach` | 103.2K · 3K | |

기각: 비공식 소규모(설치 수 < 1K) 재무·회계 스킬(정확성 검증 불가), `openai/skills@pdf`(중복), Salesforce 전용 세트(계약 없음).

## 2. 결정 사항 (제6장 제로 핸즈)

- **D-1 설치 스코프**: 2026-09-10 툴체인 원칙 그대로 **사용자 스코프 복사본** `~/.claude/skills/<name>`(`npx skills add <pkg> -g --copy -y`, Windows 정션 이슈 #851 회피). 저장소에는 설치본을 커밋하지 않는다. `.claude/**`·`CLAUDE.md`·`settings.json`·`.mcp.json` 무수정(하네스 분류기 + 전역 라우팅 불가침).
- **D-2 재현 스크립트**: 신설 `scripts/agent/setup-skillset.ps1` — 매니페스트(`config/agent-toolkit.json` `skillset` 블록: 패키지·용도·검증 파일)를 읽어 순차 설치, 각 스킬의 `SKILL.md` 존재로 성공 판정, 실패 시 그 항목만 보고하고 계속(non-zero 집계 후 종료), `-Status`는 설치 여부 표만. `scripts/setup-toolchain.ps1`에 `Invoke-Step 'Business skillset'` 1행 추가(상태판에도 노출).
- **D-3 Bright Data MCP 스탠바이**: `scripts/agent/setup-brightdata.ps1 -Standby` — `BRIGHTDATA_API_TOKEN`(User env)이 있을 때만 `claude mcp add --scope user brightdata -- npx -y @brightdata/mcp`(env `API_TOKEN=${BRIGHTDATA_API_TOKEN}` 참조 등록) + Connected 확인, 없으면 `ARMED` exit 0(Figma 스탠바이와 동일 규약: 키 없는 통합은 등록하지 않는다). 키는 창립자 `setx BRIGHTDATA_API_TOKEN …` 1회.
- **D-4 정직 표기**: 각 스킬의 실체(무엇을 하고 무엇을 못 하는지)를 `docs/toolchain/README.md` §13 표에 실측으로 기록(예: `pdf` 스킬은 Python `pypdf`/`pdfplumber` 필요 → `pip install --user pypdf pdfplumber` 동반; `xlsx`는 `openpyxl`; web-artifacts-builder는 React+Tailwind 단일 HTML 번들 생성기이며 U-Square 컴포넌트 코드로 직접 이식은 금지(REV 팔레트 재염색 원칙)).
- **D-5 Fail-Closed 게이트**: 설치는 `web/` 밖(사용자 홈)이라 앱 빌드에 무영향이지만 지령대로 직후 `npm --prefix web run typecheck`·`build` EXIT 0 증명 후 커밋·푸시(`scripts/agent/*.ps1`·`config/agent-toolkit.json`·`docs/toolchain/README.md`·`docs/rev43/*`) → Vercel 배포는 분류기 차단 시 창립자 1줄.
- **D-6 순서**: 창립자가 병행을 허용("중간에 같이 진행해도 무관")했으므로 REV-42의 2단계 빌드 대기 구간에 병행 착수 — 설치 대상이 전부  밖(사용자 홈···)이라 REV-42 게이트와 간섭이 없다. 커밋은 REV-42와 분리한다.

## 3. 게이트

`scripts/agent/setup-skillset.ps1 -Status` 전항 installed → `npx skills list -g`에 19 스킬(설치 실측 2026-09-18: 19/19) → `npm --prefix web run typecheck`·`test`·`build` EXIT 0 → 커밋·푸시 → FINAL_REPORT.
