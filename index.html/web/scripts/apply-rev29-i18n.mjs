/**
 * REV-29 i18n applicator (founder directive 2026-09-15).
 *
 * Idempotent, across all 20 locales at once, with a REAL translation per
 * locale -- never a "[MISSING:en]" placeholder. Four jobs:
 *
 *  1. M2.2 -- SPLIT the two fused news axes. Every locale's existing
 *     "복지·보건" / "안보·분쟁" label is cut on its own separator into the
 *     `welfare` + `health` and `security` + `conflict` labels, so the native
 *     wording each locale already had is preserved verbatim.
 *  2. M2.3 / M2.4 -- the news popup copy (open original, story count, axis
 *     tag, detail aria, all-stories lede).
 *  3. M3 -- the 글로벌 신상품 slot (title, tag, five families, count fact).
 *  4. M4 / M5 -- the UNITAS hub (hub shell, exchange, rooms, social), the
 *     revived Shorts copy (moved verbatim from the REV-19 `Rev19.shorts`
 *     tree REV-20 purged, into `Rev29.shorts`) and the three short attach
 *     labels.
 *
 * Run: node scripts/apply-rev29-i18n.mjs [--check]
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

/** Positional: one string per locale in LOCALES order. */
const L = (...v) => {
  if (v.length !== LOCALES.length) throw new Error(`apply-rev29-i18n: L() expects ${LOCALES.length} strings, got ${v.length}`);
  return Object.fromEntries(LOCALES.map((l, i) => [l, v[i]]));
};
/** The same string for every locale (brand words, symbols, ICU-only rows). */
const SAME = (s) => Object.fromEntries(LOCALES.map((l) => [l, s]));

/* ------------------------------------------------------------------ */
/* SET                                                                 */
/* ------------------------------------------------------------------ */

