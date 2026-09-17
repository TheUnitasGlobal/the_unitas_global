/**
 * REV-41 i18n applicator (SPEC §2 D-9, §4, lane D) -- the FX compass, the
 * Around-Me omni-radar and the auto-rotating sub-theme chips.
 *
 * Idempotent, all 20 locales at once, a REAL translation per locale -- never a
 * placeholder. Two operations, both fail-closed:
 *
 *  SET    deep-merges every key in SPEC §4:
 *           - two `Rev20.slots.*.tag` VALUE replacements (REV-41 D-6 / D-9):
 *             `newProducts.tag` stops enumerating the 16 families and becomes
 *             one philosophical line; `nearby.tag` stops promising "10km" now
 *             that the radius is a user toggle. Only the values move -- the
 *             `Rev20` key set stays at rev20Parity's fixed 76.
 *           - the whole new `Rev41` namespace: `fx.*` (D-3 FxCompassHero:
 *             hero label, per-unit ICU line, 24h/30d deltas, board/parity/
 *             dollar-index headings, PAXG gold proxy, unreadable state, fact
 *             labels, source line), `nearby.*` (D-5 OmniRadar: radius chips,
 *             aria strings, fact labels, the four lens names, the 16-hub
 *             constellation, empty/unreadable states, the 0%-error claim) and
 *             `tabs.*` (D-6 SlotTabRail: rotating / held tooltips).
 *
 *  DELETE removes the root namespace `Rev35`. Its only reader was the
 *         `uRanking` branch of DiscoveryCarousel, which REV-41 D-7 retires
 *         together with the slot itself, so the one orphaned string would
 *         otherwise ship in every locale forever. The retired-namespace guard
 *         (`GlobalRankings`, `UnitasRankings`, now `Rev35`) moves from
 *         rev35Parity to __tests__/i18n/rev41Parity.test.ts.
 *
 * ICU tokens (`{base} {value} {quote}`, `{center} {radius}`) are asserted
 * per locale against en before anything is written; a lost token is a
 * runtime "undefined" in a real visitor's language, so it fails closed here.
 *
 * Run: node scripts/apply-rev41-i18n.mjs [--check]   (--check exits 1 on drift)
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
  if (v.length !== LOCALES.length) throw new Error(`apply-rev41-i18n: L() expects ${LOCALES.length} strings, got ${v.length}`);
  return Object.fromEntries(LOCALES.map((l, i) => [l, v[i]]));
};

/**
 * Proper nouns that stay verbatim in every locale: UNITAS, Micro-Burn, PAXG,
 * ECB, DXY, Frankfurter, CoinGecko, GeoJS. The three radius chips and the
 * source line are the only keys allowed to be byte-identical to en
 * (rev41Parity IDENTICAL_ALLOWED); `fx.perUnit` is a pure ICU formula that
 * reads the same in every script and deliberately spends one slot of the
 * parity test's 8% ceiling instead of a waiver.
 */
