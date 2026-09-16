/**
 * REV-36 M3 i18n applicator (SPEC §2 D-7, §4.3, lane C) -- the `Rev36`
 * namespace: the UI chrome around the U-Square hyper matrix (유숏츠 · 유토크 ·
 * 유지식거래소 pulse labels, the market bar, the demand chip, the pulse feed).
 *
 * Idempotent, all 20 locales at once, a REAL translation per locale -- never a
 * placeholder. SET-only (deep-merge of dotted keys). The simulated CONTENT
 * (chat phrases, clip titles, handles) is NOT here: per the house seed-text
 * rule it is brand-neutral English shared by every locale, so it lives in
 * lib/square/talkPulse.ts and lib/live/shortsSeed.ts, not in messages/*.json.
 *
 * Run: node scripts/apply-rev36-i18n.mjs [--check]   (--check exits 1 on drift)
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
  if (v.length !== LOCALES.length) throw new Error(`apply-rev36-i18n: L() expects ${LOCALES.length} strings, got ${v.length}`);
  return Object.fromEntries(LOCALES.map((l, i) => [l, v[i]]));
};

const SET = {
  'Rev36.pulse.label': L(
    'Network pulse', '네트워크 펄스', 'Võrgu pulss', 'ネットワークパルス', '网络脉动',
    'Pulso de la red', 'ចលនាបណ្តាញ', 'Pouls du réseau', 'Netzwerkpuls', 'Pulso da rede',
    'Nhịp mạng lưới', 'Denyut jaringan', 'Пульс сети', 'नेटवर्क पल्स', 'Battito della rete',
    'Ağ nabzı', 'ชีพจรเครือข่าย', 'Puls sieci', 'Netwerkpuls', 'Pulso ng network',
  ),
  'Rev36.pulse.sim': L(
    'simulation', '시뮬레이션', 'simulatsioon', 'シミュレーション', '模拟',
    'simulación', 'ការក្លែងធ្វើ', 'simulation', 'Simulation', 'simulação',
    'mô phỏng', 'simulasi', 'симуляция', 'सिमुलेशन', 'simulazione',
    'simülasyon', 'การจำลอง', 'symulacja', 'simulatie', 'simulasyon',
  ),
  'Rev36.pulse.note': L(
    'Simulated network pulse — deterministic, refreshed every 5 minutes. Your own actions and the account ledger are real.',
    '시뮬레이션 네트워크 펄스 — 결정론적이며 5분마다 갱신됩니다. 회원님의 활동과 계정 원장은 실제입니다.',
    'Simuleeritud võrgu pulss — determineeritud, värskendatakse iga 5 minuti järel. Sinu enda tegevused ja kontoraamat on päris.',
    'シミュレートされたネットワークパルス — 決定論的で5分ごとに更新されます。あなたの操作とアカウント台帳は本物です。',
    '模拟的网络脉动 — 确定性的，每 5 分钟刷新一次。您自己的操作和账户账本是真实的。',
    'Pulso de red simulado — determinista, se actualiza cada 5 minutos. Tus propias acciones y el libro de tu cuenta son reales.',
    'ចលនាបណ្តាញក្លែងធ្វើ — កំណត់ជាក់លាក់ ធ្វើបច្ចុប្បន្នភាពរៀងរាល់ ៥ នាទី។ សកម្មភាពរបស់អ្នក និងបញ្ជីគណនីគឺពិត។',
    'Pouls du réseau simulé — déterministe, actualisé toutes les 5 minutes. Vos propres actions et le registre du compte sont réels.',
    'Simulierter Netzwerkpuls — deterministisch, alle 5 Minuten aktualisiert. Deine eigenen Aktionen und das Kontobuch sind echt.',
    'Pulso de rede simulado — determinístico, atualizado a cada 5 minutos. As suas ações e o livro-razão da conta são reais.',
    'Nhịp mạng mô phỏng — mang tính tất định, làm mới mỗi 5 phút. Hành động của bạn và sổ cái tài khoản là thật.',
    'Denyut jaringan simulasi — deterministik, disegarkan setiap 5 menit. Tindakan Anda sendiri dan buku besar akun adalah nyata.',
    'Симулированный пульс сети — детерминированный, обновляется каждые 5 минут. Ваши действия и реестр аккаунта — настоящие.',
    'सिम्युलेटेड नेटवर्क पल्स — नियतात्मक, हर 5 मिनट में ताज़ा होता है। आपकी अपनी गतिविधियाँ और खाता बही असली हैं।',
    "Battito della rete simulato — deterministico, aggiornato ogni 5 minuti. Le tue azioni e il registro dell'account sono reali.",
    'Simüle ağ nabzı — belirlenimci, her 5 dakikada bir yenilenir. Kendi işlemleriniz ve hesap defteri gerçektir.',
    'ชีพจรเครือข่ายจำลอง — เป็นแบบกำหนดแน่นอน รีเฟรชทุก 5 นาที การกระทำของคุณเองและบัญชีแยกประเภทเป็นของจริง',
    'Symulowany puls sieci — deterministyczny, odświeżany co 5 minut. Twoje własne działania i księga konta są prawdziwe.',
    'Gesimuleerde netwerkpuls — deterministisch, elke 5 minuten ververst. Je eigen acties en het accountgrootboek zijn echt.',
    'Simuladong pulso ng network — deterministiko, nire-refresh kada 5 minuto. Ang iyong sariling mga aksyon at ang ledger ng account ay totoo.',
  ),
  'Rev36.talk.presence': L(
    '{count} in the room', '대화방에 {count}명', '{count} toas', 'ルームに{count}人', '房间中 {count} 人',
    '{count} en la sala', '{count} នៅក្នុងបន្ទប់', '{count} dans le salon', '{count} im Raum', '{count} na sala',
    '{count} trong phòng', '{count} di ruangan', '{count} в комнате', 'कमरे में {count}', '{count} nella stanza',
    'odada {count}', '{count} คนในห้อง', '{count} w pokoju', '{count} in de kamer', '{count} sa silid',
  ),
  'Rev36.talk.pulseRoom': L(
    'Room pulse', '방 펄스', 'Toa pulss', 'ルームパルス', '房间脉动',
    'Pulso de la sala', 'ចលនាបន្ទប់', 'Pouls du salon', 'Raumpuls', 'Pulso da sala',
    'Nhịp phòng', 'Denyut ruangan', 'Пульс комнаты', 'रूम पल्स', 'Battito della stanza',
    'Oda nabzı', 'ชีพจรห้อง', 'Puls pokoju', 'Kamerpuls', 'Pulso ng silid',
  ),
  'Rev36.shorts.watching': L(
    '{count} watching', '{count}명 시청 중', '{count} vaatab', '{count}人が視聴中', '{count} 人观看中',
    '{count} viendo', '{count} កំពុងមើល', '{count} regardent', '{count} sehen zu', '{count} a assistir',
    '{count} đang xem', '{count} menonton', '{count} смотрят', '{count} देख रहे हैं', '{count} in visione',
    '{count} izliyor', '{count} กำลังดู', '{count} ogląda', '{count} kijken', '{count} nanonood',
  ),
  'Rev36.shorts.trending': L(
    'Trending now', '지금 뜨는 중', 'Hetkel tõusuteel', '今トレンド', '正在热门',
    'Tendencia ahora', 'កំពុងពេញនិយម', 'Tendance actuelle', 'Gerade im Trend', 'Em alta agora',
    'Đang thịnh hành', 'Sedang tren', 'В тренде сейчас', 'अभी ट्रेंडिंग', 'Di tendenza ora',
    'Şimdi trend', 'กำลังมาแรง', 'Teraz na czasie', 'Nu trending', 'Sikat ngayon',
  ),
  'Rev36.shorts.feed': L(
    'Live pulse', '실시간 펄스', 'Reaalajas pulss', 'ライブパルス', '实时脉动',
    'Pulso en vivo', 'ចលនាផ្ទាល់', 'Pouls en direct', 'Live-Puls', 'Pulso ao vivo',
    'Nhịp trực tiếp', 'Denyut langsung', 'Живой пульс', 'लाइव पल्स', 'Battito dal vivo',
    'Canlı nabız', 'ชีพจรสด', 'Puls na żywo', 'Live puls', 'Live na pulso',
  ),
  'Rev36.shorts.feedLike': L(
    '{handle} liked {title}', '{handle}님이 {title}에 좋아요', '{handle} meeldis {title}', '{handle}が{title}にいいね', '{handle} 赞了 {title}',
    'A {handle} le gustó {title}', '{handle} បានចូលចិត្ត {title}', '{handle} a aimé {title}', '{handle} gefällt {title}', '{handle} curtiu {title}',
    '{handle} đã thích {title}', '{handle} menyukai {title}', '{handle} оценил(а) {title}', '{handle} ने {title} को पसंद किया', 'A {handle} piace {title}',
    '{handle}, {title} içeriğini beğendi', '{handle} ถูกใจ {title}', '{handle} polubił(a) {title}', '{handle} vindt {title} leuk', 'Nagustuhan ni {handle} ang {title}',
  ),
  'Rev36.shorts.feedFollow': L(
    '{handle} followed @{creator}', '{handle}님이 @{creator}님을 팔로우함', '{handle} jälgib @{creator}', '{handle}が@{creator}をフォロー', '{handle} 关注了 @{creator}',
    '{handle} siguió a @{creator}', '{handle} បានតាមដាន @{creator}', '{handle} suit @{creator}', '{handle} folgt @{creator}', '{handle} seguiu @{creator}',
    '{handle} đã theo dõi @{creator}', '{handle} mengikuti @{creator}', '{handle} подписался на @{creator}', '{handle} ने @{creator} को फ़ॉलो किया', '{handle} ha seguito @{creator}',
    '{handle}, @{creator} kişisini takip etti', '{handle} ติดตาม @{creator}', '{handle} obserwuje @{creator}', '{handle} volgt @{creator}', 'Sinundan ni {handle} si @{creator}',
  ),
  'Rev36.shorts.feedWatch': L(
    '{handle} is watching {title}', '{handle}님이 {title} 시청 중', '{handle} vaatab {title}', '{handle}が{title}を視聴中', '{handle} 正在观看 {title}',
    '{handle} está viendo {title}', '{handle} កំពុងមើល {title}', '{handle} regarde {title}', '{handle} sieht {title}', '{handle} está a ver {title}',
    '{handle} đang xem {title}', '{handle} sedang menonton {title}', '{handle} смотрит {title}', '{handle} {title} देख रहे हैं', '{handle} sta guardando {title}',
    '{handle}, {title} izliyor', '{handle} กำลังดู {title}', '{handle} ogląda {title}', '{handle} kijkt naar {title}', 'Pinapanood ni {handle} ang {title}',
  ),
  'Rev36.shorts.sortTrending': L(
    'Trending', '인기', 'Tõusuteel', 'トレンド', '热门',
    'Tendencia', 'ពេញនិយម', 'Tendances', 'Im Trend', 'Em alta',
    'Thịnh hành', 'Tren', 'В тренде', 'ट्रेंडिंग', 'Di tendenza',
    'Trend', 'มาแรง', 'Na czasie', 'Trending', 'Sikat',
  ),
  'Rev36.shorts.sortCatalogue': L(
    'Catalogue', '카탈로그', 'Kataloog', 'カタログ', '目录',
    'Catálogo', 'កាតាឡុក', 'Catalogue', 'Katalog', 'Catálogo',
    'Danh mục', 'Katalog', 'Каталог', 'कैटलॉग', 'Catalogo',
    'Katalog', 'แคตตาล็อก', 'Katalog', 'Catalogus', 'Katalogo',
  ),
  'Rev36.shorts.account': L(
    'Likes and follows saved to your account', '좋아요와 팔로우가 계정에 저장됨', 'Meeldimised ja jälgimised salvestatud sinu kontole', 'いいねとフォローはアカウントに保存されます', '点赞和关注已保存到您的账户',
    'Me gusta y seguimientos guardados en tu cuenta', 'ការចូលចិត្ត និងការតាមដានត្រូវបានរក្សាទុកក្នុងគណនីរបស់អ្នក', "J'aime et abonnements enregistrés sur votre compte", 'Likes und Abos in deinem Konto gespeichert', 'Curtidas e seguidores guardados na sua conta',
    'Lượt thích và theo dõi được lưu vào tài khoản của bạn', 'Suka dan ikuti disimpan ke akun Anda', 'Лайки и подписки сохранены в вашем аккаунте', 'पसंद और फ़ॉलो आपके खाते में सहेजे गए', 'Mi piace e follow salvati nel tuo account',
    'Beğeniler ve takipler hesabınıza kaydedildi', 'การถูกใจและติดตามถูกบันทึกในบัญชีของคุณ', 'Polubienia i obserwacje zapisane na Twoim koncie', 'Likes en volgers opgeslagen op je account', 'Ang mga like at follow ay naka-save sa iyong account',
  ),
  'Rev36.shorts.device': L(
    'Likes and follows on this device', '좋아요와 팔로우가 이 기기에만 저장됨', 'Meeldimised ja jälgimised sellel seadmel', 'いいねとフォローはこの端末のみ', '点赞和关注仅在此设备',
    'Me gusta y seguimientos en este dispositivo', 'ការចូលចិត្ត និងការតាមដាននៅលើឧបករណ៍នេះ', "J'aime et abonnements sur cet appareil", 'Likes und Abos auf diesem Gerät', 'Curtidas e seguidores neste dispositivo',
    'Lượt thích và theo dõi trên thiết bị này', 'Suka dan ikuti di perangkat ini', 'Лайки и подписки на этом устройстве', 'इस डिवाइस पर पसंद और फ़ॉलो', 'Mi piace e follow su questo dispositivo',
    'Bu cihazdaki beğeniler ve takipler', 'การถูกใจและติดตามบนอุปกรณ์นี้', 'Polubienia i obserwacje na tym urządzeniu', 'Likes en volgers op dit apparaat', 'Mga like at follow sa device na ito',
  ),
  'Rev36.exchange.market': L(
    'Market pulse', '시장 펄스', 'Turu pulss', 'マーケットパルス', '市场脉动',
    'Pulso del mercado', 'ចលនាទីផ្សារ', 'Pouls du marché', 'Marktpuls', 'Pulso do mercado',
    'Nhịp thị trường', 'Denyut pasar', 'Пульс рынка', 'मार्केट पल्स', 'Battito del mercato',
    'Piyasa nabzı', 'ชีพจรตลาด', 'Puls rynku', 'Marktpuls', 'Pulso ng merkado',
  ),
  'Rev36.exchange.volume24h': L(
    '24h volume', '24시간 거래량', '24 t maht', '24時間の取引量', '24 小时成交量',
    'Volumen 24h', 'បរិមាណ ២៤ ម៉ោង', 'Volume 24 h', '24-h-Volumen', 'Volume 24h',
    'Khối lượng 24h', 'Volume 24 jam', 'Объём за 24ч', '24घं वॉल्यूम', 'Volume 24h',
    '24s hacim', 'ปริมาณ 24 ชม.', 'Wolumen 24h', '24u-volume', 'Volume 24h',
  ),
  'Rev36.exchange.trades24h': L(
    '24h trades', '24시간 거래 수', '24 t tehingud', '24時間の取引数', '24 小时交易数',
    'Operaciones 24h', 'ការជួញដូរ ២៤ ម៉ោង', 'Transactions 24 h', '24-h-Trades', 'Negócios 24h',
    'Giao dịch 24h', 'Transaksi 24 jam', 'Сделки за 24ч', '24घं ट्रेड', 'Scambi 24h',
    '24s işlem', 'การซื้อขาย 24 ชม.', 'Transakcje 24h', '24u-trades', 'Mga trade 24h',
  ),
  'Rev36.exchange.traders24h': L(
    'Active traders', '활성 거래자', 'Aktiivsed kauplejad', 'アクティブな取引者', '活跃交易者',
    'Operadores activos', 'អ្នកជួញដូរសកម្ម', 'Traders actifs', 'Aktive Händler', 'Negociantes ativos',
    'Nhà giao dịch hoạt động', 'Trader aktif', 'Активные трейдеры', 'सक्रिय ट्रेडर', 'Trader attivi',
    'Aktif yatırımcılar', 'ผู้ซื้อขายที่ใช้งาน', 'Aktywni handlujący', 'Actieve handelaren', 'Aktibong trader',
  ),
  'Rev36.exchange.topTheme': L(
    'Hot theme', '인기 테마', 'Kuum teema', '注目テーマ', '热门主题',
    'Tema destacado', 'ប្រធានបទក្តៅ', 'Thème phare', 'Heißes Thema', 'Tema em destaque',
    'Chủ đề nổi bật', 'Tema populer', 'Горячая тема', 'हॉट थीम', 'Tema caldo',
    'Öne çıkan tema', 'ธีมมาแรง', 'Gorący temat', 'Populair thema', 'Sikat na tema',
  ),
  'Rev36.exchange.demand': L(
    '7-day demand', '7일 수요', '7 päeva nõudlus', '7日間の需要', '7 天需求',
    'Demanda de 7 días', 'តម្រូវការ ៧ ថ្ងៃ', 'Demande sur 7 jours', '7-Tage-Nachfrage', 'Procura de 7 dias',
    'Nhu cầu 7 ngày', 'Permintaan 7 hari', 'Спрос за 7 дней', '7-दिन की मांग', 'Domanda a 7 giorni',
    '7 günlük talep', 'อุปสงค์ 7 วัน', 'Popyt z 7 dni', 'Vraag over 7 dagen', 'Demand sa 7 araw',
  ),
  'Rev36.exchange.momentumUp': L(
    'Rising', '상승', 'Tõuseb', '上昇', '上升',
    'Subiendo', 'កំពុងឡើង', 'En hausse', 'Steigend', 'A subir',
    'Đang tăng', 'Naik', 'Растёт', 'बढ़ रहा', 'In salita',
    'Yükseliyor', 'กำลังขึ้น', 'Rośnie', 'Stijgend', 'Tumataas',
  ),
  'Rev36.exchange.momentumFlat': L(
    'Steady', '보합', 'Stabiilne', '横ばい', '平稳',
    'Estable', 'ថេរ', 'Stable', 'Stabil', 'Estável',
    'Ổn định', 'Stabil', 'Стабильно', 'स्थिर', 'Stabile',
    'Sabit', 'คงที่', 'Stabilnie', 'Stabiel', 'Matatag',
  ),
  'Rev36.exchange.momentumDown': L(
    'Cooling', '하락', 'Jahtub', '下降', '降温',
    'Enfriándose', 'កំពុងធ្លាក់', 'En baisse', 'Abkühlend', 'A descer',
    'Đang giảm', 'Turun', 'Остывает', 'घट रहा', 'In calo',
    'Soğuyor', 'กำลังลง', 'Słabnie', 'Afkoelend', 'Bumababa',
  ),
  'Rev36.exchange.ledgerLive': L(
    'Live ledger figures', '실시간 원장 수치', 'Reaalajas pearaamatu näitajad', 'ライブ台帳の数値', '实时账本数据',
    'Cifras del libro en vivo', 'តួលេខបញ្ជីផ្ទាល់', 'Chiffres du registre en direct', 'Live-Kontobuchzahlen', 'Números do livro-razão ao vivo',
    'Số liệu sổ cái trực tiếp', 'Angka buku besar langsung', 'Данные реестра в реальном времени', 'लाइव लेजर आंकड़े', 'Dati del registro dal vivo',
    'Canlı defter rakamları', 'ตัวเลขบัญชีแบบสด', 'Dane księgi na żywo', 'Live grootboekcijfers', 'Live na datos ng ledger',
  ),
  'Rev36.exchange.simTrade': L(
    'simulated', '시뮬레이션', 'simuleeritud', 'シミュレーション', '模拟',
    'simulado', 'ក្លែងធ្វើ', 'simulé', 'simuliert', 'simulado',
    'mô phỏng', 'simulasi', 'симуляция', 'सिम्युलेटेड', 'simulato',
    'simüle', 'จำลอง', 'symulowane', 'gesimuleerd', 'simulado',
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
      throw new Error(`apply-rev36-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (setDeep(data, dotted, value)) set += 1;
  }

  const own = JSON.stringify(data.Rev36 ?? {});
  if (own.includes('[MISSING')) throw new Error(`apply-rev36-i18n: ${locale}: a placeholder survived in Rev36`);

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev36-i18n: clean' : `apply-rev36-i18n: ${totalChanges} locale file(s) would change`);
  process.exit(totalChanges === 0 ? 0 : 1);
}
console.log(`apply-rev36-i18n: ${totalChanges} locale file(s) written`);
