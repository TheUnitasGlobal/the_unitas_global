/**
 * REV-35 M1 i18n applicator (SPEC §2 D-7, lane M1b) -- the single U-Ranking standard.
 *
 * Idempotent, all 20 locales at once, a REAL translation per locale -- never a
 * placeholder. Two operations, both fail-closed:
 *
 *  SET    deep-merges `Rev35.uRanking.tag`, the one short 13px tag line the
 *         discovery carousel's `uRanking` slot shows under its title. The title
 *         itself reuses `Rev34.uRankings.label` so the slot, the U-Square tab and
 *         the hub rail carry identical branding; a Rev35 namespace (rather than
 *         growing Rev34) keeps revision traceability and leaves rev34Parity's
 *         lane split untouched.
 *
 *  DELETE removes the root namespaces `GlobalRankings` and `UnitasRankings`.
 *         Their only readers (GlobalThemeRankings, UnitasModuleRankings,
 *         lib/globalRankings, lib/unitasRankings, the ranking-detail API and the
 *         worldRanking/unitasRanking branches of DiscoveryCarousel/discoverySlots)
 *         are all deleted or rewritten by lane M1a in the same revision, so the
 *         41 orphaned strings would otherwise ship in every locale forever.
 *
 * The retired `Rev21.slots.worldRanking|unitasRanking|facts.*` keys are NOT
 * touched here: `Rev21` is replaced wholesale by scripts/i18n/apply-rev21.mjs
 * from the docs/rev21/i18n drafts, so they were removed at the draft level.
 *
 * Run: node scripts/apply-rev35-i18n.mjs [--check]   (--check exits 1 on drift)
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
  if (v.length !== LOCALES.length) throw new Error(`apply-rev35-i18n: L() expects ${LOCALES.length} strings, got ${v.length}`);
  return Object.fromEntries(LOCALES.map((l, i) => [l, v[i]]));
};

const SET = {
  "Rev35.uRanking.tag": L(
    "The UNITAS ladder, rewritten daily by micro-burn efficiency, knowledge sales and nomad contribution",
    "마이크로번 효율·지식 판매·노마드 기여로 매일 새로 쓰는 유니타스 사다리",
    "UNITASe redel, mida kirjutavad iga päev ümber Micro-Burn tõhusus, teadmiste müük ja nomaadipanus",
    "マイクロバーン効率・知識販売・ノマド貢献度で毎日書き換わる UNITAS のはしご",
    "由微燃效率、知识销售与游牧贡献每日重写的 UNITAS 阶梯",
    "La escalera UNITAS, reescrita a diario por la eficiencia Micro-Burn, las ventas de conocimiento y el aporte nómada",
    "ជណ្ដើរ UNITAS ដែលសរសេរឡើងវិញរាល់ថ្ងៃដោយប្រសិទ្ធភាព Micro-Burn ការលក់ចំណេះដឹង និងការចូលរួមណូម៉ាដ",
    "L'échelle UNITAS, réécrite chaque jour par l'efficacité Micro-Burn, les ventes de savoir et la contribution nomade",
    "Die UNITAS-Leiter, täglich neu geschrieben aus Micro-Burn-Effizienz, Wissensverkäufen und Nomaden-Beitrag",
    "A escada UNITAS, reescrita todos os dias pela eficiência Micro-Burn, vendas de conhecimento e contribuição nómada",
    "Bậc thang UNITAS, viết lại mỗi ngày theo hiệu suất Micro-Burn, tri thức đã bán và đóng góp du mục",
    "Tangga UNITAS, ditulis ulang setiap hari oleh efisiensi Micro-Burn, penjualan pengetahuan, dan kontribusi nomaden",
    "Лестница UNITAS, которую каждый день переписывают эффективность Micro-Burn, продажи знаний и вклад номада",
    "UNITAS की सीढ़ी, जो माइक्रो-बर्न दक्षता, ज्ञान बिक्री और नोमैड योगदान से हर दिन नए सिरे से लिखी जाती है",
    "La scala UNITAS, riscritta ogni giorno da efficienza Micro-Burn, vendite di conoscenza e contributo nomade",
    "Micro-Burn verimliliği, bilgi satışları ve göçebe katkısıyla her gün yeniden yazılan UNITAS merdiveni",
    "บันได UNITAS ที่เขียนใหม่ทุกวันด้วยประสิทธิภาพ Micro-Burn ยอดขายความรู้ และการมีส่วนร่วมแบบโนแมด",
    "Drabina UNITAS, codziennie pisana na nowo przez efektywność Micro-Burn, sprzedaż wiedzy i wkład nomady",
    "De UNITAS-ladder, elke dag opnieuw geschreven door Micro-Burn-efficiëntie, kennisverkopen en nomadenbijdrage",
    "Ang hagdan ng UNITAS, muling isinusulat araw-araw ng kahusayan sa Micro-Burn, benta ng kaalaman at ambag ng nomad"
  ),
};

/** Root namespaces retired by REV-35 M1 (orphaned once lane M1a lands). */
const DELETE = ['GlobalRankings', 'UnitasRankings'];

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
  let deleted = 0;

  for (const [dotted, byLocale] of Object.entries(SET)) {
    const value = byLocale[locale];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`apply-rev35-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (setDeep(data, dotted, value)) set += 1;
  }

  for (const ns of DELETE) {
    if (ns in data) {
      delete data[ns];
      deleted += 1;
    }
  }

  // Fail closed: nothing placeholder-shaped went into THIS lane's namespace.
  const own = JSON.stringify(data.Rev35 ?? {});
  if (own.includes('[MISSING')) throw new Error(`apply-rev35-i18n: ${locale}: a placeholder survived in Rev35`);

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set, -${deleted} namespace(s)${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev35-i18n: clean' : `apply-rev35-i18n: ${totalChanges} locale file(s) would change`);
  process.exit(totalChanges === 0 ? 0 : 1);
}
console.log(`apply-rev35-i18n: ${totalChanges} locale file(s) written`);
