#!/usr/bin/env node
// REV-20 PHASE 2: merge the `Rev20` namespace (docs/rev20/i18n/<locale>.json,
// flat dot-path keys) into web/messages/<locale>.json for all 20 locales.
// Exact clone of apply-rev19.mjs's write/check contract -- see that file's
// header for the full rationale (drift fallback, ICU gating).
//
// Usage: node scripts/i18n/apply-rev20.mjs          (write)
//        node scripts/i18n/apply-rev20.mjs --check  (verify only, exit 1 on drift)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const messagesDir = path.join(repoRoot, 'web', 'messages');
const draftsDir = path.join(repoRoot, 'docs', 'rev20', 'i18n');
const NAMESPACE = 'Rev20';
const LOCALES = ['en', 'ko', 'et', 'ja', 'zh', 'es', 'km', 'fr', 'de', 'pt', 'vi', 'id', 'ru', 'hi', 'it', 'tr', 'th', 'pl', 'nl', 'tl'];
const checkOnly = process.argv.includes('--check');

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const icu = (s) => (String(s).match(/\{[^}]*\}/g) ?? []).slice().sort().join('|');

function setDeep(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
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
      const icuBad = enKeys.filter((k) => k in draft && icu(draft[k]) !== icu(en[k]));
      if (missing.length || extra.length || icuBad.length) {
        note = `FALLBACK(en): missing=${missing.length} extra=${extra.length} icu=${icuBad.length} [${[...missing, ...extra, ...icuBad].slice(0, 5).join(', ')}]`;
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
  console.error(`apply-rev20: ${failures} locale(s) drifted from docs/rev20/i18n -- run without --check to write.`);
  process.exit(1);
}
