/**
 * REV-21 §3B / SPEC §12.4 -- the single source of truth for every external
 * engine the U-AI ecosystem touches ("옴니-테크 소스 레지스트리", founder
 * directive v2 2026-09-12, Codex ch.22 Omni-Tech Convergence).
 *
 * Everything that names a source derives from here: the per-reference
 * attribution badge (`sourceNameOf`), the discovery slots' provider row
 * (`SLOT_PROVIDER`), the Explore Deeper themes' sources block, the outbound
 * brand row of the infinity stream, and the privacy page's "third-party
 * sources / browser storage" sections (M9). One registry, one legal line per
 * source, one place to retire a source when its terms change.
 *
 * Three classes of source, from the live probe of 2026-09-12:
 *  - `server`   -- reachable from our routes only (no CORS): the two news
 *                  RSS wires. Headlines + links only, 10-minute edge cache,
 *                  no article text or images ever stored.
 *  - `browser`  -- keyless, CORS `*`, called straight from the visitor's
 *                  device (0원, zero backend).
 *  - `outbound` -- never fetched: a plain-text, real-name link that opens
 *                  the vendor's own site in a new tab. No logos, no brand
 *                  colours, no "powered by", no SERP scraping.
 * `first-party` rows name UNITAS' own curated data so a slot can always
 * show a provider.
 *
 * Pure: no React, no fetch, no `window`. Importable from server routes,
 * client components and node-environment unit tests alike.
 */

export type SourceSide = 'server' | 'browser' | 'outbound' | 'first-party';

export type SourceLicenseClass =
  | 'public-domain'
  | 'cc-by'
  | 'cc-by-sa'
  | 'per-file'
  | 'rss-headline-only'
  | 'open-metadata'
  | 'outbound-only'
  | 'first-party';

export type SourceAnchorKind = 'entity' | 'place' | 'country' | 'text';

export type SourceId =
  // server (RSS)
  | 'googleNews'
  | 'bingNews'
  // browser -- entity (Wikimedia family + open scholarly/community data)
  | 'wikipedia'
  | 'wiktionary'
  | 'wikidata'
  | 'wikidataQuery'
  | 'wikimediaCommons'
  | 'wikimediaPageviews'
  | 'duckduckgo'
  | 'hackerNews'
  | 'openAlex'
  | 'crossref'
  | 'openLibrary'
  | 'theMet'
  // browser -- place / country
  | 'openMeteo'
  | 'nasaEonet'
  | 'usgs'
  | 'noaaNws'
  | 'worldBank'
  | 'frankfurter'
  | 'coinGecko'
  | 'bigDataCloud'
  | 'geoJs'
  | 'ipwhois'
  // outbound only
  | 'googleSearch'
  | 'bingSearch'
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'threads'
  | 'x'
  | 'linkedin'
  | 'tiktok'
  | 'reddit'
  | 'github'
  // first party
  | 'unitasCurated'
  | 'unitasIndex';

export interface OmniSource {
  id: SourceId;
  /** The engine's REAL name as a proper noun. `en` is the badge text on
   *  every locale (proper nouns are not translated); `ko` only differs
   *  when the vendor itself publishes a Korean trade name. */
  displayName: { en: string; ko: string };
  /** Corporate owner, shown where the founder's "실명" rule wants the
   *  parent named ("Bing News · Microsoft"). */
  owner?: string;
  homepage: string;
  /** Hostnames this source answers from -- an entry matches the exact host
   *  or any subdomain of it. Order across the registry is precedence
   *  (news.google.com is listed before google.com). */
  hosts: readonly string[];
  /** When set, the URL path must start with this for the host to count as
   *  this source (bing.com/news vs bing.com/search). */
  pathPrefix?: string;
  /** Match the listed hosts exactly, never their subdomains (the Wikimedia
   *  apex serves the pageview metrics; meta./species. are not it). */
  exactHosts?: boolean;
  /** Wikipedia / Wiktionary carry a language edition in the subdomain. */
  langQualified?: boolean;
  side: SourceSide;
  licenseClass: SourceLicenseClass;
  /** The legal attribution line rendered under any block that shows this
   *  source's data (en + ko). Wiki excerpts are CC BY-SA, Open-Meteo /
   *  World Bank are CC-BY, NASA / USGS / NOAA are public domain, RSS is
   *  headline-only, outbound is "not affiliated". */
  attribution: { en: string; ko: string };
  rateLimit?: string;
  anchorKind: readonly SourceAnchorKind[];
  /** D-25: the vendor shows a login wall to signed-out visitors -- the
   *  outbound link carries a hint. */
  loginWall?: boolean;
  notes?: string;
}

