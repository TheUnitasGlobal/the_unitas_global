'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, Loader2, Search } from 'lucide-react';
import { lifeOsFetch } from '@/lib/lifeOs/clientFetch';
import type { LibraryEntry } from '@/lib/lifeOs/lifeLibrary';

/**
 * Life Library: multi-source knowledge archive with intelligent caching.
 * Client for GET /api/life/library -- a search hits the 24h Postgres TTL
 * cache first (lib/lifeOs/lifeLibrary.ts), synthesizing from Wikipedia's
 * keyless REST summary API only on a miss, then archives the result for
 * every future lookup of that (query, locale) pair.
 */
export function LifeLibraryEngine() {
  const t = useTranslations('LifeOs.lifeLibrary');
  const tc = useTranslations('LifeOs.common');
  const locale = useLocale();

  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ entry: LibraryEntry; source: 'cache' | 'fresh' } | null>(null);
  const [recent, setRecent] = useState<LibraryEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const loadRecent = useCallback(async () => {
    try {
      const res = await lifeOsFetch(`/api/life/library?locale=${encodeURIComponent(locale)}`);
      const json = await res.json();
      if (json.ok) setRecent(json.entries);
    } catch {
      /* fail-open */
    }
  }, [locale]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const search = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setNotFound(false);
    setResult(null);
    try {
      const res = await lifeOsFetch(`/api/life/library?q=${encodeURIComponent(query)}&locale=${encodeURIComponent(locale)}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const json = await res.json();
      if (json.ok) {
        setResult({ entry: json.entry, source: json.source });
        void loadRecent();
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            placeholder={t('searchPlaceholder')}
            className="flex-1 border border-accent/20 bg-void/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={searching || !query.trim()}
            className="flex items-center gap-2 border border-accent/40 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-accent transition-colors hover:border-accent disabled:opacity-40"
          >
            {searching ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Search size={14} aria-hidden="true" />}
            {t('searchButton')}
          </button>
        </div>

        {notFound && <p className="text-xs text-gray-500">{t('notFound')}</p>}

        {result && (
          <div className="border border-accent/15 bg-void/60 p-4">
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="font-serif text-base text-white">{result.entry.title}</p>
              <span className="text-[9px] uppercase tracking-widest text-gray-500">
                {result.source === 'cache' ? t('sourceCache') : t('sourceFresh')}
              </span>
            </div>
            <p className="mb-2 text-xs text-gray-400">{result.entry.extract}</p>
            <a
              href={result.entry.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-accent hover:underline"
            >
              {t('sourceLabel')} <ExternalLink size={10} aria-hidden="true" />
            </a>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-accent">{t('archiveLabel')}</h2>
        {recent.length === 0 ? (
          <p className="text-xs text-gray-500">{tc('empty')}</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((entry) => (
              <li key={`${entry.queryKey}::${entry.locale}`} className="border border-accent/10 bg-void/40 p-3">
                <p className="text-sm text-gray-200">{entry.title}</p>
                <p className="line-clamp-2 text-xs text-gray-500">{entry.extract}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
