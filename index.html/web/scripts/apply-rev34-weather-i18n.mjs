/**
 * REV-34 lane S2 i18n applicator (founder directive 2026-09-16, M1-A).
 *
 * The weather deep popup's copy -- section labels, the radar scrubber, the
 * UV bands, the extended current-conditions row -- lives under ONE new
 * sub-namespace, `Rev34.weather.*`, so no parity gate on an older namespace
 * moves: `Rev20` stays at its 76 pinned keys (the aqi bands and the weather
 * title / tag are REUSED from there, never re-added), `Weather.*` keeps its
 * existing keys (feelsLike / humidity / wind / error are reused too) and
 * `Rev21.*` is untouched.
 *
 * Idempotent, all 20 locales at once, a REAL translation per locale -- never a
 * placeholder. Deep-merge SET of dotted keys only: the `Rev34` object is never
 * replaced (other REV-34 lanes write their own sub-namespaces into the same
 * files) and nothing is ever deleted.
 *
 * Run: node scripts/apply-rev34-weather-i18n.mjs [--check]
 *   --check exits 1 if any locale file would change.
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
  if (v.length !== LOCALES.length) throw new Error(`apply-rev34-weather-i18n: L() expects ${LOCALES.length} strings, got ${v.length}`);
  return Object.fromEntries(LOCALES.map((l, i) => [l, v[i]]));
};

/** "Now" is used twice (the hourly rail's first cell and the radar's latest
 *  observation) -- one translation set, two keys, so they can never drift. */
const NOW = L(
  'Now', '현재', 'Praegu', '現在', '现在', 'Ahora', 'ឥឡូវនេះ', 'Maintenant', 'Jetzt', 'Agora',
  'Bây giờ', 'Sekarang', 'Сейчас', 'अभी', 'Adesso', 'Şimdi', 'ตอนนี้', 'Teraz', 'Nu', 'Ngayon',
);

