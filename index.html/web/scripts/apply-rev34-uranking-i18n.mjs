/**
 * REV-34 MISSION 4-C i18n applicator (founder directive 2026-09-16) -- 유랭킹.
 *
 * Idempotent, all 20 locales at once, a REAL translation per locale -- never a
 * placeholder. It writes ONLY its own sub-namespace, `Rev34.uRankings.*`, by
 * deep-merging dotted keys (it never replaces the `Rev34` object, never deletes
 * a key), because the other REV-34 lanes ship their own `Rev34.<lane>.*` keys
 * to the same messages/*.json concurrently. If this lane's keys ever vanish
 * under a sibling's write, re-running this script restores them.
 *
 * Module titles are NOT written here: the cards reuse the existing
 * `Ecosystems.<key>.title` / `Modules.<key>.title` strings. The hub tab label
 * ("유랭킹") is lane Q1's `Rev34.square.themes.uRanking.tab`.
 *
 * Run: node scripts/apply-rev34-uranking-i18n.mjs [--check]
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
  if (v.length !== LOCALES.length) throw new Error(`apply-rev34-uranking-i18n: L() expects ${LOCALES.length} strings, got ${v.length}`);
  return Object.fromEntries(LOCALES.map((l, i) => [l, v[i]]));
};

const SET = {
  "Rev34.uRankings.label": L(
    "U-Rankings", "유랭킹", "U-edetabel", "Uランキング", "U排行榜", "U-Ranking", "U-ចំណាត់ថ្នាក់", "U-Classement", "U-Ranking", "U-Ranking", "U-Xếp hạng", "U-Peringkat", "U-Рейтинг", "U-रैंकिंग", "U-Classifica", "U-Sıralama", "U-อันดับ", "U-Ranking", "U-Ranking", "U-Ranking"
  ),
  "Rev34.uRankings.lede": L(
    "Today's twelve operators, ranked by how sovereignly they run the ecosystem: Micro-Burn efficiency, knowledge sold, nomad contribution.",
    "오늘의 열두 오퍼레이터 — 마이크로-버른 효율, 지식 판매, 노마드 기여도로 생태계를 얼마나 소버린하게 운용하는지 순위로 봅니다.",
    "Tänased kaksteist operaatorit, järjestatud selle järgi, kui suveräänselt nad ökosüsteemi juhivad: Micro-Burn tõhusus, müüdud teadmised, nomaadipanus.",
    "今日の12人のオペレーターを、エコシステムをどれだけソブリンに運用しているかで順位付け — マイクロバーン効率、知識販売、ノマド貢献度。",
    "今日的十二位运营者，按其运营生态系统的主权程度排名：微燃效率、知识销售、游牧贡献。",
    "Los doce operadores de hoy, clasificados por cuán soberanamente gestionan el ecosistema: eficiencia Micro-Burn, conocimiento vendido, aporte nómada.",
    "ប្រតិបត្តិករដប់ពីរនាក់ថ្ងៃនេះ ចាត់ថ្នាក់តាមរបៀបដែលពួកគេគ្រប់គ្រងប្រព័ន្ធអេកូយ៉ាងអធិបតេយ្យ៖ ប្រសិទ្ធភាព Micro-Burn ចំណេះដឹងដែលបានលក់ ការចូលរួមរបស់ណូម៉ាដ។",
    "Les douze opérateurs du jour, classés selon la souveraineté avec laquelle ils font tourner l'écosystème : efficacité Micro-Burn, savoir vendu, contribution nomade.",
    "Die zwölf Operatoren des Tages, gereiht danach, wie souverän sie das Ökosystem betreiben: Micro-Burn-Effizienz, verkauftes Wissen, Nomaden-Beitrag.",
    "Os doze operadores de hoje, classificados pela soberania com que gerem o ecossistema: eficiência Micro-Burn, conhecimento vendido, contribuição nómada.",
    "Mười hai nhà vận hành hôm nay, xếp hạng theo mức độ tự chủ khi vận hành hệ sinh thái: hiệu suất Micro-Burn, tri thức đã bán, đóng góp du mục.",
    "Dua belas operator hari ini, diperingkat menurut seberapa berdaulat mereka menjalankan ekosistem: efisiensi Micro-Burn, pengetahuan terjual, kontribusi nomaden.",
    "Двенадцать операторов дня, ранжированные по тому, насколько суверенно они ведут экосистему: эффективность Micro-Burn, проданные знания, вклад номада.",
    "आज के बारह ऑपरेटर, इस आधार पर क्रमबद्ध कि वे इकोसिस्टम को कितनी संप्रभुता से चलाते हैं: माइक्रो-बर्न दक्षता, बेचा गया ज्ञान, नोमैड योगदान।",
    "I dodici operatori di oggi, classificati per quanto sovranamente gestiscono l'ecosistema: efficienza Micro-Burn, conoscenza venduta, contributo nomade.",
    "Bugünün on iki operatörü, ekosistemi ne kadar egemen yürüttüklerine göre sıralandı: Micro-Burn verimliliği, satılan bilgi, göçebe katkısı.",
    "สิบสองผู้ปฏิบัติการของวันนี้ จัดอันดับตามความเป็นอธิปไตยในการขับเคลื่อนระบบนิเวศ: ประสิทธิภาพ Micro-Burn ความรู้ที่ขายได้ และการมีส่วนร่วมแบบโนแมด",
    "Dwunastu dzisiejszych operatorów, uszeregowanych według tego, jak suwerennie prowadzą ekosystem: efektywność Micro-Burn, sprzedana wiedza, wkład nomady.",
    "De twaalf operators van vandaag, gerangschikt naar hoe soeverein ze het ecosysteem draaien: Micro-Burn-efficiëntie, verkochte kennis, nomadenbijdrage.",
    "Ang labindalawang operator ngayong araw, niraranggo ayon sa kung gaano ka-soberano nilang pinatatakbo ang ecosystem: kahusayan sa Micro-Burn, naibentang kaalaman, ambag ng nomad."
  ),
  "Rev34.uRankings.filterAll": L(
    "All modules", "전체 모듈", "Kõik moodulid", "すべてのモジュール", "全部模块", "Todos los módulos", "ម៉ូឌុលទាំងអស់", "Tous les modules", "Alle Module", "Todos os módulos", "Tất cả mô-đun", "Semua modul", "Все модули", "सभी मॉड्यूल", "Tutti i moduli", "Tüm modüller", "ทุกโมดูล", "Wszystkie moduły", "Alle modules", "Lahat ng module"
  ),
  "Rev34.uRankings.seedNote": L(
    "Simulated daily ladder · pseudonymous handles · not real personal data",
    "시뮬레이션 일간 순위 · 가명 핸들 · 실제 개인정보 아님",
    "Simuleeritud päevane edetabel · pseudonüümsed nimed · mitte päris isikuandmed",
    "シミュレーションによる日次順位 · 仮名ハンドル · 実在の個人データではありません",
    "模拟每日榜单 · 化名账号 · 非真实个人数据",
    "Escalera diaria simulada · alias seudónimos · no son datos personales reales",
    "តារាងប្រចាំថ្ងៃក្លែងធ្វើ · ឈ្មោះក្លែងក្លាយ · មិនមែនទិន្នន័យផ្ទាល់ខ្លួនពិត",
    "Classement quotidien simulé · pseudonymes · pas de données personnelles réelles",
    "Simulierte Tagesrangliste · pseudonyme Handles · keine echten personenbezogenen Daten",
    "Escada diária simulada · pseudónimos · não são dados pessoais reais",
    "Bảng xếp hạng ngày mô phỏng · biệt danh ẩn danh · không phải dữ liệu cá nhân thật",
    "Tangga harian simulasi · nama samaran · bukan data pribadi asli",
    "Смоделированный дневной рейтинг · псевдонимы · не реальные персональные данные",
    "सिम्युलेटेड दैनिक सूची · छद्म नाम · वास्तविक व्यक्तिगत डेटा नहीं",
    "Classifica giornaliera simulata · handle pseudonimi · non sono dati personali reali",
    "Simüle edilmiş günlük sıralama · takma adlar · gerçek kişisel veri değildir",
    "ตารางอันดับรายวันจำลอง · ชื่อแฝง · ไม่ใช่ข้อมูลส่วนบุคคลจริง",
    "Symulowana dzienna drabinka · pseudonimy · to nie są prawdziwe dane osobowe",
    "Gesimuleerde dagelijkse ladder · pseudoniemen · geen echte persoonsgegevens",
    "Simulated na pang-araw-araw na ranggo · pseudonymous na handle · hindi tunay na personal na datos"
  ),
  "Rev34.uRankings.openAria": L(
    "Open the profile of {name}", "{name} 프로필 열기", "Ava {name} profiil", "{name} のプロフィールを開く", "打开 {name} 的资料", "Abrir el perfil de {name}", "បើកប្រវត្តិរូបរបស់ {name}", "Ouvrir le profil de {name}", "Profil von {name} öffnen", "Abrir o perfil de {name}", "Mở hồ sơ của {name}", "Buka profil {name}", "Открыть профиль {name}", "{name} की प्रोफ़ाइल खोलें", "Apri il profilo di {name}", "{name} profilini aç", "เปิดโปรไฟล์ของ {name}", "Otwórz profil {name}", "Profiel van {name} openen", "Buksan ang profile ni {name}"
  ),
  "Rev34.uRankings.rankAria": L(
    "#{rank}", "{rank}위", "#{rank}", "{rank}位", "第{rank}名", "N.º {rank}", "លេខ {rank}", "N° {rank}", "Platz {rank}", "N.º {rank}", "Hạng {rank}", "Peringkat {rank}", "№ {rank}", "#{rank}", "N. {rank}", "{rank}. sıra", "อันดับ {rank}", "Miejsce {rank}", "Nr. {rank}", "#{rank}"
  ),
  "Rev34.uRankings.metrics.microBurn": L(
    "Micro-Burn efficiency", "마이크로-버른 효율", "Micro-Burn tõhusus", "マイクロバーン効率", "微燃效率", "Eficiencia Micro-Burn", "ប្រសិទ្ធភាព Micro-Burn", "Efficacité Micro-Burn", "Micro-Burn-Effizienz", "Eficiência Micro-Burn", "Hiệu suất Micro-Burn", "Efisiensi Micro-Burn", "Эффективность Micro-Burn", "माइक्रो-बर्न दक्षता", "Efficienza Micro-Burn", "Micro-Burn verimliliği", "ประสิทธิภาพ Micro-Burn", "Efektywność Micro-Burn", "Micro-Burn-efficiëntie", "Kahusayan sa Micro-Burn"
  ),
  "Rev34.uRankings.metrics.knowledgeSales": L(
    "Knowledge sales", "지식 판매", "Teadmiste müük", "知識販売", "知识销售", "Ventas de conocimiento", "ការលក់ចំណេះដឹង", "Ventes de savoir", "Wissensverkäufe", "Vendas de conhecimento", "Tri thức đã bán", "Penjualan pengetahuan", "Продажи знаний", "ज्ञान बिक्री", "Vendite di conoscenza", "Bilgi satışları", "ยอดขายความรู้", "Sprzedaż wiedzy", "Kennisverkopen", "Benta ng kaalaman"
  ),
  "Rev34.uRankings.metrics.nomad": L(
    "Nomad contribution", "노마드 기여도", "Nomaadipanus", "ノマド貢献度", "游牧贡献", "Aporte nómada", "ការចូលរួមណូម៉ាដ", "Contribution nomade", "Nomaden-Beitrag", "Contribuição nómada", "Đóng góp du mục", "Kontribusi nomaden", "Вклад номада", "नोमैड योगदान", "Contributo nomade", "Göçebe katkısı", "การมีส่วนร่วมแบบโนแมด", "Wkład nomady", "Nomadenbijdrage", "Ambag ng nomad"
  ),
  "Rev34.uRankings.metrics.sovereign": L(
    "Sovereign index", "소버린 지수", "Suveräänsusindeks", "ソブリン指数", "主权指数", "Índice soberano", "សន្ទស្សន៍អធិបតេយ្យ", "Indice souverain", "Sovereign-Index", "Índice soberano", "Chỉ số tự chủ", "Indeks berdaulat", "Суверенный индекс", "संप्रभु सूचकांक", "Indice sovrano", "Egemenlik endeksi", "ดัชนีอธิปไตย", "Indeks suwerenności", "Soevereine index", "Sovereign index"
  ),
  "Rev34.uRankings.tier.sovereign": L(
    "Sovereign", "소버린", "Suverään", "ソブリン", "主权", "Soberano", "អធិបតេយ្យ", "Souverain", "Souverän", "Soberano", "Tự chủ", "Berdaulat", "Суверен", "संप्रभु", "Sovrano", "Egemen", "อธิปไตย", "Suweren", "Soeverein", "Soberano"
  ),
  "Rev34.uRankings.tier.platinum": L(
    "Platinum", "플래티넘", "Plaatina", "プラチナ", "白金", "Platino", "ផ្លាទីន", "Platine", "Platin", "Platina", "Bạch kim", "Platinum", "Платина", "प्लैटिनम", "Platino", "Platin", "แพลทินัม", "Platyna", "Platina", "Platinum"
  ),
  "Rev34.uRankings.tier.gold": L(
    "Gold", "골드", "Kuld", "ゴールド", "黄金", "Oro", "មាស", "Or", "Gold", "Ouro", "Vàng", "Emas", "Золото", "स्वर्ण", "Oro", "Altın", "ทอง", "Złoto", "Goud", "Ginto"
  ),
  "Rev34.uRankings.modalLede": L(
    "How this operator earns the rank: Micro-Burn efficiency weighs 40 %, knowledge sold 30 % and nomad contribution 30 % of the sovereign index. The ladder reseeds every UTC day.",
    "이 오퍼레이터의 순위 산출 방식: 소버린 지수는 마이크로-버른 효율 40 %, 지식 판매 30 %, 노마드 기여도 30 %로 구성됩니다. 순위표는 UTC 기준 매일 새로 생성됩니다.",
    "Kuidas see operaator oma koha teenib: suveräänsusindeksist moodustab Micro-Burn tõhusus 40 %, müüdud teadmised 30 % ja nomaadipanus 30 %. Edetabel uueneb iga UTC päev.",
    "このオペレーターの順位の根拠：ソブリン指数はマイクロバーン効率 40 %、知識販売 30 %、ノマド貢献度 30 % で構成されます。順位表は UTC の日付ごとに再生成されます。",
    "该运营者的排名依据：主权指数由微燃效率 40 %、知识销售 30 %、游牧贡献 30 % 构成。榜单每个 UTC 日重新生成。",
    "Cómo gana el puesto este operador: la eficiencia Micro-Burn pesa un 40 %, el conocimiento vendido un 30 % y el aporte nómada un 30 % del índice soberano. La escalera se regenera cada día UTC.",
    "របៀបដែលប្រតិបត្តិករនេះទទួលបានចំណាត់ថ្នាក់៖ ប្រសិទ្ធភាព Micro-Burn ស្មើ 40 % ចំណេះដឹងដែលបានលក់ 30 % និងការចូលរួមណូម៉ាដ 30 % នៃសន្ទស្សន៍អធិបតេយ្យ។ តារាងបង្កើតឡើងវិញរៀងរាល់ថ្ងៃ UTC។",
    "Comment cet opérateur gagne son rang : l'efficacité Micro-Burn pèse 40 %, le savoir vendu 30 % et la contribution nomade 30 % de l'indice souverain. Le classement se régénère chaque jour UTC.",
    "So verdient sich dieser Operator den Rang: Micro-Burn-Effizienz wiegt 40 %, verkauftes Wissen 30 % und der Nomaden-Beitrag 30 % des Sovereign-Index. Die Rangliste wird jeden UTC-Tag neu erzeugt.",
    "Como este operador conquista a posição: a eficiência Micro-Burn pesa 40 %, o conhecimento vendido 30 % e a contribuição nómada 30 % do índice soberano. A escada regenera-se a cada dia UTC.",
    "Cách nhà vận hành này giành thứ hạng: hiệu suất Micro-Burn chiếm 40 %, tri thức đã bán 30 % và đóng góp du mục 30 % của chỉ số tự chủ. Bảng xếp hạng được tạo lại mỗi ngày UTC.",
    "Cara operator ini meraih peringkat: efisiensi Micro-Burn berbobot 40 %, pengetahuan terjual 30 %, dan kontribusi nomaden 30 % dari indeks berdaulat. Tangga dibuat ulang setiap hari UTC.",
    "Как этот оператор получает место: эффективность Micro-Burn весит 40 %, проданные знания 30 % и вклад номада 30 % суверенного индекса. Рейтинг пересоздаётся каждые сутки UTC.",
    "यह ऑपरेटर अपनी रैंक कैसे पाता है: संप्रभु सूचकांक में माइक्रो-बर्न दक्षता 40 %, बेचा गया ज्ञान 30 % और नोमैड योगदान 30 % का भार रखता है। सूची हर UTC दिन फिर से बनती है।",
    "Come questo operatore guadagna la posizione: l'efficienza Micro-Burn pesa il 40 %, la conoscenza venduta il 30 % e il contributo nomade il 30 % dell'indice sovrano. La classifica si rigenera ogni giorno UTC.",
    "Bu operatör sırasını nasıl kazanıyor: egemenlik endeksinde Micro-Burn verimliliği % 40, satılan bilgi % 30 ve göçebe katkısı % 30 ağırlığındadır. Sıralama her UTC günü yeniden oluşturulur.",
    "ผู้ปฏิบัติการนี้ได้อันดับอย่างไร: ประสิทธิภาพ Micro-Burn มีน้ำหนัก 40 % ความรู้ที่ขายได้ 30 % และการมีส่วนร่วมแบบโนแมด 30 % ของดัชนีอธิปไตย ตารางอันดับสร้างใหม่ทุกวัน UTC",
    "Jak ten operator zdobywa miejsce: efektywność Micro-Burn waży 40 %, sprzedana wiedza 30 %, a wkład nomady 30 % indeksu suwerenności. Drabinka odradza się każdego dnia UTC.",
    "Hoe deze operator de plek verdient: Micro-Burn-efficiëntie weegt 40 %, verkochte kennis 30 % en de nomadenbijdrage 30 % van de soevereine index. De ladder wordt elke UTC-dag opnieuw opgebouwd.",
    "Paano nakukuha ng operator na ito ang ranggo: 40 % ang timbang ng kahusayan sa Micro-Burn, 30 % ang naibentang kaalaman at 30 % ang ambag ng nomad sa sovereign index. Muling nabubuo ang ranggo bawat araw na UTC."
  ),
  "Rev34.uRankings.moduleLabel": L(
    "Module", "모듈", "Moodul", "モジュール", "模块", "Módulo", "ម៉ូឌុល", "Module", "Modul", "Módulo", "Mô-đun", "Modul", "Модуль", "मॉड्यूल", "Modulo", "Modül", "โมดูล", "Moduł", "Module", "Module"
  ),
  "Rev34.uRankings.rankLabel": L(
    "Rank", "순위", "Koht", "順位", "排名", "Puesto", "ចំណាត់ថ្នាក់", "Rang", "Rang", "Posição", "Thứ hạng", "Peringkat", "Место", "रैंक", "Posizione", "Sıra", "อันดับ", "Miejsce", "Rang", "Ranggo"
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
      throw new Error(`apply-rev34-uranking-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (setDeep(data, dotted, value)) set += 1;
  }

  // Fail closed: nothing placeholder-shaped went into THIS lane's sub-namespace.
  const own = JSON.stringify(data.Rev34?.uRankings ?? {});
  if (own.includes('[MISSING')) throw new Error(`apply-rev34-uranking-i18n: ${locale}: a placeholder survived in Rev34.uRankings`);

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev34-uranking-i18n: clean' : `apply-rev34-uranking-i18n: ${totalChanges} locale file(s) would change`);
  process.exit(totalChanges === 0 ? 0 : 1);
}
console.log(`apply-rev34-uranking-i18n: ${totalChanges} locale file(s) written`);
