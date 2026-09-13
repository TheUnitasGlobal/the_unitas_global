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

/** Every localStorage / sessionStorage key the shipped site writes on the
 *  visitor's device (full inventory of 2026-09-13, REV-21 M9). Nothing in
 *  this ledger is sent to UNITAS servers; the privacy and cookie pages render
 *  it. Keys the app only ever deletes (retired features) are not listed. */
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
  {
    key: 'unitas.localeSwitch.v1',
    storage: 'sessionStorage',
    purpose: { en: 'Scroll position and open search state carried across a language change so the page lands where you were.', ko: '언어를 바꿀 때 스크롤 위치와 열려 있던 검색 상태를 이어 주는 표식입니다.' },
    retention: { en: 'Consumed on the next render; expires after 5 seconds.', ko: '다음 렌더에서 소비되며 5초 후 만료됩니다.' },
  },
  {
    key: 'unitas.sitePage.open.v1',
    storage: 'sessionStorage',
    purpose: { en: 'Which footer page (terms, privacy, ...) is open, so a language change keeps it open.', ko: '어느 하단 안내 페이지(이용약관·개인정보 처리방침 등)가 열려 있는지 기록해 언어를 바꿔도 유지합니다.' },
    retention: { en: 'Removed when the page is closed or the tab reloads.', ko: '페이지를 닫거나 탭을 새로고침하면 삭제됩니다.' },
  },
  {
    key: 'unitas_audio_pref',
    storage: 'localStorage',
    purpose: { en: 'Your sound on/off choice (\'on\' or \'off\'); absent means sound on. Read by the site-wide audio provider, the haptic clicks and the logo-page chime.', ko: '사운드 켜기/끄기 선택(\'on\' 또는 \'off\')입니다. 값이 없으면 켜진 상태로 봅니다. 사이트 전체 오디오, 햅틱 클릭음, 로고 페이지 차임이 이 값을 읽습니다.' },
    retention: { en: 'Until you change it or clear browser data; deliberately kept across an app exit.', ko: '직접 바꾸거나 브라우저 데이터를 지울 때까지 유지됩니다. 앱을 종료해도 일부러 남겨 둡니다.' },
  },
  {
    key: 'unitas_locale_autodetected',
    storage: 'localStorage',
    purpose: { en: 'A \'1\' flag that the browser language was checked once for an automatic language switch, so the guess is never repeated on this device.', ko: '브라우저 언어를 한 번 확인해 자동 언어 전환을 시도했다는 표시(\'1\')입니다. 같은 기기에서 추정을 반복하지 않도록 합니다.' },
    retention: { en: 'Until browser data is cleared.', ko: '브라우저 데이터를 지울 때까지 유지됩니다.' },
  },
  {
    key: 'unitas_locale_pref',
    storage: 'localStorage',
    purpose: { en: 'The language you chose manually, so any later visit on this browser re-applies it (a cookie of the same name is the fallback copy).', ko: '직접 선택한 언어입니다. 같은 브라우저로 다시 방문하면 이 언어를 그대로 적용합니다(같은 이름의 쿠키가 예비 사본입니다).' },
    retention: { en: 'Until you pick another language or clear browser data; kept across an app exit.', ko: '다른 언어를 고르거나 브라우저 데이터를 지울 때까지 유지됩니다. 앱을 종료해도 남습니다.' },
  },
  {
    key: 'unitas_visit_ledger',
    storage: 'localStorage',
    purpose: { en: 'Where you were on the site (curtain phase, ad segment, open cluster surface, locale) plus a timestamp, so an installed app relaunching shortly after being backgrounded returns to the same place instead of replaying the logo page. Holds no identity or entitlement.', ko: '사이트에서 머물던 위치(커튼 단계, 광고 세그먼트, 열린 클러스터 화면, 언어)와 기록 시각입니다. 설치된 앱이 백그라운드 뒤 곧바로 다시 실행될 때 로고 페이지를 되풀이하지 않고 같은 자리로 돌아오게 합니다. 신원이나 권한 정보는 담지 않습니다.' },
    retention: { en: 'Honoured for 30 minutes; removed on a fresh entry to the site and on a confirmed app exit.', ko: '30분 동안만 유효합니다. 사이트에 새로 진입하거나 종료를 확정하면 삭제됩니다.' },
  },
  {
    key: 'unitas.guest.v1',
    storage: 'localStorage',
    purpose: { en: 'A local, throwaway guest identity (random id, 6-digit virtual number, created time) that lets you look around without an account. It is not a server account.', ko: '계정 없이 둘러볼 수 있게 하는 로컬 임시 게스트 식별자(무작위 id, 6자리 가상 번호, 생성 시각)입니다. 서버 계정이 아닙니다.' },
    retention: { en: 'Until you sign in to a real account, end guest mode, or clear browser data.', ko: '실제 계정으로 로그인하거나 게스트 모드를 끝내거나 브라우저 데이터를 지울 때까지 유지됩니다.' },
  },
  {
    key: 'unitas.inapp.escape.at',
    storage: 'localStorage',
    purpose: { en: 'The time (epoch ms) of the last automatic attempt to hand an in-app browser (KakaoTalk, LINE, Facebook, Instagram, ...) over to the real system browser, so the attempt fires at most once per 90 seconds.', ko: '인앱 브라우저(카카오톡, LINE, 페이스북, 인스타그램 등)에서 시스템 브라우저로 자동 전환을 마지막으로 시도한 시각(epoch ms)입니다. 90초에 한 번만 시도하도록 제한합니다.' },
    retention: { en: 'Overwritten on each attempt; only meaningful for 90 seconds; stays until browser data is cleared.', ko: '시도할 때마다 덮어쓰며 90초 동안만 의미가 있습니다. 브라우저 데이터를 지울 때까지 남습니다.' },
  },
  {
    key: 'unitas.lockin.active.v1',
    storage: 'localStorage',
    purpose: { en: 'The keys of the lock-in modules you activated, so the activation survives reloads and language switches.', ko: '활성화한 락인 모듈의 키 목록입니다. 새로고침이나 언어 변경 뒤에도 활성 상태를 유지합니다.' },
    retention: { en: 'Until you deactivate the module or clear browser data.', ko: '모듈을 비활성화하거나 브라우저 데이터를 지울 때까지 유지됩니다.' },
  },
  {
    key: 'unitas.mail.reservation.v1',
    storage: 'localStorage',
    purpose: { en: 'The @theunitas.global handle you reserved at sign-up, when, and its status (\'pending\', \'claimed\' or \'lost\'), so the account surfaces can show it.', ko: '가입 시 예약한 @theunitas.global 핸들과 예약 시각, 상태(\'pending\', \'claimed\', \'lost\')입니다. 계정 화면에서 이를 표시합니다.' },
    retention: { en: 'Until browser data is cleared; the code never removes it, only overwrites it when the status changes.', ko: '브라우저 데이터를 지울 때까지 유지됩니다. 코드가 삭제하지는 않으며 상태가 바뀔 때 덮어씁니다.' },
  },
  {
    key: 'unitas.pwa.installed',
    storage: 'localStorage',
    purpose: { en: 'A \'1\' flag raised when the app was installed on this device, so a later browser-tab visit can point you to the installed app instead of a dead install button.', ko: '이 기기에 앱을 설치했다는 표시(\'1\')입니다. 이후 브라우저 탭으로 방문하면 작동하지 않는 설치 버튼 대신 설치된 앱을 안내합니다.' },
    retention: { en: 'Removed the moment the browser offers installation again (the app is no longer installed); otherwise until browser data is cleared.', ko: '브라우저가 다시 설치를 제안하는 순간(앱이 더 이상 설치되어 있지 않을 때) 삭제됩니다. 그 외에는 브라우저 데이터를 지울 때까지 유지됩니다.' },
  },
  {
    key: 'unitas.shorts.orphanCleanup.v1.done',
    storage: 'localStorage',
    purpose: { en: 'A \'1\' flag that the one-time cleanup of data left behind by the retired UNITAS Shorts feature has already run on this device.', ko: '종료된 UNITAS Shorts 기능이 남긴 데이터를 이 기기에서 한 번 정리했다는 표시(\'1\')입니다.' },
    retention: { en: 'Until browser data is cleared.', ko: '브라우저 데이터를 지울 때까지 유지됩니다.' },
  },
  {
    key: 'unitas.uai.brain-grid.v1',
    storage: 'localStorage',
    purpose: { en: 'Your U-AI search history on this device: query, time, shield score and depth (\'surface\' or \'deep\'), shown as the history strip. Signed-in accounts also get a server copy.', ko: '이 기기의 U-AI 검색 기록(검색어, 시각, 실드 점수, 깊이 \'surface\'/\'deep\')입니다. 기록 스트립에 표시합니다. 로그인 계정은 서버에도 사본이 저장됩니다.' },
    retention: { en: 'Newest 60 entries; removed entirely by the \'wipe history\' action; otherwise until browser data is cleared.', ko: '최신 60건까지 보관합니다. \'기록 삭제\' 동작으로 모두 지워지며, 그 외에는 브라우저 데이터를 지울 때까지 유지됩니다.' },
  },
  {
    key: 'unitas.wallet.prefs.v1',
    storage: 'localStorage',
    purpose: { en: 'Your wallet preferences: auto-spend on/off, limit and window, auto-refill on/off, threshold and package. Settings only -- no balance, no payment details.', ko: '지갑 설정(자동 사용 켜기/끄기·한도·기간, 자동 충전 켜기/끄기·기준·패키지)입니다. 설정값만 저장하며 잔액이나 결제 정보는 담지 않습니다.' },
    retention: { en: 'Until you change them or clear browser data; kept across an app exit.', ko: '직접 바꾸거나 브라우저 데이터를 지울 때까지 유지됩니다. 앱을 종료해도 남습니다.' },
  },
  {
    key: 'unitas_audio_gate_seen',
    storage: 'sessionStorage',
    purpose: { en: 'A \'true\' / \'1\' flag that the audio-unlock gate has already been passed in this tab (set when you dismiss it, or when the curtain releases the site), so the gate is not shown a second time.', ko: '이 탭에서 오디오 활성화 게이트를 이미 지났다는 표시(\'true\' 또는 \'1\')입니다. 게이트를 닫았거나 커튼이 사이트를 열었을 때 기록해, 같은 게이트가 다시 뜨지 않도록 합니다.' },
    retention: { en: 'Cleared when the tab closes; also wiped on a fresh entry to the site and on a confirmed app exit.', ko: '탭을 닫으면 삭제됩니다. 사이트에 새로 진입하거나 종료를 확정할 때도 함께 지워집니다.' },
  },
  {
    key: 'unitas_cinema_phase',
    storage: 'sessionStorage',
    purpose: { en: 'The pre-launch curtain phase this tab is parked on (\'gate\', \'cinema\', \'sealed\' or \'released\'), so a refresh re-renders that page in place instead of replaying the logo page.', ko: '이 탭이 머물러 있는 사전 공개 커튼 단계(\'gate\', \'cinema\', \'sealed\', \'released\')입니다. 새로고침하면 로고 페이지를 되풀이하지 않고 그 페이지를 제자리에서 다시 그립니다.' },
    retention: { en: 'Cleared when the tab closes; wiped on a fresh entry to the site and on a confirmed app exit; removed by the founder console\'s revoke/replay.', ko: '탭을 닫으면 삭제됩니다. 사이트에 새로 진입하거나 종료를 확정하면 지워지고, 창립자 콘솔의 해제/다시 재생 시에도 삭제됩니다.' },
  },
  {
    key: 'unitas_cinema_segment',
    storage: 'sessionStorage',
    purpose: { en: 'Which of the five cinema ad segments (1-5) is on screen, so a refresh during the ad resumes at that segment.', ko: '5개 시네마 광고 세그먼트(1~5) 중 화면에 있는 것입니다. 광고 도중 새로고침해도 그 세그먼트부터 이어집니다.' },
    retention: { en: 'Removed as soon as the cinema phase ends; cleared when the tab closes.', ko: '시네마 단계가 끝나면 바로 삭제되며, 탭을 닫아도 삭제됩니다.' },
  },
  {
    key: 'unitas_console_trigger',
    storage: 'sessionStorage',
    purpose: { en: 'The founder-console action (\'revoke\', \'splash\', or a ?dev= action) carried across a reload so the next document knows the load is a console transition. Only the founder console writes it.', ko: '새로고침을 거쳐 다음 문서로 전달되는 창립자 콘솔 동작(\'revoke\', \'splash\' 또는 ?dev= 동작)입니다. 다음 문서가 이 로드를 콘솔 전환으로 인식하게 합니다. 창립자 콘솔만 기록합니다.' },
    retention: { en: 'Cleared by the next document after it is read; cleared when the tab closes or on a fresh entry.', ko: '다음 문서가 읽은 뒤 삭제합니다. 탭을 닫거나 새로 진입할 때도 지워집니다.' },
  },
  {
    key: 'unitas_handoff',
    storage: 'sessionStorage',
    purpose: { en: 'A \'1\' flag set just before the installed app redirects itself from \'/\' to your saved language root, so the next document treats that load as a continuation, not a fresh entry.', ko: '설치된 앱이 \'/\'에서 저장된 언어 루트로 스스로 리다이렉트하기 직전에 기록하는 표시(\'1\')입니다. 다음 문서가 그 로드를 새 진입이 아닌 연속으로 처리하게 합니다.' },
    retention: { en: 'Consumed (removed) by the very next page load.', ko: '바로 다음 페이지 로드에서 소비되어 삭제됩니다.' },
  },
  {
    key: 'unitas_leave_at',
    storage: 'sessionStorage',
    purpose: { en: 'A timestamp written when the page unloads normally (pagehide). Its absence next to a live phase record tells the next load the document died without warning, so the state is restored instead of reset.', ko: '페이지가 정상적으로 언로드될 때(pagehide) 기록하는 시각입니다. 단계 기록은 있는데 이 값이 없으면 문서가 예고 없이 종료된 것으로 보고 상태를 초기화하지 않고 복원합니다.' },
    retention: { en: 'Consumed (removed) at the next page load and re-armed on the next unload; cleared when the tab closes.', ko: '다음 페이지 로드에서 소비되어 삭제되고, 다음 언로드에서 다시 기록됩니다. 탭을 닫으면 삭제됩니다.' },
  },
  {
    key: 'unitas_sovereign_panel_collapsed',
    storage: 'sessionStorage',
    purpose: { en: '\'1\' or \'0\' -- whether the founder debug panel is collapsed. Only a verified founder session ever renders the panel, so public visitors never write this.', ko: '창립자 디버그 패널이 접혀 있는지(\'1\' 또는 \'0\')입니다. 검증된 창립자 세션에서만 패널이 렌더되므로 일반 방문자에게는 기록되지 않습니다.' },
    retention: { en: 'Cleared when the tab closes.', ko: '탭을 닫으면 삭제됩니다.' },
  },
  {
    key: 'unitas_splash_active',
    storage: 'sessionStorage',
    purpose: { en: 'A \'1\' flag raised for exactly as long as the 3-second logo page is on screen, so a refresh during the logo page replays it instead of skipping ahead.', ko: '3초 로고 페이지가 화면에 있는 동안에만 켜지는 표시(\'1\')입니다. 로고 페이지 도중 새로고침하면 건너뛰지 않고 로고 페이지를 다시 재생합니다.' },
    retention: { en: 'Removed the moment the logo page finishes; cleared when the tab closes or on a fresh entry.', ko: '로고 페이지가 끝나는 순간 삭제됩니다. 탭을 닫거나 새로 진입할 때도 지워집니다.' },
  },
  {
    key: 'unitas.mail.claim.attempt.v1',
    storage: 'sessionStorage',
    purpose: { en: '\'<account id>:<handle>\' of the one @theunitas.global handle claim attempted in this tab, so a failed claim is retried on the next load rather than in a loop.', ko: '이 탭에서 시도한 @theunitas.global 핸들 등록 한 건의 \'<계정 id>:<핸들>\' 값입니다. 실패한 등록을 반복 시도하지 않고 다음 로드에서 한 번만 다시 시도하도록 합니다.' },
    retention: { en: 'Cleared when the tab closes.', ko: '탭을 닫으면 삭제됩니다.' },
  },
  {
    key: 'unitas.ouroboros.query.v1',
    storage: 'sessionStorage',
    purpose: { en: 'The text currently typed in the search bar, so a language switch (which remounts the page) restores it.', ko: '검색창에 현재 입력한 텍스트입니다. 언어를 바꾸면 페이지가 다시 마운트되는데, 그때 입력 내용을 복원합니다.' },
    retention: { en: 'Overwritten on every keystroke; cleared when the tab closes.', ko: '입력할 때마다 덮어쓰며, 탭을 닫으면 삭제됩니다.' },
  },
  {
    key: 'unitas.ouroboros.shortcut.v1',
    storage: 'sessionStorage',
    purpose: { en: '\'<group>:<key>\' of the shortcut popup that is open, so a language switch reopens the same popup.', ko: '열려 있는 숏컷 팝업의 \'<그룹>:<키>\' 값입니다. 언어를 바꿔도 같은 팝업이 다시 열리도록 합니다.' },
    retention: { en: 'Removed when the popup closes; otherwise cleared when the tab closes.', ko: '팝업을 닫으면 삭제되고, 그 외에는 탭을 닫을 때 삭제됩니다.' },
  },
  {
    key: 'unitas.qw.surface.v1',
    storage: 'sessionStorage',
    purpose: { en: 'Which cluster pop-out (and which module inside it) is open on the home, encoded as \'core/<cluster>[/<moduleId>]\', or \'-\' for explicitly closed, so a reload restores the same view.', ko: '홈에서 열려 있는 클러스터 팝아웃과 그 안의 모듈을 \'core/<클러스터>[/<모듈 id>]\' 형식으로 기록한 값입니다. \'-\'는 명시적으로 닫힘을 뜻합니다. 새로고침 뒤 같은 화면을 복원합니다.' },
    retention: { en: 'Cleared when the tab closes; wiped on a fresh entry to the site and on a confirmed app exit.', ko: '탭을 닫으면 삭제됩니다. 사이트에 새로 진입하거나 종료를 확정할 때도 지워집니다.' },
  },
  {
    key: 'unitas.selfheal.<scope>',
    storage: 'sessionStorage',
    purpose: { en: 'How many times an error screen auto-reset itself in the current window and when the first attempt was, so a persistent fault cannot turn into a reload storm.', ko: '오류 화면이 현재 구간 안에서 스스로 재시도한 횟수와 첫 시도 시각입니다. 계속되는 오류가 새로고침 폭주로 이어지지 않게 합니다.' },
    retention: { en: '30-second window with at most 2 attempts; removed after a stable render; cleared when the tab closes.', ko: '30초 구간 안에서 최대 2회까지만 유효합니다. 정상 렌더 뒤 삭제되며, 탭을 닫아도 삭제됩니다.' },
  },
];


