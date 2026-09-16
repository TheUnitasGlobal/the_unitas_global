/**
 * REV-34 MISSION 4-A/4-B i18n applicator (founder directive 2026-09-16) --
 * UNITAS SQUARE (U-Square).
 *
 * Idempotent, all 20 locales at once, a REAL translation per locale -- never a
 * placeholder. It writes ONLY its own sub-namespace, `Rev34.square.*`, by
 * deep-merging dotted keys (it never replaces the `Rev34` object, never deletes
 * a key), because the other REV-34 lanes ship their own `Rev34.<lane>.*` keys
 * to the same messages/*.json concurrently. If this lane's keys ever vanish
 * under a sibling's write, re-running this script restores them.
 *
 * It also UPDATES THE VALUES of three existing REV-29 keys the search bar and
 * the hub header still read (`Rev29.hub.title` / `lede` / `toggleAria`) so the
 * master tile and any legacy reader say "UNITAS SQUARE". The retired
 * `Rev29.hub.tabs.*` keys are left untouched (blueprint D-10: the REV-29
 * key-set parity test spans 20 locales, so a delete only adds risk); the
 * twenty tab labels live at `Rev34.square.themes.<key>.tab`.
 *
 * Key list (lib/square/themes.ts is the one ordered source of theme keys):
 *   title · lede (D-13) · toggleAria · swipeHint · lastTheme · founderOnly ·
 *   locked · signals.{online,packs,coins,lockins,modules,axes,nodes,uptime,
 *   burn,sales,nomad,index,live,local} ·
 *   themes.<key>.{tab,lede,features.0,features.1,features.2,cta} x 20
 *
 * Run: node scripts/apply-rev34-square-i18n.mjs [--check]
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
  if (v.length !== LOCALES.length) throw new Error(`apply-rev34-square-i18n: L() expects ${LOCALES.length} strings, got ${v.length}`);
  return Object.fromEntries(LOCALES.map((l, i) => [l, v[i]]));
};

/** The brand name is a proper noun -- identical in every locale by design. */
const BRAND = 'UNITAS SQUARE (U-Square)';
const TITLE = L(...LOCALES.map(() => BRAND));

/** Blueprint D-13 -- the cosmic lede, ko/en verbatim, 18 real translations. */
const LEDE = L(
  'A cosmic multidimensional nexus where infinite intelligence intersects and perpetual value expands — twenty hyper-themes resonating in one square.',
  '무한한 지성이 교차하고 영속적 가치가 팽창하는 코스믹 다차원 넥서스 — 스무 개의 하이퍼-테마가 하나의 광장에서 공명합니다.',
  'Kosmiline mitmemõõtmeline sõlmpunkt, kus lõpmatu intellekt ristub ja igavene väärtus paisub — kakskümmend hüperteemat kõlavad kokku ühel väljakul.',
  '無限の知性が交差し、永続する価値が膨張するコズミックな多次元ネクサス — 20のハイパーテーマがひとつの広場で共鳴します。',
  '无限智能交汇、永续价值膨胀的宇宙多维枢纽 — 二十个超级主题在同一个广场上共鸣。',
  'Un nexo cósmico multidimensional donde la inteligencia infinita se cruza y el valor perpetuo se expande — veinte hipertemas resonando en una sola plaza.',
  'ចំណុចប្រសព្វពហុវិមាត្រនៃលោកធាតុ ដែលបញ្ញាគ្មានទីបញ្ចប់ប្រសព្វគ្នា ហើយតម្លៃអមតៈរីកធំ — ប្រធានបទហ៊ីពឺម្ភៃ បន្លឺសំឡេងរួមគ្នាក្នុងទីលានតែមួយ។',
  'Un nexus cosmique multidimensionnel où l’intelligence infinie se croise et où la valeur perpétuelle s’étend — vingt hyper-thèmes qui résonnent sur une seule place.',
  'Ein kosmischer multidimensionaler Nexus, in dem sich unendliche Intelligenz kreuzt und beständiger Wert wächst — zwanzig Hyper-Themen, die auf einem Platz mitschwingen.',
  'Um nexo cósmico multidimensional onde a inteligência infinita se cruza e o valor perpétuo se expande — vinte hipertemas a ressoar numa só praça.',
  'Một nexus vũ trụ đa chiều nơi trí tuệ vô hạn giao thoa và giá trị vĩnh cửu mở rộng — hai mươi siêu chủ đề cộng hưởng trong một quảng trường.',
  'Sebuah nexus kosmik multidimensi tempat kecerdasan tanpa batas bersilangan dan nilai abadi mengembang — dua puluh hiper-tema bergema di satu alun-alun.',
  'Космический многомерный нексус, где пересекается бесконечный интеллект и расширяется вечная ценность — двадцать гипертем резонируют на одной площади.',
  'एक ब्रह्मांडीय बहुआयामी नेक्सस जहाँ अनंत बुद्धिमत्ता मिलती है और शाश्वत मूल्य फैलता है — एक ही चौक में गूंजते बीस हाइपर-थीम।',
  'Un nexus cosmico multidimensionale dove l’intelligenza infinita si incrocia e il valore perpetuo si espande — venti iper-temi che risuonano in un’unica piazza.',
  'Sonsuz zekânın kesiştiği ve kalıcı değerin genişlediği kozmik çok boyutlu bir nexus — tek bir meydanda yankılanan yirmi hiper-tema.',
  'เน็กซัสหลายมิติแห่งจักรวาลที่ปัญญาอันไร้ขอบเขตมาบรรจบและคุณค่านิรันดร์ขยายตัว — ยี่สิบไฮเปอร์ธีมสั่นพ้องกันในจัตุรัสเดียว',
  'Kosmiczny wielowymiarowy nexus, w którym krzyżuje się nieskończona inteligencja, a wieczna wartość się rozszerza — dwadzieścia hipertematów rezonujących na jednym placu.',
  'Een kosmische multidimensionale nexus waar oneindige intelligentie samenkomt en blijvende waarde uitdijt — twintig hyperthema’s die op één plein resoneren.',
  'Isang kosmikong multidimensyonal na nexus kung saan nagsasalubong ang walang-hanggang talino at lumalawak ang panghabang-panahong halaga — dalawampung hyper-tema na umaalingawngaw sa iisang plaza.',
);

const TOGGLE_ARIA = L(
  'Open UNITAS SQUARE (U-Square) — twenty hyper-themes from U-Rankings to U-Master',
  'UNITAS SQUARE (U-Square) 열기 — 유랭킹부터 유마스터까지 스무 개의 하이퍼-테마',
  'Ava UNITAS SQUARE (U-Square) — kakskümmend hüperteemat U-edetabelist U-meistrini',
  'UNITAS SQUARE (U-Square) を開く — UランキングからUマスターまで20のハイパーテーマ',
  '打开 UNITAS SQUARE (U-Square) — 从U排行榜到U大师的二十个超级主题',
  'Abrir UNITAS SQUARE (U-Square) — veinte hipertemas, de U-Ranking a U-Master',
  'បើក UNITAS SQUARE (U-Square) — ប្រធានបទហ៊ីពឺម្ភៃ ពី U-ចំណាត់ថ្នាក់ ដល់ U-មេ',
  'Ouvrir UNITAS SQUARE (U-Square) — vingt hyper-thèmes, de U-Classement à U-Master',
  'UNITAS SQUARE (U-Square) öffnen — zwanzig Hyper-Themen von U-Ranking bis U-Master',
  'Abrir UNITAS SQUARE (U-Square) — vinte hipertemas, de U-Ranking a U-Master',
  'Mở UNITAS SQUARE (U-Square) — hai mươi siêu chủ đề từ U-Xếp hạng đến U-Master',
  'Buka UNITAS SQUARE (U-Square) — dua puluh hiper-tema dari U-Peringkat hingga U-Master',
  'Открыть UNITAS SQUARE (U-Square) — двадцать гипертем от U-Рейтинга до U-Мастера',
  'UNITAS SQUARE (U-Square) खोलें — U-रैंकिंग से U-मास्टर तक बीस हाइपर-थीम',
  'Apri UNITAS SQUARE (U-Square) — venti iper-temi, da U-Classifica a U-Master',
  'UNITAS SQUARE (U-Square) aç — U-Sıralama’dan U-Master’a yirmi hiper-tema',
  'เปิด UNITAS SQUARE (U-Square) — ยี่สิบไฮเปอร์ธีม ตั้งแต่ U-อันดับ ถึง U-มาสเตอร์',
  'Otwórz UNITAS SQUARE (U-Square) — dwadzieścia hipertematów od U-Rankingu do U-Mastera',
  'Open UNITAS SQUARE (U-Square) — twintig hyperthema’s van U-Ranking tot U-Master',
  'Buksan ang UNITAS SQUARE (U-Square) — dalawampung hyper-tema mula U-Ranking hanggang U-Master',
);

/**
 * One theme = six keys x twenty locales. `theme(key, rows)` keeps every row
 * positional so a missing locale throws at load time, before any write.
 */
function theme(key, rows) {
  return {
    [`Rev34.square.themes.${key}.tab`]: L(...rows.tab),
    [`Rev34.square.themes.${key}.lede`]: L(...rows.lede),
    [`Rev34.square.themes.${key}.features.0`]: L(...rows.f0),
    [`Rev34.square.themes.${key}.features.1`]: L(...rows.f1),
    [`Rev34.square.themes.${key}.features.2`]: L(...rows.f2),
    [`Rev34.square.themes.${key}.cta`]: L(...rows.cta),
  };
}

