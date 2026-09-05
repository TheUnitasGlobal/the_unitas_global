// PWA icon version query -- the single place app code reads the cache-busting
// query that scripts/pwa-cache-bust.mjs (prebuild) stamps onto every icon URL.
//
// `icon-digest.generated.json` is regenerated on every build from the actual
// bytes under public/icons/, so the hrefs below change whenever the artwork
// does and OS/browser icon caches are forced to re-download the v2 mark.
import digest from './icon-digest.generated.json';

interface IconDigest {
  version: string;
  manifestQuery: string;
  icons: Record<string, string>;
}

const generated = digest as IconDigest;

/** Human-readable half of the query (mirrors scripts/pwa-cache-bust.mjs). */
export const PWA_ICON_VERSION = generated.version;

/** `/manifest.json?v=...` -- moves whenever any icon changes. */
export const PWA_MANIFEST_HREF = `/manifest.json?v=${generated.manifestQuery}`;

/** Versioned href for a file under public/icons/ (e.g. `icon-192.png`). */
export function pwaIconHref(fileName: string): string {
  const d = generated.icons[fileName];
  return d ? `/icons/${fileName}?v=${PWA_ICON_VERSION}.${d}` : `/icons/${fileName}`;
}
