/**
 * REV-42 i18n applicator (SPEC §2 D-8, §4, §4-A, lane G) -- the three
 * flagship shortcuts: 시공간·기상 (sky almanac + air fusion), 거시 우주
 * (cosmos) and 글로벌 미식 (gastronomy), plus the tier-3 detail shell.
 *
 * Unlike apply-rev41 (whose strings were inlined as positional L() rows),
 * the REV-42 copy is far too large for one file: lane H writes ONE DRAFT PER
 * LOCALE at docs/rev42/i18n/<locale>.json, each shaped exactly
 *
 *   { "Rev20": { "slots": { "cosmos": {title,tag}, "gastronomy": {title,tag} } },
 *     "Rev42": { sky, air, detail, cosmos, gastronomy } }
 *
 * and this applicator is the ONLY writer of messages/<locale>.json (D-12:
 * never edit the message files by hand). Idempotent, all 20 locales at
 * once, two operations, both fail-closed BEFORE any file is touched:
 *
 *  GATE   every one of the 20 drafts exists and parses; the flattened key
 *         set of every draft is IDENTICAL to en's; the ICU argument set of
 *         every key equals en's; no empty string; no `[MISSING` placeholder;
 *         no array (the namespace is objects only, so a draft cannot smuggle
 *         a positional list); the draft's `Rev20` part carries exactly the
 *         four `slots.{cosmos,gastronomy}.{title,tag}` keys and nothing
 *         else (rev20Parity pins the Rev20 count at 78 -- a stray key here
 *         would move it); the draft never re-adds `Rev20.slots.air`.
 *
 *  DELETE prunes the dotted path `Rev20.slots.air` -- ONLY that object. The
 *         `Rev20.slots.facts.{aqi.*,aqiValue,pm25,pm10}` labels stay: the
 *         weather deep panel's air block (D-4) still reads them.
 *
 *  SET    deep-merges the draft into the message tree (new keys added,
 *         existing values replaced, nothing else touched).
 *
 * Line endings: messages/*.json are CRLF in this working tree
 * (core.autocrlf=true); the file's own EOL is preserved so `--check` on a
 * clean tree is honest (the apply-rev41 lesson).
 *
 * Run: node scripts/apply-rev42-i18n.mjs [--check]
 *   --check  writes nothing; exits 1 if any locale file would change OR the
 *            gate fails (drafts absent / malformed). Exit 0 = clean.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.resolve(__dirname, '..', 'messages');
const draftsDir = path.resolve(__dirname, '..', '..', 'docs', 'rev42', 'i18n');

const LOCALES = [
  'en', 'ko', 'et', 'ja', 'zh', 'es', 'km', 'fr', 'de', 'pt', 'vi', 'id',
  'ru', 'hi', 'it', 'tr', 'th', 'pl', 'nl', 'tl',
];

/** The only path DELETE touches (D-8). */
const DELETE_PATH = 'Rev20.slots.air';

/** The exact `Rev20` keys a draft may carry (rev20Parity: 76 -> 78). */
const REV20_DRAFT_KEYS = [
  'Rev20.slots.cosmos.tag',
  'Rev20.slots.cosmos.title',
  'Rev20.slots.gastronomy.tag',
  'Rev20.slots.gastronomy.title',
];

const check = process.argv.includes('--check');

function fail(message) {
  console.error(`apply-rev42-i18n: ${message}`);
  process.exit(1);
}

/** Sorted ICU argument list, e.g. "{base}|{quote}|{value}". */
const icu = (s) => (s.match(/\{[^}]*\}/g) ?? []).slice().sort().join('|');

/** Flatten to leaf strings, dotted paths. Arrays and non-string leaves are
 *  refused: the namespace is objects of strings and nothing else. */
function flatten(obj, prefix, out, where) {
  if (Array.isArray(obj)) fail(`${where}: "${prefix}" is an array -- the Rev42 namespace is objects of strings only`);
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj !== 'string') fail(`${where}: "${prefix}" is ${obj === null ? 'null' : typeof obj}, not a string`);
    out[prefix] = obj;
    return out;
  }
  for (const [key, value] of Object.entries(obj)) {
    flatten(value, prefix ? `${prefix}.${key}` : key, out, where);
  }
  return out;
}

function setDeep(root, dotted, value) {
  const parts = dotted.split('.');
  const leaf = parts.pop();
  let node = root;
  for (const p of parts) {
    if (typeof node[p] !== 'object' || node[p] === null || Array.isArray(node[p])) node[p] = {};
    node = node[p];
  }
  const changed = node[leaf] !== value;
  node[leaf] = value;
  return changed;
}

