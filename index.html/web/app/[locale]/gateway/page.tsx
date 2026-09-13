import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

/**
 * REV-23 M1 -- the sealed funnel route.
 *
 * Every request the edge gate seals (lib/gate/funnelGate.ts) is REWRITTEN
 * here, so this page's response is the only HTML an ungated visitor can
 * ever receive. Its body is deliberately EMPTY: the pre-launch curtain
 * (<ComingSoonCinema/>, mounted once in app/[locale]/layout.tsx) paints the
 * whole funnel -- logo splash -> entry gate -> ad segments 1-5 -> the sealed
 * "COMING SOON" screen -- on top of nothing at all. There is no main-site
 * markup underneath to reveal, in any client, by any means.
 *
 * Statically generated for all 20 locales (no `headers()`, no dynamic
 * rendering), so sealing costs nothing per request. `noindex` because the
 * gateway is never itself a destination: crawlers are passed through to the
 * real pages by the gate, and the only way to see this route is to be a
 * human who has not crossed the funnel.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function GatewayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The curtain in the layout is the entire surface. Nothing renders here.
  return <div data-unitas-gateway="" aria-hidden="true" />;
}
