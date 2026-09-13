'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CornerDownLeft, Globe2, Search } from 'lucide-react';
import { INITIAL_SUGGEST_CURSOR, ladderRowKey, loadLadderPage, type LadderRow } from '@/lib/uai/suggestLadder';

/**
 * REV-21 SPEC §12.6 (D-38) -- the IN-TOWER suggestion strip. While the
 * fullscreen result tower is open the home search bar is covered, so the
 * typing dropdown's ladder could never be reached from inside a result.
 * This composer sits at the top of the tower body: an input pre-filled
 * with the running query and, as the visitor edits, one snap rail of
 * suggestions -- product rows from the localized index first, then GLOBAL
 * entities (Wikidata, ranked by language editions), then own-language
 * pages (§12.6 order, D-27). A chip or Enter re-runs the search in place
 * with the entity's QID riding along; nothing here pushes history.
 */

export interface ComposerProductRow {
  id: string;
  title: string;
  description?: string;
}

export interface InTowerComposerProps {
  /** The query the tower is currently showing. */
  query: string;
  locale: string;
  /** Localized product-corpus matches for a prefix (the parent's index). */
  productRows: (prefix: string) => ComposerProductRow[];
  onSubmit: (query: string, qid?: string) => void;
  onHover?: () => void;
  labels: {
    placeholder: string;
    aria: string;
    suggestLabel: string;
    scopeProduct: string;
    scopeGlobal: string;
    scopeLocal: string;
    submit: string;
  };
  accent: string;
}

const DEBOUNCE_MS = 220;
const MAX_CHIPS = 14;

export function InTowerComposer({ query, locale, productRows, onSubmit, onHover, labels, accent }: InTowerComposerProps) {
  const [value, setValue] = useState(query);
  const [rows, setRows] = useState<LadderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // A new tower query (a chip / follow-up) refills the box.
  useEffect(() => {
    setValue(query);
    setRows([]);
  }, [query]);

  const prefix = value.trim();
  const editing = prefix.length > 0 && prefix !== query.trim();
  const products = editing ? productRows(prefix).slice(0, 4) : [];

  useEffect(() => {
    if (!editing) {
      setRows([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      loadLadderPage(prefix, locale, 0, INITIAL_SUGGEST_CURSOR, controller.signal)
        .then((page) => {
          if (controller.signal.aborted) return;
          const seen = new Set<string>();
          setRows(
            page.rows.filter((r) => {
              const k = ladderRowKey(r);
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            }),
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [editing, prefix, locale]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!prefix) return;
    onSubmit(prefix);
  }

  const globalRows = rows.filter((r) => r.scope === 'global');
  const localRows = rows.filter((r) => r.scope !== 'global');
  const chips = [
    ...products.map((p) => ({ id: `p:${p.id}`, title: p.title, scope: 'product' as const, qid: undefined as string | undefined })),
    ...globalRows.map((r) => ({ id: r.id, title: r.title, scope: 'global' as const, qid: r.qid })),
    ...localRows.map((r) => ({ id: r.id, title: r.title, scope: 'local' as const, qid: r.qid })),
  ].slice(0, MAX_CHIPS);

  return (
    <div className="qw-tower-composer shrink-0 border-b px-2.5 py-2 sm:px-4" style={{ borderColor: `${accent}33` }} data-tower-composer="">
      <form onSubmit={submit} className="flex items-center gap-2 border border-white/15 bg-void/40 px-3 py-2">
        <Search size={15} className="shrink-0" style={{ color: accent }} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={labels.placeholder}
          aria-label={labels.aria}
          className="w-full min-w-0 bg-transparent text-[15px] text-white placeholder:text-gray-500 focus:outline-none"
          data-tower-composer-input=""
        />
        <button
          type="submit"
          disabled={!prefix}
          aria-label={labels.submit}
          title={labels.submit}
          className="flex h-8 w-8 shrink-0 items-center justify-center border transition-colors disabled:opacity-40"
          style={{ borderColor: `${accent}66`, color: accent }}
        >
          <CornerDownLeft size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </form>
      {editing && (chips.length > 0 || loading) && (
        <div className="mt-2" data-tower-suggest="">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">
            {labels.suggestLabel}
            {loading && <span className="ml-1.5 normal-case tracking-normal text-gray-500">…</span>}
          </p>
          <ul className="u-hscroll flex gap-1.5" role="listbox" aria-label={labels.suggestLabel}>
            {chips.map((chip) => (
              <li key={chip.id} className="shrink-0 snap-start" role="option" aria-selected={false}>
                <button
                  type="button"
                  data-scope={chip.scope}
                  data-qid={chip.qid}
                  onMouseEnter={() => onHover?.()}
                  onClick={() => onSubmit(chip.title, chip.qid)}
                  className="flex items-center gap-1.5 border border-white/15 px-2.5 py-1.5 text-[12px] font-semibold text-gray-200 transition-colors hover:border-white/40 hover:text-white"
                  style={chip.scope === 'global' ? { borderColor: `${accent}66`, color: accent } : undefined}
                  title={chip.scope === 'product' ? labels.scopeProduct : chip.scope === 'global' ? labels.scopeGlobal : labels.scopeLocal}
                >
                  {chip.scope === 'global' && <Globe2 size={11} aria-hidden="true" />}
                  {chip.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
