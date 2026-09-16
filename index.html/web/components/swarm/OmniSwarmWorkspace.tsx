'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Cpu, Loader2, Search } from 'lucide-react';
import { OmniSwarmPanel } from '@/components/swarm/OmniSwarmPanel';
import type { SwarmAnchor } from '@/lib/swarm/swarmTypes';
import { resolveEntity } from '@/lib/uai/entityResolve';
import { wikiLangFor } from '@/lib/uai/liveSuggest';

/**
 * REV-32 M1 -- the standalone omni-swarm route (`/<locale>/omni-swarm`).
 *
 * The founder's requirement was that the swarm stop being a passenger: "시스템
 * 어디서든 호출할 수 있는 최상위 아키텍처로 격상". A route is the strongest form
 * of that -- it is addressable, shareable, bookmarkable and deep-linkable
 * (`?qid=Q2283`, or `?q=Samsung` for a name the page resolves itself), and it
 * depends on nothing but the swarm module.
 *
 * The page owns only the SUBJECT: which organisation to take apart. Drawing
 * it is `OmniSwarmPanel`'s job, exactly as it is inside the hub tab and the
 * U-AI portal, so all three entrances render one implementation.
 */
export interface OmniSwarmWorkspaceProps {
  initialQid?: string;
  initialQuery?: string;
  /**
   * `page` is the standalone route; `hub` is the same surface inside the
   * UNITAS master hub's tab, which already has its own heading and padding.
   * One implementation, two frames -- the founder asked for a swarm callable
   * from anywhere, not for two of them.
   */
  variant?: 'page' | 'hub';
}

export function OmniSwarmWorkspace({ initialQid = '', initialQuery = '', variant = 'page' }: OmniSwarmWorkspaceProps) {
  const t = useTranslations('Rev32.swarm');
  const locale = useLocale();
  const lang = wikiLangFor(locale);
  const inputId = useId();

  const [value, setValue] = useState(initialQuery);
  const [anchor, setAnchor] = useState<SwarmAnchor | null>(
    initialQid ? { qid: initialQid, term: initialQuery || initialQid, lang } : null,
  );
  const [resolving, setResolving] = useState(false);
  const [missed, setMissed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const resolve = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setResolving(true);
      setMissed(false);
      try {
        const hit = await resolveEntity(trimmed, lang, controller.signal);
        if (controller.signal.aborted) return;
        if (hit?.qid && !hit.disambiguation) {
          setAnchor({ qid: hit.qid, term: hit.localeTitle || trimmed, lang });
        } else {
          setAnchor(null);
          setMissed(true);
        }
      } catch {
        if (!controller.signal.aborted) setMissed(true);
      } finally {
        if (!controller.signal.aborted) setResolving(false);
      }
    },
    [lang],
  );

  // A `?q=` deep link resolves itself once; `?qid=` needs no round trip.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (!initialQid && initialQuery.trim()) void resolve(initialQuery);
  }, [initialQid, initialQuery, resolve]);

  function submit(e: FormEvent) {
    e.preventDefault();
    void resolve(value);
  }

  const Frame = variant === 'page' ? 'main' : 'div';

  return (
    <Frame
      className={variant === 'page' ? 'qw-swarm-page mx-auto w-full max-w-5xl px-4 py-8' : 'qw-swarm-page qw-swarm-page--hub'}
      data-omni-swarm-page={variant}
    >
      {variant === 'page' && (
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-[26px] font-bold text-white">
            <Cpu size={24} aria-hidden="true" />
            {t('page.title')}
          </h1>
          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-gray-400">{t('page.lede')}</p>
        </header>
      )}

      <form onSubmit={submit} className="qw-swarm-console mb-6 flex w-full items-center gap-2" role="search">
        <label htmlFor={inputId} className="sr-only">
          {t('page.searchLabel')}
        </label>
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('page.searchPlaceholder')}
          data-swarm-search=""
          className="min-w-0 flex-1 border border-white/15 bg-void/40 px-3 py-2 text-[15px] text-white placeholder:text-gray-500 focus:border-white/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={resolving || !value.trim()}
          data-swarm-search-submit=""
          className="inline-flex items-center gap-1.5 border border-white/20 px-3 py-2 text-[12px] font-bold uppercase tracking-widest text-gray-200 hover:border-white/40 disabled:opacity-50"
        >
          {resolving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Search size={14} aria-hidden="true" />}
          {t('page.search')}
        </button>
      </form>

      {missed && (
        <p className="mb-4 text-[13px] text-gray-400" role="status" data-swarm-note="unresolved">
          {t('page.unresolved')}
        </p>
      )}

      <OmniSwarmPanel anchor={anchor} variant={variant === 'page' ? 'page' : 'panel'} />
    </Frame>
  );
}
