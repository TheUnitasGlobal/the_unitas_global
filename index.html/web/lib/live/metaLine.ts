/**
 * REV-34 M1-B (founder directive 2026-09-16) -- the ONE meta-line formatter.
 *
 * Every footer on the shortcut strip and its deep modals (discovery card,
 * feed / ranking / weather modal, news card, news axis modal, weather panel)
 * used to carry its own wording -- "갱신 {time}", "카드 갱신: 10분마다 ·
 * 딥다이브: 60초마다", "{count}건 · {source}", "갱신 {time} · {source}" -- and
 * three of them built their own `Intl.DateTimeFormat`. The founder ordered
 * the news rail's "건 · 출처 ~ 갱신" shape to be THE format, so this module
 * owns the values that go into `Rev34.meta.line` and the single HH:mm
 * formatter behind them. Pure (no React, no next-intl) so it is unit-tested
 * on its own and cannot drift between hosts.
 */

export interface MetaLineInput {
  /** Rows the surface is showing (stories, items, forecast days...). */
  count: number;
  /** The already-translated source sentence (`HotNews.source`,
   *  `Rev19.hub.sources`, `Weather.source`, a provider name). */
  source: string;
  /** Epoch ms of the last successful load; absent / 0 renders a dash. */
  updatedAt?: number | null;
}

export interface MetaLineArgs {
  count: number;
  source: string;
  updated: string;
}

/** What `{updated}` shows before the first load has landed. */
export const META_TIME_PLACEHOLDER = '—';

const formatters = new Map<string, Intl.DateTimeFormat>();

/** One HH:mm formatter per locale, memoised for the session -- constructing
 *  `Intl.DateTimeFormat` is the expensive part, formatting is not. An
 *  unknown BCP-47 tag falls back to English instead of throwing mid-render. */
export function metaTimeFormatter(locale: string): Intl.DateTimeFormat {
  const hit = formatters.get(locale);
  if (hit) return hit;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  } catch {
    formatter = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' });
  }
  formatters.set(locale, formatter);
  return formatter;
}

/** HH:mm in the visitor's locale, or the placeholder when there is no
 *  usable timestamp (never "Invalid Date", never the epoch). */
export function formatMetaTime(updatedAt: number | null | undefined, locale: string): string {
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt <= 0) return META_TIME_PLACEHOLDER;
  return metaTimeFormatter(locale).format(new Date(updatedAt));
}

/** The ICU arguments for `Rev34.meta.line`: a whole non-negative count, a
 *  trimmed source sentence and the formatted time. */
export function metaLineArgs(input: MetaLineInput, locale: string): MetaLineArgs {
  const count = Number.isFinite(input.count) ? Math.max(0, Math.trunc(input.count)) : 0;
  return { count, source: input.source.trim(), updated: formatMetaTime(input.updatedAt, locale) };
}