const SET = {
  'Rev34.weather.hourlyLabel': L(
    'Next 24 hours', '24시간 예보', 'Järgmised 24 tundi', '今後24時間', '未来24小时', 'Próximas 24 horas', '២៤ ម៉ោងបន្ទាប់',
    'Prochaines 24 heures', 'Nächste 24 Stunden', 'Próximas 24 horas', '24 giờ tới', '24 jam ke depan', 'Ближайшие 24 часа',
    'अगले 24 घंटे', 'Prossime 24 ore', 'Sonraki 24 saat', '24 ชั่วโมงข้างหน้า', 'Najbliższe 24 godziny', 'Komende 24 uur', 'Susunod na 24 oras',
  ),
  'Rev34.weather.dailyLabel': L(
    '7-day outlook', '7일 예보', '7 päeva prognoos', '7日間予報', '7天预报', 'Pronóstico de 7 días', 'ការព្យាករណ៍ ៧ ថ្ងៃ',
    'Prévisions sur 7 jours', '7-Tage-Vorschau', 'Previsão de 7 dias', 'Dự báo 7 ngày', 'Prakiraan 7 hari', 'Прогноз на 7 дней',
    '7-दिन का पूर्वानुमान', 'Previsioni a 7 giorni', '7 günlük tahmin', 'พยากรณ์ 7 วัน', 'Prognoza 7-dniowa', '7-daagse verwachting', '7-araw na pagtaya',
  ),
  'Rev34.weather.radarLabel': L(
    'Rain radar', '기상 레이더', 'Vihmaradar', '雨雲レーダー', '降水雷达', 'Radar de lluvia', 'រ៉ាដាភ្លៀង',
    'Radar de pluie', 'Regenradar', 'Radar de chuva', 'Radar mưa', 'Radar hujan', 'Радар осадков',
    'वर्षा रडार', 'Radar pioggia', 'Yağış radarı', 'เรดาร์ฝน', 'Radar opadów', 'Regenradar', 'Radar ng ulan',
  ),
  'Rev34.weather.radarPast': L(
    'Past', '지난', 'Möödunud', '過去', '过去', 'Pasado', 'កន្លងមក',
    'Passé', 'Vergangen', 'Passado', 'Đã qua', 'Lalu', 'Прошлое',
    'बीता हुआ', 'Passato', 'Geçmiş', 'ที่ผ่านมา', 'Minione', 'Verleden', 'Nakaraan',
  ),
  'Rev34.weather.radarNow': NOW,
  'Rev34.weather.radarNowcast': L(
    'Nowcast', '초단기 예측', 'Lähiprognoos', '直近予測', '临近预报', 'Pronóstico inmediato', 'ការព្យាករណ៍រយៈពេលខ្លី',
    'Prévision immédiate', 'Kurzfristvorhersage', 'Previsão imediata', 'Dự báo tức thời', 'Prakiraan segera', 'Наукастинг',
    'तात्कालिक पूर्वानुमान', 'Previsione immediata', 'Çok kısa vadeli tahmin', 'พยากรณ์ระยะสั้น', 'Prognoza krótkoterminowa', 'Kortetermijnverwachting', 'Agarang pagtaya',
  ),
  'Rev34.weather.radarPlay': L(
    'Play', '재생', 'Esita', '再生', '播放', 'Reproducir', 'ចាក់',
    'Lecture', 'Abspielen', 'Reproduzir', 'Phát', 'Putar', 'Воспроизвести',
    'चलाएं', 'Riproduci', 'Oynat', 'เล่น', 'Odtwórz', 'Afspelen', 'I-play',
  ),
  'Rev34.weather.radarPause': L(
    'Pause', '일시정지', 'Paus', '一時停止', '暂停', 'Pausar', 'ផ្អាក',
    'Pause', 'Pause', 'Pausar', 'Tạm dừng', 'Jeda', 'Пауза',
    'रोकें', 'Pausa', 'Duraklat', 'หยุดชั่วคราว', 'Pauza', 'Pauzeren', 'I-pause',
  ),
  'Rev34.weather.radarSource': L(
    'Radar: RainViewer · Map © OpenStreetMap contributors, © CARTO',
    '레이더: RainViewer · 지도 © OpenStreetMap 기여자, © CARTO',
    'Radar: RainViewer · Kaart © OpenStreetMapi kaastöölised, © CARTO',
    'レーダー: RainViewer · 地図 © OpenStreetMap 貢献者, © CARTO',
    '雷达：RainViewer · 地图 © OpenStreetMap 贡献者，© CARTO',
    'Radar: RainViewer · Mapa © colaboradores de OpenStreetMap, © CARTO',
    'រ៉ាដា៖ RainViewer · ផែនទី © អ្នករួមចំណែក OpenStreetMap, © CARTO',
    'Radar : RainViewer · Carte © contributeurs OpenStreetMap, © CARTO',
    'Radar: RainViewer · Karte © OpenStreetMap-Mitwirkende, © CARTO',
    'Radar: RainViewer · Mapa © colaboradores do OpenStreetMap, © CARTO',
    'Radar: RainViewer · Bản đồ © cộng tác viên OpenStreetMap, © CARTO',
    'Radar: RainViewer · Peta © kontributor OpenStreetMap, © CARTO',
    'Радар: RainViewer · Карта © участники OpenStreetMap, © CARTO',
    'रडार: RainViewer · मानचित्र © OpenStreetMap योगदानकर्ता, © CARTO',
    'Radar: RainViewer · Mappa © collaboratori di OpenStreetMap, © CARTO',
    'Radar: RainViewer · Harita © OpenStreetMap katkıda bulunanlar, © CARTO',
    'เรดาร์: RainViewer · แผนที่ © ผู้ร่วมสร้าง OpenStreetMap, © CARTO',
    'Radar: RainViewer · Mapa © współtwórcy OpenStreetMap, © CARTO',
    'Radar: RainViewer · Kaart © OpenStreetMap-bijdragers, © CARTO',
    'Radar: RainViewer · Mapa © mga kontribyutor ng OpenStreetMap, © CARTO',
  ),
  'Rev34.weather.radarUnavailable': L(
    'Radar is unavailable right now.', '지금은 레이더를 불러올 수 없습니다.', 'Radar pole praegu saadaval.', '現在レーダーを利用できません。', '雷达暂时不可用。',
    'El radar no está disponible ahora mismo.', 'រ៉ាដាមិនអាចប្រើបានឥឡូវនេះទេ។', 'Le radar est indisponible pour le moment.', 'Das Radar ist derzeit nicht verfügbar.',
    'O radar está indisponível neste momento.', 'Radar hiện không khả dụng.', 'Radar sedang tidak tersedia.', 'Радар сейчас недоступен.',
    'रडार अभी उपलब्ध नहीं है।', 'Il radar non è disponibile al momento.', 'Radar şu anda kullanılamıyor.', 'เรดาร์ไม่พร้อมใช้งานในขณะนี้',
    'Radar jest teraz niedostępny.', 'De radar is momenteel niet beschikbaar.', 'Hindi available ang radar sa ngayon.',
  ),
  'Rev34.weather.uv': L(
    'UV index', '자외선 지수', 'UV-indeks', 'UV指数', '紫外线指数', 'Índice UV', 'សន្ទស្សន៍ UV',
    'Indice UV', 'UV-Index', 'Índice UV', 'Chỉ số UV', 'Indeks UV', 'УФ-индекс',
    'यूवी सूचकांक', 'Indice UV', 'UV indeksi', 'ดัชนี UV', 'Indeks UV', 'UV-index', 'UV index',
  ),
  'Rev34.weather.uvBand.low': L(
    'Low', '낮음', 'Madal', '弱い', '低', 'Bajo', 'ទាប',
    'Faible', 'Niedrig', 'Baixo', 'Thấp', 'Rendah', 'Низкий',
    'कम', 'Basso', 'Düşük', 'ต่ำ', 'Niski', 'Laag', 'Mababa',
  ),
  'Rev34.weather.uvBand.moderate': L(
    'Moderate', '보통', 'Mõõdukas', '中程度', '中等', 'Moderado', 'មធ្យម',
    'Modéré', 'Mäßig', 'Moderado', 'Trung bình', 'Sedang', 'Умеренный',
    'मध्यम', 'Moderato', 'Orta', 'ปานกลาง', 'Umiarkowany', 'Matig', 'Katamtaman',
  ),
  'Rev34.weather.uvBand.high': L(
    'High', '높음', 'Kõrge', '強い', '高', 'Alto', 'ខ្ពស់',
    'Élevé', 'Hoch', 'Alto', 'Cao', 'Tinggi', 'Высокий',
    'उच्च', 'Alto', 'Yüksek', 'สูง', 'Wysoki', 'Hoog', 'Mataas',
  ),
  'Rev34.weather.uvBand.veryHigh': L(
    'Very high', '매우 높음', 'Väga kõrge', '非常に強い', '很高', 'Muy alto', 'ខ្ពស់ណាស់',
    'Très élevé', 'Sehr hoch', 'Muito alto', 'Rất cao', 'Sangat tinggi', 'Очень высокий',
    'बहुत उच्च', 'Molto alto', 'Çok yüksek', 'สูงมาก', 'Bardzo wysoki', 'Zeer hoog', 'Napakataas',
  ),
  'Rev34.weather.uvBand.extreme': L(
    'Extreme', '위험', 'Ekstreemne', '極端に強い', '极高', 'Extremo', 'ខ្លាំងបំផុត',
    'Extrême', 'Extrem', 'Extremo', 'Cực cao', 'Ekstrem', 'Экстремальный',
    'अत्यधिक', 'Estremo', 'Aşırı', 'รุนแรง', 'Ekstremalny', 'Extreem', 'Sukdulan',
  ),
  'Rev34.weather.windDir': L(
    'Wind direction', '풍향', 'Tuule suund', '風向', '风向', 'Dirección del viento', 'ទិសខ្យល់',
    'Direction du vent', 'Windrichtung', 'Direção do vento', 'Hướng gió', 'Arah angin', 'Направление ветра',
    'हवा की दिशा', 'Direzione del vento', 'Rüzgar yönü', 'ทิศทางลม', 'Kierunek wiatru', 'Windrichting', 'Direksyon ng hangin',
  ),
  'Rev34.weather.gust': L(
    'Gusts', '돌풍', 'Puhangud', '突風', '阵风', 'Ráfagas', 'ខ្យល់កន្ត្រាក់',
    'Rafales', 'Böen', 'Rajadas', 'Gió giật', 'Hembusan', 'Порывы',
    'झोंके', 'Raffiche', 'Rüzgar hamlesi', 'ลมกระโชก', 'Porywy', 'Windstoten', 'Bugso ng hangin',
  ),
  'Rev34.weather.precip': L(
    'Precipitation', '강수량', 'Sademed', '降水量', '降水量', 'Precipitación', 'បរិមាណទឹកភ្លៀង',
    'Précipitations', 'Niederschlag', 'Precipitação', 'Lượng mưa', 'Curah hujan', 'Осадки',
    'वर्षा', 'Precipitazioni', 'Yağış', 'ปริมาณน้ำฝน', 'Opady', 'Neerslag', 'Pag-ulan',
  ),
  'Rev34.weather.precipProb': L(
    'Chance of rain', '강수 확률', 'Sademete tõenäosus', '降水確率', '降水概率', 'Probabilidad de lluvia', 'ប្រូបាប៊ីលីតេភ្លៀង',
    'Risque de pluie', 'Regenwahrscheinlichkeit', 'Probabilidade de chuva', 'Xác suất mưa', 'Peluang hujan', 'Вероятность осадков',
    'वर्षा की संभावना', 'Probabilità di pioggia', 'Yağış olasılığı', 'โอกาสฝนตก', 'Szansa opadów', 'Kans op regen', 'Tsansa ng ulan',
  ),
  'Rev34.weather.sunrise': L(
    'Sunrise', '일출', 'Päikesetõus', '日の出', '日出', 'Amanecer', 'ថ្ងៃរះ',
    'Lever du soleil', 'Sonnenaufgang', 'Nascer do sol', 'Mặt trời mọc', 'Matahari terbit', 'Восход',
    'सूर्योदय', 'Alba', 'Gün doğumu', 'พระอาทิตย์ขึ้น', 'Wschód słońca', 'Zonsopgang', 'Pagsikat ng araw',
  ),
  'Rev34.weather.sunset': L(
    'Sunset', '일몰', 'Päikeseloojang', '日の入り', '日落', 'Atardecer', 'ថ្ងៃលិច',
    'Coucher du soleil', 'Sonnenuntergang', 'Pôr do sol', 'Mặt trời lặn', 'Matahari terbenam', 'Закат',
    'सूर्यास्त', 'Tramonto', 'Gün batımı', 'พระอาทิตย์ตก', 'Zachód słońca', 'Zonsondergang', 'Paglubog ng araw',
  ),
  'Rev34.weather.aqiLabel': L(
    'Air quality', '대기질', 'Õhukvaliteet', '大気質', '空气质量', 'Calidad del aire', 'គុណភាពខ្យល់',
    "Qualité de l'air", 'Luftqualität', 'Qualidade do ar', 'Chất lượng không khí', 'Kualitas udara', 'Качество воздуха',
    'वायु गुणवत्ता', "Qualità dell'aria", 'Hava kalitesi', 'คุณภาพอากาศ', 'Jakość powietrza', 'Luchtkwaliteit', 'Kalidad ng hangin',
  ),
  'Rev34.weather.loading': L(
    'Loading the deep forecast…', '심층 예보를 불러오는 중…', 'Laadin põhjalikku prognoosi…', '詳細予報を読み込み中…', '正在加载详细预报…',
    'Cargando el pronóstico detallado…', 'កំពុងផ្ទុកការព្យាករណ៍លម្អិត…', 'Chargement des prévisions détaillées…', 'Detailprognose wird geladen…',
    'A carregar a previsão detalhada…', 'Đang tải dự báo chi tiết…', 'Memuat prakiraan mendalam…', 'Загружаем подробный прогноз…',
    'विस्तृत पूर्वानुमान लोड हो रहा है…', 'Caricamento delle previsioni dettagliate…', 'Ayrıntılı tahmin yükleniyor…', 'กำลังโหลดพยากรณ์เชิงลึก…',
    'Ładowanie szczegółowej prognozy…', 'Gedetailleerde verwachting laden…', 'Naglo-load ng detalyadong pagtaya…',
  ),
  'Rev34.weather.now': NOW,
  'Rev34.weather.zoomIn': L(
    'Zoom in', '확대', 'Suurenda', '拡大', '放大', 'Acercar', 'ពង្រីក',
    'Zoom avant', 'Vergrößern', 'Aproximar', 'Phóng to', 'Perbesar', 'Приблизить',
    'ज़ूम इन', 'Ingrandisci', 'Yakınlaştır', 'ซูมเข้า', 'Powiększ', 'Inzoomen', 'Palakihin',
  ),
  'Rev34.weather.zoomOut': L(
    'Zoom out', '축소', 'Vähenda', '縮小', '缩小', 'Alejar', 'បង្រួម',
    'Zoom arrière', 'Verkleinern', 'Afastar', 'Thu nhỏ', 'Perkecil', 'Отдалить',
    'ज़ूम आउट', 'Riduci', 'Uzaklaştır', 'ซูมออก', 'Pomniejsz', 'Uitzoomen', 'Paliitin',
  ),
};

