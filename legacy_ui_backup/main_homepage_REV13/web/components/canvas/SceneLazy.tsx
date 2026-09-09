'use client';

import dynamic from 'next/dynamic';

/**
 * Code-splits the WebGL background (three.js + @react-three/fiber) into its
 * own chunk loaded after the initial page JS, instead of bundled inline with
 * everything else. Diagnosed via a real headless-browser click test: with
 * `Scene` imported eagerly, the heavy R3F/three.js module graph delayed
 * React's hydration of the whole tree, so the AudioGate's "Enter" button was
 * silently unresponsive to clicks for a few seconds after first paint (the
 * button existed in the server-rendered HTML but hadn't been wired up to its
 * onClick yet). Deferring the canvas via `ssr: false` lets the interactive
 * chrome (gate, nav, audio) hydrate first while the decorative background
 * loads in behind it. `next/dynamic({ ssr: false })` requires a Client
 * Component boundary -- the parent layout is a Server Component, hence this
 * tiny wrapper.
 */
export const SceneLazy = dynamic(() => import('./Scene').then((mod) => mod.Scene), {
  ssr: false,
});
