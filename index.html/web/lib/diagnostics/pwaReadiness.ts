/**
 * REV-28 MISSION 2 -- PWA install readiness, as a readout a real device can
 * give you.
 *
 * WHY THIS AND NOT A TEST. `beforeinstallprompt` does not fire in a headless
 * browser: it is gated on Chrome's own engagement heuristics on a real profile.
 * REV-26 changed the service worker's fetch handler and justified keeping a
 * handler from Chrome's documentation -- but documentation is not a
 * measurement, and that gap was recorded rather than papered over. This module
 * closes it the only way it can be closed: by asking the device.
 *
 * THE PLATFORM TRUTH THIS ENCODES. iOS Safari has NO `beforeinstallprompt` and
 * no programmatic install, at any version -- installation is Share -> Add to
 * Home Screen, performed by the human. A readout that reported "blocked"
 * there would be wrong, and a button that promised to install would be a lie.
 * So iOS gets its own verdict and its own instruction.
 *
 * Pure: facts in, verdict out. The collector lives in
 * `components/system/RenderDiagnostics.tsx`.
 */

export type PwaPlatform = 'ios' | 'android' | 'desktop' | 'unknown';

export interface PwaFacts {
  platform: PwaPlatform;
  /** Already running as an installed app. */
  standalone: boolean;
  /** A service worker is controlling this page. */
  swControlled: boolean;
  /** `<link rel="manifest">` resolved and parsed. */
  manifestOk: boolean;
  /** Required manifest fields that were missing or empty. */
  manifestMissing: string[];
  /** `beforeinstallprompt` was captured by the head bootstrap. */
  promptCaptured: boolean;
  /** The page is on a secure origin (or localhost). */
  secureContext: boolean;
}

export type PwaStatus = 'installed' | 'ready' | 'ios-manual' | 'waiting' | 'blocked';

export interface PwaReadiness {
  status: PwaStatus;
  /** What the founder should do next, on THIS device. */
  nextAction: string;
  /** Anything that would stop an install, in the order it must be fixed. */
  blockers: string[];
}

/** The manifest fields an installable app must actually carry. */
export const REQUIRED_MANIFEST_FIELDS = ['name', 'icons', 'start_url', 'display'] as const;

export function detectPlatform(userAgent: string, maxTouchPoints = 0): PwaPlatform {
  const ua = (userAgent || '').toLowerCase();
  // iPadOS 13+ reports a desktop Mac UA; the touch points give it away.
  if (/iphone|ipad|ipod/.test(ua) || (ua.includes('macintosh') && maxTouchPoints > 1)) return 'ios';
  if (ua.includes('android')) return 'android';
  if (/windows|macintosh|linux|cros/.test(ua)) return 'desktop';
  return 'unknown';
}

export function classifyPwaReadiness(facts: PwaFacts): PwaReadiness {
  const blockers: string[] = [];
  if (!facts.secureContext) blockers.push('this origin is not secure -- no browser will install from it');
  if (!facts.manifestOk) blockers.push('the web app manifest did not load');
  else if (facts.manifestMissing.length > 0) blockers.push(`the manifest is missing: ${facts.manifestMissing.join(', ')}`);
  if (!facts.swControlled) blockers.push('no service worker is controlling this page');

  if (facts.standalone) {
    return {
      status: 'installed',
      nextAction: 'already running as an installed app -- nothing to install from here',
      blockers,
    };
  }

  if (blockers.length > 0) {
    return { status: 'blocked', nextAction: 'fix the blockers below before testing the banner', blockers };
  }

  if (facts.platform === 'ios') {
    // Not a blocker and not a failure: this is simply how iOS installs.
    return {
      status: 'ios-manual',
      nextAction: 'iOS has no install prompt at any version -- use Share -> Add to Home Screen, then reopen from the home screen and re-run this probe to confirm it reports "installed"',
      blockers,
    };
  }

  if (facts.promptCaptured) {
    return {
      status: 'ready',
      nextAction: 'beforeinstallprompt was captured -- press Install to fire the native dialog',
      blockers,
    };
  }

  return {
    status: 'waiting',
    nextAction:
      'every precondition is met but beforeinstallprompt has not fired yet. Chrome holds it behind its own engagement heuristics, and it never fires for an app it already considers installed -- interact with the page, or check chrome://apps',
    blockers,
  };
}

/** One line for the readout. */
export function pwaHeadline(facts: PwaFacts, readiness: PwaReadiness): string {
  return `${readiness.status.toUpperCase()} · ${facts.platform} · sw ${facts.swControlled ? 'yes' : 'no'} · manifest ${facts.manifestOk ? 'ok' : 'missing'} · prompt ${facts.promptCaptured ? 'captured' : 'none'}${facts.standalone ? ' · standalone' : ''}`;
}
