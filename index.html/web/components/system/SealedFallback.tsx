'use client';

/**
 * FAIL-CLOSED fallback for the pre-launch curtain's shield (owner instruction
 * 2026-09-07, item 1). ComingSoonCinema is the layer that keeps the real site
 * hidden from the public; if IT ever faults, rendering "nothing" would expose
 * the site behind it -- the one outcome worse than an error screen. So its
 * SovereignShield falls back to this static sealed panel: same z-layer
 * (z-400) as the curtain, opaque void, brand only, no controls. Mirrors the
 * <noscript> panel in app/[locale]/layout.tsx. The shield's self-heal then
 * remounts the real curtain a beat later.
 */
export function SealedFallback() {
  return (
    <div
      role="presentation"
      className="cs-root fixed inset-0 z-[400] flex flex-col items-center justify-center bg-void p-6 text-center"
      style={{ fontFamily: 'var(--font-cinzel), Georgia, serif' }}
    >
      <p className="text-xs tracking-[0.4em] text-accent/70">UNITAS</p>
      <h2 className="mb-2 mt-4 text-3xl tracking-[0.2em] text-gray-100">COMING SOON</h2>
      <p className="text-sm text-gray-300">The Sovereign Intelligence is Awakening</p>
    </div>
  );
}
