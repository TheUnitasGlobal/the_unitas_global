# THE UNITAS GLOBAL — IMPECCABLE TASTE rule (frontend)

**`.roo/rules/unitas-constitution.md`의 최상위 운영 헌법이 이 파일보다 상위다.** 충돌 시 헌법이 우선한다. 이 파일은 헌법의 저장소 전용 구현 상세이며, 운영 루트 `CLAUDE.md` §0 부록-B의 같은 구속을 이 디렉터리를 읽는 엔진에 전달한다.

> 이 파일이 `.roo/rules/`에 있다는 사실은 Roo Code 연동을 뜻하지 않는다. Codex v49.0 제4장은 보조 에이전트 CLI 연동을 영구 배제하며, 이 디렉터리는 그와 무관하게 **헌법 정본 3파일 중 하나(`unitas-constitution.md`)가 사는 독트린 경로**다.
>
> **2026-09-18 승격:** v49.0이 **제12장 「U-Square 하이퍼-테마 생태계 및 제로-프릭션 UI/UX」**를 신설해 Impeccable Taste를 헌법 조문으로 올렸다. 이 파일과 정본은 이제 그 조문의 시행세칙이다. 제12장 신설로 구 제12~16장은 제13~17장으로 +1 이동했다.

**정본은 `docs/process/IMPECCABLE_TASTE.md`** — 15개 조항과 규칙↔강제 대응표가 거기 있다. `web/` 프론트엔드를 변경하기 전에 읽는다. 이 파일은 조항을 복제하지 않고 구속만 선언한다.

## 우선순위

최상위 운영 헌법 > IMPECCABLE TASTE 독트린 > 외부 디자인 스킬(`frontend-design`, `ui-ux-pro-max`, `ui-styling`, `design-system`, `brand` 등). **외부 스킬의 일반론이 독트린과 충돌하면 독트린이 이긴다.** 외부 스킬은 이 저장소를 측정한 적이 없다.

## 협상 불가 3조

- `html` · `body` · `.dashboard-zoom`에 `filter`/`backdrop-filter`/`transform`/`perspective`/`will-change`/`contain`/`translate`/`rotate`/`scale`를 `none` 이외의 값으로 선언하지 않는다 — 사이트 전역 `position: fixed` 레이어의 컨테이닝 블록을 탈취한다(REV-15 실측: 667px 뷰포트에 1702px 커튼).
- `backdrop-filter`는 `#unitas-nav`와 뷰포트 고정 모달 백드롭 1개에만 허용한다. 그 밖의 유리질감은 `--u-wl-glass` + `--u-wl-edge`, 또는 불투명도 0.94~0.97 바탕 + `box-shadow`. "카드에 글래스모피즘 blur"는 이 저장소에서 성능 회귀 지시서다(REV-21 실측).
- 새 모션은 리터럴이 아니라 토큰을 참조한다 — `--qw-ease` · `--qw-dur-fast` · `--qw-dur` · `--qw-dur-slow`(정본 `web/app/globals.css`의 `:root`). 기존 리터럴 일괄 치환은 금지.

## 그 밖에 자주 깨지는 것

- 라이트/다크에서 값이 갈리는 토큰은 **같은 이름으로 두 번** 선언한다(맨 `:root` + `html[data-unitas-surface='quantum-white']`). 이름을 포크하지 않는다.
- `--qw-ink/-line/-blue/-gold/-glass`는 화이트 표면에만 존재한다. 다크 라우트에서 쓰면 조용히 무스타일로 렌더된다.
- 인플로우 요소의 `height`/`width`/`top`/`left`/`filter`/`background-position`은 애니메이트하지 않는다.
- 새 웹폰트 금지(Cinzel + JetBrains Mono, `next/font`만).
- 새 사용자 문자열은 `web/messages/*.json` **20개 전부**에 같은 커밋으로 착지한다.
- 새 토큰·선택자 계열은 정적 텍스트 가드(`web/__tests__/**/*.test.ts`, node 환경, `.test.ts`만 수집됨)를 함께 낸다. `.test.tsx`로 쓰면 **한 번도 실행되지 않는다**.
- 클래스 삭제는 행 번호가 아니라 클래스 허용목록으로 명세한다.

## 검증

기계 강제: `npm --prefix web run test` (`web/__tests__/quantumWhite/rev15FixedLayerGuard.test.ts` · `rev21OneLayer.test.ts` · `impeccableTaste.test.ts`).
리뷰 강제: `powershell -File scripts/agent-review.ps1 -Lens code` 와 `-Lens ux`.
