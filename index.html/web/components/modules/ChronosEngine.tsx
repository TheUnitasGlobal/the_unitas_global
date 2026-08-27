'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { CHRONOS_MIN_HORIZON_YEARS, runChronosProjection, type ChronosResult } from '@/lib/engines/chronos';
import type { EcosystemTheme } from '@/lib/ecosystems';

const INPUT_CLASS = 'w-full border bg-void px-3 py-2 text-sm text-white outline-none';

export function ChronosEngine({ ecosystem }: { ecosystem: EcosystemTheme }) {
  const t = useTranslations('ModuleEngine');
  const [startingValue, setStartingValue] = useState(10000);
  const [horizonYears, setHorizonYears] = useState(20);
  const [cycleLengthYears, setCycleLengthYears] = useState(8);
  const [annualGrowthRate, setAnnualGrowthRate] = useState(4);
  const [result, setResult] = useState<ChronosResult | null>(null);
  const [running, setRunning] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (running) return;
    setRunning(true);
    window.setTimeout(() => {
      setResult(runChronosProjection({ startingValue, horizonYears, cycleLengthYears, annualGrowthRate }));
      setRunning(false);
    }, 700);
  }

  const maxValue = result ? Math.max(...result.years.map((y) => y.value), 1) : 1;
  const decadeMarks = result ? result.years.filter((y) => y.year % 10 === 0) : [];

  return (
    <div className="text-left">
      <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {t('chronosStartValueLabel')}
          </label>
          <input
            type="number"
            value={startingValue}
            onChange={(e) => setStartingValue(Number(e.target.value))}
            className={INPUT_CLASS}
            style={{ borderColor: `${ecosystem.color}44` }}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {t('chronosHorizonLabel', { min: CHRONOS_MIN_HORIZON_YEARS })}
          </label>
          <input
            type="number"
            value={horizonYears}
            onChange={(e) => setHorizonYears(Number(e.target.value))}
            className={INPUT_CLASS}
            style={{ borderColor: `${ecosystem.color}44` }}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {t('chronosCycleLengthLabel')}
          </label>
          <input
            type="number"
            value={cycleLengthYears}
            onChange={(e) => setCycleLengthYears(Number(e.target.value))}
            className={INPUT_CLASS}
            style={{ borderColor: `${ecosystem.color}44` }}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {t('chronosGrowthLabel')}
          </label>
          <input
            type="number"
            step={0.5}
            value={annualGrowthRate}
            onChange={(e) => setAnnualGrowthRate(Number(e.target.value))}
            className={INPUT_CLASS}
            style={{ borderColor: `${ecosystem.color}44` }}
          />
        </div>
        <button
          type="submit"
          disabled={running}
          className="sm:col-span-2 py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all disabled:cursor-wait disabled:opacity-50"
          style={{ backgroundColor: ecosystem.color }}
        >
          {running ? t('chronosRunningLabel') : t('chronosRunButton')}
        </button>
      </form>

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {result.horizonViolation && <p className="text-xs text-amber-300">{t('chronosMinHorizonNotice')}</p>}

          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">
              {t('chronosProjectionLabel')}
            </p>
            <div className="flex items-end gap-[2px] h-20">
              {result.years.map((y) => (
                <div key={y.year} className="flex-1 flex items-end h-full" title={`Y${y.year}: ${y.value}`}>
                  <div
                    className="w-full"
                    style={{ height: `${Math.max(3, (y.value / maxValue) * 100)}%`, backgroundColor: ecosystem.color }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-gray-600">
              {decadeMarks.map((y) => (
                <span key={y.year}>Y{y.year}</span>
              ))}
            </div>
          </div>

          <div className="flex justify-between border-t border-white/10 pt-3 text-xs">
            <span className="text-gray-500">{t('chronosFinalValueLabel')}</span>
            <span className="font-bold" style={{ color: ecosystem.color }}>
              {result.finalValue.toLocaleString()}
            </span>
          </div>
          <p className="text-sm font-medium text-white">{t(result.finalPhaseKey)}</p>
        </motion.div>
      )}
    </div>
  );
}
