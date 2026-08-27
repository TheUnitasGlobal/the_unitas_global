'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { runEchoReflection, type EchoResult } from '@/lib/engines/echo';
import type { EcosystemTheme } from '@/lib/ecosystems';

const REVEAL_INTERVAL_MS = 750;

export function EchoEngine({ ecosystem }: { ecosystem: EcosystemTheme }) {
  const t = useTranslations('ModuleEngine');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<EchoResult | null>(null);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!result || revealed > result.reflections.length) return;
    const timer = window.setTimeout(() => setRevealed((n) => n + 1), REVEAL_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [result, revealed]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setResult(runEchoReflection(query));
    setRevealed(0);
  }

  const running = result !== null && revealed <= result.reflections.length;

  return (
    <div className="text-left">
      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {t('echoQueryLabel')}
        </label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('echoQueryPlaceholder')}
          rows={3}
          className="w-full resize-none border bg-void px-3 py-2 text-sm text-white outline-none transition-colors"
          style={{ borderColor: `${ecosystem.color}44` }}
        />
        <button
          type="submit"
          disabled={running || !query.trim()}
          className="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all disabled:cursor-wait disabled:opacity-50"
          style={{ backgroundColor: ecosystem.color }}
        >
          {running ? t('echoRunningLabel') : t('echoRunButton')}
        </button>
      </form>

      {result && (
        <div className="space-y-3">
          <AnimatePresence>
            {result.reflections.slice(0, revealed).map((r) => (
              <motion.div
                key={r.cycle}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-l-2 pl-3"
                style={{ borderColor: `${ecosystem.color}55` }}
              >
                <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                  {r.label}
                </p>
                <p className="text-sm text-gray-300">{r.text}</p>
              </motion.div>
            ))}
          </AnimatePresence>

          {revealed > result.reflections.length && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 border p-4"
              style={{ borderColor: `${ecosystem.color}55`, backgroundColor: `${ecosystem.color}0d` }}
            >
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: ecosystem.color }}>
                {t('echoSynthesisLabel')}
              </p>
              <p className="text-sm font-medium text-white">{result.synthesis}</p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
