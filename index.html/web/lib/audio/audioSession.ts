// Mobile audio-session hardening (owner instruction 2026-09-05, hardening
// patch, item 4 -- "모바일 로그페이지 오디오 누락 원천 해결").
//
// On iOS, Web Audio output is muted by the hardware ring/silent switch unless
// the page declares a PLAYBACK audio session (Safari 17+, `navigator.
// audioSession.type = 'playback'`) -- the single most common reason a phone
// visitor hears nothing on the logo page while the very same code plays
// perfectly on a desktop. Declaring it is harmless everywhere else (the
// property simply does not exist), so every audio engine on the site calls
// this once before it first resumes a context.

interface NavigatorAudioSession {
  type: string;
}

export function ensurePlaybackAudioSession(): void {
  if (typeof navigator === 'undefined') return;
  try {
    const session = (navigator as Navigator & { audioSession?: NavigatorAudioSession }).audioSession;
    if (session && session.type !== 'playback') session.type = 'playback';
  } catch {
    /* read-only / unsupported value -- nothing to do */
  }
}

/**
 * The legacy iOS unlock: starting a (silent, one-sample) buffer source
 * synchronously inside the user gesture is what historically flipped a
 * WebKit AudioContext from "created outside a gesture, forever silent" to
 * live -- `resume()` alone was not always honoured. Harmless on every other
 * engine; the buffer is a single zero sample.
 */
export function kickAudioContext(ctx: AudioContext, silent: AudioBuffer): void {
  try {
    const src = ctx.createBufferSource();
    src.buffer = silent;
    src.connect(ctx.destination);
    src.start(0);
    src.stop(ctx.currentTime + 0.01);
  } catch {
    /* a refused kick must never throw out of the gesture handler */
  }
}

/** One-sample silent buffer for `kickAudioContext`. */
export function makeSilentBuffer(ctx: AudioContext): AudioBuffer | null {
  try {
    return ctx.createBuffer(1, 1, 22050);
  } catch {
    return null;
  }
}