const NOT_AFFILIATED = (name: string) => ({
  en: `Opens ${name} in a new tab. UNITAS is not affiliated with or endorsed by ${name}.`,
  ko: `${name}을(를) 새 탭에서 엽니다. UNITAS는 ${name}과(와) 제휴하거나 보증받은 바 없습니다.`,
});

export const SOURCE_REGISTRY: readonly OmniSource[] = [
  /* ---------------------------------------------------------------- */
  /* server -- news RSS wires (headlines + links only)                 */
  /* ---------------------------------------------------------------- */
  {
    id: 'googleNews',
    displayName: { en: 'Google News', ko: 'Google 뉴스' },
    owner: 'Google',
    homepage: 'https://news.google.com/',
    hosts: ['news.google.com'],
    side: 'server',
    licenseClass: 'rss-headline-only',
    attribution: {
      en: 'Headlines and links via the Google News RSS feed. Headlines only; no article text or images are stored.',
      ko: 'Google 뉴스 RSS 피드의 헤드라인과 링크입니다. 헤드라인만 표시하며 기사 본문이나 이미지는 저장하지 않습니다.',
    },
    rateLimit: 'edge cache 10 min per (query, edition)',
    anchorKind: ['entity', 'country', 'text'],
    notes: 'Quoted phrase respected; hl/gl/ceid select the country edition.',
  },
  {
    id: 'bingNews',
    displayName: { en: 'Bing News', ko: 'Bing 뉴스' },
    owner: 'Microsoft',
    homepage: 'https://www.bing.com/news',
    hosts: ['bing.com'],
    pathPrefix: '/news',
    side: 'server',
    licenseClass: 'rss-headline-only',
    attribution: {
      en: 'Headlines and links via the Bing News RSS feed (Microsoft). Headlines only; no article text or images are stored.',
      ko: 'Bing 뉴스(Microsoft) RSS 피드의 헤드라인과 링크입니다. 헤드라인만 표시하며 기사 본문이나 이미지는 저장하지 않습니다.',
    },
    rateLimit: 'edge cache 10 min per (query, market)',
    anchorKind: ['entity', 'country', 'text'],
    notes: 'Ignores quoted phrases -- entity queries only when the English title is two words or more.',
  },

  /* ---------------------------------------------------------------- */
  /* browser -- entity                                                  */
  /* ---------------------------------------------------------------- */
  {
    id: 'wikipedia',
    displayName: { en: 'Wikipedia', ko: '위키백과' },
    owner: 'Wikimedia Foundation',
    homepage: 'https://www.wikipedia.org/',
    hosts: ['wikipedia.org'],
    langQualified: true,
    side: 'browser',
    licenseClass: 'cc-by-sa',
    attribution: {
      en: 'Text excerpts from Wikipedia, © Wikipedia contributors, CC BY-SA 4.0.',
      ko: '위키백과 발췌문, © 위키백과 기여자, CC BY-SA 4.0.',
    },
    rateLimit: 'shared Wikimedia budget: ≤2 calls per stream page, serial 1.2 s',
    anchorKind: ['entity', 'place', 'text'],
  },
  {
    id: 'wiktionary',
    displayName: { en: 'Wiktionary', ko: '위키낱말사전' },
    owner: 'Wikimedia Foundation',
    homepage: 'https://www.wiktionary.org/',
    hosts: ['wiktionary.org'],
    langQualified: true,
    side: 'browser',
    licenseClass: 'cc-by-sa',
    attribution: {
      en: 'Definitions from Wiktionary, © Wiktionary contributors, CC BY-SA 4.0.',
      ko: '위키낱말사전 정의, © 위키낱말사전 기여자, CC BY-SA 4.0.',
    },
    anchorKind: ['entity', 'text'],
  },
  {
    id: 'wikidata',
    displayName: { en: 'Wikidata', ko: '위키데이터' },
    owner: 'Wikimedia Foundation',
    homepage: 'https://www.wikidata.org/',
    hosts: ['wikidata.org'],
    side: 'browser',
    licenseClass: 'public-domain',
    attribution: { en: 'Structured data from Wikidata, CC0 1.0.', ko: '위키데이터 구조화 데이터, CC0 1.0.' },
    anchorKind: ['entity', 'place', 'country'],
  },
  {
    id: 'wikidataQuery',
    displayName: { en: 'Wikidata Query Service', ko: '위키데이터 쿼리 서비스' },
    owner: 'Wikimedia Foundation',
    homepage: 'https://query.wikidata.org/',
    hosts: ['query.wikidata.org'],
    side: 'browser',
    licenseClass: 'public-domain',
    attribution: { en: 'Graph results from the Wikidata Query Service (SPARQL), CC0 1.0.', ko: '위키데이터 쿼리 서비스(SPARQL) 결과, CC0 1.0.' },
    rateLimit: '60 s per query budget; 1 concurrent',
    anchorKind: ['entity'],
  },
  {
    id: 'wikimediaCommons',
    displayName: { en: 'Wikimedia Commons', ko: '위키미디어 공용' },
    owner: 'Wikimedia Foundation',
    homepage: 'https://commons.wikimedia.org/',
    hosts: ['commons.wikimedia.org', 'upload.wikimedia.org'],
    side: 'browser',
    licenseClass: 'per-file',
    attribution: {
      en: 'Media from Wikimedia Commons. Each file carries its own license and author, shown beside it.',
      ko: '위키미디어 공용의 미디어입니다. 파일마다 고유의 라이선스와 저작자가 있으며 옆에 표시됩니다.',
    },
    anchorKind: ['entity', 'place'],
    notes: 'REST media-list has no license field -- pair with imageinfo (extmetadata) before display.',
  },
  {
    id: 'wikimediaPageviews',
    displayName: { en: 'Wikimedia Pageviews', ko: '위키미디어 페이지뷰' },
    owner: 'Wikimedia Foundation',
    homepage: 'https://wikimedia.org/api/rest_v1/',
    hosts: ['wikimedia.org'],
    exactHosts: true,
    side: 'browser',
    licenseClass: 'public-domain',
    attribution: { en: 'Pageview statistics from the Wikimedia Analytics API, CC0 1.0.', ko: '위키미디어 애널리틱스 API의 페이지뷰 통계, CC0 1.0.' },
    anchorKind: ['entity'],
  },
  {
    id: 'duckduckgo',
    displayName: { en: 'DuckDuckGo', ko: 'DuckDuckGo' },
    homepage: 'https://duckduckgo.com/',
    hosts: ['duckduckgo.com'],
    side: 'browser',
    licenseClass: 'open-metadata',
    attribution: { en: 'Instant answers via the DuckDuckGo Instant Answer API.', ko: 'DuckDuckGo 인스턴트 앤서 API를 통한 즉답 정보입니다.' },
    anchorKind: ['entity'],
    notes: 'Called with the resolved English title only; a disambiguation answer is discarded whole.',
  },
  {
    id: 'hackerNews',
    displayName: { en: 'Hacker News', ko: 'Hacker News' },
    owner: 'Y Combinator',
    homepage: 'https://news.ycombinator.com/',
    hosts: ['hn.algolia.com', 'news.ycombinator.com'],
    side: 'browser',
    licenseClass: 'open-metadata',
    attribution: { en: 'Stories via the Hacker News search API (Algolia).', ko: 'Hacker News 검색 API(Algolia)를 통한 게시물입니다.' },
    anchorKind: ['entity', 'text'],
  },
  {
    id: 'openAlex',
    displayName: { en: 'OpenAlex', ko: 'OpenAlex' },
    owner: 'OurResearch',
    homepage: 'https://openalex.org/',
    hosts: ['openalex.org'],
    side: 'browser',
    licenseClass: 'public-domain',
    attribution: { en: 'Scholarly metadata from OpenAlex, CC0 1.0.', ko: 'OpenAlex 학술 메타데이터, CC0 1.0.' },
    rateLimit: 'polite pool: 10 req/s',
    anchorKind: ['entity', 'text'],
  },
  {
    id: 'crossref',
    displayName: { en: 'Crossref', ko: 'Crossref' },
    homepage: 'https://www.crossref.org/',
    hosts: ['crossref.org'],
    side: 'browser',
    licenseClass: 'open-metadata',
    attribution: { en: 'Bibliographic metadata via the Crossref REST API.', ko: 'Crossref REST API를 통한 서지 메타데이터입니다.' },
    rateLimit: '1 req/s, 1 concurrent (public pool)',
    anchorKind: ['entity', 'text'],
  },
  {
    id: 'openLibrary',
    displayName: { en: 'Open Library', ko: 'Open Library' },
    owner: 'Internet Archive',
    homepage: 'https://openlibrary.org/',
    hosts: ['openlibrary.org'],
    side: 'browser',
    licenseClass: 'open-metadata',
    attribution: { en: 'Catalog data from Open Library (Internet Archive).', ko: 'Open Library(Internet Archive) 카탈로그 데이터입니다.' },
    anchorKind: ['entity', 'text'],
  },
  {
    id: 'theMet',
    displayName: { en: 'The Met', ko: '메트로폴리탄 미술관' },
    owner: 'The Metropolitan Museum of Art',
    homepage: 'https://www.metmuseum.org/art/collection',
    hosts: ['metmuseum.org'],
    side: 'browser',
    licenseClass: 'public-domain',
    attribution: { en: 'Collection data from The Metropolitan Museum of Art Open Access program, CC0 1.0.', ko: '메트로폴리탄 미술관 오픈 액세스 컬렉션 데이터, CC0 1.0.' },
    anchorKind: ['entity', 'text'],
  },

  /* ---------------------------------------------------------------- */
  /* browser -- place / country                                         */
  /* ---------------------------------------------------------------- */
  {
    id: 'openMeteo',
    displayName: { en: 'Open-Meteo', ko: 'Open-Meteo' },
    homepage: 'https://open-meteo.com/',
    hosts: ['open-meteo.com'],
    side: 'browser',
    licenseClass: 'cc-by',
    attribution: { en: 'Weather, air-quality, climate, flood and marine data by Open-Meteo.com, CC BY 4.0.', ko: '날씨·대기질·기후·홍수·해양 데이터: Open-Meteo.com, CC BY 4.0.' },
    rateLimit: 'free tier: 10,000 calls/day (D-36 commercial tier under legal review)',
    anchorKind: ['place'],
    notes: 'Forecast, air-quality, archive, climate, flood, marine and geocoding hosts all end in open-meteo.com.',
  },
  {
    id: 'nasaEonet',
    displayName: { en: 'NASA EONET', ko: 'NASA EONET' },
    owner: 'NASA',
    homepage: 'https://eonet.gsfc.nasa.gov/',
    hosts: ['eonet.gsfc.nasa.gov'],
    side: 'browser',
    licenseClass: 'public-domain',
    attribution: { en: 'Natural event data from NASA EONET (Earth Observatory Natural Event Tracker), public domain.', ko: 'NASA EONET(지구 관측 자연 사건 추적기) 자연 사건 데이터, 퍼블릭 도메인.' },
    rateLimit: '60 req/min',
    anchorKind: ['place'],
    notes: 'days=30 required (stale open events); Content-Type is mislabeled rss+xml -- read text then JSON.parse.',
  },
  {
    id: 'usgs',
    displayName: { en: 'USGS', ko: '미국 지질조사국(USGS)' },
    owner: 'U.S. Geological Survey',
    homepage: 'https://earthquake.usgs.gov/',
    hosts: ['earthquake.usgs.gov', 'usgs.gov'],
    side: 'browser',
    licenseClass: 'public-domain',
    attribution: { en: 'Earthquake data from the USGS Earthquake Hazards Program, public domain.', ko: '미국 지질조사국(USGS) 지진 위험 프로그램 데이터, 퍼블릭 도메인.' },
    anchorKind: ['place'],
  },
  {
    id: 'noaaNws',
    displayName: { en: 'NOAA National Weather Service', ko: '미국 국립기상청(NOAA NWS)' },
    owner: 'NOAA',
    homepage: 'https://www.weather.gov/',
    hosts: ['api.weather.gov', 'weather.gov'],
    side: 'browser',
    licenseClass: 'public-domain',
    attribution: { en: 'Weather alerts from the U.S. National Weather Service (NOAA), public domain. United States only.', ko: '미국 국립기상청(NOAA NWS) 기상 경보, 퍼블릭 도메인. 미국 지역에 한함.' },
    anchorKind: ['place'],
    notes: 'US only (404 elsewhere) -- gate on countryCode === "US"; identifying User-Agent required.',
  },
  {
    id: 'worldBank',
    displayName: { en: 'World Bank Open Data', ko: '세계은행 오픈 데이터' },
    owner: 'World Bank Group',
    homepage: 'https://data.worldbank.org/',
    hosts: ['worldbank.org'],
    side: 'browser',
    licenseClass: 'cc-by',
    attribution: { en: 'Indicators from World Bank Open Data, CC BY 4.0.', ko: '세계은행 오픈 데이터 지표, CC BY 4.0.' },
    anchorKind: ['country'],
    notes: 'source=2 (WDI) required for the five headline indicators.',
  },
  {
    id: 'frankfurter',
    displayName: { en: 'Frankfurter (ECB)', ko: 'Frankfurter (유럽중앙은행)' },
    homepage: 'https://frankfurter.dev/',
    hosts: ['api.frankfurter.dev', 'frankfurter.dev', 'api.frankfurter.app', 'frankfurter.app'],
    side: 'browser',
    licenseClass: 'open-metadata',
    attribution: { en: 'Reference exchange rates via Frankfurter, from European Central Bank data.', ko: 'Frankfurter를 통한 참조 환율, 유럽중앙은행 데이터 기준.' },
    anchorKind: ['country'],
    notes: 'v1 host (api.frankfurter.app) sends a Deprecation header -- REV-21 uses api.frankfurter.dev/v2/rates (base, quotes, from, to).',
  },
  {
    id: 'coinGecko',
    displayName: { en: 'CoinGecko', ko: 'CoinGecko' },
    homepage: 'https://www.coingecko.com/',
    hosts: ['coingecko.com'],
    side: 'browser',
    licenseClass: 'open-metadata',
    attribution: { en: 'Market data via the CoinGecko public API.', ko: 'CoinGecko 공개 API를 통한 시세 데이터입니다.' },
    rateLimit: 'public: ~30 req/min',
    anchorKind: ['text'],
  },
  {
    id: 'bigDataCloud',
    displayName: { en: 'BigDataCloud', ko: 'BigDataCloud' },
    homepage: 'https://www.bigdatacloud.com/',
    hosts: ['api.bigdatacloud.net', 'bigdatacloud.net'],
    side: 'browser',
    licenseClass: 'open-metadata',
    attribution: { en: 'Reverse geocoding (coordinates → place name) via the BigDataCloud client API.', ko: 'BigDataCloud 클라이언트 API를 통한 역지오코딩(좌표 → 지명)입니다.' },
    anchorKind: ['place'],
    notes: 'Only called for the "my location" button; nothing personal is sent except the coordinate pair.',
  },
  {
    id: 'geoJs',
    displayName: { en: 'GeoJS', ko: 'GeoJS' },
    homepage: 'https://www.geojs.io/',
    hosts: ['get.geojs.io', 'geojs.io'],
    side: 'browser',
    licenseClass: 'open-metadata',
    attribution: { en: 'Approximate location from the network address via GeoJS (first fallback when GPS is unavailable).', ko: 'GPS를 쓸 수 없을 때 GeoJS를 통한 네트워크 주소 기반 대략적 위치(1차 폴백)입니다.' },
    anchorKind: ['place'],
  },
  {
    id: 'ipwhois',
    displayName: { en: 'ipwho.is', ko: 'ipwho.is' },
    homepage: 'https://ipwho.is/',
    hosts: ['ipwho.is'],
    side: 'browser',
    licenseClass: 'open-metadata',
    attribution: { en: 'Approximate location from the network address via ipwho.is (second fallback when GPS is unavailable).', ko: 'GPS를 쓸 수 없을 때 ipwho.is를 통한 네트워크 주소 기반 대략적 위치(2차 폴백)입니다.' },
    anchorKind: ['place'],
  },

  /* ---------------------------------------------------------------- */
  /* outbound only -- real-name text links, never fetched               */
  /* ---------------------------------------------------------------- */
  {
    id: 'googleSearch',
    displayName: { en: 'Google Search', ko: 'Google 검색' },
    owner: 'Google',
    homepage: 'https://www.google.com/',
    hosts: ['google.com'],
    side: 'outbound',
    licenseClass: 'outbound-only',
    attribution: NOT_AFFILIATED('Google Search'),
    anchorKind: ['entity', 'text'],
  },
  {
    id: 'bingSearch',
    displayName: { en: 'Bing', ko: 'Bing 검색' },
    owner: 'Microsoft',
    homepage: 'https://www.bing.com/',
    hosts: ['bing.com'],
    side: 'outbound',
    licenseClass: 'outbound-only',
    attribution: NOT_AFFILIATED('Bing (Microsoft)'),
    anchorKind: ['entity', 'text'],
  },
  {
    id: 'youtube',
    displayName: { en: 'YouTube', ko: 'YouTube' },
    owner: 'Google',
    homepage: 'https://www.youtube.com/',
    hosts: ['youtube.com', 'youtu.be'],
    side: 'outbound',
    licenseClass: 'outbound-only',
    attribution: NOT_AFFILIATED('YouTube'),
    anchorKind: ['entity', 'text'],
  },
  {
    id: 'facebook',
    displayName: { en: 'Facebook', ko: 'Facebook' },
    owner: 'Meta',
    homepage: 'https://www.facebook.com/',
    hosts: ['facebook.com', 'fb.com'],
    side: 'outbound',
    licenseClass: 'outbound-only',
    attribution: NOT_AFFILIATED('Facebook (Meta)'),
    anchorKind: ['entity', 'text'],
    loginWall: true,
  },
  {
    id: 'instagram',
    displayName: { en: 'Instagram', ko: 'Instagram' },
    owner: 'Meta',
    homepage: 'https://www.instagram.com/',
    hosts: ['instagram.com'],
    side: 'outbound',
    licenseClass: 'outbound-only',
    attribution: NOT_AFFILIATED('Instagram (Meta)'),
    anchorKind: ['entity', 'text'],
    loginWall: true,
  },
  {
    id: 'threads',
    displayName: { en: 'Threads', ko: 'Threads' },
    owner: 'Meta',
    homepage: 'https://www.threads.net/',
    hosts: ['threads.net', 'threads.com'],
    side: 'outbound',
    licenseClass: 'outbound-only',
    attribution: NOT_AFFILIATED('Threads (Meta)'),
    anchorKind: ['entity', 'text'],
    loginWall: true,
  },
  {
    id: 'x',
    displayName: { en: 'X', ko: 'X' },
    owner: 'X Corp.',
    homepage: 'https://x.com/',
    hosts: ['x.com', 'twitter.com'],
    side: 'outbound',
    licenseClass: 'outbound-only',
    attribution: NOT_AFFILIATED('X'),
    anchorKind: ['entity', 'text'],
    loginWall: true,
  },
  {
    id: 'linkedin',
    displayName: { en: 'LinkedIn', ko: 'LinkedIn' },
    owner: 'Microsoft',
    homepage: 'https://www.linkedin.com/',
    hosts: ['linkedin.com'],
    side: 'outbound',
    licenseClass: 'outbound-only',
    attribution: NOT_AFFILIATED('LinkedIn (Microsoft)'),
    anchorKind: ['entity', 'text'],
    loginWall: true,
  },
  {
    id: 'tiktok',
    displayName: { en: 'TikTok', ko: 'TikTok' },
    owner: 'ByteDance',
    homepage: 'https://www.tiktok.com/',
    hosts: ['tiktok.com'],
    side: 'outbound',
    licenseClass: 'outbound-only',
    attribution: NOT_AFFILIATED('TikTok'),
    anchorKind: ['entity', 'text'],
  },
  {
    id: 'reddit',
    displayName: { en: 'Reddit', ko: 'Reddit' },
    homepage: 'https://www.reddit.com/',
    hosts: ['reddit.com'],
    side: 'outbound',
    licenseClass: 'outbound-only',
    attribution: NOT_AFFILIATED('Reddit'),
    anchorKind: ['entity', 'text'],
    notes: 'JSON API answers 403 to browsers -- outbound only.',
  },
  {
    id: 'github',
    displayName: { en: 'GitHub', ko: 'GitHub' },
    owner: 'Microsoft',
    homepage: 'https://github.com/',
    hosts: ['github.com'],
    side: 'outbound',
    licenseClass: 'outbound-only',
    attribution: NOT_AFFILIATED('GitHub (Microsoft)'),
    anchorKind: ['entity', 'text'],
    notes: 'Search API rejected (homonym noise, 10 req/min) -- outbound only.',
  },

  /* ---------------------------------------------------------------- */
  /* first party                                                        */
  /* ---------------------------------------------------------------- */
  {
    id: 'unitasCurated',
    displayName: { en: 'UNITAS curated dataset', ko: 'UNITAS 큐레이션 데이터셋' },
    owner: 'THE UNITAS GLOBAL OÜ',
    homepage: 'https://www.theunitas.global/',
    hosts: ['theunitas.global'],
    side: 'first-party',
    licenseClass: 'first-party',
    attribution: { en: 'Curated, independently verifiable reference figures compiled by UNITAS; refreshed by hand, not live.', ko: 'UNITAS가 편집한 독립 검증 가능한 참조 수치이며, 실시간이 아닌 수기 갱신입니다.' },
    anchorKind: ['text'],
  },
  {
    id: 'unitasIndex',
    displayName: { en: 'UNITAS activity index', ko: 'UNITAS 활동 지수' },
    owner: 'THE UNITAS GLOBAL OÜ',
    homepage: 'https://www.theunitas.global/',
    hosts: [],
    side: 'first-party',
    licenseClass: 'first-party',
    attribution: { en: 'Pseudonymous activity index computed inside UNITAS; no personal data is shown.', ko: 'UNITAS 내부에서 산출한 가명 활동 지수이며 개인정보는 표시하지 않습니다.' },
    anchorKind: ['text'],
  },
];

