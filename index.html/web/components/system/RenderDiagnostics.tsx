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
import {
  PAINT_REGIONS,
  rankRecovery,
  summarizePaintInventory,
  type BisectReport,
  type PaintInventory,
  type RegionSample,
} from '@/lib/diagnostics/paintBisect';
import {
  REQUIRED_MANIFEST_FIELDS,
  classifyPwaReadiness,
  detectPlatform,
  pwaHeadline,
  type PwaFacts,
  type PwaReadiness,
} from '@/lib/diagnostics/pwaReadiness';
import { PWA_INSTALL_TRIGGER_ATTR, isStandaloneDisplay } from '@/lib/pwa/installPrompt';

/** How many frame gaps each pass collects. ~1.5s at 60fps, ~30s at 2fps. */
const FRAMES = 90;
/** Hard ceiling so a very slow device cannot hang the probe forever. */
const PASS_TIMEOUT_MS = 12_000;
const IDLE_WATCH_MS = 3_000;
const LATENCY_SAMPLES = 20;
/** Eight regional passes run back to back; a median needs fewer frames. */
const BISECT_FRAMES = 40;

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

/* ------------------------------------------------------------------ */
/* REV-28 M1 -- the bottleneck adapter                                  */
/* ------------------------------------------------------------------ */

/** Hide one region for the duration of `work`, then put it back. */
async function withHidden<T>(selector: string, work: () => Promise<T>): Promise<{ value: T; matched: number }> {
  const matched = document.querySelectorAll(selector).length;
  const style = document.createElement('style');
  style.setAttribute('data-unitas-diag-control', '');
  style.textContent = `${selector}{display:none !important;}`;
  document.head.appendChild(style);
  try {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return { value: await work(), matched };
  } finally {
    style.remove();
  }
}

/**
 * REV-26 bisected the page by hand to find where the cost was. This is that
 * procedure, automated: hide each region, re-measure, report what came back.
 * Shorter passes than the main probe -- eight of them run back to back, and the
 * figure wanted here is a median, not a distribution.
 */
export async function collectBisect(floorMedian: number): Promise<BisectReport> {
  const baseline = summarizeGaps(await cadence(BISECT_FRAMES)).median;
  const samples: RegionSample[] = [];
  for (const region of PAINT_REGIONS) {
    // The overlay itself must never be part of what is being measured; it is a
    // direct child of body, so `everything` would otherwise hide it mid-pass.
    const selector = region.key === 'everything' ? 'body > *:not(script):not([data-unitas-render-diagnostics])' : region.selector;
    const { value, matched } = await withHidden(selector, () => cadence(BISECT_FRAMES));
    samples.push({ key: region.key, medianWithout: summarizeGaps(value).median, matched });
  }
  return rankRecovery(baseline, floorMedian, samples);
}

