import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX } from '@/lib/seo/pageMetadata';

/**
 * REV-22 M_SEO -- metadata-only layout for the founder console.
 *
 * middleware.ts already answers `/[locale]/sovereign*` with a bodiless 404 for
 * anyone without the HMAC-signed founder cookie (lib/sovereignAuth.ts
 * `isSovereignProtectedPath`), and robots.txt disallows the prefix, so a
 * crawler should never reach these pages at all. This is the third layer: on
 * the one path where the pages DO render -- an authenticated founder session,
 * whose URL could be shared or pasted -- they still carry `noindex, nofollow`.
 *
 * Renders `{children}` untouched: no wrapper element, no styling, nothing that
 * could shift the console's layout.
 */
export const metadata: Metadata = { robots: NOINDEX };

export default function SovereignLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
