'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { readAuraStatement, type AuraResult } from '@/lib/engines/aura';
import type { EcosystemTheme } from '@/lib/ecosystems';

export function AuraEngine({ ecosystem }: { ecosystem: EcosystemTheme }) {
  const t = useTranslations('ModuleEngine');
  const [statement, setStatement] = useState('');
  const [result, setResult] = useState<AuraResult | null>(null);
  const [sensing, setSensing] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!statement.trim() || sensing) return;
    setSensing(true);
    window.setTimeout(() => {
      setResult(readAuraStatement(statement));
      setSensing(false);
    }, 700);
  }

  const bars = result
    ? [
        { label: t('auraValenceLabel'), value: result.valence, bandKey: result.valenceBandKey },
        { label: t('auraArousalLabel'), value: result.arousal, bandKey: result.arousalBandKey },
        { label: t('auraFormalityLabel'), value: result.formality, bandKey: result.formalityBandKey },
      ]
    : [];

  return (
    <div className="text-left">
      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {t('auraStatementLabel')}
        </label>
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder={t('auraStatementPlaceholder')}
          rows={3}
          className="w-full resize-none border bg-void px-3 py-2 text-sm text-white outline-none"
          style={{ borderColor: `${ecosystem.color}44` }}
        />
        <button
          type="submit"
          disabled={sensing || !statement.trim()}
          className="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all disabled:cursor-wait disabled:opacity-50"
          style={{ backgroundColor: ecosystem.color }}
        >
          {sensing ? t('auraSensingLabel') : t('auraSenseButton')}
        </button>
      </form>

      {result &&
        (result.rejected ? (
          <p className="text-sm text-amber-300">{t('auraQuestionRejected')}</p>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {bars.map((bar) => (
              <div key={bar.label}>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-gray-400">{bar.label}</span>
                  <span className="font-bold" style={{ color: ecosystem.color }}>
                    {t(bar.bandKey)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/5">
                  <div className="h-1.5" style={{ width: `${bar.value}%`, backgroundColor: ecosystem.color }} />
                </div>
              </div>
            ))}
          </motion.div>
        ))}
    </div>
  );
}
