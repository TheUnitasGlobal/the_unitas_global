// Short entry chime for the very first frame of the logo page (owner
// instruction 2026-09-06, item 2): guaranteed on every omni-channel surface
// -- PC online, PC App, mobile online, mobile App -- not just the one channel
// that happened to already carry it. Self-contained (its own AudioContext,
// no dependency on SpatialAudioProvider) because CinematicIntroSplash mounts
// above that provider in the tree -- see app/layout.tsx.
//
// MOBILE ONLINE BROWSER FIX (owner instruction 2026-09-07, "모바일 온라인
// 브라우저 첫 로그페이지 진입 오디오 재생 버그"). The chime was audible on PC
// online (an "engaged" origin autoplays), on the PC App and on the mobile App
// (an installed PWA autoplays) -- and silent ONLY in a phone's web browser
// (Safari / Chrome), where the mobile autoplay policy never lets a context
// start before the visitor's first activation gesture. Two root causes:
//
//  1. LIFETIME COUPLING. The chime was armed in the splash's mount effect and
//     DISARMED in its cleanup: 3.45 s after mount the context was closed and
//     every gesture listener removed. A phone visitor watches the 3 s logo
//     page without touching it, so the only lawful moment for the sound --
//     the first tap -- arrived AFTER the chime had already been torn down.
//     (A tap in the last ~200 ms lost the same way: the `resume()` promise
//     settled after the cleanup had closed the context.)
//  2. THE PRE-HYDRATION GAP. On a phone the React tree hydrates 1-2.5 s into
//     the logo page (round 16 measured this for ExitGuard). A tap BEFORE the
//     effect had installed its listeners hit nothing; the chime then relied
//     on sticky activation being honoured by a later `resume()` -- and was
//     torn down by (1) regardless.
//
// The engine is now a DOCUMENT-LEVEL SINGLETON that outlives the splash:
//  - `ENTRY_CHIME_BOOTSTRAP` (bottom of this file) is a dependency-free ES5
//    twin injected into <head> by app/layout.tsx. From the first byte of the
//    document it declares the playback session, builds the context, tries an
//    immediate start (autoplay-allowed engines chime at first paint) and,
//    where the policy refuses, resumes + kicks + synthesizes INSIDE the very
//    first activation-triggering gesture on the page -- no hydration needed,
//    so a tap on the logo page sounds the chime at the tap itself.
//  - `armLogoEntryChime()` (hydration) ADOPTS the bootstrap's pending chime
//    instead of building a second one, or builds the same persistent engine
//    when the bootstrap is absent. Nothing is disarmed when the logo page
//    ends: the pending chime keeps its listeners until the first gesture,
//    whenever it comes, then plays exactly once and releases its context.
//  - It stands down only for a confirmed exit (`APP_EXIT_EVENT` /
//    `APP_TERMINATE_EVENT` / `TERMINATED_ATTR`), for sound switched off, or
//    when a replay of the logo page supersedes it with its own chime.
//
// What no web page can do: produce sound in a phone browser BEFORE the first
// tap. The guarantee here is the strongest one the platform allows -- the
// chime plays at the earliest instant the engine is permitted to run, with
// no window in which a gesture can be lost.

import { ensurePlaybackAudioSession, kickAudioContext, makeSilentBuffer } from './audioSession';
import { ACTIVATION_UNLOCK_EVENTS } from './activationUnlock';
import { AUDIO_PREF_KEY, readAudioPrefMuted } from './audioPreference';
import { APP_EXIT_EVENT, APP_TERMINATE_EVENT, TERMINATED_ATTR } from '@/lib/exit/appExit';

/**
 * The two-note crystal blip -- bright, brief (under 300 ms), unmistakable but
 * never intrusive. SINGLE SOURCE for both the TypeScript synth below and the
 * ES5 head bootstrap (interpolated), so the two can never drift.
 */
export const ENTRY_CHIME_NOTES = [
  { freq: 880, at: 0, dur: 0.16 },
  { freq: 1318.5, at: 0.09, dur: 0.22 },
] as const;
export const ENTRY_CHIME_BUS_GAIN = 0.22;
export const ENTRY_CHIME_PARTIAL_GAIN = 0.35;
/** The chime's own context is released this long after it has played. */
export const ENTRY_CHIME_CLOSE_MS = 1500;
/**
 * A logo-page REPLAY armed within this window of the last chime does not
 * chime again: the tap that started the replay fired the pending chime in
 * the capture phase a few ms earlier, and that sound IS the replay's entry
 * chime -- a second one would only double it.
 */
