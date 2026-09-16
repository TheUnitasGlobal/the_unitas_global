/**
 * REV-34 MISSION 1-D i18n applicator (founder directive 2026-09-16).
 *
 * Idempotent, all 20 locales at once, a REAL translation per locale -- never a
 * placeholder (`npm run i18n:sync` writes `[MISSING:en]` and rev29Copy rejects
 * it). It writes two things:
 *
 *  1. `Rev29.newProducts.families.<key>` -- the eleven family labels the
 *     글로벌 신상품 theme gained when it widened from five families to
 *     sixteen (lib/live/newProducts.ts PRODUCT_FAMILY_KEYS). rev29Copy checks
 *     en against PRODUCT_FAMILY_KEYS and demands the exact same Rev29 key set
 *     in every locale, so all twenty land in one run.
 *  2. `Rev20.slots.newProducts.tag` -- VALUE only. rev20Parity pins Rev20 at
 *     76 keys; the tag simply enumerates the widened scope now.
 *
 * Deep-merge SET of dotted keys only: no namespace is replaced, nothing is
 * deleted. Other REV-34 lanes write the same messages/*.json concurrently --
 * if these keys vanish, re-run this script.
 *
 * Run: node scripts/apply-rev34-products-i18n.mjs [--check]
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
  if (v.length !== LOCALES.length) throw new Error(`apply-rev34-products-i18n: L() expects ${LOCALES.length} strings, got ${v.length}`);
  return Object.fromEntries(LOCALES.map((l, i) => [l, v[i]]));
};

const SET = {
  "Rev29.newProducts.families.aiAgents": L(
    "AI agents", "AI 에이전트", "AI-agendid", "AIエージェント", "AI智能体", "Agentes de IA", "ភ្នាក់ងារ AI", "Agents IA", "KI-Agenten", "Agentes de IA", "Tác nhân AI", "Agen AI", "ИИ-агенты", "AI एजेंट", "Agenti IA", "Yapay zekâ ajanları", "เอเจนต์ AI", "Agenci AI", "AI-agents", "Mga AI agent"
  ),
  "Rev29.newProducts.families.quantum": L(
    "Quantum", "양자", "Kvant", "量子", "量子", "Cuántica", "កង់ទិច", "Quantique", "Quanten", "Quântica", "Lượng tử", "Kuantum", "Квантовые", "क्वांटम", "Quantistica", "Kuantum", "ควอนตัม", "Kwantowe", "Quantum", "Quantum"
  ),
  "Rev29.newProducts.families.sovereignSaas": L(
    "Sovereign SaaS", "소버린 SaaS", "Suveräänne SaaS", "ソブリンSaaS", "自主SaaS", "SaaS soberano", "SaaS អធិបតេយ្យ", "SaaS souverain", "Souveränes SaaS", "SaaS soberano", "SaaS chủ quyền", "SaaS berdaulat", "Суверенный SaaS", "सॉवरेन SaaS", "SaaS sovrano", "Egemen SaaS", "SaaS อธิปไตย", "Suwerenny SaaS", "Soevereine SaaS", "Sovereign SaaS"
  ),
  "Rev29.newProducts.families.bioHealth": L(
    "Bio-health", "바이오 헬스", "Biotervis", "バイオヘルス", "生物健康", "Biosalud", "ជីវសុខភាព", "Bio-santé", "Bio-Gesundheit", "Biossaúde", "Sinh học y tế", "Bio-kesehatan", "Биоздоровье", "बायो-हेल्थ", "Biosalute", "Biyo-sağlık", "ไบโอเฮลท์", "Biozdrowie", "Biogezondheid", "Bio-health"
  ),
  "Rev29.newProducts.families.neurotech": L(
    "Neurotech", "뉴로테크", "Neurotehnoloogia", "ニューロテック", "神经科技", "Neurotecnología", "បច្ចេកវិទ្យាប្រសាទ", "Neurotech", "Neurotechnik", "Neurotecnologia", "Công nghệ thần kinh", "Neuroteknologi", "Нейротехнологии", "न्यूरोटेक", "Neurotecnologie", "Nöroteknoloji", "นิวโรเทค", "Neurotechnologie", "Neurotech", "Neurotech"
  ),
  "Rev29.newProducts.families.space": L(
    "Space", "우주", "Kosmos", "宇宙", "航天", "Espacio", "អវកាស", "Espace", "Raumfahrt", "Espaço", "Vũ trụ", "Antariksa", "Космос", "अंतरिक्ष", "Spazio", "Uzay", "อวกาศ", "Kosmos", "Ruimtevaart", "Kalawakan"
  ),
  "Rev29.newProducts.families.xr": L(
    "XR devices", "XR 디바이스", "XR-seadmed", "XRデバイス", "XR设备", "Dispositivos XR", "ឧបករណ៍ XR", "Appareils XR", "XR-Geräte", "Dispositivos XR", "Thiết bị XR", "Perangkat XR", "XR-устройства", "XR डिवाइस", "Dispositivi XR", "XR cihazları", "อุปกรณ์ XR", "Urządzenia XR", "XR-apparaten", "Mga XR device"
  ),
  "Rev29.newProducts.families.defiHardware": L(
    "DeFi hardware", "디파이 하드웨어", "DeFi riistvara", "DeFiハードウェア", "DeFi硬件", "Hardware DeFi", "ហាដវែរ DeFi", "Matériel DeFi", "DeFi-Hardware", "Hardware DeFi", "Phần cứng DeFi", "Perangkat keras DeFi", "DeFi-оборудование", "DeFi हार्डवेयर", "Hardware DeFi", "DeFi donanımı", "ฮาร์ดแวร์ DeFi", "Sprzęt DeFi", "DeFi-hardware", "DeFi hardware"
  ),
  "Rev29.newProducts.families.ecoEnergy": L(
    "Eco energy", "에코 에너지", "Ökoenergia", "エコエネルギー", "绿色能源", "Ecoenergía", "ថាមពលបៃតង", "Éco-énergie", "Öko-Energie", "Ecoenergia", "Năng lượng xanh", "Energi hijau", "Экоэнергия", "इको ऊर्जा", "Ecoenergia", "Eko enerji", "พลังงานสีเขียว", "Ekoenergia", "Eco-energie", "Eco energy"
  ),
  "Rev29.newProducts.families.nomadGear": L(
    "Nomad gear", "노마드 기어", "Nomaadivarustus", "ノマドギア", "游牧装备", "Equipo nómada", "ឧបករណ៍ណូម៉ាដ", "Équipement nomade", "Nomaden-Ausrüstung", "Equipamento nômade", "Đồ nghề du mục", "Perlengkapan nomaden", "Снаряжение номада", "नोमैड गियर", "Attrezzatura nomade", "Nomad ekipmanı", "อุปกรณ์โนแมด", "Sprzęt nomady", "Nomad-uitrusting", "Gamit ng nomad"
  ),
  "Rev29.newProducts.families.robots": L(
    "Robots", "로봇", "Robotid", "ロボット", "机器人", "Robots", "រ៉ូបូត", "Robots", "Roboter", "Robôs", "Robot", "Robot", "Роботы", "रोबोट", "Robot", "Robotlar", "หุ่นยนต์", "Roboty", "Robots", "Mga robot"
  ),
  // VALUE only -- the key already exists in all 20 locales (Rev20 stays at 76 keys).
  "Rev20.slots.newProducts.tag": L(
    "Sixteen families the world just released — cars, phones, mobility, gadgets, games, AI agents, quantum, SaaS, bio-health, neurotech, space, XR, DeFi, eco energy, nomad gear and robots",
    "세계가 방금 출시한 16개 패밀리 — 자동차·스마트폰·모빌리티·가젯·게임·AI 에이전트·양자·SaaS·바이오 헬스·뉴로테크·우주·XR·디파이·에코 에너지·노마드 기어·로봇",
    "Kuusteist perekonda, mille maailm just välja lasi — autod, telefonid, liikuvus, vidinad, mängud, AI-agendid, kvant, SaaS, biotervis, neurotehnoloogia, kosmos, XR, DeFi, ökoenergia, nomaadivarustus ja robotid",
    "世界が今出したばかりの16ファミリー — 車・スマホ・モビリティ・ガジェット・ゲーム・AIエージェント・量子・SaaS・バイオヘルス・ニューロテック・宇宙・XR・DeFi・エコエネルギー・ノマドギア・ロボット",
    "世界刚刚发布的16大品类——汽车、手机、出行、数码、游戏、AI智能体、量子、SaaS、生物健康、神经科技、航天、XR、DeFi、绿色能源、游牧装备和机器人",
    "Dieciséis familias recién lanzadas en el mundo: coches, móviles, movilidad, gadgets, juegos, agentes de IA, cuántica, SaaS, biosalud, neurotecnología, espacio, XR, DeFi, ecoenergía, equipo nómada y robots",
    "១៦ ក្រុមដែលពិភពលោកទើបចេញ — រថយន្ត ទូរស័ព្ទ ចលនភាព ឧបករណ៍ ហ្គេម ភ្នាក់ងារ AI កង់ទិច SaaS ជីវសុខភាព បច្ចេកវិទ្យាប្រសាទ អវកាស XR DeFi ថាមពលបៃតង ឧបករណ៍ណូម៉ាដ និងរ៉ូបូត",
    "Seize familles que le monde vient de lancer — voitures, téléphones, mobilité, gadgets, jeux, agents IA, quantique, SaaS, bio-santé, neurotech, espace, XR, DeFi, éco-énergie, équipement nomade et robots",
    "Sechzehn Familien, die die Welt gerade veröffentlicht hat — Autos, Handys, Mobilität, Gadgets, Spiele, KI-Agenten, Quanten, SaaS, Bio-Gesundheit, Neurotechnik, Raumfahrt, XR, DeFi, Öko-Energie, Nomaden-Ausrüstung und Roboter",
    "Dezesseis famílias que o mundo acabou de lançar — carros, telemóveis, mobilidade, gadgets, jogos, agentes de IA, quântica, SaaS, biossaúde, neurotecnologia, espaço, XR, DeFi, ecoenergia, equipamento nômade e robôs",
    "Mười sáu nhóm thế giới vừa ra mắt — xe hơi, điện thoại, phương tiện, thiết bị, game, tác nhân AI, lượng tử, SaaS, sinh học y tế, công nghệ thần kinh, vũ trụ, XR, DeFi, năng lượng xanh, đồ nghề du mục và robot",
    "Enam belas keluarga yang baru dirilis dunia — mobil, ponsel, mobilitas, gadget, gim, agen AI, kuantum, SaaS, bio-kesehatan, neuroteknologi, antariksa, XR, DeFi, energi hijau, perlengkapan nomaden, dan robot",
    "Шестнадцать семейств, только что вышедших в мире — автомобили, смартфоны, мобильность, гаджеты, игры, ИИ-агенты, квантовые, SaaS, биоздоровье, нейротехнологии, космос, XR, DeFi, экоэнергия, снаряжение номада и роботы",
    "दुनिया ने अभी-अभी जारी किए सोलह परिवार — कारें, फोन, मोबिलिटी, गैजेट, गेम, AI एजेंट, क्वांटम, SaaS, बायो-हेल्थ, न्यूरोटेक, अंतरिक्ष, XR, DeFi, इको ऊर्जा, नोमैड गियर और रोबोट",
    "Sedici famiglie appena lanciate nel mondo — auto, telefoni, mobilità, gadget, giochi, agenti IA, quantistica, SaaS, biosalute, neurotecnologie, spazio, XR, DeFi, ecoenergia, attrezzatura nomade e robot",
    "Dünyanın az önce piyasaya sürdüğü on altı aile — arabalar, telefonlar, mobilite, gadget’lar, oyunlar, yapay zekâ ajanları, kuantum, SaaS, biyo-sağlık, nöroteknoloji, uzay, XR, DeFi, eko enerji, nomad ekipmanı ve robotlar",
    "สิบหกกลุ่มที่โลกเพิ่งเปิดตัว — รถยนต์ โทรศัพท์ ยานพาหนะ แกดเจ็ต เกม เอเจนต์ AI ควอนตัม SaaS ไบโอเฮลท์ นิวโรเทค อวกาศ XR DeFi พลังงานสีเขียว อุปกรณ์โนแมด และหุ่นยนต์",
    "Szesnaście rodzin, które świat właśnie wypuścił — samochody, telefony, mobilność, gadżety, gry, agenci AI, kwantowe, SaaS, biozdrowie, neurotechnologie, kosmos, XR, DeFi, ekoenergia, sprzęt nomady i roboty",
    "Zestien families die de wereld net uitbracht — auto’s, telefoons, mobiliteit, gadgets, games, AI-agents, quantum, SaaS, biogezondheid, neurotech, ruimtevaart, XR, DeFi, eco-energie, nomad-uitrusting en robots",
    "Labing-anim na pamilya na kalalabas lang sa mundo — kotse, telepono, mobility, gadget, laro, AI agent, quantum, SaaS, bio-health, neurotech, kalawakan, XR, DeFi, eco energy, gamit ng nomad at robot"
  ),
};

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
      throw new Error(`apply-rev34-products-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (setDeep(data, dotted, value)) set += 1;
  }

  // Fail closed: nothing placeholder-shaped went in.
  const families = JSON.stringify(data.Rev29?.newProducts ?? {});
  if (families.includes('[MISSING')) throw new Error(`apply-rev34-products-i18n: ${locale}: a placeholder survived in Rev29.newProducts`);

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev34-products-i18n: clean' : `apply-rev34-products-i18n: ${totalChanges} locale file(s) would change`);
  process.exit(totalChanges === 0 ? 0 : 1);
}
console.log(`apply-rev34-products-i18n: ${totalChanges} locale file(s) written`);
