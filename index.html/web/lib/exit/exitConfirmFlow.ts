// Sovereign 2-step "double-confirm" exit flow (owner instruction 2026-09-06,
// round 17: "2단계 더블 컨펌 안심 종료").
//
// On the APP channel (installed PWA / native container -- phone, tablet or
// desktop window) a confirmed exit is TERMINAL: the shell kills the process,
// the window closes, or the app is terminated in place under an opaque black
// shroud (lib/exit/appExit.ts). One tap on 종료 used to take the visitor from
// a live app straight to that black screen, which reads as a freeze or a
// crash to anyone who tapped by accident ("불필요한 공백이나 먹통 오해").
// The App channel therefore asks TWICE, in two consecutive dialogs of the
// same glassmorphism design, and only the SECOND explicit tap of 종료 runs the
// exit engine (which then collapses the history sentinel buffer and ends the
// app -- see `executeAppExit`):
//
//   1. "정말 종료하시겠습니까?"                              -- intent
//   2. "종료 버튼을 한 번 더 누르면 앱이 완전히 종료됩니다"   -- final
//
// 취소, a backdrop tap or Escape on EITHER dialog leaves the visitor exactly
// where they were. A signed-in visitor still sees the logout question first
// (round 10); it is not one of the two exit confirmations.
//
// The ONLINE channel (a browser tab) keeps its single confirm: leaving a tab
// is reversible (the browser's own back button, its history), so a second
// dialog there would be friction without protection.
//
// ROUND 21 (owner instruction 2026-09-06, "모바일 앱 전용 2단계 안심 종료 안내
// 가이드 팝업"): on a PHONE / TABLET app the two "steps" are no longer two
// QUESTIONS. Step 1 is the single confirm -- "로그아웃 및 종료하시겠습니까?",
// the same question the online channel asks -- and step 2 is the COMPLETION
// GUIDE the exit engine paints once the app is terminated in place
// ("종료가 완료되었습니다. 안전하게 앱 또는 브라우저를 닫아주시기 바랍니다.",
// lib/exit/appExit.ts `terminate-guide`). A phone app cannot close its own
// window, so a second question there only delayed a black screen; the guide
// instead tells the visitor plainly that the app is finished and that the
// device's own navigation is the way out. The DESKTOP app window keeps the
// round-17 double confirm unchanged: its second 종료 genuinely closes the
// window with `window.close()`, so the two questions guard a real, instant,
// irreversible close.
//
// Pure state machine -- no DOM -- so the sequence is unit-tested in
// __tests__/exit/exitConfirmFlow.test.ts. ExitGuard
// (components/interaction/ExitGuard.tsx) is its only renderer; the sealed
// Coming-Soon screen's 'X 종료' reaches it through `requestAppExit()` on the
// App channel.

/** The dialog's steps, in order. `logout` is skipped while signed out. */
export type ExitConfirmStep = 'logout' | 'exit' | 'exit-final';

/** How many explicit 종료 taps an exit needs on each channel. `app` is the
 *  DESKTOP app window (two questions, then `window.close()`); `mobileApp` is
 *  a phone / tablet app (one question, then the completion guide). */
export const EXIT_CONFIRM_TAPS = { app: 2, mobileApp: 1, online: 1 } as const;

/**
 * Pure: does this channel take the second, final confirmation? Only the
 * DESKTOP app window does (round 21): `standalone` is the App channel (see
 * `isStandaloneApp()` in lib/exit/appExit.ts) and `desktopAppWindow` narrows
 * it to a PC / laptop app window (`isDesktopAppWindow()`), whose confirmed
 * tap closes the window for real. A phone / tablet app asks once and then
 * shows the completion guide; the online channel asks once.
 */
export function needsDoubleExitConfirm(standalone: boolean, desktopAppWindow: boolean): boolean {
  return standalone && desktopAppWindow;
}

/** Pure: the step the dialog opens on. */
export function initialExitConfirmStep(signedIn: boolean): ExitConfirmStep {
  return signedIn ? 'logout' : 'exit';
}

/**
 * Pure: the step reached when the visitor CONFIRMS `step` (taps 종료, or
 * leaves the logout question by either button). `null` means every
 * confirmation has been given -- run the exit engine NOW, synchronously
 * inside the same gesture (window.close and history traversal are
 * activation-gated).
 */
export function advanceExitConfirm(step: ExitConfirmStep, doubleConfirm: boolean): ExitConfirmStep | null {
  switch (step) {
    case 'logout':
      return 'exit';
    case 'exit':
      return doubleConfirm ? 'exit-final' : null;
    case 'exit-final':
      return null;
  }
}

/**
 * Pure: how many explicit 종료 taps a flow that starts at `step` still needs
 * before the engine runs. Guards the doctrine's promise in tests: on the App
 * channel it is never fewer than two from the first exit question.
 */
export function remainingExitConfirmTaps(step: ExitConfirmStep, doubleConfirm: boolean): number {
  let current: ExitConfirmStep | null = step === 'logout' ? 'exit' : step;
  let taps = 0;
  while (current) {
    taps += 1;
    current = advanceExitConfirm(current, doubleConfirm);
  }
  return taps;
}

/**
 * Pure: the 1-based position of `step` among the exit confirmations, for the
 * dialog's "1 / 2" step indicator. `null` when there is nothing to count --
 * the logout question, or the single-confirm online flow.
 */
export function exitConfirmPosition(
  step: ExitConfirmStep,
  doubleConfirm: boolean,
): { current: number; total: number } | null {
  if (!doubleConfirm || step === 'logout') return null;
  return { current: step === 'exit-final' ? 2 : 1, total: EXIT_CONFIRM_TAPS.app };
}

/**
 * Window event any surface can fire to open ExitGuard's confirm on demand,
 * outside the back-gesture flow (the sealed Coming-Soon screen's 'X 종료' on
 * the App channel). No-ops if ExitGuard isn't mounted (SSR / removed).
 */
export const EXIT_REQUEST_EVENT = 'unitas:app-exit-request';

export function requestAppExit(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(EXIT_REQUEST_EVENT));
  } catch {
    /* no-op */
  }
}
