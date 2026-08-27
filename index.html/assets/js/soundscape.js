// UNITAS -- coin-core Rev 0 soundscape engine.
//
// Native Web Audio API only, no library and no binary audio assets: every
// sound is synthesized on the fly (oscillator blips for module hovers,
// filtered looped noise for the ambient bed). This sidesteps needing to
// ship/record actual audio files for a from-scratch feature.
//
// Browsers block audio until a user gesture -- call
// UnitasSoundscape.unlockOnFirstGesture() once at page load; it attaches a
// one-shot listener and resumes the shared AudioContext on the first
// click/keydown/touchstart. The wormhole intro reuses this same unlock
// instead of registering a second gesture listener.
(function () {
  'use strict';

  const STORAGE_MUTED_KEY = 'unitas_audio_muted';
  const STORAGE_VOLUME_KEY = 'unitas_audio_volume';

  const MODULE_TONES = {
    Arche: 392.0,   // G4
    Arena: 440.0,   // A4
    Score: 493.88,  // B4
    Fate: 587.33,   // D5
    Codex22: 659.25 // E5
  };

  let audioContext = null;
  let masterGain = null;
  let ambientNodes = null;
  let unlocked = false;

  function readStoredVolume() {
    const raw = Number(localStorage.getItem(STORAGE_VOLUME_KEY));
    return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.35;
  }

  function readStoredMuted() {
    return localStorage.getItem(STORAGE_MUTED_KEY) === 'true';
  }

  let muted = readStoredMuted();
  let volume = readStoredVolume();

  function ensureContext() {
    if (audioContext) return audioContext;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = muted ? 0 : volume;
    masterGain.connect(audioContext.destination);
    return audioContext;
  }

  function applyGain() {
    if (!masterGain) return;
    masterGain.gain.setTargetAtTime(muted ? 0 : volume, audioContext.currentTime, 0.05);
  }

  // A short blip: a sine oscillator with a fast attack/decay envelope,
  // pitched per module so each card reads as a distinct "voice".
  function playModuleHover(moduleName) {
    if (!unlocked || !audioContext || muted) return;
    const freq = MODULE_TONES[moduleName] || 440;
    const now = audioContext.currentTime;

    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.08);

    const envelope = audioContext.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.5, now + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(envelope);
    envelope.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Ambient bed: looped filtered white noise with a slow LFO sweeping the
  // filter cutoff, for a soft "sci-fi drone" that never repeats identically.
  function startAmbient() {
    if (!unlocked || !audioContext || ambientNodes) return;

    const bufferSeconds = 4;
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * bufferSeconds, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 4;

    const ambientGain = audioContext.createGain();
    ambientGain.gain.value = 0.06;

    const lfo = audioContext.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.05;
    const lfoDepth = audioContext.createGain();
    lfoDepth.gain.value = 220;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);

    noise.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(masterGain);

    noise.start();
    lfo.start();
    ambientNodes = { noise, lfo, filter, ambientGain };
  }

  function unlockOnFirstGesture() {
    if (unlocked) return;
    const handler = () => {
      unlocked = true;
      const ctx = ensureContext();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      startAmbient();
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('touchstart', handler);
    };
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    window.addEventListener('touchstart', handler, { once: true });
  }

  function setMuted(next) {
    muted = Boolean(next);
    localStorage.setItem(STORAGE_MUTED_KEY, String(muted));
    applyGain();
  }

  function setVolume(next) {
    volume = Math.min(1, Math.max(0, Number(next)));
    localStorage.setItem(STORAGE_VOLUME_KEY, String(volume));
    applyGain();
  }

  window.UnitasSoundscape = {
    unlockOnFirstGesture,
    playModuleHover,
    setMuted,
    setVolume,
    isMuted: () => muted,
    getVolume: () => volume,
    isUnlocked: () => unlocked,
  };
})();