/** What the page ASKS the compositor for, counted. */
export function collectPaintInventory(): PaintInventory {
  const all = Array.from(document.querySelectorAll<HTMLElement>('body *'));
  const inv: PaintInventory = {
    backdropFilter: 0,
    filter: 0,
    blurRadiusMax: 0,
    boxShadow: 0,
    gradient: 0,
    willChange: 0,
    canvas: document.querySelectorAll('canvas').length,
    runningAnimations: 0,
    elements: all.length,
  };
  for (const el of all) {
    const cs = getComputedStyle(el);
    const backdrop = cs.backdropFilter || (cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || 'none';
    if (backdrop && backdrop !== 'none') {
      inv.backdropFilter += 1;
      const blur = /blur\(([\d.]+)px\)/.exec(backdrop);
      if (blur) inv.blurRadiusMax = Math.max(inv.blurRadiusMax, Number(blur[1]));
    }
    if (cs.filter && cs.filter !== 'none') {
      inv.filter += 1;
      const blur = /blur\(([\d.]+)px\)/.exec(cs.filter);
      if (blur) inv.blurRadiusMax = Math.max(inv.blurRadiusMax, Number(blur[1]));
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') inv.boxShadow += 1;
    if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) inv.gradient += 1;
    if (cs.willChange && cs.willChange !== 'auto') inv.willChange += 1;
    if (cs.animationName && cs.animationName !== 'none' && cs.animationPlayState === 'running') inv.runningAnimations += 1;
  }
  return inv;
}

/* ------------------------------------------------------------------ */
/* REV-28 M2 -- PWA install readiness                                   */
/* ------------------------------------------------------------------ */

export async function collectPwaFacts(): Promise<PwaFacts> {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  let manifestOk = false;
  const manifestMissing: string[] = [];
  if (link?.href) {
    try {
      const res = await fetch(link.href, { credentials: 'same-origin' });
      if (res.ok) {
        const manifest = (await res.json()) as Record<string, unknown>;
        manifestOk = true;
        for (const field of REQUIRED_MANIFEST_FIELDS) {
          const value = manifest[field];
          const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
          if (empty) manifestMissing.push(field);
        }
      }
    } catch {
      manifestOk = false;
    }
  }
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  return {
    platform: detectPlatform(navigator.userAgent, nav.maxTouchPoints ?? 0),
    standalone: isStandaloneDisplay(),
    swControlled: 'serviceWorker' in navigator ? Boolean(navigator.serviceWorker.controller) : false,
    manifestOk,
    manifestMissing,
    promptCaptured: Boolean((window as unknown as { __unitasPwaPrompt?: unknown }).__unitasPwaPrompt),
    secureContext: typeof window.isSecureContext === 'boolean' ? window.isSecureContext : location.protocol === 'https:',
  };
}

export function RenderDiagnostics() {
  const [founder, setFounder] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [report, setReport] = useState<RenderReport | null>(null);
  const [bisect, setBisect] = useState<BisectReport | null>(null);
  const [inventory, setInventory] = useState<PaintInventory | null>(null);
  const [bisecting, setBisecting] = useState(false);
  const [pwa, setPwa] = useState<{ facts: PwaFacts; readiness: PwaReadiness } | null>(null);
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

  // PWA facts are free to read -- no frames, no timers -- so they are gathered
  // once the founder is confirmed rather than hidden behind another press.
  useEffect(() => {
    if (!founder) return;
    let alive = true;
    void collectPwaFacts()
      .then((facts) => {
        if (alive) setPwa({ facts, readiness: classifyPwaReadiness(facts) });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [founder]);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setPhase('running');
    setReport(null);
    setCopied(false);
    setBisect(null);
    setInventory(null);
    try {
      setReport(await collectRenderReport());
      setPhase('done');
    } catch {
      setPhase('failed');
    } finally {
      running.current = false;
    }
  }, []);

  /**
   * The follow-up question. `raster-bound` says the page is expensive; this
   * says WHERE. Separate press, because it is eight more measured passes and
   * the founder should not pay for them unless the first answer warrants it.
   */
  const runBisect = useCallback(async () => {
    if (running.current || !report) return;
    running.current = true;
    setBisecting(true);
    try {
      setInventory(collectPaintInventory());
      setBisect(await collectBisect(report.reading.control.median));
    } catch {
      setBisect(null);
    } finally {
      setBisecting(false);
      running.current = false;
    }
  }, [report]);

  const copy = useCallback(async () => {
    if (!report) return;
    const text = JSON.stringify({ ...report, bottleneck: bisect, paintInventory: inventory, pwa }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard refused (an insecure context, or a browser that asks): the
      // JSON is on screen and selectable, which is the fallback that always
      // works.
      setCopied(false);
    }
  }, [report, bisect, inventory, pwa]);

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
            data-diag-bisect=""
            onClick={() => void runBisect()}
            disabled={bisecting}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.22)', background: 'transparent', color: '#e7e9ee', font: 'inherit' }}
          >
            {bisecting ? 'bisecting…' : 'Find bottleneck'}
          </button>
        )}
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
          {bisect && (
            <section data-diag-bottleneck="" style={{ margin: '0 0 8px', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#d4af37' }}>Bottleneck</p>
              <ul style={{ margin: '0 0 6px', paddingLeft: 0, listStyle: 'none', color: '#cbd2df' }}>
                {bisect.regions.map((r) => (
                  <li key={r.key} data-diag-region={r.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ opacity: r.matched === 0 ? 0.45 : 1 }}>
                      {r.label}
                      {r.matched === 0 ? ' (absent)' : ''}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.recoveredMs}ms · {r.sharePct}%
                    </span>
                  </li>
                ))}
              </ul>
              <ul style={{ margin: 0, paddingLeft: 16, color: '#9aa2b1' }}>
                {bisect.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
                {inventory && summarizePaintInventory(inventory).map((n) => <li key={n}>{n}</li>)}
              </ul>
            </section>
          )}

          <pre data-diag-json="" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#8f98a8', fontSize: 11 }}>
            {JSON.stringify(report, null, 2)}
          </pre>
        </>
      )}

      {pwa && (
        <section data-diag-pwa={pwa.readiness.status} style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#d4af37' }}>PWA install</p>
          <p data-diag-pwa-headline="" style={{ margin: '0 0 6px', wordBreak: 'break-word', color: '#cbd2df' }}>
            {pwaHeadline(pwa.facts, pwa.readiness)}
          </p>
          <p style={{ margin: '0 0 6px', color: '#9aa2b1' }}>{pwa.readiness.nextAction}</p>
          {pwa.readiness.blockers.length > 0 && (
            <ul style={{ margin: '0 0 6px', paddingLeft: 16, color: '#fbbf24' }}>
              {pwa.readiness.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {pwa.readiness.status === 'ready' && (
            <button
              type="button"
              data-diag-pwa-install=""
              {...({ [PWA_INSTALL_TRIGGER_ATTR]: 'diagnostics' } as Record<string, string>)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(212,175,55,0.5)', background: 'transparent', color: '#e7e9ee', font: 'inherit', fontWeight: 700 }}
            >
              Install
            </button>
          )}
        </section>
      )}
    </aside>
  );
}
