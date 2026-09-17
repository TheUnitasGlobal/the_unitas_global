/**
 * REV-41 D-5 -- the omni-radar: the pure geometry behind the "내 주변"
 * (Around Me) card.
 *
 * Before REV-41 the nearby slot asked Wikipedia for ten articles inside a
 * fixed 10 km circle and printed the distance the API reported. The founder's
 * directive (SPEC §0 1-G) asks for three things this module makes true by
 * construction:
 *
 *  1. ZERO radius error -- every blip's distance is the haversine from the
 *     visitor's point (lib/live/geoMatch.distanceKm), and `buildRadar` drops
 *     anything beyond the selected radius before it can be drawn or listed.
 *     A hit 1 m outside is out.
 *  2. Radius tiers 10 / 50 / 100 km / Global. Wikipedia geosearch caps at
 *     10 km per call and every wider keyless source measured on 2026-09-13
 *     timed out or hallucinated (SPEC §1-6), so the wider tiers are a
 *     multi-beam SWEEP of 10 km circles laid out by bearing (`radarBeams`),
 *     fetched in parallel, each beam failing open on its own.
 *  3. A 1000-codex lens on every blip -- `classifyLens` reads the title and
 *     short description in the visitor's language and tags it as a nomad
 *     meetup spot, an AI-factory workspace, an inspiration hideout or a
 *     plain signal, which is what the radar colours.
 *
 * The Global tier is the UNITAS nomad constellation: sixteen real hubs at
 * real coordinates, ranged and beared from the visitor with no network at
 * all. Pure module: no fetch, no React, no clock.
 */
import type { NearbyRadiusKey, RadarBlip, RadarLens } from '@/lib/live/discoverySlots';
import { distanceKm } from '@/lib/live/geoMatch';

export { distanceKm };

export interface LatLon {
  lat: number;
  lon: number;
}

export interface NearbyRadius {
  key: NearbyRadiusKey;
  /** `null` = the global constellation (no radius, no network). */
  km: number | null;
}

/** The four radius chips, in chip order. */
export const NEARBY_RADII: readonly NearbyRadius[] = [
  { key: 'r10', km: 10 },
  { key: 'r50', km: 50 },
  { key: 'r100', km: 100 },
  { key: 'global', km: null },
];

/** Four distinct chip accents: the slot's own ember for 10 km, gold, the
 *  factory blue and the inspiration violet as the sweep widens. */
export const NEARBY_RADIUS_COLORS: Readonly<Record<NearbyRadiusKey, string>> = {
  r10: '#c05621',
  r50: '#d4af37',
  r100: '#0b5cff',
  global: '#7b2d8e',
};

/** The radius a `cursor.tab` names, defaulting to the first (10 km) chip
 *  for a missing or unknown key. */
export function radiusByKey(key: string | null | undefined): NearbyRadius {
  return NEARBY_RADII.find((r) => r.key === key) ?? NEARBY_RADII[0];
}

/** Wikipedia geosearch's hard ceiling per call (metres). */
export const BEAM_RADIUS_M = 10_000;

export interface RadarBeamSpec {
  /** Compass bearing from the centre, degrees clockwise from north. */
  bearing: number;
  /** Distance of the beam's own centre from the visitor, km (0 = centre). */
  offsetKm: number;
  /** `ggslimit` for this beam. */
  limit: number;
}

const CENTRE_BEAM: RadarBeamSpec = { bearing: 0, offsetKm: 0, limit: 50 };

function ring(offsetKm: number, startBearing: number, limit: number): RadarBeamSpec[] {
  return Array.from({ length: 6 }, (_, i) => ({ bearing: (startBearing + i * 60) % 360, offsetKm, limit }));
}

/**
 * The sweep for a radius (SPEC D-5): 10 km = the centre beam alone (limit
 * 50); 50 km = the centre plus six 10 km beams centred 32 km out at 0°, 60°,
 * … (limit 25 each); 100 km = the centre, six at 40 km and six more at 80 km
 * offset by 30°, thirteen beams. The sweep is a SAMPLE of the wider circle
 * -- coverage is not total and never claimed to be -- but every hit it
 * returns is measured from the visitor, so the radius promise holds.
 */
