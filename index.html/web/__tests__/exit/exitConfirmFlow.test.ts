import { describe, expect, it } from 'vitest';
import {
  EXIT_CONFIRM_TAPS,
  EXIT_REQUEST_EVENT,
  advanceExitConfirm,
  exitConfirmPosition,
  exitDialogCopyKeys,
  exitGuideCopyKeys,
  initialExitConfirmStep,
  needsDoubleExitConfirm,
  remainingExitConfirmTaps,
  resolveExitChannel,
  type ExitConfirmStep,
} from '../../lib/exit/exitConfirmFlow';

// Pure state machine only -- no DOM, no fixtures shared with other
// __tests__/** files (see CLAUDE.md "Module-level test isolation").

/** Walk the flow from `start`, confirming every step, and return the steps
 *  the visitor was shown before the engine ran. */
function confirmedPath(start: ExitConfirmStep, doubleConfirm: boolean): ExitConfirmStep[] {
  const shown: ExitConfirmStep[] = [start];
  let step: ExitConfirmStep | null = start;
  for (let guard = 0; guard < 10 && step; guard += 1) {
    step = advanceExitConfirm(step, doubleConfirm);
    if (step) shown.push(step);
  }
  return shown;
}

describe('round 17 / 21: double-confirm exit (desktop App window) vs single confirm + guide (mobile App, online)', () => {
  it('only the DESKTOP app window asks twice; a phone / tablet app and the online channel ask once', () => {
    expect(EXIT_CONFIRM_TAPS.app).toBe(2);
    expect(EXIT_CONFIRM_TAPS.mobileApp).toBe(1);
    expect(EXIT_CONFIRM_TAPS.online).toBe(1);
    // standalone + desktop window -> two questions, then window.close().
    expect(needsDoubleExitConfirm(true, true)).toBe(true);
    // Round 21: standalone phone / tablet -> ONE question, then the
    // "종료가 완료되었습니다" completion guide painted by the exit engine.
    expect(needsDoubleExitConfirm(true, false)).toBe(false);
    // Online: one question, whatever the pointer.
    expect(needsDoubleExitConfirm(false, true)).toBe(false);
    expect(needsDoubleExitConfirm(false, false)).toBe(false);
  });

  it('round 21: a phone / tablet app walks "종료하시겠습니까?" -> engine in ONE 종료 tap (the guide is the second step)', () => {
    const doubleConfirm = needsDoubleExitConfirm(true, false);
    expect(confirmedPath('exit', doubleConfirm)).toEqual(['exit']);
    expect(confirmedPath('logout', doubleConfirm)).toEqual(['logout', 'exit']);
    expect(remainingExitConfirmTaps('exit', doubleConfirm)).toBe(EXIT_CONFIRM_TAPS.mobileApp);
    expect(exitConfirmPosition('exit', doubleConfirm)).toBeNull();
  });

  it('opens on the logout question only while signed in', () => {
    expect(initialExitConfirmStep(true)).toBe('logout');
    expect(initialExitConfirmStep(false)).toBe('exit');
  });

  it('App: "종료하시겠습니까?" -> "한 번 더 누르면 완전히 종료" -> engine, never fewer than two explicit 종료 taps', () => {
    expect(confirmedPath('exit', true)).toEqual(['exit', 'exit-final']);
    expect(advanceExitConfirm('exit', true)).toBe('exit-final');
    // The engine runs ONLY off the final step.
    expect(advanceExitConfirm('exit-final', true)).toBeNull();
    expect(remainingExitConfirmTaps('exit', true)).toBe(2);
    expect(remainingExitConfirmTaps('exit-final', true)).toBe(1);
  });

  it('App: the logout question is not one of the two exit confirmations', () => {
    expect(confirmedPath('logout', true)).toEqual(['logout', 'exit', 'exit-final']);
    expect(remainingExitConfirmTaps('logout', true)).toBe(2);
  });

  it('online: a single 종료 runs the engine (round 10 behaviour unchanged)', () => {
    expect(confirmedPath('exit', false)).toEqual(['exit']);
    expect(advanceExitConfirm('exit', false)).toBeNull();
    expect(remainingExitConfirmTaps('exit', false)).toBe(1);
    expect(confirmedPath('logout', false)).toEqual(['logout', 'exit']);
  });

  it('online never reaches the App-only final step, and the final step is terminal on both channels', () => {
    for (const step of ['logout', 'exit'] as const) {
      expect(confirmedPath(step, false)).not.toContain('exit-final');
    }
    expect(advanceExitConfirm('exit-final', false)).toBeNull();
    expect(advanceExitConfirm('exit-final', true)).toBeNull();
  });

  it('step indicator: "1 / 2" then "2 / 2" on the App channel, nothing on logout or online', () => {
    expect(exitConfirmPosition('exit', true)).toEqual({ current: 1, total: 2 });
    expect(exitConfirmPosition('exit-final', true)).toEqual({ current: 2, total: 2 });
    expect(exitConfirmPosition('logout', true)).toBeNull();
    expect(exitConfirmPosition('exit', false)).toBeNull();
    expect(exitConfirmPosition('exit-final', false)).toBeNull();
  });

  it('the on-demand open request rides the site-wide unitas: event namespace', () => {
    expect(EXIT_REQUEST_EVENT).toMatch(/^unitas:/);
  });
});