const SET = {
  // -- REV-41 D-6: one philosophical line instead of the 16-family roll call.
  'Rev20.slots.newProducts.tag': L(
    'A multidimensional nexus of hyper-innovative hardware and quantum devices that pull the future closer',
    '미래를 앞당기는 초혁신적 하드웨어와 퀀텀 디바이스의 다차원 넥서스',
    'Mitmemõõtmeline nexus hüperinnovaatilisest riistvarast ja kvantseadmetest, mis toovad tuleviku lähemale',
    '未来を引き寄せる超革新的ハードウェアと量子デバイスの多次元ネクサス',
    '把未来拉近的超创新硬件与量子设备的多维枢纽',
    'Un nexo multidimensional de hardware hiperinnovador y dispositivos cuánticos que acercan el futuro',
    'ចំណុចប្រសព្វពហុវិមាត្រនៃផ្នែករឹងច្នៃប្រឌិតខ្ពស់ និងឧបករណ៍កង់ទិចដែលនាំអនាគតមកជិត',
    "Un nexus multidimensionnel de matériel hyper-innovant et d'appareils quantiques qui rapprochent le futur",
    'Ein multidimensionaler Nexus aus hyperinnovativer Hardware und Quantengeräten, die die Zukunft näher rücken',
    'Um nexo multidimensional de hardware hiperinovador e dispositivos quânticos que aproximam o futuro',
    'Nexus đa chiều của phần cứng siêu đột phá và thiết bị lượng tử kéo tương lai đến gần hơn',
    'Neksus multidimensi dari perangkat keras hiperinovatif dan perangkat kuantum yang mendekatkan masa depan',
    'Многомерный нексус гиперинновационного железа и квантовых устройств, приближающих будущее',
    'भविष्य को करीब लाने वाले अति-नवोन्मेषी हार्डवेयर और क्वांटम डिवाइसों का बहुआयामी नेक्सस',
    'Un nexus multidimensionale di hardware iperinnovativo e dispositivi quantistici che avvicinano il futuro',
    'Geleceği yakınlaştıran hiper-yenilikçi donanım ve kuantum cihazlarının çok boyutlu neksusu',
    'เน็กซัสหลายมิติของฮาร์ดแวร์สุดล้ำและอุปกรณ์ควอนตัมที่ดึงอนาคตให้ใกล้เข้ามา',
    'Wielowymiarowy nexus hiperinnowacyjnego sprzętu i urządzeń kwantowych, które przybliżają przyszłość',
    'Een multidimensionale nexus van hyperinnovatieve hardware en quantumapparaten die de toekomst dichterbij brengen',
    'Isang multidimensional na nexus ng hyper-innovative na hardware at quantum device na naglalapit ng hinaharap',
  ),
  // -- REV-41 D-9: the radius is a toggle now, so the tag stops saying "10km".
  'Rev20.slots.nearby.tag': L(
    'A sovereign omni-radar revolving around you',
    '당신을 중심으로 회전하는 소버린 옴니-레이더',
    'Sinu ümber pöörlev suveräänne omni-radar',
    'あなたを中心に回転するソブリン・オムニレーダー',
    '以你为中心旋转的主权全向雷达',
    'Un omni-radar soberano que gira a tu alrededor',
    'អូមនី-រ៉ាដាអធិបតេយ្យដែលវិលជុំវិញអ្នក',
    'Un omni-radar souverain qui tourne autour de vous',
    'Ein souveränes Omni-Radar, das um dich kreist',
    'Um omni-radar soberano que gira à sua volta',
    'Omni-radar chủ quyền xoay quanh bạn',
    'Omni-radar berdaulat yang berputar di sekitar Anda',
    'Суверенный омни-радар, вращающийся вокруг вас',
    'आपके चारों ओर घूमता संप्रभु ऑम्नी-रडार',
    'Un omni-radar sovrano che ruota intorno a te',
    'Etrafınızda dönen egemen bir omni-radar',
    'ออมนิเรดาร์อธิปไตยที่หมุนรอบตัวคุณ',
    'Suwerenny omni-radar obracający się wokół Ciebie',
    'Een soevereine omni-radar die om jou draait',
    'Isang soberanong omni-radar na umiikot sa paligid mo',
  ),

  // ---------------------------------------------------------------- fx (D-3)
  'Rev41.fx.homeLabel': L(
    'Your local currency', '접속 통화', 'Sinu kohalik valuuta', '接続地の通貨', '接入地货币',
    'Tu moneda local', 'រូបិយប័ណ្ណក្នុងតំបន់របស់អ្នក', 'Votre devise locale', 'Deine Landeswährung', 'A sua moeda local',
    'Tiền tệ nơi bạn truy cập', 'Mata uang lokal Anda', 'Ваша местная валюта', 'आपकी स्थानीय मुद्रा', 'La tua valuta locale',
    'Yerel para biriminiz', 'สกุลเงินท้องถิ่นของคุณ', 'Twoja lokalna waluta', 'Je lokale valuta', 'Iyong lokal na pera',
  ),
  'Rev41.fx.perUnit': L(
    '1 {base} = {value} {quote}', '1 {base} = {value} {quote}', '1 {base} = {value} {quote}', '1 {base} = {value} {quote}', '1 {base} = {value} {quote}',
    '1 {base} = {value} {quote}', '1 {base} = {value} {quote}', '1 {base} = {value} {quote}', '1 {base} = {value} {quote}', '1 {base} = {value} {quote}',
    '1 {base} = {value} {quote}', '1 {base} = {value} {quote}', '1 {base} = {value} {quote}', '1 {base} = {value} {quote}', '1 {base} = {value} {quote}',
    '1 {base} = {value} {quote}', '1 {base} = {value} {quote}', '1 {base} = {value} {quote}', '1 {base} = {value} {quote}', '1 {base} = {value} {quote}',
  ),
  'Rev41.fx.change24h': L(
    'vs. yesterday', '전일 대비', 'vs eile', '前日比', '较前一日',
    'vs. ayer', 'ធៀបនឹងម្សិលមិញ', 'vs hier', 'ggü. Vortag', 'vs. ontem',
    'so với hôm qua', 'vs. kemarin', 'к вчера', 'कल की तुलना में', 'vs. ieri',
    'düne göre', 'เทียบกับเมื่อวาน', 'vs. wczoraj', 't.o.v. gisteren', 'vs. kahapon',
  ),
  'Rev41.fx.change30d': L(
    'vs. 30 days ago', '30일 대비', 'vs 30 päeva tagasi', '30日前比', '较30天前',
    'vs. hace 30 días', 'ធៀបនឹង ៣០ ថ្ងៃមុន', 'vs il y a 30 jours', 'ggü. vor 30 Tagen', 'vs. há 30 dias',
    'so với 30 ngày trước', 'vs. 30 hari lalu', 'к уровню 30 дней назад', '30 दिन पहले की तुलना में', 'vs. 30 giorni fa',
    '30 gün öncesine göre', 'เทียบกับ 30 วันก่อน', 'vs. 30 dni temu', 't.o.v. 30 dagen geleden', 'vs. 30 araw ang nakalipas',
  ),
  'Rev41.fx.sparkAria': L(
    '{quote} 30-day trend', '{quote} 30일 추이', '{quote} 30 päeva trend', '{quote} の30日間推移', '{quote} 30天走势',
    'Tendencia de 30 días de {quote}', 'និន្នាការ ៣០ ថ្ងៃរបស់ {quote}', 'Tendance sur 30 jours de {quote}', '30-Tage-Trend von {quote}', 'Tendência de 30 dias de {quote}',
    'Xu hướng 30 ngày của {quote}', 'Tren 30 hari {quote}', 'Динамика {quote} за 30 дней', '{quote} का 30-दिवसीय रुझान', 'Andamento a 30 giorni di {quote}',
    '{quote} 30 günlük eğilim', 'แนวโน้ม 30 วันของ {quote}', 'Trend 30-dniowy {quote}', '30-dagentrend van {quote}', '30-araw na trend ng {quote}',
  ),
  'Rev41.fx.majors': L(
    'Global macro board', '글로벌 매크로 보드', 'Globaalne makrotahvel', 'グローバル・マクロボード', '全球宏观看板',
    'Panel macro global', 'ផ្ទាំងម៉ាក្រូសកល', 'Tableau macro mondial', 'Globales Makro-Board', 'Painel macro global',
    'Bảng vĩ mô toàn cầu', 'Papan makro global', 'Глобальная макропанель', 'वैश्विक मैक्रो बोर्ड', 'Quadro macro globale',
    'Küresel makro panosu', 'กระดานมหภาคโลก', 'Globalna tablica makro', 'Globaal macrobord', 'Pandaigdigang macro board',
  ),
  'Rev41.fx.parity': L(
    'Crypto parity', '크립토 패리티', 'Krüptopariteet', 'クリプト・パリティ', '加密货币平价',
    'Paridad cripto', 'ភាពស្មើគ្នាគ្រីបតូ', 'Parité crypto', 'Krypto-Parität', 'Paridade cripto',
    'Ngang giá crypto', 'Paritas kripto', 'Криптопаритет', 'क्रिप्टो समता', 'Parità crypto',
    'Kripto paritesi', 'พาริตี้คริปโต', 'Parytet krypto', 'Cryptopariteit', 'Paridad ng crypto',
  ),
  'Rev41.fx.dollarIndex': L(
    'Dollar strength index', '달러 강도 지수', 'Dollari tugevuse indeks', 'ドル強度指数', '美元强度指数',
    'Índice de fortaleza del dólar', 'សន្ទស្សន៍កម្លាំងដុល្លារ', 'Indice de force du dollar', 'Dollar-Stärkeindex', 'Índice de força do dólar',
    'Chỉ số sức mạnh đồng đô la', 'Indeks kekuatan dolar', 'Индекс силы доллара', 'डॉलर मजबूती सूचकांक', 'Indice di forza del dollaro',
    'Dolar gücü endeksi', 'ดัชนีความแข็งแกร่งของดอลลาร์', 'Indeks siły dolara', 'Dollarsterkte-index', 'Indeks ng lakas ng dolyar',
  ),
  'Rev41.fx.dollarIndexNote': L(
    'DXY-weighted approximation from 6 ECB reference currencies · 30 days ago = 100',
    'ECB 기준환율 6통화 DXY 가중 근사 · 30일 전 = 100',
    'DXY-kaalutud lähend ECB 6 viitekursist · 30 päeva tagasi = 100',
    'ECB 基準レート6通貨の DXY 加重近似 · 30日前 = 100',
    '基于 ECB 参考汇率 6 种货币的 DXY 加权近似 · 30天前 = 100',
    'Aproximación ponderada DXY de 6 divisas de referencia del ECB · hace 30 días = 100',
    'ការប៉ាន់ស្មានថ្លឹងតាម DXY ពីរូបិយប័ណ្ណយោង ECB ចំនួន ៦ · ៣០ ថ្ងៃមុន = 100',
    'Approximation pondérée DXY sur 6 devises de référence ECB · il y a 30 jours = 100',
    'DXY-gewichtete Näherung aus 6 ECB-Referenzwährungen · vor 30 Tagen = 100',
    'Aproximação ponderada DXY de 6 moedas de referência do ECB · há 30 dias = 100',
    'Xấp xỉ theo trọng số DXY từ 6 tiền tệ tham chiếu ECB · 30 ngày trước = 100',
    'Aproksimasi berbobot DXY dari 6 mata uang acuan ECB · 30 hari lalu = 100',
    'Приближение с весами DXY по 6 справочным валютам ECB · 30 дней назад = 100',
    'ECB की 6 संदर्भ मुद्राओं से DXY-भारित अनुमान · 30 दिन पहले = 100',
    'Approssimazione ponderata DXY su 6 valute di riferimento ECB · 30 giorni fa = 100',
    '6 ECB referans para biriminden DXY ağırlıklı yaklaşım · 30 gün önce = 100',
    'ค่าประมาณถ่วงน้ำหนัก DXY จาก 6 สกุลเงินอ้างอิง ECB · 30 วันก่อน = 100',
    'Przybliżenie ważone DXY z 6 walut referencyjnych ECB · 30 dni temu = 100',
    "DXY-gewogen benadering uit 6 ECB-referentievaluta's · 30 dagen geleden = 100",
    'DXY-weighted na pagtataya mula sa 6 na reference currency ng ECB · 30 araw ang nakalipas = 100',
  ),
  'Rev41.fx.gold': L(
    'Gold (PAXG)', '금 (PAXG)', 'Kuld (PAXG)', '金 (PAXG)', '黄金 (PAXG)',
    'Oro (PAXG)', 'មាស (PAXG)', 'Or (PAXG)', 'Gold (PAXG)', 'Ouro (PAXG)',
    'Vàng (PAXG)', 'Emas (PAXG)', 'Золото (PAXG)', 'सोना (PAXG)', 'Oro (PAXG)',
    'Altın (PAXG)', 'ทองคำ (PAXG)', 'Złoto (PAXG)', 'Goud (PAXG)', 'Ginto (PAXG)',
  ),
  'Rev41.fx.unreadable': L(
    "The FX signal can't be read · please try again shortly",
    '환율 신호를 읽을 수 없습니다 · 잠시 후 다시 시도해 주세요',
    'Valuutasignaali ei saa lugeda · proovi veidi hiljem uuesti',
    '為替シグナルを読み取れません · しばらくしてからもう一度お試しください',
    '无法读取汇率信号 · 请稍后再试',
    'No se puede leer la señal de divisas · inténtalo de nuevo en un momento',
    'មិនអាចអានសញ្ញាអត្រាប្តូរប្រាក់បានទេ · សូមព្យាយាមម្តងទៀតក្នុងពេលបន្តិចទៀត',
    'Impossible de lire le signal de change · réessayez dans un instant',
    'Das Wechselkurssignal kann nicht gelesen werden · bitte gleich noch einmal versuchen',
    'Não é possível ler o sinal cambial · tente novamente daqui a pouco',
    'Không thể đọc tín hiệu tỷ giá · vui lòng thử lại sau giây lát',
    'Sinyal kurs tidak dapat dibaca · coba lagi sebentar lagi',
    'Не удаётся прочитать сигнал курсов · попробуйте ещё раз чуть позже',
    'विनिमय दर संकेत पढ़ा नहीं जा सका · कृपया थोड़ी देर बाद पुनः प्रयास करें',
    'Impossibile leggere il segnale dei cambi · riprova tra poco',
    'Döviz sinyali okunamıyor · lütfen az sonra tekrar deneyin',
    'ไม่สามารถอ่านสัญญาณอัตราแลกเปลี่ยนได้ · กรุณาลองใหม่อีกครั้งในอีกสักครู่',
    'Nie można odczytać sygnału kursów · spróbuj ponownie za chwilę',
    'Het valutasignaal kan niet worden gelezen · probeer het zo opnieuw',
    'Hindi mabasa ang signal ng palitan · pakisubukang muli mamaya',
  ),
  'Rev41.fx.facts.home': L(
    'Home currency', '홈 통화', 'Koduvaluuta', 'ホーム通貨', '本币',
    'Moneda local', 'រូបិយប័ណ្ណដើម', 'Devise locale', 'Heimatwährung', 'Moeda local',
    'Tiền tệ bản địa', 'Mata uang asal', 'Домашняя валюта', 'घरेलू मुद्रा', 'Valuta locale',
    'Yerel para birimi', 'สกุลเงินหลัก', 'Waluta krajowa', 'Thuisvaluta', 'Sariling pera',
  ),
  'Rev41.fx.facts.pairs': L(
    'Currency pairs', '통화쌍', 'Valuutapaarid', '通貨ペア', '货币对',
    'Pares de divisas', 'គូរូបិយប័ណ្ណ', 'Paires de devises', 'Währungspaare', 'Pares cambiais',
    'Cặp tiền tệ', 'Pasangan mata uang', 'Валютные пары', 'मुद्रा जोड़े', 'Coppie di valute',
    'Döviz çiftleri', 'คู่สกุลเงิน', 'Pary walutowe', 'Valutaparen', 'Mga pares ng pera',
  ),
  // Proper nouns only -- byte-identical in every locale by design (SPEC §4).
  'Rev41.fx.source': L(
    'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS',
    'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS',
    'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS',
    'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS', 'Frankfurter (ECB) · CoinGecko · GeoJS',
  ),

  // ------------------------------------------------------------ nearby (D-5)
  // The three metric chips are SI unit labels and stay identical (SPEC §4);
  // `global` is a word and must be translated.
  'Rev41.nearby.radius.r10': L(
    '10km', '10km', '10km', '10km', '10km', '10km', '10km', '10km', '10km', '10km',
    '10km', '10km', '10km', '10km', '10km', '10km', '10km', '10km', '10km', '10km',
  ),
  'Rev41.nearby.radius.r50': L(
    '50km', '50km', '50km', '50km', '50km', '50km', '50km', '50km', '50km', '50km',
    '50km', '50km', '50km', '50km', '50km', '50km', '50km', '50km', '50km', '50km',
  ),
  'Rev41.nearby.radius.r100': L(
    '100km', '100km', '100km', '100km', '100km', '100km', '100km', '100km', '100km', '100km',
    '100km', '100km', '100km', '100km', '100km', '100km', '100km', '100km', '100km', '100km',
  ),
  'Rev41.nearby.radius.global': L(
    'Worldwide', '글로벌', 'Globaalne', 'グローバル', '全球',
    'Global', 'សកល', 'Mondial', 'Weltweit', 'Global',
    'Toàn cầu', 'Global', 'Весь мир', 'वैश्विक', 'Globale',
    'Küresel', 'ทั่วโลก', 'Globalnie', 'Wereldwijd', 'Pandaigdigan',
  ),
  'Rev41.nearby.radiusAria': L(
    'Detection radius', '탐지 반경', 'Tuvastusraadius', '探知半径', '探测半径',
    'Radio de detección', 'កាំស្វែងរក', 'Rayon de détection', 'Erfassungsradius', 'Raio de deteção',
    'Bán kính dò tìm', 'Radius deteksi', 'Радиус обнаружения', 'पहचान दायरा', 'Raggio di rilevamento',
    'Algılama yarıçapı', 'รัศมีตรวจจับ', 'Promień wykrywania', 'Detectiestraal', 'Radius ng pagtuklas',
  ),
  'Rev41.nearby.facts.radius': L(
    'Detection radius', '탐지 반경', 'Tuvastusraadius', '探知半径', '探测半径',
    'Radio de detección', 'កាំស្វែងរក', 'Rayon de détection', 'Erfassungsradius', 'Raio de deteção',
    'Bán kính dò tìm', 'Radius deteksi', 'Радиус обнаружения', 'पहचान दायरा', 'Raggio di rilevamento',
    'Algılama yarıçapı', 'รัศมีตรวจจับ', 'Promień wykrywania', 'Detectiestraal', 'Radius ng pagtuklas',
  ),
  'Rev41.nearby.facts.detected': L(
    'Spots detected', '탐지 스팟', 'Tuvastatud kohad', '探知スポット', '探测到的地点',
    'Puntos detectados', 'កន្លែងដែលរកឃើញ', 'Spots détectés', 'Erfasste Spots', 'Locais detetados',
    'Điểm dò được', 'Titik terdeteksi', 'Обнаружено точек', 'पहचाने गए स्पॉट', 'Spot rilevati',
    'Algılanan noktalar', 'จุดที่ตรวจพบ', 'Wykryte miejsca', 'Gedetecteerde spots', 'Mga natuklasang spot',
  ),
  'Rev41.nearby.facts.nearest': L(
    'Nearest', '최근접', 'Lähim', '最寄り', '最近',
    'Más cercano', 'ជិតបំផុត', 'Le plus proche', 'Nächstgelegen', 'Mais próximo',
    'Gần nhất', 'Terdekat', 'Ближайший', 'निकटतम', 'Più vicino',
    'En yakın', 'ใกล้ที่สุด', 'Najbliżej', 'Dichtstbij', 'Pinakamalapit',
  ),
  'Rev41.nearby.facts.beams': L(
    'Sweep beams', '스윕 빔', 'Skaneerimiskiired', 'スイープビーム', '扫描波束',
    'Haces de barrido', 'កាំរស្មីស្កេន', 'Faisceaux de balayage', 'Sweep-Strahlen', 'Feixes de varrimento',
    'Chùm quét', 'Berkas sapuan', 'Лучи развёртки', 'स्वीप बीम', 'Fasci di scansione',
    'Tarama ışınları', 'ลำแสงกวาด', 'Wiązki skanujące', 'Sweepbundels', 'Mga sweep beam',
  ),
  'Rev41.nearby.lens.nomad': L(
    'Nomad meetup spots', '노마드 밋업 스팟', 'Nomaadide kohtumispaigad', 'ノマド・ミートアップスポット', '游牧者聚会地点',
    'Puntos de encuentro nómada', 'កន្លែងជួបជុំណូម៉ាដ', 'Spots de rencontre nomade', 'Nomaden-Meetup-Spots', 'Pontos de encontro nómada',
    'Điểm gặp gỡ du mục', 'Titik temu nomaden', 'Точки встреч номадов', 'नोमैड मीटअप स्पॉट', 'Spot di incontro nomade',
    'Göçebe buluşma noktaları', 'จุดนัดพบโนแมด', 'Miejsca spotkań nomadów', 'Nomaden-meetupspots', 'Mga tagpuan ng nomad',
  ),
  'Rev41.nearby.lens.factory': L(
    'AI factory workspaces', 'AI 팩토리 워크스페이스', 'AI-tehase tööruumid', 'AI ファクトリー・ワークスペース', 'AI 工厂工作空间',
    'Espacios de trabajo de fábricas de IA', 'កន្លែងធ្វើការរោងចក្រ AI', "Espaces de travail d'usine IA", 'KI-Fabrik-Workspaces', 'Espaços de trabalho de fábrica de IA',
    'Không gian làm việc nhà máy AI', 'Ruang kerja pabrik AI', 'Рабочие пространства AI-фабрик', 'AI फ़ैक्टरी वर्कस्पेस', 'Spazi di lavoro della fabbrica IA',
    'Yapay zekâ fabrikası çalışma alanları', 'พื้นที่ทำงานโรงงาน AI', 'Przestrzenie robocze fabryk AI', 'AI-fabriekswerkplekken', 'Mga workspace ng AI factory',
  ),
  'Rev41.nearby.lens.inspiration': L(
    'Hidden inspiration spots', '영감 히든 스팟', 'Peidetud inspiratsioonipaigad', 'インスピレーションの隠れスポット', '灵感隐秘地点',
    'Rincones ocultos de inspiración', 'កន្លែងលាក់កំបាំងបំផុសគំនិត', "Spots d'inspiration cachés", 'Versteckte Inspirationsorte', 'Recantos escondidos de inspiração',
    'Điểm cảm hứng ẩn giấu', 'Titik inspirasi tersembunyi', 'Скрытые места вдохновения', 'प्रेरणा के छिपे स्पॉट', 'Spot nascosti di ispirazione',
    'Gizli ilham noktaları', 'จุดแรงบันดาลใจที่ซ่อนอยู่', 'Ukryte miejsca inspiracji', 'Verborgen inspiratieplekken', 'Mga tagong spot ng inspirasyon',
  ),
  'Rev41.nearby.lens.signal': L(
    'Signals', '시그널', 'Signaalid', 'シグナル', '信号',
    'Señales', 'សញ្ញា', 'Signaux', 'Signale', 'Sinais',
    'Tín hiệu', 'Sinyal', 'Сигналы', 'सिग्नल', 'Segnali',
    'Sinyaller', 'สัญญาณ', 'Sygnały', 'Signalen', 'Mga senyas',
  ),
  'Rev41.nearby.radarAria': L(
    'Omni-radar centered on {center} · radius {radius}',
    '{center} 중심 옴니-레이더 · 반경 {radius}',
    'Omni-radar keskmega {center} · raadius {radius}',
    '{center} を中心としたオムニレーダー · 半径 {radius}',
    '以 {center} 为中心的全向雷达 · 半径 {radius}',
    'Omni-radar centrado en {center} · radio {radius}',
    'អូមនី-រ៉ាដាដែលមានចំណុចកណ្តាលនៅ {center} · កាំ {radius}',
    'Omni-radar centré sur {center} · rayon {radius}',
    'Omni-Radar mit Zentrum {center} · Radius {radius}',
    'Omni-radar centrado em {center} · raio {radius}',
    'Omni-radar lấy {center} làm tâm · bán kính {radius}',
    'Omni-radar berpusat di {center} · radius {radius}',
    'Омни-радар с центром в {center} · радиус {radius}',
    '{center} पर केंद्रित ऑम्नी-रडार · दायरा {radius}',
    'Omni-radar centrato su {center} · raggio {radius}',
    '{center} merkezli omni-radar · yarıçap {radius}',
    'ออมนิเรดาร์ที่มี {center} เป็นศูนย์กลาง · รัศมี {radius}',
    'Omni-radar wyśrodkowany na {center} · promień {radius}',
    'Omni-radar gecentreerd op {center} · straal {radius}',
    'Omni-radar na nakasentro sa {center} · radius {radius}',
  ),
  'Rev41.nearby.center': L(
    'Center', '중심', 'Kese', '中心', '中心',
    'Centro', 'ចំណុចកណ្តាល', 'Centre', 'Zentrum', 'Centro',
    'Tâm', 'Pusat', 'Центр', 'केंद्र', 'Centro',
    'Merkez', 'ศูนย์กลาง', 'Środek', 'Centrum', 'Sentro',
  ),
  'Rev41.nearby.constellation': L(
    'UNITAS Nomad Nexus · 16 hubs', 'UNITAS 노마드 넥서스 16허브', 'UNITAS Nomad Nexus · 16 keskust', 'UNITAS ノマド・ネクサス 16ハブ', 'UNITAS 游牧枢纽 · 16 个中心',
    'Nexo Nómada UNITAS · 16 hubs', 'UNITAS Nomad Nexus · មជ្ឈមណ្ឌល ១៦', 'Nexus Nomade UNITAS · 16 hubs', 'UNITAS Nomaden-Nexus · 16 Hubs', 'Nexo Nómada UNITAS · 16 hubs',
    'Nexus Du mục UNITAS · 16 trung tâm', 'Neksus Nomaden UNITAS · 16 hub', 'Нексус номадов UNITAS · 16 хабов', 'UNITAS नोमैड नेक्सस · 16 हब', 'Nexus Nomade UNITAS · 16 hub',
    'UNITAS Göçebe Neksusu · 16 merkez', 'UNITAS โนแมดเน็กซัส · 16 ฮับ', 'Nexus Nomadów UNITAS · 16 hubów', 'UNITAS Nomaden-Nexus · 16 hubs', 'UNITAS Nomad Nexus · 16 na hub',
  ),
  'Rev41.nearby.constellationNote': L(
    '16 sovereign digital-nomad hubs worldwide · measured distance from you',
    '전 세계 소버린 디지털 노마드 허브 16곳 · 당신으로부터의 실측 거리',
    '16 suveräänset digitaalnomaadide keskust üle maailma · mõõdetud kaugus sinust',
    '世界のソブリン・デジタルノマド拠点16か所 · あなたからの実測距離',
    '全球 16 个主权数字游牧枢纽 · 与你的实测距离',
    '16 hubs soberanos de nómadas digitales en el mundo · distancia medida desde ti',
    'មជ្ឈមណ្ឌលណូម៉ាដឌីជីថលអធិបតេយ្យ ១៦ កន្លែងទូទាំងពិភពលោក · ចម្ងាយវាស់វែងពីអ្នក',
    '16 hubs souverains de nomades numériques dans le monde · distance mesurée depuis vous',
    '16 souveräne Digital-Nomaden-Hubs weltweit · gemessene Entfernung von dir',
    '16 hubs soberanos de nómadas digitais no mundo · distância medida a partir de si',
    '16 trung tâm du mục số chủ quyền trên toàn cầu · khoảng cách đo thực từ bạn',
    '16 hub nomaden digital berdaulat di seluruh dunia · jarak terukur dari Anda',
    '16 суверенных хабов цифровых номадов по всему миру · измеренное расстояние от вас',
    'दुनिया भर में 16 संप्रभु डिजिटल नोमैड हब · आपसे मापी गई दूरी',
    '16 hub sovrani di nomadi digitali nel mondo · distanza misurata da te',
    'Dünya genelinde 16 egemen dijital göçebe merkezi · sizden ölçülen mesafe',
    '16 ฮับดิจิทัลโนแมดอธิปไตยทั่วโลก · ระยะทางที่วัดจริงจากคุณ',
    '16 suwerennych hubów cyfrowych nomadów na świecie · zmierzona odległość od Ciebie',
    '16 soevereine digital-nomad-hubs wereldwijd · gemeten afstand vanaf jou',
    '16 na soberanong digital-nomad hub sa buong mundo · sinukat na distansya mula sa iyo',
  ),
  'Rev41.nearby.empty': L(
    'No spots detected within this radius',
    '이 반경에서 탐지된 스팟이 없습니다',
    'Selles raadiuses ei tuvastatud ühtegi kohta',
    'この半径内で探知されたスポットはありません',
    '此半径内未探测到地点',
    'No se detectaron puntos en este radio',
    'រកមិនឃើញកន្លែងណាមួយក្នុងកាំនេះទេ',
    'Aucun spot détecté dans ce rayon',
    'In diesem Radius wurden keine Spots erfasst',
    'Nenhum local detetado neste raio',
    'Không dò được điểm nào trong bán kính này',
    'Tidak ada titik terdeteksi dalam radius ini',
    'В этом радиусе точек не обнаружено',
    'इस दायरे में कोई स्पॉट नहीं मिला',
    'Nessuno spot rilevato in questo raggio',
    'Bu yarıçapta algılanan nokta yok',
    'ไม่พบจุดใดในรัศมีนี้',
    'Nie wykryto miejsc w tym promieniu',
    'Geen spots gedetecteerd binnen deze straal',
    'Walang natuklasang spot sa loob ng radius na ito',
  ),
  'Rev41.nearby.unreadable': L(
    "The radar signal can't be read · please try again shortly",
    '레이더 신호를 읽을 수 없습니다 · 잠시 후 다시 시도해 주세요',
    'Radarisignaali ei saa lugeda · proovi veidi hiljem uuesti',
    'レーダー信号を読み取れません · しばらくしてからもう一度お試しください',
    '无法读取雷达信号 · 请稍后再试',
    'No se puede leer la señal del radar · inténtalo de nuevo en un momento',
    'មិនអាចអានសញ្ញារ៉ាដាបានទេ · សូមព្យាយាមម្តងទៀតក្នុងពេលបន្តិចទៀត',
    'Impossible de lire le signal radar · réessayez dans un instant',
    'Das Radarsignal kann nicht gelesen werden · bitte gleich noch einmal versuchen',
    'Não é possível ler o sinal do radar · tente novamente daqui a pouco',
    'Không thể đọc tín hiệu radar · vui lòng thử lại sau giây lát',
    'Sinyal radar tidak dapat dibaca · coba lagi sebentar lagi',
    'Не удаётся прочитать сигнал радара · попробуйте ещё раз чуть позже',
    'रडार संकेत पढ़ा नहीं जा सका · कृपया थोड़ी देर बाद पुनः प्रयास करें',
    'Impossibile leggere il segnale radar · riprova tra poco',
    'Radar sinyali okunamıyor · lütfen az sonra tekrar deneyin',
    'ไม่สามารถอ่านสัญญาณเรดาร์ได้ · กรุณาลองใหม่อีกครั้งในอีกสักครู่',
    'Nie można odczytać sygnału radaru · spróbuj ponownie za chwilę',
    'Het radarsignaal kan niet worden gelezen · probeer het zo opnieuw',
    'Hindi mabasa ang signal ng radar · pakisubukang muli mamaya',
  ),
  'Rev41.nearby.exact': L(
    'Measured distance · 0% radius error', '실측 거리 · 반경 오차 0%', 'Mõõdetud kaugus · raadiuse viga 0%', '実測距離 · 半径誤差 0%', '实测距离 · 半径误差 0%',
    'Distancia medida · 0% de error de radio', 'ចម្ងាយវាស់វែង · កំហុសកាំ 0%', "Distance mesurée · 0 % d'erreur de rayon", 'Gemessene Entfernung · 0 % Radiusabweichung', 'Distância medida · 0% de erro de raio',
    'Khoảng cách đo thực · sai số bán kính 0%', 'Jarak terukur · kesalahan radius 0%', 'Измеренное расстояние · погрешность радиуса 0%', 'मापी गई दूरी · दायरे में 0% त्रुटि', 'Distanza misurata · errore di raggio 0%',
    'Ölçülen mesafe · %0 yarıçap hatası', 'ระยะทางที่วัดจริง · ความคลาดเคลื่อนรัศมี 0%', 'Zmierzona odległość · błąd promienia 0%', 'Gemeten afstand · 0% straalafwijking', 'Sinukat na distansya · 0% error sa radius',
  ),

  // -------------------------------------------------------------- tabs (D-6)
  'Rev41.tabs.rotating': L(
    'Sub-themes rotate automatically · press to hold',
    '서브 테마 자동 회전 · 누르면 고정됩니다',
    'Alateemad vahetuvad automaatselt · vajuta, et kinnitada',
    'サブテーマは自動で回転します · 押すと固定されます',
    '子主题自动轮换 · 点按即可固定',
    'Los subtemas rotan automáticamente · pulsa para fijar',
    'ប្រធានបទរងបង្វិលដោយស្វ័យប្រវត្តិ · ចុចដើម្បីរក្សាទុក',
    'Les sous-thèmes tournent automatiquement · appuyez pour figer',
    'Unterthemen rotieren automatisch · antippen zum Fixieren',
    'Os subtemas rodam automaticamente · toque para fixar',
    'Chủ đề phụ tự động xoay · nhấn để giữ cố định',
    'Subtema berputar otomatis · tekan untuk menahan',
    'Подтемы сменяются автоматически · нажмите, чтобы закрепить',
    'उप-थीम अपने आप घूमती हैं · रोकने के लिए दबाएँ',
    'I sottotemi ruotano automaticamente · premi per bloccare',
    'Alt temalar otomatik döner · sabitlemek için dokunun',
    'ธีมย่อยหมุนอัตโนมัติ · กดเพื่อตรึง',
    'Podtematy zmieniają się automatycznie · naciśnij, aby przytrzymać',
    "Subthema's roteren automatisch · druk om vast te zetten",
    'Awtomatikong umiikot ang mga sub-theme · pindutin para i-hold',
  ),
  'Rev41.tabs.held': L(
    'Held · press again to resume rotation',
    '고정됨 · 다시 누르면 회전합니다',
    'Kinnitatud · vajuta uuesti, et pöörlemist jätkata',
    '固定中 · もう一度押すと回転を再開します',
    '已固定 · 再次点按恢复轮换',
    'Fijado · pulsa de nuevo para reanudar la rotación',
    'បានរក្សាទុក · ចុចម្តងទៀតដើម្បីបង្វិលបន្ត',
    'Figé · appuyez à nouveau pour reprendre la rotation',
    'Fixiert · erneut antippen, um weiterzurotieren',
    'Fixado · toque novamente para retomar a rotação',
    'Đã giữ · nhấn lần nữa để tiếp tục xoay',
    'Ditahan · tekan lagi untuk melanjutkan rotasi',
    'Закреплено · нажмите ещё раз, чтобы возобновить смену',
    'रुका हुआ · घुमाव फिर शुरू करने के लिए दोबारा दबाएँ',
    'Bloccato · premi di nuovo per riprendere la rotazione',
    'Sabitlendi · dönüşü sürdürmek için tekrar dokunun',
    'ตรึงแล้ว · กดอีกครั้งเพื่อหมุนต่อ',
    'Przytrzymano · naciśnij ponownie, aby wznowić zmianę',
    'Vastgezet · druk nogmaals om weer te roteren',
    'Naka-hold · pindutin muli para ipagpatuloy ang pag-ikot',
  ),
};

