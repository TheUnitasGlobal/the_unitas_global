'use client';

import { useEffect, useState } from 'react';
import { SELF_HEAL_DELAY_MS, claimSelfHealAttempt, clearSelfHealRecord } from '@/lib/system/selfHeal';

const SELF_HEAL_SCOPE = 'root';

/**
 * Last-resort error boundary: only fires if the root layout itself throws
 * (locale not yet resolved, provider setup failure, etc.) -- everything
 * else is caught by app/[locale]/error.tsx first. This file REPLACES the
 * entire <html>/<body>, so it can't rely on next-intl, the Link helper, or
 * even globals.css being loaded; styling is inlined and content is
 * hardcoded English on purpose, to guarantee a legible page even when
 * everything else has failed.
 *
 * Same rule as the locale-scoped boundary: never render `error.message` /
 * `error.stack` / `error.name`, only the safe opaque `error.digest`.
 *
 * SELF-HEALING (owner instruction 2026-09-07, item 1): like the locale
 * boundary, the first move is to `reset()` after a short beat (two automatic
 * attempts per 30s, lib/system/selfHeal.ts) behind a quiet black void, so a
 * transient root fault never shows this screen; only a persistent one does.
 * The root layout's own modules (3D scene, intro splash, audio graph) are
 * additionally fenced by per-module SovereignShields, so this boundary is
 * reached only when the layout shell itself cannot render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [healing, setHealing] = useState(true);

  useEffect(() => {
    console.error('[Sovereign Core Error - root boundary]', error);
  }, [error]);

  useEffect(() => {
    if (!claimSelfHealAttempt(SELF_HEAL_SCOPE)) {
      setHealing(false);
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        reset();
      } catch {
        setHealing(false);
      }
    }, SELF_HEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [reset]);

  if (healing) {
    return (
      <html lang="en">
        <body style={{ margin: 0, minHeight: '100vh', backgroundColor: '#030305' }} aria-busy="true" />
      </html>
    );
  }

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          backgroundColor: '#030305',
          color: '#e2e8f0',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        }}
      >
        <h1
          style={{
            fontFamily: "'Cinzel', Georgia, serif",
            fontWeight: 700,
            fontSize: '28px',
            letterSpacing: '0.05em',
            color: '#ffffff',
            textShadow: '0 0 20px rgba(212,175,55,0.4)',
            margin: '0 0 12px',
          }}
        >
          SOVEREIGN CORE ERROR
        </h1>
        <p
          style={{
            maxWidth: '420px',
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#94a3b8',
            margin: '0 0 32px',
          }}
        >
          A critical fault occurred in the sovereign infrastructure layer. No further detail is
          available here for security compliance; our systems have been notified.
        </p>

        {error.digest && (
          <p
            style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#4b5563',
              margin: '0 0 32px',
            }}
          >
            Reference ID: {error.digest}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => {
              clearSelfHealRecord(SELF_HEAL_SCOPE);
              reset();
            }}
            style={{
              border: '1px solid #d4af37',
              background: 'rgba(212,175,55,0.1)',
              color: '#d4af37',
              padding: '10px 20px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
          <a
            href="/"
            style={{
              display: 'inline-block',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#d1d5db',
              padding: '10px 20px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              textDecoration: 'none',
            }}
          >
            Return Home
          </a>
        </div>
      </body>
    </html>
  );
}
