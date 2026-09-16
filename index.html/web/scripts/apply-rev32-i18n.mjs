/**
 * REV-32 i18n applicator (founder directive 2026-09-15).
 *
 * Idempotent, all 20 locales at once, a REAL translation per locale -- never a
 * placeholder. It writes two things:
 *
 *  1. `Rev32.swarm.*` -- the omni-tech swarm's own copy, now that the swarm is
 *     an independent module instead of a lens inside a deleted framework. The
 *     dimension labels, the scale facts, the brand title and the re-anchor
 *     action are the REV-23 originals, recovered from the pre-REV-31 tree so
 *     each locale keeps the wording it already had rather than a re-translation.
 *  2. `Rev29.hub.tabs.swarm` -- the sixth tab of the UNITAS master hub.
 *  3. `Rev32.swarm.viewport.*` (REV-33 M2) -- the zero-friction viewport
 *     controls: zoom in, zoom out, fit, and the travel hint.
 *
 * `Rev21.stream.kinds.swarm` is NOT written here: the Rev21 namespace is owned
 * by docs/rev21/i18n/*.json via scripts/i18n/apply-rev21.mjs, which replaces
 * the namespace wholesale. Writing it here would be silently reverted.
 *
 * Run: node scripts/apply-rev32-i18n.mjs [--check]
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
  if (v.length !== LOCALES.length) throw new Error(`apply-rev32-i18n: L() expects ${LOCALES.length} strings, got ${v.length}`);
  return Object.fromEntries(LOCALES.map((l, i) => [l, v[i]]));
};

const SET = {
  "Rev29.hub.tabs.swarm": L(
    "Swarm", "스웜", "Parv", "スウォーム", "蜂群", "Enjambre", "ហ្វូង", "Essaim", "Schwarm", "Enxame", "Bầy", "Gerombolan", "Рой", "स्वार्म", "Sciame", "Sürü", "สวอร์ม", "Rój", "Zwerm", "Kuyog"
  ),
  "Rev32.swarm.title": L(
    "Omni-Tech Pulse", "옴니 테크 펄스", "Omni-Tech pulss", "オムニテック・パルス", "全域科技脉动", "Pulso omnitecnológico", "ចលនា Omni-Tech", "Pouls omni-tech", "Omni-Tech-Puls", "Pulso omnitecnológico", "Nhịp Omni-Tech", "Denyut Omni-Tech", "Омни-тех пульс", "ओमनी-टेक पल्स", "Pulsazione omni-tech", "Omni-Tech nabzı", "ชีพจรออมนิเทค", "Puls omni-tech", "Omni-tech-puls", "Pulso ng Omni-Tech"
  ),
  "Rev32.swarm.lede": L(
    "Take it apart: what does this organisation own, make, and run on?", "해체해 봅니다 — 이 조직은 무엇을 소유하고, 무엇을 만들며, 무엇 위에서 돌아가는가?", "Võta lahti: mida see organisatsioon omab, toodab ja millel ta töötab?", "分解してみる — この組織は何を所有し、何をつくり、何の上で動いているのか。", "把它拆开：这个组织拥有什么、生产什么、依托什么运转？", "Desmóntalo: ¿qué posee, qué fabrica y sobre qué funciona esta organización?", "បំបែកវាមើល៖ អង្គភាពនេះកាន់កាប់អ្វី ផលិតអ្វី និងដំណើរការលើអ្វី?", "Démontons-la : que possède, que fabrique et sur quoi tourne cette organisation ?", "Auseinandernehmen: Was besitzt, was baut und worauf läuft diese Organisation?", "Desmonte-a: o que esta organização possui, fabrica e sobre o que funciona?", "Tháo rời ra: tổ chức này sở hữu gì, làm ra gì và vận hành trên nền gì?", "Bongkar: apa yang dimiliki, dibuat, dan dijalankan organisasi ini?", "Разобрать по частям: чем эта организация владеет, что производит и на чём работает?", "इसे खोलकर देखें: यह संगठन क्या रखता है, क्या बनाता है और किस पर चलता है?", "Smontiamola: che cosa possiede, che cosa produce e su che cosa gira quest'organizzazione?", "Parçalarına ayıralım: bu kuruluş neye sahip, ne üretiyor ve ne üzerinde çalışıyor?", "ถอดออกดู: องค์กรนี้เป็นเจ้าของอะไร ผลิตอะไร และทำงานอยู่บนอะไร", "Rozłóż to na części: co ta organizacja posiada, co wytwarza i na czym działa?", "Haal het uit elkaar: wat bezit, maakt en draait deze organisatie?", "Buksan natin: ano ang pag-aari, ginagawa, at pinatatakbo ng organisasyong ito?"
  ),
  "Rev32.swarm.trailAria": L(
    "Absorption trail", "흡수 경로", "Neeldumisrada", "吸収の経路", "吸收路径", "Ruta de absorción", "ផ្លូវស្រូបយក", "Parcours d'absorption", "Absorptionspfad", "Trilha de absorção", "Lộ trình hấp thụ", "Jejak penyerapan", "Путь поглощения", "अवशोषण पथ", "Percorso di assorbimento", "Soğurma izi", "เส้นทางการดูดซับ", "Ścieżka absorpcji", "Absorptiespoor", "Landas ng pagsipsip"
  ),
  "Rev32.swarm.reAnchor": L(
    "Explore this instead", "이 존재로 다시 탐색", "Uuri hoopis seda", "こちらを探索する", "改为探索此项", "Explorar esto en su lugar", "ស្វែងយល់ពីនេះជំនួសវិញ", "Explorer ceci à la place", "Stattdessen dies erkunden", "Explorar isto em vez disso", "Khám phá mục này thay thế", "Jelajahi ini saja", "Исследовать это вместо текущего", "इसके बजाय इसे खोजें", "Esplora questo invece", "Bunun yerine bunu keşfet", "สำรวจสิ่งนี้แทน", "Zamiast tego zgłęb to", "Verken dit in plaats daarvan", "Ito na lang ang tuklasin"
  ),
  "Rev32.swarm.loading": L(
    "Loading…", "불러오는 중…", "Laadimine…", "読み込み中…", "加载中…", "Cargando…", "កំពុងផ្ទុក…", "Chargement…", "Wird geladen …", "Carregando…", "Đang tải…", "Memuat…", "Загрузка…", "लोड हो रहा है…", "Caricamento…", "Yükleniyor…", "กำลังโหลด…", "Wczytywanie…", "Laden…", "Naglo-load…"
  ),
  "Rev32.swarm.failed": L(
    "That field did not load — close it and open it again.", "필드를 불러오지 못했습니다 — 닫았다 다시 열어 주세요.", "Väli ei laadinud — sulge ja ava uuesti.", "フィールドを読み込めませんでした。閉じてもう一度開いてください。", "该场域未能加载——请关闭后重新打开。", "El campo no se cargó: ciérrelo y ábralo de nuevo.", "មិនអាចផ្ទុកវាលបានទេ — សូមបិទ ហើយបើកម្តងទៀត។", "Le champ n'a pas pu se charger — fermez-le et rouvrez-le.", "Das Feld konnte nicht geladen werden — schließen und erneut öffnen.", "O campo não carregou — feche e abra novamente.", "Không tải được trường — hãy đóng rồi mở lại.", "Bidang gagal dimuat — tutup lalu buka lagi.", "Поле не загрузилось — закройте и откройте снова.", "फ़ील्ड लोड नहीं हुआ — बंद करके फिर से खोलें।", "Il campo non si è caricato: chiudilo e riaprilo.", "Alan yüklenemedi — kapatıp yeniden açın.", "โหลดสนามไม่สำเร็จ — โปรดปิดแล้วเปิดใหม่", "Pole się nie wczytało — zamknij i otwórz ponownie.", "Het veld kon niet laden — sluit en open het opnieuw.", "Hindi na-load ang field — isara at buksan itong muli."
  ),
  "Rev32.swarm.empty": L(
    "Wikidata holds no modules for this subject yet.", "위키데이터에 이 주제의 모듈이 아직 없습니다.", "Wikidatas pole selle teema kohta veel mooduleid.", "ウィキデータにはこの主題のモジュールがまだありません。", "维基数据尚无该主题的模块。", "Wikidata aún no tiene módulos para este tema.", "Wikidata មិនទាន់មានម៉ូឌុលសម្រាប់ប្រធានបទនេះទេ។", "Wikidata ne contient pas encore de modules pour ce sujet.", "Wikidata hält für dieses Thema noch keine Module bereit.", "A Wikidata ainda não tem módulos para este assunto.", "Wikidata chưa có mô-đun nào cho chủ đề này.", "Wikidata belum punya modul untuk subjek ini.", "В Викиданных пока нет модулей для этого предмета.", "विकिडेटा में इस विषय के लिए अभी कोई मॉड्यूल नहीं है।", "Wikidata non ha ancora moduli per questo soggetto.", "Wikidata'da bu konu için henüz modül yok.", "วิกิสนเทศยังไม่มีโมดูลสำหรับหัวข้อนี้", "Wikidane nie mają jeszcze modułów dla tego tematu.", "Wikidata heeft nog geen modules voor dit onderwerp.", "Wala pang modules ang Wikidata para sa paksang ito."
  ),
  "Rev32.swarm.needsEntity": L(
    "Name an organisation and the field will take it apart.", "조직 이름을 입력하면 그 조직을 해체해 보여 드립니다.", "Nimeta organisatsioon ja väli võtab selle koost lahti.", "組織名を入力すると、その組織を分解して描き出します。", "输入一个组织名称，场域会将其拆解呈现。", "Nombre una organización y el campo la descompondrá.", "បញ្ចូលឈ្មោះអង្គភាព នោះវាលនឹងបំបែកវាជូន។", "Nommez une organisation et le champ la décomposera.", "Nennen Sie eine Organisation, und das Feld zerlegt sie.", "Indique uma organização e o campo a decompõe.", "Nhập tên một tổ chức và trường sẽ phân tách nó.", "Sebutkan sebuah organisasi, bidang ini akan menguraikannya.", "Назовите организацию — поле разберёт её на части.", "किसी संगठन का नाम दें, यह क्षेत्र उसे विखंडित कर दिखाएगा।", "Indica un'organizzazione e il campo la scomporrà.", "Bir kuruluş adı girin, alan onu parçalarına ayırsın.", "ระบุชื่อองค์กร แล้วสนามนี้จะแยกส่วนให้ดู", "Podaj organizację, a pole rozłoży ją na części.", "Noem een organisatie en het veld haalt haar uit elkaar.", "Magbanggit ng organisasyon at bubuwagin ito ng field."
  ),
  "Rev32.swarm.sourceNote": L(
    "Source", "출처", "Allikas", "出典", "来源", "Fuente", "ប្រភព", "Source", "Quelle", "Fonte", "Nguồn", "Sumber", "Источник", "स्रोत", "Fonte", "Kaynak", "แหล่งที่มา", "Źródło", "Bron", "Pinagmulan"
  ),
  "Rev32.swarm.fields.f1": L(
    "Industry", "산업 분야", "Tegevusala", "業種", "所属行业", "Industria", "ឧស្សាហកម្ម", "Secteur", "Branche", "Setor", "Ngành", "Industri", "Отрасль", "उद्योग", "Settore", "Sektör", "อุตสาหกรรม", "Branża", "Branche", "Industriya"
  ),
  "Rev32.swarm.fields.f2": L(
    "Parent", "모회사", "Emaorganisatsioon", "親組織", "母公司", "Matriz", "ស្ថាប័នមេ", "Maison mère", "Mutterorganisation", "Matriz", "Công ty mẹ", "Induk", "Головная организация", "मूल संगठन", "Casa madre", "Ana kuruluş", "บริษัทแม่", "Podmiot dominujący", "Moederorganisatie", "Punong organisasyon"
  ),
  "Rev32.swarm.fields.f3": L(
    "Subsidiaries", "자회사", "Tütarettevõtted", "子会社", "子公司", "Filiales", "ក្រុមហ៊ុនបុត្រសម្ព័ន្ធ", "Filiales", "Tochtergesellschaften", "Subsidiárias", "Công ty con", "Anak usaha", "Дочерние компании", "सहायक कंपनियाँ", "Controllate", "Bağlı kuruluşlar", "บริษัทในเครือ", "Spółki zależne", "Dochterondernemingen", "Mga subsidiary"
  ),
  "Rev32.swarm.fields.f4": L(
    "Products", "제품·서비스", "Tooted", "製品・サービス", "产品与服务", "Productos", "ផលិតផល", "Produits", "Produkte", "Produtos", "Sản phẩm", "Produk", "Продукты", "उत्पाद", "Prodotti", "Ürünler", "ผลิตภัณฑ์", "Produkty", "Producten", "Mga produkto"
  ),
  "Rev32.swarm.fields.f5": L(
    "Founders", "창립자", "Asutajad", "創業者", "创始人", "Fundadores", "ស្ថាបនិក", "Fondateurs", "Gründer", "Fundadores", "Người sáng lập", "Pendiri", "Основатели", "संस्थापक", "Fondatori", "Kurucular", "ผู้ก่อตั้ง", "Założyciele", "Oprichters", "Mga tagapagtatag"
  ),
  "Rev32.swarm.fields.f6": L(
    "Chief executive", "최고경영자", "Tegevjuht", "最高経営責任者", "首席执行官", "Director ejecutivo", "នាយកប្រតិបត្តិ", "Directeur général", "Vorstandsvorsitz", "Diretor executivo", "Giám đốc điều hành", "Direktur utama", "Генеральный директор", "मुख्य कार्यकारी", "Amministratore delegato", "Genel müdür", "ประธานเจ้าหน้าที่บริหาร", "Dyrektor generalny", "Bestuursvoorzitter", "Punong tagapagpaganap"
  ),
  "Rev32.swarm.facts.scaleEmployees": L(
    "Employees", "임직원 수", "Töötajaid", "従業員数", "员工人数", "Empleados", "បុគ្គលិក", "Effectif", "Beschäftigte", "Funcionários", "Nhân sự", "Karyawan", "Сотрудники", "कर्मचारी", "Dipendenti", "Çalışan sayısı", "จำนวนพนักงาน", "Zatrudnieni", "Medewerkers", "Mga empleyado"
  ),
  "Rev32.swarm.facts.scaleRevenue": L(
    "Revenue", "매출", "Käive", "売上高", "营业收入", "Ingresos", "ចំណូល", "Chiffre d'affaires", "Umsatz", "Receita", "Doanh thu", "Pendapatan", "Выручка", "राजस्व", "Ricavi", "Gelir", "รายได้", "Przychód", "Omzet", "Kita"
  ),
  "Rev32.swarm.portal.title": L(
    "Omni-Tech Pulse", "옴니 테크 펄스", "Omni-Tech pulss", "オムニテック・パルス", "全域科技脉动", "Pulso omnitecnológico", "ចលនា Omni-Tech", "Pouls omni-tech", "Omni-Tech-Puls", "Pulso omnitecnológico", "Nhịp Omni-Tech", "Denyut Omni-Tech", "Омни-тех пульс", "ओमनी-टेक पल्स", "Pulsazione omni-tech", "Omni-Tech nabzı", "ชีพจรออมนิเทค", "Puls omni-tech", "Omni-tech-puls", "Pulso ng Omni-Tech"
  ),
  "Rev32.swarm.portal.lede": L(
    "See what {term} is made of — its industries, owners, products and people, drawn as one field.", "{term}이(가) 무엇으로 이루어져 있는지 봅니다 — 산업·모회사·제품·사람이 하나의 장으로 펼쳐집니다.", "Vaata, millest {term} koosneb — tegevusalad, omanikud, tooted ja inimesed ühe väljana.", "{term} が何でできているかを見る — 業種・親組織・製品・人物がひとつの場に広がります。", "看看 {term} 由什么构成——行业、母公司、产品与人物，展开为一个场域。", "Vea de qué está hecha {term}: sectores, matrices, productos y personas en un solo campo.", "មើលថា {term} បង្កើតឡើងពីអ្វី — ឧស្សាហកម្ម ស្ថាប័នមេ ផលិតផល និងមនុស្ស ក្នុងវាលតែមួយ។", "Voyez de quoi {term} est fait : secteurs, maisons mères, produits et personnes, en un seul champ.", "Sehen Sie, woraus {term} besteht: Branchen, Eigentümer, Produkte und Menschen als ein Feld.", "Veja do que {term} é feita: setores, matrizes, produtos e pessoas num só campo.", "Xem {term} được tạo nên từ gì — ngành, công ty mẹ, sản phẩm và con người trong một trường.", "Lihat {term} terbuat dari apa: industri, induk, produk, dan orang dalam satu bidang.", "Посмотрите, из чего состоит {term}: отрасли, владельцы, продукты и люди в одном поле.", "देखें कि {term} किससे बना है — उद्योग, मूल संगठन, उत्पाद और लोग, एक ही क्षेत्र में।", "Guarda di cosa è fatta {term}: settori, proprietari, prodotti e persone in un unico campo.", "{term} neyden oluşuyor görün: sektörler, sahipler, ürünler ve insanlar tek bir alanda.", "ดูว่า {term} ประกอบขึ้นจากอะไร — อุตสาหกรรม บริษัทแม่ ผลิตภัณฑ์ และผู้คน ในสนามเดียว", "Zobacz, z czego składa się {term}: branże, właściciele, produkty i ludzie w jednym polu.", "Zie waaruit {term} bestaat: branches, eigenaren, producten en mensen in één veld.", "Tingnan kung saan gawa ang {term} — industriya, may-ari, produkto at tao sa iisang field."
  ),
  "Rev32.swarm.portal.cta": L(
    "Enter the field", "장(場)으로 들어가기", "Sisene väljale", "場に入る", "进入场域", "Entrar al campo", "ចូលទៅក្នុងវាល", "Entrer dans le champ", "Ins Feld eintreten", "Entrar no campo", "Vào trường", "Masuk ke bidang", "Войти в поле", "क्षेत्र में प्रवेश करें", "Entra nel campo", "Alana gir", "เข้าสู่สนาม", "Wejdź w pole", "Betreed het veld", "Pumasok sa field"
  ),
  "Rev32.swarm.portal.aria": L(
    "Open the omni-tech field for {term}", "{term}의 옴니-테크 장 열기", "Ava {term} omni-tech väli", "{term} のオムニテック場を開く", "打开 {term} 的全域科技场域", "Abrir el campo omnitecnológico de {term}", "បើកវាល Omni-Tech សម្រាប់ {term}", "Ouvrir le champ omni-tech de {term}", "Das Omni-Tech-Feld von {term} öffnen", "Abrir o campo omnitecnológico de {term}", "Mở trường Omni-Tech của {term}", "Buka bidang Omni-Tech untuk {term}", "Открыть омни-тех поле для {term}", "{term} का ओमनी-टेक क्षेत्र खोलें", "Apri il campo omni-tech di {term}", "{term} için omni-tech alanını aç", "เปิดสนามออมนิเทคของ {term}", "Otwórz pole omni-tech dla {term}", "Open het omni-tech-veld van {term}", "Buksan ang omni-tech field ng {term}"
  ),
  "Rev32.swarm.page.title": L(
    "Omni-Tech Pulse", "옴니 테크 펄스", "Omni-Tech pulss", "オムニテック・パルス", "全域科技脉动", "Pulso omnitecnológico", "ចលនា Omni-Tech", "Pouls omni-tech", "Omni-Tech-Puls", "Pulso omnitecnológico", "Nhịp Omni-Tech", "Denyut Omni-Tech", "Омни-тех пульс", "ओमनी-टेक पल्स", "Pulsazione omni-tech", "Omni-Tech nabzı", "ชีพจรออมนิเทค", "Puls omni-tech", "Omni-tech-puls", "Pulso ng Omni-Tech"
  ),
  "Rev32.swarm.page.lede": L(
    "Take any organisation apart into the modules Wikidata already holds about it — industries, owners, subsidiaries, products, founders and executives — and walk from any one of them into the next.", "위키데이터가 이미 가지고 있는 모듈로 어떤 조직이든 해체합니다 — 산업, 모회사, 자회사, 제품, 창립자, 경영진 — 그리고 그중 무엇으로든 이어서 걸어 들어갈 수 있습니다.", "Võta ükskõik milline organisatsioon lahti mooduliteks, mis Wikidatas juba olemas on — tegevusalad, omanikud, tütarettevõtted, tooted, asutajad ja juhid — ning liigu neist ükskõik millisesse edasi.", "ウィキデータがすでに保持しているモジュール——業種、親組織、子会社、製品、創業者、経営陣——へ、どんな組織でも分解し、そのどれからでも次へ歩いていけます。", "把任何组织拆解成维基数据已有的模块——行业、母公司、子公司、产品、创始人与高管——并从其中任意一个继续走下去。", "Descomponga cualquier organización en los módulos que Wikidata ya guarda —sectores, matrices, filiales, productos, fundadores y directivos— y avance desde cualquiera de ellos.", "បំបែកអង្គភាពណាមួយទៅជាម៉ូឌុលដែល Wikidata មានរួចហើយ — ឧស្សាហកម្ម ស្ថាប័នមេ ក្រុមហ៊ុនបុត្រសម្ព័ន្ធ ផលិតផល ស្ថាបនិក និងនាយកប្រតិបត្តិ — ហើយដើរបន្តពីណាមួយក៏បាន។", "Décomposez n'importe quelle organisation en modules que Wikidata contient déjà — secteurs, maisons mères, filiales, produits, fondateurs et dirigeants — puis avancez depuis l'un d'eux.", "Zerlegen Sie jede Organisation in die Module, die Wikidata bereits über sie hält — Branchen, Eigentümer, Tochtergesellschaften, Produkte, Gründer und Vorstände — und gehen Sie von jedem davon weiter.", "Decomponha qualquer organização nos módulos que a Wikidata já guarda — setores, matrizes, subsidiárias, produtos, fundadores e executivos — e siga a partir de qualquer um deles.", "Phân tách bất kỳ tổ chức nào thành các mô-đun mà Wikidata đã có — ngành, công ty mẹ, công ty con, sản phẩm, người sáng lập và ban điều hành — rồi đi tiếp từ bất kỳ mô-đun nào.", "Uraikan organisasi mana pun menjadi modul yang sudah dimiliki Wikidata — industri, induk, anak usaha, produk, pendiri, dan direksi — lalu lanjutkan dari salah satunya.", "Разберите любую организацию на модули, которые уже есть в Викиданных, — отрасли, владельцы, дочерние компании, продукты, основатели и руководители, — и переходите от любого из них дальше.", "किसी भी संगठन को उन मॉड्यूलों में विखंडित करें जो विकिडेटा के पास पहले से हैं — उद्योग, मूल संगठन, सहायक कंपनियाँ, उत्पाद, संस्थापक और अधिकारी — और उनमें से किसी से भी आगे बढ़ें।", "Scomponi qualsiasi organizzazione nei moduli che Wikidata già possiede — settori, proprietari, controllate, prodotti, fondatori e dirigenti — e prosegui da uno qualsiasi di essi.", "Herhangi bir kuruluşu Wikidata'nın zaten tuttuğu modüllere ayırın — sektörler, sahipler, bağlı kuruluşlar, ürünler, kurucular ve yöneticiler — ve bunlardan herhangi birinden devam edin.", "แยกองค์กรใดก็ได้ออกเป็นโมดูลที่วิกิสนเทศมีอยู่แล้ว — อุตสาหกรรม บริษัทแม่ บริษัทในเครือ ผลิตภัณฑ์ ผู้ก่อตั้ง และผู้บริหาร — แล้วเดินต่อจากโมดูลใดก็ได้", "Rozłóż dowolną organizację na moduły, które Wikidane już mają — branże, właścicieli, spółki zależne, produkty, założycieli i zarząd — i idź dalej od dowolnego z nich.", "Haal elke organisatie uit elkaar in de modules die Wikidata al heeft — branches, eigenaren, dochterondernemingen, producten, oprichters en bestuurders — en loop vanaf elk ervan verder.", "Buwagin ang alinmang organisasyon sa mga modyul na nasa Wikidata na — industriya, may-ari, subsidiary, produkto, tagapagtatag at ehekutibo — at magpatuloy mula sa alinman sa mga ito."
  ),
  "Rev32.swarm.page.search": L(
    "Search", "검색", "Otsi", "検索", "搜索", "Buscar", "ស្វែងរក", "Rechercher", "Suchen", "Buscar", "Tìm", "Cari", "Найти", "खोजें", "Cerca", "Ara", "ค้นหา", "Szukaj", "Zoeken", "Maghanap"
  ),
  "Rev32.swarm.page.searchLabel": L(
    "Organisation to take apart", "해체할 조직", "Lahtivõetav organisatsioon", "分解する組織", "要拆解的组织", "Organización a descomponer", "អង្គភាពដែលត្រូវបំបែក", "Organisation à décomposer", "Zu zerlegende Organisation", "Organização a decompor", "Tổ chức cần phân tách", "Organisasi yang diuraikan", "Организация для разбора", "विखंडित करने योग्य संगठन", "Organizzazione da scomporre", "Parçalanacak kuruluş", "องค์กรที่จะแยกส่วน", "Organizacja do rozłożenia", "Te ontleden organisatie", "Organisasyong bubuwagin"
  ),
  "Rev32.swarm.page.searchPlaceholder": L(
    "Samsung Electronics, World Bank, FC Barcelona…", "삼성전자, 세계은행, FC 바르셀로나…", "Samsung Electronics, Maailmapank, FC Barcelona…", "サムスン電子、世界銀行、FCバルセロナ…", "三星电子、世界银行、巴塞罗那足球俱乐部…", "Samsung Electronics, Banco Mundial, FC Barcelona…", "Samsung Electronics, ធនាគារពិភពលោក, FC Barcelona…", "Samsung Electronics, Banque mondiale, FC Barcelone…", "Samsung Electronics, Weltbank, FC Barcelona…", "Samsung Electronics, Banco Mundial, FC Barcelona…", "Samsung Electronics, Ngân hàng Thế giới, FC Barcelona…", "Samsung Electronics, Bank Dunia, FC Barcelona…", "Samsung Electronics, Всемирный банк, ФК «Барселона»…", "सैमसंग इलेक्ट्रॉनिक्स, विश्व बैंक, एफसी बार्सिलोना…", "Samsung Electronics, Banca Mondiale, FC Barcellona…", "Samsung Electronics, Dünya Bankası, FC Barcelona…", "ซัมซุงอิเล็กทรอนิกส์, ธนาคารโลก, สโมสรฟุตบอลบาร์เซโลนา…", "Samsung Electronics, Bank Światowy, FC Barcelona…", "Samsung Electronics, Wereldbank, FC Barcelona…", "Samsung Electronics, World Bank, FC Barcelona…"
  ),
  "Rev32.swarm.page.unresolved": L(
    "No organisation matched that name — try its full, official name.", "그 이름과 일치하는 조직을 찾지 못했습니다 — 정식 명칭으로 시도해 보세요.", "Selle nimega organisatsiooni ei leitud — proovi täielikku ametlikku nime.", "その名前に一致する組織が見つかりませんでした。正式名称でお試しください。", "没有匹配该名称的组织——请尝试其完整的正式名称。", "Ninguna organización coincide con ese nombre: pruebe con su nombre oficial completo.", "រកមិនឃើញអង្គភាពត្រូវនឹងឈ្មោះនោះទេ — សូមសាកល្បងឈ្មោះផ្លូវការពេញ។", "Aucune organisation ne correspond à ce nom — essayez son nom officiel complet.", "Keine Organisation passt zu diesem Namen — versuchen Sie den vollständigen offiziellen Namen.", "Nenhuma organização corresponde a esse nome — tente o nome oficial completo.", "Không có tổ chức nào khớp tên đó — hãy thử tên chính thức đầy đủ.", "Tidak ada organisasi yang cocok — coba nama resmi lengkapnya.", "Организация с таким названием не найдена — попробуйте полное официальное название.", "उस नाम से कोई संगठन नहीं मिला — पूरा आधिकारिक नाम आज़माएँ।", "Nessuna organizzazione corrisponde a quel nome: prova il nome ufficiale completo.", "Bu ada uyan kuruluş bulunamadı — tam resmî adını deneyin.", "ไม่พบองค์กรที่ตรงกับชื่อนั้น — ลองใช้ชื่อทางการเต็ม", "Nie znaleziono organizacji o tej nazwie — spróbuj pełnej oficjalnej nazwy.", "Geen organisatie gevonden met die naam — probeer de volledige officiële naam.", "Walang organisasyong tumugma — subukan ang buong opisyal na pangalan."
  ),
  "Rev32.swarm.viewport.zoomIn": L(
    "Zoom in", "확대", "Suumi sisse", "拡大", "放大", "Acercar", "ពង្រីក", "Zoom avant", "Vergrößern", "Ampliar", "Phóng to", "Perbesar", "Приблизить", "ज़ूम इन", "Ingrandisci", "Yakınlaştır", "ขยาย", "Powiększ", "Inzoomen", "Palakihin"
  ),
  "Rev32.swarm.viewport.zoomOut": L(
    "Zoom out", "축소", "Suumi välja", "縮小", "缩小", "Alejar", "បង្រួម", "Zoom arrière", "Verkleinern", "Reduzir", "Thu nhỏ", "Perkecil", "Отдалить", "ज़ूम आउट", "Riduci", "Uzaklaştır", "ย่อ", "Pomniejsz", "Uitzoomen", "Paliitin"
  ),
  "Rev32.swarm.viewport.reset": L(
    "Fit the field", "전체 보기", "Sobita väli", "全体表示", "适应画面", "Ajustar el campo", "សមនឹងវាល", "Ajuster le champ", "Feld einpassen", "Ajustar o campo", "Vừa khung", "Paskan bidang", "Вписать поле", "क्षेत्र फ़िट करें", "Adatta il campo", "Alanı sığdır", "พอดีสนาม", "Dopasuj pole", "Veld passend maken", "Ikasya ang field"
  ),
  "Rev32.swarm.viewport.hint": L(
    "Drag to travel · pinch to zoom", "드래그로 이동 · 두 손가락으로 확대", "Lohista liikumiseks · näpista suumimiseks", "ドラッグで移動・ピンチで拡大", "拖动移动 · 双指缩放", "Arrastra para moverte · pellizca para ampliar", "អូសដើម្បីផ្លាស់ទី · ច្បិចដើម្បីពង្រីក", "Glissez pour vous déplacer · pincez pour zoomer", "Ziehen zum Bewegen · Kneifen zum Zoomen", "Arraste para navegar · pince para ampliar", "Kéo để di chuyển · chụm để phóng to", "Seret untuk berpindah · cubit untuk memperbesar", "Перетащите, чтобы двигаться · сведите пальцы для масштаба", "चलने के लिए खींचें · ज़ूम के लिए पिंच करें", "Trascina per muoverti · pizzica per ingrandire", "Gezinmek için sürükleyin · yakınlaştırmak için sıkıştırın", "ลากเพื่อเคลื่อนที่ · หนีบเพื่อซูม", "Przeciągnij, aby się poruszać · uszczypnij, aby przybliżyć", "Sleep om te bewegen · knijp om te zoomen", "I-drag para maglakbay · kurutin para mag-zoom"
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
      throw new Error(`apply-rev32-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (setDeep(data, dotted, value)) set += 1;
  }

  // Fail closed: nothing placeholder-shaped went in.
  const rev32 = JSON.stringify(data.Rev32 ?? {});
  if (rev32.includes('[MISSING')) throw new Error(`apply-rev32-i18n: ${locale}: a placeholder survived in Rev32`);

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev32-i18n: clean' : `apply-rev32-i18n: ${totalChanges} locale file(s) would change`);
  process.exit(totalChanges === 0 ? 0 : 1);
}
console.log(`apply-rev32-i18n: ${totalChanges} locale file(s) written`);
