/**
 * REV-23 M3.4 -- "전 세계 최고 수상" (founder directive 2026-09-13, MISSION 3).
 *
 * A new shortcut theme with no counterpart anywhere else on the site: the
 * world's most consequential prizes, each showing WHO most recently won it
 * and in what year. It is a deliberate answer to the overlap problem M3.1
 * solves -- the shortcut rail is data now, not news, and a laureate roll is
 * about as far from a headline wire as a live surface can get.
 *
 * SOURCE, AND WHY NOT SPARQL. The obvious way to ask "who received award X"
 * is a Wikidata SPARQL query, because P166 (award received) points from the
 * person TO the award and only SPARQL does reverse lookups cleanly. Measured
 * 2026-09-13, `query.wikidata.org` was returning
 *
 *     429  Aggressively rate-limiting to 1 req / min
 *          this rule was created during active wdqs outage
 *
 * on every single request. A user-facing card cannot be built on an endpoint
 * that answers once a minute for the whole planet. So this uses the ordinary
 * MediaWiki API instead, in two keyless CORS-`*` calls:
 *
 *   1. `list=search&srsearch=haswbstatement:P166=<award>` -- CirrusSearch's
 *      statement index does the reverse lookup;
 *   2. `wbgetentities` over those ids for labels in the visitor's own
 *      language plus the `point in time` (P585) qualifier on the matching
 *      P166 statement, which is what lets the roll be sorted newest-first.
 *
 * Both go through `deeperFetchJson`, so they are serialized under the same
 * Wikimedia spacing as every other leg. 0원 -- no key, no paid endpoint.
 *
 * CirrusSearch ranks by relevance, not recency, so the roll is "the most
 * recent among the 50 best-known recipients" rather than a guaranteed
 * global maximum. That is the honest bound of the cheap path, and it is
 * stated on the card rather than hidden.
 *
 * ROTATION. Sixteen awards is far more than one card can show, so the card
 * shows ONE award per day, chosen deterministically from the day index --
 * the same "SSR and CSR agree on the first frame" rule the discovery
 * carousel already uses.
 */
import { deeperFetchJson } from '@/lib/uai/deeperFetch';

export type AwardKey =
  | 'nobelPhysics'
  | 'nobelChemistry'
  | 'nobelMedicine'
  | 'nobelLiterature'
  | 'nobelPeace'
  | 'nobelEconomics'
  | 'turing'
  | 'fields'
  | 'academyBestPicture'
  | 'palmeDor'
  | 'grammyRecord'
  | 'pulitzer'
  | 'booker'
  | 'pritzker'
  | 'ballonDor'
  | 'timePerson';

export interface AwardTheme {
  key: AwardKey;
  /** The Wikidata item of the AWARD itself (every id label-verified live). */
  qid: string;
  /** Fallback English name, used when a label lookup comes back empty. */
  en: string;
  /** Broad family, for the card's secondary line. */
  field: 'science' | 'letters' | 'arts' | 'peace' | 'sport';
}

/**
 * The sixteen. Chosen for global recognition rather than completeness: each
 * is the single most-cited prize of its field, so the rail never shows two
 * awards a visitor would confuse for each other. The founder named the six
 * Nobels, a world music award, a film award and the Pulitzer explicitly; the
 * rest fill the fields those leave open (mathematics, computing,
 * architecture, football, and the one honour that is not a field at all).
 */
export const AWARD_THEMES: readonly AwardTheme[] = [
  { key: 'nobelPhysics', qid: 'Q38104', en: 'Nobel Prize in Physics', field: 'science' },
  { key: 'nobelChemistry', qid: 'Q44585', en: 'Nobel Prize in Chemistry', field: 'science' },
  { key: 'nobelMedicine', qid: 'Q80061', en: 'Nobel Prize in Physiology or Medicine', field: 'science' },
  { key: 'nobelLiterature', qid: 'Q37922', en: 'Nobel Prize in Literature', field: 'letters' },
  { key: 'nobelPeace', qid: 'Q35637', en: 'Nobel Peace Prize', field: 'peace' },
  { key: 'nobelEconomics', qid: 'Q47170', en: 'Prize in Economic Sciences in Memory of Alfred Nobel', field: 'science' },
  { key: 'turing', qid: 'Q185667', en: 'Turing Award', field: 'science' },
  { key: 'fields', qid: 'Q28835', en: 'Fields Medal', field: 'science' },
  { key: 'academyBestPicture', qid: 'Q102427', en: 'Academy Award for Best Picture', field: 'arts' },
  { key: 'palmeDor', qid: 'Q179808', en: "Palme d'Or", field: 'arts' },
  { key: 'grammyRecord', qid: 'Q843219', en: 'Grammy Award for Record of the Year', field: 'arts' },
  { key: 'pulitzer', qid: 'Q46525', en: 'Pulitzer Prize', field: 'letters' },
  { key: 'booker', qid: 'Q160082', en: 'Booker Prize', field: 'letters' },
  { key: 'pritzker', qid: 'Q133160', en: 'Pritzker Architecture Prize', field: 'arts' },
  { key: 'ballonDor', qid: 'Q166177', en: "Ballon d'Or", field: 'sport' },
  { key: 'timePerson', qid: 'Q207826', en: 'Time Person of the Year', field: 'peace' },
];

