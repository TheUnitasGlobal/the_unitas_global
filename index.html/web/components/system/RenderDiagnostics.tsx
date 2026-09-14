'use client';

/**
 * REV-26 MISSION 1 -- the real-device render diagnostic.
 *
 * WHAT IT ANSWERS. REV-25 could not say anything about Safari on real
 * hardware: a headless WebKit has no GPU path at all, so its 363ms frames
 * measured the harness, not the product. This is the instrument that a REAL
 * device runs, on the REAL released page, so the question stops being open.
 *
 * HOW IT COSTS NOTHING. Three fences, in order:
 *   1. it is only imported when the URL carries `?diag=1` (the parent does a
 *      dynamic import, so the chunk is not in anyone else's bundle);
 *   2. it renders null until the SERVER confirms the founder
 *      (`/api/sovereign/verify`), exactly like the sovereign console;
 *   3. it measures nothing until the founder presses Run. There is no passive
 *      timer, no passive rAF, no passive listener. Idle cost is zero, which is
 *      the same standard REV-24 M3 holds the rest of the app to.
 *
 * THE CONTROL IS THE WHOLE POINT. Measuring frame cadence on a phone tells you
 * nothing on its own -- a slow phone is slow, not broken. So the probe measures
 * the same cadence TWICE: once with the page on screen, once with the page's
 * content hidden. The difference is what the PAGE costs; the floor is what the
 * DEVICE costs. That separation is exactly what REV-25's WebKit number lacked,
 * and `lib/diagnostics/renderProbe.ts` turns the pair into a verdict.
 *
 * The readout is deliberately untranslated. These are measurement labels and
 * renderer strings, not prose -- the same choice the sovereign console makes --
 * so this ships with ZERO new i18n keys across twenty locales.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { verifySovereignFounder } from '@/lib/foundersGate';
import {
  buildReport,
  headline,
  summarizeGaps,
  type DeviceFacts,
  type RenderReading,
  type RenderReport,
} from '@/lib/diagnostics/renderProbe';

/** How many frame gaps each pass collects. ~1.5s at 60fps, ~30s at 2fps. */
const FRAMES = 90;
/** Hard ceiling so a very slow device cannot hang the probe forever. */
const PASS_TIMEOUT_MS = 12_000;
const IDLE_WATCH_MS = 3_000;
const LATENCY_SAMPLES = 20;

type Phase = 'idle' | 'running' | 'done' | 'failed';

function cadence(frames = FRAMES): Promise<number[]> {
  return new Promise((resolve) => {
    const gaps: number[] = [];
    let last = performance.now();
    const deadline = last + PASS_TIMEOUT_MS;
    const tick = (now: number) => {
      gaps.push(now - last);
      last = now;
      if (gaps.length < frames && now < deadline) requestAnimationFrame(tick);
      else resolve(gaps);
    };
    requestAnimationFrame(tick);
  });
}

function mainThreadLatency(samples = LATENCY_SAMPLES): Promise<number> {
  return new Promise((resolve) => {
    const out: number[] = [];
    const step = () => {
      const t = performance.now();
      setTimeout(() => {
        out.push(performance.now() - t);
        if (out.length < samples) step();
        else {
          out.sort((a, b) => a - b);
          resolve(Number(out[Math.floor(out.length / 2)].toFixed(2)));
        }
      }, 0);
    };
    step();
  });
}

/** Frames the APPLICATION asks for while nothing is touching the page. */
function idleFrames(ms = IDLE_WATCH_MS): Promise<number> {
  return new Promise((resolve) => {
    let n = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      n += 1;
      return raf(cb);
    }) as typeof window.requestAnimationFrame;
    setTimeout(() => {
      window.requestAnimationFrame = raf;
      resolve(n);
    }, ms);
  });
}

/**
 * Run `work` with the page's own content hidden. Everything goes, including
 * this overlay: the control must measure an EMPTY document, or it is not a
 * floor. The screen blanks for a moment and comes back.
 */
async function withPageHidden<T>(work: () => Promise<T>): Promise<T> {
  const style = document.createElement('style');
  style.setAttribute('data-unitas-diag-control', '');
  style.textContent = 'body > *:not(script):not([data-unitas-diag-control]){display:none !important;}';
  document.head.appendChild(style);
  try {
    // One frame for the hide to actually take effect before sampling.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return await work();
  } finally {
    style.remove();
  }
}

/**
 * Main-thread latency WHILE a transform/opacity animation runs. A
 * compositor-driven animation does not touch the main thread, so this should
 * look like the idle figure; if it spikes, the acceleration path is not intact.
 */