export function radarBeams(radiusKm: number): RadarBeamSpec[] {
  if (radiusKm <= 10) return [CENTRE_BEAM];
  if (radiusKm <= 50) return [{ ...CENTRE_BEAM, limit: 25 }, ...ring(32, 0, 25)];
  return [{ ...CENTRE_BEAM, limit: 25 }, ...ring(40, 0, 25), ...ring(80, 30, 25)];
}

const EARTH_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Destination point `km` along the great circle leaving (lat, lon) at
 *  `bearing` degrees -- the beam centres of the sweep. */
export function offsetPoint(lat: number, lon: number, bearing: number, km: number): LatLon {
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const θ = toRad(bearing);
  const δ = km / EARTH_KM;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  const lonDeg = ((toDeg(λ2) + 540) % 360) - 180;
  return { lat: toDeg(φ2), lon: lonDeg };
}

/** Initial great-circle bearing from A to B, degrees in [0, 360). */
export function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const φ1 = toRad(aLat);
  const φ2 = toRad(bLat);
  const Δλ = toRad(bLon - aLon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = toDeg(Math.atan2(y, x));
  return ((θ % 360) + 360) % 360;
}

/**
 * Lens keywords, lower-cased, matched as substrings of the title and short
 * description in the visitor's language (Wikipedia short descriptions are
 * in the wiki's language). Order of precedence when several lenses match:
 * inspiration (a museum café is a museum), factory (a university coworking
 * space is a campus), nomad, then the `signal` default for everything a
 * nomad neither meets at, works at nor wonders at (stations, roads, schools,
 * administrative units ...).
 */