const BY_ID = new Map<SourceId, OmniSource>(SOURCE_REGISTRY.map((s) => [s.id, s]));

export function sourceById(id: SourceId): OmniSource {
  return BY_ID.get(id)!;
}

export function sourcesBySide(side: SourceSide): readonly OmniSource[] {
  return SOURCE_REGISTRY.filter((s) => s.side === side);
}

/** Every source whose data is fetched (server or browser) -- the privacy
 *  page's "third-party sources" section is generated from this list. */
export function fetchedSources(): readonly OmniSource[] {
  return SOURCE_REGISTRY.filter((s) => s.side === 'server' || s.side === 'browser');
}

/** The vendors called straight from the visitor's device (their servers
 *  see the visitor's IP address) -- the privacy page names these explicitly. */
export function browserCalledSources(): readonly OmniSource[] {
  return sourcesBySide('browser');
}

/** Display label: the real name, with the corporate owner appended when
 *  the name alone does not make the owner obvious (founder rule §3B --
 *  "MS Bing 뉴스" must read as Microsoft's). */
export function sourceLabel(id: SourceId, locale = 'en', withOwner = false): string {
  const s = sourceById(id);
  const name = locale === 'ko' ? s.displayName.ko : s.displayName.en;
  return withOwner && s.owner && !name.includes(s.owner) ? `${name} · ${s.owner}` : name;
}

