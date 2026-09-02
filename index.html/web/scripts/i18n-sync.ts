// Checks every messages/<locale>.json (en, ko, et, ja, zh, es, km, fr, de, pt,
// vi, id, ru, hi, it, tr, th, pl, nl, tl) for missing translation keys against
// the `en` baseline and fills gaps with a "[MISSING:en] <source text>"
// placeholder so nothing silently falls back to raw keys at runtime.
//
// Run with: node --experimental-strip-types scripts/i18n-sync.ts
// (Node 22.6+/24 can execute .ts directly -- no ts-node/tsx dependency
// needed for a script this small.)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.resolve(__dirname, '..', 'messages');

const locales = [
  'en', 'ko', 'et', 'ja', 'zh', 'es', 'km', 'fr', 'de', 'pt', 'vi', 'id',
  'ru', 'hi', 'it', 'tr', 'th', 'pl', 'nl', 'tl',
] as const;
const baseLocale: (typeof locales)[number] = 'en';

type Messages = { [key: string]: string | Messages };

function loadMessages(locale: string): Messages {
  const filePath = path.join(messagesDir, `${locale}.json`);
  return JSON.parse(readFileSync(filePath, 'utf8')) as Messages;
}

function flatten(obj: Messages, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else {
      Object.assign(result, flatten(value, fullKey));
    }
  }
  return result;
}

function setDeep(obj: Messages, keyPath: string, value: string) {
  const parts = keyPath.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof node[part] !== 'object' || node[part] === null) {
      node[part] = {};
    }
    node = node[part] as Messages;
  }
  node[parts[parts.length - 1]] = value;
}

function main() {
  const base = loadMessages(baseLocale);
  const baseFlat = flatten(base);
  let hadMissing = false;

  for (const locale of locales) {
    if (locale === baseLocale) continue;

    const target = loadMessages(locale);
    const targetFlat = flatten(target);
    const missingKeys = Object.keys(baseFlat).filter((key) => !(key in targetFlat));

    if (missingKeys.length === 0) {
      console.log(`[i18n-sync] ${locale}: OK (${Object.keys(baseFlat).length} keys)`);
      continue;
    }

    hadMissing = true;
    console.warn(
      `[i18n-sync] ${locale}: missing ${missingKeys.length} key(s), filling with [MISSING:${baseLocale}] placeholders`,
    );
    for (const key of missingKeys) {
      setDeep(target, key, `[MISSING:${baseLocale}] ${baseFlat[key]}`);
      console.warn(`  + ${key}`);
    }

    const filePath = path.join(messagesDir, `${locale}.json`);
    writeFileSync(filePath, `${JSON.stringify(target, null, 2)}\n`, 'utf8');
    console.log(`[i18n-sync] ${locale}: wrote placeholders to ${filePath}`);
  }

  if (hadMissing) {
    console.warn(
      '\n[i18n-sync] Some locales had missing keys -- review the [MISSING:en] placeholders above and translate them.',
    );
    process.exitCode = 1;
  } else {
    console.log('\n[i18n-sync] All locales are in sync.');
  }
}

main();
