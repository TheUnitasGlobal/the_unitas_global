/**
 * REV-21 §3.2 -- source attribution by REAL name. Every reference the
 * engine shows carries the engine it came from (Wikipedia (ko), Wikidata,
 * DuckDuckGo, Google News, ...), derived from the URL at render time so
 * rows parked before REV-21 (no `origin` field) are attributed too. Pure.
 *
 * SPEC §12.4: the name table is no longer hand-written here -- it derives
 * from the omni-tech source registry (lib/uai/sourceRegistry.ts), so a
 * source renamed or retired there changes every badge at once.
 */
import { sourceForUrl, type SourceId } from './sourceRegistry';

export interface SourceName {
  /** Proper noun, not translated (Wikipedia, Wikidata, DuckDuckGo, ...). */
  name: string;
  /** Language / edition qualifier when the host carries one ('ko', 'en'). */
  lang?: string;
  /** Registry id when the host is a registered source. */
  id?: SourceId;
}

export function sourceNameOf(url: string): SourceName {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return { name: 'Web' };
  }
  const hit = sourceForUrl(url);
  if (hit) return { name: hit.source.displayName.en, lang: hit.lang, id: hit.source.id };
  // The wider Wikimedia family (meta, species, ...) -- attributed to the
  // foundation rather than a bare hostname.
  if (host === 'wikimedia.org' || host.endsWith('.wikimedia.org')) return { name: 'Wikimedia' };
  return { name: host };
}

/** "Wikipedia (ko)" / "Wikidata" -- the badge text. */
export function formatSourceName(s: SourceName): string {
  return s.lang ? `${s.name} (${s.lang})` : s.name;
}
