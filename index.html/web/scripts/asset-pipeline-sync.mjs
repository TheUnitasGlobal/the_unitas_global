#!/usr/bin/env node
// Validates the 3D GLB models and SVG icons under public/assets before they
// ship. This does not re-encode/compress anything (no glTF-Transform /
// SVGO wiring yet -- add those here once real assets land); today it
// catches the failure modes that are cheap to check and expensive to debug
// after deploy: a corrupt/non-glTF .glb, a malformed or script-embedding
// .svg, and outsized files that will hurt first paint.
//
// Web Audio is intentionally NOT scanned here: this app's audio (see
// components/audio/SpatialAudioProvider.tsx) is fully synthesized at
// runtime via oscillator nodes, matching the root static site's
// assets/js/soundscape.js precedent -- there are no binary audio assets to
// validate.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, '..', 'public', 'assets');

const GLB_MAX_BYTES = 20 * 1024 * 1024; // 20MB: generous ceiling for a hero-viewer model
const GLB_MAGIC = 0x46546c67; // ASCII "glTF" read as a little-endian uint32

function walk(dir, extensions) {
  let results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(fullPath, extensions));
    } else if (extensions.includes(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

function checkGlb(filePath) {
  const errors = [];
  const warnings = [];
  const buffer = readFileSync(filePath);
  const size = buffer.length;

  if (size < 12) {
    errors.push('file is smaller than the 12-byte glTF binary header');
  } else {
    const magic = buffer.readUInt32LE(0);
    if (magic !== GLB_MAGIC) {
      errors.push('missing glTF binary magic bytes (not a valid .glb)');
    }
  }

  if (size > GLB_MAX_BYTES) {
    warnings.push(`${(size / 1024 / 1024).toFixed(1)}MB exceeds the ${GLB_MAX_BYTES / 1024 / 1024}MB soft limit -- consider Draco/meshopt compression`);
  }

  return { size, errors, warnings };
}

function checkSvg(filePath) {
  const errors = [];
  const warnings = [];
  const text = readFileSync(filePath, 'utf8');
  const trimmed = text.trim();

  if (!/^(<\?xml[^>]*\?>\s*)?<svg[\s>]/i.test(trimmed)) {
    errors.push('does not start with an <svg> (or leading <?xml?>) root element');
  }
  if (!/<\/svg>\s*$/i.test(trimmed)) {
    errors.push('does not end with a closing </svg> tag');
  }
  if (/<script[\s>]/i.test(text)) {
    errors.push('embeds a <script> tag -- unsafe if this SVG is ever inlined with dangerouslySetInnerHTML');
  }
  if (/xlink:href\s*=\s*["']data:image\//i.test(text) || /href\s*=\s*["']data:image\//i.test(text)) {
    warnings.push('embeds a raster data: URI, which defeats the point of using SVG');
  }

  return { size: Buffer.byteLength(text, 'utf8'), errors, warnings };
}

function main() {
  const glbFiles = walk(path.join(assetsDir, 'models'), ['.glb']);
  const svgFiles = walk(path.join(assetsDir, 'svg'), ['.svg']);

  let errorCount = 0;
  let warningCount = 0;

  console.log(`[assets] Scanning ${glbFiles.length} GLB model(s) and ${svgFiles.length} SVG icon(s) under ${path.relative(process.cwd(), assetsDir)}`);

  for (const filePath of glbFiles) {
    const rel = path.relative(assetsDir, filePath);
    const { size, errors, warnings } = checkGlb(filePath);
    errorCount += errors.length;
    warningCount += warnings.length;
    for (const e of errors) console.error(`  ERROR   ${rel}: ${e}`);
    for (const w of warnings) console.warn(`  WARN    ${rel}: ${w}`);
    if (errors.length === 0 && warnings.length === 0) {
      console.log(`  OK      ${rel} (${(size / 1024).toFixed(1)}KB)`);
    }
  }

  for (const filePath of svgFiles) {
    const rel = path.relative(assetsDir, filePath);
    const { size, errors, warnings } = checkSvg(filePath);
    errorCount += errors.length;
    warningCount += warnings.length;
    for (const e of errors) console.error(`  ERROR   ${rel}: ${e}`);
    for (const w of warnings) console.warn(`  WARN    ${rel}: ${w}`);
    if (errors.length === 0 && warnings.length === 0) {
      console.log(`  OK      ${rel} (${(size / 1024).toFixed(1)}KB)`);
    }
  }

  if (glbFiles.length === 0 && svgFiles.length === 0) {
    console.log('  (no assets yet -- drop .glb files in public/assets/models/ and .svg files in public/assets/svg/)');
  }

  console.log('[assets] Web Audio: synthesized at runtime (SpatialAudioProvider), no binary assets to check.');

  if (errorCount > 0) {
    console.error(`\n[assets] FAILED: ${errorCount} error(s), ${warningCount} warning(s).`);
    process.exitCode = 1;
  } else {
    console.log(`\n[assets] OK (${warningCount} warning(s)).`);
  }
}

main();
