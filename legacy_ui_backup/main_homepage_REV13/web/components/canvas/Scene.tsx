'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { NeuralShader } from './NeuralShader';

interface SceneProps {
  /** Extra R3F children rendered in front of the neural background (e.g. a hero viewer mesh). */
  children?: ReactNode;
  className?: string;
}

/**
 * Responsive R3F Canvas wrapper used as the site's fixed background layer.
 * React Three Fiber's reconciler explicitly does not support SSR hydration
 * (WebGL requires a real browser canvas), so this renders nothing until
 * mounted client-side to avoid a server/client markup mismatch -- the
 * standard guard for R3F inside Next.js App Router Server Components.
 */
export function Scene({ children, className }: SceneProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className={className ?? 'fixed inset-0 -z-10'} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#030305']} />
        <Suspense fallback={null}>
          <NeuralShader />
          {children}
        </Suspense>
      </Canvas>
    </div>
  );
}
