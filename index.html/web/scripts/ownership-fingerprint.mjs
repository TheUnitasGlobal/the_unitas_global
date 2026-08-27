// Cryptographic ownership metadata + fingerprint injection (Item 1).
//
// Deliberately NOT a visible watermark -- those degrade the product's
// aesthetics and are trivially croppable/bypassable. Instead this walks
// public/ after every build, hashes each file (SHA-256), and aggregates
// those into a single build fingerprint written to
// public/ownership-manifest.json alongside THE UNITAS GLOBAL OU's corporate
// ownership/license metadata, the source git commit, and a timestamp.
//
// scripts/verify-integrity.mjs re-derives the same aggregate hash later and
// compares it against this manifest to detect tampering (Item 2b).
//
// Wired as `postbuild`, so it runs after every `next build`.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const manifestPath = path.resolve(publicDir, 'ownership-manifest.json');

const OWNER = 'THE UNITAS GLOBAL OU';
const LICENSE = 'Proprietary -- All Rights Reserved. See /legal#license.';

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

function getGitCommit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.resolve(__dirname, '..', '..') })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

function main() {
  const relativeFiles = walk(publicDir).sort();

  if (relativeFiles.length === 0) {
    console.warn('[ownership-fingerprint] public/ has no files to fingerprint -- skipping manifest write.');
    return;
  }

  const fileHashes = {};
  for (const relFile of relativeFiles) {
    fileHashes[relFile] = sha256File(path.join(publicDir, relFile));
  }

  const aggregateHash = createHash('sha256');
  for (const relFile of relativeFiles) {
    aggregateHash.update(relFile);
    aggregateHash.update(fileHashes[relFile]);
  }

  const manifest = {
    owner: OWNER,
    copyright: `© ${new Date().getUTCFullYear()} ${OWNER}`,
    license: LICENSE,
    generatedAt: new Date().toISOString(),
    gitCommit: getGitCommit(),
    algorithm: 'sha256',
    fileCount: relativeFiles.length,
    buildFingerprint: aggregateHash.digest('hex'),
    files: fileHashes,
  };

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(
    `[ownership-fingerprint] wrote public/ownership-manifest.json -- ${relativeFiles.length} file(s), fingerprint ${manifest.buildFingerprint.slice(0, 16)}...`,
  );
}

main();