const SET = {
  'Rev34.square.title': TITLE,
  'Rev34.square.lede': LEDE,
  'Rev34.square.toggleAria': TOGGLE_ARIA,
  // The three REV-29 readers (search-bar tile label, legacy header) say the new name too.
  'Rev29.hub.title': TITLE,
  'Rev29.hub.lede': LEDE,
  'Rev29.hub.toggleAria': TOGGLE_ARIA,

  'Rev34.square.swipeHint': L(
    'Swipe or drag the theme rail to reach all twenty themes.',
    '테마 레일을 밀거나 끌어 스무 개 테마 전체로 이동할 수 있습니다.',
    'Pühi või lohista teemariba, et jõuda kõigi kahekümne teemani.',
    'テーマのレールをスワイプまたはドラッグすると20のテーマすべてに移動できます。',
    '滑动或拖动主题栏即可浏览全部二十个主题。',
    'Desliza o arrastra el carril de temas para llegar a los veinte temas.',
    'អូស ឬទាញរបារប្រធានបទ ដើម្បីទៅដល់ប្រធានបទទាំងម្ភៃ។',
    'Balayez ou faites glisser le rail des thèmes pour atteindre les vingt thèmes.',
    'Wische oder ziehe die Themenleiste, um alle zwanzig Themen zu erreichen.',
    'Deslize ou arraste a barra de temas para chegar aos vinte temas.',
    'Vuốt hoặc kéo thanh chủ đề để đến đủ hai mươi chủ đề.',
    'Geser atau seret rel tema untuk menjangkau semua dua puluh tema.',
    'Проведите или перетащите ленту тем, чтобы добраться до всех двадцати тем.',
    'सभी बीस थीम तक पहुँचने के लिए थीम रेल को स्वाइप या ड्रैग करें।',
    'Scorri o trascina la barra dei temi per raggiungere tutti e venti i temi.',
    'Yirmi temanın tamamına ulaşmak için tema şeridini kaydırın veya sürükleyin.',
    'ปัดหรือลากแถบธีมเพื่อไปยังธีมทั้งยี่สิบ',
    'Przesuń lub przeciągnij pasek tematów, aby dotrzeć do wszystkich dwudziestu tematów.',
    'Veeg of sleep de themabalk om alle twintig thema’s te bereiken.',
    'Mag-swipe o hilahin ang riles ng tema para maabot ang lahat ng dalawampung tema.',
  ),
  'Rev34.square.lastTheme': L(
    'Reopened on the theme you visited last.',
    '마지막으로 방문한 테마에서 다시 열렸습니다.',
    'Avati uuesti teemal, mida viimati külastasid.',
    '最後に開いたテーマで再び開きました。',
    '已在你上次访问的主题上重新打开。',
    'Reabierto en el tema que visitaste por última vez.',
    'បានបើកឡើងវិញនៅប្រធានបទដែលអ្នកបានចូលមើលចុងក្រោយ។',
    'Rouvert sur le thème que vous avez consulté en dernier.',
    'Wieder auf dem zuletzt besuchten Thema geöffnet.',
    'Reaberto no tema que visitou da última vez.',
    'Đã mở lại ở chủ đề bạn xem lần cuối.',
    'Dibuka kembali pada tema yang terakhir Anda kunjungi.',
    'Снова открыто на теме, которую вы посещали последней.',
    'आपके द्वारा अंतिम बार देखी गई थीम पर फिर से खोला गया।',
    'Riaperto sul tema che hai visitato per ultimo.',
    'En son ziyaret ettiğiniz temada yeniden açıldı.',
    'เปิดอีกครั้งที่ธีมที่คุณเข้าชมล่าสุด',
    'Otwarto ponownie na temacie, który odwiedzono ostatnio.',
    'Opnieuw geopend op het thema dat je het laatst bezocht.',
    'Muling binuksan sa temang huli mong binisita.',
  ),
  'Rev34.square.founderOnly': L(
    'Founder-only control room. The public sees this theme locked; a sovereign session opens it.',
    '창립자 전용 통제실입니다. 공개 방문자에게는 잠금 상태로 보이며, 소버린 세션이 있을 때만 열립니다.',
    'Ainult asutaja juhtimisruum. Avalikkus näeb seda teemat lukustatuna; suveräänne seanss avab selle.',
    '創立者専用の管制室です。一般には施錠状態で表示され、ソブリンセッションがある場合のみ開きます。',
    '创始人专属控制室。公众看到的是锁定状态；只有主权会话才能打开。',
    'Sala de control solo para el fundador. El público ve este tema bloqueado; una sesión soberana lo abre.',
    'បន្ទប់បញ្ជាសម្រាប់តែស្ថាបនិក។ សាធារណជនឃើញប្រធានបទនេះជាប់សោ; សម័យអធិបតេយ្យប៉ុណ្ណោះដែលបើកវាបាន។',
    'Salle de contrôle réservée au fondateur. Le public voit ce thème verrouillé ; une session souveraine l’ouvre.',
    'Kontrollraum nur für den Gründer. Die Öffentlichkeit sieht dieses Thema gesperrt; eine souveräne Sitzung öffnet es.',
    'Sala de controlo exclusiva do fundador. O público vê este tema bloqueado; uma sessão soberana abre-o.',
    'Phòng điều khiển dành riêng cho nhà sáng lập. Công chúng thấy chủ đề này bị khóa; phiên chủ quyền sẽ mở nó.',
    'Ruang kendali khusus pendiri. Publik melihat tema ini terkunci; sesi berdaulat membukanya.',
    'Пульт управления только для основателя. Публика видит эту тему закрытой; суверенная сессия открывает её.',
    'केवल संस्थापक के लिए नियंत्रण कक्ष। जनता को यह थीम लॉक दिखती है; संप्रभु सत्र इसे खोलता है।',
    'Sala di controllo riservata al fondatore. Il pubblico vede questo tema bloccato; una sessione sovrana lo apre.',
    'Yalnızca kurucuya özel kontrol odası. Halk bu temayı kilitli görür; egemen oturum onu açar.',
    'ห้องควบคุมสำหรับผู้ก่อตั้งเท่านั้น สาธารณะจะเห็นธีมนี้ถูกล็อก เซสชันอธิปไตยเท่านั้นที่เปิดได้',
    'Pokój kontrolny tylko dla założyciela. Publiczność widzi ten temat zablokowany; otwiera go sesja suwerenna.',
    'Controlekamer alleen voor de oprichter. Het publiek ziet dit thema vergrendeld; een soevereine sessie opent het.',
    'Control room para sa founder lamang. Nakikita ng publiko ang temang ito na naka-lock; binubuksan ito ng sovereign session.',
  ),
  'Rev34.square.locked': L(
    'Locked', '잠김', 'Lukus', 'ロック中', '已锁定', 'Bloqueado', 'ជាប់សោ', 'Verrouillé', 'Gesperrt', 'Bloqueado',
    'Đã khóa', 'Terkunci', 'Закрыто', 'लॉक', 'Bloccato', 'Kilitli', 'ล็อกอยู่', 'Zablokowane', 'Vergrendeld', 'Naka-lock',
  ),

  // -- signal tile labels (shared by every descriptor panel) ------------------
  'Rev34.square.signals.online': L(
    'Link', '연결', 'Ühendus', 'リンク', '链接', 'Enlace', 'តំណ', 'Liaison', 'Verbindung', 'Ligação',
    'Kết nối', 'Tautan', 'Связь', 'लिंक', 'Collegamento', 'Bağlantı', 'การเชื่อมต่อ', 'Połączenie', 'Verbinding', 'Koneksyon',
  ),
  'Rev34.square.signals.packs': L(
    'Packs owned', '보유 팩', 'Omatud pakid', '所有パック', '持有知识包', 'Packs adquiridos', 'កញ្ចប់ដែលមាន', 'Packs possédés', 'Eigene Packs', 'Packs adquiridos',
    'Gói sở hữu', 'Paket dimiliki', 'Купленные паки', 'स्वामित्व वाले पैक', 'Pack posseduti', 'Sahip olunan paketler', 'แพ็กที่ถือครอง', 'Posiadane pakiety', 'Eigen packs', 'Mga pack na pag-aari',
  ),
  'Rev34.square.signals.coins': L(
    'U-Coins', 'U-코인', 'U-mündid', 'Uコイン', 'U币', 'U-Coins', 'U-កាក់', 'U-Coins', 'U-Coins', 'U-Coins',
    'U-Coin', 'U-Coin', 'U-монеты', 'U-कॉइन', 'U-Coin', 'U-Coin', 'U-คอยน์', 'U-monety', 'U-munten', 'U-Coins',
  ),
  'Rev34.square.signals.lockins': L(
    'Active lock-ins', '활성 락인', 'Aktiivsed lukustused', '有効なロックイン', '已激活锁定模块', 'Lock-ins activos', 'ការចាក់សោសកម្ម', 'Lock-ins actifs', 'Aktive Lock-ins', 'Lock-ins ativos',
    'Lock-in đang bật', 'Lock-in aktif', 'Активные lock-in', 'सक्रिय लॉक-इन', 'Lock-in attivi', 'Etkin lock-in’ler', 'ล็อกอินที่ใช้งาน', 'Aktywne lock-iny', 'Actieve lock-ins', 'Mga aktibong lock-in',
  ),
  'Rev34.square.signals.modules': L(
    'Modules', '모듈', 'Moodulid', 'モジュール', '模块', 'Módulos', 'ម៉ូឌុល', 'Modules', 'Module', 'Módulos',
    'Mô-đun', 'Modul', 'Модули', 'मॉड्यूल', 'Moduli', 'Modüller', 'โมดูล', 'Moduły', 'Modules', 'Mga module',
  ),
  'Rev34.square.signals.axes': L(
    'Governance axes', '거버넌스 축', 'Juhtimisteljed', 'ガバナンス軸', '治理轴', 'Ejes de gobernanza', 'អ័ក្សអភិបាលកិច្ច', 'Axes de gouvernance', 'Governance-Achsen', 'Eixos de governança',
    'Trục quản trị', 'Poros tata kelola', 'Оси управления', 'शासन अक्ष', 'Assi di governance', 'Yönetişim eksenleri', 'แกนธรรมาภิบาล', 'Osie zarządzania', 'Governance-assen', 'Mga aksis ng pamamahala',
  ),
  'Rev34.square.signals.nodes': L(
    'Swarm nodes', '스웜 노드', 'Parve sõlmed', 'スウォームノード', '蜂群节点', 'Nodos del enjambre', 'ថ្នាំងហ្វូង', 'Nœuds de l’essaim', 'Schwarm-Knoten', 'Nós do enxame',
    'Nút bầy', 'Node kawanan', 'Узлы роя', 'स्वार्म नोड', 'Nodi dello sciame', 'Sürü düğümleri', 'โหนดสวอร์ม', 'Węzły roju', 'Zwermknopen', 'Mga node ng swarm',
  ),
  'Rev34.square.signals.uptime': L(
    'Days live', '가동 일수', 'Päevi töös', '稼働日数', '上线天数', 'Días activo', 'ថ្ងៃដំណើរការ', 'Jours en ligne', 'Tage live', 'Dias ativo',
    'Số ngày hoạt động', 'Hari aktif', 'Дней в работе', 'सक्रिय दिन', 'Giorni attivo', 'Yayında gün', 'จำนวนวันที่เปิด', 'Dni działania', 'Dagen live', 'Mga araw na aktibo',
  ),
  'Rev34.square.signals.burn': L(
    'Micro-Burn efficiency', '마이크로-버른 효율', 'Micro-Burn tõhusus', 'マイクロバーン効率', '微燃效率', 'Eficiencia Micro-Burn', 'ប្រសិទ្ធភាព Micro-Burn', 'Efficacité Micro-Burn', 'Micro-Burn-Effizienz', 'Eficiência Micro-Burn',
    'Hiệu suất Micro-Burn', 'Efisiensi Micro-Burn', 'Эффективность Micro-Burn', 'माइक्रो-बर्न दक्षता', 'Efficienza Micro-Burn', 'Micro-Burn verimliliği', 'ประสิทธิภาพ Micro-Burn', 'Efektywność Micro-Burn', 'Micro-Burn-efficiëntie', 'Kahusayan sa Micro-Burn',
  ),
  'Rev34.square.signals.sales': L(
    'Listings', '판매 등록', 'Müügipakkumised', '出品数', '挂单', 'Publicaciones', 'ការដាក់លក់', 'Annonces', 'Angebote', 'Anúncios',
    'Tin đăng bán', 'Daftar jual', 'Объявления', 'लिस्टिंग', 'Inserzioni', 'İlanlar', 'รายการขาย', 'Oferty', 'Aanbiedingen', 'Mga listing',
  ),
  'Rev34.square.signals.nomad': L(
    'Nomad contribution', '노마드 기여도', 'Nomaadipanus', 'ノマド貢献度', '游牧贡献', 'Aporte nómada', 'ការចូលរួមណូម៉ាដ', 'Contribution nomade', 'Nomaden-Beitrag', 'Contribuição nómada',
    'Đóng góp du mục', 'Kontribusi nomaden', 'Вклад номада', 'नोमैड योगदान', 'Contributo nomade', 'Göçebe katkısı', 'การมีส่วนร่วมโนแมด', 'Wkład nomady', 'Nomadenbijdrage', 'Ambag ng nomad',
  ),
  'Rev34.square.signals.index': L(
    'Sovereign index', '소버린 지수', 'Suveräänsusindeks', 'ソブリン指数', '主权指数', 'Índice soberano', 'សន្ទស្សន៍អធិបតេយ្យ', 'Indice souverain', 'Souveränitätsindex', 'Índice soberano',
    'Chỉ số chủ quyền', 'Indeks berdaulat', 'Суверенный индекс', 'संप्रभु सूचकांक', 'Indice sovrano', 'Egemenlik endeksi', 'ดัชนีอธิปไตย', 'Indeks suwerenności', 'Soevereiniteitsindex', 'Sovereign index',
  ),
  'Rev34.square.signals.live': L(
    'Live', '실시간', 'Otse', 'ライブ', '实时', 'En vivo', 'ផ្សាយផ្ទាល់', 'En direct', 'Live', 'Ao vivo',
    'Trực tiếp', 'Langsung', 'Онлайн', 'लाइव', 'Dal vivo', 'Canlı', 'สด', 'Na żywo', 'Live', 'Live',
  ),
  'Rev34.square.signals.local': L(
    'This device', '이 기기', 'See seade', 'この端末', '本设备', 'Este dispositivo', 'ឧបករណ៍នេះ', 'Cet appareil', 'Dieses Gerät', 'Este dispositivo',
    'Thiết bị này', 'Perangkat ini', 'Это устройство', 'यह डिवाइस', 'Questo dispositivo', 'Bu cihaz', 'อุปกรณ์นี้', 'To urządzenie', 'Dit apparaat', 'Device na ito',
  ),

  // -- the twenty themes, founder order (lib/square/themes.ts) ----------------
  ...theme('uRanking', {
    tab: ['U-Rankings', '유랭킹', 'U-edetabel', 'Uランキング', 'U排行榜', 'U-Ranking', 'U-ចំណាត់ថ្នាក់', 'U-Classement', 'U-Ranking', 'U-Ranking', 'U-Xếp hạng', 'U-Peringkat', 'U-Рейтинг', 'U-रैंकिंग', 'U-Classifica', 'U-Sıralama', 'U-อันดับ', 'U-Ranking', 'U-Ranking', 'U-Ranking'],
    lede: [
      'Today’s ladder of sovereign operators, reseeded every day.',
      '매일 새로 시드되는 오늘의 소버린 오퍼레이터 사다리.',
      'Tänane suveräänsete operaatorite edetabel, iga päev uuesti seemendatud.',
      '毎日再シードされる、今日のソブリン・オペレーターのはしご。',
      '每日重新生成的今日主权运营者榜单。',
      'La escalera de hoy de operadores soberanos, resembrada cada día.',
      'ជណ្ដើរប្រតិបត្តិករអធិបតេយ្យថ្ងៃនេះ ដែលបង្កើតឡើងវិញរាល់ថ្ងៃ។',
      'L’échelle du jour des opérateurs souverains, réinitialisée chaque jour.',
      'Die Tagesleiter der souveränen Operatoren, jeden Tag neu gesetzt.',
      'A escada de hoje dos operadores soberanos, renovada todos os dias.',
      'Bảng thang hôm nay của các nhà vận hành chủ quyền, tạo mới mỗi ngày.',
      'Tangga operator berdaulat hari ini, disemai ulang setiap hari.',
      'Сегодняшняя лестница суверенных операторов, обновляемая каждый день.',
      'संप्रभु ऑपरेटरों की आज की सीढ़ी, हर दिन नए सिरे से।',
      'La scala di oggi degli operatori sovrani, rigenerata ogni giorno.',
      'Egemen operatörlerin bugünkü merdiveni, her gün yeniden tohumlanır.',
      'บันไดของผู้ปฏิบัติการอธิปไตยประจำวันนี้ สร้างใหม่ทุกวัน',
      'Dzisiejsza drabina suwerennych operatorów, odnawiana każdego dnia.',
      'De ladder van vandaag met soevereine operators, elke dag opnieuw gezaaid.',
      'Ang hagdan ngayong araw ng mga sovereign operator, muling binubuo araw-araw.',
    ],
    f0: ['Twelve operators a day', '하루 열두 오퍼레이터', 'Kaksteist operaatorit päevas', '1日12人のオペレーター', '每天十二位运营者', 'Doce operadores al día', 'ប្រតិបត្តិករដប់ពីរនាក់ក្នុងមួយថ្ងៃ', 'Douze opérateurs par jour', 'Zwölf Operatoren pro Tag', 'Doze operadores por dia', 'Mười hai nhà vận hành mỗi ngày', 'Dua belas operator per hari', 'Двенадцать операторов в день', 'प्रतिदिन बारह ऑपरेटर', 'Dodici operatori al giorno', 'Günde on iki operatör', 'สิบสองผู้ปฏิบัติการต่อวัน', 'Dwunastu operatorów dziennie', 'Twaalf operators per dag', 'Labindalawang operator bawat araw'],
    f1: ['Micro-Burn, sales and nomad metrics', '마이크로-버른·판매·노마드 지표', 'Micro-Burn, müügi ja nomaadi mõõdikud', 'マイクロバーン・販売・ノマド指標', '微燃、销售与游牧指标', 'Métricas Micro-Burn, ventas y nómada', 'រង្វាស់ Micro-Burn ការលក់ និងណូម៉ាដ', 'Métriques Micro-Burn, ventes et nomade', 'Micro-Burn-, Verkaufs- und Nomaden-Metriken', 'Métricas Micro-Burn, vendas e nómada', 'Chỉ số Micro-Burn, bán hàng và du mục', 'Metrik Micro-Burn, penjualan, dan nomaden', 'Метрики Micro-Burn, продаж и номада', 'माइक्रो-बर्न, बिक्री और नोमैड मेट्रिक्स', 'Metriche Micro-Burn, vendite e nomade', 'Micro-Burn, satış ve göçebe metrikleri', 'ตัวชี้วัด Micro-Burn ยอดขาย และโนแมด', 'Metryki Micro-Burn, sprzedaży i nomady', 'Micro-Burn-, verkoop- en nomadenmetrieken', 'Mga sukatan ng Micro-Burn, benta at nomad'],
    f2: ['Ladder filtered by module', '모듈별 필터 사다리', 'Edetabel mooduli järgi', 'モジュール別に絞り込めるはしご', '按模块筛选榜单', 'Escalera filtrada por módulo', 'ជណ្ដើរតម្រងតាមម៉ូឌុល', 'Échelle filtrée par module', 'Leiter nach Modul gefiltert', 'Escada filtrada por módulo', 'Bảng thang lọc theo mô-đun', 'Tangga difilter per modul', 'Лестница с фильтром по модулю', 'मॉड्यूल के अनुसार फ़िल्टर की गई सीढ़ी', 'Scala filtrata per modulo', 'Modüle göre filtrelenen merdiven', 'บันไดกรองตามโมดูล', 'Drabina filtrowana według modułu', 'Ladder gefilterd per module', 'Hagdan na sinala ayon sa module'],
    cta: ['Open U-AI', 'U-AI 열기', 'Ava U-AI', 'U-AI を開く', '打开 U-AI', 'Abrir U-AI', 'បើក U-AI', 'Ouvrir U-AI', 'U-AI öffnen', 'Abrir U-AI', 'Mở U-AI', 'Buka U-AI', 'Открыть U-AI', 'U-AI खोलें', 'Apri U-AI', 'U-AI’yi aç', 'เปิด U-AI', 'Otwórz U-AI', 'U-AI openen', 'Buksan ang U-AI'],
  }),

  ...theme('uShorts', {
    tab: ['U-Shorts', '유숏츠', 'U-lühivideod', 'Uショート', 'U短视频', 'U-Shorts', 'U-វីដេអូខ្លី', 'U-Shorts', 'U-Shorts', 'U-Shorts', 'U-Video ngắn', 'U-Shorts', 'U-Шортс', 'U-शॉर्ट्स', 'U-Shorts', 'U-Kısa Video', 'U-ชอร์ต', 'U-Shorts', 'U-Shorts', 'U-Shorts'],
    lede: [
      'Vertical shorts along the twenty-two governance axes — one tap to play.',
      '스물두 개 거버넌스 축을 따라 흐르는 세로형 숏츠 — 한 번의 탭으로 재생.',
      'Vertikaalsed lühivideod kahekümne kahe juhtimistelje ulatuses — üks puudutus ja mängib.',
      '22のガバナンス軸に沿った縦型ショート — ワンタップで再生。',
      '沿二十二条治理轴排布的竖屏短视频 — 一键播放。',
      'Shorts verticales a lo largo de los veintidós ejes de gobernanza — un toque para reproducir.',
      'វីដេអូខ្លីបញ្ឈរតាមអ័ក្សអភិបាលកិច្ចម្ភៃពីរ — ចុចម្តងដើម្បីចាក់។',
      'Des shorts verticaux le long des vingt-deux axes de gouvernance — une pression pour lire.',
      'Vertikale Shorts entlang der zweiundzwanzig Governance-Achsen — ein Tipp zum Abspielen.',
      'Shorts verticais ao longo dos vinte e dois eixos de governança — um toque para reproduzir.',
      'Video ngắn dọc theo hai mươi hai trục quản trị — chạm một lần để phát.',
      'Shorts vertikal di sepanjang dua puluh dua poros tata kelola — satu ketukan untuk memutar.',
      'Вертикальные шортс по двадцати двум осям управления — одно касание для воспроизведения.',
      'बाईस शासन अक्षों पर लंबवत शॉर्ट्स — एक टैप में चलाएँ।',
      'Short verticali lungo i ventidue assi di governance — un tocco per riprodurre.',
      'Yirmi iki yönetişim ekseni boyunca dikey kısa videolar — oynatmak için tek dokunuş.',
      'ชอร์ตแนวตั้งตามแกนธรรมาภิบาลทั้งยี่สิบสอง — แตะครั้งเดียวเพื่อเล่น',
      'Pionowe shorty wzdłuż dwudziestu dwóch osi zarządzania — jedno dotknięcie, by odtworzyć.',
      'Verticale shorts langs de tweeëntwintig governance-assen — één tik om af te spelen.',
      'Mga patayong short sa dalawampu’t dalawang aksis ng pamamahala — isang tap para mag-play.',
    ],
    f0: ['Filters for all 22 axes', '22축 전체 필터', 'Filtrid kõigile 22 teljele', '22軸すべてのフィルター', '全部22轴筛选', 'Filtros para los 22 ejes', 'តម្រងសម្រាប់អ័ក្សទាំង 22', 'Filtres pour les 22 axes', 'Filter für alle 22 Achsen', 'Filtros para os 22 eixos', 'Bộ lọc cho cả 22 trục', 'Filter untuk semua 22 poros', 'Фильтры по всем 22 осям', 'सभी 22 अक्षों के फ़िल्टर', 'Filtri per tutti i 22 assi', '22 eksenin tamamı için filtreler', 'ตัวกรองครบ 22 แกน', 'Filtry dla wszystkich 22 osi', 'Filters voor alle 22 assen', 'Mga filter para sa lahat ng 22 aksis'],
    f1: ['Creator pass reservation', '크리에이터 패스 예약', 'Looja passi broneering', 'クリエイターパス予約', '创作者通行证预约', 'Reserva del pase de creador', 'ការកក់ប័ណ្ណអ្នកបង្កើត', 'Réservation du pass créateur', 'Creator-Pass-Reservierung', 'Reserva do passe de criador', 'Đặt trước thẻ nhà sáng tạo', 'Reservasi pass kreator', 'Бронирование пропуска автора', 'क्रिएटर पास आरक्षण', 'Prenotazione del pass creator', 'İçerik üretici kartı rezervasyonu', 'จองบัตรผ่านครีเอเตอร์', 'Rezerwacja przepustki twórcy', 'Reservering van de creator-pass', 'Reserbasyon ng creator pass'],
    f2: ['Autoplay rail', '자동 재생 레일', 'Automaatesituse riba', '自動再生レール', '自动播放轨道', 'Carril de reproducción automática', 'របារចាក់ស្វ័យប្រវត្តិ', 'Rail en lecture automatique', 'Autoplay-Leiste', 'Barra de reprodução automática', 'Thanh tự động phát', 'Rel putar otomatis', 'Лента с автовоспроизведением', 'ऑटोप्ले रेल', 'Barra in riproduzione automatica', 'Otomatik oynatma şeridi', 'แถบเล่นอัตโนมัติ', 'Pasek z autoodtwarzaniem', 'Rail met automatisch afspelen', 'Riles na autoplay'],
    cta: ['Open U-AI', 'U-AI 열기', 'Ava U-AI', 'U-AI を開く', '打开 U-AI', 'Abrir U-AI', 'បើក U-AI', 'Ouvrir U-AI', 'U-AI öffnen', 'Abrir U-AI', 'Mở U-AI', 'Buka U-AI', 'Открыть U-AI', 'U-AI खोलें', 'Apri U-AI', 'U-AI’yi aç', 'เปิด U-AI', 'Otwórz U-AI', 'U-AI openen', 'Buksan ang U-AI'],
  }),

  ...theme('uTalk', {
    tab: ['U-Talk', '유토크', 'U-vestlus', 'Uトーク', 'U聊天', 'U-Talk', 'U-ជជែក', 'U-Talk', 'U-Talk', 'U-Talk', 'U-Trò chuyện', 'U-Talk', 'U-Чат', 'U-टॉक', 'U-Talk', 'U-Sohbet', 'U-ทอล์ก', 'U-Talk', 'U-Talk', 'U-Talk'],
    lede: [
      'Twenty-two theme rooms where the network talks live.',
      '네트워크가 실시간으로 대화하는 스물두 개의 테마 방.',
      'Kakskümmend kaks teemaruumi, kus võrgustik vestleb otse.',
      'ネットワークがライブで語り合う22のテーマルーム。',
      '网络实时交流的二十二个主题房间。',
      'Veintidós salas temáticas donde la red conversa en vivo.',
      'បន្ទប់ប្រធានបទម្ភៃពីរ ដែលបណ្តាញជជែកគ្នាផ្ទាល់។',
      'Vingt-deux salons thématiques où le réseau échange en direct.',
      'Zweiundzwanzig Themenräume, in denen das Netzwerk live spricht.',
      'Vinte e duas salas temáticas onde a rede conversa ao vivo.',
      'Hai mươi hai phòng chủ đề nơi mạng lưới trò chuyện trực tiếp.',
      'Dua puluh dua ruang tema tempat jaringan berbincang langsung.',
      'Двадцать две тематические комнаты, где сеть общается вживую.',
      'बाईस थीम कक्ष जहाँ नेटवर्क लाइव बात करता है।',
      'Ventidue stanze tematiche dove la rete parla dal vivo.',
      'Ağın canlı sohbet ettiği yirmi iki tema odası.',
      'ห้องธีมยี่สิบสองห้องที่เครือข่ายพูดคุยกันสด',
      'Dwadzieścia dwa pokoje tematyczne, w których sieć rozmawia na żywo.',
      'Tweeëntwintig themakamers waar het netwerk live praat.',
      'Dalawampu’t dalawang tema-silid kung saan live na nag-uusap ang network.',
    ],
    f0: ['One room per governance axis', '거버넌스 축마다 방 하나', 'Üks ruum iga juhtimistelje kohta', 'ガバナンス軸ごとに1ルーム', '每条治理轴一个房间', 'Una sala por eje de gobernanza', 'បន្ទប់មួយក្នុងមួយអ័ក្សអភិបាលកិច្ច', 'Un salon par axe de gouvernance', 'Ein Raum pro Governance-Achse', 'Uma sala por eixo de governança', 'Một phòng cho mỗi trục quản trị', 'Satu ruang per poros tata kelola', 'Одна комната на ось управления', 'प्रति शासन अक्ष एक कक्ष', 'Una stanza per asse di governance', 'Her yönetişim ekseni için bir oda', 'หนึ่งห้องต่อหนึ่งแกนธรรมาภิบาล', 'Jeden pokój na oś zarządzania', 'Eén kamer per governance-as', 'Isang silid bawat aksis ng pamamahala'],
    f1: ['Device-only fallback offline', '오프라인에서는 이 기기 전용으로 유지', 'Võrguta jätkub ainult seadmes', 'オフライン時は端末内のみで継続', '离线时仅保存在本设备', 'Solo en el dispositivo sin conexión', 'ក្រៅបណ្ដាញ រក្សាទុកតែក្នុងឧបករណ៍', 'Repli sur l’appareil hors ligne', 'Offline nur auf dem Gerät', 'Só no dispositivo quando offline', 'Ngoại tuyến chỉ lưu trên thiết bị', 'Hanya di perangkat saat offline', 'Офлайн — только на устройстве', 'ऑफ़लाइन में केवल डिवाइस पर', 'Solo sul dispositivo quando offline', 'Çevrimdışıyken yalnızca cihazda', 'ออฟไลน์เก็บไว้เฉพาะในอุปกรณ์', 'Offline tylko na urządzeniu', 'Offline alleen op dit apparaat', 'Sa device lang kapag offline'],
    f2: ['Live presence count', '실시간 접속자 수', 'Otsene kohalolijate arv', 'ライブ参加者数', '实时在线人数', 'Recuento de presencia en vivo', 'ចំនួនអ្នកចូលរួមផ្ទាល់', 'Compteur de présence en direct', 'Live-Anwesenheitszähler', 'Contagem de presença ao vivo', 'Số người có mặt trực tiếp', 'Jumlah kehadiran langsung', 'Счётчик присутствия онлайн', 'लाइव उपस्थिति गणना', 'Conteggio presenze dal vivo', 'Canlı katılımcı sayısı', 'จำนวนผู้อยู่ในห้องแบบสด', 'Licznik obecności na żywo', 'Live aanwezigheidsteller', 'Bilang ng live na presensya'],
    cta: ['Open U-AI', 'U-AI 열기', 'Ava U-AI', 'U-AI を開く', '打开 U-AI', 'Abrir U-AI', 'បើក U-AI', 'Ouvrir U-AI', 'U-AI öffnen', 'Abrir U-AI', 'Mở U-AI', 'Buka U-AI', 'Открыть U-AI', 'U-AI खोलें', 'Apri U-AI', 'U-AI’yi aç', 'เปิด U-AI', 'Otwórz U-AI', 'U-AI openen', 'Buksan ang U-AI'],
  }),

  ...theme('uExchange', {
    tab: ['U-Exchange', '유지식거래소', 'U-teadmisbörs', 'U知識取引所', 'U知识交易所', 'U-Exchange', 'U-ផ្សារចំណេះដឹង', 'U-Exchange', 'U-Exchange', 'U-Exchange', 'U-Sàn tri thức', 'U-Bursa', 'U-Биржа', 'U-एक्सचेंज', 'U-Exchange', 'U-Borsa', 'U-ตลาดความรู้', 'U-Giełda', 'U-Exchange', 'U-Exchange'],
    lede: [
      'Buy and sell knowledge packs with U-Coins, settled on your device or the live ledger.',
      'U-코인으로 지식 팩을 사고팔며, 이 기기 또는 실시간 원장에서 정산됩니다.',
      'Osta ja müü teadmispakke U-müntidega, arveldus seadmes või otseregistris.',
      'Uコインで知識パックを売買し、端末またはライブ台帳で決済。',
      '用U币买卖知识包，在本设备或实时账本上结算。',
      'Compra y vende packs de conocimiento con U-Coins, liquidados en tu dispositivo o en el libro mayor en vivo.',
      'ទិញ និងលក់កញ្ចប់ចំណេះដឹងដោយ U-កាក់ ទូទាត់នៅលើឧបករណ៍អ្នក ឬសៀវភៅបញ្ជីផ្ទាល់។',
      'Achetez et vendez des packs de savoir en U-Coins, réglés sur votre appareil ou sur le registre en direct.',
      'Wissenspacks mit U-Coins kaufen und verkaufen, abgerechnet auf deinem Gerät oder im Live-Ledger.',
      'Compre e venda packs de conhecimento com U-Coins, liquidados no seu dispositivo ou no livro-razão ao vivo.',
      'Mua bán gói tri thức bằng U-Coin, thanh toán trên thiết bị của bạn hoặc sổ cái trực tiếp.',
      'Beli dan jual paket pengetahuan dengan U-Coin, diselesaikan di perangkat Anda atau buku besar langsung.',
      'Покупайте и продавайте паки знаний за U-монеты с расчётом на устройстве или в онлайн-реестре.',
      'U-कॉइन से ज्ञान पैक खरीदें-बेचें, आपके डिवाइस या लाइव लेजर पर निपटान।',
      'Compra e vendi pack di conoscenza con U-Coin, regolati sul tuo dispositivo o sul registro dal vivo.',
      'Bilgi paketlerini U-Coin ile alıp satın; cihazınızda veya canlı defterde mutabakat.',
      'ซื้อขายแพ็กความรู้ด้วย U-คอยน์ ชำระบนอุปกรณ์ของคุณหรือบัญชีแยกประเภทแบบสด',
      'Kupuj i sprzedawaj pakiety wiedzy za U-monety, rozliczane na urządzeniu lub w księdze na żywo.',
      'Koop en verkoop kennispacks met U-munten, verrekend op je apparaat of het live grootboek.',
      'Bumili at magbenta ng mga knowledge pack gamit ang U-Coins, sinasettle sa device mo o sa live ledger.',
    ],
    f0: ['Curated knowledge packs', '큐레이션된 지식 팩', 'Kureeritud teadmispakid', '厳選された知識パック', '精选知识包', 'Packs de conocimiento curados', 'កញ្ចប់ចំណេះដឹងដែលបានជ្រើសរើស', 'Packs de savoir sélectionnés', 'Kuratierte Wissenspacks', 'Packs de conhecimento selecionados', 'Gói tri thức được tuyển chọn', 'Paket pengetahuan pilihan', 'Отобранные паки знаний', 'चयनित ज्ञान पैक', 'Pack di conoscenza selezionati', 'Seçilmiş bilgi paketleri', 'แพ็กความรู้ที่คัดสรร', 'Wyselekcjonowane pakiety wiedzy', 'Samengestelde kennispacks', 'Mga piniling knowledge pack'],
    f1: ['List your own packs', '내 팩 직접 판매 등록', 'Pane oma pakid müüki', '自分のパックを出品', '发布你自己的知识包', 'Publica tus propios packs', 'ដាក់លក់កញ្ចប់របស់អ្នក', 'Mettez vos propres packs en vente', 'Eigene Packs anbieten', 'Anuncie os seus próprios packs', 'Đăng bán gói của riêng bạn', 'Daftarkan paket Anda sendiri', 'Выставляйте свои паки', 'अपने पैक सूचीबद्ध करें', 'Metti in vendita i tuoi pack', 'Kendi paketlerinizi listeleyin', 'ลงขายแพ็กของคุณเอง', 'Wystawiaj własne pakiety', 'Bied je eigen packs aan', 'Ilista ang sarili mong mga pack'],
    f2: ['Live ledger sync when signed in', '로그인 시 실시간 원장 동기화', 'Sisselogituna otseregistri sünk', 'サインイン時にライブ台帳と同期', '登录后同步实时账本', 'Sincronización con el libro mayor al iniciar sesión', 'ធ្វើសមកាលកម្មសៀវភៅបញ្ជីផ្ទាល់ពេលចូល', 'Synchronisation du registre en direct une fois connecté', 'Live-Ledger-Sync nach Anmeldung', 'Sincronização do livro-razão ao iniciar sessão', 'Đồng bộ sổ cái trực tiếp khi đăng nhập', 'Sinkronisasi buku besar langsung saat masuk', 'Синхронизация с реестром после входа', 'साइन इन पर लाइव लेजर सिंक', 'Sincronizzazione del registro dal vivo dopo l’accesso', 'Giriş yapınca canlı defter eşitlemesi', 'ซิงก์บัญชีสดเมื่อลงชื่อเข้าใช้', 'Synchronizacja księgi na żywo po zalogowaniu', 'Live grootboeksync na aanmelden', 'Live ledger sync kapag naka-sign in'],
    cta: ['Open U-Pay', 'U-Pay 열기', 'Ava U-Pay', 'U-Pay を開く', '打开 U-Pay', 'Abrir U-Pay', 'បើក U-Pay', 'Ouvrir U-Pay', 'U-Pay öffnen', 'Abrir U-Pay', 'Mở U-Pay', 'Buka U-Pay', 'Открыть U-Pay', 'U-Pay खोलें', 'Apri U-Pay', 'U-Pay’i aç', 'เปิด U-Pay', 'Otwórz U-Pay', 'U-Pay openen', 'Buksan ang U-Pay'],
  }),

  ...theme('uSocial', {
    tab: ['U-Social', '유소셜미디어', 'U-sotsiaal', 'Uソーシャル', 'U社交', 'U-Social', 'U-សង្គម', 'U-Social', 'U-Social', 'U-Social', 'U-Mạng xã hội', 'U-Sosial', 'U-Соцсети', 'U-सोशल', 'U-Social', 'U-Sosyal', 'U-โซเชียล', 'U-Social', 'U-Social', 'U-Social'],
    lede: [
      'Share UNITAS to every network with one signed link.',
      '서명된 링크 하나로 모든 네트워크에 UNITAS를 공유합니다.',
      'Jaga UNITAS-t igasse võrku ühe allkirjastatud lingiga.',
      '署名付きリンクひとつで、あらゆるネットワークにUNITASを共有。',
      '用一条签名链接把 UNITAS 分享到每一个网络。',
      'Comparte UNITAS en todas las redes con un solo enlace firmado.',
      'ចែករំលែក UNITAS ទៅគ្រប់បណ្តាញដោយតំណដែលបានចុះហត្ថលេខាតែមួយ។',
      'Partagez UNITAS sur tous les réseaux avec un seul lien signé.',
      'Teile UNITAS mit einem signierten Link in jedes Netzwerk.',
      'Partilhe a UNITAS em todas as redes com uma única ligação assinada.',
      'Chia sẻ UNITAS đến mọi mạng lưới chỉ bằng một liên kết đã ký.',
      'Bagikan UNITAS ke setiap jaringan dengan satu tautan bertanda tangan.',
      'Делитесь UNITAS во всех сетях одной подписанной ссылкой.',
      'एक हस्ताक्षरित लिंक से UNITAS को हर नेटवर्क पर साझा करें।',
      'Condividi UNITAS su ogni rete con un solo link firmato.',
      'UNITAS’ı tek bir imzalı bağlantıyla her ağda paylaşın.',
      'แชร์ UNITAS ไปทุกเครือข่ายด้วยลิงก์ที่ลงนามเพียงลิงก์เดียว',
      'Udostępniaj UNITAS w każdej sieci jednym podpisanym linkiem.',
      'Deel UNITAS met elk netwerk via één ondertekende link.',
      'Ibahagi ang UNITAS sa bawat network gamit ang isang signed na link.',
    ],
    f0: ['One-tap share targets', '원탭 공유 대상', 'Ühe puudutusega jagamissihid', 'ワンタップの共有先', '一键分享目标', 'Destinos de compartir con un toque', 'គោលដៅចែករំលែកមួយចុច', 'Cibles de partage en une pression', 'Freigabeziele mit einem Tipp', 'Destinos de partilha com um toque', 'Đích chia sẻ một chạm', 'Target berbagi sekali ketuk', 'Цели для шаринга в одно касание', 'एक टैप में साझा लक्ष्य', 'Destinazioni di condivisione con un tocco', 'Tek dokunuşla paylaşım hedefleri', 'ปลายทางแชร์แบบแตะครั้งเดียว', 'Cele udostępniania jednym dotknięciem', 'Deeldoelen met één tik', 'Mga share target sa isang tap'],
    f1: ['Signed share links', '서명된 공유 링크', 'Allkirjastatud jagamislingid', '署名付き共有リンク', '签名分享链接', 'Enlaces de compartir firmados', 'តំណចែករំលែកដែលបានចុះហត្ថលេខា', 'Liens de partage signés', 'Signierte Freigabelinks', 'Ligações de partilha assinadas', 'Liên kết chia sẻ đã ký', 'Tautan berbagi bertanda tangan', 'Подписанные ссылки', 'हस्ताक्षरित साझा लिंक', 'Link di condivisione firmati', 'İmzalı paylaşım bağlantıları', 'ลิงก์แชร์ที่ลงนาม', 'Podpisane linki udostępniania', 'Ondertekende deellinks', 'Mga signed na share link'],
    f2: ['Omni-channel reach', '옴니채널 도달', 'Kõikide kanalite ulatus', 'オムニチャネルのリーチ', '全渠道触达', 'Alcance omnicanal', 'ការឈានដល់គ្រប់ឆានែល', 'Portée omnicanale', 'Omnichannel-Reichweite', 'Alcance omnicanal', 'Phủ sóng đa kênh', 'Jangkauan omni-channel', 'Омниканальный охват', 'ओमनी-चैनल पहुँच', 'Copertura omnicanale', 'Çok kanallı erişim', 'การเข้าถึงทุกช่องทาง', 'Zasięg wielokanałowy', 'Omnichannel-bereik', 'Omni-channel na abot'],
    cta: ['Open U-Signature', 'U-Signature 열기', 'Ava U-Signature', 'U-Signature を開く', '打开 U-Signature', 'Abrir U-Signature', 'បើក U-Signature', 'Ouvrir U-Signature', 'U-Signature öffnen', 'Abrir U-Signature', 'Mở U-Signature', 'Buka U-Signature', 'Открыть U-Signature', 'U-Signature खोलें', 'Apri U-Signature', 'U-Signature’ı aç', 'เปิด U-Signature', 'Otwórz U-Signature', 'U-Signature openen', 'Buksan ang U-Signature'],
  }),

  ...theme('uAcademy', {
    tab: ['U-Academy', '유아카데미', 'U-akadeemia', 'Uアカデミー', 'U学院', 'U-Academia', 'U-បណ្ឌិត្យសភា', 'U-Académie', 'U-Akademie', 'U-Academia', 'U-Học viện', 'U-Akademi', 'U-Академия', 'U-अकादमी', 'U-Accademia', 'U-Akademi', 'U-อคาเดมี', 'U-Akademia', 'U-Academie', 'U-Akademya'],
    lede: [
      'The learning arche of the ecosystem — knowledge packs turned into guided paths.',
      '생태계의 배움의 아르케 — 지식 팩이 안내형 학습 경로가 됩니다.',
      'Ökosüsteemi õppimise arhe — teadmispakid muudetud juhitud radadeks.',
      'エコシステムの学びのアルケー — 知識パックが導かれた学習パスに。',
      '生态系统的学习本源 — 知识包化作引导式学习路径。',
      'El arjé del aprendizaje del ecosistema — packs de conocimiento convertidos en rutas guiadas.',
      'ប្រភពនៃការរៀនសូត្ររបស់ប្រព័ន្ធអេកូ — កញ្ចប់ចំណេះដឹងក្លាយជាផ្លូវណែនាំ។',
      'L’arché de l’apprentissage de l’écosystème — des packs de savoir transformés en parcours guidés.',
      'Die Lern-Arche des Ökosystems — Wissenspacks werden zu geführten Pfaden.',
      'A arqué da aprendizagem do ecossistema — packs de conhecimento transformados em percursos guiados.',
      'Cội nguồn học tập của hệ sinh thái — gói tri thức trở thành lộ trình có hướng dẫn.',
      'Arkhe pembelajaran ekosistem — paket pengetahuan menjadi jalur terpandu.',
      'Учебное архэ экосистемы — паки знаний становятся направляемыми путями.',
      'इकोसिस्टम का सीखने का आर्के — ज्ञान पैक निर्देशित मार्गों में बदलते हैं।',
      'L’arché dell’apprendimento dell’ecosistema — pack di conoscenza trasformati in percorsi guidati.',
      'Ekosistemin öğrenme arkesi — bilgi paketleri rehberli yollara dönüşür.',
      'อาร์เคแห่งการเรียนรู้ของระบบนิเวศ — แพ็กความรู้กลายเป็นเส้นทางที่มีผู้นำทาง',
      'Arche uczenia się ekosystemu — pakiety wiedzy zamienione w prowadzone ścieżki.',
      'De leer-arche van het ecosysteem — kennispacks omgezet in begeleide paden.',
      'Ang arche ng pagkatuto ng ecosystem — mga knowledge pack na ginawang gabay na landas.',
    ],
    f0: ['Guided learning paths', '안내형 학습 경로', 'Juhitud õpirajad', '導かれた学習パス', '引导式学习路径', 'Rutas de aprendizaje guiadas', 'ផ្លូវសិក្សាដែលមានការណែនាំ', 'Parcours d’apprentissage guidés', 'Geführte Lernpfade', 'Percursos de aprendizagem guiados', 'Lộ trình học có hướng dẫn', 'Jalur belajar terpandu', 'Направляемые учебные пути', 'निर्देशित सीखने के मार्ग', 'Percorsi di apprendimento guidati', 'Rehberli öğrenme yolları', 'เส้นทางการเรียนรู้แบบมีผู้นำทาง', 'Prowadzone ścieżki nauki', 'Begeleide leerpaden', 'Mga gabay na landas ng pagkatuto'],
    f1: ['Curriculum built from packs', '팩으로 구성된 커리큘럼', 'Pakkidest ehitatud õppekava', 'パックで組む カリキュラム', '由知识包构成的课程', 'Currículo construido con packs', 'កម្មវិធីសិក្សាបង្កើតពីកញ្ចប់', 'Programme construit à partir des packs', 'Lehrplan aus Packs', 'Currículo construído a partir de packs', 'Giáo trình xây từ các gói', 'Kurikulum dibangun dari paket', 'Учебный план из паков', 'पैक से बना पाठ्यक्रम', 'Programma costruito dai pack', 'Paketlerden kurulan müfredat', 'หลักสูตรที่สร้างจากแพ็ก', 'Program zbudowany z pakietów', 'Curriculum opgebouwd uit packs', 'Kurikulum na binuo mula sa mga pack'],
    f2: ['Syllabus per governance axis', '거버넌스 축별 강의 계획', 'Ainekava iga juhtimistelje kohta', 'ガバナンス軸ごとのシラバス', '按治理轴划分的大纲', 'Temario por eje de gobernanza', 'កម្មវិធីតាមអ័ក្សអភិបាលកិច្ច', 'Syllabus par axe de gouvernance', 'Lehrplan je Governance-Achse', 'Programa por eixo de governança', 'Đề cương theo trục quản trị', 'Silabus per poros tata kelola', 'Программа по каждой оси управления', 'प्रति शासन अक्ष पाठ्यक्रम', 'Programma per asse di governance', 'Her yönetişim eksenine ders planı', 'ประมวลรายวิชาตามแกนธรรมาภิบาล', 'Sylabus na każdą oś zarządzania', 'Syllabus per governance-as', 'Silabus bawat aksis ng pamamahala'],
    cta: ['Enter ARCHE', 'ARCHE 입장', 'Sisene ARCHE-sse', 'ARCHE へ入る', '进入 ARCHE', 'Entrar en ARCHE', 'ចូល ARCHE', 'Entrer dans ARCHE', 'ARCHE betreten', 'Entrar em ARCHE', 'Vào ARCHE', 'Masuk ke ARCHE', 'Войти в ARCHE', 'ARCHE में प्रवेश करें', 'Entra in ARCHE', 'ARCHE’ye gir', 'เข้าสู่ ARCHE', 'Wejdź do ARCHE', 'ARCHE betreden', 'Pumasok sa ARCHE'],
  }),

  ...theme('uVenture', {
    tab: ['U-Venture', '유벤처', 'U-riskikapital', 'Uベンチャー', 'U创投', 'U-Venture', 'U-បណ្ដាក់ទុន', 'U-Venture', 'U-Venture', 'U-Venture', 'U-Khởi nghiệp', 'U-Venture', 'U-Венчур', 'U-वेंचर', 'U-Venture', 'U-Girişim', 'U-เวนเจอร์', 'U-Venture', 'U-Venture', 'U-Venture'],
    lede: [
      'Zero-capital ventures syndicated across the network’s operators.',
      '네트워크의 오퍼레이터들 사이에서 신디케이트되는 무자본 벤처.',
      'Nullkapitaliga ettevõtmised, sündikeeritud võrgu operaatorite vahel.',
      'ネットワークのオペレーターにシンジケートされるゼロ資本ベンチャー。',
      '在网络运营者之间联合发起的零资本创投。',
      'Empresas de capital cero sindicadas entre los operadores de la red.',
      'អាជីវកម្មដើមទុនសូន្យ ដែលចែករំលែកក្នុងចំណោមប្រតិបត្តិកររបស់បណ្តាញ។',
      'Des projets sans capital syndiqués entre les opérateurs du réseau.',
      'Kapitalfreie Vorhaben, syndiziert über die Operatoren des Netzwerks.',
      'Empreendimentos sem capital sindicados entre os operadores da rede.',
      'Các dự án không cần vốn được liên kết giữa các nhà vận hành của mạng lưới.',
      'Usaha tanpa modal yang disindikasikan di antara operator jaringan.',
      'Венчуры с нулевым капиталом, синдицированные между операторами сети.',
      'नेटवर्क के ऑपरेटरों के बीच सिंडिकेटेड शून्य-पूंजी उद्यम।',
      'Iniziative a capitale zero sindacate tra gli operatori della rete.',
      'Ağın operatörleri arasında sendikalanan sıfır sermayeli girişimler.',
      'กิจการไร้ทุนที่ร่วมลงทุนกันในหมู่ผู้ปฏิบัติการของเครือข่าย',
      'Bezkapitałowe przedsięwzięcia syndykowane między operatorami sieci.',
      'Kapitaalloze ondernemingen, gesyndiceerd over de operators van het netwerk.',
      'Mga venture na walang kapital na sinisindikato sa mga operator ng network.',
    ],
    f0: ['Syndicated deal flow', '신디케이트 딜 플로우', 'Sündikeeritud tehinguvoog', 'シンジケートのディールフロー', '联合交易流', 'Flujo de operaciones sindicado', 'លំហូរកិច្ចព្រមព្រៀងរួម', 'Flux d’opérations syndiqué', 'Syndizierter Deal-Flow', 'Fluxo de negócios sindicado', 'Dòng thương vụ liên kết', 'Alur transaksi tersindikasi', 'Синдицированный поток сделок', 'सिंडिकेटेड डील फ़्लो', 'Flusso di operazioni sindacato', 'Sendikalı işlem akışı', 'ดีลโฟลว์แบบร่วมลงทุน', 'Syndykowany przepływ transakcji', 'Gesyndiceerde dealflow', 'Sinindikatong daloy ng deal'],
    f1: ['Micro-Burn margin gate', '마이크로-버른 마진 게이트', 'Micro-Burn marginaalivärav', 'マイクロバーン・マージンゲート', '微燃利润闸门', 'Puerta de margen Micro-Burn', 'ច្រកកម្រិតចំណេញ Micro-Burn', 'Porte de marge Micro-Burn', 'Micro-Burn-Margen-Gate', 'Portão de margem Micro-Burn', 'Cổng biên lợi nhuận Micro-Burn', 'Gerbang margin Micro-Burn', 'Маржинальный гейт Micro-Burn', 'माइक्रो-बर्न मार्जिन गेट', 'Gate di margine Micro-Burn', 'Micro-Burn marj kapısı', 'เกตกำไร Micro-Burn', 'Bramka marży Micro-Burn', 'Micro-Burn-margepoort', 'Micro-Burn margin gate'],
    f2: ['Sovereign index tracking', '소버린 지수 추적', 'Suveräänsusindeksi jälgimine', 'ソブリン指数のトラッキング', '主权指数追踪', 'Seguimiento del índice soberano', 'តាមដានសន្ទស្សន៍អធិបតេយ្យ', 'Suivi de l’indice souverain', 'Souveränitätsindex-Tracking', 'Acompanhamento do índice soberano', 'Theo dõi chỉ số chủ quyền', 'Pelacakan indeks berdaulat', 'Отслеживание суверенного индекса', 'संप्रभु सूचकांक ट्रैकिंग', 'Monitoraggio dell’indice sovrano', 'Egemenlik endeksi takibi', 'ติดตามดัชนีอธิปไตย', 'Śledzenie indeksu suwerenności', 'Soevereiniteitsindex volgen', 'Pagsubaybay sa sovereign index'],
    cta: ['Enter SYNDICATE', 'SYNDICATE 입장', 'Sisene SYNDICATE-sse', 'SYNDICATE へ入る', '进入 SYNDICATE', 'Entrar en SYNDICATE', 'ចូល SYNDICATE', 'Entrer dans SYNDICATE', 'SYNDICATE betreten', 'Entrar em SYNDICATE', 'Vào SYNDICATE', 'Masuk ke SYNDICATE', 'Войти в SYNDICATE', 'SYNDICATE में प्रवेश करें', 'Entra in SYNDICATE', 'SYNDICATE’e gir', 'เข้าสู่ SYNDICATE', 'Wejdź do SYNDICATE', 'SYNDICATE betreden', 'Pumasok sa SYNDICATE'],
  }),

  ...theme('uOracle', {
    tab: ['U-Oracle', '유오라클', 'U-oraakel', 'Uオラクル', 'U神谕', 'U-Oráculo', 'U-ទំនាយ', 'U-Oracle', 'U-Orakel', 'U-Oráculo', 'U-Tiên tri', 'U-Orakel', 'U-Оракул', 'U-ओरेकल', 'U-Oracolo', 'U-Kâhin', 'U-ออราเคิล', 'U-Wyrocznia', 'U-Orakel', 'U-Oracle'],
    lede: [
      'Day-seeded foresight across the governance axes — the same answer on every device.',
      '거버넌스 축 전반의 일자 시드 예측 — 모든 기기에서 같은 답.',
      'Päevaseemnega ettenägemine üle juhtimistelgede — sama vastus igas seadmes.',
      'ガバナンス軸を横断する日次シードの予見 — どの端末でも同じ答え。',
      '按日种子生成、横跨治理轴的预见 — 每台设备得到同样的答案。',
      'Previsión sembrada por día a lo largo de los ejes de gobernanza — la misma respuesta en cada dispositivo.',
      'ការទស្សន៍ទាយតាមថ្ងៃលើអ័ក្សអភិបាលកិច្ច — ចម្លើយដូចគ្នាលើគ្រប់ឧបករណ៍។',
      'Une prévoyance semée par jour sur les axes de gouvernance — la même réponse sur chaque appareil.',
      'Tagesgesäte Voraussicht über die Governance-Achsen — dieselbe Antwort auf jedem Gerät.',
      'Previsão semeada por dia ao longo dos eixos de governança — a mesma resposta em cada dispositivo.',
      'Tầm nhìn xa gieo theo ngày trên các trục quản trị — cùng một câu trả lời trên mọi thiết bị.',
      'Pandangan ke depan berbasis benih harian di seluruh poros tata kelola — jawaban sama di setiap perangkat.',
      'Предвидение с дневным сидом по осям управления — один и тот же ответ на каждом устройстве.',
      'शासन अक्षों पर दिन-आधारित पूर्वदृष्टि — हर डिवाइस पर एक ही उत्तर।',
      'Previsione seminata per giorno lungo gli assi di governance — la stessa risposta su ogni dispositivo.',
      'Yönetişim eksenlerinde güne göre tohumlanan öngörü — her cihazda aynı yanıt.',
      'การมองการณ์ไกลที่สุ่มตามวันบนแกนธรรมาภิบาล — คำตอบเดียวกันบนทุกอุปกรณ์',
      'Przewidywanie z dziennym ziarnem na osiach zarządzania — ta sama odpowiedź na każdym urządzeniu.',
      'Dag-gezaaid vooruitzicht over de governance-assen — hetzelfde antwoord op elk apparaat.',
      'Pananaw na binhi-araw sa mga aksis ng pamamahala — parehong sagot sa bawat device.',
    ],
    f0: ['Deterministic forecasts', '결정론적 예측', 'Deterministlikud prognoosid', '決定論的な予測', '确定性预测', 'Pronósticos deterministas', 'ការព្យាករណ៍កំណត់ជាក់លាក់', 'Prévisions déterministes', 'Deterministische Prognosen', 'Previsões determinísticas', 'Dự báo tất định', 'Prakiraan deterministik', 'Детерминированные прогнозы', 'निर्धारक पूर्वानुमान', 'Previsioni deterministiche', 'Deterministik tahminler', 'การพยากรณ์แบบกำหนดได้', 'Deterministyczne prognozy', 'Deterministische voorspellingen', 'Mga deterministikong pagtaya'],
    f1: ['Outlook axis by axis', '축별 전망', 'Väljavaade telje kaupa', '軸ごとの見通し', '逐轴展望', 'Perspectiva eje por eje', 'ទស្សនវិស័យតាមអ័ក្សនីមួយៗ', 'Perspective axe par axe', 'Ausblick Achse für Achse', 'Perspetiva eixo a eixo', 'Triển vọng theo từng trục', 'Prospek poros demi poros', 'Прогноз по каждой оси', 'अक्ष-दर-अक्ष दृष्टिकोण', 'Prospettiva asse per asse', 'Eksen eksen görünüm', 'มุมมองทีละแกน', 'Perspektywa oś po osi', 'Vooruitzicht per as', 'Pananaw sa bawat aksis'],
    f2: ['Evidence from swarm nodes', '스웜 노드 근거', 'Tõendid parve sõlmedest', 'スウォームノードからの根拠', '来自蜂群节点的证据', 'Evidencia de los nodos del enjambre', 'ភស្តុតាងពីថ្នាំងហ្វូង', 'Preuves issues des nœuds de l’essaim', 'Belege aus Schwarm-Knoten', 'Evidências dos nós do enxame', 'Bằng chứng từ các nút bầy', 'Bukti dari node kawanan', 'Свидетельства от узлов роя', 'स्वार्म नोड से प्रमाण', 'Prove dai nodi dello sciame', 'Sürü düğümlerinden kanıt', 'หลักฐานจากโหนดสวอร์ม', 'Dowody z węzłów roju', 'Bewijs uit zwermknopen', 'Ebidensya mula sa mga node ng swarm'],
    cta: ['Enter ORACLE', 'ORACLE 입장', 'Sisene ORACLE-sse', 'ORACLE へ入る', '进入 ORACLE', 'Entrar en ORACLE', 'ចូល ORACLE', 'Entrer dans ORACLE', 'ORACLE betreten', 'Entrar em ORACLE', 'Vào ORACLE', 'Masuk ke ORACLE', 'Войти в ORACLE', 'ORACLE में प्रवेश करें', 'Entra in ORACLE', 'ORACLE’a gir', 'เข้าสู่ ORACLE', 'Wejdź do ORACLE', 'ORACLE betreden', 'Pumasok sa ORACLE'],
  }),

  ...theme('uFactory', {
    tab: ['U-Factory', '유팩토리', 'U-tehas', 'Uファクトリー', 'U工厂', 'U-Fábrica', 'U-រោងចក្រ', 'U-Usine', 'U-Fabrik', 'U-Fábrica', 'U-Nhà máy', 'U-Pabrik', 'U-Фабрика', 'U-फ़ैक्टरी', 'U-Fabbrica', 'U-Fabrika', 'U-แฟกทอรี', 'U-Fabryka', 'U-Fabriek', 'U-Pabrika'],
    lede: [
      'The autonomous factory that assembles modules and lock-ins into new SaaS.',
      '모듈과 락인을 새로운 SaaS로 조립하는 자율 팩토리.',
      'Autonoomne tehas, mis paneb moodulid ja lukustused kokku uueks SaaS-iks.',
      'モジュールとロックインを新しいSaaSへ組み上げる自律ファクトリー。',
      '把模块与锁定模块组装成新 SaaS 的自主工厂。',
      'La fábrica autónoma que ensambla módulos y lock-ins en nuevo SaaS.',
      'រោងចក្រស្វយ័តដែលដំឡើងម៉ូឌុល និងការចាក់សោទៅជា SaaS ថ្មី។',
      'L’usine autonome qui assemble modules et lock-ins en nouveaux SaaS.',
      'Die autonome Fabrik, die Module und Lock-ins zu neuem SaaS zusammensetzt.',
      'A fábrica autónoma que monta módulos e lock-ins em novo SaaS.',
      'Nhà máy tự vận hành lắp ráp mô-đun và lock-in thành SaaS mới.',
      'Pabrik otonom yang merakit modul dan lock-in menjadi SaaS baru.',
      'Автономная фабрика, собирающая модули и lock-in в новый SaaS.',
      'मॉड्यूल और लॉक-इन को नए SaaS में जोड़ने वाली स्वायत्त फ़ैक्टरी।',
      'La fabbrica autonoma che assembla moduli e lock-in in nuovo SaaS.',
      'Modülleri ve lock-in’leri yeni SaaS’a dönüştüren otonom fabrika.',
      'โรงงานอัตโนมัติที่ประกอบโมดูลและล็อกอินให้เป็น SaaS ใหม่',
      'Autonomiczna fabryka, która składa moduły i lock-iny w nowe SaaS.',
      'De autonome fabriek die modules en lock-ins tot nieuwe SaaS assembleert.',
      'Ang autonomous na pabrika na bumubuo ng mga module at lock-in sa bagong SaaS.',
    ],
    f0: ['Module assembly', '모듈 조립', 'Moodulite koostamine', 'モジュール組み立て', '模块组装', 'Ensamblaje de módulos', 'ការដំឡើងម៉ូឌុល', 'Assemblage de modules', 'Modulmontage', 'Montagem de módulos', 'Lắp ráp mô-đun', 'Perakitan modul', 'Сборка модулей', 'मॉड्यूल असेंबली', 'Assemblaggio dei moduli', 'Modül montajı', 'การประกอบโมดูล', 'Montaż modułów', 'Moduleassemblage', 'Pagbuo ng module'],
    f1: ['Lock-in activation', '락인 활성화', 'Lukustuste aktiveerimine', 'ロックインの有効化', '锁定模块激活', 'Activación de lock-ins', 'ការធ្វើឱ្យសកម្មការចាក់សោ', 'Activation des lock-ins', 'Lock-in-Aktivierung', 'Ativação de lock-ins', 'Kích hoạt lock-in', 'Aktivasi lock-in', 'Активация lock-in', 'लॉक-इन सक्रियण', 'Attivazione dei lock-in', 'Lock-in etkinleştirme', 'การเปิดใช้ล็อกอิน', 'Aktywacja lock-inów', 'Lock-in-activering', 'Pag-activate ng lock-in'],
    f2: ['Zero-hands pipeline', '제로 핸즈 파이프라인', 'Käed-vabad konveier', 'ゼロハンズのパイプライン', '零人工流水线', 'Canalización sin intervención', 'បំពង់បង្ហូរដោយគ្មានដៃ', 'Pipeline sans intervention', 'Zero-Hands-Pipeline', 'Pipeline sem intervenção', 'Đường ống không cần thao tác', 'Pipeline tanpa campur tangan', 'Конвейер без участия человека', 'ज़ीरो-हैंड्स पाइपलाइन', 'Pipeline senza intervento', 'Elle dokunmadan işleyen hat', 'ไปป์ไลน์แบบไร้มือ', 'Bezobsługowy potok', 'Zero-hands-pijplijn', 'Zero-hands na pipeline'],
    cta: ['Enter GENESIS', 'GENESIS 입장', 'Sisene GENESIS-esse', 'GENESIS へ入る', '进入 GENESIS', 'Entrar en GENESIS', 'ចូល GENESIS', 'Entrer dans GENESIS', 'GENESIS betreten', 'Entrar em GENESIS', 'Vào GENESIS', 'Masuk ke GENESIS', 'Войти в GENESIS', 'GENESIS में प्रवेश करें', 'Entra in GENESIS', 'GENESIS’e gir', 'เข้าสู่ GENESIS', 'Wejdź do GENESIS', 'GENESIS betreden', 'Pumasok sa GENESIS'],
  }),

  ...theme('uCoin', {
    tab: ['U-Coin', '유코인', 'U-münt', 'Uコイン', 'U币', 'U-Coin', 'U-កាក់', 'U-Coin', 'U-Coin', 'U-Coin', 'U-Coin', 'U-Koin', 'U-Монета', 'U-कॉइन', 'U-Coin', 'U-Coin', 'U-คอยน์', 'U-Moneta', 'U-Munt', 'U-Coin'],
    lede: [
      'The Micro-Burn economy: coins in, marginal cost zero, margin unbounded.',
      '마이크로-버른 경제: 코인은 들어오고, 한계 비용은 0, 마진은 무한대.',
      'Micro-Burn majandus: mündid sisse, piirkulu null, marginaal piiramatu.',
      'マイクロバーン経済 — コインが入り、限界費用はゼロ、マージンは無限大。',
      '微燃经济：币入，边际成本为零，利润无上限。',
      'La economía Micro-Burn: entran monedas, coste marginal cero, margen sin límite.',
      'សេដ្ឋកិច្ច Micro-Burn៖ កាក់ចូល ថ្លៃដើមកម្រិតសូន្យ ចំណេញគ្មានដែនកំណត់។',
      'L’économie Micro-Burn : des coins qui entrent, un coût marginal nul, une marge sans limite.',
      'Die Micro-Burn-Ökonomie: Coins rein, Grenzkosten null, Marge unbegrenzt.',
      'A economia Micro-Burn: moedas a entrar, custo marginal zero, margem sem limite.',
      'Nền kinh tế Micro-Burn: coin vào, chi phí biên bằng không, biên lợi nhuận vô hạn.',
      'Ekonomi Micro-Burn: koin masuk, biaya marginal nol, margin tak terbatas.',
      'Экономика Micro-Burn: монеты входят, предельные издержки — ноль, маржа — без предела.',
      'माइक्रो-बर्न अर्थव्यवस्था: कॉइन आएँ, सीमांत लागत शून्य, मार्जिन असीमित।',
      'L’economia Micro-Burn: monete in entrata, costo marginale zero, margine illimitato.',
      'Micro-Burn ekonomisi: coin girer, marjinal maliyet sıfır, kâr marjı sınırsız.',
      'เศรษฐกิจ Micro-Burn: คอยน์เข้า ต้นทุนส่วนเพิ่มเป็นศูนย์ กำไรไร้ขีดจำกัด',
      'Ekonomia Micro-Burn: monety wchodzą, koszt krańcowy zero, marża bez granic.',
      'De Micro-Burn-economie: munten erin, marginale kosten nul, marge onbegrensd.',
      'Ang ekonomiyang Micro-Burn: pasok ang coins, zero ang marginal cost, walang hangganan ang margin.',
    ],
    f0: ['Wallet balance, live', '실시간 지갑 잔액', 'Rahakoti saldo otse', 'ウォレット残高をライブ表示', '实时钱包余额', 'Saldo de la cartera en vivo', 'សមតុល្យកាបូបផ្ទាល់', 'Solde du portefeuille en direct', 'Wallet-Guthaben live', 'Saldo da carteira ao vivo', 'Số dư ví trực tiếp', 'Saldo dompet langsung', 'Баланс кошелька онлайн', 'लाइव वॉलेट बैलेंस', 'Saldo del portafoglio dal vivo', 'Canlı cüzdan bakiyesi', 'ยอดกระเป๋าแบบสด', 'Saldo portfela na żywo', 'Live walletsaldo', 'Live na balanse ng wallet'],
    f1: ['Micro-Burn efficiency band', '마이크로-버른 효율 밴드', 'Micro-Burn tõhususvahemik', 'マイクロバーン効率バンド', '微燃效率区间', 'Banda de eficiencia Micro-Burn', 'ក្រុមប្រសិទ្ធភាព Micro-Burn', 'Bande d’efficacité Micro-Burn', 'Micro-Burn-Effizienzband', 'Faixa de eficiência Micro-Burn', 'Dải hiệu suất Micro-Burn', 'Rentang efisiensi Micro-Burn', 'Диапазон эффективности Micro-Burn', 'माइक्रो-बर्न दक्षता बैंड', 'Fascia di efficienza Micro-Burn', 'Micro-Burn verimlilik bandı', 'ช่วงประสิทธิภาพ Micro-Burn', 'Pasmo efektywności Micro-Burn', 'Micro-Burn-efficiëntieband', 'Banda ng kahusayan ng Micro-Burn'],
    f2: ['Pack settlement in coins', '코인으로 팩 정산', 'Pakkide arveldus müntides', 'コインでのパック決済', '用币结算知识包', 'Liquidación de packs en monedas', 'ទូទាត់កញ្ចប់ដោយកាក់', 'Règlement des packs en coins', 'Pack-Abrechnung in Coins', 'Liquidação de packs em moedas', 'Thanh toán gói bằng coin', 'Penyelesaian paket dengan koin', 'Расчёт за паки в монетах', 'कॉइन में पैक निपटान', 'Regolamento dei pack in monete', 'Paket mutabakatı coin ile', 'ชำระแพ็กด้วยคอยน์', 'Rozliczenie pakietów w monetach', 'Packverrekening in munten', 'Settlement ng pack sa coins'],
    cta: ['Open U-Pay', 'U-Pay 열기', 'Ava U-Pay', 'U-Pay を開く', '打开 U-Pay', 'Abrir U-Pay', 'បើក U-Pay', 'Ouvrir U-Pay', 'U-Pay öffnen', 'Abrir U-Pay', 'Mở U-Pay', 'Buka U-Pay', 'Открыть U-Pay', 'U-Pay खोलें', 'Apri U-Pay', 'U-Pay’i aç', 'เปิด U-Pay', 'Otwórz U-Pay', 'U-Pay openen', 'Buksan ang U-Pay'],
  }),

  ...theme('uGovernance', {
    tab: ['U-Governance', '유거버넌스', 'U-juhtimine', 'Uガバナンス', 'U治理', 'U-Gobernanza', 'U-អភិបាលកិច្ច', 'U-Gouvernance', 'U-Governance', 'U-Governança', 'U-Quản trị', 'U-Tata Kelola', 'U-Управление', 'U-गवर्नेंस', 'U-Governance', 'U-Yönetişim', 'U-ธรรมาภิบาล', 'U-Zarządzanie', 'U-Governance', 'U-Pamamahala'],
    lede: [
      'The governance axes that steer every module, codified in the codex.',
      '모든 모듈을 이끄는 거버넌스 축, 코덱스에 성문화되어 있습니다.',
      'Juhtimisteljed, mis suunavad iga moodulit, kodifitseeritud koodeksis.',
      'すべてのモジュールを導くガバナンス軸 — コデックスに成文化。',
      '引导每个模块的治理轴，已在法典中成文。',
      'Los ejes de gobernanza que dirigen cada módulo, codificados en el códice.',
      'អ័ក្សអភិបាលកិច្ចដែលដឹកនាំគ្រប់ម៉ូឌុល ចងក្រងក្នុងក្រមកូដិច។',
      'Les axes de gouvernance qui pilotent chaque module, codifiés dans le codex.',
      'Die Governance-Achsen, die jedes Modul steuern, im Kodex festgeschrieben.',
      'Os eixos de governança que orientam cada módulo, codificados no códice.',
      'Các trục quản trị dẫn dắt mọi mô-đun, được hệ thống hóa trong bộ codex.',
      'Poros tata kelola yang mengarahkan setiap modul, dikodifikasi dalam kodeks.',
      'Оси управления, направляющие каждый модуль, закреплены в кодексе.',
      'हर मॉड्यूल को दिशा देने वाले शासन अक्ष, कोडेक्स में संहिताबद्ध।',
      'Gli assi di governance che guidano ogni modulo, codificati nel codex.',
      'Her modülü yönlendiren, kodekste yazılı yönetişim eksenleri.',
      'แกนธรรมาภิบาลที่กำกับทุกโมดูล บัญญัติไว้ในโคเด็กซ์',
      'Osie zarządzania sterujące każdym modułem, skodyfikowane w kodeksie.',
      'De governance-assen die elke module sturen, vastgelegd in de codex.',
      'Ang mga aksis ng pamamahala na gumagabay sa bawat module, nakasulat sa codex.',
    ],
    f0: ['Every axis at a glance', '모든 축을 한눈에', 'Kõik teljed ühe pilguga', 'すべての軸を一目で', '一览所有轴', 'Todos los ejes de un vistazo', 'គ្រប់អ័ក្សក្នុងមួយភ្លែត', 'Tous les axes en un coup d’œil', 'Alle Achsen auf einen Blick', 'Todos os eixos num relance', 'Mọi trục trong một cái nhìn', 'Semua poros sekilas', 'Все оси с первого взгляда', 'सभी अक्ष एक नज़र में', 'Tutti gli assi a colpo d’occhio', 'Tüm eksenler bir bakışta', 'ทุกแกนในพริบตา', 'Wszystkie osie na pierwszy rzut oka', 'Alle assen in één oogopslag', 'Lahat ng aksis sa isang sulyap'],
    f1: ['Rules bound to the codex', '코덱스에 묶인 규칙', 'Koodeksiga seotud reeglid', 'コデックスに紐づく規則', '与法典绑定的规则', 'Reglas vinculadas al códice', 'ច្បាប់ចងភ្ជាប់នឹងក្រមកូដិច', 'Règles liées au codex', 'An den Kodex gebundene Regeln', 'Regras vinculadas ao códice', 'Quy tắc gắn với codex', 'Aturan terikat pada kodeks', 'Правила, привязанные к кодексу', 'कोडेक्स से बंधे नियम', 'Regole vincolate al codex', 'Kodekse bağlı kurallar', 'กฎที่ผูกกับโคเด็กซ์', 'Zasady związane z kodeksem', 'Regels gebonden aan de codex', 'Mga panuntunang nakatali sa codex'],
    f2: ['Module coverage map', '모듈 커버리지 맵', 'Moodulite katvuse kaart', 'モジュールのカバレッジマップ', '模块覆盖图', 'Mapa de cobertura de módulos', 'ផែនទីគ្របដណ្តប់ម៉ូឌុល', 'Carte de couverture des modules', 'Modulabdeckungskarte', 'Mapa de cobertura dos módulos', 'Bản đồ bao phủ mô-đun', 'Peta cakupan modul', 'Карта покрытия модулей', 'मॉड्यूल कवरेज मानचित्र', 'Mappa di copertura dei moduli', 'Modül kapsam haritası', 'แผนที่ความครอบคลุมโมดูล', 'Mapa pokrycia modułów', 'Moduledekkingskaart', 'Mapa ng saklaw ng module'],
    cta: ['Enter CODEX22', 'CODEX22 입장', 'Sisene CODEX22-sse', 'CODEX22 へ入る', '进入 CODEX22', 'Entrar en CODEX22', 'ចូល CODEX22', 'Entrer dans CODEX22', 'CODEX22 betreten', 'Entrar em CODEX22', 'Vào CODEX22', 'Masuk ke CODEX22', 'Войти в CODEX22', 'CODEX22 में प्रवेश करें', 'Entra in CODEX22', 'CODEX22’ye gir', 'เข้าสู่ CODEX22', 'Wejdź do CODEX22', 'CODEX22 betreden', 'Pumasok sa CODEX22'],
  }),

  ...theme('uNexus', {
    tab: ['U-Nexus', '유넥서스', 'U-neksus', 'Uネクサス', 'U枢纽', 'U-Nexus', 'U-ណិចសាស់', 'U-Nexus', 'U-Nexus', 'U-Nexus', 'U-Nexus', 'U-Nexus', 'U-Нексус', 'U-नेक्सस', 'U-Nexus', 'U-Nexus', 'U-เน็กซัส', 'U-Nexus', 'U-Nexus', 'U-Nexus'],
    lede: [
      'The omni-tech swarm: walk subjects across the open web from one nexus.',
      '옴니-테크 스웜: 하나의 넥서스에서 열린 웹 전체의 주제를 탐색합니다.',
      'Omni-tehnoloogiline parv: liigu teemade vahel üle avatud veebi ühest sõlmpunktist.',
      'オムニテック・スウォーム — ひとつのネクサスからオープンウェブの主題を渡り歩く。',
      '全域科技蜂群：从一个枢纽漫游开放网络上的所有主题。',
      'El enjambre omni-tech: recorre temas por toda la web abierta desde un solo nexo.',
      'ហ្វូងអូមនី-បច្ចេកវិទ្យា៖ ដើរតាមប្រធានបទឆ្លងកាត់វេបចំហពីចំណុចប្រសព្វតែមួយ។',
      'L’essaim omni-tech : parcourez les sujets du web ouvert depuis un seul nexus.',
      'Der Omni-Tech-Schwarm: Themen im offenen Web von einem Nexus aus durchwandern.',
      'O enxame omni-tech: percorra temas por toda a web aberta a partir de um só nexo.',
      'Bầy omni-tech: đi qua các chủ đề trên web mở từ một nexus duy nhất.',
      'Kawanan omni-tech: telusuri subjek di seluruh web terbuka dari satu nexus.',
      'Омни-тех рой: путешествуйте по темам открытой сети из одного нексуса.',
      'ओमनी-टेक स्वार्म: एक नेक्सस से खुले वेब के विषयों में विचरण करें।',
      'Lo sciame omni-tech: attraversa i soggetti del web aperto da un unico nexus.',
      'Omni-tek sürüsü: açık web’deki konuları tek bir nexus’tan dolaşın.',
      'สวอร์มออมนิเทค: ท่องหัวข้อทั่วเว็บเปิดจากเน็กซัสเดียว',
      'Rój omni-tech: przemierzaj tematy otwartej sieci z jednego nexusa.',
      'De omni-tech-zwerm: doorloop onderwerpen over het open web vanuit één nexus.',
      'Ang omni-tech swarm: maglakbay sa mga paksa sa bukas na web mula sa isang nexus.',
    ],
    f0: ['Swarm walk across sources', '소스를 가로지르는 스웜 워크', 'Parve rännak üle allikate', 'ソースを横断するスウォームウォーク', '跨来源的蜂群漫游', 'Recorrido del enjambre entre fuentes', 'ដំណើរហ្វូងឆ្លងកាត់ប្រភព', 'Parcours de l’essaim entre les sources', 'Schwarm-Walk über Quellen', 'Percurso do enxame entre fontes', 'Bầy đi xuyên các nguồn', 'Penelusuran kawanan lintas sumber', 'Проход роя по источникам', 'स्रोतों के आर-पार स्वार्म वॉक', 'Percorso dello sciame tra le fonti', 'Kaynaklar arasında sürü yürüyüşü', 'สวอร์มวอล์กข้ามแหล่งข้อมูล', 'Wędrówka roju między źródłami', 'Zwermwandeling over bronnen', 'Swarm walk sa mga pinagmulan'],
    f1: ['Subjects cached on device', '기기에 캐시된 주제', 'Teemad seadmes vahemälus', '端末にキャッシュされた主題', '缓存在本设备的主题', 'Temas en caché en el dispositivo', 'ប្រធានបទរក្សាទុកក្នុងឧបករណ៍', 'Sujets mis en cache sur l’appareil', 'Themen auf dem Gerät gecacht', 'Temas em cache no dispositivo', 'Chủ đề lưu đệm trên thiết bị', 'Subjek di-cache di perangkat', 'Темы кэшируются на устройстве', 'डिवाइस पर कैश किए विषय', 'Soggetti in cache sul dispositivo', 'Cihazda önbelleğe alınan konular', 'หัวข้อที่แคชไว้ในอุปกรณ์', 'Tematy w pamięci podręcznej urządzenia', 'Onderwerpen gecachet op het apparaat', 'Mga paksang naka-cache sa device'],
    f2: ['Portal workspace', '포털 워크스페이스', 'Portaali tööruum', 'ポータルのワークスペース', '门户工作区', 'Espacio de trabajo tipo portal', 'កន្លែងធ្វើការវិបផតថល', 'Espace de travail portail', 'Portal-Arbeitsbereich', 'Área de trabalho em portal', 'Không gian làm việc cổng', 'Ruang kerja portal', 'Портальное рабочее пространство', 'पोर्टल वर्कस्पेस', 'Area di lavoro a portale', 'Portal çalışma alanı', 'พื้นที่ทำงานแบบพอร์ทัล', 'Portalowa przestrzeń robocza', 'Portaalwerkruimte', 'Portal na workspace'],
    cta: ['Open Omni-Swarm', '옴니-스웜 열기', 'Ava Omni-Swarm', 'Omni-Swarm を開く', '打开 Omni-Swarm', 'Abrir Omni-Swarm', 'បើក Omni-Swarm', 'Ouvrir Omni-Swarm', 'Omni-Swarm öffnen', 'Abrir Omni-Swarm', 'Mở Omni-Swarm', 'Buka Omni-Swarm', 'Открыть Omni-Swarm', 'Omni-Swarm खोलें', 'Apri Omni-Swarm', 'Omni-Swarm’ı aç', 'เปิด Omni-Swarm', 'Otwórz Omni-Swarm', 'Omni-Swarm openen', 'Buksan ang Omni-Swarm'],
  }),

  ...theme('uAkashic', {
    tab: ['U-Akashic', '유아카식', 'U-akaša', 'Uアカシック', 'U阿卡西', 'U-Akáshico', 'U-អាកាស', 'U-Akashique', 'U-Akasha', 'U-Akáshico', 'U-Akashic', 'U-Akasha', 'U-Акаша', 'U-आकाशिक', 'U-Akashico', 'U-Akaşik', 'U-อาคาชิก', 'U-Akasza', 'U-Akasha', 'U-Akashic'],
    lede: [
      'The permanent archive — every signature, pack and walk kept forever.',
      '영구 아카이브 — 모든 서명, 팩, 탐색이 영원히 보존됩니다.',
      'Alaline arhiiv — iga allkiri, pakk ja rännak hoitakse igavesti.',
      '永続アーカイブ — すべての署名・パック・探索を永遠に保存。',
      '永久档案 — 每一次签名、知识包与漫游永久留存。',
      'El archivo permanente — cada firma, pack y recorrido se conserva para siempre.',
      'បណ្ណសារអចិន្ត្រៃយ៍ — គ្រប់ហត្ថលេខា កញ្ចប់ និងដំណើររក្សាទុកជារៀងរហូត។',
      'L’archive permanente — chaque signature, pack et parcours conservé pour toujours.',
      'Das permanente Archiv — jede Signatur, jedes Pack, jeder Walk für immer bewahrt.',
      'O arquivo permanente — cada assinatura, pack e percurso guardado para sempre.',
      'Kho lưu trữ vĩnh viễn — mọi chữ ký, gói và hành trình được giữ mãi mãi.',
      'Arsip permanen — setiap tanda tangan, paket, dan penelusuran disimpan selamanya.',
      'Постоянный архив — каждая подпись, пак и проход хранятся вечно.',
      'स्थायी संग्रह — हर हस्ताक्षर, पैक और यात्रा सदा के लिए सुरक्षित।',
      'L’archivio permanente — ogni firma, pack e percorso conservato per sempre.',
      'Kalıcı arşiv — her imza, paket ve yürüyüş sonsuza dek saklanır.',
      'คลังถาวร — ทุกลายเซ็น แพ็ก และการท่อง ถูกเก็บไว้ตลอดกาล',
      'Trwałe archiwum — każdy podpis, pakiet i wędrówka zachowane na zawsze.',
      'Het permanente archief — elke handtekening, pack en wandeling voor altijd bewaard.',
      'Ang permanenteng archive — bawat lagda, pack at paglalakbay ay iniingatan magpakailanman.',
    ],
    f0: ['Signed archive entries', '서명된 아카이브 항목', 'Allkirjastatud arhiivikirjed', '署名付きアーカイブ項目', '已签名的档案条目', 'Entradas de archivo firmadas', 'ធាតុបណ្ណសារដែលបានចុះហត្ថលេខា', 'Entrées d’archive signées', 'Signierte Archiveinträge', 'Entradas de arquivo assinadas', 'Mục lưu trữ đã ký', 'Entri arsip bertanda tangan', 'Подписанные записи архива', 'हस्ताक्षरित संग्रह प्रविष्टियाँ', 'Voci d’archivio firmate', 'İmzalı arşiv kayıtları', 'รายการคลังที่ลงนาม', 'Podpisane wpisy archiwum', 'Ondertekende archiefitems', 'Mga signed na entry ng archive'],
    f1: ['Pack provenance', '팩 출처 이력', 'Pakkide päritolu', 'パックの来歴', '知识包溯源', 'Procedencia de los packs', 'ប្រភពដើមកញ្ចប់', 'Provenance des packs', 'Pack-Herkunft', 'Proveniência dos packs', 'Nguồn gốc gói', 'Asal-usul paket', 'Происхождение паков', 'पैक की उत्पत्ति', 'Provenienza dei pack', 'Paket kökeni', 'ที่มาของแพ็ก', 'Pochodzenie pakietów', 'Herkomst van packs', 'Pinagmulan ng pack'],
    f2: ['Swarm memory kept', '스웜 메모리 보존', 'Parve mälu säilib', 'スウォームの記憶を保持', '保留蜂群记忆', 'Memoria del enjambre conservada', 'រក្សាទុកការចងចាំហ្វូង', 'Mémoire de l’essaim conservée', 'Schwarm-Gedächtnis bewahrt', 'Memória do enxame preservada', 'Ký ức bầy được giữ lại', 'Memori kawanan tersimpan', 'Память роя сохраняется', 'स्वार्म मेमोरी सुरक्षित', 'Memoria dello sciame conservata', 'Sürü belleği korunur', 'เก็บความจำสวอร์ม', 'Pamięć roju zachowana', 'Zwermgeheugen bewaard', 'Nakatagong memorya ng swarm'],
    cta: ['Open U-Signature', 'U-Signature 열기', 'Ava U-Signature', 'U-Signature を開く', '打开 U-Signature', 'Abrir U-Signature', 'បើក U-Signature', 'Ouvrir U-Signature', 'U-Signature öffnen', 'Abrir U-Signature', 'Mở U-Signature', 'Buka U-Signature', 'Открыть U-Signature', 'U-Signature खोलें', 'Apri U-Signature', 'U-Signature’ı aç', 'เปิด U-Signature', 'Otwórz U-Signature', 'U-Signature openen', 'Buksan ang U-Signature'],
  }),

  ...theme('uQuantum', {
    tab: ['U-Quantum', '유퀀텀', 'U-kvant', 'Uクォンタム', 'U量子', 'U-Quantum', 'U-កង់ទិច', 'U-Quantum', 'U-Quantum', 'U-Quantum', 'U-Lượng tử', 'U-Kuantum', 'U-Квант', 'U-क्वांटम', 'U-Quantum', 'U-Kuantum', 'U-ควอนตัม', 'U-Kwant', 'U-Quantum', 'U-Quantum'],
    lede: [
      'Probability-bending computation at the paradox edge of the ecosystem.',
      '생태계의 패러독스 경계에서 확률을 휘는 연산.',
      'Tõenäosust painutav arvutus ökosüsteemi paradoksi piiril.',
      'エコシステムのパラドックスの縁で確率を曲げる計算。',
      '在生态系统的悖论边缘扭转概率的计算。',
      'Computación que dobla la probabilidad en el borde paradójico del ecosistema.',
      'ការគណនាដែលពត់ប្រូបាប៊ីលីតេ នៅគែមផារ៉ាដុករបស់ប្រព័ន្ធអេកូ។',
      'Un calcul qui plie la probabilité à la lisière paradoxale de l’écosystème.',
      'Wahrscheinlichkeitsbiegende Berechnung am Paradox-Rand des Ökosystems.',
      'Computação que dobra a probabilidade na fronteira paradoxal do ecossistema.',
      'Phép tính bẻ cong xác suất ở rìa nghịch lý của hệ sinh thái.',
      'Komputasi pembelok probabilitas di tepi paradoks ekosistem.',
      'Вычисления, изгибающие вероятность на парадоксальной грани экосистемы.',
      'इकोसिस्टम के विरोधाभास-किनारे पर संभावना को मोड़ने वाली गणना।',
      'Calcolo che piega la probabilità al confine paradossale dell’ecosistema.',
      'Ekosistemin paradoks sınırında olasılığı büken hesaplama.',
      'การคำนวณที่บิดความน่าจะเป็น ณ ขอบพาราด็อกซ์ของระบบนิเวศ',
      'Obliczenia zaginające prawdopodobieństwo na paradoksalnej krawędzi ekosystemu.',
      'Waarschijnlijkheidsbuigende berekening aan de paradoxrand van het ecosysteem.',
      'Computasyong bumabaluktot sa probabilidad sa paradox na gilid ng ecosystem.',
    ],
    f0: ['Paradox module', '패러독스 모듈', 'Paradoksi moodul', 'パラドックス・モジュール', '悖论模块', 'Módulo Paradoja', 'ម៉ូឌុលផារ៉ាដុក', 'Module Paradoxe', 'Paradox-Modul', 'Módulo Paradoxo', 'Mô-đun Nghịch lý', 'Modul Paradoks', 'Модуль «Парадокс»', 'पैराडॉक्स मॉड्यूल', 'Modulo Paradosso', 'Paradoks modülü', 'โมดูลพาราด็อกซ์', 'Moduł Paradoks', 'Paradox-module', 'Paradox module'],
    f1: ['Day-seeded indices', '일자 시드 지수', 'Päevaseemnega indeksid', '日次シードの指数', '按日种子生成的指数', 'Índices sembrados por día', 'សន្ទស្សន៍តាមថ្ងៃ', 'Indices semés par jour', 'Tagesgesäte Indizes', 'Índices semeados por dia', 'Chỉ số gieo theo ngày', 'Indeks berbasis benih harian', 'Индексы с дневным сидом', 'दिन-आधारित सूचकांक', 'Indici seminati per giorno', 'Güne göre tohumlanan endeksler', 'ดัชนีสุ่มตามวัน', 'Indeksy z dziennym ziarnem', 'Dag-gezaaide indexen', 'Mga index na binhi-araw'],
    f2: ['Compute on swarm nodes', '스웜 노드에서 연산', 'Arvutus parve sõlmedel', 'スウォームノードで演算', '在蜂群节点上计算', 'Cómputo en los nodos del enjambre', 'គណនាលើថ្នាំងហ្វូង', 'Calcul sur les nœuds de l’essaim', 'Rechnen auf Schwarm-Knoten', 'Computação nos nós do enxame', 'Tính toán trên các nút bầy', 'Komputasi di node kawanan', 'Вычисления на узлах роя', 'स्वार्म नोड पर गणना', 'Calcolo sui nodi dello sciame', 'Sürü düğümlerinde hesaplama', 'ประมวลผลบนโหนดสวอร์ม', 'Obliczenia na węzłach roju', 'Rekenen op zwermknopen', 'Compute sa mga node ng swarm'],
    cta: ['Enter PARADOX', 'PARADOX 입장', 'Sisene PARADOX-i', 'PARADOX へ入る', '进入 PARADOX', 'Entrar en PARADOX', 'ចូល PARADOX', 'Entrer dans PARADOX', 'PARADOX betreten', 'Entrar em PARADOX', 'Vào PARADOX', 'Masuk ke PARADOX', 'Войти в PARADOX', 'PARADOX में प्रवेश करें', 'Entra in PARADOX', 'PARADOX’a gir', 'เข้าสู่ PARADOX', 'Wejdź do PARADOX', 'PARADOX betreden', 'Pumasok sa PARADOX'],
  }),

  ...theme('uShield', {
    tab: ['U-Shield', '유실드', 'U-kilp', 'Uシールド', 'U护盾', 'U-Escudo', 'U-ខែល', 'U-Bouclier', 'U-Schild', 'U-Escudo', 'U-Lá chắn', 'U-Perisai', 'U-Щит', 'U-शील्ड', 'U-Scudo', 'U-Kalkan', 'U-ชีลด์', 'U-Tarcza', 'U-Schild', 'U-Kalasag'],
    lede: [
      'Zero-trust defence: keys, lock-ins and quarantine for every session.',
      '제로 트러스트 방어: 모든 세션에 키, 락인, 격리를 적용합니다.',
      'Nullusalduse kaitse: võtmed, lukustused ja karantiin igale seansile.',
      'ゼロトラスト防御 — すべてのセッションに鍵、ロックイン、隔離。',
      '零信任防御：为每个会话提供密钥、锁定模块与隔离。',
      'Defensa de confianza cero: claves, lock-ins y cuarentena para cada sesión.',
      'ការការពារគ្មានទំនុកចិត្ត៖ កូនសោ ការចាក់សោ និងការដាក់ឱ្យនៅដាច់ដោយឡែកសម្រាប់គ្រប់សម័យ។',
      'Défense zero-trust : clés, lock-ins et quarantaine pour chaque session.',
      'Zero-Trust-Verteidigung: Schlüssel, Lock-ins und Quarantäne für jede Sitzung.',
      'Defesa de confiança zero: chaves, lock-ins e quarentena para cada sessão.',
      'Phòng thủ zero-trust: khóa, lock-in và cách ly cho mọi phiên.',
      'Pertahanan zero-trust: kunci, lock-in, dan karantina untuk setiap sesi.',
      'Защита с нулевым доверием: ключи, lock-in и карантин для каждой сессии.',
      'ज़ीरो-ट्रस्ट सुरक्षा: हर सत्र के लिए कुंजियाँ, लॉक-इन और क्वारंटीन।',
      'Difesa zero-trust: chiavi, lock-in e quarantena per ogni sessione.',
      'Sıfır güven savunması: her oturum için anahtarlar, lock-in’ler ve karantina.',
      'การป้องกันแบบซีโร่ทรัสต์: กุญแจ ล็อกอิน และการกักกันสำหรับทุกเซสชัน',
      'Obrona zero-trust: klucze, lock-iny i kwarantanna dla każdej sesji.',
      'Zero-trust-verdediging: sleutels, lock-ins en quarantaine voor elke sessie.',
      'Zero-trust na depensa: mga susi, lock-in at quarantine para sa bawat session.',
    ],
    f0: ['Sovereign keys', '소버린 키', 'Suveräänsed võtmed', 'ソブリンキー', '主权密钥', 'Claves soberanas', 'កូនសោអធិបតេយ្យ', 'Clés souveraines', 'Souveräne Schlüssel', 'Chaves soberanas', 'Khóa chủ quyền', 'Kunci berdaulat', 'Суверенные ключи', 'संप्रभु कुंजियाँ', 'Chiavi sovrane', 'Egemen anahtarlar', 'กุญแจอธิปไตย', 'Suwerenne klucze', 'Soevereine sleutels', 'Mga sovereign na susi'],
    f1: ['Active lock-ins on this device', '이 기기의 활성 락인', 'Aktiivsed lukustused selles seadmes', 'この端末の有効なロックイン', '本设备已激活的锁定模块', 'Lock-ins activos en este dispositivo', 'ការចាក់សោសកម្មលើឧបករណ៍នេះ', 'Lock-ins actifs sur cet appareil', 'Aktive Lock-ins auf diesem Gerät', 'Lock-ins ativos neste dispositivo', 'Lock-in đang bật trên thiết bị này', 'Lock-in aktif di perangkat ini', 'Активные lock-in на этом устройстве', 'इस डिवाइस पर सक्रिय लॉक-इन', 'Lock-in attivi su questo dispositivo', 'Bu cihazda etkin lock-in’ler', 'ล็อกอินที่ใช้งานบนอุปกรณ์นี้', 'Aktywne lock-iny na tym urządzeniu', 'Actieve lock-ins op dit apparaat', 'Mga aktibong lock-in sa device na ito'],
    f2: ['Auto-quarantine of bad nodes', '악성 노드 자동 격리', 'Halbade sõlmede automaatne karantiin', '不正ノードの自動隔離', '恶意节点自动隔离', 'Cuarentena automática de nodos maliciosos', 'ដាក់ថ្នាំងអាក្រក់ឱ្យនៅដាច់ដោយឡែកដោយស្វ័យប្រវត្តិ', 'Mise en quarantaine automatique des nœuds malveillants', 'Auto-Quarantäne für schädliche Knoten', 'Quarentena automática de nós maliciosos', 'Tự động cách ly nút xấu', 'Karantina otomatis node jahat', 'Автокарантин вредоносных узлов', 'खराब नोड का स्वतः क्वारंटीन', 'Quarantena automatica dei nodi malevoli', 'Kötü düğümlerin otomatik karantinası', 'กักกันโหนดไม่ดีอัตโนมัติ', 'Automatyczna kwarantanna złych węzłów', 'Auto-quarantaine van kwaadaardige knopen', 'Awtomatikong quarantine ng masasamang node'],
    cta: ['Open U-Key', 'U-Key 열기', 'Ava U-Key', 'U-Key を開く', '打开 U-Key', 'Abrir U-Key', 'បើក U-Key', 'Ouvrir U-Key', 'U-Key öffnen', 'Abrir U-Key', 'Mở U-Key', 'Buka U-Key', 'Открыть U-Key', 'U-Key खोलें', 'Apri U-Key', 'U-Key’i aç', 'เปิด U-Key', 'Otwórz U-Key', 'U-Key openen', 'Buksan ang U-Key'],
  }),

  ...theme('uNomad', {
    tab: ['U-Nomad', '유노마드', 'U-nomaad', 'Uノマド', 'U游牧', 'U-Nómada', 'U-ណូម៉ាដ', 'U-Nomade', 'U-Nomade', 'U-Nómada', 'U-Du mục', 'U-Nomaden', 'U-Номад', 'U-नोमैड', 'U-Nomade', 'U-Göçebe', 'U-โนแมด', 'U-Nomada', 'U-Nomade', 'U-Nomad'],
    lede: [
      'The digital-nomad arena — earn and compete from anywhere on earth.',
      '디지털 노마드 아레나 — 지구 어디서든 벌고 겨룹니다.',
      'Digitaalnomaadi areen — teeni ja võistle kõikjalt maailmast.',
      'デジタルノマドのアリーナ — 地球上どこからでも稼ぎ、競う。',
      '数字游牧竞技场 — 在地球任何角落赚取与竞技。',
      'La arena del nómada digital — gana y compite desde cualquier lugar del planeta.',
      'សង្វៀនណូម៉ាដឌីជីថល — រកចំណូល និងប្រកួតពីគ្រប់ទីកន្លែងលើផែនដី។',
      'L’arène du nomade numérique — gagnez et rivalisez depuis n’importe où sur terre.',
      'Die Arena der digitalen Nomaden — verdienen und wetteifern von überall auf der Erde.',
      'A arena do nómada digital — ganhe e compita a partir de qualquer lugar do mundo.',
      'Đấu trường du mục số — kiếm tiền và thi đấu từ bất cứ đâu trên trái đất.',
      'Arena nomaden digital — hasilkan dan bersaing dari mana saja di bumi.',
      'Арена цифрового номада — зарабатывайте и соревнуйтесь из любой точки земли.',
      'डिजिटल नोमैड का अखाड़ा — पृथ्वी पर कहीं से भी कमाएँ और प्रतिस्पर्धा करें।',
      'L’arena del nomade digitale — guadagna e compete da qualsiasi luogo della terra.',
      'Dijital göçebe arenası — dünyanın her yerinden kazanın ve yarışın.',
      'สนามของดิจิทัลโนแมด — หารายได้และแข่งขันได้จากทุกที่บนโลก',
      'Arena cyfrowego nomady — zarabiaj i rywalizuj z dowolnego miejsca na ziemi.',
      'De arena van de digitale nomade — verdien en strijd vanaf elke plek op aarde.',
      'Ang arena ng digital nomad — kumita at makipagkumpitensya mula saanman sa mundo.',
    ],
    f0: ['Nomad contribution score', '노마드 기여도 점수', 'Nomaadipanuse skoor', 'ノマド貢献スコア', '游牧贡献分', 'Puntuación de aporte nómada', 'ពិន្ទុការចូលរួមណូម៉ាដ', 'Score de contribution nomade', 'Nomaden-Beitragsscore', 'Pontuação de contribuição nómada', 'Điểm đóng góp du mục', 'Skor kontribusi nomaden', 'Оценка вклада номада', 'नोमैड योगदान स्कोर', 'Punteggio di contributo nomade', 'Göçebe katkı puanı', 'คะแนนการมีส่วนร่วมโนแมด', 'Wynik wkładu nomady', 'Nomadenbijdragescore', 'Iskor ng ambag ng nomad'],
    f1: ['Arena challenges', '아레나 챌린지', 'Areeni väljakutsed', 'アリーナ・チャレンジ', '竞技场挑战', 'Desafíos de la arena', 'ការប្រកួតសង្វៀន', 'Défis de l’arène', 'Arena-Herausforderungen', 'Desafios da arena', 'Thử thách đấu trường', 'Tantangan arena', 'Испытания арены', 'अखाड़े की चुनौतियाँ', 'Sfide dell’arena', 'Arena mücadeleleri', 'ความท้าทายในสนาม', 'Wyzwania areny', 'Arena-uitdagingen', 'Mga hamon sa arena'],
    f2: ['Coins earned from anywhere', '어디서든 코인 획득', 'Mündid teenitud kõikjalt', 'どこからでもコインを獲得', '随处赚取币', 'Monedas ganadas desde cualquier lugar', 'កាក់ដែលរកបានពីគ្រប់ទីកន្លែង', 'Des coins gagnés de n’importe où', 'Coins von überall verdient', 'Moedas ganhas em qualquer lugar', 'Kiếm coin từ bất cứ đâu', 'Koin diperoleh dari mana saja', 'Монеты, заработанные откуда угодно', 'कहीं से भी कमाए कॉइन', 'Monete guadagnate ovunque', 'Her yerden kazanılan coin', 'รับคอยน์ได้จากทุกที่', 'Monety zarabiane z dowolnego miejsca', 'Munten verdiend vanaf overal', 'Coins na kinita saanman'],
    cta: ['Enter ARENA', 'ARENA 입장', 'Sisene ARENA-sse', 'ARENA へ入る', '进入 ARENA', 'Entrar en ARENA', 'ចូល ARENA', 'Entrer dans ARENA', 'ARENA betreten', 'Entrar em ARENA', 'Vào ARENA', 'Masuk ke ARENA', 'Войти в ARENA', 'ARENA में प्रवेश करें', 'Entra in ARENA', 'ARENA’ya gir', 'เข้าสู่ ARENA', 'Wejdź do ARENA', 'ARENA betreden', 'Pumasok sa ARENA'],
  }),

  ...theme('uChronos', {
    tab: ['U-Chronos', '유크로노스', 'U-kronos', 'Uクロノス', 'U时序', 'U-Cronos', 'U-ក្រូណូស', 'U-Chronos', 'U-Chronos', 'U-Cronos', 'U-Chronos', 'U-Kronos', 'U-Хронос', 'U-क्रोनोस', 'U-Chronos', 'U-Kronos', 'U-โครนอส', 'U-Chronos', 'U-Chronos', 'U-Chronos'],
    lede: [
      'Time as a resource: uptime, cadence and the day-seeded rhythm of the square.',
      '자원으로서의 시간: 가동 일수, 카덴스, 그리고 광장의 일자 시드 리듬.',
      'Aeg kui ressurss: tööaeg, rütm ja väljaku päevaseemnega takt.',
      '資源としての時間 — 稼働日数、カデンス、広場の日次シードのリズム。',
      '时间即资源：上线天数、节奏，以及广场按日种子生成的律动。',
      'El tiempo como recurso: días activo, cadencia y el ritmo sembrado por día de la plaza.',
      'ពេលវេលាជាធនធាន៖ ថ្ងៃដំណើរការ ចង្វាក់ និងចង្វាក់តាមថ្ងៃរបស់ទីលាន។',
      'Le temps comme ressource : disponibilité, cadence et rythme semé par jour de la place.',
      'Zeit als Ressource: Laufzeit, Kadenz und der tagesgesäte Rhythmus des Platzes.',
      'O tempo como recurso: dias ativo, cadência e o ritmo semeado por dia da praça.',
      'Thời gian là tài nguyên: số ngày hoạt động, nhịp độ và nhịp gieo theo ngày của quảng trường.',
      'Waktu sebagai sumber daya: hari aktif, irama, dan ritme harian alun-alun.',
      'Время как ресурс: дни в работе, каденция и дневной ритм площади.',
      'संसाधन के रूप में समय: सक्रिय दिन, लय और चौक की दिन-आधारित ताल।',
      'Il tempo come risorsa: giorni attivo, cadenza e il ritmo seminato per giorno della piazza.',
      'Kaynak olarak zaman: yayında geçen günler, kadans ve meydanın güne göre tohumlanan ritmi.',
      'เวลาในฐานะทรัพยากร: วันที่เปิด จังหวะ และจังหวะรายวันของจัตุรัส',
      'Czas jako zasób: dni działania, kadencja i dzienny rytm placu.',
      'Tijd als hulpbron: dagen live, cadans en het dag-gezaaide ritme van het plein.',
      'Oras bilang yaman: mga araw na aktibo, kadensya at ang binhi-araw na ritmo ng plaza.',
    ],
    f0: ['Days-live counter', '가동 일수 카운터', 'Töös oldud päevade loendur', '稼働日数カウンター', '上线天数计数器', 'Contador de días activo', 'កុងទ័រថ្ងៃដំណើរការ', 'Compteur de jours en ligne', 'Zähler der Live-Tage', 'Contador de dias ativo', 'Bộ đếm ngày hoạt động', 'Penghitung hari aktif', 'Счётчик дней в работе', 'सक्रिय दिनों का काउंटर', 'Contatore dei giorni attivo', 'Yayın günü sayacı', 'ตัวนับวันที่เปิด', 'Licznik dni działania', 'Teller van dagen live', 'Bilang ng mga araw na aktibo'],
    f1: ['Daily reseeding at UTC midnight', 'UTC 자정마다 재시드', 'Igapäevane uuendus UTC keskööl', 'UTC 0時に毎日再シード', 'UTC 午夜每日重新生成', 'Resiembra diaria a medianoche UTC', 'បង្កើតឡើងវិញរាល់ថ្ងៃនៅពាក់កណ្តាលអធ្រាត្រ UTC', 'Réinitialisation quotidienne à minuit UTC', 'Tägliche Neusetzung um Mitternacht UTC', 'Renovação diária à meia-noite UTC', 'Gieo lại mỗi ngày lúc nửa đêm UTC', 'Penyemaian ulang harian tengah malam UTC', 'Ежедневное обновление в полночь UTC', 'UTC मध्यरात्रि पर दैनिक पुनः सीडिंग', 'Rigenerazione quotidiana a mezzanotte UTC', 'UTC gece yarısı günlük yeniden tohumlama', 'สุ่มใหม่ทุกวันเวลาเที่ยงคืน UTC', 'Codzienne odnowienie o północy UTC', 'Dagelijks opnieuw zaaien om middernacht UTC', 'Araw-araw na muling pagbuo sa hatinggabi UTC'],
    f2: ['Governance timeline', '거버넌스 타임라인', 'Juhtimise ajajoon', 'ガバナンス・タイムライン', '治理时间线', 'Línea de tiempo de gobernanza', 'បន្ទាត់ពេលវេលាអភិបាលកិច្ច', 'Chronologie de gouvernance', 'Governance-Zeitleiste', 'Linha do tempo de governança', 'Dòng thời gian quản trị', 'Linimasa tata kelola', 'Хронология управления', 'शासन समयरेखा', 'Cronologia di governance', 'Yönetişim zaman çizelgesi', 'ไทม์ไลน์ธรรมาภิบาล', 'Oś czasu zarządzania', 'Governance-tijdlijn', 'Timeline ng pamamahala'],
    cta: ['Enter CHRONOS', 'CHRONOS 입장', 'Sisene CHRONOS-esse', 'CHRONOS へ入る', '进入 CHRONOS', 'Entrar en CHRONOS', 'ចូល CHRONOS', 'Entrer dans CHRONOS', 'CHRONOS betreten', 'Entrar em CHRONOS', 'Vào CHRONOS', 'Masuk ke CHRONOS', 'Войти в CHRONOS', 'CHRONOS में प्रवेश करें', 'Entra in CHRONOS', 'CHRONOS’a gir', 'เข้าสู่ CHRONOS', 'Wejdź do CHRONOS', 'CHRONOS betreden', 'Pumasok sa CHRONOS'],
  }),

  ...theme('uSpace', {
    tab: ['U-Space', '유스페이스', 'U-kosmos', 'Uスペース', 'U太空', 'U-Espacio', 'U-អវកាស', 'U-Espace', 'U-Space', 'U-Espaço', 'U-Không gian', 'U-Antariksa', 'U-Космос', 'U-स्पेस', 'U-Spazio', 'U-Uzay', 'U-สเปซ', 'U-Kosmos', 'U-Ruimte', 'U-Space'],
    lede: [
      'The apex of expansion — modules and nodes mapped as one growing cosmos.',
      '팽창의 정점 — 모듈과 노드를 하나의 성장하는 우주로 지도화합니다.',
      'Laienemise tipp — moodulid ja sõlmed kaardistatud ühe kasvava kosmosena.',
      '拡張の頂点 — モジュールとノードをひとつの成長する宇宙として描く。',
      '扩张的顶点 — 把模块与节点绘成一个不断生长的宇宙。',
      'La cúspide de la expansión — módulos y nodos cartografiados como un cosmos en crecimiento.',
      'កំពូលនៃការពង្រីក — ម៉ូឌុល និងថ្នាំងគូសផែនទីជាចក្រវាឡមួយដែលកំពុងលូតលាស់។',
      'L’apex de l’expansion — modules et nœuds cartographiés en un seul cosmos en croissance.',
      'Der Apex der Expansion — Module und Knoten als ein wachsender Kosmos kartiert.',
      'O ápice da expansão — módulos e nós mapeados como um cosmos em crescimento.',
      'Đỉnh cao của sự mở rộng — mô-đun và nút được vẽ thành một vũ trụ đang lớn dần.',
      'Puncak ekspansi — modul dan node dipetakan sebagai satu kosmos yang terus tumbuh.',
      'Апекс расширения — модули и узлы, нанесённые на карту как единый растущий космос.',
      'विस्तार का शिखर — मॉड्यूल और नोड एक बढ़ते ब्रह्मांड के रूप में मानचित्रित।',
      'L’apice dell’espansione — moduli e nodi mappati come un cosmo in crescita.',
      'Genişlemenin zirvesi — modüller ve düğümler büyüyen tek bir kozmos olarak haritalanır.',
      'จุดสูงสุดของการขยาย — โมดูลและโหนดถูกวาดเป็นจักรวาลเดียวที่กำลังเติบโต',
      'Szczyt ekspansji — moduły i węzły odwzorowane jako jeden rosnący kosmos.',
      'De apex van expansie — modules en knopen in kaart gebracht als één groeiende kosmos.',
      'Ang tugatog ng paglawak — mga module at node na iminapa bilang isang lumalaking kosmos.',
    ],
    f0: ['Module constellation', '모듈 성좌', 'Moodulite tähtkuju', 'モジュールの星座', '模块星座', 'Constelación de módulos', 'ក្រុមផ្កាយម៉ូឌុល', 'Constellation de modules', 'Modul-Konstellation', 'Constelação de módulos', 'Chòm sao mô-đun', 'Konstelasi modul', 'Созвездие модулей', 'मॉड्यूल तारामंडल', 'Costellazione di moduli', 'Modül takımyıldızı', 'กลุ่มดาวโมดูล', 'Konstelacja modułów', 'Moduleconstellatie', 'Konstelasyon ng module'],
    f1: ['Swarm node map', '스웜 노드 맵', 'Parve sõlmede kaart', 'スウォームノードマップ', '蜂群节点图', 'Mapa de nodos del enjambre', 'ផែនទីថ្នាំងហ្វូង', 'Carte des nœuds de l’essaim', 'Schwarm-Knotenkarte', 'Mapa de nós do enxame', 'Bản đồ nút bầy', 'Peta node kawanan', 'Карта узлов роя', 'स्वार्म नोड मानचित्र', 'Mappa dei nodi dello sciame', 'Sürü düğüm haritası', 'แผนที่โหนดสวอร์ม', 'Mapa węzłów roju', 'Zwermknopenkaart', 'Mapa ng node ng swarm'],
    f2: ['Ascent to the apex', '정점으로의 상승', 'Tõus tippu', '頂点への上昇', '向顶点攀升', 'Ascenso a la cúspide', 'ការឡើងទៅកំពូល', 'Ascension vers l’apex', 'Aufstieg zum Apex', 'Ascensão ao ápice', 'Đi lên đỉnh cao', 'Pendakian ke puncak', 'Восхождение к апексу', 'शिखर की ओर आरोहण', 'Ascesa all’apice', 'Zirveye tırmanış', 'ไต่สู่จุดสูงสุด', 'Wspinaczka na szczyt', 'Klim naar de apex', 'Pag-akyat sa tugatog'],
    cta: ['Enter APEX', 'APEX 입장', 'Sisene APEX-i', 'APEX へ入る', '进入 APEX', 'Entrar en APEX', 'ចូល APEX', 'Entrer dans APEX', 'APEX betreten', 'Entrar em APEX', 'Vào APEX', 'Masuk ke APEX', 'Войти в APEX', 'APEX में प्रवेश करें', 'Entra in APEX', 'APEX’e gir', 'เข้าสู่ APEX', 'Wejdź do APEX', 'APEX betreden', 'Pumasok sa APEX'],
  }),

  ...theme('uVision', {
    tab: ['U-Vision', '유비전', 'U-visioon', 'Uビジョン', 'U愿景', 'U-Visión', 'U-ចក្ខុវិស័យ', 'U-Vision', 'U-Vision', 'U-Visão', 'U-Tầm nhìn', 'U-Visi', 'U-Видение', 'U-विज़न', 'U-Visione', 'U-Vizyon', 'U-วิชัน', 'U-Wizja', 'U-Visie', 'U-Bisyon'],
    lede: [
      'Long-range vision: fate, score and the sovereign index in one telescope.',
      '장기 비전: 운명, 스코어, 소버린 지수를 하나의 망원경에 담습니다.',
      'Kaugvaade: saatus, skoor ja suveräänsusindeks ühes teleskoobis.',
      '長期ビジョン — 運命、スコア、ソブリン指数をひとつの望遠鏡で。',
      '远景：命运、分数与主权指数尽收一台望远镜。',
      'Visión de largo alcance: destino, puntuación e índice soberano en un solo telescopio.',
      'ចក្ខុវិស័យរយៈពេលវែង៖ វាសនា ពិន្ទុ និងសន្ទស្សន៍អធិបតេយ្យក្នុងកែវយឺតតែមួយ។',
      'Vision à long terme : destin, score et indice souverain dans un seul télescope.',
      'Weitblick: Schicksal, Score und Souveränitätsindex in einem Teleskop.',
      'Visão de longo alcance: destino, pontuação e índice soberano num só telescópio.',
      'Tầm nhìn xa: vận mệnh, điểm số và chỉ số chủ quyền trong một kính viễn vọng.',
      'Visi jangka panjang: takdir, skor, dan indeks berdaulat dalam satu teleskop.',
      'Дальновидение: судьба, счёт и суверенный индекс в одном телескопе.',
      'दूरगामी दृष्टि: भाग्य, स्कोर और संप्रभु सूचकांक एक ही दूरबीन में।',
      'Visione a lungo raggio: destino, punteggio e indice sovrano in un solo telescopio.',
      'Uzun menzilli vizyon: kader, skor ve egemenlik endeksi tek bir teleskopta.',
      'วิสัยทัศน์ระยะไกล: ชะตา คะแนน และดัชนีอธิปไตยในกล้องโทรทรรศน์เดียว',
      'Dalekosiężna wizja: los, wynik i indeks suwerenności w jednym teleskopie.',
      'Vergezicht: lot, score en de soevereiniteitsindex in één telescoop.',
      'Malayong bisyon: kapalaran, iskor at ang sovereign index sa iisang teleskopyo.',
    ],
    f0: ['Fate matrix', '운명 매트릭스', 'Saatuse maatriks', '運命マトリクス', '命运矩阵', 'Matriz del destino', 'ម៉ាទ្រីសវាសនា', 'Matrice du destin', 'Schicksalsmatrix', 'Matriz do destino', 'Ma trận vận mệnh', 'Matriks takdir', 'Матрица судьбы', 'भाग्य मैट्रिक्स', 'Matrice del destino', 'Kader matrisi', 'เมทริกซ์ชะตา', 'Macierz losu', 'Lotmatrix', 'Matrix ng kapalaran'],
    f1: ['Sovereign index, day by day', '일자별 소버린 지수', 'Suveräänsusindeks päev päeva järel', '日ごとのソブリン指数', '逐日主权指数', 'Índice soberano, día a día', 'សន្ទស្សន៍អធិបតេយ្យ ថ្ងៃម្តងៗ', 'Indice souverain, jour après jour', 'Souveränitätsindex, Tag für Tag', 'Índice soberano, dia a dia', 'Chỉ số chủ quyền theo từng ngày', 'Indeks berdaulat, hari demi hari', 'Суверенный индекс день за днём', 'दिन-ब-दिन संप्रभु सूचकांक', 'Indice sovrano, giorno per giorno', 'Gün gün egemenlik endeksi', 'ดัชนีอธิปไตยรายวัน', 'Indeks suwerenności dzień po dniu', 'Soevereiniteitsindex, dag na dag', 'Sovereign index, araw-araw'],
    f2: ['Outlook per governance axis', '거버넌스 축별 전망', 'Väljavaade juhtimistelje kaupa', 'ガバナンス軸ごとの見通し', '按治理轴展望', 'Perspectiva por eje de gobernanza', 'ទស្សនវិស័យតាមអ័ក្សអភិបាលកិច្ច', 'Perspective par axe de gouvernance', 'Ausblick je Governance-Achse', 'Perspetiva por eixo de governança', 'Triển vọng theo trục quản trị', 'Prospek per poros tata kelola', 'Прогноз по оси управления', 'प्रति शासन अक्ष दृष्टिकोण', 'Prospettiva per asse di governance', 'Yönetişim eksenine göre görünüm', 'มุมมองตามแกนธรรมาภิบาล', 'Perspektywa na oś zarządzania', 'Vooruitzicht per governance-as', 'Pananaw bawat aksis ng pamamahala'],
    cta: ['Enter FATE', 'FATE 입장', 'Sisene FATE-sse', 'FATE へ入る', '进入 FATE', 'Entrar en FATE', 'ចូល FATE', 'Entrer dans FATE', 'FATE betreten', 'Entrar em FATE', 'Vào FATE', 'Masuk ke FATE', 'Войти в FATE', 'FATE में प्रवेश करें', 'Entra in FATE', 'FATE’e gir', 'เข้าสู่ FATE', 'Wejdź do FATE', 'FATE betreden', 'Pumasok sa FATE'],
  }),

  ...theme('uMaster', {
    tab: ['U-Master', '유마스터', 'U-meister', 'Uマスター', 'U大师', 'U-Master', 'U-មេ', 'U-Master', 'U-Master', 'U-Master', 'U-Master', 'U-Master', 'U-Мастер', 'U-मास्टर', 'U-Master', 'U-Master', 'U-มาสเตอร์', 'U-Master', 'U-Master', 'U-Master'],
    lede: [
      'The founder’s control room — every module, axis and lock-in under one crown.',
      '창립자의 통제실 — 모든 모듈, 축, 락인이 하나의 왕관 아래 있습니다.',
      'Asutaja juhtimisruum — iga moodul, telg ja lukustus ühe krooni all.',
      '創立者の管制室 — すべてのモジュール、軸、ロックインをひとつの王冠のもとに。',
      '创始人的控制室 — 所有模块、轴与锁定模块尽在一顶王冠之下。',
      'La sala de control del fundador — cada módulo, eje y lock-in bajo una sola corona.',
      'បន្ទប់បញ្ជារបស់ស្ថាបនិក — គ្រប់ម៉ូឌុល អ័ក្ស និងការចាក់សោ នៅក្រោមមកុដតែមួយ។',
      'La salle de contrôle du fondateur — chaque module, axe et lock-in sous une seule couronne.',
      'Der Kontrollraum des Gründers — jedes Modul, jede Achse, jeder Lock-in unter einer Krone.',
      'A sala de controlo do fundador — cada módulo, eixo e lock-in sob uma só coroa.',
      'Phòng điều khiển của nhà sáng lập — mọi mô-đun, trục và lock-in dưới một vương miện.',
      'Ruang kendali pendiri — setiap modul, poros, dan lock-in di bawah satu mahkota.',
      'Пульт управления основателя — каждый модуль, ось и lock-in под одной короной.',
      'संस्थापक का नियंत्रण कक्ष — हर मॉड्यूल, अक्ष और लॉक-इन एक ही मुकुट के नीचे।',
      'La sala di controllo del fondatore — ogni modulo, asse e lock-in sotto un’unica corona.',
      'Kurucunun kontrol odası — her modül, eksen ve lock-in tek bir taç altında.',
      'ห้องควบคุมของผู้ก่อตั้ง — ทุกโมดูล แกน และล็อกอิน ภายใต้มงกุฎเดียว',
      'Pokój kontrolny założyciela — każdy moduł, oś i lock-in pod jedną koroną.',
      'De controlekamer van de oprichter — elke module, as en lock-in onder één kroon.',
      'Ang control room ng founder — bawat module, aksis at lock-in sa ilalim ng iisang korona.',
    ],
    f0: ['Every module in view', '모든 모듈을 한눈에', 'Iga moodul vaateväljas', 'すべてのモジュールを一望', '所有模块尽收眼底', 'Todos los módulos a la vista', 'គ្រប់ម៉ូឌុលក្នុងទិដ្ឋភាព', 'Tous les modules en vue', 'Jedes Modul im Blick', 'Todos os módulos à vista', 'Mọi mô-đun trong tầm nhìn', 'Setiap modul terlihat', 'Все модули на виду', 'हर मॉड्यूल नज़र में', 'Ogni modulo in vista', 'Her modül görünümde', 'ทุกโมดูลในสายตา', 'Każdy moduł w zasięgu wzroku', 'Elke module in beeld', 'Bawat module sa paningin'],
    f1: ['Every governance axis', '모든 거버넌스 축', 'Iga juhtimistelg', 'すべてのガバナンス軸', '所有治理轴', 'Todos los ejes de gobernanza', 'គ្រប់អ័ក្សអភិបាលកិច្ច', 'Tous les axes de gouvernance', 'Jede Governance-Achse', 'Todos os eixos de governança', 'Mọi trục quản trị', 'Setiap poros tata kelola', 'Все оси управления', 'हर शासन अक्ष', 'Ogni asse di governance', 'Her yönetişim ekseni', 'ทุกแกนธรรมาภิบาล', 'Każda oś zarządzania', 'Elke governance-as', 'Bawat aksis ng pamamahala'],
    f2: ['Sovereign session only', '소버린 세션 전용', 'Ainult suveräänne seanss', 'ソブリンセッション限定', '仅限主权会话', 'Solo sesión soberana', 'សម័យអធិបតេយ្យប៉ុណ្ណោះ', 'Session souveraine uniquement', 'Nur souveräne Sitzung', 'Apenas sessão soberana', 'Chỉ phiên chủ quyền', 'Hanya sesi berdaulat', 'Только суверенная сессия', 'केवल संप्रभु सत्र', 'Solo sessione sovrana', 'Yalnızca egemen oturum', 'เฉพาะเซสชันอธิปไตย', 'Tylko sesja suwerenna', 'Alleen soevereine sessie', 'Sovereign session lamang'],
    cta: ['Enter the sovereign console', '소버린 콘솔 입장', 'Sisene suveräänsesse konsooli', 'ソブリンコンソールへ入る', '进入主权控制台', 'Entrar en la consola soberana', 'ចូលកុងសូលអធិបតេយ្យ', 'Entrer dans la console souveraine', 'Souveräne Konsole betreten', 'Entrar na consola soberana', 'Vào bảng điều khiển chủ quyền', 'Masuk ke konsol berdaulat', 'Войти в суверенную консоль', 'संप्रभु कंसोल में प्रवेश करें', 'Entra nella console sovrana', 'Egemen konsola gir', 'เข้าสู่คอนโซลอธิปไตย', 'Wejdź do konsoli suwerennej', 'Soevereine console betreden', 'Pumasok sa sovereign console'],
  }),
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
      throw new Error(`apply-rev34-square-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (setDeep(data, dotted, value)) set += 1;
  }

  // Fail closed: nothing placeholder-shaped went into THIS lane's sub-namespace.
  const own = JSON.stringify(data.Rev34?.square ?? {});
  if (own.includes('[MISSING')) throw new Error(`apply-rev34-square-i18n: ${locale}: a placeholder survived in Rev34.square`);

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev34-square-i18n: clean' : `apply-rev34-square-i18n: ${totalChanges} locale file(s) would change`);
  process.exit(totalChanges === 0 ? 0 : 1);
}
console.log(`apply-rev34-square-i18n: ${totalChanges} locale file(s) written`);
