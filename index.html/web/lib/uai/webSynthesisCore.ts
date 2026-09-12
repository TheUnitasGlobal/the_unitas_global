import type { WebAnchor, WebSynthesis, WebSource } from './types';
import { entitySearchUrl, isExcludedCrossClass, parseEntityPages, wikidataInstanceOf, type WikiEntityPage } from './entityResolve';

/**
 * Isomorphic core of the zero-cost "live web synthesis" -- the pure
 * fetch-and-fold pass shared by the browser edge (webSynthesis.ts: flag +
 * localStorage cache) and the 24h sovereign caching engine on the server
 * (shortcutCache.ts: batch-synthesizes every shortcut tier once a day and
 * parks the result in Postgres so visitors never trigger a fetch at all).
 *
 * No `window`, no `localStorage`, no env flag in here -- only keyless,
 * CORS-enabled public endpoints (DuckDuckGo IA, <lang>.wikipedia REST, the
 * anchored en.wikipedia summary, Wikidata entity search, optional
 * self-hosted SearXNG). Cost stays exactly 0원 on either side of the wire.
 * Never throws: every failure path returns `sourced: false` with the
 * identical shape.
 *
 * REV-21 §2.2 -- "검색어를 던지지 않는다". The raw locale query is sent to
 * the visitor's OWN-LANGUAGE Wikipedia only. Every other engine is reached
 * through the entity that search resolved (its Wikidata QID and English
 * langlink): the English Wikipedia by EXACT title, DuckDuckGo by the
 * English title, Wikidata label hits filtered to the same item or to items
 * that are not a film / series / song / person sharing the label. That is
 * what stops '공기' (air) from surfacing a children's game, a singer and a
 * TV series that merely quote the string.
 */

/** next-intl locale -> Wikipedia language subdomain (all of these exist). */
export const WIKI_LANG: Record<string, string> = {
  en: 'en',
  ko: 'ko',
  ja: 'ja',
  zh: 'zh',
  es: 'es',
  et: 'et',
  km: 'km',
  fr: 'fr',
  de: 'de',
  pt: 'pt',
  vi: 'vi',
  id: 'id',
  ru: 'ru',
  hi: 'hi',
  it: 'it',
  tr: 'tr',
  th: 'th',
  pl: 'pl',
  nl: 'nl',
  tl: 'tl',
};

// REV-20 §6.1: these were an artificial ceiling, not a source limitation --
// docs/rev20/measure/sources.md proved a single extra Action API leg
// (`generator=search&prop=extracts`) alone returns 10 full intro extracts
// per call, `gsroffset`-continuable. Raising the caps here (zero new paid
// APIs, zero new round-trips beyond the one leg added below) takes a
// keyword's real digest text from ~820 chars to 10,000+.
export const MAX_DIGEST = 6000;
const MAX_SNIPPET = 600;
const MAX_SOURCES = 24;
/** Per-document cap for the full-extract leg's contribution to the digest --
 *  bounds any single long article from crowding out every other source
 *  while still carrying real body text, not just a headline snippet. */
const MAX_EXTRACT_DIGEST = 1000;
/** REV-21 §2.2: how many same-label Wikidata strays may be class-checked. */
const MAX_WIKIDATA_CROSS = 3;

export const EMPTY_SYNTHESIS = (lang: string | null): WebSynthesis => ({
  sourced: false,
  sources: [],
  digest: '',
  lang,
  fetchedAt: Date.now(),
});