/* ------------------------------------------------------------------ */
/* Cookie ledger (privacy / cookies page, SPEC §12.8)                  */
/* ------------------------------------------------------------------ */

export interface CookieEntry {
  /** Cookie name; `<project-ref>` is the Supabase project's first hostname label. */
  name: string;
  /** Set with HttpOnly (unreadable by page scripts). */
  httpOnly: boolean;
  purpose: { en: string; ko: string };
  /** Lifetime the code (or the library) sets, in plain words. */
  lifetime: { en: string; ko: string };
}

/** Every cookie the site, its middleware or its sign-in library sets on the
 *  visitor's device (inventory of 2026-09-13). No advertising or cross-site
 *  tracking cookie exists; the privacy and cookie pages render this list. */
export const COOKIE_LEDGER: readonly CookieEntry[] = [
  {
    name: 'unitas_sovereign',
    httpOnly: true,
    purpose: { en: 'HMAC-SHA256-signed founder session (\'v1.<expiry>.<signature>\'). It is the only thing the server trusts when deciding whether founder-only routes and UI exist for this browser. Never set for public visitors.', ko: 'HMAC-SHA256으로 서명한 창립자 세션(\'v1.<만료>.<서명>\')입니다. 이 브라우저에 창립자 전용 경로와 UI를 열지 서버가 판단할 때 신뢰하는 유일한 값입니다. 일반 방문자에게는 발급되지 않습니다.' },
    lifetime: { en: '30 days (Max-Age 2592000); HttpOnly, SameSite=Lax, Path=/, Secure on https. Deliberately not revoked on app exit; revoked only by the explicit sign-out paths above.', ko: '30일(Max-Age 2592000)입니다. HttpOnly, SameSite=Lax, Path=/, https에서는 Secure입니다. 앱 종료 시에는 일부러 유지하며, 위의 명시적 해제 경로로만 삭제됩니다.' },
  },
  {
    name: 'unitas_sovereign_hint',
    httpOnly: false,
    purpose: { en: 'A client-readable hint that a founder session may exist, so client code knows to ask GET /api/sovereign/verify and the head bootstrap can pre-paint the released home. It grants nothing by itself.', ko: '창립자 세션이 있을 수 있다는 클라이언트용 힌트입니다. 클라이언트가 GET /api/sovereign/verify로 확인하도록 하고, 헤드 부트스트랩이 공개된 홈을 미리 그릴 수 있게 합니다. 이 값만으로는 아무 권한도 생기지 않습니다.' },
    lifetime: { en: '30 days; not HttpOnly, SameSite=Lax, Path=/, Secure on https.', ko: '30일입니다. HttpOnly가 아니며 SameSite=Lax, Path=/, https에서는 Secure입니다.' },
  },
  {
    name: 'unitas_locale_pref',
    httpOnly: false,
    purpose: { en: 'Fallback copy of the language you chose manually, for browsers that block web storage but allow cookies; also read by the installed-app launch bootstrap (lib/pwa/standaloneLaunch.ts) to open your language root.', ko: '직접 선택한 언어의 예비 사본입니다. 웹 스토리지는 막고 쿠키는 허용하는 브라우저를 위한 것이며, 설치된 앱의 시작 부트스트랩(lib/pwa/standaloneLaunch.ts)이 언어 루트를 열 때도 읽습니다.' },
    lifetime: { en: '1 year (max-age 31536000); Path=/, SameSite=Lax; not HttpOnly; no Secure attribute is set.', ko: '1년(max-age 31536000)입니다. Path=/, SameSite=Lax이며 HttpOnly가 아니고 Secure 속성은 설정하지 않습니다.' },
  },
  {
    name: 'NEXT_LOCALE',
    httpOnly: false,
    purpose: { en: 'next-intl\'s locale cookie. Written only on document navigations, and only when an existing NEXT_LOCALE differs from the locale resolved from the URL, or when none exists and the browser\'s Accept-Language best match differs from the resolved locale. Because routing.ts sets localeDetection: false, the app never reads it back.', ko: 'next-intl의 언어 쿠키입니다. 문서 내비게이션에서만 기록되며, 기존 NEXT_LOCALE이 URL에서 정한 언어와 다르거나, 쿠키가 없고 브라우저 Accept-Language의 최적 언어가 정한 언어와 다를 때만 씁니다. routing.ts가 localeDetection: false이므로 앱이 이 값을 다시 읽지는 않습니다.' },
    lifetime: { en: 'Session cookie (no Max-Age/Expires -- gone when the browser closes); SameSite=Lax, Path=/; not HttpOnly.', ko: '세션 쿠키입니다(Max-Age/Expires 없음, 브라우저를 닫으면 사라집니다). SameSite=Lax, Path=/이며 HttpOnly가 아닙니다.' },
  },
  {
    name: 'sb-<project-ref>-auth-token  (split into sb-<project-ref>-auth-token.0, .1, ... when longer than 3180 bytes)',
    httpOnly: false,
    purpose: { en: 'Your Supabase Auth session (access token, refresh token, expiry and user record), base64url-encoded with a \'base64-\' prefix. Stored in a cookie rather than localStorage so the server can see who is signed in for the coin gate.', ko: 'Supabase 인증 세션(액세스 토큰, 리프레시 토큰, 만료 시각, 사용자 정보)입니다. \'base64-\' 접두어를 붙여 base64url로 인코딩합니다. 코인 게이트에서 서버가 로그인 여부를 확인할 수 있도록 localStorage가 아닌 쿠키에 저장합니다.' },
    lifetime: { en: '400 days (Max-Age 34560000), rewritten on every token refresh; removed (Max-Age 0) on sign-out. Path=/, SameSite=Lax, not HttpOnly (the browser client must read it).', ko: '400일(Max-Age 34560000)이며 토큰이 갱신될 때마다 다시 씁니다. 로그아웃하면 삭제(Max-Age 0)됩니다. Path=/, SameSite=Lax이고 브라우저 클라이언트가 읽어야 하므로 HttpOnly가 아닙니다.' },
  },
  {
    name: 'sb-<project-ref>-auth-token-code-verifier',
    httpOnly: false,
    purpose: { en: 'The PKCE code verifier for the most recently started sign-in flow, needed to complete that flow securely. Contains no personal data.', ko: '가장 최근에 시작한 로그인 흐름의 PKCE 코드 검증값입니다. 그 흐름을 안전하게 마치는 데 필요하며 개인정보는 담지 않습니다.' },
    lifetime: { en: 'Removed when the flow\'s code is exchanged or on sign-out; otherwise the adapter\'s default 400 days. Path=/, SameSite=Lax, not HttpOnly.', ko: '흐름의 코드가 교환되거나 로그아웃하면 삭제됩니다. 그 외에는 어댑터 기본값인 400일입니다. Path=/, SameSite=Lax이며 HttpOnly가 아닙니다.' },
  },
  {
    name: 'sb-<project-ref>-auth-token-flow-<flowId>-code-verifier',
    httpOnly: false,
    purpose: { en: 'Per-flow PKCE verifier slot so two sign-in attempts (for example in two tabs) do not overwrite each other. At most 5 slots exist; the oldest is evicted.', ko: '로그인 시도 두 건(예: 탭 두 개)이 서로 덮어쓰지 않도록 흐름별로 두는 PKCE 검증값 슬롯입니다. 최대 5개까지 두고 가장 오래된 것부터 지웁니다.' },
    lifetime: { en: 'Removed when that flow completes, when evicted by a 6th flow, or on sign-out; otherwise 400 days. Path=/, SameSite=Lax, not HttpOnly.', ko: '해당 흐름이 끝나거나 6번째 흐름에 밀려나거나 로그아웃하면 삭제됩니다. 그 외에는 400일입니다. Path=/, SameSite=Lax이며 HttpOnly가 아닙니다.' },
  },
  {
    name: 'sb-<project-ref>-auth-token-flows-code-verifier',
    httpOnly: false,
    purpose: { en: 'The list of pending PKCE flow ids (JSON array), which is how the library finds and cleans up the per-flow verifier slots.', ko: '진행 중인 PKCE 흐름 id 목록(JSON 배열)입니다. 라이브러리가 흐름별 검증값 슬롯을 찾아 정리하는 데 씁니다.' },
    lifetime: { en: 'Removed when no flows remain or on sign-out; otherwise 400 days. Path=/, SameSite=Lax, not HttpOnly.', ko: '남은 흐름이 없거나 로그아웃하면 삭제됩니다. 그 외에는 400일입니다. Path=/, SameSite=Lax이며 HttpOnly가 아닙니다.' },
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