/** Root namespaces retired by REV-41 D-7 (the uRanking slot and its one tag line). */
const DELETE = ['Rev35'];

/** Sorted ICU argument list, e.g. "{base}|{quote}|{value}". */
const icu = (s) => (s.match(/\{[^}]*\}/g) ?? []).slice().sort().join('|');

// Fail closed BEFORE touching any file: every locale must carry exactly the
// ICU arguments en carries. next-intl renders a missing argument as the raw
// placeholder and a stray one as "undefined" -- both reach real visitors.
for (const [dotted, byLocale] of Object.entries(SET)) {
  const want = icu(byLocale.en);
  for (const locale of LOCALES) {
    const value = byLocale[locale];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`apply-rev41-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (value.includes('[MISSING')) throw new Error(`apply-rev41-i18n: ${dotted}/${locale} is a placeholder`);
    if (icu(value) !== want) throw new Error(`apply-rev41-i18n: ${dotted}/${locale} ICU tokens "${icu(value)}" differ from en "${want}"`);
  }
}

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
    if (setDeep(data, dotted, byLocale[locale])) set += 1;
  }

  for (const ns of DELETE) {
    if (ns in data) {
      delete data[ns];
      deleted += 1;
    }
  }

  // Fail closed: nothing placeholder-shaped went into THIS lane's namespace.
  const own = JSON.stringify(data.Rev41 ?? {});
  if (own.includes('[MISSING')) throw new Error(`apply-rev41-i18n: ${locale}: a placeholder survived in Rev41`);

  // Preserve the file's line endings. This checkout runs core.autocrlf=true
  // and .gitattributes pins only web/scripts/**, so the LF blobs of
  // messages/*.json arrive as CRLF in the working tree; an applicator that
  // always emits LF makes `--check` report all 20 files as drifted on a
  // clean tree (measured today with apply-rev35 --check). Git renormalizes
  // on commit either way, so the blob is unaffected.
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const next = `${JSON.stringify(data, null, 2)}\n`.replace(/\n/g, eol);
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set, -${deleted} namespace(s)${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev41-i18n: clean' : `apply-rev41-i18n: ${totalChanges} locale file(s) would change`);
  process.exitCode = totalChanges === 0 ? 0 : 1;
} else {
  console.log(`apply-rev41-i18n: ${totalChanges} locale file(s) written`);
}
