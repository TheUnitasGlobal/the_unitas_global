'use client';

/**
 * REV-26 MISSION 1 -- the arming fence for the real-device render probe.
 *
 * The probe itself is a founder-only instrument, and the founder gate lives on
 * the SERVER (`/api/sovereign/verify`). But a server check still costs a
 * request, and the probe's own code would still be in everyone's bundle. So
 * the URL arms it first:
 *
 *   ?diag=1  ->  dynamic import (ssr:false)  ->  server founder check  ->  UI
 *
 * Without the flag this component renders null and NEVER imports the probe, so
 * the diagnostic chunk is not downloaded, parsed or executed by a visitor. With
 * the flag but without a founder session the probe itself renders null. Idle
 * cost for everyone else: one `URLSearchParams` read, once, on mount.
 */
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const RenderDiagnostics = dynamic(() => import('./RenderDiagnostics').then((m) => m.RenderDiagnostics), { ssr: false });

export const RENDER_DIAGNOSTICS_PARAM = 'diag';

export function RenderDiagnosticsHost() {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    try {
      setArmed(new URLSearchParams(window.location.search).get(RENDER_DIAGNOSTICS_PARAM) === '1');
    } catch {
      /* a URL a browser will not parse is not an arming request */
    }
  }, []);

  if (!armed) return null;
  return <RenderDiagnostics />;
}