const SET = {
  // -- M4: hub shell ----------------------------------------------------
  'Rev29.hub.title': L('UNITAS Hub', 'UNITAS 허브', 'UNITASe keskus', 'UNITAS ハブ', 'UNITAS 中心', 'Centro UNITAS', 'មជ្ឈមណ្ឌល UNITAS', 'Hub UNITAS', 'UNITAS-Hub', 'Hub UNITAS', 'Trung tâm UNITAS', 'Hub UNITAS', 'Хаб UNITAS', 'UNITAS हब', 'Hub UNITAS', 'UNITAS Merkezi', 'ศูนย์กลาง UNITAS', 'Centrum UNITAS', 'UNITAS-hub', 'UNITAS Hub'),
  'Rev29.hub.lede': L(
    'Trade knowledge, watch shorts, climb the rankings, talk by theme and share UNITAS with the world.',
    '지식을 사고팔고, 숏츠를 보고, 랭킹을 겨루고, 테마별로 대화하고, UNITAS를 세계와 공유하는 곳.',
    'Kauple teadmistega, vaata lühivideoid, tõuse edetabelis, vestle teemade kaupa ja jaga UNITASt maailmaga.',
    '知識を売買し、ショートを見て、ランキングを競い、テーマ別に語り合い、UNITASを世界と共有する場所。',
    '买卖知识、观看短视频、角逐排名、按主题聊天，并与世界分享 UNITAS。',
    'Compra y vende conocimiento, mira shorts, sube en los rankings, conversa por tema y comparte UNITAS con el mundo.',
    'ទិញលក់ចំណេះដឹង មើលវីដេអូខ្លី ប្រកួតចំណាត់ថ្នាក់ ជជែកតាមប្រធានបទ និងចែករំលែក UNITAS ជាមួយពិភពលោក។',
    'Échangez du savoir, regardez des shorts, grimpez les classements, discutez par thème et partagez UNITAS avec le monde.',
    'Wissen handeln, Shorts ansehen, Rankings erklimmen, nach Themen chatten und UNITAS mit der Welt teilen.',
    'Negocie conhecimento, veja shorts, suba nos rankings, converse por tema e partilhe a UNITAS com o mundo.',
    'Mua bán tri thức, xem shorts, leo bảng xếp hạng, trò chuyện theo chủ đề và chia sẻ UNITAS với thế giới.',
    'Perdagangkan pengetahuan, tonton shorts, naiki peringkat, mengobrol per tema, dan bagikan UNITAS ke dunia.',
    'Торгуйте знаниями, смотрите шортсы, поднимайтесь в рейтингах, общайтесь по темам и делитесь UNITAS с миром.',
    'ज्ञान का लेन-देन करें, शॉर्ट्स देखें, रैंकिंग में ऊपर चढ़ें, विषय के अनुसार बातचीत करें और UNITAS को दुनिया के साथ साझा करें।',
    'Scambia conoscenza, guarda gli shorts, scala le classifiche, chatta per tema e condividi UNITAS con il mondo.',
    'Bilgi al-sat, shorts izle, sıralamalarda yüksel, temaya göre sohbet et ve UNITAS’ı dünyayla paylaş.',
    'ซื้อขายความรู้ ดูวิดีโอสั้น ไต่อันดับ พูดคุยตามธีม และแชร์ UNITAS กับโลก',
    'Handluj wiedzą, oglądaj shorty, wspinaj się w rankingach, rozmawiaj tematycznie i dziel się UNITAS ze światem.',
    'Handel in kennis, bekijk shorts, klim in de ranglijsten, chat per thema en deel UNITAS met de wereld.',
    'Magpalitan ng kaalaman, manood ng shorts, umakyat sa ranking, mag-usap ayon sa tema, at ibahagi ang UNITAS sa mundo.',
  ),
  'Rev29.hub.toggleAria': L(
    'Open the UNITAS hub — knowledge exchange, shorts, rankings, chat rooms, social',
    'UNITAS 허브 열기 — 지식 거래소·숏츠·랭킹·대화방·소셜',
    'Ava UNITASe keskus — teadmiste börs, lühivideod, edetabelid, vestlustoad, sotsiaalmeedia',
    'UNITASハブを開く — 知識取引所・ショート・ランキング・チャットルーム・ソーシャル',
    '打开 UNITAS 中心 — 知识交易所、短视频、排名、聊天室、社交',
    'Abrir el centro UNITAS — bolsa de conocimiento, shorts, rankings, salas de chat, redes',
    'បើកមជ្ឈមណ្ឌល UNITAS — ផ្សារចំណេះដឹង វីដេអូខ្លី ចំណាត់ថ្នាក់ បន្ទប់ជជែក បណ្តាញសង្គម',
    'Ouvrir le hub UNITAS — bourse du savoir, shorts, classements, salons, réseaux',
    'UNITAS-Hub öffnen — Wissensbörse, Shorts, Rankings, Chaträume, Social',
    'Abrir o hub UNITAS — bolsa de conhecimento, shorts, rankings, salas de chat, redes',
    'Mở trung tâm UNITAS — sàn tri thức, shorts, xếp hạng, phòng chat, mạng xã hội',
    'Buka hub UNITAS — bursa pengetahuan, shorts, peringkat, ruang obrolan, sosial',
    'Открыть хаб UNITAS — биржа знаний, шортсы, рейтинги, чаты, соцсети',
    'UNITAS हब खोलें — ज्ञान विनिमय, शॉर्ट्स, रैंकिंग, चैट रूम, सोशल',
    'Apri l’hub UNITAS — borsa della conoscenza, shorts, classifiche, stanze chat, social',
    'UNITAS merkezini aç — bilgi borsası, shorts, sıralamalar, sohbet odaları, sosyal',
    'เปิดศูนย์กลาง UNITAS — ตลาดความรู้ วิดีโอสั้น อันดับ ห้องแชท โซเชียล',
    'Otwórz hub UNITAS — giełda wiedzy, shorty, rankingi, pokoje czatu, social',
    'Open de UNITAS-hub — kennisbeurs, shorts, ranglijsten, chatrooms, social',
    'Buksan ang UNITAS hub — palitan ng kaalaman, shorts, ranking, chat room, social',
  ),
  'Rev29.hub.tabs.exchange': L('Knowledge Exchange', '지식 거래소', 'Teadmiste börs', '知識取引所', '知识交易所', 'Bolsa de conocimiento', 'ផ្សារចំណេះដឹង', 'Bourse du savoir', 'Wissensbörse', 'Bolsa de conhecimento', 'Sàn tri thức', 'Bursa pengetahuan', 'Биржа знаний', 'ज्ञान विनिमय', 'Borsa della conoscenza', 'Bilgi borsası', 'ตลาดความรู้', 'Giełda wiedzy', 'Kennisbeurs', 'Palitan ng kaalaman'),
  'Rev29.hub.tabs.shorts': L('UNITAS Shorts', 'UNITAS 숏츠', 'UNITAS lühivideod', 'UNITAS ショート', 'UNITAS 短视频', 'UNITAS Shorts', 'UNITAS វីដេអូខ្លី', 'UNITAS Shorts', 'UNITAS Shorts', 'UNITAS Shorts', 'UNITAS Shorts', 'UNITAS Shorts', 'UNITAS Шортсы', 'UNITAS शॉर्ट्स', 'UNITAS Shorts', 'UNITAS Shorts', 'UNITAS วิดีโอสั้น', 'UNITAS Shorty', 'UNITAS Shorts', 'UNITAS Shorts'),
  'Rev29.hub.tabs.rankings': L('UNITAS Rankings', 'UNITAS 랭킹', 'UNITAS edetabelid', 'UNITAS ランキング', 'UNITAS 排名', 'Rankings UNITAS', 'ចំណាត់ថ្នាក់ UNITAS', 'Classements UNITAS', 'UNITAS-Rankings', 'Rankings UNITAS', 'Xếp hạng UNITAS', 'Peringkat UNITAS', 'Рейтинги UNITAS', 'UNITAS रैंकिंग', 'Classifiche UNITAS', 'UNITAS Sıralamaları', 'อันดับ UNITAS', 'Rankingi UNITAS', 'UNITAS-ranglijsten', 'UNITAS Ranking'),
  'Rev29.hub.tabs.rooms': L('Theme chat rooms', '테마별 대화방', 'Teemavestlused', 'テーマ別チャット', '主题聊天室', 'Salas por tema', 'បន្ទប់ជជែកតាមប្រធានបទ', 'Salons par thème', 'Themen-Chaträume', 'Salas por tema', 'Phòng chat theo chủ đề', 'Ruang obrolan tema', 'Тематические чаты', 'विषय चैट रूम', 'Stanze per tema', 'Tema sohbet odaları', 'ห้องแชทตามธีม', 'Pokoje tematyczne', 'Themachatrooms', 'Chat room ayon sa tema'),
  'Rev29.hub.tabs.social': L('Social media', '소셜 미디어', 'Sotsiaalmeedia', 'ソーシャルメディア', '社交媒体', 'Redes sociales', 'បណ្តាញសង្គម', 'Réseaux sociaux', 'Soziale Medien', 'Redes sociais', 'Mạng xã hội', 'Media sosial', 'Соцсети', 'सोशल मीडिया', 'Social media', 'Sosyal medya', 'โซเชียลมีเดีย', 'Media społecznościowe', 'Sociale media', 'Social media'),
  'Rev29.hub.live': L('Live', '실시간', 'Otse', 'ライブ', '实时', 'En vivo', 'ផ្ទាល់', 'En direct', 'Live', 'Ao vivo', 'Trực tiếp', 'Langsung', 'В эфире', 'लाइव', 'Live', 'Canlı', 'สด', 'Na żywo', 'Live', 'Live'),
  'Rev29.hub.localOnly': L('This device only — no live link', '이 기기 전용 — 실시간 연결 없음', 'Ainult see seade — otseühendust pole', 'この端末のみ — ライブ接続なし', '仅本设备 — 无实时连接', 'Solo este dispositivo — sin enlace en vivo', 'តែឧបករណ៍នេះ — គ្មានការតភ្ជាប់ផ្ទាល់', 'Cet appareil seulement — pas de lien en direct', 'Nur dieses Gerät — keine Live-Verbindung', 'Só este dispositivo — sem ligação ao vivo', 'Chỉ thiết bị này — không có kết nối trực tiếp', 'Hanya perangkat ini — tanpa tautan langsung', 'Только это устройство — без живой связи', 'केवल यह डिवाइस — कोई लाइव लिंक नहीं', 'Solo questo dispositivo — nessun collegamento live', 'Yalnızca bu cihaz — canlı bağlantı yok', 'เฉพาะอุปกรณ์นี้ — ไม่มีการเชื่อมต่อสด', 'Tylko to urządzenie — brak połączenia na żywo', 'Alleen dit apparaat — geen live-verbinding', 'Ang device na ito lang — walang live link'),
  'Rev29.hub.online': L('{count} online', '{count}명 접속 중', '{count} võrgus', '{count}人が接続中', '{count} 人在线', '{count} en línea', '{count} នាក់អនឡាញ', '{count} en ligne', '{count} online', '{count} online', '{count} đang trực tuyến', '{count} online', 'Онлайн: {count}', '{count} ऑनलाइन', '{count} online', '{count} çevrimiçi', '{count} คนออนไลน์', '{count} online', '{count} online', '{count} online'),

  // -- M4: knowledge exchange ------------------------------------------
  'Rev29.exchange.lede': L(
    'Buy knowledge packs listed by creators with credits, and list your own to share the revenue.',
    '창작자가 올린 지식 팩을 크레딧으로 사고, 내 지식을 올려 수익을 나눕니다.',
    'Osta loojate teadmispakke krediitidega ja pane oma teadmised müüki, et tulu jagada.',
    'クリエイターの知識パックをクレジットで購入し、自分の知識を出品して収益を分け合いましょう。',
    '用积分购买创作者上架的知识包，并上架你的知识来分享收益。',
    'Compra packs de conocimiento de creadores con créditos y publica los tuyos para compartir ingresos.',
    'ទិញកញ្ចប់ចំណេះដឹងពីអ្នកបង្កើតដោយឥណទាន និងដាក់លក់ចំណេះដឹងរបស់អ្នកដើម្បីចែករំលែកចំណូល។',
    'Achetez des packs de savoir publiés par des créateurs avec des crédits et publiez les vôtres pour partager les revenus.',
    'Kaufe Wissenspakete von Creatorn mit Credits und stelle eigene ein, um den Erlös zu teilen.',
    'Compre packs de conhecimento de criadores com créditos e publique os seus para partilhar a receita.',
    'Mua gói tri thức do nhà sáng tạo đăng bằng tín dụng và đăng gói của bạn để chia sẻ doanh thu.',
    'Beli paket pengetahuan dari kreator dengan kredit, dan daftarkan milikmu untuk berbagi pendapatan.',
    'Покупайте пакеты знаний от авторов за кредиты и выставляйте свои, чтобы делить доход.',
    'क्रिएटर्स के ज्ञान पैक क्रेडिट से खरीदें और अपने पैक सूचीबद्ध कर राजस्व साझा करें।',
    'Acquista pack di conoscenza dei creator con i crediti e pubblica i tuoi per condividere i ricavi.',
    'Yaratıcıların bilgi paketlerini kredilerle satın al, kendininkini listeleyip geliri paylaş.',
    'ซื้อแพ็กความรู้จากครีเอเตอร์ด้วยเครดิต และลงขายของคุณเพื่อแบ่งรายได้',
    'Kupuj pakiety wiedzy twórców za kredyty i wystawiaj własne, by dzielić przychód.',
    'Koop kennispakketten van makers met credits en plaats je eigen om de opbrengst te delen.',
    'Bumili ng knowledge pack ng mga creator gamit ang credits, at ilista ang sa iyo para hatiin ang kita.',
  ),
  'Rev29.exchange.credits': L('beta credits', '베타 크레딧', 'beetakrediidid', 'ベータクレジット', '测试版积分', 'créditos beta', 'ឥណទានបេតា', 'crédits bêta', 'Beta-Credits', 'créditos beta', 'tín dụng beta', 'kredit beta', 'бета-кредиты', 'बीटा क्रेडिट', 'crediti beta', 'beta kredi', 'เครดิตเบต้า', 'kredyty beta', 'bètacredits', 'beta credits'),
  'Rev29.exchange.wallet': SAME('U-COIN'),
  'Rev29.exchange.creditsNote': L(
    'Beta credits live on this device · U-COIN settlement opens with the ledger link.',
    '베타 크레딧은 이 기기에 보관됩니다 · U-COIN 정산은 원장 연동과 함께 열립니다.',
    'Beetakrediidid asuvad selles seadmes · U-COINi arveldus avaneb koos pearaamatu liidesega.',
    'ベータクレジットはこの端末に保存されます · U-COIN決済は台帳連携とともに開始されます。',
    '测试版积分保存在本设备 · U-COIN 结算将随账本对接开放。',
    'Los créditos beta viven en este dispositivo · La liquidación en U-COIN se abre con el enlace al libro mayor.',
    'ឥណទានបេតារក្សាទុកក្នុងឧបករណ៍នេះ · ការទូទាត់ U-COIN នឹងបើកជាមួយការភ្ជាប់សៀវភៅបញ្ជី។',
    'Les crédits bêta restent sur cet appareil · Le règlement en U-COIN s’ouvrira avec le lien au registre.',
    'Beta-Credits liegen auf diesem Gerät · Die U-COIN-Abrechnung öffnet mit der Ledger-Anbindung.',
    'Os créditos beta ficam neste dispositivo · A liquidação em U-COIN abre com a ligação ao livro-razão.',
    'Tín dụng beta lưu trên thiết bị này · Thanh toán U-COIN sẽ mở cùng liên kết sổ cái.',
    'Kredit beta tersimpan di perangkat ini · Penyelesaian U-COIN dibuka bersama tautan buku besar.',
    'Бета-кредиты хранятся на этом устройстве · Расчёт в U-COIN откроется с подключением реестра.',
    'बीटा क्रेडिट इस डिवाइस पर रहते हैं · U-COIN निपटान लेजर लिंक के साथ खुलेगा।',
    'I crediti beta vivono su questo dispositivo · Il regolamento in U-COIN apre con il collegamento al registro.',
    'Beta krediler bu cihazda tutulur · U-COIN takası defter bağlantısıyla açılır.',
    'เครดิตเบต้าเก็บอยู่ในอุปกรณ์นี้ · การชำระ U-COIN จะเปิดพร้อมการเชื่อมบัญชีแยกประเภท',
    'Kredyty beta są na tym urządzeniu · Rozliczenie w U-COIN otworzy się z połączeniem księgi.',
    'Bètacredits staan op dit apparaat · U-COIN-afrekening opent met de grootboekkoppeling.',
    'Nasa device na ito ang beta credits · Bubukas ang U-COIN settlement kasama ang ledger link.',
  ),
  'Rev29.exchange.all': L('All', '전체', 'Kõik', 'すべて', '全部', 'Todo', 'ទាំងអស់', 'Tout', 'Alle', 'Tudo', 'Tất cả', 'Semua', 'Все', 'सभी', 'Tutto', 'Tümü', 'ทั้งหมด', 'Wszystko', 'Alles', 'Lahat'),
  'Rev29.exchange.sort.trending': L('Trending', '인기', 'Populaarsed', '人気', '热门', 'Tendencia', 'ពេញនិយម', 'Tendances', 'Beliebt', 'Em alta', 'Thịnh hành', 'Tren', 'Популярное', 'ट्रेंडिंग', 'Di tendenza', 'Popüler', 'มาแรง', 'Popularne', 'Trending', 'Trending'),
  'Rev29.exchange.sort.newest': L('Newest', '최신', 'Uusimad', '新着', '最新', 'Más nuevo', 'ថ្មីបំផុត', 'Récents', 'Neueste', 'Mais recentes', 'Mới nhất', 'Terbaru', 'Новые', 'नवीनतम', 'Più recenti', 'En yeni', 'ใหม่ล่าสุด', 'Najnowsze', 'Nieuwste', 'Pinakabago'),
  'Rev29.exchange.sort.price': L('Price', '가격', 'Hind', '価格', '价格', 'Precio', 'តម្លៃ', 'Prix', 'Preis', 'Preço', 'Giá', 'Harga', 'Цена', 'कीमत', 'Prezzo', 'Fiyat', 'ราคา', 'Cena', 'Prijs', 'Presyo'),
  'Rev29.exchange.kind.ladder': L('Ladder', '사다리', 'Redel', 'ラダー', '阶梯', 'Escalera', 'ជណ្ដើរ', 'Échelle', 'Leiter', 'Escada', 'Thang', 'Tangga', 'Лестница', 'सीढ़ी', 'Scala', 'Merdiven', 'บันได', 'Drabina', 'Ladder', 'Hagdan'),
  'Rev29.exchange.kind.playbook': L('Playbook', '플레이북', 'Mängujuhend', 'プレイブック', '攻略手册', 'Manual', 'សៀវភៅយុទ្ធសាស្ត្រ', 'Playbook', 'Playbook', 'Playbook', 'Cẩm nang', 'Panduan', 'Плейбук', 'प्लेबुक', 'Playbook', 'Oyun kitabı', 'เพลย์บุ๊ก', 'Playbook', 'Playbook', 'Playbook'),
  'Rev29.exchange.kind.dataset': L('Dataset', '데이터셋', 'Andmestik', 'データセット', '数据集', 'Conjunto de datos', 'សំណុំទិន្នន័យ', 'Jeu de données', 'Datensatz', 'Conjunto de dados', 'Bộ dữ liệu', 'Set data', 'Датасет', 'डेटासेट', 'Dataset', 'Veri seti', 'ชุดข้อมูล', 'Zbiór danych', 'Dataset', 'Dataset'),
  'Rev29.exchange.kind.prompt': L('Prompt kit', '프롬프트 키트', 'Vihjekomplekt', 'プロンプトキット', '提示词套件', 'Kit de prompts', 'ឧបករណ៍ prompt', 'Kit de prompts', 'Prompt-Kit', 'Kit de prompts', 'Bộ prompt', 'Kit prompt', 'Набор промптов', 'प्रॉम्प्ट किट', 'Kit di prompt', 'Prompt kiti', 'ชุดพรอมต์', 'Zestaw promptów', 'Promptkit', 'Prompt kit'),
  'Rev29.exchange.tier.seed': L('Seed', '시드', 'Seeme', 'シード', '种子', 'Semilla', 'គ្រាប់ពូជ', 'Seed', 'Seed', 'Seed', 'Hạt giống', 'Seed', 'Сид', 'सीड', 'Seed', 'Seed', 'ซีด', 'Seed', 'Seed', 'Seed'),
  'Rev29.exchange.tier.pro': L('Pro', '프로', 'Pro', 'プロ', '专业', 'Pro', 'Pro', 'Pro', 'Pro', 'Pro', 'Pro', 'Pro', 'Про', 'प्रो', 'Pro', 'Pro', 'โปร', 'Pro', 'Pro', 'Pro'),
  'Rev29.exchange.tier.sovereign': L('Sovereign', '소버린', 'Suveräänne', 'ソブリン', '主权', 'Soberano', 'អធិបតេយ្យ', 'Souverain', 'Sovereign', 'Soberano', 'Sovereign', 'Sovereign', 'Соверен', 'सॉवरेन', 'Sovereign', 'Egemen', 'โซเวอเรน', 'Sovereign', 'Sovereign', 'Sovereign'),
  'Rev29.exchange.buy': L('Buy', '구매', 'Osta', '購入', '购买', 'Comprar', 'ទិញ', 'Acheter', 'Kaufen', 'Comprar', 'Mua', 'Beli', 'Купить', 'खरीदें', 'Acquista', 'Satın al', 'ซื้อ', 'Kup', 'Kopen', 'Bilhin'),
  'Rev29.exchange.owned': L('Owned', '보유 중', 'Ostetud', '購入済み', '已拥有', 'Adquirido', 'មានរួចហើយ', 'Acquis', 'Gekauft', 'Adquirido', 'Đã sở hữu', 'Dimiliki', 'Куплено', 'खरीदा हुआ', 'Acquistato', 'Sahipsin', 'มีแล้ว', 'Posiadane', 'In bezit', 'Nabili na'),
  'Rev29.exchange.insufficient': L('Not enough credits', '크레딧 부족', 'Krediite napib', 'クレジット不足', '积分不足', 'Créditos insuficientes', 'ឥណទានមិនគ្រប់', 'Crédits insuffisants', 'Zu wenig Credits', 'Créditos insuficientes', 'Không đủ tín dụng', 'Kredit tidak cukup', 'Недостаточно кредитов', 'पर्याप्त क्रेडिट नहीं', 'Crediti insufficienti', 'Yetersiz kredi', 'เครดิตไม่พอ', 'Za mało kredytów', 'Te weinig credits', 'Kulang ang credits'),
  'Rev29.exchange.sales': L('{count} sold', '판매 {count}', '{count} müüdud', '{count}件販売', '已售 {count}', '{count} vendidos', 'លក់បាន {count}', '{count} vendus', '{count} verkauft', '{count} vendidos', 'Đã bán {count}', '{count} terjual', 'Продано: {count}', '{count} बिके', '{count} venduti', '{count} satıldı', 'ขายแล้ว {count}', '{count} sprzedanych', '{count} verkocht', '{count} nabenta'),
  'Rev29.exchange.rating': SAME('★ {rating}'),
  'Rev29.exchange.by': SAME('@{handle}'),
  'Rev29.exchange.split': L('Revenue split · creator {creator}% / UNITAS {platform}%', '수익 배분 · 창작자 {creator}% / UNITAS {platform}%', 'Tulujaotus · looja {creator}% / UNITAS {platform}%', '収益配分 · クリエイター {creator}% / UNITAS {platform}%', '收益分成 · 创作者 {creator}% / UNITAS {platform}%', 'Reparto · creador {creator}% / UNITAS {platform}%', 'ការចែកចំណូល · អ្នកបង្កើត {creator}% / UNITAS {platform}%', 'Partage · créateur {creator}% / UNITAS {platform}%', 'Erlösanteil · Creator {creator}% / UNITAS {platform}%', 'Divisão · criador {creator}% / UNITAS {platform}%', 'Chia doanh thu · nhà sáng tạo {creator}% / UNITAS {platform}%', 'Bagi hasil · kreator {creator}% / UNITAS {platform}%', 'Доля · автор {creator}% / UNITAS {platform}%', 'राजस्व बँटवारा · क्रिएटर {creator}% / UNITAS {platform}%', 'Ripartizione · creator {creator}% / UNITAS {platform}%', 'Gelir payı · yaratıcı %{creator} / UNITAS %{platform}', 'แบ่งรายได้ · ครีเอเตอร์ {creator}% / UNITAS {platform}%', 'Podział · twórca {creator}% / UNITAS {platform}%', 'Verdeling · maker {creator}% / UNITAS {platform}%', 'Hati ng kita · creator {creator}% / UNITAS {platform}%'),
  'Rev29.exchange.listTitle': L('List your knowledge', '내 지식 올리기', 'Pane oma teadmised müüki', '知識を出品する', '上架我的知识', 'Publica tu conocimiento', 'ដាក់លក់ចំណេះដឹងរបស់អ្នក', 'Publier votre savoir', 'Eigenes Wissen einstellen', 'Publicar o seu conhecimento', 'Đăng tri thức của bạn', 'Daftarkan pengetahuanmu', 'Выставить свои знания', 'अपना ज्ञान सूचीबद्ध करें', 'Pubblica la tua conoscenza', 'Bilgini listele', 'ลงขายความรู้ของคุณ', 'Wystaw swoją wiedzę', 'Je kennis aanbieden', 'Ilista ang iyong kaalaman'),
  'Rev29.exchange.form.title': L('Title', '제목', 'Pealkiri', 'タイトル', '标题', 'Título', 'ចំណងជើង', 'Titre', 'Titel', 'Título', 'Tiêu đề', 'Judul', 'Название', 'शीर्षक', 'Titolo', 'Başlık', 'ชื่อ', 'Tytuł', 'Titel', 'Pamagat'),
  'Rev29.exchange.form.theme': L('Theme', '테마', 'Teema', 'テーマ', '主题', 'Tema', 'ប្រធានបទ', 'Thème', 'Thema', 'Tema', 'Chủ đề', 'Tema', 'Тема', 'विषय', 'Tema', 'Tema', 'ธีม', 'Temat', 'Thema', 'Tema'),
  'Rev29.exchange.form.price': L('Price (credits)', '가격 (크레딧)', 'Hind (krediidid)', '価格（クレジット）', '价格（积分）', 'Precio (créditos)', 'តម្លៃ (ឥណទាន)', 'Prix (crédits)', 'Preis (Credits)', 'Preço (créditos)', 'Giá (tín dụng)', 'Harga (kredit)', 'Цена (кредиты)', 'कीमत (क्रेडिट)', 'Prezzo (crediti)', 'Fiyat (kredi)', 'ราคา (เครดิต)', 'Cena (kredyty)', 'Prijs (credits)', 'Presyo (credits)'),
  'Rev29.exchange.form.summary': L('One-line summary', '한 줄 요약', 'Üherealine kokkuvõte', '一行の要約', '一句话摘要', 'Resumen en una línea', 'សេចក្តីសង្ខេបមួយបន្ទាត់', 'Résumé en une ligne', 'Einzeiler', 'Resumo numa linha', 'Tóm tắt một dòng', 'Ringkasan satu baris', 'Краткое описание', 'एक पंक्ति सारांश', 'Riassunto in una riga', 'Tek satır özet', 'สรุปหนึ่งบรรทัด', 'Jednolinijkowy opis', 'Samenvatting in één regel', 'Isang-linyang buod'),
  'Rev29.exchange.form.submit': L('List it', '등록', 'Lisa', '出品', '上架', 'Publicar', 'ដាក់លក់', 'Publier', 'Einstellen', 'Publicar', 'Đăng', 'Daftarkan', 'Выставить', 'सूचीबद्ध करें', 'Pubblica', 'Listele', 'ลงขาย', 'Wystaw', 'Aanbieden', 'Ilista'),
  'Rev29.exchange.form.errTitle': L('Title: 3–60 characters', '제목은 3~60자', 'Pealkiri: 3–60 märki', 'タイトルは3〜60文字', '标题需 3–60 个字符', 'Título: 3–60 caracteres', 'ចំណងជើង៖ 3–60 តួអក្សរ', 'Titre : 3–60 caractères', 'Titel: 3–60 Zeichen', 'Título: 3–60 caracteres', 'Tiêu đề: 3–60 ký tự', 'Judul: 3–60 karakter', 'Название: 3–60 символов', 'शीर्षक: 3–60 अक्षर', 'Titolo: 3–60 caratteri', 'Başlık: 3–60 karakter', 'ชื่อ: 3–60 ตัวอักษร', 'Tytuł: 3–60 znaków', 'Titel: 3–60 tekens', 'Pamagat: 3–60 na karakter'),
  'Rev29.exchange.form.errPrice': L('Price: a whole number from 10 to 5,000 credits', '가격은 10~5,000 크레딧의 정수', 'Hind: täisarv 10–5000 krediiti', '価格は10〜5,000クレジットの整数', '价格需为 10–5,000 积分的整数', 'Precio: entero de 10 a 5.000 créditos', 'តម្លៃ៖ លេខគត់ពី 10 ដល់ 5,000 ឥណទាន', 'Prix : entier de 10 à 5 000 crédits', 'Preis: ganze Zahl von 10 bis 5.000 Credits', 'Preço: inteiro de 10 a 5.000 créditos', 'Giá: số nguyên từ 10 đến 5.000 tín dụng', 'Harga: bilangan bulat 10–5.000 kredit', 'Цена: целое число от 10 до 5 000 кредитов', 'कीमत: 10 से 5,000 क्रेडिट की पूर्ण संख्या', 'Prezzo: intero da 10 a 5.000 crediti', 'Fiyat: 10–5.000 kredi arası tam sayı', 'ราคา: จำนวนเต็ม 10–5,000 เครดิต', 'Cena: liczba całkowita 10–5000 kredytów', 'Prijs: geheel getal van 10 tot 5.000 credits', 'Presyo: buong numero mula 10 hanggang 5,000 credits'),
  'Rev29.exchange.form.errSummary': L('Summary: up to 200 characters', '요약은 200자 이내', 'Kokkuvõte: kuni 200 märki', '要約は200文字以内', '摘要最多 200 个字符', 'Resumen: hasta 200 caracteres', 'សេចក្តីសង្ខេប៖ រហូតដល់ 200 តួអក្សរ', 'Résumé : 200 caractères max', 'Zusammenfassung: bis 200 Zeichen', 'Resumo: até 200 caracteres', 'Tóm tắt: tối đa 200 ký tự', 'Ringkasan: maksimal 200 karakter', 'Описание: до 200 символов', 'सारांश: अधिकतम 200 अक्षर', 'Riassunto: fino a 200 caratteri', 'Özet: en fazla 200 karakter', 'สรุป: ไม่เกิน 200 ตัวอักษร', 'Opis: do 200 znaków', 'Samenvatting: max. 200 tekens', 'Buod: hanggang 200 na karakter'),
  'Rev29.exchange.myListings': L('My listings', '내 등록', 'Minu pakkumised', '出品中', '我的上架', 'Mis publicaciones', 'ការដាក់លក់របស់ខ្ញុំ', 'Mes publications', 'Meine Angebote', 'As minhas publicações', 'Gói của tôi', 'Daftar saya', 'Мои лоты', 'मेरी सूचियाँ', 'Le mie pubblicazioni', 'Listelerim', 'รายการของฉัน', 'Moje oferty', 'Mijn aanbiedingen', 'Mga listing ko'),
  'Rev29.exchange.status.review': L('In review', '심사 중', 'Ülevaatusel', '審査中', '审核中', 'En revisión', 'កំពុងពិនិត្យ', 'En cours d’examen', 'In Prüfung', 'Em revisão', 'Đang xét duyệt', 'Dalam tinjauan', 'На проверке', 'समीक्षा में', 'In revisione', 'İncelemede', 'กำลังตรวจสอบ', 'W trakcie weryfikacji', 'In beoordeling', 'Nire-review'),
  'Rev29.exchange.status.live': L('Live', '판매 중', 'Müügis', '販売中', '已上架', 'Publicado', 'កំពុងលក់', 'En ligne', 'Online', 'Publicado', 'Đang bán', 'Aktif', 'В продаже', 'लाइव', 'Online', 'Yayında', 'เปิดขาย', 'Aktywna', 'Live', 'Live'),
  'Rev29.exchange.projected': L('Projected earnings (simulation)', '예상 수익(시뮬레이션)', 'Prognoositud tulu (simulatsioon)', '予想収益（シミュレーション）', '预计收益（模拟）', 'Ingresos previstos (simulación)', 'ចំណូលរំពឹងទុក (ការក្លែងធ្វើ)', 'Revenus projetés (simulation)', 'Prognose-Erlös (Simulation)', 'Receita prevista (simulação)', 'Doanh thu dự kiến (mô phỏng)', 'Proyeksi pendapatan (simulasi)', 'Прогноз дохода (симуляция)', 'अनुमानित आय (सिमुलेशन)', 'Ricavi previsti (simulazione)', 'Tahmini gelir (simülasyon)', 'รายได้คาดการณ์ (จำลอง)', 'Prognozowany przychód (symulacja)', 'Verwachte opbrengst (simulatie)', 'Tinatayang kita (simulation)'),
  'Rev29.exchange.projectedSales': L('{count} projected sales', '예상 판매 {count}건', '{count} prognoositud müüki', '予想販売 {count}件', '预计销量 {count}', '{count} ventas previstas', 'ការលក់រំពឹងទុក {count}', '{count} ventes projetées', '{count} prognostizierte Verkäufe', '{count} vendas previstas', '{count} lượt bán dự kiến', '{count} proyeksi penjualan', 'Прогноз продаж: {count}', '{count} अनुमानित बिक्री', '{count} vendite previste', '{count} tahmini satış', 'ยอดขายคาดการณ์ {count}', '{count} prognozowanych sprzedaży', '{count} verwachte verkopen', '{count} tinatayang benta'),
  'Rev29.exchange.board': L('Top creators', '톱 크리에이터', 'Tippautorid', 'トップクリエイター', '顶级创作者', 'Mejores creadores', 'អ្នកបង្កើតកំពូល', 'Meilleurs créateurs', 'Top-Creator', 'Melhores criadores', 'Nhà sáng tạo hàng đầu', 'Kreator teratas', 'Топ авторов', 'शीर्ष क्रिएटर', 'Top creator', 'En iyi yaratıcılar', 'ครีเอเตอร์ยอดนิยม', 'Najlepsi twórcy', 'Topmakers', 'Nangungunang creator'),
  'Rev29.exchange.ticker': L('Live trades', '실시간 거래', 'Otsetehingud', 'リアルタイム取引', '实时交易', 'Operaciones en vivo', 'ការជួញដូរផ្ទាល់', 'Échanges en direct', 'Live-Trades', 'Negócios ao vivo', 'Giao dịch trực tiếp', 'Transaksi langsung', 'Сделки в эфире', 'लाइव ट्रेड', 'Scambi live', 'Canlı işlemler', 'การซื้อขายสด', 'Transakcje na żywo', 'Live-transacties', 'Live na trade'),
  'Rev29.exchange.tickerEmpty': L('No trade signal yet — make the first one.', '아직 거래 신호가 없습니다 — 첫 거래를 만들어 보세요.', 'Tehinguid veel pole — tee esimene.', 'まだ取引はありません — 最初の取引を作りましょう。', '还没有交易信号 — 来做第一笔吧。', 'Aún no hay operaciones — haz la primera.', 'មិនទាន់មានសញ្ញាជួញដូរទេ — បង្កើតដំបូងសិន។', 'Aucun échange pour l’instant — faites le premier.', 'Noch kein Trade — mach den ersten.', 'Ainda sem negócios — faça o primeiro.', 'Chưa có giao dịch nào — hãy tạo giao dịch đầu tiên.', 'Belum ada transaksi — jadilah yang pertama.', 'Сделок пока нет — совершите первую.', 'अभी कोई ट्रेड नहीं — पहला आप करें।', 'Nessuno scambio ancora — fai il primo.', 'Henüz işlem yok — ilkini sen yap.', 'ยังไม่มีการซื้อขาย — เริ่มรายการแรกเลย', 'Brak transakcji — zrób pierwszą.', 'Nog geen transacties — doe de eerste.', 'Wala pang trade — gawin ang una.'),
  'Rev29.exchange.tickerRow': SAME('{buyer} · {pack}'),
  'Rev29.exchange.bought': L('Bought — added to your library', '구매 완료 — 내 서재에 추가됨', 'Ostetud — lisatud sinu raamatukokku', '購入完了 — ライブラリに追加', '已购买 — 已加入我的书架', 'Comprado — añadido a tu biblioteca', 'បានទិញ — បន្ថែមទៅបណ្ណាល័យរបស់អ្នក', 'Acheté — ajouté à votre bibliothèque', 'Gekauft — in deiner Bibliothek', 'Comprado — adicionado à sua biblioteca', 'Đã mua — đã thêm vào thư viện', 'Dibeli — ditambahkan ke perpustakaanmu', 'Куплено — добавлено в библиотеку', 'खरीदा — आपकी लाइब्रेरी में जोड़ा', 'Acquistato — aggiunto alla tua libreria', 'Satın alındı — kitaplığına eklendi', 'ซื้อแล้ว — เพิ่มในคลังของคุณ', 'Kupiono — dodano do biblioteki', 'Gekocht — toegevoegd aan je bibliotheek', 'Nabili — idinagdag sa library mo'),
  'Rev29.exchange.myPacks': L('My library', '내 서재', 'Minu raamatukogu', 'マイライブラリ', '我的书架', 'Mi biblioteca', 'បណ្ណាល័យរបស់ខ្ញុំ', 'Ma bibliothèque', 'Meine Bibliothek', 'A minha biblioteca', 'Thư viện của tôi', 'Perpustakaanku', 'Моя библиотека', 'मेरी लाइब्रेरी', 'La mia libreria', 'Kitaplığım', 'คลังของฉัน', 'Moja biblioteka', 'Mijn bibliotheek', 'Library ko'),

  // -- M4: theme chat rooms --------------------------------------------
  'Rev29.rooms.lede': L(
    '22 theme rooms — talk about the same subjects the world is talking about right now. Messages never touch a server; this device keeps the last 60 per room.',
    '22개 테마 방 — 지금 세계가 말하는 주제로 대화합니다. 메시지는 서버에 남지 않고 이 기기에만 방마다 최근 60개가 보관됩니다.',
    '22 teemaruumi — räägi samadel teemadel, millest maailm praegu räägib. Sõnumid ei puuduta serverit; see seade hoiab iga ruumi viimased 60.',
    '22のテーマ別ルーム — 今世界が語っている話題で会話しましょう。メッセージはサーバーに残らず、この端末に各ルーム最新60件だけ保存されます。',
    '22 个主题房间 — 讨论世界此刻正在谈论的话题。消息不经过服务器，本设备仅保留每个房间最近 60 条。',
    '22 salas temáticas — habla de lo mismo que el mundo habla ahora. Los mensajes nunca tocan un servidor; este dispositivo guarda los últimos 60 por sala.',
    'បន្ទប់ 22 ប្រធានបទ — និយាយអំពីប្រធានបទដែលពិភពលោកកំពុងនិយាយឥឡូវនេះ។ សារមិនប៉ះម៉ាស៊ីនមេទេ ឧបករណ៍នេះរក្សា 60 ចុងក្រោយក្នុងមួយបន្ទប់។',
    '22 salons thématiques — parlez des sujets dont le monde parle en ce moment. Les messages ne touchent jamais un serveur ; cet appareil garde les 60 derniers par salon.',
    '22 Themenräume — sprecht über das, worüber die Welt gerade spricht. Nachrichten berühren keinen Server; dieses Gerät behält die letzten 60 je Raum.',
    '22 salas temáticas — fale sobre os mesmos assuntos de que o mundo fala agora. As mensagens nunca passam por um servidor; este dispositivo guarda as últimas 60 por sala.',
    '22 phòng theo chủ đề — trò chuyện về những gì thế giới đang nói. Tin nhắn không qua máy chủ; thiết bị này lưu 60 tin gần nhất mỗi phòng.',
    '22 ruang tema — bicarakan topik yang sedang dibicarakan dunia. Pesan tidak pernah menyentuh server; perangkat ini menyimpan 60 terakhir per ruang.',
    '22 тематических комнаты — обсуждайте то, о чём говорит мир прямо сейчас. Сообщения не касаются сервера; это устройство хранит последние 60 в каждой комнате.',
    '22 थीम रूम — उन्हीं विषयों पर बात करें जिन पर दुनिया अभी बात कर रही है। संदेश सर्वर पर नहीं जाते; यह डिवाइस हर रूम के अंतिम 60 रखता है।',
    '22 stanze tematiche — parla degli stessi argomenti di cui parla il mondo adesso. I messaggi non toccano mai un server; questo dispositivo conserva gli ultimi 60 per stanza.',
    '22 tema odası — dünyanın şu an konuştuğu konuları konuş. Mesajlar sunucuya dokunmaz; bu cihaz oda başına son 60 mesajı tutar.',
    'ห้องธีม 22 ห้อง — คุยเรื่องเดียวกับที่โลกกำลังพูดถึงตอนนี้ ข้อความไม่ผ่านเซิร์ฟเวอร์ อุปกรณ์นี้เก็บ 60 ข้อความล่าสุดต่อห้อง',
    '22 pokoje tematyczne — rozmawiaj o tym, o czym mówi teraz świat. Wiadomości nie dotykają serwera; to urządzenie zachowuje ostatnie 60 na pokój.',
    '22 themakamers — praat over wat de wereld nu bespreekt. Berichten raken nooit een server; dit apparaat bewaart de laatste 60 per kamer.',
    '22 theme room — pag-usapan ang mga paksang pinag-uusapan ng mundo ngayon. Hindi dumadaan sa server ang mga mensahe; itinatago ng device na ito ang huling 60 bawat room.',
  ),
  'Rev29.rooms.placeholder': L('Type a message and press Enter…', '메시지를 입력하고 Enter…', 'Kirjuta sõnum ja vajuta Enter…', 'メッセージを入力してEnter…', '输入消息并按 Enter…', 'Escribe un mensaje y pulsa Enter…', 'វាយសារ ហើយចុច Enter…', 'Écrivez un message puis Entrée…', 'Nachricht eingeben und Enter…', 'Escreva uma mensagem e prima Enter…', 'Nhập tin nhắn và nhấn Enter…', 'Ketik pesan lalu tekan Enter…', 'Введите сообщение и нажмите Enter…', 'संदेश लिखें और Enter दबाएँ…', 'Scrivi un messaggio e premi Invio…', 'Mesaj yaz ve Enter’a bas…', 'พิมพ์ข้อความแล้วกด Enter…', 'Wpisz wiadomość i naciśnij Enter…', 'Typ een bericht en druk op Enter…', 'Mag-type ng mensahe at pindutin ang Enter…'),
  'Rev29.rooms.send': L('Send', '보내기', 'Saada', '送信', '发送', 'Enviar', 'ផ្ញើ', 'Envoyer', 'Senden', 'Enviar', 'Gửi', 'Kirim', 'Отправить', 'भेजें', 'Invia', 'Gönder', 'ส่ง', 'Wyślij', 'Verstuur', 'Ipadala'),
  'Rev29.rooms.you': L('You', '나', 'Sina', 'あなた', '我', 'Tú', 'អ្នក', 'Vous', 'Du', 'Você', 'Bạn', 'Kamu', 'Вы', 'आप', 'Tu', 'Sen', 'คุณ', 'Ty', 'Jij', 'Ikaw'),
  'Rev29.rooms.empty': L('No conversation yet — leave the first hello.', '아직 대화가 없습니다 — 첫 인사를 남겨 보세요.', 'Vestlust veel pole — jäta esimene tervitus.', 'まだ会話がありません — 最初の挨拶をどうぞ。', '还没有对话 — 留下第一声问候吧。', 'Aún no hay conversación — deja el primer saludo.', 'មិនទាន់មានការសន្ទនាទេ — ទុកការស្វាគមន៍ដំបូង។', 'Pas encore de conversation — laissez le premier bonjour.', 'Noch kein Gespräch — hinterlasse das erste Hallo.', 'Ainda sem conversa — deixe o primeiro olá.', 'Chưa có cuộc trò chuyện — hãy gửi lời chào đầu tiên.', 'Belum ada percakapan — tinggalkan sapaan pertama.', 'Разговора ещё нет — оставьте первое приветствие.', 'अभी कोई बातचीत नहीं — पहला नमस्ते आप कहें।', 'Nessuna conversazione ancora — lascia il primo saluto.', 'Henüz sohbet yok — ilk selamı sen ver.', 'ยังไม่มีบทสนทนา — ทักทายเป็นคนแรกเลย', 'Brak rozmowy — zostaw pierwsze cześć.', 'Nog geen gesprek — laat de eerste groet achter.', 'Wala pang usapan — mag-iwan ng unang hello.'),
  'Rev29.rooms.welcome': L('Welcome to the {room} room.', '{room} 방에 오신 것을 환영합니다.', 'Tere tulemast ruumi {room}.', '{room}ルームへようこそ。', '欢迎来到「{room}」房间。', 'Bienvenido a la sala {room}.', 'សូមស្វាគមន៍មកកាន់បន្ទប់ {room}។', 'Bienvenue dans le salon {room}.', 'Willkommen im Raum {room}.', 'Bem-vindo à sala {room}.', 'Chào mừng đến phòng {room}.', 'Selamat datang di ruang {room}.', 'Добро пожаловать в комнату «{room}».', '{room} रूम में आपका स्वागत है।', 'Benvenuto nella stanza {room}.', '{room} odasına hoş geldin.', 'ยินดีต้อนรับสู่ห้อง {room}', 'Witaj w pokoju {room}.', 'Welkom in de kamer {room}.', 'Maligayang pagdating sa {room} room.'),
  'Rev29.rooms.speakingAs': L('Speaking as {name}', '{name}(으)로 대화 중', 'Räägid kui {name}', '{name}として発言中', '以 {name} 身份发言', 'Hablas como {name}', 'កំពុងនិយាយក្នុងនាម {name}', 'Vous parlez en tant que {name}', 'Du sprichst als {name}', 'A falar como {name}', 'Đang nói với tên {name}', 'Berbicara sebagai {name}', 'Вы пишете как {name}', '{name} के रूप में बोल रहे हैं', 'Parli come {name}', '{name} olarak konuşuyorsun', 'กำลังพูดในชื่อ {name}', 'Mówisz jako {name}', 'Je spreekt als {name}', 'Nagsasalita bilang {name}'),
  'Rev29.rooms.roomAria': L('{room} chat room', '{room} 대화방', '{room} vestlusruum', '{room}チャットルーム', '{room} 聊天室', 'Sala de chat {room}', 'បន្ទប់ជជែក {room}', 'Salon {room}', 'Chatraum {room}', 'Sala de chat {room}', 'Phòng chat {room}', 'Ruang obrolan {room}', 'Чат «{room}»', '{room} चैट रूम', 'Stanza chat {room}', '{room} sohbet odası', 'ห้องแชท {room}', 'Pokój czatu {room}', 'Chatroom {room}', '{room} chat room'),

  // -- M4: social ----------------------------------------------------------
  'Rev29.social.lede': L(
    'Jump straight to the world’s social and mail apps, and share UNITAS in one tap.',
    '세계의 소셜·메일 앱으로 바로 가고, UNITAS를 한 번에 공유하세요.',
    'Hüppa otse maailma sotsiaal- ja meilirakendustesse ning jaga UNITASt ühe puudutusega.',
    '世界のソーシャル・メールアプリへ直行し、UNITASをワンタップで共有しましょう。',
    '直达全球社交与邮件应用，一键分享 UNITAS。',
    'Ve directo a las apps sociales y de correo del mundo y comparte UNITAS con un toque.',
    'ចូលទៅកាន់កម្មវិធីសង្គម និងអ៊ីមែលរបស់ពិភពលោកដោយផ្ទាល់ ហើយចែករំលែក UNITAS ក្នុងមួយប៉ះ។',
    'Accédez directement aux apps sociales et mail du monde et partagez UNITAS en un geste.',
    'Direkt zu den Social- und Mail-Apps der Welt, und UNITAS mit einem Tipp teilen.',
    'Vá direto às apps sociais e de email do mundo e partilhe a UNITAS num toque.',
    'Đi thẳng đến các ứng dụng mạng xã hội và thư của thế giới, và chia sẻ UNITAS chỉ một chạm.',
    'Langsung ke aplikasi sosial dan email dunia, dan bagikan UNITAS sekali ketuk.',
    'Переходите сразу в соцсети и почту мира и делитесь UNITAS одним касанием.',
    'दुनिया के सोशल और मेल ऐप्स पर सीधे जाएँ, और एक टैप में UNITAS साझा करें।',
    'Vai dritto alle app social e mail del mondo e condividi UNITAS con un tocco.',
    'Dünyanın sosyal ve posta uygulamalarına doğrudan git, UNITAS’ı tek dokunuşla paylaş.',
    'ไปยังแอปโซเชียลและอีเมลของโลกได้ทันที และแชร์ UNITAS ในแตะเดียว',
    'Przejdź prosto do aplikacji społecznościowych i pocztowych świata i udostępnij UNITAS jednym dotknięciem.',
    'Ga direct naar de sociale en mail-apps van de wereld en deel UNITAS met één tik.',
    'Dumiretso sa mga social at mail app ng mundo, at ibahagi ang UNITAS sa isang tap.',
  ),
  'Rev29.social.apps': L('Direct shortcuts', '바로가기', 'Otseteed', 'ショートカット', '快捷入口', 'Accesos directos', 'ផ្លូវកាត់', 'Raccourcis', 'Direktlinks', 'Atalhos', 'Lối tắt', 'Pintasan', 'Быстрые ссылки', 'शॉर्टकट', 'Scorciatoie', 'Kısayollar', 'ทางลัด', 'Skróty', 'Snelkoppelingen', 'Mga shortcut'),
  'Rev29.social.mail': L('Webmail', '웹메일', 'Veebipost', 'ウェブメール', '网页邮箱', 'Correo web', 'អ៊ីមែលបណ្ដាញ', 'Webmail', 'Webmail', 'Webmail', 'Webmail', 'Webmail', 'Веб-почта', 'वेबमेल', 'Webmail', 'Web posta', 'เว็บเมล', 'Poczta', 'Webmail', 'Webmail'),
  'Rev29.social.share': L('Share UNITAS', 'UNITAS 공유', 'Jaga UNITASt', 'UNITASを共有', '分享 UNITAS', 'Compartir UNITAS', 'ចែករំលែក UNITAS', 'Partager UNITAS', 'UNITAS teilen', 'Partilhar a UNITAS', 'Chia sẻ UNITAS', 'Bagikan UNITAS', 'Поделиться UNITAS', 'UNITAS साझा करें', 'Condividi UNITAS', 'UNITAS’ı paylaş', 'แชร์ UNITAS', 'Udostępnij UNITAS', 'Deel UNITAS', 'Ibahagi ang UNITAS'),
  'Rev29.social.shareText': L('UNITAS — the sovereign SaaS network. Ask U-AI anything.', 'UNITAS — 소버린 SaaS 네트워크. U-AI에게 무엇이든 물어보세요.', 'UNITAS — suveräänne SaaS-võrgustik. Küsi U-AI-lt mida iganes.', 'UNITAS — ソブリンSaaSネットワーク。U-AIに何でも聞いてください。', 'UNITAS — 主权 SaaS 网络。向 U-AI 提出任何问题。', 'UNITAS — la red SaaS soberana. Pregúntale lo que sea a U-AI.', 'UNITAS — បណ្តាញ SaaS អធិបតេយ្យ។ សួរ U-AI អ្វីក៏បាន។', 'UNITAS — le réseau SaaS souverain. Demandez tout à U-AI.', 'UNITAS — das souveräne SaaS-Netzwerk. Frag U-AI alles.', 'UNITAS — a rede SaaS soberana. Pergunte tudo à U-AI.', 'UNITAS — mạng SaaS chủ quyền. Hỏi U-AI bất cứ điều gì.', 'UNITAS — jaringan SaaS berdaulat. Tanyakan apa saja ke U-AI.', 'UNITAS — суверенная SaaS-сеть. Спросите U-AI о чём угодно.', 'UNITAS — सॉवरेन SaaS नेटवर्क। U-AI से कुछ भी पूछें।', 'UNITAS — la rete SaaS sovrana. Chiedi qualsiasi cosa a U-AI.', 'UNITAS — egemen SaaS ağı. U-AI’ya her şeyi sor.', 'UNITAS — เครือข่าย SaaS อธิปไตย ถาม U-AI ได้ทุกเรื่อง', 'UNITAS — suwerenna sieć SaaS. Zapytaj U-AI o cokolwiek.', 'UNITAS — het soevereine SaaS-netwerk. Vraag U-AI alles.', 'UNITAS — ang sovereign na SaaS network. Itanong ang kahit ano sa U-AI.'),
  'Rev29.social.copy': L('Copy link', '링크 복사', 'Kopeeri link', 'リンクをコピー', '复制链接', 'Copiar enlace', 'ចម្លងតំណ', 'Copier le lien', 'Link kopieren', 'Copiar ligação', 'Sao chép liên kết', 'Salin tautan', 'Копировать ссылку', 'लिंक कॉपी करें', 'Copia link', 'Bağlantıyı kopyala', 'คัดลอกลิงก์', 'Kopiuj link', 'Link kopiëren', 'Kopyahin ang link'),
  'Rev29.social.copied': L('Copied', '복사됨', 'Kopeeritud', 'コピー完了', '已复制', 'Copiado', 'បានចម្លង', 'Copié', 'Kopiert', 'Copiado', 'Đã sao chép', 'Tersalin', 'Скопировано', 'कॉपी हो गया', 'Copiato', 'Kopyalandı', 'คัดลอกแล้ว', 'Skopiowano', 'Gekopieerd', 'Nakopya'),
  'Rev29.social.native': L('Share…', '공유…', 'Jaga…', '共有…', '分享…', 'Compartir…', 'ចែករំលែក…', 'Partager…', 'Teilen…', 'Partilhar…', 'Chia sẻ…', 'Bagikan…', 'Поделиться…', 'साझा करें…', 'Condividi…', 'Paylaş…', 'แชร์…', 'Udostępnij…', 'Delen…', 'Ibahagi…'),

  // -- M5: short attach labels ---------------------------------------------
  'Rev29.attach.file': L('Attach file', '파일 첨부', 'Lisa fail', 'ファイル添付', '附加文件', 'Adjuntar archivo', 'ភ្ជាប់ឯកសារ', 'Joindre un fichier', 'Datei anhängen', 'Anexar ficheiro', 'Đính kèm tệp', 'Lampirkan berkas', 'Прикрепить файл', 'फ़ाइल जोड़ें', 'Allega file', 'Dosya ekle', 'แนบไฟล์', 'Załącz plik', 'Bestand bijvoegen', 'Ilakip ang file'),
  'Rev29.attach.video': L('Attach video', '동영상 첨부', 'Lisa video', '動画添付', '附加视频', 'Adjuntar video', 'ភ្ជាប់វីដេអូ', 'Joindre une vidéo', 'Video anhängen', 'Anexar vídeo', 'Đính kèm video', 'Lampirkan video', 'Прикрепить видео', 'वीडियो जोड़ें', 'Allega video', 'Video ekle', 'แนบวิดีโอ', 'Załącz wideo', 'Video bijvoegen', 'Ilakip ang video'),
  'Rev29.attach.sketch': L('Attach sketch', '스케치 첨부', 'Lisa visand', 'スケッチ添付', '附加草图', 'Adjuntar boceto', 'ភ្ជាប់រូបព្រាង', 'Joindre un croquis', 'Skizze anhängen', 'Anexar esboço', 'Đính kèm phác thảo', 'Lampirkan sketsa', 'Прикрепить эскиз', 'स्केच जोड़ें', 'Allega schizzo', 'Taslak ekle', 'แนบภาพร่าง', 'Załącz szkic', 'Schets bijvoegen', 'Ilakip ang sketch'),

  // -- M3: new products slot ------------------------------------------------
  'Rev20.slots.newProducts.title': L('New Products', '글로벌 신상품', 'Uued tooted', '新製品', '全球新品', 'Novedades', 'ផលិតផលថ្មី', 'Nouveautés', 'Neue Produkte', 'Novidades', 'Sản phẩm mới', 'Produk baru', 'Новинки', 'नए उत्पाद', 'Novità', 'Yeni ürünler', 'สินค้าใหม่', 'Nowości', 'Nieuwe producten', 'Bagong produkto'),
  'Rev20.slots.newProducts.tag': L('Cars, phones, mobility, gadgets and games the world just released', '세계가 방금 출시한 자동차·스마트폰·모빌리티·가젯·게임', 'Autod, telefonid, liikuvus, vidinad ja mängud, mille maailm just välja lasi', '世界が今出したばかりの車・スマホ・モビリティ・ガジェット・ゲーム', '世界刚刚发布的汽车、手机、出行工具、数码产品和游戏', 'Coches, móviles, movilidad, gadgets y juegos recién lanzados en el mundo', 'រថយន្ត ទូរស័ព្ទ ចលនភាព ឧបករណ៍ និងហ្គេមដែលពិភពលោកទើបចេញ', 'Voitures, téléphones, mobilité, gadgets et jeux que le monde vient de lancer', 'Autos, Handys, Mobilität, Gadgets und Spiele, die die Welt gerade veröffentlicht hat', 'Carros, telemóveis, mobilidade, gadgets e jogos que o mundo acabou de lançar', 'Xe hơi, điện thoại, phương tiện, thiết bị và game thế giới vừa ra mắt', 'Mobil, ponsel, mobilitas, gadget, dan gim yang baru dirilis dunia', 'Автомобили, смартфоны, мобильность, гаджеты и игры, только что вышедшие в мире', 'दुनिया ने अभी-अभी जारी की कारें, फोन, मोबिलिटी, गैजेट और गेम', 'Auto, telefoni, mobilità, gadget e giochi appena lanciati nel mondo', 'Dünyanın az önce piyasaya sürdüğü arabalar, telefonlar, mobilite, gadget’lar ve oyunlar', 'รถยนต์ โทรศัพท์ ยานพาหนะ แกดเจ็ต และเกมที่โลกเพิ่งเปิดตัว', 'Samochody, telefony, mobilność, gadżety i gry, które świat właśnie wypuścił', 'Auto’s, telefoons, mobiliteit, gadgets en games die de wereld net uitbracht', 'Mga kotse, telepono, mobility, gadget at laro na kalalabas lang sa mundo'),
  'Rev29.newProducts.families.cars': L('Cars', '자동차', 'Autod', '自動車', '汽车', 'Coches', 'រថយន្ត', 'Voitures', 'Autos', 'Carros', 'Xe hơi', 'Mobil', 'Автомобили', 'कारें', 'Auto', 'Arabalar', 'รถยนต์', 'Samochody', 'Auto’s', 'Kotse'),
  'Rev29.newProducts.families.phones': L('Smartphones', '스마트폰', 'Nutitelefonid', 'スマートフォン', '智能手机', 'Smartphones', 'ស្មាតហ្វូន', 'Smartphones', 'Smartphones', 'Smartphones', 'Điện thoại', 'Ponsel', 'Смартфоны', 'स्मार्टफोन', 'Smartphone', 'Akıllı telefonlar', 'สมาร์ตโฟน', 'Smartfony', 'Smartphones', 'Smartphone'),
  'Rev29.newProducts.families.mobility': L('Mobility', '모빌리티', 'Liikuvus', 'モビリティ', '出行', 'Movilidad', 'ចលនភាព', 'Mobilité', 'Mobilität', 'Mobilidade', 'Phương tiện', 'Mobilitas', 'Мобильность', 'मोबिलिटी', 'Mobilità', 'Mobilite', 'ยานพาหนะ', 'Mobilność', 'Mobiliteit', 'Mobility'),
  'Rev29.newProducts.families.gadgets': L('Gadgets', '가젯', 'Vidinad', 'ガジェット', '数码', 'Gadgets', 'ឧបករណ៍', 'Gadgets', 'Gadgets', 'Gadgets', 'Thiết bị', 'Gadget', 'Гаджеты', 'गैजेट', 'Gadget', 'Gadget’lar', 'แกดเจ็ต', 'Gadżety', 'Gadgets', 'Gadget'),
  'Rev29.newProducts.families.games': L('Games', '게임', 'Mängud', 'ゲーム', '游戏', 'Juegos', 'ហ្គេម', 'Jeux', 'Spiele', 'Jogos', 'Game', 'Gim', 'Игры', 'गेम', 'Giochi', 'Oyunlar', 'เกม', 'Gry', 'Games', 'Laro'),
  'Rev29.newProducts.facts.count': L('New releases', '신상품', 'Uued', '新製品数', '新品', 'Novedades', 'ថ្មី', 'Nouveautés', 'Neu', 'Novidades', 'Mới', 'Baru', 'Новинки', 'नए', 'Novità', 'Yeni', 'ใหม่', 'Nowe', 'Nieuw', 'Bago'),

  // -- M2: news popup copy --------------------------------------------------
  'HotNews.openOriginal': L('Read the original', '원문 보기', 'Loe originaali', '原文を読む', '查看原文', 'Leer el original', 'អានអត្ថបទដើម', 'Lire l’original', 'Original lesen', 'Ler o original', 'Đọc bài gốc', 'Baca aslinya', 'Читать оригинал', 'मूल लेख पढ़ें', 'Leggi l’originale', 'Orijinali oku', 'อ่านต้นฉบับ', 'Czytaj oryginał', 'Origineel lezen', 'Basahin ang orihinal'),
  'HotNews.storyCount': L('{count} stories', '{count}건', '{count} lugu', '{count}件', '{count} 条', '{count} noticias', '{count} រឿង', '{count} articles', '{count} Meldungen', '{count} notícias', '{count} tin', '{count} berita', 'Материалов: {count}', '{count} खबरें', '{count} notizie', '{count} haber', '{count} ข่าว', '{count} wiadomości', '{count} berichten', '{count} balita'),
  'HotNews.axisTag': L('Worldwide and local {axis} headlines — tap a story for its own popup', '세계와 내 나라의 {axis} 헤드라인 — 항목을 누르면 세부 팝업', 'Maailma ja kohalikud {axis} pealkirjad — puuduta lugu, et avada', '世界と国内の{axis}ヘッドライン — 記事をタップすると詳細ポップアップ', '全球与本地的{axis}头条 — 点击一条查看详情弹窗', 'Titulares de {axis} del mundo y de tu país — toca una noticia para abrirla', 'ចំណងជើង {axis} ពិភពលោក និងក្នុងស្រុក — ប៉ះរឿងដើម្បីបើក', 'Titres {axis} du monde et de chez vous — touchez un article pour l’ouvrir', '{axis}-Schlagzeilen aus der Welt und von zu Hause — Meldung antippen zum Öffnen', 'Manchetes de {axis} do mundo e do seu país — toque numa notícia para a abrir', 'Tin {axis} toàn cầu và trong nước — chạm để mở chi tiết', 'Berita {axis} dunia dan lokal — ketuk berita untuk membukanya', 'Заголовки «{axis}» в мире и в стране — нажмите, чтобы открыть', 'दुनिया और देश की {axis} सुर्खियाँ — खोलने के लिए खबर पर टैप करें', 'Titoli {axis} dal mondo e dal tuo paese — tocca una notizia per aprirla', 'Dünyadan ve ülkenden {axis} başlıkları — açmak için habere dokun', 'พาดหัว {axis} ทั่วโลกและในประเทศ — แตะข่าวเพื่อเปิด', 'Nagłówki {axis} ze świata i z kraju — dotknij, by otworzyć', '{axis}-koppen uit de wereld en van thuis — tik op een bericht om te openen', 'Mga {axis} headline sa mundo at sa bansa — i-tap ang balita para buksan'),
  'HotNews.detailAria': L('Open {title}', '{title} 세부 보기', 'Ava {title}', '{title}を開く', '打开 {title}', 'Abrir {title}', 'បើក {title}', 'Ouvrir {title}', '{title} öffnen', 'Abrir {title}', 'Mở {title}', 'Buka {title}', 'Открыть «{title}»', '{title} खोलें', 'Apri {title}', '{title} aç', 'เปิด {title}', 'Otwórz {title}', '{title} openen', 'Buksan ang {title}'),
  'HotNews.allStories': L('Every {axis} story, worldwide first, then your country', '{axis} 전체 헤드라인 — 세계 먼저, 그다음 내 나라', 'Kõik {axis} lood — kõigepealt maailm, siis sinu riik', '{axis}の全記事 — 世界、次に国内', '全部{axis}新闻 — 先全球，后本国', 'Todas las noticias de {axis}: primero el mundo, luego tu país', 'រឿង {axis} ទាំងអស់ — ពិភពលោកមុន បន្ទាប់មកប្រទេសអ្នក', 'Tous les articles {axis} : le monde d’abord, puis votre pays', 'Alle {axis}-Meldungen — erst die Welt, dann dein Land', 'Todas as notícias de {axis}: primeiro o mundo, depois o seu país', 'Tất cả tin {axis} — thế giới trước, rồi đến nước bạn', 'Semua berita {axis} — dunia dulu, lalu negaramu', 'Все материалы «{axis}» — сначала мир, затем ваша страна', 'सभी {axis} खबरें — पहले दुनिया, फिर आपका देश', 'Tutte le notizie {axis}: prima il mondo, poi il tuo paese', 'Tüm {axis} haberleri — önce dünya, sonra ülken', 'ข่าว {axis} ทั้งหมด — ทั่วโลกก่อน แล้วประเทศคุณ', 'Wszystkie wiadomości {axis} — najpierw świat, potem twój kraj', 'Alle {axis}-berichten — eerst de wereld, dan je land', 'Lahat ng {axis} na balita — mundo muna, saka ang bansa mo'),

  // -- M4: shorts filter (the rest of the Shorts tree is restored below) --
  'Rev29.shorts.filterAll': L('All themes', '전체 테마', 'Kõik teemad', 'すべてのテーマ', '全部主题', 'Todos los temas', 'គ្រប់ប្រធានបទ', 'Tous les thèmes', 'Alle Themen', 'Todos os temas', 'Tất cả chủ đề', 'Semua tema', 'Все темы', 'सभी विषय', 'Tutti i temi', 'Tüm temalar', 'ทุกธีม', 'Wszystkie tematy', 'Alle thema’s', 'Lahat ng tema'),
};

