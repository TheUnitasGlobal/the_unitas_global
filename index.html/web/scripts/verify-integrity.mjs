// Reverse-engineering / tamper defense (Item 2b): integrity hash verification
// ONLY -- deliberately no code obfuscation or anti-debugging, to respect the
// TypeScript-only/transparency principle and avoid conflicting with the
// Low-Memory Armor rules (obfuscation toolchains are heavy).
//
// Re-derives the same aggregate SHA-256 over the current public/ contents
// that scripts/ownership-fingerprint.mjs computed at build time, and
// compares it against the committed public/ownership-manifest.json. A
// mismatch (or a missing manifest) means the build artifacts were modified
// after the fact without going through the build pipeline -- exits 1.
//
// Deliberately NOT wired into prebuild/postbuild: this is a manual/CI check
// (`npm run verify:integrity`) run against a *deployed* artifact. Running it
// automatically inside the same build that just regenerated the manifest
// would always trivially pass and prove nothing.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const manifestPath = path.resolve(publicDir, 'ownership-manifest.json');

function walk(dir, base = dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full, base));
    } else if (entry.isFile() && entry.name !== 'ownership-manifest.json') {
      files.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return files;
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

function main() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    console.error(`[verify-integrity] no manifest found at public/ownership-manifest.json -- run "npm run build" first.`);
    process.exit(1);
  }

  const relativeFiles = walk(publicDir).sort();
  const currentHashes = {};
  for (const relFile of relativeFiles) {
    currentHashes[relFile] = sha256File(path.join(publicDir, relFile));
  }

  const aggregateHash = createHash('sha256');
  for (const relFile of relativeFiles) {
    aggregateHash.update(relFile);
    aggregateHash.update(currentHashes[relFile]);
  }
  const currentFingerprint = aggregateHash.digest('hex');

  const manifestFiles = manifest.files ?? {};
  const currentSet = new Set(relativeFiles);
  const manifestSet = new Set(Object.keys(manifestFiles));

  const added = relativeFiles.filter((f) => !manifestSet.has(f));
  const removed = [...manifestSet].filter((f) => !currentSet.has(f));
  const changed = relativeFiles.filter(
    (f) => manifestSet.has(f) && manifestFiles[f] !== currentHashes[f],
  );

  if (currentFingerprint === manifest.buildFingerprint && added.length === 0 && removed.length === 0 && changed.length === 0) {
    console.log(`[verify-integrity] OK -- public/ matches the committed manifest (owner: ${manifest.owner}, fingerprint ${currentFingerprint.slice(0, 16)}...).`);
    return;
  }

  console.error('[verify-integrity] MISMATCH -- public/ contents do not match public/ownership-manifest.json.');
  console.error(`  expected fingerprint: ${manifest.buildFingerprint}`);
  console.error(`  actual fingerprint:   ${currentFingerprint}`);
  if (added.length > 0) console.error(`  files added since manifest: ${added.join(', ')}`);
  if (removed.length > 0) console.error(`  files removed since manifest: ${removed.join(', ')}`);
  if (changed.length > 0) console.error(`  files changed since manifest: ${changed.join(', ')}`);
  process.exit(1);
}

main();
