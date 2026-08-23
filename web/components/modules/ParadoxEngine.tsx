'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { runParadoxStressTest, type ParadoxResult } from '@/lib/engines/paradox';
import type { EcosystemTheme } from '@/lib/ecosystems';

export function ParadoxEngine({ ecosystem }: { ecosystem: EcosystemTheme }) {
  const t = useTranslations('ModuleEngine');
  const [conclusion, setConclusion] = useState('');
  const [result, setResult] = useState<ParadoxResult | null>(null);
  const [running, setRunning] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!conclusion.trim() || running) return;
    setRunning(true);
    window.setTimeout(() => {
      setResult(runParadoxStressTest(conclusion));
      setRunning(false);
    }, 700);
  }

  return (
    <div className="text-left">
      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {t('paradoxClaimLabel')}
        </label>
        <textarea
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          placeholder={t('paradoxClaimPlaceholder')}
          rows={3}
          className="w-full resize-none border bg-void px-3 py-2 text-sm text-white outline-none"
          style={{ borderColor: `${ecosystem.color}44` }}
        />
        <button
          type="submit"
          disabled={running || !conclusion.trim()}
          className="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all disabled:cursor-wait disabled:opacity-50"
          style={{ backgroundColor: ecosystem.color }}
        >
          {running ? t('paradoxRunningLabel') : t('paradoxRunButton')}
        </button>
      </form>

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">
              {t('paradoxFindingsLabel')}
            </p>
            {result.findingKeys.length === 0 ? (
              <p className="text-xs text-gray-500">{t('paradoxNoFindings')}</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-red-300">
                {result.findingKeys.map((key) => (
                  <li key={key} className="border-l-2 border-red-500/50 pl-2">
                    {t(key)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="border-t border-white/10 pt-3 text-sm font-medium text-white">{t(result.verdictKey)}</p>
        </motion.div>
      )}
    </div>
  );
}
