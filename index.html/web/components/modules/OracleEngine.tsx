'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { runOracleForecast, type OracleResult } from '@/lib/engines/oracle';
import type { EcosystemTheme } from '@/lib/ecosystems';

const SLIDER_CLASS = 'w-full accent-current';

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  color,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</label>
        <span className="text-xs font-bold" style={{ color }}>
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={SLIDER_CLASS}
        style={{ color }}
      />
    </div>
  );
}

export function OracleEngine({ ecosystem }: { ecosystem: EcosystemTheme }) {
  const t = useTranslations('ModuleEngine');
  const [question, setQuestion] = useState('');
  const [confidence, setConfidence] = useState(50);
  const [volatility, setVolatility] = useState(50);
  const [horizonYears, setHorizonYears] = useState(5);
  const [result, setResult] = useState<OracleResult | null>(null);
  const [running, setRunning] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || running) return;
    setRunning(true);
    setResult(null);
    window.setTimeout(() => {
      setResult(runOracleForecast({ question, confidence, volatility, horizonYears }));
      setRunning(false);
    }, 900);
  }

  const bars = result
    ? [
        { key: 'likely', label: t('oracleLikely'), value: result.distribution.likely, color: ecosystem.color },
        { key: 'uncertain', label: t('oracleUncertain'), value: result.distribution.uncertain, color: '#9ca3af' },
        { key: 'unlikely', label: t('oracleUnlikely'), value: result.distribution.unlikely, color: '#6b7280' },
      ]
    : [];

  return (
    <div className="text-left">
      <form onSubmit={handleSubmit} className="mb-6 space-y-4">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {t('oracleQuestionLabel')}
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('oracleQuestionPlaceholder')}
            rows={2}
            className="w-full resize-none border bg-void px-3 py-2 text-sm text-white outline-none transition-colors"
            style={{ borderColor: `${ecosystem.color}44` }}
          />
        </div>

        <Slider
          label={t('oracleConfidenceLabel')}
          value={confidence}
          onChange={setConfidence}
          min={0}
          max={100}
          color={ecosystem.color}
          suffix="%"
        />
        <Slider
          label={t('oracleVolatilityLabel')}
          value={volatility}
          onChange={setVolatility}
          min={0}
          max={100}
          color={ecosystem.color}
          suffix="%"
        />
        <Slider
          label={t('oracleHorizonLabel')}
          value={horizonYears}
          onChange={setHorizonYears}
          min={1}
          max={30}
          color={ecosystem.color}
        />

        <button
          type="submit"
          disabled={running || !question.trim()}
          className="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all disabled:cursor-wait disabled:opacity-50"
          style={{ backgroundColor: ecosystem.color }}
        >
          {running ? t('oracleRunningLabel') : t('oracleRunButton')}
        </button>
      </form>

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="space-y-2">
            {bars.map((bar) => (
              <div key={bar.key}>
                <div className="mb-1 flex justify-between text-[11px] text-gray-400">
                  <span>{bar.label}</span>
                  <span className="font-bold" style={{ color: bar.color }}>
                    {bar.value}%
                  </span>
                </div>
                <div className="h-2 w-full bg-white/5">
                  <motion.div
                    className="h-2"
                    style={{ backgroundColor: bar.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${bar.value}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="border-l-2 pl-3" style={{ borderColor: `${ecosystem.color}55` }}>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">
              {t('oracleRationaleLabel')}
            </p>
            <ul className="space-y-1.5 text-xs text-gray-400">
              {result.rationale.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}
    </div>
  );
}
