import type { MetadataRoute } from 'next';
import {
  NAMED_CRAWLERS,
  SITEMAP_URL,
  SITE_HOST,
  robotsDisallow,
} from '@/lib/seo/routes';

/**
 * REV-22 M_SEO -- `/robots.txt`, the other half of the Codex v23.0 ch.12 gap.
 *
 * One shared allow/disallow payload, emitted once for `*` and once per named
 * crawler. The repetition is deliberate and load-bearing: a robots.txt agent
 * block REPLACES the `*` block for that agent rather than layering on top of
 * it, so naming Googlebot / Bingbot / Yeti (Naver) / Daumoa (Daum) without
 * restating the disallows would hand exactly those four engines the coin-gated
 * and sovereign paths the `*` block fences off.
 *
 * `Allow: /` is stated explicitly ahead of the disallows so the intent reads
 * unambiguously to a human auditing the file, even though an absent Allow
 * would mean the same thing.
 *
 * Like the sitemap, this route is invisible to middleware.ts (its matcher
 * excludes dotted paths), so it is served as a plain static text file.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = robotsDisallow();
  const payload = { allow: ['/'], disallow };

  return {
    rules: [
      { userAgent: '*', ...payload },
      ...NAMED_CRAWLERS.map((userAgent) => ({ userAgent, ...payload })),
    ],
    sitemap: SITEMAP_URL,
    host: SITE_HOST,
  };
}
