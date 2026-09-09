# legacy_ui_backup / main_homepage_REV13

영구 백업 프로토콜 (REV-13 "UNITAS Quantum White" 메인 홈 재설계 직전 스냅샷)

- 백업 시각: 2026-09-08 (KST 기준 저녁)
- 원본 커밋: 19431a2 (main) — `git show 19431a2:index.html/web/<path>` 로 언제든 동일 파일 복원 가능
- 원본 경로 기준: `index.html/web/` (이 디렉터리의 `web/` 하위가 1:1 미러)
- 무결성: `SHA256SUMS.txt` (`cd web && sha256sum -c ../SHA256SUMS.txt`)

## 보존 범위
| 범주 | 경로 |
| --- | --- |
| 홈 진입 | `app/[locale]/page.tsx`, `app/[locale]/layout.tsx`, `app/layout.tsx` |
| 다크 테마 CSS | `app/globals.css`, `tailwind.config.ts`, `next.config.mjs` |
| 홈 UI 컴포넌트 | `components/home/*`, `components/cards/*`, `components/layout/*`, `components/nav/*`, `components/ui/*` |
| 홈 팝업 | `components/interaction/{EcosystemEntryModal,ModuleQuestModal,LockInModuleModal,HotShortcutResultModal,AppDetailCard,AppLoopRow,EnterpriseInquiryModal}.tsx` |
| 헤비 WebGL / 이펙트 | `components/canvas/*` (R3F Scene, NeuralShader), `components/effects/*` (ParticleBurst, Shockwave), `components/motion/*`, `lib/physics/*` |
| BGM / 오디오 로직 | `components/audio/SpatialAudioProvider.tsx` (합성 앰비언트 베드), `components/audio/SoundToggle.tsx`, `lib/audio/*` |
| 모듈 데이터 | `lib/{ecosystems,modules,lockInModules,hotIssues,b2bSpecs,sceneInteraction,module-registry,uiGate,walletSimulation}.ts` |
| 지갑 UI | `components/wallet/*` |

## 복원 절차
1. `cp -r legacy_ui_backup/main_homepage_REV13/web/<path> index.html/web/<path>`
2. 또는 `git checkout 19431a2 -- index.html/web/<path>`
3. `cd index.html && npm --prefix web run typecheck && npm --prefix web run build`

주의: 로고 페이지(CinematicIntroSplash), 진입 게이트(AudioGate), 광고 1~5(ComingSoonCinema 세그먼트), 커밍순 페이지는
REV-13 범위 밖(동결)이라 이 백업의 대상이 아니며 원본이 그대로 유지된다.
