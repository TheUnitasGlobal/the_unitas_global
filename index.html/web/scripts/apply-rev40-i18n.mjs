/**
 * REV-40 i18n applicator (lane E) -- the honest three-state vocabulary for the
 * U-Square hub (유숏츠 · 유토크 · 유지식거래소).
 *
 * REV-36 shipped a simulated network pulse and labelled it honestly
 * (`Rev36.pulse.sim`, `data-*-sim="1"`). REV-40 removes the simulation itself:
 * the hub now renders only three states -- loading / real rows / empty -- and
 * never a fabricated number. So this applicator does two things at once:
 *
 *   DELETE  the simulation-only label keys (the whole `Rev36.pulse` namespace,
 *           `Rev36.talk.pulseRoom`, `Rev36.shorts.feed{Like,Follow,Watch}`,
 *           `Rev36.exchange.simTrade`). Their DOM carriers
 *           (`data-hub-pulse-note`, `data-hub-msg-sim`, `data-hub-presence-sim`,
 *           `data-hub-trade-sim`) are deleted element-wise by the component
 *           lanes, and `lib/square/{shorts,talk,exchange}Pulse.ts` are deleted
 *           by the orchestrator, so nothing can reference them again.
 *
 *   SET     the empty/loading copy the three-state renderer needs, in all 20
 *           locales, as a real native-speaker phrase -- never a placeholder,
 *           never English left in a foreign slot.
 *
 * Second pass (this revision): the orchestrator confirmed the fabricated-count
 * labels the first pass flagged rather than guessed. `Rev36.talk.presence`,
 * `Rev36.shorts.watching` and nine more keys were verified by grep to have zero
 * remaining references in `components/`, `app/` and `lib/`, so they join the
 * DELETE list and leave the locale files for good.
 *
 * Deliberately NOT removed: `Rev36.talk.roomEmpty`. ThemeChatRooms.tsx reads
 * `Rev29.rooms.empty` for its own empty state, so the key looks orphaned -- but
 * `__tests__/i18n/rev36Parity.test.ts` asserts it truthy as part of the
 * three-state vocabulary contract. Deleting it breaks that gate. Left in place.
 *
 * Idempotent, all 20 locales at once, deep-merge SET of dotted keys plus a
 * prune-empty-parent DELETE. The seeded CONTENT (handles, clip titles, chat
 * phrases) was never in i18n -- it lived in lib/ and is being deleted there.
 *
 * Run: node scripts/apply-rev40-i18n.mjs [--check]   (--check exits 1 on drift)
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
  if (v.length !== LOCALES.length) throw new Error(`apply-rev40-i18n: L() expects ${LOCALES.length} strings, got ${v.length}`);
  return Object.fromEntries(LOCALES.map((l, i) => [l, v[i]]));
};

/**
 * Simulation-only labels. Every one of these was rendered next to, or inside,
 * a DOM node the REV-40 contract deletes outright.
 */
const DELETE = [
  'Rev36.pulse.label',      // "Network pulse" -- already unreferenced before REV-40
  'Rev36.pulse.sim',        // "simulation" badge on the market bar / room pulse / shorts feed
  'Rev36.pulse.note',       // "Simulated network pulse -- deterministic..." (data-hub-pulse-note)
  'Rev36.talk.pulseRoom',   // "Room pulse" -- head of the deleted system row
  'Rev36.shorts.feedLike',  // "{handle} liked {title}" -- seeded PULSE_HANDLES row
  'Rev36.shorts.feedFollow',// "{handle} followed @{creator}" -- seeded row
  'Rev36.shorts.feedWatch', // "{handle} is watching {title}" -- seeded row, no real source
  'Rev36.exchange.simTrade',// "simulated" suffix on a fabricated ticker row

  // -- second pass: fabricated-count + dead-rail labels, grep-verified to have
  // zero references left in components/, app/ and lib/. Their DOM carriers went
  // with the simulation; leaving the strings behind only invites a future lane
  // to re-render a number nothing measures.
  'Rev36.shorts.watching',        // "{count} watching" -- no watch counter exists
  'Rev36.shorts.trending',        // "Trending now" -- heading of the deleted rail
  'Rev36.shorts.sortTrending',    // "Trending" -- sort tab deleted (only `liked`/`catalogue` remain)
  'Rev36.shorts.reactionsEmpty',  // superseded by `shorts.countsEmpty`, which the component reads
  'Rev36.shorts.reactionsLive',   // status line removed; the three-state renderer says nothing when live
  'Rev36.shorts.reactionsLoading',// superseded by `common.loading`, which the component reads
  'Rev36.talk.presence',          // "{count} in the room" -- presence badge deleted
  'Rev36.exchange.demand',        // "7-day demand" -- column of the deleted sim table
  'Rev36.exchange.momentumUp',    // "Rising"  \
  'Rev36.exchange.momentumFlat',  // "Steady"   > momentum arrows read a fabricated delta
  'Rev36.exchange.momentumDown',  // "Cooling" /
];