const LENS_KEYWORDS: Readonly<Record<Exclude<RadarLens, 'signal'>, readonly string[]>> = {
  inspiration: [
    // en
    'museum', 'gallery', 'temple', 'shrine', 'church', 'cathedral', 'basilica', 'mosque', 'monastery', 'abbey', 'palace', 'castle', 'fortress',
    'garden', 'botanical', 'theatre', 'theater', 'opera', 'monument', 'memorial', 'heritage', 'historic', 'ruins', 'viewpoint', 'observatory',
    'waterfall', 'mountain', 'peak', 'lake', 'island', 'trail', 'canyon', 'cave', 'lighthouse', 'sculpture', 'mural', 'art ', 'arts ',
    // ko
    '박물관', '미술관', '사찰', '사원', '신사', '성당', '교회', '수도원', '궁궐', '궁전', '고궁', '성곽', '요새', '정원', '수목원', '극장', '오페라', '기념관', '기념비',
    '유적', '유산', '문화재', '전망대', '천문대', '폭포', '봉우리', '호수', '동굴', '등대', '조각', '벽화',
    // ja
    '博物館', '美術館', '寺', '神社', '教会', '大聖堂', '修道院', '城', '宮殿', '庭園', '植物園', '劇場', '記念', '遺跡', '史跡', '展望', '天文台', '滝', '湖', '洞窟', '灯台',
    // zh
    '博物馆', '博物院', '美术馆', '寺庙', '庙', '教堂', '修道院', '城堡', '宫殿', '故宫', '花园', '植物园', '剧院', '纪念', '遗址', '古迹', '观景', '天文台', '瀑布', '湖泊', '洞穴', '灯塔',
    // de
    'galerie', 'tempel', 'kirche', 'dom ', 'münster', 'kloster', 'schloss', 'burg', 'garten', 'botanisch', 'denkmal', 'ruine', 'aussicht', 'sternwarte', 'wasserfall', 'berg', 'gipfel', 'see ', 'insel', 'höhle', 'leuchtturm',
    // fr
    'musée', 'galerie', 'église', 'cathédrale', 'abbaye', 'château', 'jardin', 'théâtre', 'patrimoine', 'belvédère', 'cascade', 'montagne', 'lac ', 'île', 'grotte', 'phare',
    // es
    'museo', 'galería', 'templo', 'iglesia', 'catedral', 'monasterio', 'castillo', 'palacio', 'jardín', 'teatro', 'monumento', 'patrimonio', 'mirador', 'cascada', 'cerro', 'montaña', 'lago', 'isla', 'cueva', 'faro',
    // pt
    'museu', 'galeria', 'igreja', 'mosteiro', 'castelo', 'palácio', 'jardim', 'miradouro', 'cachoeira', 'serra', 'ilha', 'gruta', 'farol', 'património', 'patrimônio',
    // ru
    'музей', 'галере', 'храм', 'церковь', 'собор', 'монастыр', 'замок', 'дворец', 'сад', 'театр', 'памятник', 'наследи', 'смотров', 'водопад', 'гора', 'озеро', 'остров', 'пещер', 'маяк',
    // it
    'tempio', 'chiesa', 'cattedrale', 'duomo', 'basilica', 'abbazia', 'castello', 'palazzo', 'giardino', 'teatro', 'monumento', 'belvedere', 'cascata', 'monte ', 'montagna', 'isola', 'grotta', 'faro',
  ],
  factory: [
    // en
    'university', 'college', 'institute', 'research', 'laboratory', 'science', 'technology', 'technological', 'campus', 'innovation', 'incubator', 'startup',
    'headquarters', 'data center', 'data centre', 'industrial', 'engineering', 'polytechnic', 'academy', 'tech park', 'business park', 'software',
    // ko
    '대학교', '대학', '연구소', '연구원', '연구단지', '과학', '기술', '테크노', '캠퍼스', '혁신', '창업', '스타트업', '본사', '데이터센터', '산업단지', '공학', '아카데미', '소프트웨어',
    // ja
    '大学', '研究所', '研究', '科学', '技術', 'テクノ', 'キャンパス', 'イノベーション', 'スタートアップ', '本社', 'データセンター', '工業', '工学', 'アカデミー',
    // zh
    '大学', '学院', '研究所', '研究院', '科学', '科技', '技术', '校区', '创新', '孵化', '创业', '总部', '数据中心', '工业园', '工程', '软件',
    // de
    'universität', 'hochschule', 'institut', 'forschung', 'wissenschaft', 'technologie', 'technik', 'gründer', 'zentrale', 'rechenzentrum', 'industrie', 'akademie',
    // fr
    'université', 'institut', 'recherche', 'science', 'technologie', 'technopole', 'innovation', 'siège', 'industriel', 'ingénieur', 'académie',
    // es
    'universidad', 'instituto', 'investigación', 'ciencia', 'tecnología', 'tecnológico', 'innovación', 'sede', 'industrial', 'ingeniería', 'academia',
    // pt
    'universidade', 'instituto', 'pesquisa', 'ciência', 'tecnologia', 'tecnológico', 'inovação', 'sede', 'industrial', 'engenharia', 'academia',
    // ru
    'университет', 'институт', 'исследов', 'наук', 'технолог', 'кампус', 'инновац', 'штаб', 'промышлен', 'инженер', 'академи',
    // it
    'università', 'politecnico', 'istituto', 'ricerca', 'scienza', 'tecnologia', 'tecnologico', 'innovazione', 'sede', 'industriale', 'ingegneria', 'accademia',
  ],
  nomad: [
    // en
    'coworking', 'co-working', 'cafe', 'café', 'coffee', 'hostel', 'hotel', 'guesthouse', 'guest house', 'plaza', 'square', 'market', 'beach', 'park',
    'library', 'promenade', 'waterfront', 'pier', 'harbour', 'harbor', 'marina', 'food hall', 'night market', 'bazaar', 'lounge', 'hub',
    // ko
    '코워킹', '공유오피스', '공유 오피스', '카페', '커피', '호스텔', '호텔', '게스트하우스', '광장', '시장', '해변', '해수욕장', '공원', '도서관', '산책로', '부두', '항구', '마리나', '야시장', '라운지',
    // ja
    'コワーキング', 'カフェ', '喫茶', 'コーヒー', 'ホステル', 'ホテル', 'ゲストハウス', '広場', '市場', '海岸', 'ビーチ', '公園', '図書館', '遊歩道', '港', 'マリーナ', 'ラウンジ',
    // zh
    '共享办公', '联合办公', '咖啡', '青年旅舍', '青旅', '酒店', '宾馆', '民宿', '广场', '市场', '海滩', '沙滩', '公园', '图书馆', '步道', '码头', '港', '夜市',
    // de
    'kaffee', 'jugendherberge', 'gasthaus', 'pension', 'platz', 'markt', 'strand', 'bibliothek', 'promenade', 'hafen', 'halle',
    // fr
    'auberge', 'hôtel', 'place ', 'marché', 'plage', 'parc', 'bibliothèque', 'esplanade', 'port', 'halle',
    // es
    'cafetería', 'hostal', 'albergue', 'posada', 'plaza', 'mercado', 'playa', 'parque', 'biblioteca', 'paseo', 'malecón', 'puerto',
    // pt
    'hospedaria', 'pousada', 'praça', 'mercado', 'praia', 'parque', 'biblioteca', 'passeio', 'orla', 'porto',
    // ru
    'кафе', 'кофе', 'коворкинг', 'хостел', 'отель', 'гостиниц', 'площадь', 'рынок', 'пляж', 'парк', 'библиотек', 'набережн', 'порт',
    // it
    'caffè', 'ostello', 'albergo', 'locanda', 'piazza', 'mercato', 'spiaggia', 'parco', 'biblioteca', 'lungomare', 'porto',
  ],
};

