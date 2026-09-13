import type { MetadataRoute } from 'next';
import { PUBLIC_ROUTES, sitemapEntries } from '@/lib/seo/routes';
import { routing } from '@/i18n/routing';

/**
 * REV-22 M_SEO -- `/sitemap.xml`, the Codex v23.0 ch.12 gap REV-21's final
 * report logged as still open (both `/sitemap.xml` and `/robots.txt` returned
 * a live 404 with zero source instances).
 *
 * Emits `PUBLIC_ROUTES.length x routing.locales.length` URLs, each carrying
 * the complete `<xhtml:link rel="alternate" hreflang>` cluster for all 20
 * locales plus `x-default`. Next 14's sitemap resolver only emits the
 * `xmlns:xhtml` namespace when at least one entry declares `alternates`
 * (node_modules/next/dist/build/webpack/loaders/metadata/resolve-route-data.js),
 * which every entry here does.
 *
 * Statically generated: this module touches no request-scoped API, so Next
 * renders `/sitemap.xml` once at build time. `BUILD_TIME` is therefore the
 * deploy timestamp -- a truthful `<lastmod>` for a fully prerendered site,
 * and the same value for every URL in one deploy.
 *
 * The route is invisible to middleware.ts: its matcher excludes any path
 * containing a dot (`.*\..*`), so `/sitemap.xml` never enters locale
 * rewriting, sovereign fencing or the Supabase session refresh.
 */
const BUILD_TIME = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(BUILD_TIME);
}

// Fail-closed size guard. Google's per-file ceiling is 50,000 URLs / 50 MB;
// 20 locales x 17 routes is 340 today. If a future revision multiplies routes
// past the ceiling the build must break here rather than silently ship a
// sitemap search engines truncate.
const URL_COUNT = PUBLIC_ROUTES.length * routing.locales.length;
if (URL_COUNT > 50_000) {
  throw new Error(
    `sitemap.xml would contain ${URL_COUNT} URLs, over Google's 50,000 per-file limit -- split it into a sitemap index.`,
  );
}
