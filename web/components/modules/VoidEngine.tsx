'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { runVoidAnalysis, type VoidResult } from '@/lib/engines/void';
import type { EcosystemTheme } from '@/lib/ecosystems';

export function VoidEngine({ ecosystem }: { ecosystem: EcosystemTheme }) {
  const t = useTranslations('ModuleEngine');
  const [thesis, setThesis] = useState('');
  const [result, setResult] = useState<VoidResult | null>(null);
  const [running, setRunning] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!thesis.trim() || running) return;
    setRunning(true);
    window.setTimeout(() => {
      setResult(runVoidAnalysis(thesis));
      setRunning(false);
    }, 700);
  }

  return (
    <div className="text-left">
      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {t('voidThesisLabel')}
        </label>
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          placeholder={t('voidThesisPlaceholder')}
          rows={4}
          className="w-full resize-none border bg-void px-3 py-2 text-sm text-white outline-none"
          style={{ borderColor: `${ecosystem.color}44` }}
        />
        <button
          type="submit"
          disabled={running || !thesis.trim()}
          className="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all disabled:cursor-wait disabled:opacity-50"
          style={{ backgroundColor: ecosystem.color }}
        >
          {running ? t('voidRunningLabel') : t('voidRunButton')}
        </button>
      </form>

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">{t('voidGapsLabel')}</p>
            {result.gapKeys.length === 0 ? (
              <p className="text-xs text-gray-500">{t('voidNoGaps')}</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-red-300">
                {result.gapKeys.map((key) => (
                  <li key={key} className="border-l-2 border-red-500/50 pl-2">
                    {t(key)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">{t('voidUnhedgedLabel')}</p>
            {result.unhedgedClaims.length === 0 ? (
              <p className="text-xs text-gray-500">{t('voidNoUnhedged')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {result.unhedgedClaims.map((claim) => (
                  <span key={claim} className="border border-amber-500/40 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-300">
                    &ldquo;{claim}&rdquo;
                  </span>
                ))}
              </div>
            )}
          </div>

          <p className="border-t border-white/10 pt-3 text-sm font-medium text-white">{t(result.verdictKey)}</p>
        </motion.div>
      )}
    </div>
  );
}
