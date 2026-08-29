import { routing } from '@/i18n/routing';
import { moduleForRoute, type ModuleRegistryEntry } from '@/lib/module-registry';

const LOCALES = new Set<string>(routing.locales);

/**
 * Resolve a request pathname to its module registry entry, or null if the
 * path is not a module route. Locale-segment aware and route-group
 * transparent (route groups like `(gated)` never appear in the URL, so the
 * module segment is always the one right after the locale).
 *
 * Examples:
 *   "/ko/arche"        -> arche entry
 *   "/arche"           -> arche entry   (defaultLocale, un-prefixed)
 *   "/ja/echo/results" -> echo entry
 *   "/ko/company"      -> null          (infra route, not a module)
 *   "/ko"              -> null
 */
export function moduleForPathname(pathname: string): ModuleRegistryEntry | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const first = segments[0];
  const moduleSegment = LOCALES.has(first) ? segments[1] : first;
  if (!moduleSegment) return null;

  return moduleForRoute(moduleSegment);
}