/** Delete ONE dotted path; returns true when something was removed. */
function deleteDeep(root, dotted) {
  const parts = dotted.split('.');
  const leaf = parts.pop();
  let node = root;
  for (const p of parts) {
    if (typeof node?.[p] !== 'object' || node[p] === null) return false;
    node = node[p];
  }
  if (!(leaf in node)) return false;
  delete node[leaf];
  return true;
}

/* ------------------------------------------------------------------ */
/* GATE -- nothing below runs unless every draft passes                 */
/* ------------------------------------------------------------------ */

const missing = LOCALES.filter((l) => !existsSync(path.join(draftsDir, `${l}.json`)));
if (missing.length > 0) {
  fail(
    `drafts absent for ${missing.length}/${LOCALES.length} locale(s) [${missing.join(', ')}] under ${draftsDir} -- ` +
      'lane H writes docs/rev42/i18n/<locale>.json; refusing to touch messages/ (fail-closed).',
  );
}

const drafts = {};
const flat = {};
for (const locale of LOCALES) {
  const file = path.join(draftsDir, `${locale}.json`);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    fail(`${locale}.json does not parse: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(`${locale}.json is not an object`);
  const roots = Object.keys(parsed).sort();
  if (roots.join(',') !== 'Rev20,Rev42') fail(`${locale}.json must carry exactly the roots Rev20 + Rev42, got [${roots.join(', ')}]`);
  drafts[locale] = parsed;
  flat[locale] = flatten(parsed, '', {}, `${locale}.json`);
}

const en = flat.en;
const enKeys = Object.keys(en).sort();
if (enKeys.length === 0) fail('en.json carries no keys');

// The Rev20 half is exactly the four flagship title/tag keys.
const enRev20 = enKeys.filter((k) => k.startsWith('Rev20.'));
if (enRev20.join(',') !== REV20_DRAFT_KEYS.join(',')) {
  fail(`en.json Rev20 keys must be exactly [${REV20_DRAFT_KEYS.join(', ')}], got [${enRev20.join(', ')}]`);
}
if (enKeys.some((k) => k.startsWith(`${DELETE_PATH}.`) || k === DELETE_PATH)) fail(`en.json re-adds ${DELETE_PATH}, which D-8 retires`);
if (!enKeys.some((k) => k.startsWith('Rev42.'))) fail('en.json carries no Rev42 key');

for (const locale of LOCALES) {
  const keys = Object.keys(flat[locale]).sort();
  if (keys.length !== enKeys.length || keys.some((k, i) => k !== enKeys[i])) {
    const extra = keys.filter((k) => !en[k]).slice(0, 5);
    const absent = enKeys.filter((k) => !(k in flat[locale])).slice(0, 5);
    fail(`${locale}.json key set differs from en (${keys.length} vs ${enKeys.length}); extra: [${extra.join(', ')}] absent: [${absent.join(', ')}]`);
  }
  for (const key of enKeys) {
    const value = flat[locale][key];
    if (value.trim().length === 0) fail(`${locale}.json ${key} is empty -- refusing to write a placeholder`);
    if (value.includes('[MISSING')) fail(`${locale}.json ${key} is a [MISSING placeholder`);
    if (icu(value) !== icu(en[key])) fail(`${locale}.json ${key} ICU tokens "${icu(value)}" differ from en "${icu(en[key])}"`);
  }
}

/* ------------------------------------------------------------------ */
/* DELETE + SET, one locale file at a time                              */
/* ------------------------------------------------------------------ */

let totalChanges = 0;
const report = [];

for (const locale of LOCALES) {
  const file = path.join(messagesDir, `${locale}.json`);
  const raw = readFileSync(file, 'utf8');
  const data = JSON.parse(raw);

  const deleted = deleteDeep(data, DELETE_PATH) ? 1 : 0;
  let set = 0;
  // Walk the draft in ITS key order (not the sorted comparison order), so a
  // freshly created object lands in the file in the same shape lane H wrote
  // it (title before tag, name before note ...).
  for (const key of Object.keys(en)) {
    if (setDeep(data, key, flat[locale][key])) set += 1;
  }

  // Fail closed: nothing placeholder-shaped went into THIS lane's namespace.
  const own = JSON.stringify(data.Rev42 ?? {});
  if (own.includes('[MISSING')) fail(`${locale}: a placeholder survived in Rev42`);

  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const next = `${JSON.stringify(data, null, 2)}\n`.replace(/\n/g, eol);
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set, -${deleted} ${DELETE_PATH}${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev42-i18n: clean' : `apply-rev42-i18n: ${totalChanges} locale file(s) would change`);
  process.exitCode = totalChanges === 0 ? 0 : 1;
} else {
  console.log(`apply-rev42-i18n: ${totalChanges} locale file(s) written`);
}
