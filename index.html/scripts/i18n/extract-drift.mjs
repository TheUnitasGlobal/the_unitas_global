#!/usr/bin/env node
// REV-18 PHASE 2 step 1: read-only drift extraction.
// Flattens the `QuantumWhite` namespace of en.json + every non-en/ko locale,
// finds keys whose locale value is byte-identical to en (== still-untranslated
// REV-17 fallback), and writes docs/rev18/drift/<locale>.json.
// Also writes docs/rev18/drift/_reference.json: en + ko text for every key
// that appears in ANY locale's drift set, for translator context.
// Never touches web/messages/*.json.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const messagesDir = path.join(repoRoot, 'web', 'messages');
const outDir = path.join(repoRoot, 'docs', 'rev18', 'drift');

const LOCALES = ['de', 'es', 'et', 'fr', 'hi', 'id', 'it', 'ja', 'km', 'nl', 'pl', 'pt', 'ru', 'th', 'tl', 'tr', 'vi', 'zh'];

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function flatten(obj, prefix, out) {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out[path] = value;
    }
  }
  return out;
}

const en = readJson(path.join(messagesDir, 'en.json'));
const ko = readJson(path.join(messagesDir, 'ko.json'));
const enFlat = flatten(en.QuantumWhite || {}, '', {});
const koFlat = flatten(ko.QuantumWhite || {}, '', {});

mkdirSync(outDir, { recursive: true });

const reference = {};
const summary = {};

for (const locale of LOCALES) {
  const localeJson = readJson(path.join(messagesDir, `${locale}.json`));
  const localeFlat = flatten(localeJson.QuantumWhite || {}, '', {});
  const drift = {};
  for (const key of Object.keys(enFlat)) {
    const enValue = enFlat[key];
    const localeValue = localeFlat[key];
    if (typeof enValue !== 'string') continue; // only string leaves are translatable
    if (localeValue === enValue) {
      drift[key] = enValue;
      reference[key] = { en: enValue, ko: koFlat[key] ?? null };
    }
  }
  const driftKeys = Object.keys(drift);
  writeFileSync(path.join(outDir, `${locale}.json`), JSON.stringify(drift, null, 2) + '\n');
  summary[locale] = driftKeys.length;
}

writeFileSync(path.join(outDir, '_reference.json'), JSON.stringify(reference, null, 2) + '\n');
writeFileSync(path.join(outDir, '_summary.json'), JSON.stringify({ totalKeys: Object.keys(enFlat).length, driftByLocale: summary }, null, 2) + '\n');

console.log('QuantumWhite total keys:', Object.keys(enFlat).length);
console.log('Drift by locale:', summary);