export function stripControl(s: string): string {
  return Array.from(s)
    .filter((ch) => ch === '\n' || ch === '\t' || (ch >= ' ' && ch !== ''))
    .join('')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RestSearchResponse {
  pages?: Array<{ key?: string; title?: string; excerpt?: string; description?: string }>;
}
interface RestSummaryResponse {
  title?: string;
  extract?: string;
  description?: string;
  type?: string;
  content_urls?: { desktop?: { page?: string } };
}
interface WikidataSearchEntity {
  id?: string;
  label?: string;
  description?: string;
  concepturi?: string;
  match?: { type?: string };
}
interface WikidataResponse {
  search?: WikidataSearchEntity[];
}
interface WikidataSitelinksResponse {
  entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }>;
}
interface DdgRelatedTopic {
  Text?: string;
  FirstURL?: string;
  Name?: string;
  Topics?: DdgRelatedTopic[];
}
interface DdgResponse {
  Type?: string;
  Heading?: string;
  AbstractText?: string;
  Abstract?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  Answer?: string;
  Definition?: string;
  DefinitionURL?: string;
  RelatedTopics?: DdgRelatedTopic[];
}
interface SearxResponse {
  results?: Array<{ title?: string; url?: string; content?: string }>;
}
interface ActionExtractPage extends WikiEntityPage {
  pageid?: number;
  extract?: string;
}
interface ActionGeneratorResponse {
  query?: { pages?: ActionExtractPage[] | Record<string, ActionExtractPage> };
}

/** Identifies the server-side batch synthesizer to the public endpoints,
 *  per Wikimedia's User-Agent policy (browsers set their own UA). */
const SERVER_UA = 'UNITAS-ShortcutCache/1.0 (https://www.theunitas.global; ceo@theunitas.global)';

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (typeof window === 'undefined') headers['user-agent'] = SERVER_UA;
    const res = await fetch(url, { signal, headers });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function wikiSearch(lang: string, query: string, limit: number, signal: AbortSignal) {
  return fetchJson<RestSearchResponse>(
    `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=${limit}`,
    signal,
  );
}

export function wikiSummary(lang: string, title: string, signal: AbortSignal) {
  return fetchJson<RestSummaryResponse>(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    signal,
  );
}

/** REV-20 §6.1: Wikipedia Action API, `generator=search` + `prop=extracts`
 *  -- one keyless CORS `*` call returns the FULL plaintext intro of up to
 *  `limit` matching articles (verified live, docs/rev20/measure/sources.md
 *  row "wiki.action.extracts"). REV-21 §2.2 rides the entity anchor on the
 *  same call (`prop=extracts|langlinks|pageprops`): the top hit's Wikidata
 *  item + English langlink arrive with zero extra round-trips. */
export function wikiGeneratorExtracts(lang: string, query: string, limit: number, signal: AbortSignal, offset = 0) {
  const extra = `|extracts&exintro=1&explaintext=1&exlimit=max${offset > 0 ? `&gsroffset=${offset}` : ''}`;
  return fetchJson<ActionGeneratorResponse>(entitySearchUrl(lang, query, limit, extra), signal);
}

/** DuckDuckGo Instant Answer API — keyless, CORS `*`. A real open-web meta
 *  search edge (abstract + related topics span the whole web, not one wiki).
 *  REV-21: called with the ENGLISH title only, and a disambiguation answer
 *  (`Type: 'D'` -- "Air Jordan", "MacBook Air") is discarded whole. */