/* ------------------------------------------------------------------ */
/* The revived Shorts copy -- the REV-19 `Rev19.shorts` tree, verbatim  */
/* per locale, that REV-20 §7.1 purged. Restored under `Rev29.shorts`.  */
/* ------------------------------------------------------------------ */
const SHORTS_COPY = {
  "en": {
    "label": "UNITAS Shorts",
    "lede": "Vertical moments from the network — the seed of U-Messenger.",
    "views": "{count} views",
    "like": "Like",
    "liked": "Liked",
    "follow": "Follow",
    "following": "Following",
    "upload": "Upload",
    "uploadSoon": "Uploads open with the U-Messenger beta",
    "seedNote": "Seed clips shown as a preview · real uploads arrive with the U-Messenger beta",
    "share": "Share to U-Messenger",
    "shareHint": "Sharing links will hand this clip straight into a U-Messenger thread once the beta opens.",
    "openAria": "Open the short {title}",
    "creator": "Creator",
    "duration": "{seconds}s",
    "followers": "{count} followers",
    "pass": {
      "eyebrow": "Creator early access",
      "cta": "Get early access",
      "title": "Your creator pass",
      "lede": "Uploads open with the U-Messenger beta. Reserve a pass now and your handle is first in line the moment the studio doors open.",
      "handleLabel": "Creator handle",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 characters: a–z, 0–9, dot, dash, underscore",
      "reserve": "Reserve my pass",
      "reserved": "Pass reserved",
      "reservedAt": "Reserved {time}",
      "serial": "Pass {serial}",
      "currentWave": "Now reserving",
      "wave1": "Wave 1 · Founding creators",
      "wave2": "Wave 2 · Studio tools",
      "wave3": "Wave 3 · Global open",
      "perks": {
        "p1": "Priority upload slot on opening day",
        "p2": "Founding creator badge on your profile",
        "p3": "Direct share into U-Messenger threads"
      },
      "signedIn": "Bound to your account",
      "guest": "Sign in and your pass is bound to your account as well.",
      "honest": "Your pass lives on this device and, when you are signed in, on your account. No video is uploaded or stored yet."
    }
  },
  "ko": {
    "label": "UNITAS 쇼츠",
    "lede": "네트워크의 세로형 순간들 — U-메신저의 씨앗.",
    "views": "조회 {count}",
    "like": "좋아요",
    "liked": "좋아요 완료",
    "follow": "팔로우",
    "following": "팔로잉",
    "upload": "업로드",
    "uploadSoon": "업로드는 U-메신저 베타와 함께 열립니다",
    "seedNote": "미리보기용 시드 클립 · 실제 업로드는 U-메신저 베타와 함께 도착합니다",
    "share": "U-메신저로 공유",
    "shareHint": "베타가 열리면 공유 링크가 이 클립을 U-메신저 대화로 바로 전달합니다.",
    "openAria": "쇼츠 {title} 열기",
    "creator": "크리에이터",
    "duration": "{seconds}초",
    "followers": "팔로워 {count}",
    "pass": {
      "eyebrow": "크리에이터 얼리 액세스",
      "cta": "얼리 액세스 받기",
      "title": "당신의 크리에이터 패스",
      "lede": "업로드는 U-메신저 베타와 함께 열립니다. 지금 패스를 예약하면, 스튜디오 문이 열리는 순간 당신의 핸들이 가장 앞줄에 섭니다.",
      "handleLabel": "크리에이터 핸들",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3~20자: a–z, 0–9, 점, 대시, 밑줄",
      "reserve": "내 패스 예약하기",
      "reserved": "패스 예약 완료",
      "reservedAt": "{time} 예약",
      "serial": "패스 {serial}",
      "currentWave": "지금 예약 중",
      "wave1": "1차 · 파운딩 크리에이터",
      "wave2": "2차 · 스튜디오 도구",
      "wave3": "3차 · 글로벌 오픈",
      "perks": {
        "p1": "오픈 당일 우선 업로드 슬롯",
        "p2": "프로필에 새겨지는 파운딩 크리에이터 배지",
        "p3": "U-메신저 대화로 바로 공유"
      },
      "signedIn": "계정에 연결됨",
      "guest": "로그인하면 이 패스가 계정에도 함께 연결됩니다.",
      "honest": "패스는 이 기기에, 로그인 시에는 계정에도 보관됩니다. 아직 어떤 영상도 업로드되거나 저장되지 않습니다."
    }
  },
  "et": {
    "label": "UNITAS Shorts",
    "lede": "Püstised hetked võrgustikust — U-Messengeri seeme.",
    "views": "{count} vaatamist",
    "like": "Meeldib",
    "liked": "Meeldis",
    "follow": "Jälgi",
    "following": "Jälgid",
    "upload": "Laadi üles",
    "uploadSoon": "Üleslaadimine avaneb koos U-Messengeri beetaversiooniga",
    "seedNote": "Kuvatavad seemneklipid on eelvaade · päris üleslaadimised saabuvad koos U-Messengeri beetaversiooniga",
    "share": "Jaga U-Messengerisse",
    "shareHint": "Kui beetaversioon avaneb, viivad jagamislingid selle klipi otse U-Messengeri vestlusesse.",
    "openAria": "Ava lühivideo {title}",
    "creator": "Looja",
    "duration": "{seconds} s",
    "followers": "{count} jälgijat",
    "pass": {
      "eyebrow": "Loojate varajane ligipääs",
      "cta": "Saa varajane ligipääs",
      "title": "Sinu loojapass",
      "lede": "Üleslaadimine avaneb koos U-Messengeri beetaga. Broneeri pass kohe ja sinu nimi on esimesena järjekorras hetkel, mil stuudio uksed avanevad.",
      "handleLabel": "Looja nimi",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 märki: a–z, 0–9, punkt, sidekriips, alakriips",
      "reserve": "Broneeri minu pass",
      "reserved": "Pass broneeritud",
      "reservedAt": "Broneeritud {time}",
      "serial": "Pass {serial}",
      "currentWave": "Broneerimine käib",
      "wave1": "1. laine · Asutajaloojad",
      "wave2": "2. laine · Stuudiotööriistad",
      "wave3": "3. laine · Avatud kogu maailmale",
      "perks": {
        "p1": "Eelisjärjekorras üleslaadimiskoht avamispäeval",
        "p2": "Asutajalooja märk sinu profiilil",
        "p3": "Jagamine otse U-Messengeri vestlustesse"
      },
      "signedIn": "Seotud sinu kontoga",
      "guest": "Logi sisse ja sinu pass seotakse ka sinu kontoga.",
      "honest": "Pass on salvestatud selles seadmes ja sisselogituna ka sinu kontol. Ühtegi videot veel üles ei laadita ega salvestata."
    }
  },
  "ja": {
    "label": "UNITAS Shorts",
    "lede": "ネットワークに生まれる縦型の瞬間 — U-Messengerの種。",
    "views": "{count}回再生",
    "like": "いいね",
    "liked": "いいね済み",
    "follow": "フォロー",
    "following": "フォロー中",
    "upload": "アップロード",
    "uploadSoon": "アップロードはU-Messengerベータの開始と同時に開放されます",
    "seedNote": "プレビュー用のシードクリップを表示中 · 本番のアップロードはU-Messengerベータとともに始まります",
    "share": "U-Messengerへ共有",
    "shareHint": "ベータ開始後は、共有リンクからこのクリップをU-Messengerのスレッドへそのまま送れるようになります。",
    "openAria": "ショート「{title}」を開く",
    "creator": "クリエイター",
    "duration": "{seconds}秒",
    "followers": "フォロワー{count}人",
    "pass": {
      "eyebrow": "クリエイター先行アクセス",
      "cta": "先行アクセスを予約",
      "title": "あなたのクリエイターパス",
      "lede": "アップロードはU-Messengerベータの開始と同時に開放されます。今パスを予約しておけば、スタジオの扉が開くその瞬間、あなたのハンドルが最前列に並びます。",
      "handleLabel": "クリエイターハンドル",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3〜20文字: a–z, 0–9、ドット、ハイフン、アンダースコア",
      "reserve": "パスを予約する",
      "reserved": "パス予約済み",
      "reservedAt": "{time} 予約",
      "serial": "パス {serial}",
      "currentWave": "現在予約受付中",
      "wave1": "第1弾 · 創設クリエイター",
      "wave2": "第2弾 · スタジオツール",
      "wave3": "第3弾 · グローバル公開",
      "perks": {
        "p1": "公開初日の優先アップロード枠",
        "p2": "プロフィールに刻まれる創設クリエイターバッジ",
        "p3": "U-Messengerのスレッドへ直接共有"
      },
      "signedIn": "アカウントに紐づけ済み",
      "guest": "サインインすると、このパスはアカウントにも紐づけられます。",
      "honest": "パスはこの端末に保存され、サインイン中はアカウントにも保存されます。動画のアップロードや保存は、まだ一切行われません。"
    }
  },
  "zh": {
    "label": "UNITAS Shorts",
    "lede": "来自网络的竖屏瞬间 — U-Messenger 的种子。",
    "views": "{count} 次观看",
    "like": "点赞",
    "liked": "已点赞",
    "follow": "关注",
    "following": "已关注",
    "upload": "上传",
    "uploadSoon": "上传功能将随 U-Messenger 测试版开放",
    "seedNote": "当前展示的是预览用种子短片 · 真正的上传将随 U-Messenger 测试版到来",
    "share": "分享至 U-Messenger",
    "shareHint": "测试版开放后,分享链接会将这段短片直接送入 U-Messenger 的对话串。",
    "openAria": "打开短片《{title}》",
    "creator": "创作者",
    "duration": "{seconds}秒",
    "followers": "{count} 位粉丝",
    "pass": {
      "eyebrow": "创作者抢先体验",
      "cta": "获取抢先体验",
      "title": "你的创作者通行证",
      "lede": "上传功能将随 U-Messenger 测试版一同开放。现在预留通行证，工作室大门开启的那一刻，你的账号名将站在最前排。",
      "handleLabel": "创作者账号名",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 个字符：a–z、0–9、点、短横线、下划线",
      "reserve": "预留我的通行证",
      "reserved": "通行证已预留",
      "reservedAt": "预留于 {time}",
      "serial": "通行证 {serial}",
      "currentWave": "正在预留",
      "wave1": "第一波 · 创始创作者",
      "wave2": "第二波 · 工作室工具",
      "wave3": "第三波 · 全球开放",
      "perks": {
        "p1": "开放首日的优先上传席位",
        "p2": "个人主页上的创始创作者徽章",
        "p3": "直接分享到 U-Messenger 会话"
      },
      "signedIn": "已绑定到你的账户",
      "guest": "登录后，这张通行证也会绑定到你的账户。",
      "honest": "通行证保存在此设备上；登录后也会保存在你的账户中。目前尚未上传或存储任何视频。"
    }
  },
  "es": {
    "label": "UNITAS Shorts",
    "lede": "Momentos verticales de la red — la semilla de U-Messenger.",
    "views": "{count} visualizaciones",
    "like": "Me gusta",
    "liked": "Me gustó",
    "follow": "Seguir",
    "following": "Siguiendo",
    "upload": "Subir",
    "uploadSoon": "Las subidas se habilitan con la beta de U-Messenger",
    "seedNote": "Clips semilla mostrados como vista previa · las subidas reales llegan con la beta de U-Messenger",
    "share": "Compartir en U-Messenger",
    "shareHint": "Al abrirse la beta, los enlaces compartidos llevarán este clip directo a una conversación de U-Messenger.",
    "openAria": "Abrir el short {title}",
    "creator": "Creador",
    "duration": "{seconds}s",
    "followers": "{count} seguidores",
    "pass": {
      "eyebrow": "Acceso anticipado para creadores",
      "cta": "Conseguir acceso anticipado",
      "title": "Tu pase de creador",
      "lede": "Las subidas se abren con la beta de U-Messenger. Reserva tu pase ahora y tu nombre será el primero de la fila en cuanto se abran las puertas del estudio.",
      "handleLabel": "Alias de creador",
      "handlePlaceholder": "yourname",
      "invalidHandle": "De 3 a 20 caracteres: a–z, 0–9, punto, guion y guion bajo",
      "reserve": "Reservar mi pase",
      "reserved": "Pase reservado",
      "reservedAt": "Reservado el {time}",
      "serial": "Pase {serial}",
      "currentWave": "Reservando ahora",
      "wave1": "Oleada 1 · Creadores fundadores",
      "wave2": "Oleada 2 · Herramientas de estudio",
      "wave3": "Oleada 3 · Apertura global",
      "perks": {
        "p1": "Franja de subida prioritaria el día de apertura",
        "p2": "Insignia de creador fundador en tu perfil",
        "p3": "Compartir directo en las conversaciones de U-Messenger"
      },
      "signedIn": "Vinculado a tu cuenta",
      "guest": "Inicia sesión y tu pase quedará vinculado también a tu cuenta.",
      "honest": "Tu pase se guarda en este dispositivo y, si has iniciado sesión, también en tu cuenta. Todavía no se sube ni se almacena ningún vídeo."
    }
  },
  "km": {
    "label": "UNITAS Shorts",
    "lede": "ខ្លឹមសារវីដេអូបញ្ឈរពីបណ្តាញ — គ្រាប់ពូជនៃ U-Messenger។",
    "views": "{count} ការមើល",
    "like": "ចូលចិត្ត",
    "liked": "បានចូលចិត្ត",
    "follow": "តាមដាន",
    "following": "កំពុងតាមដាន",
    "upload": "ផ្ទុកឡើង",
    "uploadSoon": "ការផ្ទុកឡើងនឹងបើកជាមួយកំណែសាកល្បង U-Messenger",
    "seedNote": "វីដេអូគំរូបង្ហាញជាការមើលជាមុន · ការផ្ទុកឡើងពិតប្រាកដមកដល់ជាមួយកំណែសាកល្បង U-Messenger",
    "share": "ចែករំលែកទៅ U-Messenger",
    "shareHint": "នៅពេលកំណែសាកល្បងបើក តំណភ្ជាប់ចែករំលែកនឹងបញ្ជូនវីដេអូនេះទៅកាន់ការសន្ទនា U-Messenger ដោយផ្ទាល់។",
    "openAria": "បើកវីដេអូខ្លី {title}",
    "creator": "អ្នកបង្កើត",
    "duration": "{seconds} វិនាទី",
    "followers": "អ្នកតាមដាន {count} នាក់",
    "pass": {
      "eyebrow": "ការចូលប្រើមុនគេសម្រាប់អ្នកបង្កើត",
      "cta": "ទទួលការចូលប្រើមុនគេ",
      "title": "កាតអ្នកបង្កើតរបស់អ្នក",
      "lede": "ការផ្ទុកឡើងនឹងបើកជាមួយកំណែបេតារបស់ U-Messenger។ កក់កាតរបស់អ្នកឥឡូវនេះ ហើយឈ្មោះរបស់អ្នកនឹងឈរនៅជួរមុខគេ នៅពេលដែលទ្វារស្ទូឌីយោបើក។",
      "handleLabel": "ឈ្មោះអ្នកបង្កើត",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 តួអក្សរ៖ a–z, 0–9, ចំណុច, សហសញ្ញា, បន្ទាត់ក្រោម",
      "reserve": "កក់កាតរបស់ខ្ញុំ",
      "reserved": "កាតត្រូវបានកក់",
      "reservedAt": "បានកក់នៅ {time}",
      "serial": "កាត {serial}",
      "currentWave": "កំពុងបើកឱ្យកក់",
      "wave1": "ជុំទី 1 · អ្នកបង្កើតស្ថាបនិក",
      "wave2": "ជុំទី 2 · ឧបករណ៍ស្ទូឌីយោ",
      "wave3": "ជុំទី 3 · បើកទូទាំងពិភពលោក",
      "perks": {
        "p1": "កន្លែងផ្ទុកឡើងអាទិភាពនៅថ្ងៃបើក",
        "p2": "ផ្លាកសញ្ញាអ្នកបង្កើតស្ថាបនិកនៅលើប្រវត្តិរូបរបស់អ្នក",
        "p3": "ចែករំលែកផ្ទាល់ទៅក្នុងការសន្ទនា U-Messenger"
      },
      "signedIn": "បានភ្ជាប់ទៅគណនីរបស់អ្នក",
      "guest": "ចូលគណនី ហើយកាតរបស់អ្នកនឹងត្រូវភ្ជាប់ទៅគណនីរបស់អ្នកផងដែរ។",
      "honest": "កាតរបស់អ្នកត្រូវបានរក្សាទុកនៅលើឧបករណ៍នេះ ហើយនៅពេលអ្នកចូលគណនី វានឹងរក្សាទុកនៅលើគណនីរបស់អ្នកផងដែរ។ មិនទាន់មានវីដេអូណាមួយត្រូវបានផ្ទុកឡើង ឬរក្សាទុកនៅឡើយទេ។"
    }
  },
  "fr": {
    "label": "UNITAS Shorts",
    "lede": "Des instants verticaux venus du réseau — la graine de U-Messenger.",
    "views": "{count} vues",
    "like": "J'aime",
    "liked": "Aimé",
    "follow": "Suivre",
    "following": "Abonné",
    "upload": "Téléverser",
    "uploadSoon": "Le téléversement s'ouvre avec la bêta de U-Messenger",
    "seedNote": "Clips d'amorce affichés en aperçu · les vrais téléversements arrivent avec la bêta de U-Messenger",
    "share": "Partager vers U-Messenger",
    "shareHint": "Une fois la bêta ouverte, les liens de partage enverront ce clip directement dans une conversation U-Messenger.",
    "openAria": "Ouvrir le short {title}",
    "creator": "Créateur",
    "duration": "{seconds} s",
    "followers": "{count} abonnés",
    "pass": {
      "eyebrow": "Accès anticipé créateurs",
      "cta": "Obtenir l’accès anticipé",
      "title": "Votre pass créateur",
      "lede": "Les mises en ligne s’ouvrent avec la bêta de U-Messenger. Réservez votre pass dès maintenant : votre nom sera en tête de file à l’instant où les portes du studio s’ouvriront.",
      "handleLabel": "Identifiant créateur",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3 à 20 caractères : a–z, 0–9, point, tiret et tiret bas",
      "reserve": "Réserver mon pass",
      "reserved": "Pass réservé",
      "reservedAt": "Réservé le {time}",
      "serial": "Pass {serial}",
      "currentWave": "Réservations ouvertes",
      "wave1": "Vague 1 · Créateurs fondateurs",
      "wave2": "Vague 2 · Outils de studio",
      "wave3": "Vague 3 · Ouverture mondiale",
      "perks": {
        "p1": "Créneau de mise en ligne prioritaire le jour de l’ouverture",
        "p2": "Badge de créateur fondateur sur votre profil",
        "p3": "Partage direct dans les conversations U-Messenger"
      },
      "signedIn": "Lié à votre compte",
      "guest": "Connectez-vous et votre pass sera aussi lié à votre compte.",
      "honest": "Votre pass reste sur cet appareil et, lorsque vous êtes connecté, sur votre compte. Aucune vidéo n’est encore envoyée ni stockée."
    }
  },
  "de": {
    "label": "UNITAS Shorts",
    "lede": "Vertikale Momente aus dem Netzwerk — der Keim von U-Messenger.",
    "views": "{count} Aufrufe",
    "like": "Liken",
    "liked": "Geliked",
    "follow": "Folgen",
    "following": "Gefolgt",
    "upload": "Hochladen",
    "uploadSoon": "Uploads öffnen sich mit der U-Messenger-Beta",
    "seedNote": "Seed-Clips als Vorschau gezeigt · echte Uploads kommen mit der U-Messenger-Beta",
    "share": "An U-Messenger teilen",
    "shareHint": "Geteilte Links übergeben diesen Clip direkt in einen U-Messenger-Thread, sobald die Beta startet.",
    "openAria": "Short {title} öffnen",
    "creator": "Creator",
    "duration": "{seconds}s",
    "followers": "{count} Follower",
    "pass": {
      "eyebrow": "Creator Early Access",
      "cta": "Early Access sichern",
      "title": "Dein Creator-Pass",
      "lede": "Uploads starten mit der U-Messenger-Beta. Reserviere deinen Pass jetzt, und dein Name steht ganz vorn, sobald sich die Studiotüren öffnen.",
      "handleLabel": "Creator-Handle",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 Zeichen: a–z, 0–9, Punkt, Bindestrich, Unterstrich",
      "reserve": "Meinen Pass reservieren",
      "reserved": "Pass reserviert",
      "reservedAt": "Reserviert am {time}",
      "serial": "Pass {serial}",
      "currentWave": "Jetzt reservierbar",
      "wave1": "Welle 1 · Gründungs-Creator",
      "wave2": "Welle 2 · Studio-Werkzeuge",
      "wave3": "Welle 3 · Weltweite Öffnung",
      "perks": {
        "p1": "Bevorzugter Upload-Slot am Eröffnungstag",
        "p2": "Gründungs-Creator-Abzeichen in deinem Profil",
        "p3": "Direkt in U-Messenger-Chats teilen"
      },
      "signedIn": "Mit deinem Konto verknüpft",
      "guest": "Melde dich an, und dein Pass wird zusätzlich mit deinem Konto verknüpft.",
      "honest": "Dein Pass bleibt auf diesem Gerät und, wenn du angemeldet bist, in deinem Konto. Noch wird kein Video hochgeladen oder gespeichert."
    }
  },
  "pt": {
    "label": "UNITAS Shorts",
    "lede": "Momentos verticais da rede — a semente do U-Messenger.",
    "views": "{count} visualizações",
    "like": "Curtir",
    "liked": "Curtido",
    "follow": "Seguir",
    "following": "Seguindo",
    "upload": "Enviar",
    "uploadSoon": "Os envios abrem com o beta do U-Messenger",
    "seedNote": "Clipes semente exibidos como prévia · envios reais chegam com o beta do U-Messenger",
    "share": "Compartilhar no U-Messenger",
    "shareHint": "Os links compartilhados entregarão este clipe direto em uma conversa do U-Messenger assim que o beta abrir.",
    "openAria": "Abrir o short {title}",
    "creator": "Criador",
    "duration": "{seconds}s",
    "followers": "{count} seguidores",
    "pass": {
      "eyebrow": "Acesso antecipado para criadores",
      "cta": "Garantir acesso antecipado",
      "title": "Seu passe de criador",
      "lede": "Os uploads abrem junto com o beta do U-Messenger. Reserve seu passe agora e seu nome será o primeiro da fila no instante em que as portas do estúdio se abrirem.",
      "handleLabel": "Handle de criador",
      "handlePlaceholder": "yourname",
      "invalidHandle": "De 3 a 20 caracteres: a–z, 0–9, ponto, hífen e sublinhado",
      "reserve": "Reservar meu passe",
      "reserved": "Passe reservado",
      "reservedAt": "Reservado em {time}",
      "serial": "Passe {serial}",
      "currentWave": "Reservando agora",
      "wave1": "Onda 1 · Criadores fundadores",
      "wave2": "Onda 2 · Ferramentas de estúdio",
      "wave3": "Onda 3 · Abertura global",
      "perks": {
        "p1": "Vaga prioritária de upload no dia da abertura",
        "p2": "Selo de criador fundador no seu perfil",
        "p3": "Compartilhamento direto nas conversas do U-Messenger"
      },
      "signedIn": "Vinculado à sua conta",
      "guest": "Entre na sua conta e o passe ficará vinculado a ela também.",
      "honest": "Seu passe fica neste dispositivo e, quando você está conectado, também na sua conta. Nenhum vídeo é enviado ou armazenado ainda."
    }
  },
  "vi": {
    "label": "UNITAS Shorts",
    "lede": "Những khoảnh khắc dọc từ mạng lưới — hạt giống của U-Messenger.",
    "views": "{count} lượt xem",
    "like": "Thích",
    "liked": "Đã thích",
    "follow": "Theo dõi",
    "following": "Đang theo dõi",
    "upload": "Tải lên",
    "uploadSoon": "Tính năng tải lên mở cùng bản beta U-Messenger",
    "seedNote": "Clip khởi tạo hiển thị làm bản xem trước · nội dung tải lên thật sẽ đến cùng bản beta U-Messenger",
    "share": "Chia sẻ đến U-Messenger",
    "shareHint": "Liên kết chia sẻ sẽ đưa clip này thẳng vào một cuộc trò chuyện U-Messenger ngay khi bản beta mở.",
    "openAria": "Mở video ngắn {title}",
    "creator": "Người sáng tạo",
    "duration": "{seconds} giây",
    "followers": "{count} người theo dõi",
    "pass": {
      "eyebrow": "Truy cập sớm cho nhà sáng tạo",
      "cta": "Nhận truy cập sớm",
      "title": "Thẻ nhà sáng tạo của bạn",
      "lede": "Tính năng tải lên sẽ mở cùng bản beta của U-Messenger. Đặt thẻ ngay hôm nay và tên của bạn sẽ đứng đầu hàng ngay khoảnh khắc cánh cửa studio mở ra.",
      "handleLabel": "Tên nhà sáng tạo",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 ký tự: a–z, 0–9, dấu chấm, gạch ngang, gạch dưới",
      "reserve": "Đặt thẻ của tôi",
      "reserved": "Đã đặt thẻ",
      "reservedAt": "Đã đặt lúc {time}",
      "serial": "Thẻ {serial}",
      "currentWave": "Đang nhận đặt thẻ",
      "wave1": "Đợt 1 · Nhà sáng tạo sáng lập",
      "wave2": "Đợt 2 · Công cụ studio",
      "wave3": "Đợt 3 · Mở toàn cầu",
      "perks": {
        "p1": "Suất tải lên ưu tiên trong ngày khai mở",
        "p2": "Huy hiệu nhà sáng tạo sáng lập trên hồ sơ của bạn",
        "p3": "Chia sẻ thẳng vào các cuộc trò chuyện U-Messenger"
      },
      "signedIn": "Đã liên kết với tài khoản của bạn",
      "guest": "Đăng nhập để thẻ này cũng được liên kết với tài khoản của bạn.",
      "honest": "Thẻ được lưu trên thiết bị này và, khi bạn đã đăng nhập, cả trên tài khoản của bạn. Chưa có video nào được tải lên hay lưu trữ."
    }
  },
  "id": {
    "label": "UNITAS Shorts",
    "lede": "Momen vertikal dari jaringan — benih dari U-Messenger.",
    "views": "{count} tontonan",
    "like": "Suka",
    "liked": "Disukai",
    "follow": "Ikuti",
    "following": "Mengikuti",
    "upload": "Unggah",
    "uploadSoon": "Unggahan dibuka bersama beta U-Messenger",
    "seedNote": "Klip awal ditampilkan sebagai pratinjau · unggahan sungguhan hadir bersama beta U-Messenger",
    "share": "Bagikan ke U-Messenger",
    "shareHint": "Tautan berbagi akan mengirim klip ini langsung ke utas U-Messenger begitu beta dibuka.",
    "openAria": "Buka short {title}",
    "creator": "Kreator",
    "duration": "{seconds} detik",
    "followers": "{count} pengikut",
    "pass": {
      "eyebrow": "Akses awal untuk kreator",
      "cta": "Dapatkan akses awal",
      "title": "Pas kreator Anda",
      "lede": "Unggahan dibuka bersama beta U-Messenger. Pesan pas Anda sekarang, dan nama Anda berada di barisan terdepan saat pintu studio terbuka.",
      "handleLabel": "Handle kreator",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 karakter: a–z, 0–9, titik, tanda hubung, garis bawah",
      "reserve": "Pesan pas saya",
      "reserved": "Pas sudah dipesan",
      "reservedAt": "Dipesan {time}",
      "serial": "Pas {serial}",
      "currentWave": "Sedang dibuka",
      "wave1": "Gelombang 1 · Kreator pendiri",
      "wave2": "Gelombang 2 · Perangkat studio",
      "wave3": "Gelombang 3 · Terbuka global",
      "perks": {
        "p1": "Slot unggah prioritas di hari pembukaan",
        "p2": "Lencana kreator pendiri di profil Anda",
        "p3": "Bagikan langsung ke percakapan U-Messenger"
      },
      "signedIn": "Terhubung ke akun Anda",
      "guest": "Masuk, dan pas Anda juga akan terhubung ke akun Anda.",
      "honest": "Pas tersimpan di perangkat ini dan, saat Anda masuk, juga di akun Anda. Belum ada video yang diunggah atau disimpan."
    }
  },
  "ru": {
    "label": "UNITAS Shorts",
    "lede": "Вертикальные моменты сети — зерно U-Messenger.",
    "views": "{count} просмотров",
    "like": "Нравится",
    "liked": "Понравилось",
    "follow": "Подписаться",
    "following": "Подписан",
    "upload": "Загрузить",
    "uploadSoon": "Загрузка откроется вместе с бета-версией U-Messenger",
    "seedNote": "Начальные ролики показаны как превью · настоящие загрузки появятся вместе с бета-версией U-Messenger",
    "share": "Поделиться в U-Messenger",
    "shareHint": "Ссылки для отправки передадут этот ролик прямо в переписку U-Messenger, как только откроется бета-версия.",
    "openAria": "Открыть шортс «{title}»",
    "creator": "Автор",
    "duration": "{seconds} с",
    "followers": "{count} подписчиков",
    "pass": {
      "eyebrow": "Ранний доступ для авторов",
      "cta": "Получить ранний доступ",
      "title": "Ваш пропуск автора",
      "lede": "Загрузки откроются вместе с бета-версией U-Messenger. Забронируйте пропуск сейчас — и ваше имя окажется первым в очереди, как только двери студии откроются.",
      "handleLabel": "Хэндл автора",
      "handlePlaceholder": "yourname",
      "invalidHandle": "От 3 до 20 символов: a–z, 0–9, точка, дефис, подчёркивание",
      "reserve": "Забронировать пропуск",
      "reserved": "Пропуск забронирован",
      "reservedAt": "Забронирован {time}",
      "serial": "Пропуск {serial}",
      "currentWave": "Идёт бронирование",
      "wave1": "Волна 1 · Авторы-основатели",
      "wave2": "Волна 2 · Инструменты студии",
      "wave3": "Волна 3 · Открытие для всех",
      "perks": {
        "p1": "Приоритетный слот загрузки в день открытия",
        "p2": "Значок автора-основателя в профиле",
        "p3": "Прямая отправка в беседы U-Messenger"
      },
      "signedIn": "Привязан к вашему аккаунту",
      "guest": "Войдите — и пропуск будет привязан и к вашему аккаунту.",
      "honest": "Пропуск хранится на этом устройстве, а при входе — и в вашем аккаунте. Пока ни одно видео не загружается и не сохраняется."
    }
  },
  "hi": {
    "label": "UNITAS Shorts",
    "lede": "नेटवर्क के वर्टिकल पल — U-Messenger का बीज।",
    "views": "{count} व्यूज़",
    "like": "लाइक",
    "liked": "लाइक किया",
    "follow": "फ़ॉलो करें",
    "following": "फ़ॉलो किया",
    "upload": "अपलोड करें",
    "uploadSoon": "अपलोड U-Messenger बीटा के साथ शुरू होंगे",
    "seedNote": "प्रीव्यू के तौर पर शुरुआती क्लिप दिखाई गई हैं · असली अपलोड U-Messenger बीटा के साथ आएंगे",
    "share": "U-Messenger पर शेयर करें",
    "shareHint": "बीटा शुरू होते ही शेयर किए गए लिंक इस क्लिप को सीधे U-Messenger की बातचीत में पहुँचा देंगे।",
    "openAria": "शॉर्ट {title} खोलें",
    "creator": "क्रिएटर",
    "duration": "{seconds} सेकंड",
    "followers": "{count} फ़ॉलोअर्स",
    "pass": {
      "eyebrow": "क्रिएटर्स के लिए अर्ली एक्सेस",
      "cta": "अर्ली एक्सेस पाएँ",
      "title": "आपका क्रिएटर पास",
      "lede": "अपलोड U-Messenger बीटा के साथ खुलेंगे। अभी अपना पास रिज़र्व करें, और जिस पल स्टूडियो के दरवाज़े खुलेंगे, आपका नाम सबसे आगे होगा।",
      "handleLabel": "क्रिएटर हैंडल",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 अक्षर: a–z, 0–9, डॉट, डैश, अंडरस्कोर",
      "reserve": "मेरा पास रिज़र्व करें",
      "reserved": "पास रिज़र्व हो गया",
      "reservedAt": "{time} को रिज़र्व",
      "serial": "पास {serial}",
      "currentWave": "अभी रिज़र्व हो रहा है",
      "wave1": "वेव 1 · संस्थापक क्रिएटर्स",
      "wave2": "वेव 2 · स्टूडियो टूल्स",
      "wave3": "वेव 3 · ग्लोबल ओपन",
      "perks": {
        "p1": "ओपनिंग के दिन प्राथमिकता वाला अपलोड स्लॉट",
        "p2": "आपकी प्रोफ़ाइल पर संस्थापक क्रिएटर बैज",
        "p3": "U-Messenger की बातचीत में सीधे शेयर"
      },
      "signedIn": "आपके खाते से जुड़ा",
      "guest": "साइन इन करें और यह पास आपके खाते से भी जुड़ जाएगा।",
      "honest": "आपका पास इस डिवाइस पर रहता है और साइन इन होने पर आपके खाते में भी। अभी कोई वीडियो अपलोड या सेव नहीं किया जाता।"
    }
  },
  "it": {
    "label": "UNITAS Shorts",
    "lede": "Momenti verticali dalla rete — il seme di U-Messenger.",
    "views": "{count} visualizzazioni",
    "like": "Apprezza",
    "liked": "Apprezzato",
    "follow": "Segui",
    "following": "Seguito",
    "upload": "Carica",
    "uploadSoon": "I caricamenti si aprono con la beta di U-Messenger",
    "seedNote": "Clip seme mostrate in anteprima · i caricamenti reali arrivano con la beta di U-Messenger",
    "share": "Condividi su U-Messenger",
    "shareHint": "I link di condivisione porteranno questa clip direttamente in una conversazione U-Messenger non appena la beta sarà aperta.",
    "openAria": "Apri lo short {title}",
    "creator": "Creator",
    "duration": "{seconds}s",
    "followers": "{count} follower",
    "pass": {
      "eyebrow": "Accesso anticipato per creator",
      "cta": "Ottieni l’accesso anticipato",
      "title": "Il tuo pass da creator",
      "lede": "I caricamenti si aprono con la beta di U-Messenger. Prenota ora il tuo pass e il tuo nome sarà il primo della fila nell’istante in cui le porte dello studio si apriranno.",
      "handleLabel": "Handle creator",
      "handlePlaceholder": "yourname",
      "invalidHandle": "Da 3 a 20 caratteri: a–z, 0–9, punto, trattino e underscore",
      "reserve": "Prenota il mio pass",
      "reserved": "Pass prenotato",
      "reservedAt": "Prenotato il {time}",
      "serial": "Pass {serial}",
      "currentWave": "Prenotazioni aperte",
      "wave1": "Ondata 1 · Creator fondatori",
      "wave2": "Ondata 2 · Strumenti da studio",
      "wave3": "Ondata 3 · Apertura globale",
      "perks": {
        "p1": "Slot di caricamento prioritario il giorno dell’apertura",
        "p2": "Badge di creator fondatore sul tuo profilo",
        "p3": "Condivisione diretta nelle conversazioni di U-Messenger"
      },
      "signedIn": "Collegato al tuo account",
      "guest": "Accedi e il tuo pass verrà collegato anche al tuo account.",
      "honest": "Il tuo pass è salvato su questo dispositivo e, quando hai effettuato l’accesso, anche sul tuo account. Nessun video viene ancora caricato o archiviato."
    }
  },
  "tr": {
    "label": "UNITAS Shorts",
    "lede": "Ağdaki dikey anlar — U-Messenger'ın tohumu.",
    "views": "{count} görüntülenme",
    "like": "Beğen",
    "liked": "Beğenildi",
    "follow": "Takip Et",
    "following": "Takip Ediliyor",
    "upload": "Yükle",
    "uploadSoon": "Yüklemeler U-Messenger beta sürümüyle açılır",
    "seedNote": "Önizleme olarak gösterilen tohum klipler · gerçek yüklemeler U-Messenger beta sürümüyle gelir",
    "share": "U-Messenger'a paylaş",
    "shareHint": "Beta açıldığında paylaşım bağlantıları bu klibi doğrudan bir U-Messenger sohbetine aktarır.",
    "openAria": "{title} kısa videosunu aç",
    "creator": "Yaratıcı",
    "duration": "{seconds} sn",
    "followers": "{count} takipçi",
    "pass": {
      "eyebrow": "İçerik üreticileri için erken erişim",
      "cta": "Erken erişim alın",
      "title": "İçerik üreticisi pasonuz",
      "lede": "Yüklemeler U-Messenger betasıyla birlikte açılıyor. Pasonuzu şimdi ayırtın; stüdyo kapıları açıldığı an adınız sıranın en önünde olsun.",
      "handleLabel": "İçerik üreticisi kullanıcı adı",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 karakter: a–z, 0–9, nokta, tire, alt çizgi",
      "reserve": "Pasomu ayırt",
      "reserved": "Paso ayrıldı",
      "reservedAt": "{time} tarihinde ayrıldı",
      "serial": "Paso {serial}",
      "currentWave": "Şu an ayırtılıyor",
      "wave1": "1. Dalga · Kurucu içerik üreticileri",
      "wave2": "2. Dalga · Stüdyo araçları",
      "wave3": "3. Dalga · Küresel açılış",
      "perks": {
        "p1": "Açılış günü öncelikli yükleme yeri",
        "p2": "Profilinizde kurucu içerik üreticisi rozeti",
        "p3": "U-Messenger sohbetlerine doğrudan paylaşım"
      },
      "signedIn": "Hesabınıza bağlı",
      "guest": "Giriş yapın, pasonuz hesabınıza da bağlansın.",
      "honest": "Pasonuz bu cihazda, giriş yaptığınızda ise hesabınızda da saklanır. Henüz hiçbir video yüklenmiyor ya da depolanmıyor."
    }
  },
  "th": {
    "label": "UNITAS Shorts",
    "lede": "ช่วงเวลาแนวตั้งจากเครือข่าย — เมล็ดพันธุ์ของ U-Messenger",
    "views": "{count} ครั้ง",
    "like": "ถูกใจ",
    "liked": "ถูกใจแล้ว",
    "follow": "ติดตาม",
    "following": "กำลังติดตาม",
    "upload": "อัปโหลด",
    "uploadSoon": "การอัปโหลดจะเปิดพร้อมกับเวอร์ชันเบต้าของ U-Messenger",
    "seedNote": "คลิปตัวอย่างเริ่มต้นแสดงเป็นการพรีวิว · การอัปโหลดจริงจะมาพร้อมกับเวอร์ชันเบต้าของ U-Messenger",
    "share": "แชร์ไปยัง U-Messenger",
    "shareHint": "ลิงก์แชร์จะส่งคลิปนี้เข้าสู่การสนทนาใน U-Messenger โดยตรงทันทีที่เวอร์ชันเบต้าเปิดใช้งาน",
    "openAria": "เปิดคลิปสั้น {title}",
    "creator": "ผู้สร้าง",
    "duration": "{seconds} วินาที",
    "followers": "ผู้ติดตาม {count} คน",
    "pass": {
      "eyebrow": "สิทธิ์เข้าถึงก่อนใครสำหรับครีเอเตอร์",
      "cta": "รับสิทธิ์เข้าถึงก่อนใคร",
      "title": "บัตรผ่านครีเอเตอร์ของคุณ",
      "lede": "การอัปโหลดจะเปิดพร้อมกับ U-Messenger เวอร์ชันเบต้า จองบัตรผ่านตอนนี้ แล้วชื่อของคุณจะอยู่แถวหน้าสุดทันทีที่ประตูสตูดิโอเปิด",
      "handleLabel": "ชื่อครีเอเตอร์",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 ตัวอักษร: a–z, 0–9, จุด, ขีดกลาง, ขีดล่าง",
      "reserve": "จองบัตรผ่านของฉัน",
      "reserved": "จองบัตรผ่านแล้ว",
      "reservedAt": "จองเมื่อ {time}",
      "serial": "บัตรผ่าน {serial}",
      "currentWave": "กำลังเปิดจอง",
      "wave1": "รอบที่ 1 · ครีเอเตอร์ผู้ก่อตั้ง",
      "wave2": "รอบที่ 2 · เครื่องมือสตูดิโอ",
      "wave3": "รอบที่ 3 · เปิดทั่วโลก",
      "perks": {
        "p1": "สิทธิ์อัปโหลดก่อนในวันเปิดตัว",
        "p2": "ตราครีเอเตอร์ผู้ก่อตั้งบนโปรไฟล์ของคุณ",
        "p3": "แชร์ตรงเข้าบทสนทนาใน U-Messenger"
      },
      "signedIn": "ผูกกับบัญชีของคุณแล้ว",
      "guest": "เข้าสู่ระบบ แล้วบัตรผ่านนี้จะผูกกับบัญชีของคุณด้วย",
      "honest": "บัตรผ่านถูกเก็บไว้ในอุปกรณ์นี้ และเมื่อเข้าสู่ระบบจะเก็บไว้ในบัญชีของคุณด้วย ยังไม่มีวิดีโอใดถูกอัปโหลดหรือจัดเก็บ"
    }
  },
  "pl": {
    "label": "UNITAS Shorts",
    "lede": "Pionowe migawki z sieci — zalążek U-Messenger.",
    "views": "{count} wyświetleń",
    "like": "Polub",
    "liked": "Polubione",
    "follow": "Obserwuj",
    "following": "Obserwujesz",
    "upload": "Prześlij",
    "uploadSoon": "Przesyłanie otworzy się wraz z wersją beta U-Messenger",
    "seedNote": "Klipy startowe pokazane jako podgląd · prawdziwe przesyłanie pojawi się wraz z wersją beta U-Messenger",
    "share": "Udostępnij w U-Messenger",
    "shareHint": "Gdy wersja beta zostanie otwarta, linki do udostępniania przeniosą ten klip prosto do wątku U-Messenger.",
    "openAria": "Otwórz krótki film {title}",
    "creator": "Twórca",
    "duration": "{seconds} s",
    "followers": "{count} obserwujących",
    "pass": {
      "eyebrow": "Wczesny dostęp dla twórców",
      "cta": "Zdobądź wczesny dostęp",
      "title": "Twoja przepustka twórcy",
      "lede": "Przesyłanie ruszy razem z betą U-Messenger. Zarezerwuj przepustkę już teraz, a Twoja nazwa będzie pierwsza w kolejce, gdy tylko otworzą się drzwi studia.",
      "handleLabel": "Nazwa twórcy",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 znaków: a–z, 0–9, kropka, myślnik, podkreślnik",
      "reserve": "Zarezerwuj moją przepustkę",
      "reserved": "Przepustka zarezerwowana",
      "reservedAt": "Zarezerwowano {time}",
      "serial": "Przepustka {serial}",
      "currentWave": "Trwa rezerwacja",
      "wave1": "Fala 1 · Twórcy założyciele",
      "wave2": "Fala 2 · Narzędzia studia",
      "wave3": "Fala 3 · Otwarcie globalne",
      "perks": {
        "p1": "Priorytetowe miejsce na przesyłanie w dniu otwarcia",
        "p2": "Odznaka twórcy założyciela na Twoim profilu",
        "p3": "Bezpośrednie udostępnianie w rozmowach U-Messenger"
      },
      "signedIn": "Powiązana z Twoim kontem",
      "guest": "Zaloguj się, a przepustka zostanie powiązana także z Twoim kontem.",
      "honest": "Przepustka zapisana jest na tym urządzeniu, a po zalogowaniu także na Twoim koncie. Żadne wideo nie jest jeszcze przesyłane ani przechowywane."
    }
  },
  "nl": {
    "label": "UNITAS Shorts",
    "lede": "Verticale momenten uit het netwerk — de kiem van U-Messenger.",
    "views": "{count} weergaven",
    "like": "Liken",
    "liked": "Geliked",
    "follow": "Volgen",
    "following": "Volgend",
    "upload": "Uploaden",
    "uploadSoon": "Uploaden wordt geopend met de U-Messenger-bèta",
    "seedNote": "Startclips getoond als voorbeeld · echte uploads komen met de U-Messenger-bèta",
    "share": "Delen naar U-Messenger",
    "shareHint": "Zodra de bèta opent, brengen deellinks deze clip direct naar een U-Messenger-gesprek.",
    "openAria": "Open de short {title}",
    "creator": "Maker",
    "duration": "{seconds} s",
    "followers": "{count} volgers",
    "pass": {
      "eyebrow": "Early access voor creators",
      "cta": "Early access aanvragen",
      "title": "Jouw creatorpas",
      "lede": "Uploaden gaat open met de bèta van U-Messenger. Reserveer je pas nu en jouw naam staat vooraan zodra de studiodeuren opengaan.",
      "handleLabel": "Creator-handle",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 tekens: a–z, 0–9, punt, streepje, underscore",
      "reserve": "Mijn pas reserveren",
      "reserved": "Pas gereserveerd",
      "reservedAt": "Gereserveerd op {time}",
      "serial": "Pas {serial}",
      "currentWave": "Nu te reserveren",
      "wave1": "Golf 1 · Founding creators",
      "wave2": "Golf 2 · Studiotools",
      "wave3": "Golf 3 · Wereldwijd open",
      "perks": {
        "p1": "Voorrang bij uploaden op de openingsdag",
        "p2": "Founding-creatorbadge op je profiel",
        "p3": "Direct delen in U-Messenger-gesprekken"
      },
      "signedIn": "Gekoppeld aan je account",
      "guest": "Log in en je pas wordt ook aan je account gekoppeld.",
      "honest": "Je pas staat op dit apparaat en, wanneer je bent ingelogd, ook op je account. Er wordt nog geen video geüpload of opgeslagen."
    }
  },
  "tl": {
    "label": "UNITAS Shorts",
    "lede": "Mga vertical na sandali mula sa network — ang binhi ng U-Messenger.",
    "views": "{count} views",
    "like": "I-like",
    "liked": "Na-like",
    "follow": "Sundan",
    "following": "Sinusundan",
    "upload": "I-upload",
    "uploadSoon": "Magbubukas ang pag-upload kasabay ng U-Messenger beta",
    "seedNote": "Mga panimulang clip na ipinapakita bilang preview · darating ang tunay na mga upload kasabay ng U-Messenger beta",
    "share": "I-share sa U-Messenger",
    "shareHint": "Kapag nabuksan na ang beta, direktang ihahatid ng mga link ng pagbabahagi ang clip na ito sa isang thread ng U-Messenger.",
    "openAria": "Buksan ang short na {title}",
    "creator": "Creator",
    "duration": "{seconds}s",
    "followers": "{count} na tagasunod",
    "pass": {
      "eyebrow": "Early access para sa mga creator",
      "cta": "Kumuha ng early access",
      "title": "Ang iyong creator pass",
      "lede": "Magbubukas ang pag-upload kasabay ng U-Messenger beta. I-reserve ang pass mo ngayon, at mauuna ang pangalan mo sa pila sa sandaling bumukas ang pinto ng studio.",
      "handleLabel": "Creator handle",
      "handlePlaceholder": "yourname",
      "invalidHandle": "3–20 character: a–z, 0–9, tuldok, gitling, underscore",
      "reserve": "I-reserve ang pass ko",
      "reserved": "Na-reserve ang pass",
      "reservedAt": "Na-reserve noong {time}",
      "serial": "Pass {serial}",
      "currentWave": "Bukas ang reservation",
      "wave1": "Wave 1 · Founding creators",
      "wave2": "Wave 2 · Mga studio tool",
      "wave3": "Wave 3 · Bukas sa buong mundo",
      "perks": {
        "p1": "Priority upload slot sa araw ng pagbubukas",
        "p2": "Founding creator badge sa iyong profile",
        "p3": "Direktang share sa mga U-Messenger thread"
      },
      "signedIn": "Nakakabit sa iyong account",
      "guest": "Mag-sign in at ikakabit din ang pass mo sa iyong account.",
      "honest": "Nasa device na ito ang pass mo at, kapag naka-sign in, nasa account mo rin. Wala pang video na ina-upload o iniimbak."
    }
  }
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function getDeep(obj, dotted) {
  let node = obj;
  for (const p of dotted.split('.')) {
    if (!node || typeof node !== 'object' || !(p in node)) return undefined;
    node = node[p];
  }
  return node;
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

/** M2.2: cut a fused "A · B" label on its own separator. Every locale used
 *  one of ` · `, `·`, `・` -- the middle dot family. Fail closed otherwise. */
function splitFused(label, locale, key) {
  const parts = label.split(/\s*[·・]\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2) throw new Error(`apply-rev29-i18n: ${locale}: cannot split ${key} = "${label}"`);
  return parts;
}

/** Already split (a previous run): the label carries no middle dot. */
function isFused(label) {
  return /[·・]/.test(label);
}

/** The separately-translated halves for a locale whose fused label is
 *  already gone (idempotent re-runs): read back what is there. */
function currentPair(data, a, b) {
  const x = getDeep(data, a);
  const y = getDeep(data, b);
  return typeof x === 'string' && typeof y === 'string' ? [x, y] : null;
}

const check = process.argv.includes('--check');
let totalChanges = 0;
const report = [];

if (!SHORTS_COPY) throw new Error('apply-rev29-i18n: the restored Shorts copy was not embedded');

for (const locale of LOCALES) {
  const file = path.join(messagesDir, `${locale}.json`);
  const raw = readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  let set = 0;

  // 1. split the fused news axes
  for (const [fusedKey, aKey, bKey] of [
    ['HotNews.category.welfare', 'HotNews.category.welfare', 'HotNews.category.health'],
    ['HotNews.category.security', 'HotNews.category.security', 'HotNews.category.conflict'],
  ]) {
    const current = getDeep(data, fusedKey);
    if (typeof current !== 'string') throw new Error(`apply-rev29-i18n: ${locale}: ${fusedKey} missing`);
    let pair;
    if (isFused(current)) pair = splitFused(current, locale, fusedKey);
    else pair = currentPair(data, aKey, bKey);
    if (!pair) throw new Error(`apply-rev29-i18n: ${locale}: ${bKey} missing and ${fusedKey} is not fused`);
    if (setDeep(data, aKey, pair[0])) set += 1;
    if (setDeep(data, bKey, pair[1])) set += 1;
  }

  // 2-5. the new copy
  for (const [dotted, byLocale] of Object.entries(SET)) {
    const value = byLocale[locale];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`apply-rev29-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (setDeep(data, dotted, value)) set += 1;
  }

  // 6. the revived Shorts tree
  const shorts = SHORTS_COPY[locale];
  if (!shorts || typeof shorts !== 'object') throw new Error(`apply-rev29-i18n: no restored Shorts copy for ${locale}`);
  const flat = (node, prefix) => {
    for (const [k, v] of Object.entries(node)) {
      const key = `${prefix}.${k}`;
      if (typeof v === 'string') {
        if (setDeep(data, key, v)) set += 1;
      } else if (v && typeof v === 'object') flat(v, key);
    }
  };
  flat(shorts, 'Rev29.shorts');

  // Fail closed: nothing fused survives, nothing placeholder-shaped went in.
  for (const key of ['HotNews.category.welfare', 'HotNews.category.security', 'HotNews.category.health', 'HotNews.category.conflict']) {
    const v = getDeep(data, key);
    if (typeof v !== 'string' || !v || isFused(v)) throw new Error(`apply-rev29-i18n: ${locale}: ${key} is still fused or empty ("${v}")`);
  }
  const rev29 = JSON.stringify(getDeep(data, 'Rev29'));
  if (rev29.includes('[MISSING')) throw new Error(`apply-rev29-i18n: ${locale}: a placeholder survived in Rev29`);

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev29-i18n: clean' : `apply-rev29-i18n: ${totalChanges} locale file(s) would change`);
  process.exit(totalChanges === 0 ? 0 : 1);
}
console.log(`apply-rev29-i18n: wrote ${totalChanges} locale file(s)`);
