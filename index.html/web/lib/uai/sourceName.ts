/**
 * REV-21 §3.2 -- source attribution by REAL name. Every reference the
 * engine shows carries the engine it came from (Wikipedia (ko), Wikidata,
 * DuckDuckGo, Google News, ...), derived from the URL at render time so
 * rows parked before REV-21 (no `origin` field) are attributed too. Pure.
 */

export interface SourceName {
  /** Proper noun, not translated (Wikipedia, Wikidata, DuckDuckGo, ...). */
  name: string;
  /** Language / edition qualifier when the host carries one ('ko', 'en'). */
  lang?: string;
}

const WIKI_HOST = /^([a-z-]+)\.(wikipedia|wiktionary)\.org$/i;

export function sourceNameOf(url: string): SourceName {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return { name: 'Web' };
  }
  const wiki = WIKI_HOST.exec(host);
  if (wiki) return { name: wiki[2].toLowerCase() === 'wikipedia' ? 'Wikipedia' : 'Wiktionary', lang: wiki[1].toLowerCase() };
  if (host === 'wikidata.org') return { name: 'Wikidata' };
  if (host === 'commons.wikimedia.org') return { name: 'Wikimedia Commons' };
  if (host === 'wikimedia.org' || host.endsWith('.wikimedia.org')) return { name: 'Wikimedia' };
  if (host === 'duckduckgo.com' || host.endsWith('.duckduckgo.com')) return { name: 'DuckDuckGo' };
  if (host === 'news.google.com') return { name: 'Google News' };
  if (host === 'google.com' || host.endsWith('.google.com')) return { name: 'Google' };
  if (host === 'bing.com' || host.endsWith('.bing.com')) return { name: 'Bing News' };
  if (host === 'youtube.com' || host === 'youtu.be') return { name: 'YouTube' };
  if (host === 'hn.algolia.com' || host === 'news.ycombinator.com') return { name: 'Hacker News' };
  if (host === 'openalex.org' || host.endsWith('.openalex.org')) return { name: 'OpenAlex' };
  if (host === 'openlibrary.org') return { name: 'Open Library' };
  if (host.endsWith('open-meteo.com')) return { name: 'Open-Meteo' };
  if (host === 'earthquake.usgs.gov') return { name: 'USGS' };
  if (host.endsWith('worldbank.org')) return { name: 'World Bank' };
  if (host === 'api.frankfurter.app') return { name: 'Frankfurter' };
  if (host.endsWith('coingecko.com')) return { name: 'CoinGecko' };
  if (host.endsWith('metmuseum.org')) return { name: 'The Met' };
  return { name: host };
}

/** "Wikipedia (ko)" / "Wikidata" -- the badge text. */
export function formatSourceName(s: SourceName): string {
  return s.lang ? `${s.name} (${s.lang})` : s.name;
}
