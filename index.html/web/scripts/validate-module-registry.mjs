// Fail-closed guard for lib/module-registry.ts: every module registered
// there must have a matching app/[locale]/<route> page, and every module
// route folder must be registered. Prevents the catalog and the actual
// routed app from silently drifting apart as new modules are added.
//
// Plain regex extraction over the .ts SOURCE CATALOGS (ecosystems.ts,
// modules.ts) -- keeps this a dependency-free Node script, consistent with
// the other scripts/*.mjs tooling here, rather than requiring TS module
// resolution. lib/module-registry.ts itself is NOT scanned: it builds its
// entries programmatically (`route: m.route`, spread from these two
// catalogs' `.map()`), so it never contains a literal `route: '...'` string
// for a regex to find -- scanning it directly always matched 0 entries.
//
// Wired as `prebuild`, so it runs before every `next build` (and therefore
// before every Stop-hook checkpoint commit).

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPaths = [
  path.resolve(__dirname, '..', 'lib', 'ecosystems.ts'),
  path.resolve(__dirname, '..', 'lib', 'modules.ts'),
];
const localeAppDir = path.resolve(__dirname, '..', 'app', '[locale]');

// Non-module infrastructure routes (legal/compliance pages, etc.) that
// intentionally have no MODULE_REGISTRY entry -- every product module is
// coin-gated-or-B2B (see module-registry.ts), and a page like /legal isn't
// a product, so forcing a fake registry entry for it would misrepresent the
// catalog. Extend this list for future non-product routes instead of adding
// synthetic MODULE_REGISTRY entries.
const INFRA_ROUTES = new Set(['legal', 'company', 'support']);

function extractRoutes(source) {
  const routes = [];
  const entryBlockRe = /\{\s*key:\s*[^,]+,\s*route:\s*'([^']+)'/g;
  let match;
  while ((match = entryBlockRe.exec(source)) !== null) {
    routes.push(match[1]);
  }
  return routes;
}

function main() {
  const registryRoutes = catalogPaths.flatMap((catalogPath) =>
    extractRoutes(readFileSync(catalogPath, 'utf8')),
  );

  if (registryRoutes.length === 0) {
    console.error('[validate-module-registry] found 0 route entries across lib/ecosystems.ts + lib/modules.ts -- regex extraction is broken or the catalogs are empty.');
    process.exit(1);
  }

  const actualFolders = readdirSync(localeAppDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const registrySet = new Set(registryRoutes);
  const folderSet = new Set(actualFolders);

  const missingFolders = registryRoutes.filter((route) => !folderSet.has(route));
  const unregisteredFolders = actualFolders.filter(
    (folder) => !registrySet.has(folder) && !INFRA_ROUTES.has(folder),
  );

  if (missingFolders.length === 0 && unregisteredFolders.length === 0) {
    console.log(`[validate-module-registry] OK -- ${registryRoutes.length} registered module(s) all match app/[locale]/* route folders.`);
    return;
  }

  if (missingFolders.length > 0) {
    console.error(
      `[validate-module-registry] ${missingFolders.length} module(s) registered in lib/module-registry.ts have no matching app/[locale]/<route> folder:`,
    );
    for (const route of missingFolders) console.error(`  - ${route}`);
  }

  if (unregisteredFolders.length > 0) {
    console.error(
      `[validate-module-registry] ${unregisteredFolders.length} app/[locale]/* folder(s) are not registered in lib/module-registry.ts:`,
    );
    for (const folder of unregisteredFolders) console.error(`  - ${folder}`);
  }

  process.exit(1);
}

main();