const LENS_ORDER: ReadonlyArray<Exclude<RadarLens, 'signal'>> = ['inspiration', 'factory', 'nomad'];

/** Which of the four lenses a hit falls under -- see LENS_KEYWORDS. */
export function classifyLens(title: string, description?: string | null): RadarLens {
  const haystack = ` ${title} ${description ?? ''} `.toLowerCase();
  for (const lens of LENS_ORDER) {
    if (LENS_KEYWORDS[lens].some((kw) => haystack.includes(kw))) return lens;
  }
  return 'signal';
}

export interface RadarRawHit {
  id: string;
  title: string;
  lat: number;
  lon: number;
  url?: string;
  description?: string | null;
  /** A pre-classified hit (the constellation) keeps its lens. */
  lens?: RadarLens;
}

/**
 * The radar from raw hits: haversine distance and bearing from the centre,
 * the lens, STRICT `distKm <= radiusKm` (null radius = no cut), de-duplicated
 * by id (the sweep's beams overlap, so one article can arrive from several
 * beams), nearest first. This is the 0 % radius-error guarantee: nothing
 * the radius does not contain survives this function.
 */
export function buildRadar(center: LatLon, radiusKm: number | null, rawHits: readonly RadarRawHit[]): RadarBlip[] {
  const seen = new Set<string>();
  const blips: RadarBlip[] = [];
  for (const hit of rawHits) {
    if (!hit || typeof hit.id !== 'string' || !hit.id) continue;
    if (!Number.isFinite(hit.lat) || !Number.isFinite(hit.lon)) continue;
    if (seen.has(hit.id)) continue;
    const distKm = distanceKm(center.lat, center.lon, hit.lat, hit.lon);
    if (radiusKm !== null && distKm > radiusKm) continue;
    seen.add(hit.id);
    blips.push({
      id: hit.id,
      title: hit.title,
      url: hit.url,
      distKm,
      bearing: bearingDeg(center.lat, center.lon, hit.lat, hit.lon),
      lens: hit.lens ?? classifyLens(hit.title, hit.description),
    });
  }
  return blips.sort((a, b) => a.distKm - b.distKm);
}