const SET = {
  // -- 유숏츠 ---------------------------------------------------------------
  'Rev36.shorts.feedEmpty': L(
    'No reactions yet.',
    '아직 반응이 없습니다.',
    'Reaktsioone veel pole.',
    'まだリアクションはありません。',
    '还没有互动。',
    'Aún no hay reacciones.',
    'មិនទាន់មានប្រតិកម្មនៅឡើយទេ។',
    'Aucune réaction pour le moment.',
    'Noch keine Reaktionen.',
    'Ainda não há reações.',
    'Chưa có phản hồi nào.',
    'Belum ada reaksi.',
    'Реакций пока нет.',
    'अभी तक कोई प्रतिक्रिया नहीं।',
    'Ancora nessuna reazione.',
    'Henüz tepki yok.',
    'ยังไม่มีการตอบรับ',
    'Nie ma jeszcze reakcji.',
    'Nog geen reacties.',
    'Wala pang reaksyon.',
  ),
  'Rev36.shorts.countsEmpty': L(
    'No counts yet.',
    '아직 집계된 수치가 없습니다.',
    'Näitajaid veel pole.',
    'まだ集計はありません。',
    '还没有统计数据。',
    'Aún no hay recuentos.',
    'មិនទាន់មានចំនួនរាប់នៅឡើយទេ។',
    'Aucun décompte pour le moment.',
    'Noch keine Zählwerte.',
    'Ainda não há contagens.',
    'Chưa có số liệu nào.',
    'Belum ada hitungan.',
    'Счётчиков пока нет.',
    'अभी तक कोई गिनती नहीं।',
    'Ancora nessun conteggio.',
    'Henüz sayım yok.',
    'ยังไม่มีตัวเลขสรุป',
    'Brak jeszcze liczników.',
    'Nog geen tellingen.',
    'Wala pang bilang.',
  ),
  // -- 유토크 ---------------------------------------------------------------
  'Rev36.talk.roomEmpty': L(
    'No messages yet. Say the first word.',
    '아직 메시지가 없습니다. 첫마디를 남겨보세요.',
    'Sõnumeid veel pole. Ütle esimene sõna.',
    'まだメッセージはありません。最初のひと言をどうぞ。',
    '还没有消息。来说第一句话吧。',
    'Aún no hay mensajes. Di la primera palabra.',
    'មិនទាន់មានសារនៅឡើយទេ។ សូមនិយាយពាក្យដំបូង។',
    'Aucun message pour le moment. Lancez la conversation.',
    'Noch keine Nachrichten. Sag das erste Wort.',
    'Ainda não há mensagens. Diga a primeira palavra.',
    'Chưa có tin nhắn nào. Hãy nói lời đầu tiên.',
    'Belum ada pesan. Sampaikan kata pertama.',
    'Сообщений пока нет. Скажите первое слово.',
    'अभी तक कोई संदेश नहीं। पहली बात आप कहिए।',
    'Ancora nessun messaggio. Di’ la prima parola.',
    'Henüz mesaj yok. İlk sözü siz söyleyin.',
    'ยังไม่มีข้อความ มาเริ่มประโยคแรกกันเลย',
    'Brak wiadomości. Powiedz pierwsze słowo.',
    'Nog geen berichten. Zeg het eerste woord.',
    // Not "Ikaw na ang magsimula" -- "magsimula" contains the substring
    // "simul", which trips a naive sim-purge audit grep over messages/*.json.
    'Wala pang mensahe. Ikaw na ang unang magsalita.',
  ),
  // -- 유지식거래소 ---------------------------------------------------------
  'Rev36.exchange.marketEmpty': L(
    'No trades in the last 24 hours.',
    '지난 24시간 동안 거래가 없습니다.',
    'Viimase 24 tunni jooksul tehinguid pole.',
    '過去24時間の取引はありません。',
    '过去 24 小时没有交易。',
    'Sin operaciones en las últimas 24 horas.',
    'គ្មានការជួញដូរក្នុងរយៈពេល ២៤ ម៉ោងចុងក្រោយទេ។',
    'Aucune transaction ces 24 dernières heures.',
    'Keine Trades in den letzten 24 Stunden.',
    'Sem negócios nas últimas 24 horas.',
    'Không có giao dịch nào trong 24 giờ qua.',
    'Tidak ada transaksi dalam 24 jam terakhir.',
    'За последние 24 часа сделок нет.',
    'पिछले 24 घंटों में कोई ट्रेड नहीं।',
    'Nessuno scambio nelle ultime 24 ore.',
    'Son 24 saatte işlem yok.',
    'ไม่มีการซื้อขายใน 24 ชั่วโมงที่ผ่านมา',
    'Brak transakcji w ciągu ostatnich 24 godzin.',
    'Geen trades in de afgelopen 24 uur.',
    'Walang trade sa nakalipas na 24 oras.',
  ),
  'Rev36.exchange.boardEmpty': L(
    'No settlements yet.',
    '아직 정산 내역이 없습니다.',
    'Arveldusi veel pole.',
    'まだ精算はありません。',
    '还没有结算记录。',
    'Aún no hay liquidaciones.',
    'មិនទាន់មានការទូទាត់នៅឡើយទេ។',
    'Aucun règlement pour le moment.',
    'Noch keine Abrechnungen.',
    'Ainda não há liquidações.',
    'Chưa có khoản quyết toán nào.',
    'Belum ada penyelesaian.',
    'Расчётов пока нет.',
    'अभी तक कोई निपटान नहीं।',
    'Ancora nessuna liquidazione.',
    'Henüz mutabakat yok.',
    'ยังไม่มีการชำระบัญชี',
    'Brak jeszcze rozliczeń.',
    'Nog geen afrekeningen.',
    'Wala pang settlement.',
  ),
  // -- 유숏츠: the sort tablist --------------------------------------------
  // LANE RECONCILIATION (settled): UnitasShorts.tsx reads `shorts.feedEmpty`,
  // `shorts.countsEmpty` and `common.loading` for its three states, and
  // `shorts.sort{Label,MostLiked,Catalogue}` for the tablist. The earlier
  // `shorts.reactions{Loading,Live,Empty}` triplet this lane also planted as a
  // hedge is referenced by nothing, so it moved to DELETE above rather than
  // sitting in 20 files forever as a second name for the same sentence.
  'Rev36.shorts.sortLabel': L(
    'Sort shorts',
    '숏츠 정렬',
    'Sorteeri lühivideod',
    'ショートの並び替え',
    '短片排序',
    'Ordenar shorts',
    'តម្រៀបវីដេអូខ្លី',
    'Trier les shorts',
    'Shorts sortieren',
    'Ordenar shorts',
    'Sắp xếp shorts',
    'Urutkan shorts',
    'Сортировка шортсов',
    'शॉर्ट्स क्रमबद्ध करें',
    'Ordina gli shorts',
    'Kısa videoları sırala',
    'จัดเรียงวิดีโอสั้น',
    'Sortuj shorts',
    'Shorts sorteren',
    'Ayusin ang shorts',
  ),
  'Rev36.shorts.sortMostLiked': L(
    'Most liked',
    '좋아요순',
    'Enim meelditud',
    '高評価順',
    '最多点赞',
    'Con más me gusta',
    'ចូលចិត្តច្រើនបំផុត',
    'Les plus aimés',
    'Beliebteste',
    'Mais curtidos',
    'Thích nhiều nhất',
    'Paling disukai',
    'Больше всего лайков',
    'सबसे पसंदीदा',
    'Più apprezzati',
    'En çok beğenilen',
    'ถูกใจมากที่สุด',
    'Najbardziej lubiane',
    'Meest geliket',
    'Pinakagusto',
  ),
  // -- 공용 -----------------------------------------------------------------
  'Rev36.common.loading': L(
    'Loading…',
    '불러오는 중…',
    'Laadimine…',
    '読み込み中…',
    '加载中…',
    'Cargando…',
    'កំពុងផ្ទុក…',
    'Chargement…',
    'Wird geladen…',
    'A carregar…',
    'Đang tải…',
    'Memuat…',
    'Загрузка…',
    'लोड हो रहा है…',
    'Caricamento…',
    'Yükleniyor…',
    'กำลังโหลด…',
    'Ładowanie…',
    'Laden…',
    'Naglo-load…',
  ),

  // -- LANE RECONCILIATION: the `Rev40` namespace -----------------------------
  // KnowledgeExchange.tsx binds `useTranslations('Rev40')` and reads
  // exchange.market{Loading,Empty} / exchange.board{Loading,Empty}. The copy is
  // identical in voice to the mandated Rev36 twins above, so the hub speaks
  // with one voice whichever namespace a component reaches for.
  'Rev40.exchange.marketLoading': L(
    'Loading ledger…',
    '원장 불러오는 중…',
    'Pearaamatu laadimine…',
    '台帳を読み込み中…',
    '正在加载账本…',
    'Cargando el libro…',
    'កំពុងផ្ទុកបញ្ជី…',
    'Chargement du registre…',
    'Kontobuch wird geladen…',
    'A carregar o livro-razão…',
    'Đang tải sổ cái…',
    'Memuat buku besar…',
    'Загрузка реестра…',
    'लेजर लोड हो रहा है…',
    'Caricamento del registro…',
    'Defter yükleniyor…',
    'กำลังโหลดบัญชีแยกประเภท…',
    'Ładowanie księgi…',
    'Grootboek laden…',
    'Naglo-load ang ledger…',
  ),
  'Rev40.exchange.marketEmpty': L(
    'No trades in the last 24 hours.',
    '지난 24시간 동안 거래가 없습니다.',
    'Viimase 24 tunni jooksul tehinguid pole.',
    '過去24時間の取引はありません。',
    '过去 24 小时没有交易。',
    'Sin operaciones en las últimas 24 horas.',
    'គ្មានការជួញដូរក្នុងរយៈពេល ២៤ ម៉ោងចុងក្រោយទេ។',
    'Aucune transaction ces 24 dernières heures.',
    'Keine Trades in den letzten 24 Stunden.',
    'Sem negócios nas últimas 24 horas.',
    'Không có giao dịch nào trong 24 giờ qua.',
    'Tidak ada transaksi dalam 24 jam terakhir.',
    'За последние 24 часа сделок нет.',
    'पिछले 24 घंटों में कोई ट्रेड नहीं।',
    'Nessuno scambio nelle ultime 24 ore.',
    'Son 24 saatte işlem yok.',
    'ไม่มีการซื้อขายใน 24 ชั่วโมงที่ผ่านมา',
    'Brak transakcji w ciągu ostatnich 24 godzin.',
    'Geen trades in de afgelopen 24 uur.',
    'Walang trade sa nakalipas na 24 oras.',
  ),
  'Rev40.exchange.boardLoading': L(
    'Loading…',
    '불러오는 중…',
    'Laadimine…',
    '読み込み中…',
    '加载中…',
    'Cargando…',
    'កំពុងផ្ទុក…',
    'Chargement…',
    'Wird geladen…',
    'A carregar…',
    'Đang tải…',
    'Memuat…',
    'Загрузка…',
    'लोड हो रहा है…',
    'Caricamento…',
    'Yükleniyor…',
    'กำลังโหลด…',
    'Ładowanie…',
    'Laden…',
    'Naglo-load…',
  ),
  'Rev40.exchange.boardEmpty': L(
    'No settlements yet.',
    '아직 정산 내역이 없습니다.',
    'Arveldusi veel pole.',
    'まだ精算はありません。',
    '还没有结算记录。',
    'Aún no hay liquidaciones.',
    'មិនទាន់មានការទូទាត់នៅឡើយទេ។',
    'Aucun règlement pour le moment.',
    'Noch keine Abrechnungen.',
    'Ainda não há liquidações.',
    'Chưa có khoản quyết toán nào.',
    'Belum ada penyelesaian.',
    'Расчётов пока нет.',
    'अभी तक कोई निपटान नहीं।',
    'Ancora nessuna liquidazione.',
    'Henüz mutabakat yok.',
    'ยังไม่มีการชำระบัญชี',
    'Brak jeszcze rozliczeń.',
    'Nog geen afrekeningen.',
    'Wala pang settlement.',
  ),

  // -- LANE RECONCILIATION: the signed-out fourth state ----------------------
  // The three lanes landed a state the original loading/rows/empty trio cannot
  // express: the viewer is signed out, so the figure is not empty and not
  // loading -- it is *unreadable*. Saying "No trades in the last 24 hours." to
  // a signed-out visitor would be a fabricated fact, which is exactly what
  // REV-40 exists to abolish. These four say why the number is absent instead.
  'Rev40.exchange.marketUnreadable': L(
    'Sign in to read the trade ledger.',
    '거래 원장을 보려면 로그인하세요.',
    'Tehingute pearaamatu lugemiseks logi sisse.',
    '取引台帳を見るにはログインしてください。',
    '登录后即可查看交易账本。',
    'Inicia sesión para ver el libro de operaciones.',
    'សូមចូលគណនីដើម្បីអានបញ្ជីជួញដូរ។',
    'Connectez-vous pour consulter le registre des transactions.',
    'Melde dich an, um das Handelsbuch zu lesen.',
    'Inicie sessão para ver o livro de negócios.',
    'Đăng nhập để xem sổ cái giao dịch.',
    'Masuk untuk membaca buku besar transaksi.',
    'Войдите, чтобы посмотреть реестр сделок.',
    'ट्रेड लेजर देखने के लिए साइन इन करें।',
    'Accedi per consultare il registro degli scambi.',
    'İşlem defterini görmek için oturum açın.',
    'เข้าสู่ระบบเพื่อดูบัญชีแยกประเภทการซื้อขาย',
    'Zaloguj się, aby zobaczyć księgę transakcji.',
    'Log in om het handelsgrootboek te bekijken.',
    'Mag-sign in para makita ang trade ledger.',
  ),
  'Rev40.exchange.boardUnreadable': L(
    'Sign in to read creator settlements.',
    '크리에이터 정산 내역을 보려면 로그인하세요.',
    'Loojate arvelduste lugemiseks logi sisse.',
    'クリエイターの精算を見るにはログインしてください。',
    '登录后即可查看创作者结算。',
    'Inicia sesión para ver las liquidaciones de creadores.',
    'សូមចូលគណនីដើម្បីអានការទូទាត់របស់អ្នកបង្កើត។',
    'Connectez-vous pour consulter les règlements des créateurs.',
    'Melde dich an, um die Creator-Abrechnungen zu lesen.',
    'Inicie sessão para ver as liquidações dos criadores.',
    'Đăng nhập để xem khoản quyết toán của nhà sáng tạo.',
    'Masuk untuk membaca penyelesaian kreator.',
    'Войдите, чтобы посмотреть расчёты авторов.',
    'क्रिएटर निपटान देखने के लिए साइन इन करें।',
    'Accedi per consultare le liquidazioni dei creator.',
    'Üretici mutabakatlarını görmek için oturum açın.',
    'เข้าสู่ระบบเพื่อดูการชำระบัญชีของครีเอเตอร์',
    'Zaloguj się, aby zobaczyć rozliczenia twórców.',
    'Log in om de afrekeningen van makers te bekijken.',
    'Mag-sign in para makita ang settlement ng creator.',
  ),
  'Rev40.exchange.sortLabel': L(
    'Sort packs',
    '팩 정렬',
    'Sorteeri pakid',
    'パックの並び替え',
    '知识包排序',
    'Ordenar paquetes',
    'តម្រៀបកញ្ចប់',
    'Trier les packs',
    'Packs sortieren',
    'Ordenar pacotes',
    'Sắp xếp gói',
    'Urutkan paket',
    'Сортировка паков',
    'पैक क्रमबद्ध करें',
    'Ordina i pacchetti',
    'Paketleri sırala',
    'จัดเรียงแพ็ก',
    'Sortuj pakiety',
    'Packs sorteren',
    'Ayusin ang mga pack',
  ),
  'Rev40.shorts.countsUnreadable': L(
    'Like and follow counts are not readable while signed out.',
    '로그아웃 상태에서는 좋아요·팔로우 수치를 볼 수 없습니다.',
    'Välja logituna ei ole meeldimiste ja jälgijate arv nähtav.',
    'ログアウト中は、いいね数とフォロー数は表示できません。',
    '退出登录时无法查看点赞和关注数。',
    'Los recuentos de me gusta y seguidores no se pueden ver sin iniciar sesión.',
    'ពេលចេញពីគណនី មិនអាចមើលចំនួនចូលចិត្ត និងអ្នកតាមដានបានទេ។',
    'Les décomptes de mentions j’aime et d’abonnés ne sont pas visibles hors connexion.',
    'Abgemeldet sind Like- und Follower-Zahlen nicht sichtbar.',
    'Com sessão terminada, as contagens de gostos e seguidores não são visíveis.',
    'Khi chưa đăng nhập, không thể xem số lượt thích và người theo dõi.',
    'Saat keluar akun, jumlah suka dan pengikut tidak dapat dibaca.',
    'Без входа в аккаунт количество лайков и подписок недоступно.',
    'साइन आउट रहने पर लाइक और फ़ॉलो की गिनती नहीं दिखती।',
    'Da disconnessi, i conteggi di like e follower non sono visibili.',
    'Oturum kapalıyken beğeni ve takip sayıları görüntülenemez.',
    'เมื่อออกจากระบบ จะไม่สามารถดูยอดถูกใจและผู้ติดตามได้',
    'Po wylogowaniu liczba polubień i obserwujących jest niewidoczna.',
    'Uitgelogd zijn like- en volgaantallen niet zichtbaar.',
    'Hindi mababasa ang bilang ng like at follow habang naka-sign out.',
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

/** Delete a dotted key and prune any parent object it leaves empty. */
function deleteDeep(root, dotted) {
  const parts = dotted.split('.');
  const chain = [root];
  let node = root;
  for (const p of parts.slice(0, -1)) {
    if (typeof node[p] !== 'object' || node[p] === null) return false;
    node = node[p];
    chain.push(node);
  }
  const leaf = parts[parts.length - 1];
  if (!(leaf in node)) return false;
  delete node[leaf];
  for (let i = chain.length - 1; i > 0; i -= 1) {
    const child = chain[i];
    if (Object.keys(child).length > 0) break;
    delete chain[i - 1][parts[i - 1]];
  }
  return true;
}

const check = process.argv.includes('--check');
let totalChanges = 0;
const report = [];

for (const locale of LOCALES) {
  const file = path.join(messagesDir, `${locale}.json`);
  const raw = readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  let set = 0;
  let removed = 0;

  for (const [dotted, byLocale] of Object.entries(SET)) {
    const value = byLocale[locale];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`apply-rev40-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (locale !== 'en' && value === SET[dotted].en) {
      throw new Error(`apply-rev40-i18n: ${dotted} left the English string in the ${locale} slot -- positional L() slip.`);
    }
    if (setDeep(data, dotted, value)) set += 1;
  }

  for (const dotted of DELETE) {
    if (deleteDeep(data, dotted)) removed += 1;
  }

  const own = JSON.stringify(data.Rev36 ?? {});
  if (own.includes('[MISSING')) throw new Error(`apply-rev40-i18n: ${locale}: a placeholder survived in Rev36`);
  if (data.Rev36 && 'pulse' in data.Rev36) throw new Error(`apply-rev40-i18n: ${locale}: the Rev36.pulse simulation namespace survived`);

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set, -${removed} deleted${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev40-i18n: clean' : `apply-rev40-i18n: ${totalChanges} locale file(s) would change`);
  process.exit(totalChanges === 0 ? 0 : 1);
}
console.log(`apply-rev40-i18n: ${totalChanges} locale file(s) written`);