describe('omni-channel exit copy (owner instruction 2026-09-07, master audit item 3)', () => {
  it('resolves exactly one channel per surface: browser tab -> online, phone/tablet app -> mobile-app, PC app window -> desktop-app', () => {
    expect(resolveExitChannel(false, false)).toBe('online');
    expect(resolveExitChannel(false, true)).toBe('online'); // a fine-pointer browser tab is still online
    expect(resolveExitChannel(true, false)).toBe('mobile-app');
    expect(resolveExitChannel(true, true)).toBe('desktop-app');
    // The channel and the double-confirm flag come from the same two facts.
    expect(needsDoubleExitConfirm(true, true)).toBe(true);
    expect(resolveExitChannel(true, true)).toBe('desktop-app');
  });

  it('online: "site closes" body, never an app sentence; mobile app: "app closes" body under the same minimal title', () => {
    expect(exitDialogCopyKeys('exit', 'online')).toEqual({ title: 'exitTitle', body: 'exitBody' });
    expect(exitDialogCopyKeys('exit', 'mobile-app')).toEqual({ title: 'exitTitle', body: 'appExitFinalBody' });
    expect(exitDialogCopyKeys('exit', 'desktop-app')).toEqual({ title: 'appExitTitle', body: 'appExitBody' });
    // Every key an online tab can ever show is a website / neutral one.
    for (const step of ['logout', 'exit'] as const) {
      const keys = exitDialogCopyKeys(step, 'online');
      expect(keys.title).not.toMatch(/^appExit/);
      expect(keys.body).not.toMatch(/^appExit/);
    }
  });

  it('the logout question is channel-neutral and the final question is the desktop app\'s', () => {
    for (const channel of ['online', 'mobile-app', 'desktop-app'] as const) {
      expect(exitDialogCopyKeys('logout', channel)).toEqual({ title: 'logoutTitle', body: 'logoutBody' });
      expect(exitDialogCopyKeys('exit-final', channel)).toEqual({ title: 'appExitFinalTitle', body: 'appExitFinalBody' });
    }
  });

  it('completion guide: the WEB body ("close the browser tab") on a tab, the APP body on an installed app', () => {
    expect(exitGuideCopyKeys('online')).toEqual({ title: 'appExitDoneTitle', body: 'webExitDoneBody' });
    expect(exitGuideCopyKeys('mobile-app')).toEqual({ title: 'appExitDoneTitle', body: 'appExitDoneBody' });
    expect(exitGuideCopyKeys('desktop-app')).toEqual({ title: 'appExitDoneTitle', body: 'appExitDoneBody' });
  });
});