/** Sets one dotted key, creating intermediate objects; never touches
 *  siblings. Returns whether the leaf actually changed. */
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
      throw new Error(`apply-rev34-weather-i18n: ${dotted} has no ${locale} translation -- refusing to write a placeholder.`);
    }
    if (setDeep(data, dotted, value)) set += 1;
  }

  // Fail closed: nothing placeholder-shaped went into THIS lane's sub-namespace,
  // and the two namespaces it reuses (Rev20 aqi bands, Weather) are still there.
  const own = JSON.stringify(data.Rev34?.weather ?? {});
  if (own.includes('[MISSING')) throw new Error(`apply-rev34-weather-i18n: ${locale}: a placeholder survived in Rev34.weather`);
  if (!data.Rev20?.slots?.facts?.aqi?.good || !data.Weather?.feelsLike) {
    throw new Error(`apply-rev34-weather-i18n: ${locale}: the reused Rev20.slots.facts.aqi / Weather keys are missing`);
  }

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const changed = next !== raw;
  if (changed) totalChanges += 1;
  report.push(`${locale}: ~${set} set${changed ? '' : ' (already current)'}`);
  if (changed && !check) writeFileSync(file, next, 'utf8');
}

report.forEach((line) => console.log(line));
if (check) {
  console.log(totalChanges === 0 ? 'apply-rev34-weather-i18n: clean' : `apply-rev34-weather-i18n: ${totalChanges} locale file(s) would change`);
  process.exit(totalChanges === 0 ? 0 : 1);
}
console.log(`apply-rev34-weather-i18n: ${totalChanges} locale file(s) written`);