/** REV-41 D-5 (sparse-region relief): under this many blips the locale
 *  sweep is topped up from English Wikipedia -- the densest geotagged
 *  corpus on the open web -- so a Korean reader in rural Georgia is not
 *  shown a one-blip radar because ko.wikipedia has one article there. A
 *  dense home city never reaches the floor and never spends the extra leg. */
export const RADAR_SPARSE_FLOOR = 8;

/**
 * Positional de-duplication across two wikis. The same place carries a
 * different page id and (usually) a different title on each edition, so
 * the id-based dedupe of `buildRadar` cannot see it; a secondary hit
 * within `minSeparationKm` (50 m) of ANY primary hit is the same place and
 * is dropped. The primary (locale) hit keeps its own language and link.
 */
export function mergeRadarLegs(primary: readonly RadarRawHit[], secondary: readonly RadarRawHit[], minSeparationKm = 0.05): RadarRawHit[] {
  const anchors = primary.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  const merged = [...primary];
  for (const hit of secondary) {
    if (!Number.isFinite(hit.lat) || !Number.isFinite(hit.lon)) continue;
    const near = anchors.some((p) => distanceKm(p.lat, p.lon, hit.lat, hit.lon) <= minSeparationKm);
    if (!near) merged.push(hit);
  }
  return merged;
}

/** "480m" under a kilometre, "4.9km" / "8,532.1km" otherwise -- one unit rule
 *  for the card, the deep list and the facts, so the radius chip and the
 *  distances it promises can never disagree. Digits follow the locale. */
export function formatDistance(km: number, locale: string): string {
  const safe = Number.isFinite(km) && km > 0 ? km : 0;
  if (safe < 1) {
    const metres = Math.round(safe * 1000);
    return `${formatNumber(metres, locale, 0)}m`;
  }
  return `${formatNumber(safe, locale, 1)}km`;
}

function formatNumber(value: number, locale: string, digits: number): string {
  try {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  } catch {
    return value.toFixed(digits);
  }
}

export interface NomadHub {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  lat: number;
  lon: number;
  lens: RadarLens;
  url: string;
}

/** The UNITAS nomad nexus: sixteen real hubs, real coordinates (city
 *  centres), lensed by what each is known for -- the e-residency /
 *  founder-factory capitals as `factory`, the classic remote-work cities as
 *  `nomad`, the two that draw people for the view as `inspiration`. */
export const NOMAD_NEXUS_HUBS: readonly NomadHub[] = [
  { id: 'tallinn', name: 'Tallinn', country: 'EE', lat: 59.437, lon: 24.7536, lens: 'factory', url: 'https://en.wikipedia.org/wiki/Tallinn' },
  { id: 'lisbon', name: 'Lisbon', country: 'PT', lat: 38.7223, lon: -9.1393, lens: 'nomad', url: 'https://en.wikipedia.org/wiki/Lisbon' },
  { id: 'canggu', name: 'Canggu', country: 'ID', lat: -8.6478, lon: 115.1385, lens: 'nomad', url: 'https://en.wikipedia.org/wiki/Canggu' },
  { id: 'chiang-mai', name: 'Chiang Mai', country: 'TH', lat: 18.7883, lon: 98.9853, lens: 'nomad', url: 'https://en.wikipedia.org/wiki/Chiang_Mai' },
  { id: 'medellin', name: 'Medellín', country: 'CO', lat: 6.2442, lon: -75.5812, lens: 'nomad', url: 'https://en.wikipedia.org/wiki/Medell%C3%ADn' },
  { id: 'mexico-city', name: 'Mexico City', country: 'MX', lat: 19.4326, lon: -99.1332, lens: 'nomad', url: 'https://en.wikipedia.org/wiki/Mexico_City' },
  { id: 'buenos-aires', name: 'Buenos Aires', country: 'AR', lat: -34.6037, lon: -58.3816, lens: 'nomad', url: 'https://en.wikipedia.org/wiki/Buenos_Aires' },
  { id: 'cape-town', name: 'Cape Town', country: 'ZA', lat: -33.9249, lon: 18.4241, lens: 'inspiration', url: 'https://en.wikipedia.org/wiki/Cape_Town' },
  { id: 'dubai', name: 'Dubai', country: 'AE', lat: 25.2048, lon: 55.2708, lens: 'factory', url: 'https://en.wikipedia.org/wiki/Dubai' },
  { id: 'singapore', name: 'Singapore', country: 'SG', lat: 1.3521, lon: 103.8198, lens: 'factory', url: 'https://en.wikipedia.org/wiki/Singapore' },
  { id: 'tokyo', name: 'Tokyo', country: 'JP', lat: 35.6762, lon: 139.6503, lens: 'factory', url: 'https://en.wikipedia.org/wiki/Tokyo' },
  { id: 'seoul', name: 'Seoul', country: 'KR', lat: 37.5665, lon: 126.978, lens: 'factory', url: 'https://en.wikipedia.org/wiki/Seoul' },
  { id: 'taipei', name: 'Taipei', country: 'TW', lat: 25.033, lon: 121.5654, lens: 'factory', url: 'https://en.wikipedia.org/wiki/Taipei' },
  { id: 'bangkok', name: 'Bangkok', country: 'TH', lat: 13.7563, lon: 100.5018, lens: 'nomad', url: 'https://en.wikipedia.org/wiki/Bangkok' },
  { id: 'tbilisi', name: 'Tbilisi', country: 'GE', lat: 41.7151, lon: 44.8271, lens: 'inspiration', url: 'https://en.wikipedia.org/wiki/Tbilisi' },
  { id: 'austin', name: 'Austin', country: 'US', lat: 30.2672, lon: -97.7431, lens: 'factory', url: 'https://en.wikipedia.org/wiki/Austin,_Texas' },
];

