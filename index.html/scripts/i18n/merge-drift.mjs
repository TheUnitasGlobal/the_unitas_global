#!/usr/bin/env node
// REV-18 PHASE 2 step 3: merge translated drafts into web/messages/<locale>.json.
// Reads docs/rev18/drafts/<locale>.json (agent-translated, flat QuantumWhite
// key -> string) and docs/rev18/drift/<locale>.json (the exact set of keys
// that were still English fallback text), verifies each draft entry, then
// deep-merges only the verified keys into the locale's QuantumWhite subtree.
// Never touches any other namespace. Writes docs/rev18/merge-report.md.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const messagesDir = path.join(repoRoot, 'web', 'messages');
const draftsDir = path.join(repoRoot, 'docs', 'rev18', 'drafts');
const driftDir = path.join(repoRoot, 'docs', 'rev18', 'drift');

const LOCALES = ['de', 'es', 'et', 'fr', 'hi', 'id', 'it', 'ja', 'km', 'nl', 'pl', 'pt', 'ru', 'th', 'tl', 'tr', 'vi', 'zh'];

// Brand/proper nouns allowed to remain byte-identical to the English source.
const ALLOWLIST_IDENTICAL = new Set([
  'coinUnit', // "U-COIN"
  'watermark', // "THE UNITAS GLOBAL OÜ"
]);

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function flatten(obj, prefix, out) {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const p = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, p, out);
    } else {
      out[p] = value;
    }
  }
  return out;
}

function setDeep(obj, dottedKey, value) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!cur[part] || typeof cur[part] !== 'object') cur[part] = {};
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

function icuTokens(str) {
  const matches = String(str).match(/\{[^}]*\}/g);
  return matches ? matches.slice().sort() : [];
}

const en = readJson(path.join(messagesDir, 'en.json'));
const enFlat = flatten(en.QuantumWhite || {}, '', {});

const report = [];
report.push('# REV-18 i18n merge report');
report.push('');
report.push(`Generated: ${new Date().toISOString()}`);
report.push('');

let totalMerged = 0;
let totalSkippedLocales = 0;

for (const locale of LOCALES) {
  const draftPath = path.join(draftsDir, `${locale}.json`);
  const driftPath = path.join(driftDir, `${locale}.json`);
  report.push(`## ${locale}`);

  if (!existsSync(draftPath)) {
    report.push('- FAIL: no draft file found, locale skipped entirely.');
    report.push('');
    totalSkippedLocales++;
    continue;
  }
  if (!existsSync(driftPath)) {
    report.push('- FAIL: no drift file found (run extract-drift.mjs first), locale skipped entirely.');
    report.push('');
    totalSkippedLocales++;
    continue;
  }

  const draft = readJson(draftPath);
  const drift = readJson(driftPath);
  const driftKeys = Object.keys(drift);

  const localeMessagesPath = path.join(messagesDir, `${locale}.json`);
  const localeJson = readJson(localeMessagesPath);

  const warnings = [];
  const failures = [];
  let mergedCount = 0;

  for (const key of driftKeys) {
    const enValue = enFlat[key];
    const draftValue = draft[key];

    if (typeof draftValue !== 'string') {
      failures.push(`- [${key}] SKIPPED: missing or non-string in draft`);
      continue;
    }

    // ICU token preservation
    const enTokens = icuTokens(enValue);
    const draftTokens = icuTokens(draftValue);
    if (JSON.stringify(enTokens) !== JSON.stringify(draftTokens)) {
      failures.push(`- [${key}] SKIPPED: ICU token mismatch (en=${JSON.stringify(enTokens)}, draft=${JSON.stringify(draftTokens)})`);
      continue;
    }

    // Untranslated-residual detection (allow the brand-noun allowlist)
    if (draftValue === enValue && !ALLOWLIST_IDENTICAL.has(key)) {
      warnings.push(`- [${key}] WARNING: draft value identical to English (possibly untranslated)`);
    }

    // Length outlier (skip CJK/short-form locales from the multiplier check by using char count directly;
    // this is a soft warning only, never a merge failure)
    if (enValue.length > 0) {
      const ratio = draftValue.length / enValue.length;
      if (ratio > 3) {
        warnings.push(`- [${key}] WARNING: length ratio ${ratio.toFixed(2)}x over English (en=${enValue.length} chars, draft=${draftValue.length} chars)`);
      }
    }

    setDeep(localeJson.QuantumWhite, key, draftValue);
    mergedCount++;
  }

  writeFileSync(localeMessagesPath, JSON.stringify(localeJson, null, 2) + '\n');

  report.push(`- Drift keys: ${driftKeys.length}`);
  report.push(`- Merged: ${mergedCount}`);
  report.push(`- Failures (not merged): ${failures.length}`);
  report.push(`- Warnings (merged anyway): ${warnings.length}`);
  if (failures.length) report.push(...failures);
  if (warnings.length) report.push(...warnings);
  report.push('');

  totalMerged += mergedCount;
}

report.unshift(`Total keys merged across all locales: ${totalMerged}`);
report.unshift(`Locales fully skipped: ${totalSkippedLocales}`);

writeFileSync(path.join(repoRoot, 'docs', 'rev18', 'merge-report.md'), report.join('\n') + '\n');

console.log('Total keys merged:', totalMerged);
console.log('Locales skipped:', totalSkippedLocales);
console.log('Report written to docs/rev18/merge-report.md');