export const ENTRY_CHIME_REPLAY_DEDUPE_MS = 1200;
/** `window` key the pending / played chime state is published under. */
export const ENTRY_CHIME_SHARED_KEY = '__unitasEntryChime';

/**
 * The document's single entry-chime state, shared by the head bootstrap and
 * the hydrated module (whichever built it). Published on
 * `window[ENTRY_CHIME_SHARED_KEY]`.
 */
export interface EntryChimeShared {
  v: 1;
  /** Who built the engine -- diagnostics only. */
  source: 'bootstrap' | 'module';
  /** The chime's AudioContext while it is alive (null once released). */
  ctx: AudioContext | null;
  played: boolean;
  /** `performance.now()` of the chime, 0 until it has played. */
  playedAt: number;
  cancelled: boolean;
  armedAt: number;
  /** First gesture of any kind seen by the engine, 0 until then. */
  gestureAt: number;
  /** Session + kick + resume; plays if the context is RUNNING. True once played. */
  tryFire: () => boolean;
  /** Stop listening and release the context without playing (exit / mute). */
  cancel: () => void;
}

declare global {
  interface Window {
    /** Pending / played logo-page entry chime (see lib/audio/logoEntryChime.ts). */
    __unitasEntryChime?: EntryChimeShared;
  }
}

/** Same clock the head bootstrap stamps (`window.performance`), so the two
 *  sides' timestamps compare directly. */
function nowMs(): number {
  try {
    const perf =
      (typeof window !== 'undefined' && window.performance) ||
      (typeof performance !== 'undefined' ? performance : null);
    if (perf && typeof perf.now === 'function') return perf.now();
  } catch {
    /* fall through */
  }
  return Date.now();
}

function isTerminated(): boolean {
  try {
    return typeof document !== 'undefined' && document.documentElement.hasAttribute(TERMINATED_ATTR);
  } catch {
    return false;
  }
}

/** The published state, if any engine (bootstrap or module) built one on this document. */
export function readEntryChimeShared(): EntryChimeShared | null {
  if (typeof window === 'undefined') return null;
  try {
    const shared = window[ENTRY_CHIME_SHARED_KEY];
    if (shared && shared.v === 1 && typeof shared.tryFire === 'function' && typeof shared.cancel === 'function') {
      return shared;
    }
  } catch {
    /* no-op */
  }
  return null;
}

/** Two-note crystal blip on the given (RUNNING) context. */
function synthesizeChime(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const bus = ctx.createGain();
  bus.gain.value = ENTRY_CHIME_BUS_GAIN;
  bus.connect(ctx.destination);

  const tone = (freq: number, start: number, peak: number, attack: number, end: number) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, start + end);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(start);
    osc.stop(start + end + 0.02);
  };

  for (const { freq, at, dur } of ENTRY_CHIME_NOTES) {
    const start = now + at;
    tone(freq, start, 1, 0.012, dur);
    tone(freq * 2, start, ENTRY_CHIME_PARTIAL_GAIN, 0.01, dur * 0.7);
  }
}

/**
 * Builds the persistent chime engine on a fresh context and publishes it.
 * Returns null when Web Audio is unavailable or the engine refuses a context.
 */
