/**
 * REV-34 lane S1 i18n applicator (founder directive 2026-09-16, M1-B / M1-C).
 *
 * Idempotent, all 20 locales at once, a REAL translation per locale -- never a
 * placeholder. It writes exactly two keys, both under the strip's own
 * sub-namespaces so no parity gate on an older namespace is touched:
 *
 *  1. `Rev34.meta.line` -- THE footer format of the shortcut strip and its
 *     deep modals (D-4): the news rail's `{count}건 · {source} ~ {updated} 갱신`
 *     shape, rendered by components/home/hub/HubMetaLine.tsx everywhere a
 *     "갱신 / 시간 / 카드 갱신 / 딥다이브" wording used to sit. ICU arguments:
 *     `count` (rows shown), `source` (the already-translated source sentence),
 *     `updated` (HH:mm from lib/live/metaLine.ts).
 *  2. `Rev34.row.open` -- the `title` + sr-only text of the ⏎ row box
 *     (components/home/hub/HubTitleRow.tsx, D-5). It is deliberately NOT an
 *     aria-label: rev21-hub-card asserts the history card holds zero
 *     `button[aria-label]`.
 *
 * Deep-merge SET of dotted keys only: the `Rev34` object is never replaced
 * (other REV-34 lanes write their own sub-namespaces into the same files) and
 * nothing is ever deleted. `Rev19.hub.updated/cadence` and `Weather.updated`
 * stay in the files -- they merely stop being rendered (D-4).
 *
 * Run: node scripts/apply-rev34-strip-i18n.mjs [--check]
 *   --check exits 1 if any locale file would change.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.resolve(__dirname, '..', 'messages');

const LOCALES = [
  'en', 'ko', 'et', 'ja', 'zh', 'es', 'km', 'fr', 'de', 'pt', 'vi', 'id',
  'ru', 'hi', 'it', 'tr', 'th', 'pl', 'nl', 'tl',
];

/** Positional: one string per locale, in LOCALES order. */
const L = (...v) => {
  if (v.length !== LOCALES.length) throw new Error(`apply-rev34-strip-i18n: L() expects ${LOCALES.length} strings, got ${v.length}`);
  return Object.fromEntries(LOCALES.map((l, i) => [l, v[i]]));
};

const SET = {
  'Rev34.meta.line': L(
    '{count} items · {source} ~ updated {updated}',
    '{count}건 · {source} ~ {updated} 갱신',
    '{count} kirjet · {source} ~ uuendatud {updated}',
    '{count}件 · {source} ~ {updated} 更新',
    '{count}条 · {source} ~ {updated} 更新',
    '{count} elementos · {source} ~ actualizado {updated}',
    '{count} ធាតុ · {source} ~ បានធ្វើបច្ចុប្បន្នភាព {updated}',
    '{count} éléments · {source} ~ mis à jour {updated}',
    '{count} Einträge · {source} ~ aktualisiert {updated}',
    '{count} itens · {source} ~ atualizado {updated}',
    '{count} mục · {source} ~ cập nhật {updated}',
    '{count} item · {source} ~ diperbarui {updated}',
    '{count} записей · {source} ~ обновлено {updated}',
    '{count} आइटम · {source} ~ {updated} अपडेट',
    '{count} elementi · {source} ~ aggiornato {updated}',
    '{count} öğe · {source} ~ {updated} güncellendi',
    '{count} รายการ · {source} ~ อัปเดต {updated}',
    '{count} pozycji · {source} ~ zaktualizowano {updated}',
    '{count} items · {source} ~ bijgewerkt {updated}',
    '{count} item · {source} ~ na-update {updated}',
  ),
  'Rev34.row.open': L(
    'Open',
    '열기',
    'Ava',
    '開く',
    '打开',
    'Abrir',
    'បើក',
    'Ouvrir',
    'Öffnen',
    'Abrir',
    'Mở',
    'Buka',
    'Открыть',
    'खोलें',
    'Apri',
    'Aç',
    'เปิด',
    'Otwórz',
    'Openen',
    'Buksan',
  ),
};

/** Sets one dotted key, creating intermediate objects; never touches
 *  siblings. Returns whether the leaf actually changed. */
function setDeep(root, dotted, value) {
  const parts = dotted.split('.');
  const leaf = parts.pop();
  let node = root;
  for (const p of parts) {
    if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
    node = node[p];
  }
  const changed = node[leaf] !== value;
  node[leaf] = value;
  return changed;
}

const check = process.argv.includes('--check');
let totalChanges = 0;
const report = [];

for (const locale of LOCALES) {
  const file = path.join(messagesDir, `${locale}.json`);
  const raw = readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  let set = 0;

  for (const [dotted, byLocale] of Object.entries(SET)) {
    const value = byLocale[locale];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`apply-rev34-strip-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (setDeep(data, dotted, value)) set += 1;
  }

  // Fail closed: nothing placeholder-shaped went into THIS lane's sub-namespaces,
  // and the ICU arguments survived in every locale.
  for (const ns of ['meta', 'row']) {
    const own = JSON.stringify(data.Rev34?.[ns] ?? {});
    if (own.includes('[MISSING')) throw new Error(`apply-rev34-strip-i18n: ${locale}: a placeholder survived in Rev34.${ns}`);
  }
  for (const arg of ['{count}', '{source}', '{updated}']) {
    if (!data.Rev34.meta.line.includes(arg)) throw new Error(`apply-rev34-strip-i18n: ${locale}: Rev34.meta.line lost ${arg}`);
  }

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev34-strip-i18n: clean' : `apply-rev34-strip-i18n: ${totalChanges} locale file(s) would change`);
  process.exit(totalChanges === 0 ? 0 : 1);
}
console.log(`apply-rev34-strip-i18n: ${totalChanges} locale file(s) written`);