export function sourceAttribution(id: SourceId, locale = 'en'): string {
  const s = sourceById(id);
  return locale === 'ko' ? s.attribution.ko : s.attribution.en;
}

/** The outbound brand row (SPEC §12.7 `sites` card / D-25): every outbound
 *  source in registry order. Plain text only -- the renderer must not add
 *  logos, glyphs or brand colours. */
export const OUTBOUND_BRAND_ROW: readonly SourceId[] = ['googleSearch', 'bingSearch', 'youtube', 'facebook', 'instagram', 'threads', 'x', 'linkedin', 'tiktok'];

/** Keyless search URL an outbound source opens for a term (new tab,
 *  `rel="noopener noreferrer nofollow"`). `null` = the vendor has no
 *  public, login-free search URL, so the link goes to the vendor's home. */
export function outboundSearchUrl(id: SourceId, term: string, lang = 'en'): string {
  const q = encodeURIComponent(term.trim());
  const hl = encodeURIComponent(lang);
  switch (id) {
    case 'googleSearch':
      return `https://www.google.com/search?q=${q}&hl=${hl}`;
    case 'bingSearch':
      return `https://www.bing.com/search?q=${q}&setlang=${hl}`;
    case 'googleNews':
      return `https://news.google.com/search?q=${q}&hl=${hl}`;
    case 'bingNews':
      return `https://www.bing.com/news/search?q=${q}&setlang=${hl}`;
    case 'youtube':
      return `https://www.youtube.com/results?search_query=${q}`;
    case 'facebook':
      return `https://www.facebook.com/search/top/?q=${q}`;
    case 'instagram':
      return `https://www.instagram.com/explore/search/keyword/?q=${q}`;
    case 'threads':
      return `https://www.threads.net/search?q=${q}`;
    case 'x':
      return `https://x.com/search?q=${q}`;
    case 'linkedin':
      return `https://www.linkedin.com/search/results/all/?keywords=${q}`;
    case 'tiktok':
      return `https://www.tiktok.com/search?q=${q}`;
    case 'reddit':
      return `https://www.reddit.com/search/?q=${q}`;
    case 'github':
      return `https://github.com/search?q=${q}&type=repositories`;
    default:
      return sourceById(id).homepage;
  }
}