function createEngine(): EntryChimeShared | null {
  const AudioCtxCtor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxCtor) return null;

  let ctx: AudioContext;
  try {
    ensurePlaybackAudioSession();
    ctx = new AudioCtxCtor();
  } catch {
    return null;
  }
  const silent = makeSilentBuffer(ctx);
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  let listening = false;

  // Everything is declared before anything can call it (the round-24 TDZ
  // lesson), every step is fenced -- this engine can never throw.
  const shared: EntryChimeShared = {
    v: 1,
    source: 'module',
    ctx,
    played: false,
    playedAt: 0,
    cancelled: false,
    armedAt: nowMs(),
    gestureAt: 0,
    tryFire,
    cancel,
  };

  function off(): void {
    if (!listening) return;
    listening = false;
    try {
      for (const type of ACTIVATION_UNLOCK_EVENTS) window.removeEventListener(type, onGesture, opts);
    } catch {
      /* no-op */
    }
    try {
      ctx.removeEventListener('statechange', onState);
    } catch {
      /* no-op */
    }
    try {
      window.removeEventListener(APP_EXIT_EVENT, cancel);
      window.removeEventListener(APP_TERMINATE_EVENT, cancel);
    } catch {
      /* no-op */
    }
  }

  function releaseContext(): void {
    shared.ctx = null;
    try {
      ctx.close().catch(() => {});
    } catch {
      /* no-op */
    }
  }

  function fire(): boolean {
    if (shared.played) return true;
    if (shared.cancelled) return false;
    if (isTerminated() || readAudioPrefMuted()) {
      cancel();
      return false;
    }
    shared.played = true;
    shared.playedAt = nowMs();
    try {
      synthesizeChime(ctx);
    } catch {
      /* a synth failure must never surface to the caller */
    }
    off();
    try {
      setTimeout(releaseContext, ENTRY_CHIME_CLOSE_MS);
    } catch {
      /* no-op */
    }
    return true;
  }

  function tryFire(): boolean {
    if (shared.played) return true;
    if (shared.cancelled) return false;
    try {
      ensurePlaybackAudioSession();
      if (silent) kickAudioContext(ctx, silent);
      if (ctx.state === 'running') return fire();
      // Suspended (autoplay policy) OR WebKit's non-standard `interrupted`:
      // fire from the resume promise / statechange, whichever lands first.
      ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') fire();
        })
        .catch(() => {});
    } catch {
      /* never throw out of a gesture */
    }
    return false;
  }

  function onGesture(): void {
    if (!shared.gestureAt) shared.gestureAt = nowMs();
    tryFire();
  }

  function onState(): void {
    if (ctx.state === 'running') fire();
  }

  function cancel(): void {
    if (shared.cancelled) return;
    shared.cancelled = true;
    off();
    releaseContext();
  }

  try {
    listening = true;
    for (const type of ACTIVATION_UNLOCK_EVENTS) window.addEventListener(type, onGesture, opts);
    ctx.addEventListener('statechange', onState);
    window.addEventListener(APP_EXIT_EVENT, cancel);
    window.addEventListener(APP_TERMINATE_EVENT, cancel);
  } catch {
    /* no-op */
  }

  try {
    window[ENTRY_CHIME_SHARED_KEY] = shared;
  } catch {
    /* no-op */
  }
  return shared;
}

export interface ArmLogoEntryChimeOptions {
  /**
   * True when the logo page is being REPLAYED (founder debug panel, the
   * Coming-Soon "다시 재생"): a pending chime from the cold entry is
   * superseded by this run's own chime; a chime that just played (the tap
   * that started the replay) is not doubled.
   */
  replay?: boolean;
}

/**
 * Arms the logo-page entry chime for this document. Plays at most once per
 * logo-page run, at the earliest instant the engine allows -- immediately
 * where autoplay is permitted, else inside the visitor's first activation
 * gesture -- and STAYS ARMED past the end of the logo page until that
 * gesture arrives (the mobile-browser fix; see the file header). Idempotent:
 * a second cold-entry call (a SovereignShield remount of the splash) adopts
 * the pending engine. Never throws.
 */
export function armLogoEntryChime(options: ArmLogoEntryChimeOptions = {}): void {
  if (typeof window === 'undefined') return;
  const replay = options.replay === true;

  const shared = readEntryChimeShared();
  if (shared) {
    if (!replay) {
      // Cold entry: the head bootstrap (or an earlier mount) owns the chime.
      // Already chimed / already stood down -> nothing to add. Pending ->
      // one more resume attempt now (sticky activation gained before
      // hydration is honoured by every modern engine) and leave it armed.
      if (shared.played || shared.cancelled) return;
      shared.tryFire();
      return;
    }
    if (!shared.played && !shared.cancelled) {
      // A replay supersedes the pending chime with its own.
      shared.cancel();
    } else if (shared.played && nowMs() - shared.playedAt < ENTRY_CHIME_REPLAY_DEDUPE_MS) {
      return;
    }
  }

  if (readAudioPrefMuted()) return;
  const engine = createEngine();
  if (!engine) return;
  engine.tryFire();
}

/** Stand the pending chime down (exit / tests). No-op once it has played. */
export function cancelLogoEntryChime(): void {
  const shared = readEntryChimeShared();
  if (shared && !shared.played) shared.cancel();
}

/**
 * Pre-hydration twin of `createEngine()` + `armLogoEntryChime()`. Injected
 * verbatim into <head> by app/layout.tsx AFTER the PWA bootstrap (which
 * stamps `html[data-splash="off"]` for `?splash=0` and for every in-place
 * refresh -- the chime belongs to the logo page, so it is skipped whenever
 * the logo page is). Dependency-free ES5; touches only `window`, `document`,
 * `navigator`, `localStorage`, `performance`, `setTimeout`.
 *
 * Same state machine, same note table, same shared `window` record as the
 * module: the hydrated `armLogoEntryChime()` adopts whatever this parked,
 * and the `played` flag is shared, so the chime can never sound twice for
 * one logo page whichever side wins the race.
 */
