'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Trash2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useUai } from '@/lib/uai/useUai';
import { UaiDashboard } from './UaiDashboard';

/**
 * Full-page U-AI dashboard (app/[locale]/u-ai). Standalone search + the
 * modular analysis report + the Brain-Grid cognitive history strip. The home
 * search bar (components/home/OmniSynapseSearch) embeds the same
 * <UaiDashboard> in `compact` mode and deep-links here via `?q=`.
 */
export function UaiWorkspace({ initialQuery = '' }: { initialQuery?: string }) {
  const t = useTranslations('UAI');
  const tEcosystems = useTranslations('Ecosystems');
  const router = useRouter();
  const { session } = useWallet();
  const uai = useUai();
  const [value, setValue] = useState(initialQuery);
  const runSurfaceRef = useRef(uai.runSurface);
  runSurfaceRef.current = uai.runSurface;
  const bootstrapped = useRef(false);

  const run = (q: string) => runSurfaceRef.current(q, { tEcosystems: (k) => tEcosystems(k) });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    run(value);
  }

  useEffect(() => {
    if (bootstrapped.current || !initialQuery.trim()) return;
    bootstrapped.current = true;
    run(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pb-24 pt-28">
      <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-accent">{t('title')}</p>
      <h1 className="mt-2 font-serif text-2xl font-bold text-white sm:text-3xl">{t('headline')}</h1>
      <p className="mt-2 text-sm text-gray-400 [text-wrap:balance]">{t('subhead')}</p>

      <form onSubmit={submit} className="mt-6">
        <div className="flex items-center gap-3 border border-white/15 bg-white/[0.04] px-5 py-4 backdrop-blur-2xl focus-within:border-accent">
          <Search size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('placeholder')}
            className="w-full bg-transparent text-[16px] text-white placeholder:text-gray-500 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 border border-accent/50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent transition-colors hover:bg-accent hover:text-void"
          >
            {t('submit')}
          </button>
        </div>
      </form>

      <UaiDashboard
        phase={uai.phase}
        surface={uai.surface}
        deep={uai.deep}
        error={uai.error}
        canDeep={uai.canDeep}
        deepAvailable={uai.deepAvailable}
        hasSession={Boolean(session)}
        onRunDeep={uai.runDeep}
        onSelectEcosystem={(key) => router.push(`/${key}`)}
      />

      {uai.history.length > 0 && (
        <section className="mt-10 border-t border-white/10 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-gray-500">{t('brainGridLabel')}</p>
            <button
              type="button"
              onClick={uai.wipeHistory}
              className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-gray-600 hover:text-red-400"
            >
              <Trash2 size={11} aria-hidden="true" /> {t('brainGridClear')}
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {uai.history.slice(0, 24).map((entry, i) => (
              <li key={`${entry.ts}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    setValue(entry.q);
                    run(entry.q);
                  }}
                  className="flex items-center gap-1.5 border border-white/10 bg-void/50 px-2.5 py-1 text-[10px] text-gray-400 transition-colors hover:border-accent/50 hover:text-white"
                >
                  {entry.depth === 'deep' && <span className="text-neon">◆</span>}
                  <span className="max-w-[160px] truncate">{entry.q}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
