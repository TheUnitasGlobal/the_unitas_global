/**
 * REV-30 i18n applicator (founder directive 2026-09-15).
 *
 * One new namespace, `Rev30`, shared by every hub surface that can now talk
 * to a server: which ledger is in force, whether a room's messages survive
 * the device, and one vocabulary for the six ways a server call can refuse.
 * Sharing the refusal strings is the point -- "이미 보유한 팩입니다" should
 * read identically wherever it is raised.
 *
 * Idempotent, all 20 locales, a REAL translation per locale (never a
 * "[MISSING:en]" placeholder -- that is what `i18n-sync.ts` would leave).
 *
 * Run: node scripts/apply-rev30-i18n.mjs [--check]
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
  if (v.length !== LOCALES.length) throw new Error(`apply-rev30-i18n: L() expects ${LOCALES.length} strings, got ${v.length}`);
  return Object.fromEntries(LOCALES.map((l, i) => [l, v[i]]));
};

const SET = {
  // -- which ledger is in force ----------------------------------------
  'Rev30.ledger.server': L(
    'Account ledger', '계정 원장', 'Konto pearaamat', 'アカウント台帳', '账户账本', 'Libro de la cuenta', 'សៀវភៅគណនី',
    'Registre du compte', 'Konto-Ledger', 'Livro da conta', 'Sổ tài khoản', 'Buku akun', 'Реестр аккаунта',
    'खाता बही', 'Registro account', 'Hesap defteri', 'บัญชีแยกประเภทของบัญชี', 'Księga konta', 'Accountgrootboek', 'Ledger ng account',
  ),
  'Rev30.ledger.device': L(
    'This device', '이 기기', 'See seade', 'この端末', '本设备', 'Este dispositivo', 'ឧបករណ៍នេះ',
    'Cet appareil', 'Dieses Gerät', 'Este dispositivo', 'Thiết bị này', 'Perangkat ini', 'Это устройство',
    'यह डिवाइस', 'Questo dispositivo', 'Bu cihaz', 'อุปกรณ์นี้', 'To urządzenie', 'Dit apparaat', 'Ang device na ito',
  ),
  'Rev30.ledger.serverNote': L(
    'Credits, purchases and listings are kept on your account · U-COIN settlement opens with the payout job.',
    '크레딧·구매·등록이 계정에 보관됩니다 · U-COIN 정산은 지급 작업과 함께 열립니다.',
    'Krediidid, ostud ja pakkumised hoitakse sinu kontol · U-COINi arveldus avaneb koos väljamaksetööga.',
    'クレジット・購入・出品はアカウントに保管されます · U-COIN決済は支払いジョブとともに開始されます。',
    '积分、购买与上架保存在你的账户 · U-COIN 结算将随支付作业开放。',
    'Créditos, compras y publicaciones se guardan en tu cuenta · La liquidación en U-COIN abre con el proceso de pago.',
    'ឥណទាន ការទិញ និងការដាក់លក់ ត្រូវបានរក្សាទុកក្នុងគណនីរបស់អ្នក · ការទូទាត់ U-COIN នឹងបើកជាមួយការងារបង់ប្រាក់។',
    'Crédits, achats et publications sont conservés sur votre compte · Le règlement en U-COIN ouvrira avec le versement.',
    'Credits, Käufe und Angebote liegen auf deinem Konto · Die U-COIN-Abrechnung öffnet mit dem Auszahlungsjob.',
    'Créditos, compras e publicações ficam na sua conta · A liquidação em U-COIN abre com o processo de pagamento.',
    'Tín dụng, giao dịch và tin đăng được lưu trên tài khoản của bạn · Thanh toán U-COIN sẽ mở cùng tác vụ chi trả.',
    'Kredit, pembelian, dan daftar tersimpan di akunmu · Penyelesaian U-COIN dibuka bersama proses pembayaran.',
    'Кредиты, покупки и лоты хранятся в вашем аккаунте · Расчёт в U-COIN откроется вместе с выплатой.',
    'क्रेडिट, खरीद और लिस्टिंग आपके खाते में रखे जाते हैं · U-COIN निपटान भुगतान कार्य के साथ खुलेगा।',
    'Crediti, acquisti e pubblicazioni restano sul tuo account · Il regolamento in U-COIN apre con il pagamento.',
    'Krediler, satın alımlar ve listeler hesabında tutulur · U-COIN takası ödeme işiyle açılır.',
    'เครดิต การซื้อ และรายการลงขายถูกเก็บในบัญชีของคุณ · การชำระ U-COIN จะเปิดพร้อมงานจ่ายเงิน',
    'Kredyty, zakupy i oferty są w Twoim koncie · Rozliczenie w U-COIN otworzy się wraz z wypłatą.',
    'Credits, aankopen en aanbiedingen staan op je account · U-COIN-afrekening opent met de uitbetaling.',
    'Nasa account mo ang credits, binili at listing · Bubukas ang U-COIN settlement kasama ang payout job.',
  ),

  // -- room durability --------------------------------------------------
  'Rev30.room.durable': L(
    'Saved to your account', '계정에 저장됨', 'Salvestatud kontole', 'アカウントに保存', '已保存到账户',
    'Guardado en tu cuenta', 'រក្សាទុកក្នុងគណនី', 'Enregistré sur le compte', 'Im Konto gespeichert',
    'Guardado na conta', 'Đã lưu vào tài khoản', 'Tersimpan di akun', 'Сохранено в аккаунте',
    'खाते में सहेजा गया', 'Salvato sull’account', 'Hesaba kaydedildi', 'บันทึกในบัญชีแล้ว',
    'Zapisano na koncie', 'Opgeslagen op je account', 'Naka-save sa account',
  ),
  'Rev30.room.deviceOnly': L(
    'This device only', '이 기기에만', 'Ainult sellel seadmel', 'この端末のみ', '仅本设备',
    'Solo este dispositivo', 'តែឧបករណ៍នេះ', 'Cet appareil seulement', 'Nur auf diesem Gerät',
    'Só neste dispositivo', 'Chỉ trên thiết bị này', 'Hanya di perangkat ini', 'Только на этом устройстве',
    'केवल इस डिवाइस पर', 'Solo su questo dispositivo', 'Yalnızca bu cihazda', 'เฉพาะอุปกรณ์นี้',
    'Tylko na tym urządzeniu', 'Alleen op dit apparaat', 'Sa device na ito lang',
  ),

  // -- the six server outcomes -----------------------------------------
  'Rev30.error.unauthenticated': L(
    'Sign in to use the account ledger.', '계정 원장을 쓰려면 로그인하세요.', 'Konto pearaamatu kasutamiseks logi sisse.',
    'アカウント台帳を使うにはログインしてください。', '请登录后使用账户账本。', 'Inicia sesión para usar el libro de la cuenta.',
    'សូមចូលគណនីដើម្បីប្រើសៀវភៅគណនី។', 'Connectez-vous pour utiliser le registre du compte.',
    'Melde dich an, um den Konto-Ledger zu nutzen.', 'Inicie sessão para usar o livro da conta.',
    'Đăng nhập để dùng sổ tài khoản.', 'Masuk untuk memakai buku akun.', 'Войдите, чтобы использовать реестр аккаунта.',
    'खाता बही उपयोग करने के लिए साइन इन करें।', 'Accedi per usare il registro account.',
    'Hesap defterini kullanmak için giriş yap.', 'เข้าสู่ระบบเพื่อใช้บัญชีแยกประเภท', 'Zaloguj się, aby użyć księgi konta.',
    'Log in om het accountgrootboek te gebruiken.', 'Mag-sign in para gamitin ang ledger ng account.',
  ),
  'Rev30.error.owned': L(
    'You already own this pack.', '이미 보유한 팩입니다.', 'See pakk on sul juba olemas.', 'このパックはすでに保有しています。',
    '你已经拥有这个知识包。', 'Ya tienes este pack.', 'អ្នកមានកញ្ចប់នេះរួចហើយ។', 'Vous possédez déjà ce pack.',
    'Du besitzt dieses Paket bereits.', 'Já tem este pack.', 'Bạn đã sở hữu gói này.', 'Kamu sudah memiliki paket ini.',
    'Этот пакет у вас уже есть.', 'यह पैक आपके पास पहले से है।', 'Possiedi già questo pack.',
    'Bu pakete zaten sahipsin.', 'คุณมีแพ็กนี้อยู่แล้ว', 'Masz już ten pakiet.', 'Je hebt dit pakket al.', 'Meron ka na nitong pack.',
  ),
  'Rev30.error.insufficient': L(
    'Not enough credits for that pack.', '이 팩을 사기엔 크레딧이 부족합니다.', 'Selle paki jaoks napib krediite.',
    'このパックを買うにはクレジットが足りません。', '积分不足，无法购买该知识包。', 'No tienes créditos suficientes para ese pack.',
    'ឥណទានមិនគ្រប់សម្រាប់កញ្ចប់នេះទេ។', 'Crédits insuffisants pour ce pack.', 'Zu wenig Credits für dieses Paket.',
    'Créditos insuficientes para esse pack.', 'Không đủ tín dụng cho gói này.', 'Kredit tidak cukup untuk paket itu.',
    'Недостаточно кредитов для этого пакета.', 'इस पैक के लिए पर्याप्त क्रेडिट नहीं हैं।', 'Crediti insufficienti per quel pack.',
    'Bu paket için kredin yetmiyor.', 'เครดิตไม่พอสำหรับแพ็กนี้', 'Za mało kredytów na ten pakiet.',
    'Te weinig credits voor dit pakket.', 'Kulang ang credits para sa pack na iyan.',
  ),
  'Rev30.error.too-fast': L(
    'A moment between messages, please.', '메시지 사이에 잠깐만 쉬어 주세요.', 'Palun hetk sõnumite vahel.',
    'メッセージの間隔を少し空けてください。', '两条消息之间请稍等片刻。', 'Un momento entre mensajes, por favor.',
    'សូមរង់ចាំបន្តិចរវាងសារ។', 'Un instant entre deux messages, s’il vous plaît.', 'Bitte einen Moment zwischen den Nachrichten.',
    'Um momento entre mensagens, por favor.', 'Vui lòng chờ một chút giữa các tin nhắn.', 'Mohon jeda sejenak antar pesan.',
    'Пожалуйста, небольшая пауза между сообщениями.', 'कृपया संदेशों के बीच थोड़ा रुकें।',
    'Un attimo tra un messaggio e l’altro, per favore.', 'Mesajlar arasında biraz ara ver.',
    'โปรดเว้นช่วงระหว่างข้อความสักครู่', 'Chwila przerwy między wiadomościami.',
    'Even wachten tussen berichten, alsjeblieft.', 'Sandaling paghinto sa pagitan ng mga mensahe.',
  ),
  'Rev30.error.rejected': L(
    'The server refused that. Nothing was changed.', '서버가 거절했습니다. 아무것도 바뀌지 않았습니다.',
    'Server keeldus. Midagi ei muudetud.', 'サーバーが拒否しました。何も変更されていません。', '服务器已拒绝，未做任何更改。',
    'El servidor lo rechazó. No se cambió nada.', 'ម៉ាស៊ីនមេបានបដិសេធ។ គ្មានអ្វីផ្លាស់ប្តូរទេ។',
    'Le serveur a refusé. Rien n’a été modifié.', 'Der Server hat abgelehnt. Nichts wurde geändert.',
    'O servidor recusou. Nada foi alterado.', 'Máy chủ đã từ chối. Không có gì thay đổi.',
    'Server menolak. Tidak ada yang berubah.', 'Сервер отклонил. Ничего не изменилось.',
    'सर्वर ने अस्वीकार किया। कुछ नहीं बदला।', 'Il server ha rifiutato. Nulla è stato modificato.',
    'Sunucu reddetti. Hiçbir şey değişmedi.', 'เซิร์ฟเวอร์ปฏิเสธ ไม่มีอะไรเปลี่ยนแปลง',
    'Serwer odmówił. Nic nie zostało zmienione.', 'De server weigerde. Er is niets gewijzigd.',
    'Tinanggihan ng server. Walang nabago.',
  ),
  'Rev30.error.offline': L(
    'No connection — this device is keeping the record.', '연결 없음 — 이 기기가 기록을 보관합니다.',
    'Ühendust pole — kirjet hoiab see seade.', '接続なし — この端末が記録を保持します。', '无连接 — 由本设备保存记录。',
    'Sin conexión: este dispositivo guarda el registro.', 'គ្មានការតភ្ជាប់ — ឧបករណ៍នេះរក្សាកំណត់ត្រា។',
    'Pas de connexion — cet appareil conserve l’enregistrement.', 'Keine Verbindung — dieses Gerät führt den Eintrag.',
    'Sem ligação — este dispositivo guarda o registo.', 'Không có kết nối — thiết bị này giữ bản ghi.',
    'Tidak ada koneksi — perangkat ini menyimpan catatannya.', 'Нет соединения — запись хранит это устройство.',
    'कोई कनेक्शन नहीं — यह डिवाइस रिकॉर्ड रख रहा है।', 'Nessuna connessione — il registro resta su questo dispositivo.',
    'Bağlantı yok — kaydı bu cihaz tutuyor.', 'ไม่มีการเชื่อมต่อ — อุปกรณ์นี้เก็บบันทึกไว้',
    'Brak połączenia — zapis prowadzi to urządzenie.', 'Geen verbinding — dit apparaat houdt de registratie bij.',
    'Walang koneksyon — ang device na ito ang nag-iingat ng record.',
  ),
};

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
      throw new Error(`apply-rev30-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (setDeep(data, dotted, value)) set += 1;
  }

  const rev30 = JSON.stringify(getDeep(data, 'Rev30'));
  if (rev30.includes('[MISSING')) throw new Error(`apply-rev30-i18n: ${locale}: a placeholder survived in Rev30`);

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev30-i18n: clean' : `apply-rev30-i18n: ${totalChanges} locale file(s) would change`);
  process.exit(totalChanges === 0 ? 0 : 1);
}
console.log(`apply-rev30-i18n: wrote ${totalChanges} locale file(s)`);