export const ENTRY_CHIME_BOOTSTRAP = `(function(){try{
var S=${JSON.stringify(ENTRY_CHIME_SHARED_KEY)},K=${JSON.stringify(AUDIO_PREF_KEY)},T=${JSON.stringify(TERMINATED_ATTR)},X=${JSON.stringify(APP_EXIT_EVENT)},Q=${JSON.stringify(APP_TERMINATE_EVENT)};
var EV=${JSON.stringify([...ACTIVATION_UNLOCK_EVENTS])},NOTES=${JSON.stringify(ENTRY_CHIME_NOTES)},BUS=${ENTRY_CHIME_BUS_GAIN},PART=${ENTRY_CHIME_PARTIAL_GAIN},CLOSE=${ENTRY_CHIME_CLOSE_MS};
if(window[S])return;
try{if(document.documentElement.getAttribute('data-splash')==='off')return;}catch(_){}
function muted(){try{return window.localStorage.getItem(K)==='off';}catch(_){return false;}}
if(muted())return;
var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
function now(){try{return window.performance.now();}catch(_){return Date.now();}}
function session(){try{var a=navigator.audioSession;if(a&&a.type!=='playback')a.type='playback';}catch(_){}}
var ctx,silent=null;
try{session();ctx=new AC();}catch(_){return;}
try{silent=ctx.createBuffer(1,1,22050);}catch(_){}
var sh={v:1,source:'bootstrap',ctx:ctx,played:false,playedAt:0,cancelled:false,armedAt:now(),gestureAt:0,tryFire:tryFire,cancel:cancel};
var live=false,O={capture:true,passive:true};
function kick(){if(!silent)return;try{var s=ctx.createBufferSource();s.buffer=silent;s.connect(ctx.destination);s.start(0);s.stop(ctx.currentTime+0.01);}catch(_){}}
function tone(f,st,peak,atk,end,bus){var o=ctx.createOscillator();o.type='sine';o.frequency.value=f;var g=ctx.createGain();g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(peak,st+atk);g.gain.exponentialRampToValueAtTime(0.001,st+end);o.connect(g);g.connect(bus);o.start(st);o.stop(st+end+0.02);}
function synth(){var t=ctx.currentTime,bus=ctx.createGain();bus.gain.value=BUS;bus.connect(ctx.destination);for(var i=0;i<NOTES.length;i++){var n=NOTES[i],st=t+n.at;tone(n.freq,st,1,0.012,n.dur,bus);tone(n.freq*2,st,PART,0.01,n.dur*0.7,bus);}}
function terminated(){try{return document.documentElement.hasAttribute(T);}catch(_){return false;}}
function closeCtx(){sh.ctx=null;try{var p=ctx.close();if(p&&p.then)p.then(null,function(){});}catch(_){}}
function off(){if(!live)return;live=false;for(var i=0;i<EV.length;i++){window.removeEventListener(EV[i],on,true);}try{ctx.removeEventListener('statechange',st);}catch(_){}try{window.removeEventListener(X,cancel);window.removeEventListener(Q,cancel);}catch(_){}}
function fire(){if(sh.played)return true;if(sh.cancelled)return false;if(terminated()||muted()){cancel();return false;}sh.played=true;sh.playedAt=now();try{synth();}catch(_){}off();try{setTimeout(closeCtx,CLOSE);}catch(_){}return true;}
function tryFire(){if(sh.played)return true;if(sh.cancelled)return false;try{session();kick();if(ctx.state==='running')return fire();var p=ctx.resume();if(p&&p.then)p.then(function(){if(ctx.state==='running')fire();},function(){});}catch(_){}return false;}
function on(){if(!sh.gestureAt)sh.gestureAt=now();tryFire();}
function st(){if(ctx.state==='running')fire();}
function cancel(){if(sh.cancelled)return;sh.cancelled=true;off();closeCtx();}
window[S]=sh;
live=true;for(var i=0;i<EV.length;i++){window.addEventListener(EV[i],on,O);}
try{ctx.addEventListener('statechange',st);}catch(_){}
try{window.addEventListener(X,cancel);window.addEventListener(Q,cancel);}catch(_){}
tryFire();
}catch(_){}})();`;
