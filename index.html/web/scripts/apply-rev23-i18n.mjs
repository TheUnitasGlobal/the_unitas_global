/**
 * REV-23 i18n applicator (founder directive 2026-09-13).
 *
 * Two jobs, both idempotent, both across all 20 locales at once:
 *
 *  1. PURGE the copy for everything REV-23 deleted. A deleted feature that
 *     leaves its strings behind is not deleted -- the next person to read
 *     messages/ believes the surface still exists, and a rev-parity check
 *     happily keeps translating it. Every path below was verified
 *     unreferenced in the source before being listed here.
 *
 *  2. SET the copy REV-23 changes or introduces, with a REAL translation per
 *     locale -- never a "[MISSING:en]" placeholder, which is what
 *     `i18n-sync.ts` would leave.
 *
 * Run: node scripts/apply-rev23-i18n.mjs [--check]
 *   --check exits non-zero if anything would change (CI / pre-commit use).
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

/* ------------------------------------------------------------------ */
/* 1. Purge                                                            */
/* ------------------------------------------------------------------ */

/** The 16 stream card kinds M2.2 deleted. */
const DELETED_KINDS = [
  'essence', 'axisSpectrum', 'chain', 'deepGate', 'identity', 'redesign',
  'cogs', 'timeline', 'visual', 'papers', 'backlinks', 'siblings', 'shelf',
  'art', 'number', 'earthEvents',
];

/** Fact labels whose legs are gone (only editions / passage / trend /
 *  views30 / window are still emitted -- see dataLadder*.ts). */
const DELETED_FIELDS = [
  'instanceOf', 'entity', 'population', 'gdp', 'gdpPerCapita',
  'lifeExpectancy', 'internetUsers', 'area', 'elevation', 'hdi', 'events',
  'quakes',
];

const PURGE = [
  // -- M2.2: the free/paid reporter switch, the 3-second dimensional lens,
  //    the commercial-bias shield, the 3-step action checklist, swarm
  //    cross-reasoning, the 6-axis spectrum + sovereign redesign, and the
  //    whole paid deep-insight tier (The VOID).
  'UAI.reporterFree',
  'UAI.reporterPaid',
  'UAI.lensLabel',
  'UAI.shieldLabel',
  'UAI.shield',
  'UAI.checklistLabel',
  'UAI.checklist',
  'UAI.swarmLabel',
  'UAI.constitutionLabel',
  'UAI.redesignLabel',
  'UAI.redesign',
  'UAI.deepHint',
  'UAI.deepCta',
  'UAI.deepLocked',
  'UAI.deepScanning',
  'UAI.voidLabel',
  'UAI.chronosLabel',
  'UAI.chronos',
  'UAI.binaryLabel',
  'UAI.confidence',
  'UAI.redPenLabel',
  'UAI.pathLabel',
  'UAI.cachedBadge',
  'UAI.modelNote',
  'UAI.insightLabel',
  'UAI.insightFreshBadge',
  'UAI.insightAxisReading',
  'UAI.insightAxisRedesign',
  'UAI.insightVectorLabel',
  'UAI.insightForging',
  'UAI.insightPending',
  'UAI.followupLabel',
  'UAI.followupHint',
  'UAI.err',
  // -- the stream's own deleted chrome
  'Rev21.stream.rare',
  'Rev21.stream.rareHint',
  'Rev21.stream.outbound',
  'Rev21.stream.deepCreditNote',
  'Rev21.stream.swarmMore',
  'Rev21.stream.swarmLess',
  'Rev21.stream.spine.deepCta',
  'Rev21.cogs',
  ...DELETED_KINDS.map((k) => `Rev21.stream.kinds.${k}`),
  ...DELETED_FIELDS.map((f) => `Rev21.stream.fields.${f}`),
  // -- M3.2: the "전체" chip and the "실시간" catch-all box are retired; the
  //    individual themes absorb both.
  'HotNews.all',
  'HotNews.category.world',
];

/* ------------------------------------------------------------------ */
/* 2. Set                                                             */
/* ------------------------------------------------------------------ */

/**
 * `path -> { locale: value }`. Every locale is spelled out: a missing one is
 * a hard error, not a silent English fallback.
 */