/* ------------------------------------------------------------------ */
/* Browser storage ledger (privacy / cookies page, SPEC §12.8)          */
/* ------------------------------------------------------------------ */

export interface BrowserStorageEntry {
  key: string;
  storage: 'localStorage' | 'sessionStorage';
  purpose: { en: string; ko: string };
  /** Retention the code enforces (TTL / LRU), in plain words. */
  retention: { en: string; ko: string };
}

/** Every key the U-AI ecosystem writes on the visitor's device. Nothing in
 *  this ledger is sent to UNITAS servers; the privacy page renders it. */
export const BROWSER_STORAGE_LEDGER: readonly BrowserStorageEntry[] = [
  {
    key: 'unitas.weather.v1',
    storage: 'localStorage',
    purpose: { en: 'Last weather place and forecast so the weather slot renders instantly.', ko: '날씨 슬롯이 즉시 렌더되도록 마지막 장소와 예보를 보관합니다.' },
    retention: { en: '10 minutes, then refetched.', ko: '10분 후 다시 가져옵니다.' },
  },
  {
    key: 'unitas.geo.cache.v1',
    storage: 'localStorage',
    purpose: { en: 'Geocoding results for city searches and "my location".', ko: '도시 검색과 "내 위치"의 지오코딩 결과입니다.' },
    retention: { en: 'Least-recently-used, 240 entries.', ko: '최근 사용 순 240건까지.' },
  },
  {
    key: 'unitas.uai.websynth.v4',
    storage: 'localStorage',
    purpose: { en: 'Live web synthesis for a search term (Wikipedia / Wikidata excerpts).', ko: '검색어의 라이브 웹 합성 결과(위키백과·위키데이터 발췌)입니다.' },
    retention: { en: '24 hours, 40 entries.', ko: '24시간, 40건.' },
  },
  {
    key: 'unitas.uai.shortcut.pulse.v1',
    storage: 'localStorage',
    purpose: { en: 'Momentum ledger for keyword tiers (trend arrow).', ko: '키워드 티어의 추세 화살표용 모멘텀 원장입니다.' },
    retention: { en: '60 entries.', ko: '60건.' },
  },
  {
    key: 'unitas.ouroboros.ladder.v2',
    storage: 'sessionStorage',
    purpose: { en: 'The keyword ladder you built, so a language switch restores it.', ko: '언어를 바꿔도 복원되도록 사용자가 쌓은 키워드 사다리입니다.' },
    retention: { en: 'Cleared when the tab closes.', ko: '탭을 닫으면 삭제됩니다.' },
  },
  {
    key: 'unitas.deeper.v1',
    storage: 'localStorage',
    purpose: { en: 'Explore Deeper theme pages for an entity or place.', ko: '엔티티·장소별 더 깊이 탐색 테마 페이지입니다.' },
    retention: { en: 'Per-theme TTL (10 minutes to 24 hours), 1.5 MB cap.', ko: '테마별 TTL(10분~24시간), 1.5MB 상한.' },
  },
  {
    key: 'unitas.uai.stream.v1',
    storage: 'localStorage',
    purpose: { en: 'Infinity stream pages for a search term, plus your depth and engraving tier.', ko: '검색어의 인피니티 스트림 페이지와 탐색 깊이·각인 티어입니다.' },
    retention: { en: '24 hours (news 15 minutes), 120 entries.', ko: '24시간(뉴스 15분), 120건.' },
  },
  {
    key: 'unitas.uai.suggest.v1',
    storage: 'localStorage',
    purpose: { en: 'Keyword ladder suggestions for typed prefixes.', ko: '입력 접두어에 대한 키워드 사다리 제안입니다.' },
    retention: { en: '24 hours.', ko: '24시간.' },
  },
];

