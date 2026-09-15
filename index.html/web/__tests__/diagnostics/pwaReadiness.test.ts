import { describe, expect, it } from 'vitest';
import { classifyPwaReadiness, detectPlatform, pwaHeadline, type PwaFacts } from '@/lib/diagnostics/pwaReadiness';

/**
 * REV-28 MISSION 2 -- PWA readiness, decided.
 *
 * The one thing this must never do is tell the founder that iOS is BROKEN.
 * Safari has no `beforeinstallprompt` at any version; installation there is
 * Share -> Add to Home Screen, done by a human. A readout that called that a
 * failure would send the founder hunting a bug that does not exist.
 */

const HEALTHY: PwaFacts = {
  platform: 'android',
  standalone: false,
  swControlled: true,
  manifestOk: true,
  manifestMissing: [],
  promptCaptured: true,
  secureContext: true,
};

describe('detectPlatform', () => {
  it('recognises a phone', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/131.0 Mobile Safari/537.36')).toBe('android');
  });

  it('catches an iPad pretending to be a Mac', () => {
    // iPadOS 13+ ships a desktop Macintosh UA; the touch points are the tell.
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
    expect(detectPlatform(ipad, 5)).toBe('ios');
    expect(detectPlatform(ipad, 0)).toBe('desktop');
  });

  it('falls back rather than guessing', () => {
    expect(detectPlatform('')).toBe('unknown');
    expect(detectPlatform('SomeBot/1.0')).toBe('unknown');
  });
});

describe('classifyPwaReadiness', () => {
  it('calls a captured prompt READY', () => {
    const r = classifyPwaReadiness(HEALTHY);
    expect(r.status).toBe('ready');
    expect(r.blockers).toEqual([]);
    expect(r.nextAction).toContain('press Install');
  });

  it('does NOT call iOS broken -- it explains how iOS installs', () => {
    const r = classifyPwaReadiness({ ...HEALTHY, platform: 'ios', promptCaptured: false });
    expect(r.status).toBe('ios-manual');
    expect(r.blockers).toEqual([]);
    expect(r.nextAction).toContain('Share -> Add to Home Screen');
    // And it tells the founder how to CONFIRM the install afterwards.
    expect(r.nextAction).toContain('re-run this probe');
  });

  it('separates "not yet" from "cannot"', () => {
    // Everything is in place; Chrome simply has not fired the event.
    const r = classifyPwaReadiness({ ...HEALTHY, promptCaptured: false });
    expect(r.status).toBe('waiting');
    expect(r.blockers).toEqual([]);
    expect(r.nextAction).toContain('engagement heuristics');
  });

  it('reports an installed app as installed, not as a failure to install', () => {
    const r = classifyPwaReadiness({ ...HEALTHY, standalone: true, promptCaptured: false });
    expect(r.status).toBe('installed');
    expect(r.nextAction).toContain('already running as an installed app');
  });

  it('lists blockers in the order they have to be fixed', () => {
    const r = classifyPwaReadiness({
      ...HEALTHY,
      secureContext: false,
      manifestOk: false,
      swControlled: false,
      promptCaptured: false,
    });
    expect(r.status).toBe('blocked');
    expect(r.blockers[0]).toContain('not secure');
    expect(r.blockers[1]).toContain('manifest');
    expect(r.blockers[2]).toContain('service worker');
  });

  it('names exactly which manifest fields are missing', () => {
    const r = classifyPwaReadiness({ ...HEALTHY, manifestMissing: ['icons', 'start_url'] });
    expect(r.status).toBe('blocked');
    expect(r.blockers[0]).toContain('icons, start_url');
  });

  it('an installed app still reports its blockers rather than hiding them', () => {
    // Running standalone does not mean the manifest is healthy for the NEXT
    // device, so the diagnosis survives the happy status.
    const r = classifyPwaReadiness({ ...HEALTHY, standalone: true, swControlled: false });
    expect(r.status).toBe('installed');
    expect(r.blockers.join(' ')).toContain('service worker');
  });

  it('holds the REV-26 open question: a missing service worker is visible here', () => {
    // REV-26 kept the worker's fetch handler on Chrome's documentation alone
    // and recorded that it could not verify the prompt in a headless browser.
    // This is where that gets answered, on a real device.
    const r = classifyPwaReadiness({ ...HEALTHY, swControlled: false, promptCaptured: false });
    expect(r.status).toBe('blocked');
    expect(r.blockers.join(' ')).toContain('no service worker is controlling this page');
  });
});

describe('pwaHeadline', () => {
  it('fits the whole state on one line', () => {
    const line = pwaHeadline(HEALTHY, classifyPwaReadiness(HEALTHY));
    expect(line).toContain('READY');
    expect(line).toContain('android');
    expect(line).toContain('sw yes');
    expect(line).toContain('prompt captured');
  });

  it('marks a standalone session', () => {
    const facts = { ...HEALTHY, standalone: true };
    expect(pwaHeadline(facts, classifyPwaReadiness(facts))).toContain('standalone');
  });
});
