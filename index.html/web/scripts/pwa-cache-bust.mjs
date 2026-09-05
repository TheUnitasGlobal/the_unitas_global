// PWA icon cache-busting (owner instruction 2026-09-04, item 1).
//
// Windows/macOS browsers and the OS shell cache an installed PWA's icon
// aggressively -- once a v1 icon was fetched, a byte-for-byte replacement at
// the SAME URL is never re-downloaded, so the desktop/taskbar/app-list keeps
// showing the stale mark. The only reliable trigger for a re-fetch is a
// CHANGED icon URL in the manifest (Chromium re-downloads icons whenever the
// manifest's icon `src` differs from the installed copy).
//
// This script runs as part of `prebuild` (so on every `next build`, and
// therefore every Stop-hook checkpoint), and:
//   1. SHA-256 hashes every raster icon under public/icons/;
//   2. rewrites public/manifest.json so every icon `src` carries
//      `?v=<PWA_ICON_VERSION>.<10-hex digest>` -- the digest half means a
//      future artwork change busts the cache automatically, without anyone
//      remembering to bump the version label by hand;
//   3. writes lib/pwa/icon-digest.generated.json, which app/layout.tsx and
//      lib/pwa/iconVersion.ts read so the <link rel="manifest"> href and every
//      <link rel="icon"> / apple-touch-icon href carry the same query.
//
// Deterministic: identical icon bytes -> identical query -> identical manifest,
// so a rebuild with unchanged artwork produces no git diff.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const iconsDir = path.join(webRoot, 'public', 'icons');
const manifestPath = path.join(webRoot, 'public', 'manifest.json');
const generatedDir = path.join(webRoot, 'lib', 'pwa');
const generatedPath = path.join(generatedDir, 'icon-digest.generated.json');

// Human-readable half of the version query. Bump when the master artwork
// changes identity (v1 sovereign -> v2 "FINAL SYMMETRY" centered dot-hexagon);
// the digest half tracks the actual bytes on top of this label.
export const PWA_ICON_VERSION = 'v2-final-symmetry';
const DIGEST_LENGTH = 10;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function stripQuery(src) {
  const q = src.indexOf('?');
  return q === -1 ? src : src.slice(0, q);
}

function main() {
  if (!existsSync(iconsDir)) {
    console.warn('[pwa-cache-bust] public/icons missing -- nothing to version.');
    return;
  }

  const files = readdirSync(iconsDir)
    .filter((name) => /\.(png|ico|svg|webp)$/i.test(name))
    .sort();

  /** @type {Record<string, string>} */
  const digests = {};
  for (const name of files) {
    digests[name] = sha256(readFileSync(path.join(iconsDir, name))).slice(0, DIGEST_LENGTH);
  }

  // Aggregate digest for the manifest link itself (any icon change also
  // changes the manifest bytes, so the manifest URL must move with it).
  const aggregate = sha256(
    files.map((name) => `${name}:${digests[name]}`).join('\n'),
  ).slice(0, DIGEST_LENGTH);

  const versionFor = (src) => {
    const clean = stripQuery(src);
    const name = path.posix.basename(clean);
    const digest = digests[name];
    return digest ? `${clean}?v=${PWA_ICON_VERSION}.${digest}` : clean;
  };

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (Array.isArray(manifest.icons)) {
    for (const icon of manifest.icons) icon.src = versionFor(icon.src);
  }
  if (Array.isArray(manifest.shortcuts)) {
    for (const shortcut of manifest.shortcuts) {
      if (!Array.isArray(shortcut.icons)) continue;
      for (const icon of shortcut.icons) icon.src = versionFor(icon.src);
    }
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  mkdirSync(generatedDir, { recursive: true });
  const generated = {
    version: PWA_ICON_VERSION,
    manifestQuery: `${PWA_ICON_VERSION}.${aggregate}`,
    icons: digests,
  };
  const next = `${JSON.stringify(generated, null, 2)}\n`;
  const prev = existsSync(generatedPath) ? readFileSync(generatedPath, 'utf8') : null;
  if (prev !== next) writeFileSync(generatedPath, next, 'utf8');

  console.log(
    `[pwa-cache-bust] ${files.length} icon(s) versioned as ${PWA_ICON_VERSION}.* -- manifest query ${generated.manifestQuery}`,
  );
}

main();