/* ------------------------------------------------------------------ */
/* URL -> source (the attribution badge)                                */
/* ------------------------------------------------------------------ */

function hostMatches(host: string, entry: string): boolean {
  return host === entry || host.endsWith(`.${entry}`);
}

/** Resolve the source behind a URL. Exact hostnames win over suffix
 *  matches; registry order breaks the remaining ties (news.google.com is
 *  registered before google.com; commons before the wikimedia apex). */
export function sourceForUrl(url: string): { source: OmniSource; lang?: string } | null {
  let host = '';
  let path = '';
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase().replace(/^www\./, '');
    path = u.pathname;
  } catch {
    return null;
  }
  const pathOk = (s: OmniSource) => !s.pathPrefix || path.startsWith(s.pathPrefix);
  const exact = SOURCE_REGISTRY.find((s) => s.hosts.includes(host) && pathOk(s));
  const source = exact ?? SOURCE_REGISTRY.find((s) => !s.exactHosts && s.hosts.some((h) => hostMatches(host, h)) && pathOk(s));
  if (!source) return null;
  if (source.langQualified) {
    const m = /^([a-z][a-z-]*)\.(wikipedia|wiktionary)\.org$/.exec(host);
    const lang = m && m[1] !== 'm' ? m[1] : undefined;
    return { source, lang };
  }
  return { source };
}
