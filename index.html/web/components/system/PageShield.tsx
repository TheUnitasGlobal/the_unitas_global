'use client';

import type { ReactNode } from 'react';
import { SovereignShield } from './SovereignShield';
import { ModuleFallback } from './ModuleFallback';

/**
 * Client wrapper so a Server Component layout can shield its page slot with
 * the function-form fallback (functions cannot cross the RSC boundary as
 * props). Zone "page": the route's rendered content beneath the nav. A fault
 * there now settles on the quiet ModuleFallback (mark + retry) inside the
 * page area -- nav, curtain, audio and exit guard stay live around it -- and
 * self-heals first.
 */
export function PageShield({ children, zone = 'page' }: { children: ReactNode; zone?: string }) {
  return (
    <SovereignShield zone={zone} fallback={(retry) => <ModuleFallback retry={retry} />}>
      {children}
    </SovereignShield>
  );
}

/** Compact variant for a single widget / section inside a page. */
export function SectionShield({ children, zone }: { children: ReactNode; zone: string }) {
  return (
    <SovereignShield zone={zone} fallback={(retry) => <ModuleFallback retry={retry} compact />}>
      {children}
    </SovereignShield>
  );
}
