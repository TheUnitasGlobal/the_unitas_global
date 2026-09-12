#!/usr/bin/env node
// REV-21 PHASE 2: merge the `Rev21` namespace (docs/rev21/i18n/<locale>.json,
// flat dot-path keys whose VALUES may be strings OR arrays of strings) into
// web/messages/<locale>.json for all 20 locales.
//
// Gates (per locale): key set must equal en's exactly; for every key the
// STRUCTURE SIGNATURE must match en's -- a string stays a string with the
// same ICU `{token}` set, an array keeps the same length with per-element
// ICU sets. A locale without a draft (or with a failing draft) falls back to
// the English values so the build never ships a missing key -- the fallback
// is reported loudly (`FALLBACK(en)`) and __tests__/i18n/rev21Parity.test.ts
// + rev21TranslationDrift.test.ts catch what slipped through.
//
// Usage: node scripts/i18n/apply-rev21.mjs          (write)
//        node scripts/i18n/apply-rev21.mjs --check  (verify only, exit 1 on drift)
//
// Optional: `--namespace SitePages --drafts docs/rev21/i18n/sitepages` merges
// another namespace from another draft folder with the same gates (REV-21 §6.2).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const messagesDir = path.join(repoRoot, 'web', 'messages');
const LOCALES = ['en', 'ko', 'et', 'ja', 'zh', 'es', 'km', 'fr', 'de', 'pt', 'vi', 'id', 'ru', 'hi', 'it', 'tr', 'th', 'pl', 'nl', 'tl'];

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const argValue = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const NAMESPACE = argValue('--namespace', 'Rev21');
const draftsDir = path.resolve(repoRoot, argValue('--drafts', 'docs/rev21/i18n'));

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
const icu = (s) => (String(s).match(/\{[^}]*\}/g) ?? []).slice().sort().join('|');

/** Structure signature of one value: 's:<icu>' for a string, 'a:<n>:<icu|icu…>' for an array. */
function signature(value) {
  if (Array.isArray(value)) return `a:${value.length}:${value.map((v) => icu(v)).join(',')}`;
  return `s:${icu(value)}`;
}

function setDeep(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object' || Array.isArray(cur[parts[i]])) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const en = readJson(path.join(draftsDir, 'en.json'));
const enKeys = Object.keys(en);
let failures = 0;
const report = [];

for (const locale of LOCALES) {
  const draftPath = path.join(draftsDir, `${locale}.json`);
  let draft = null;
  let note = 'ok';
  if (!existsSync(draftPath)) {
    note = 'FALLBACK(en): no draft';
  } else {
    try {
      draft = readJson(draftPath);
      const keys = Object.keys(draft);
      const missing = enKeys.filter((k) => !(k in draft));
      const extra = keys.filter((k) => !(k in en));
      const shapeBad = enKeys.filter((k) => k in draft && signature(draft[k]) !== signature(en[k]));
      const empty = enKeys.filter((k) => k in draft && (Array.isArray(draft[k]) ? draft[k].some((v) => !String(v).trim()) : !String(draft[k]).trim()));
      if (missing.length || extra.length || shapeBad.length || empty.length) {
        note = `FALLBACK(en): missing=${missing.length} extra=${extra.length} shape=${shapeBad.length} empty=${empty.length} [${[...missing, ...extra, ...shapeBad, ...empty].slice(0, 5).join(', ')}]`;
        draft = null;
      }
    } catch (err) {
      note = `FALLBACK(en): unreadable (${err.message})`;
      draft = null;
    }
  }
  const source = draft ?? en;
  const ns = {};
  for (const key of enKeys) setDeep(ns, key, source[key]);

  const messagesPath = path.join(messagesDir, `${locale}.json`);
  const messages = readJson(messagesPath);
  const before = JSON.stringify(messages[NAMESPACE] ?? null);
  const after = JSON.stringify(ns);
  const changed = before !== after;
  if (changed) {
    if (checkOnly) failures++;
    else {
      messages[NAMESPACE] = ns;
      writeFileSync(messagesPath, `${JSON.stringify(messages, null, 2)}\n`);
    }
  }
  report.push(`${locale.padEnd(3)} ${changed ? (checkOnly ? 'DRIFT' : 'written') : 'unchanged'}  ${note}`);
}

console.log(report.join('\n'));
if (checkOnly && failures > 0) {
  console.error(`apply-rev21: ${failures} locale(s) drifted from ${path.relative(repoRoot, draftsDir)} (${NAMESPACE}) -- run without --check to write.`);
  process.exit(1);
}