const SET = {
  // M2.2: the surviving page-0 card IS "웹 실시간 종합", so the card's own
  // kind label says so instead of the generic "출처 / Sources".
  'Rev21.stream.kinds.sources': {
    en: 'Live web synthesis',
    ko: '웹 실시간 종합',
    et: 'Veebi reaalajasüntees',
    ja: 'ウェブ・リアルタイム統合',
    zh: '实时网络综合',
    es: 'Síntesis web en tiempo real',
    km: 'ការសំយោគបណ្ដាញផ្ទាល់',
    fr: 'Synthèse web en direct',
    de: 'Live-Websynthese',
    pt: 'Síntese web em tempo real',
    vi: 'Tổng hợp web thời gian thực',
    id: 'Sintesis web waktu nyata',
    ru: 'Синтез веба в реальном времени',
    hi: 'लाइव वेब संश्लेषण',
    it: 'Sintesi web in tempo reale',
    tr: 'Canlı web sentezi',
    th: 'การสังเคราะห์เว็บแบบเรียลไทม์',
    pl: 'Synteza sieci na żywo',
    nl: 'Live websynthese',
    tl: 'Live na sintesis ng web',
  },
  // M2.2: /u-ai's own strapline named three features that no longer exist.
  'UAI.subhead': {
    en: 'One question, the live web synthesised and then opened outward — sources, concepts, sites, waves of attention, the world’s other editions.',
    ko: '질문 하나에 웹을 실시간으로 종합하고, 거기서 바깥으로 펼칩니다 — 출처, 개념, 사이트, 관심의 파동, 세계 각 판.',
    et: 'Üks küsimus, veeb sünteesitakse reaalajas ja avaneb siis väljapoole — allikad, mõisted, saidid, tähelepanulained, maailma teised väljaanded.',
    ja: '一つの問いから、ウェブをリアルタイムに統合し、そこから外へ広げます — 出典、概念、サイト、関心の波、世界各版。',
    zh: '一个问题，实时综合全网，再向外展开 — 来源、概念、站点、关注的波动、世界各版本。',
    es: 'Una pregunta, la web sintetizada en vivo y luego abierta hacia fuera: fuentes, conceptos, sitios, olas de atención, las otras ediciones del mundo.',
    km: 'សំណួរមួយ បណ្ដាញត្រូវបានសំយោគផ្ទាល់ រួចបើកចេញទៅក្រៅ — ប្រភព គំនិត គេហទំព័រ រលកនៃការចាប់អារម្មណ៍ និងកំណែផ្សេងៗនៃពិភពលោក។',
    fr: 'Une question, le web synthétisé en direct puis ouvert vers l’extérieur : sources, concepts, sites, vagues d’attention, les autres éditions du monde.',
    de: 'Eine Frage, das Web live synthetisiert und dann nach außen geöffnet — Quellen, Konzepte, Seiten, Aufmerksamkeitswellen, die anderen Ausgaben der Welt.',
    pt: 'Uma pergunta, a web sintetizada ao vivo e depois aberta para fora: fontes, conceitos, sites, ondas de atenção, as outras edições do mundo.',
    vi: 'Một câu hỏi, web được tổng hợp trực tiếp rồi mở ra bên ngoài — nguồn, khái niệm, trang web, những đợt sóng chú ý, các phiên bản khác của thế giới.',
    id: 'Satu pertanyaan, web disintesis langsung lalu dibuka keluar — sumber, konsep, situs, gelombang perhatian, edisi lain dunia.',
    ru: 'Один вопрос — веб синтезируется в реальном времени и раскрывается наружу: источники, понятия, сайты, волны внимания, другие издания мира.',
    hi: 'एक सवाल, वेब का लाइव संश्लेषण और फिर बाहर की ओर विस्तार — स्रोत, अवधारणाएँ, साइटें, ध्यान की लहरें, दुनिया के अन्य संस्करण।',
    it: 'Una domanda, il web sintetizzato in diretta e poi aperto verso l’esterno: fonti, concetti, siti, onde di attenzione, le altre edizioni del mondo.',
    tr: 'Tek bir soru, web canlı olarak sentezlenir ve sonra dışa açılır — kaynaklar, kavramlar, siteler, ilgi dalgaları, dünyanın diğer sürümleri.',
    th: 'คำถามเดียว เว็บถูกสังเคราะห์แบบเรียลไทม์แล้วเปิดออกสู่ภายนอก — แหล่งที่มา แนวคิด เว็บไซต์ คลื่นความสนใจ และฉบับอื่นของโลก',
    pl: 'Jedno pytanie, sieć syntetyzowana na żywo, a potem otwierana na zewnątrz — źródła, pojęcia, witryny, fale uwagi, inne wydania świata.',
    nl: 'Eén vraag, het web live gesynthetiseerd en daarna naar buiten geopend — bronnen, concepten, sites, aandachtsgolven, de andere edities van de wereld.',
    tl: 'Isang tanong, ang web ay sinisintesis nang live at pagkatapos ay ibinubukas palabas — mga pinagmulan, konsepto, site, alon ng atensiyon, ang ibang edisyon ng mundo.',
  },
};

/* ------------------------------------------------------------------ */

function getDeep(obj, dotted) {
  return dotted.split('.').reduce((node, k) => (node && typeof node === 'object' ? node[k] : undefined), obj);
}

function deleteDeep(obj, dotted) {
  const parts = dotted.split('.');
  const leaf = parts.pop();
  let node = obj;
  for (const p of parts) {
    if (!node || typeof node !== 'object' || !(p in node)) return false;
    node = node[p];
  }
  if (!node || typeof node !== 'object' || !(leaf in node)) return false;
  delete node[leaf];
  return true;
}

function setDeep(obj, dotted, value) {
  const parts = dotted.split('.');
  const leaf = parts.pop();
  let node = obj;
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
  let purged = 0;
  let set = 0;

  for (const dotted of PURGE) if (deleteDeep(data, dotted)) purged += 1;

  for (const [dotted, byLocale] of Object.entries(SET)) {
    const value = byLocale[locale];
    if (typeof value !== 'string') {
      throw new Error(`apply-rev23-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (setDeep(data, dotted, value)) set += 1;
  }

  // Fail closed on a purge that would leave a dangling parent behind.
  for (const dotted of PURGE) {
    if (getDeep(data, dotted) !== undefined) throw new Error(`apply-rev23-i18n: ${locale}: ${dotted} survived the purge`);
  }

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: -${purged} purged, ~${set} set${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev23-i18n: clean' : `apply-rev23-i18n: ${totalChanges} locale file(s) would change`);
  process.exit(totalChanges === 0 ? 0 : 1);
}
console.log(`apply-rev23-i18n: wrote ${totalChanges} locale file(s)`);