async function latencyDuringCompositorAnimation(): Promise<number | null> {
  if (typeof document.createElement('div').animate !== 'function') return null;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:120px;height:120px;pointer-events:none;opacity:0.01;background:#38bdf8;will-change:transform;z-index:-1;';
  document.body.appendChild(probe);
  let animation: Animation | null = null;
  try {
    animation = probe.animate(
      [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(120px,0,0)' }],
      { duration: 800, iterations: Infinity, direction: 'alternate' },
    );
    return await mainThreadLatency();
  } catch {
    return null;
  } finally {
    try {
      animation?.cancel();
    } catch {
      /* no-op */
    }
    probe.remove();
  }
}

function gpuFacts(): Pick<RenderReading, 'gpuRenderer' | 'gpuVendor' | 'webgl'> {
  const canvas = document.createElement('canvas');
  try {
    const gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    const gl = (gl2 ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return { gpuRenderer: null, gpuVendor: null, webgl: 'none' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : (gl.getParameter(gl.RENDERER) as string);
    const vendor = ext ? (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string) : (gl.getParameter(gl.VENDOR) as string);
    // Release the context immediately -- a diagnostic must not hold a GPU
    // context open on a phone.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { gpuRenderer: renderer ?? null, gpuVendor: vendor ?? null, webgl: gl2 ? 'webgl2' : 'webgl' };
  } catch {
    return { gpuRenderer: null, gpuVendor: null, webgl: 'none' };
  }
}

function deviceFacts(): DeviceFacts {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mq = (query: string) => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  };
  return {
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    reducedMotion: mq('(prefers-reduced-motion: reduce)'),
    coarsePointer: mq('(pointer: coarse)'),
  };
}

export async function collectRenderReport(): Promise<RenderReport> {
  const gpu = gpuFacts();
  const framesScheduledWhileIdle = await idleFrames();
  const page = summarizeGaps(await cadence());
  const mainThreadLatencyMs = await mainThreadLatency();
  const mainThreadLatencyDuringCompositorAnimationMs = await latencyDuringCompositorAnimation();
  const control = summarizeGaps(await withPageHidden(() => cadence()));
  const reading: RenderReading = {
    page,
    control,
    framesScheduledWhileIdle,
    mainThreadLatencyMs,
    mainThreadLatencyDuringCompositorAnimationMs,
    ...gpu,
  };
  return buildReport({
    capturedAt: new Date().toISOString(),
    url: window.location.href,
    device: deviceFacts(),
    reading,
  });
}

export function RenderDiagnostics() {
  const [founder, setFounder] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [report, setReport] = useState<RenderReport | null>(null);
  const [copied, setCopied] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    let alive = true;
    void verifySovereignFounder().then((result) => {
      if (alive && result.founder) setFounder(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setPhase('running');
    setReport(null);
    setCopied(false);
    try {
      setReport(await collectRenderReport());
      setPhase('done');
    } catch {
      setPhase('failed');
    } finally {
      running.current = false;
    }
  }, []);

  const copy = useCallback(async () => {
    if (!report) return;
    const text = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard refused (an insecure context, or a browser that asks): the
      // JSON is on screen and selectable, which is the fallback that always
      // works.
      setCopied(false);
    }
  }, [report]);

  if (!founder) return null;

  return (
    <aside
      data-unitas-render-diagnostics=""
      aria-label="Render diagnostics"
      style={{
        position: 'fixed',
        right: 'max(12px, env(safe-area-inset-right))',
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        zIndex: 470,
        width: 'min(26rem, calc(100vw - 24px))',
        maxHeight: '70vh',
        overflow: 'auto',
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid rgba(212,175,55,0.35)',
        background: 'rgba(8,8,10,0.93)',
        color: '#e7e9ee',
        font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
        boxShadow: '0 18px 48px -22px rgba(0,0,0,0.9)',
      }}
    >
      <p style={{ margin: '0 0 8px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#d4af37' }}>Render probe</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          data-diag-run=""
          onClick={() => void run()}
          disabled={phase === 'running'}
          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(212,175,55,0.5)', background: 'transparent', color: '#e7e9ee', font: 'inherit', fontWeight: 700 }}
        >
          {phase === 'running' ? 'measuring…' : 'Run'}
        </button>
        {report && (
          <button
            type="button"
            data-diag-copy=""
            onClick={() => void copy()}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.22)', background: 'transparent', color: '#e7e9ee', font: 'inherit' }}
          >
            {copied ? 'copied' : 'Copy JSON'}
          </button>
        )}
      </div>

      {phase === 'idle' && <p style={{ margin: 0, color: '#9aa2b1' }}>Measures this page against this device&rsquo;s own floor. The screen blanks for about a second while the control pass runs.</p>}
      {phase === 'failed' && <p style={{ margin: 0, color: '#f87171' }}>the probe could not complete on this device</p>}

      {report && (
        <>
          <p data-diag-status={report.verdict.status} style={{ margin: '0 0 6px', fontWeight: 700, color: report.verdict.status === 'accelerated' ? '#4ade80' : '#fbbf24' }}>
            {report.verdict.status}
          </p>
          <p data-diag-headline="" style={{ margin: '0 0 8px', wordBreak: 'break-word', color: '#cbd2df' }}>
            {headline(report)}
          </p>
          {report.verdict.findings.length > 0 && (
            <ul style={{ margin: '0 0 8px', paddingLeft: 16, color: '#fbbf24' }}>
              {report.verdict.findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <pre data-diag-json="" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#8f98a8', fontSize: 11 }}>
            {JSON.stringify(report, null, 2)}
          </pre>
        </>
      )}
    </aside>
  );
}