export const AWARD_KEYS: readonly AwardKey[] = AWARD_THEMES.map((a) => a.key);

export function findAward(key: AwardKey): AwardTheme {
  return AWARD_THEMES.find((a) => a.key === key) ?? AWARD_THEMES[0];
}

/**
 * Which award today's card shows. Deterministic in `dayIndex` so SSR and the
 * first client frame agree, and so the whole roll is seen over 16 days.
 */
export function awardOfDay(dayIndex: number): AwardTheme {
  const n = AWARD_THEMES.length;
  return AWARD_THEMES[((Math.trunc(dayIndex) % n) + n) % n];
}

export interface Laureate {
  qid: string;
  name: string;
  /** Four-digit year from the P585 qualifier, when the statement carries one. */
  year?: string;
  url: string;
}

export interface AwardRoll {
  award: AwardTheme;
  /** Most recent first; undated recipients sort last. */
  laureates: Laureate[];
  /** The most recent year found, for the card's emphasised fact. */
  latestYear?: string;
}

/** How many statement-index hits are pulled before sorting by year. */
export const AWARD_SEARCH_LIMIT = 50;
/** How many laureates the card shows. */
export const AWARD_CARD_ITEMS = 5;

interface SearchResponse {
  query?: { search?: Array<{ title?: string }> };
}

interface EntitiesResponse {
  entities?: Record<
    string,
    {
      labels?: Record<string, { value?: string }>;
      claims?: Record<
        string,
        Array<{
          mainsnak?: { datavalue?: { value?: { id?: string } } };
          qualifiers?: Record<string, Array<{ datavalue?: { value?: { time?: string } } }>>;
        }>
      >;
    }
  >;
}

/** `'+2022-10-04T00:00:00Z'` -> `'2022'`. */
function yearOf(time: string | undefined): string | undefined {
  const m = /^[+-]?(\d{4})/.exec(time ?? '');
  return m ? m[1] : undefined;
}

/**
 * Most recent recipients of one award, newest first. Returns `null` on any
 * failure or empty answer -- the caller is fail-open by contract, so a card
 * that cannot load simply does not render rather than breaking the rail.
 */
export async function loadAwardRoll(
  award: AwardTheme,
  lang: string,
  signal?: AbortSignal,
): Promise<AwardRoll | null> {
  const search = await deeperFetchJson<SearchResponse>(
    `https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      `haswbstatement:P166=${award.qid}`,
    )}&srlimit=${AWARD_SEARCH_LIMIT}&format=json&origin=*`,
    { signal },
  );
  const ids = (search?.query?.search ?? [])
    .map((hit) => hit.title)
    .filter((id): id is string => /^Q\d+$/.test(id ?? ''))
    .slice(0, AWARD_SEARCH_LIMIT);
  if (ids.length === 0) return null;

  const entities = await deeperFetchJson<EntitiesResponse>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join(
      '|',
    )}&props=labels%7Cclaims&languages=${encodeURIComponent(lang)}%7Cen&format=json&origin=*`,
    { signal },
  );
  if (!entities?.entities) return null;

  const laureates: Laureate[] = [];
  for (const qid of ids) {
    const entity = entities.entities[qid];
    if (!entity) continue;
    const name = (entity.labels?.[lang]?.value ?? entity.labels?.en?.value ?? '').trim();
    if (!name) continue;
    // The person can hold several P166 statements; only the one pointing at
    // THIS award carries the year we want.
    const statement = (entity.claims?.P166 ?? []).find(
      (st) => st.mainsnak?.datavalue?.value?.id === award.qid,
    );
    laureates.push({
      qid,
      name,
      year: yearOf(statement?.qualifiers?.P585?.[0]?.datavalue?.value?.time),
      url: `https://www.wikidata.org/wiki/${qid}`,
    });
  }
  if (laureates.length === 0) return null;

  laureates.sort((a, b) => (b.year ?? '0000').localeCompare(a.year ?? '0000'));
  return {
    award,
    laureates: laureates.slice(0, AWARD_CARD_ITEMS),
    latestYear: laureates.find((l) => l.year)?.year,
  };
}