export function ddgSearch(query: string, signal: AbortSignal) {
  return fetchJson<DdgResponse>(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1&skip_disambig=1&t=unitas`,
    signal,
  );
}

/** Optional self-hosted SearXNG JSON search — only when an instance URL that
 *  returns CORS headers is supplied. Fail-open. */
function searxSearch(searx: string, query: string, lang: string, signal: AbortSignal) {
  if (!searx) return Promise.resolve<SearxResponse | null>(null);
  return fetchJson<SearxResponse>(
    `${searx}/search?q=${encodeURIComponent(query)}&format=json&safesearch=1&language=${encodeURIComponent(lang)}`,
    signal,
  );
}

/** Flatten DDG RelatedTopics (one level of nesting) into {text,url} rows. */
function flattenDdgTopics(topics: DdgRelatedTopic[] | undefined): Array<{ text: string; url?: string }> {
  const out: Array<{ text: string; url?: string }> = [];
  (topics ?? []).forEach((t) => {
    if (t.Text) out.push({ text: stripControl(t.Text), url: t.FirstURL });
    (t.Topics ?? []).forEach((s) => {
      if (s.Text) out.push({ text: stripControl(s.Text), url: s.FirstURL });
    });
  });
  return out.filter((r) => r.text);
}

function extractPagesOf(json: ActionGeneratorResponse | null): ActionExtractPage[] {
  const raw = json?.query?.pages;
  const list = Array.isArray(raw) ? raw : Object.values(raw ?? {});
  return list
    .filter((p): p is ActionExtractPage => Boolean(p && p.title))
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

export interface CollectOptions {
  /** hard abort for the whole pass (both batches). */
  abortMs: number;
  /** self-hosted SearXNG base url ('' = off). */
  searx?: string;
}

/**
 * Collect a wide slice of real online references for `query` in `lang` and
 * fold them into one control-stripped digest. Returns `sourced: false`
 * (never throws) on any failure or when nothing was found.
 */
export async function collectWebSynthesis(
  query: string,
  lang: string,
  { abortMs, searx = '' }: CollectOptions,
): Promise<WebSynthesis> {
  const trimmed = query.trim();
  if (!trimmed) return EMPTY_SYNTHESIS(lang);
  const searxBase = searx.replace(/\/+$/, '');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), abortMs);

  try {
    // ---- Batch 1: own-language wide net (parallel) -------------------------
    // The raw query reaches ONLY the visitor's own wiki, Wikidata (in that
    // language) and the optional SearXNG. No English engine sees it.
    const [primary, wikidata, searxRes, extracts] = await Promise.all([
      wikiSearch(lang, trimmed, 10, controller.signal),
      fetchJson<WikidataResponse>(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
          trimmed,
        )}&language=${lang}&uselang=${lang}&type=item&format=json&origin=*&limit=7`,
        controller.signal,
      ),
      searxSearch(searxBase, trimmed, lang, controller.signal),
      wikiGeneratorExtracts(lang, trimmed, 10, controller.signal),
    ]);

    const pages = (primary?.pages ?? []).filter((p) => p.title);
    const extractPages = extractPagesOf(extracts).filter((p) => p.extract);
    const searxResults = (searxRes?.results ?? []).filter((r) => r.title && r.content);

    // The entity anchor: the top non-disambiguation hit of the extracts leg
    // (same call, zero extra round-trips). Its QID/English title is the only
    // thing any cross-language leg below is allowed to use.
    const resolved = parseEntityPages({ query: { pages: extractPagesOf(extracts) } }, lang);
    const anchor: WebAnchor | undefined = resolved
      ? { qid: resolved.qid, localeTitle: resolved.localeTitle, enTitle: resolved.enTitle, disambiguation: resolved.disambiguation }
      : undefined;
    const enTitle = anchor && !anchor.disambiguation ? anchor.enTitle : undefined;

    // Wikidata: label matches only (never alias strays like '공기업'); the
    // anchor's own item leads; up to MAX_WIKIDATA_CROSS other same-label
    // items are class-checked in batch 2.
    const labelHits = (wikidata?.search ?? []).filter((e) => e.label && e.id && (e.match?.type ?? 'label') === 'label');
    const anchorHit = anchor?.qid ? labelHits.find((e) => e.id === anchor.qid) : undefined;
    const crossHits = labelHits.filter((e) => e.id !== anchor?.qid).slice(0, MAX_WIKIDATA_CROSS);

    if (pages.length === 0 && labelHits.length === 0 && searxResults.length === 0 && extractPages.length === 0) {
      clearTimeout(timer);
      return EMPTY_SYNTHESIS(lang);
    }

    // ---- Batch 2: enrich (parallel) ----------------------------------------
    // Own-language REST summaries for the top hits, the anchored ENGLISH
    // summary by exact title, DDG on the English title, and the P31 /
    // sitelink checks for same-label Wikidata strays.
    const crossIds = crossHits.map((e) => e.id!);
    const [summaries, enSummary, enRelated, ddg, sitelinks, classes] = await Promise.all([
      Promise.all(pages.slice(0, 3).map((p) => wikiSummary(lang, p.key ?? p.title!, controller.signal))),
      enTitle && lang !== 'en' ? wikiSummary('en', enTitle, controller.signal) : Promise.resolve<RestSummaryResponse | null>(null),
      enTitle && lang !== 'en' ? wikiSearch('en', enTitle, 4, controller.signal) : Promise.resolve<RestSearchResponse | null>(null),
      enTitle ? ddgSearch(enTitle, controller.signal) : Promise.resolve<DdgResponse | null>(null),
      crossIds.length > 0
        ? fetchJson<WikidataSitelinksResponse>(
            `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${crossIds.join('|')}&props=sitelinks&sitefilter=${lang}wiki&format=json&origin=*`,
            controller.signal,
          )
        : Promise.resolve<WikidataSitelinksResponse | null>(null),
      Promise.all(crossIds.map((id) => wikidataInstanceOf(id, controller.signal))),
    ]);
    clearTimeout(timer);

    const sources: WebSource[] = [];
    const digestParts: string[] = [];
    const groundingParts: string[] = [];
    const wikiUrl = (l: string, title: string) => `https://${l}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

    pages.slice(0, 3).forEach((p, i) => {
      const sum = summaries[i];
      const snippetRaw = sum?.extract || stripControl(p.excerpt ?? '') || p.description || '';
      const snippet = stripControl(snippetRaw).slice(0, MAX_SNIPPET);
      const url = sum?.content_urls?.desktop?.page || wikiUrl(lang, p.key ?? p.title!);
      if (snippet) {
        const isAnchor = anchor && (sum?.title === anchor.localeTitle || p.title === anchor.localeTitle);
        sources.push({ title: stripControl(sum?.title || p.title || ''), url, snippet, lang, origin: 'wiki', qid: isAnchor ? anchor?.qid : undefined });
        digestParts.push(snippet);
        groundingParts.push(snippet);
      }
    });

    // The anchored English summary: exactly one page, reached by title.
    const enExtract = stripControl(enSummary?.extract ?? '').slice(0, MAX_SNIPPET);
    if (enExtract && enTitle) {
      digestParts.push(enExtract);
      groundingParts.push(enExtract);
      sources.push({
        title: stripControl(enSummary?.title || enTitle),
        url: enSummary?.content_urls?.desktop?.page || wikiUrl('en', enTitle),
        snippet: enExtract,
        lang: 'en',
        origin: 'wiki-en',
        qid: anchor?.qid,
      });
    }

    // Wikidata: the anchor item first, then same-label items that survived
    // the class gate AND exist on the visitor's own wiki.
    const keptEntities: WikidataSearchEntity[] = [];
    if (anchorHit) keptEntities.push(anchorHit);
    crossHits.forEach((e, i) => {
      const hasSitelink = Boolean(sitelinks?.entities?.[e.id!]?.sitelinks?.[`${lang}wiki`]?.title);
      if (!hasSitelink || isExcludedCrossClass(classes[i] ?? [])) return;
      keptEntities.push(e);
    });
    keptEntities.forEach((e) => {
      if (!e.description) return;
      const line = stripControl(`${e.label ?? ''} — ${e.description ?? ''}`);
      digestParts.push(line);
      if (e.concepturi && sources.length < MAX_SOURCES) {
        sources.push({
          title: stripControl(e.label ?? ''),
          url: e.concepturi,
          snippet: stripControl(e.description ?? ''),
          lang,
          origin: 'wikidata',
          qid: e.id,
        });
      }
    });

    // Remaining own-language hits contribute title + one-line description to
    // the digest only (no extra round-trips).
    pages.slice(3, 10).forEach((p) => {
      const line = stripControl(`${p.title ?? ''} ${p.description ?? p.excerpt ?? ''}`);
      if (line) digestParts.push(line);
    });

    // English neighbours of the ANCHORED title (search term = the English
    // title, never the raw query); the anchor page itself is already in.
    (enRelated?.pages ?? [])
      .filter((p) => p.title && p.title !== enTitle && p.title !== enSummary?.title)
      .slice(0, 3)
      .forEach((p) => {
        const line = stripControl(`${p.title ?? ''} ${p.description ?? p.excerpt ?? ''}`);
        if (line) digestParts.push(line);
        if (sources.length < MAX_SOURCES) {
          sources.push({
            title: stripControl(p.title!),
            url: wikiUrl('en', p.title!),
            snippet: stripControl(p.description ?? p.excerpt ?? ''),
            lang: 'en',
            origin: 'wiki-en',
          });
        }
      });

    // DuckDuckGo on the English title: an article-type answer becomes a lead
    // source; a disambiguation answer (Type 'D') is dropped entirely.
    const ddgUsable = ddg && ddg.Type !== 'D';
    const ddgTopics = ddgUsable ? flattenDdgTopics(ddg?.RelatedTopics) : [];
    const ddgAbstract = ddgUsable ? stripControl(ddg?.AbstractText || ddg?.Abstract || ddg?.Answer || ddg?.Definition || '') : '';
    if (ddgAbstract) {
      digestParts.unshift(ddgAbstract.slice(0, MAX_SNIPPET));
      if (ddg?.AbstractURL && sources.length < MAX_SOURCES) {
        sources.unshift({
          title: stripControl(ddg.Heading || enTitle || trimmed),
          url: ddg.AbstractURL,
          snippet: ddgAbstract.slice(0, MAX_SNIPPET),
          lang: 'en',
          origin: 'ddg',
        });
      }
    }
    ddgTopics.slice(0, 8).forEach((topic) => {
      digestParts.push(topic.text);
      if (topic.url && sources.length < MAX_SOURCES) {
        sources.push({
          title: topic.text.split(' - ')[0].slice(0, 90),
          url: topic.url,
          snippet: topic.text.slice(0, MAX_SNIPPET),
          lang: 'en',
          origin: 'ddg',
        });
      }
    });

    // SearXNG (optional self-hosted): title + content snippet per result.
    searxResults.slice(0, 6).forEach((r) => {
      const snippet = stripControl(r.content ?? '').slice(0, MAX_SNIPPET);
      if (snippet) digestParts.push(`${stripControl(r.title ?? '')} ${snippet}`);
      if (r.url && sources.length < MAX_SOURCES) {
        sources.push({ title: stripControl(r.title ?? ''), url: r.url, snippet, lang, origin: 'searx' });
      }
    });

    // REV-20 §6.1: full intro extracts -- the real depth leg. Each article's
    // opening section (capped per-doc so no single long page crowds out the
    // rest) becomes both a digest slab and its own source with a fuller
    // (MAX_SNIPPET, not per-doc-capped) preview.
    extractPages.slice(0, 10).forEach((p) => {
      const full = stripControl(p.extract ?? '');
      if (!full) return;
      digestParts.push(full.slice(0, MAX_EXTRACT_DIGEST));
      if (p.title === anchor?.localeTitle) groundingParts.push(full.slice(0, MAX_EXTRACT_DIGEST));
      if (sources.length < MAX_SOURCES) {
        sources.push({
          title: stripControl(p.title ?? ''),
          url: wikiUrl(lang, p.title ?? ''),
          snippet: full.slice(0, MAX_SNIPPET),
          lang,
          origin: 'wiki',
          qid: p.pageprops?.wikibase_item,
        });
      }
    });

    const digest = stripControl(digestParts.join('  ')).slice(0, MAX_DIGEST);
    const grounding = stripControl(groundingParts.join('  ')).slice(0, MAX_DIGEST);
    return {
      sourced: sources.length > 0,
      sources: sources.slice(0, MAX_SOURCES),
      digest,
      grounding,
      anchor,
      lang,
      fetchedAt: Date.now(),
    };
  } catch {
    clearTimeout(timer);
    return EMPTY_SYNTHESIS(lang);
  }
}
