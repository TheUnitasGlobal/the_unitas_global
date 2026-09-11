# REV-20 PHASE 1 — 무키·0원 데이터 소스 실측 매트릭스

2026-09-11 실호출 검증. 스크립트: `scratchpad/probe-sources.mjs`, `probe-cors.mjs`, `probe-locales.mjs`.
CORS 열은 `Origin: https://www.theunitas.global` 를 보낸 응답의 `Access-Control-Allow-Origin`.
**주의**: 1차 프로브는 Origin 헤더를 보내지 않아 CORS 를 과소 판정했다. 아래는 재검증 후 값이다.

## A. 브라우저 직접 호출 가능 (CORS `*`) · 키 없음 · 무료

| 소스 | 엔드포인트 | 페이지네이션 | 실측 |
|---|---|---|---|
| Wikipedia Action `list=search` | `https://<lang>.wikipedia.org/w/api.php?action=query&list=search&srsearch=&srlimit=50&sroffset=N&format=json&origin=*` | **`sroffset` 연속** (응답에 `continue.sroffset` 반환) | 200 / 42KB / 1.1s, p2 확인 |
| Wikipedia Action `generator=search` + `prop=extracts` | `...&generator=search&gsrsearch=&gsrlimit=10&prop=extracts&exintro=1&explaintext=1` | **`gsroffset` 연속** | 200 / 16KB / 0.4s |
| Wikipedia Action `prop=links` | `...&titles=&prop=links&pllimit=100` | **`plcontinue` 연속** | 200 / 3.9KB |
| Wikipedia Action `prop=categories` | `...&prop=categories&cllimit=100` | `clcontinue` | 200 / 2.4KB |
| Wikipedia Action `list=geosearch` | `...&list=geosearch&gscoord=lat\|lon&gsradius=10000&gslimit=50` | `gscontinue` | 200 / 7.7KB |
| Wikipedia Action `generator=random` | `...&generator=random&grnnamespace=0&grnlimit=20&prop=extracts` | 매 호출 새 표본 | 200 / 17KB |
| Wikipedia 날짜 문서 | `...&titles=<로케일 날짜명>&prop=extracts&explaintext=1` | 섹션 분할 | ko 16KB · ja 58KB · et 5KB · en 37KB |
| Wikimedia pageviews top | `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/<lang>.wikipedia/all-access/Y/M/D` | 상위 1000 → 클라이언트 분할 | 43~56KB, 전 로케일 위키 동작 |
| Wikimedia featured | `https://api.wikimedia.org/feed/v1/wikipedia/<lang>/featured/Y/M/D` | 단발 | ko 200 |
| Wikimedia onthisday | `.../feed/v1/wikipedia/<lang>/onthisday/selected\|events/MM/DD` | events 배열 20~40 | **en·zh·de·pt 만 200. ko·et·ja·vi·id·pl·nl 는 404** |
| Wikidata `wbsearchentities` | `https://www.wikidata.org/w/api.php?action=wbsearchentities&limit=50&continue=N` | **`search-continue`** | 200 / 24KB |
| Hacker News (Algolia) | `https://hn.algolia.com/api/v1/search?query=&page=N&hitsPerPage=50` | **`page` 0~19 (nbPages=20)** | 200 / 68KB, 최대 1000건 |
| StackExchange | `https://api.stackexchange.com/2.3/search/advanced?...&page=N&pagesize=30` | `page` | 200 / 23KB |
| Crossref | `https://api.crossref.org/works?query=&rows=20&offset=N` | `offset` | 200, total 10,177 |
| OpenAlex | `https://api.openalex.org/works?search=&per-page=25&page=N` | **`page`** | 200 / 417KB, count 112,933 |
| OpenLibrary | `https://openlibrary.org/search.json?q=&page=N&limit=20` | `page` | 200 |
| USGS 지진 | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` · `2.5_week.geojson` | 배열 분할 | 263 features / 일, 주간 243KB |
| Frankfurter (ECB 환율) | `https://api.frankfurter.app/latest?from=` · `YYYY-MM-DD..YYYY-MM-DD` | 기간 질의 | 200 |
| CoinGecko | `/api/v3/coins/markets?vs_currency=&order=market_cap_desc&per_page=20&page=N` | **`page`** | 200 / 16KB |
| Open-Meteo 예보 | `https://api.open-meteo.com/v1/forecast` | — | 이미 사용 중 |
| Open-Meteo 대기질 | `https://air-quality-api.open-meteo.com/v1/air-quality` | — | 200 |
| World Bank | `https://api.worldbank.org/v2/country/<iso>/indicator/<code>?format=json&per_page=&page=` | `page` | 200 |
| GBIF | `https://api.gbif.org/v1/occurrence/search?q=&limit=20&offset=N` | `offset` | 200 / 101KB |
| Met Museum | `/public/collection/v1/search?q=` → `/objects/<id>` | objectIDs 배열 분할 | total 2,355 ("moon") |
| sunrise-sunset | `https://api.sunrise-sunset.org/json?lat=&lng=&formatted=0` | — | 200 |

## B. 서버 프록시 필요 (CORS 없음) — 기존 `/api/live/*` 패턴 재사용

`arxiv`(export.arxiv.org), `ssd-api.jpl.nasa.gov`, Google/Bing 뉴스 RSS(이미 프록시 중), `api.spacexdata.com`(525).

## C. 사용 불가

- `en.wikipedia.org/api/rest_v1/page/related/<title>` → **403**. 현재 코드는 미사용이므로 영향 없음.
- `api.open-notify.org` (ISS) → `http://` 전용이라 HTTPS 페이지에서 혼합 콘텐츠 차단.
- `openlibrary.org/trending/daily.json` → 타임아웃.

## D. 운영 제약 (실측으로 드러남)

1. **Wikimedia 계열은 병렬 버스트에 429**. 20개 로케일을 동시에 치면 대부분 429가 떨어지고, 1.2초 간격 직렬 호출에서는 전부 200. → 20로케일 프리워밍은 반드시 서버 크론에서 직렬·스로틀로 수행하고 CDN 캐시로 흡수해야 한다. 브라우저 팬아웃 금지.
2. **onthisday 피드는 로케일 구멍이 크다**. 20로케일 중 4개만 지원. → "오늘의 역사" 테마의 정본 소스는 **로케일 위키의 날짜 문서**(전 로케일 200 확인)로 하고, onthisday 피드는 지원 언어에서만 보강한다.
3. 현재 코드의 웹 합성 상한(`MAX_SOURCES 8` · `MAX_SNIPPET 260` · `MAX_DIGEST 2800`)은 소스의 한계가 아니라 **우리가 건 상한**이다. `generator=search&prop=extracts` 한 번이면 10개 문서의 실제 도입부 전문을 받는다. 요구 4·5의 "정보가 빈약하면 U-AI는 실패"는 새 API 없이 기존 소스의 상한만 올려도 10배 이상 해소된다.