/** The Global tier: all sixteen hubs ranged and beared from the visitor,
 *  nearest first. Zero network, zero burn. */
export function globalRadar(center: LatLon): RadarBlip[] {
  return buildRadar(
    center,
    null,
    NOMAD_NEXUS_HUBS.map((h) => ({ id: `hub:${h.id}`, title: h.name, lat: h.lat, lon: h.lon, url: h.url, lens: h.lens })),
  );
}

/** One beam's Wikipedia request on the locale wiki: `generator=geosearch`
 *  so each page also carries its short description (the lens input) and its
 *  own coordinate (the haversine input); `colimit=max` because the default
 *  of 10 would silently strip coordinates past the tenth page. */
export function geoSearchBeamUrl(lang: string, point: LatLon, limit: number, radiusM = BEAM_RADIUS_M): string {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'geosearch',
    ggscoord: `${point.lat}|${point.lon}`,
    ggsradius: String(radiusM),
    ggslimit: String(limit),
    prop: 'description|coordinates',
    colimit: 'max',
    format: 'json',
    origin: '*',
  });
  return `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`;
}

interface GeoSearchPage {
  pageid?: number;
  title?: string;
  description?: string;
  coordinates?: Array<{ lat?: number; lon?: number }>;
}

/** The generator response → raw hits (pages without a coordinate are
 *  skipped: nothing can be ranged, so nothing is claimed). Anything that is
 *  not the expected shape yields `[]`. */
export function parseGeoSearchPages(json: unknown, lang: string): RadarRawHit[] {
  const pages = (json as { query?: { pages?: Record<string, GeoSearchPage> | GeoSearchPage[] } } | null)?.query?.pages;
  if (!pages || typeof pages !== 'object') return [];
  const list = Array.isArray(pages) ? pages : Object.values(pages);
  const hits: RadarRawHit[] = [];
  for (const page of list) {
    if (!page || typeof page.title !== 'string' || !page.title) continue;
    const coord = page.coordinates?.find((c) => typeof c?.lat === 'number' && typeof c?.lon === 'number');
    if (!coord) continue;
    hits.push({
      id: `wiki:${lang}:${typeof page.pageid === 'number' ? page.pageid : page.title}`,
      title: page.title,
      lat: coord.lat!,
      lon: coord.lon!,
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      description: page.description ?? null,
    });
  }
  return hits;
}
