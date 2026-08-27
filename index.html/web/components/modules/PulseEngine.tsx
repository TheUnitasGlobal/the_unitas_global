'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { generatePulseSeries, readPulseSeries, type PulseSeries } from '@/lib/engines/pulse';
import type { EcosystemTheme } from '@/lib/ecosystems';

const TICK_MS = 450;

export function PulseEngine({ ecosystem }: { ecosystem: EcosystemTheme }) {
  const t = useTranslations('ModuleEngine');
  const [signalName, setSignalName] = useState('');
  const [series, setSeries] = useState<PulseSeries | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [monitoring, setMonitoring] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!signalName.trim() || monitoring) return;
    const next = generatePulseSeries(signalName);
    setSeries(next);
    setRevealed(1);
    setMonitoring(true);
    timerRef.current = window.setInterval(() => {
      setRevealed((r) => {
        if (r + 1 >= next.momentum.length) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          setMonitoring(false);
          return next.momentum.length;
        }
        return r + 1;
      });
    }, TICK_MS);
  }

  const latestIndex = Math.max(0, revealed - 1);
  const read = series && !monitoring ? readPulseSeries(series) : null;

  const gauges = series
    ? [
        { label: t('pulseMomentumLabel'), value: series.momentum[latestIndex] ?? 0 },
        { label: t('pulseSentimentLabel'), value: series.sentiment[latestIndex] ?? 0 },
        { label: t('pulseVolatilityLabel'), value: series.volatility[latestIndex] ?? 0 },
      ]
    : [];

  return (
    <div className="text-left">
      <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
        <input
          type="text"
          value={signalName}
          onChange={(e) => setSignalName(e.target.value)}
          placeholder={t('pulseSignalPlaceholder')}
          className="w-full border bg-void px-3 py-2 text-sm text-white outline-none"
          style={{ borderColor: `${ecosystem.color}44` }}
        />
        <button
          type="submit"
          disabled={monitoring || !signalName.trim()}
          className="shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-widest text-void transition-all disabled:cursor-wait disabled:opacity-50"
          style={{ backgroundColor: ecosystem.color }}
        >
          {monitoring ? t('pulseMonitoringLabel') : t('pulseMonitorButton')}
        </button>
      </form>

      {series && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {gauges.map((g) => (
              <div key={g.label} className="border border-white/10 bg-void/60 p-3 text-center">
                <p className="mb-1 text-[9px] uppercase tracking-widest text-gray-500">{g.label}</p>
                <p className="text-lg font-bold" style={{ color: ecosystem.color }}>
                  {g.value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-1 h-16">
            {series.momentum.slice(0, revealed).map((v, i) => (
              <div key={i} className="flex-1 flex items-end justify-center h-full">
                <div className="w-full" style={{ height: `${Math.max(4, v)}%`, backgroundColor: ecosystem.color }} />
              </div>
            ))}
          </div>

          {read && (
            <p className="border-t border-white/10 pt-3 text-sm font-medium text-white">
              {t(read.momentumKey)} &middot; {t(read.volatilityKey)}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
