'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { APP_EXIT_EVENT, APP_TERMINATE_EVENT } from '@/lib/exit/appExit';

/**
 * The "Quantum Blue Pulse" -- a single ring that expands from the click that
 * just closed a successful U-Pay investment out across the whole white
 * canvas (spec section 4 + section 10 item 10). Deliberately decoupled from
 * `UPayGateway` via a `window` event so ANY future success moment (module
 * entry, a lock-in activation) can trigger the same feedback without a prop
 * drilled through three pop-out layers.
 *
 * Rendered through `ModalPortal` (body-level, spec section 9) so its
 * `position: fixed` math is never skewed by `.dashboard-zoom`'s `zoom: .75`.
 * Bounded to 3 concurrent ripples (Low-Memory Armor) -- a 4th emit drops the
 * oldest rather than growing without limit.
 */

const QUANTUM_PULSE_EVENT = 'unitas:quantum-pulse';
/** Ripples never outlive this; also the full-motion ring duration. */
const PULSE_DURATION_MS = 900;
/** Reduced-motion: a single flat fade instead of an expanding ring. */
const PULSE_REDUCED_DURATION_MS = 300;
/** At most this many rings animate at once. */
const MAX_CONCURRENT_PULSES = 3;
/** Seed diameter (px) of the ring before it scales up. */
const PULSE_SEED_DIAMETER = 40;
/** Final diameter is roughly 3x the viewport's larger dimension. */
const PULSE_COVERAGE_FACTOR = 3;

export interface QuantumPulseOrigin {
  x: number;
  y: number;
}

interface QuantumPulseDetail extends QuantumPulseOrigin {
  id: number;
}

let pulseSeq = 0;

/** Dispatches a Quantum Blue Pulse centred on `origin` (viewport coords). */
export function emitQuantumPulse(origin: QuantumPulseOrigin): void {
  if (typeof window === 'undefined') return;
  pulseSeq += 1;
  try {
    window.dispatchEvent(
      new CustomEvent<QuantumPulseDetail>(QUANTUM_PULSE_EVENT, {
        detail: { id: pulseSeq, x: origin.x, y: origin.y },
      }),
    );
  } catch {
    /* an environment without CustomEvent simply gets no visual feedback */
  }
}

interface ActivePulse extends QuantumPulseDetail {
  /** Final scale so the ring's edge clears the viewport at emit time. */
  scale: number;
}

function computeScale(): number {
  if (typeof window === 'undefined') return 40;
  const maxDim = Math.max(window.innerWidth || 0, window.innerHeight || 0);
  return (maxDim * PULSE_COVERAGE_FACTOR) / PULSE_SEED_DIAMETER;
}

/**
 * Fixed, full-viewport, `pointer-events:none` host for the pulse ripples.
 * Mount once (spec: `QuantumWhiteHome` renders `<QuantumBluePulseHost/>`).
 */
export function QuantumBluePulseHost() {
  const reduceMotion = useReducedMotion();
  const [pulses, setPulses] = useState<ActivePulse[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removePulse = useCallback((id: number) => {
    setPulses((prev) => prev.filter((p) => p.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const clearAll = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setPulses([]);
  }, []);

  useEffect(() => {
    const onPulse = (e: Event) => {
      const detail = (e as CustomEvent<QuantumPulseDetail>).detail;
      if (!detail) return;
      const next: ActivePulse = { ...detail, scale: computeScale() };
      setPulses((prev) => {
        const merged = [...prev, next];
        // Bounded: drop the oldest ring(s) beyond the concurrency cap.
        const overflow = merged.length - MAX_CONCURRENT_PULSES;
        if (overflow > 0) {
          for (const dropped of merged.slice(0, overflow)) removePulse(dropped.id);
          return merged.slice(overflow);
        }
        return merged;
      });
      const duration = reduceMotion ? PULSE_REDUCED_DURATION_MS : PULSE_DURATION_MS;
      const timer = setTimeout(() => removePulse(next.id), duration + 50);
      timers.current.set(next.id, timer);
    };

    window.addEventListener(QUANTUM_PULSE_EVENT, onPulse);
    // App exit doctrine (spec section 10 item 12): no lingering timers.
    window.addEventListener(APP_EXIT_EVENT, clearAll);
    window.addEventListener(APP_TERMINATE_EVENT, clearAll);
    return () => {
      window.removeEventListener(QUANTUM_PULSE_EVENT, onPulse);
      window.removeEventListener(APP_EXIT_EVENT, clearAll);
      window.removeEventListener(APP_TERMINATE_EVENT, clearAll);
      clearAll();
    };
  }, [reduceMotion, removePulse, clearAll]);

  return (
    <ModalPortal>
      <div className="pointer-events-none fixed inset-0 z-[210] overflow-hidden" aria-hidden="true">
        <AnimatePresence>
          {pulses.map((pulse) =>
            reduceMotion ? (
              <motion.div
                key={pulse.id}
                className="absolute inset-0"
                style={{ background: 'var(--qw-blue, #0b5cff)' }}
                initial={{ opacity: 0.18 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: PULSE_REDUCED_DURATION_MS / 1000, ease: 'easeOut' }}
              />
            ) : (
              <motion.div
                key={pulse.id}
                className="absolute rounded-full"
                style={{
                  left: pulse.x - PULSE_SEED_DIAMETER / 2,
                  top: pulse.y - PULSE_SEED_DIAMETER / 2,
                  width: PULSE_SEED_DIAMETER,
                  height: PULSE_SEED_DIAMETER,
                  border: '2px solid var(--qw-blue, #0b5cff)',
                  background:
                    'radial-gradient(circle, rgba(11,92,255,.18) 0%, rgba(11,92,255,0) 70%)',
                  willChange: 'transform, opacity',
                }}
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: pulse.scale, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: PULSE_DURATION_MS / 1000, ease: 'easeOut' }}
              />
            ),
          )}
        </AnimatePresence>
      </div>
    </ModalPortal>
  );
}
