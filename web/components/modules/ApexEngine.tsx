'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { APEX_SCENARIO_OPTIONS, scoreApexRun, type ApexOptionId, type ApexResult } from '@/lib/engines/apex';
import type { EcosystemTheme } from '@/lib/ecosystems';

const TOTAL_MS = 15000;
const TICK_MS = 100;

export function ApexEngine({ ecosystem }: { ecosystem: EcosystemTheme }) {
  const t = useTranslations('ModuleEngine');
  const [running, setRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(TOTAL_MS);
  const [result, setResult] = useState<ApexResult | null>(null);
  const intervalRef = useRef<number | null>(null);

  function stopTimer() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function finish(optionId: ApexOptionId | null, remaining: number) {
    stopTimer();
    setRunning(false);
    setResult(scoreApexRun(optionId, remaining, TOTAL_MS));
  }

  function handleStart() {
    setResult(null);
    setRemainingMs(TOTAL_MS);
    setRunning(true);
    const startedAt = Date.now();
    intervalRef.current = window.setInterval(() => {
      const remaining = Math.max(0, TOTAL_MS - (Date.now() - startedAt));
      setRemainingMs(remaining);
      if (remaining <= 0) {
        finish(null, 0);
      }
    }, TICK_MS);
  }

  function handleChoose(optionId: ApexOptionId) {
    if (!running) return;
    finish(optionId, remainingMs);
  }

  useEffect(() => stopTimer, []);

  const pct = remainingMs / TOTAL_MS;
  const timerColor = pct > 0.5 ? ecosystem.color : pct > 0.2 ? '#f59e0b' : '#ef4444';

  return (
    <div className="text-left">
      {!running && !result && (
        <button
          type="button"
          onClick={handleStart}
          className="w-full py-3 text-xs font-bold uppercase tracking-widest text-void transition-all"
          style={{ backgroundColor: ecosystem.color }}
        >
          {t('apexStartButton')}
        </button>
      )}

      {running && (
        <div>
          <p className="mb-3 text-sm text-gray-300">{t('apexPrompt')}</p>

          <div className="mb-4">
            <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-gray-500">
              <span>{t('apexTimeRemainingLabel')}</span>
              <span className="font-mono font-bold" style={{ color: timerColor }}>
                {(remainingMs / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/5">
              <div
                className="h-1.5 transition-all"
                style={{ width: `${pct * 100}%`, backgroundColor: timerColor }}
              />
            </div>
          </div>

          <div className="space-y-2">
            {APEX_SCENARIO_OPTIONS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => handleChoose(id)}
                className="w-full border border-white/15 bg-white/[0.03] px-4 py-2.5 text-left text-sm text-white transition-colors hover:border-white/40"
              >
                {t(`apexOption${id.charAt(0).toUpperCase()}${id.slice(1)}Label`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border p-4"
          style={{ borderColor: result.forfeited ? '#ef444455' : `${ecosystem.color}55` }}
        >
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-gray-500">{t('apexScoreLabel')}</span>
            <span className="font-bold" style={{ color: result.forfeited ? '#ef4444' : ecosystem.color }}>
              {result.score}
            </span>
          </div>
          <p className="mb-2 text-sm font-bold text-white">{t(result.verdictKey)}</p>
          <p className="mb-4 text-xs text-gray-400">{t(result.rationaleKey)}</p>
          <button
            type="button"
            onClick={handleStart}
            className="w-full border py-2 text-[11px] font-bold uppercase tracking-widest transition-all"
            style={{ borderColor: ecosystem.color, color: ecosystem.color }}
          >
            {t('apexRunAgainButton')}
          </button>
        </motion.div>
      )}
    </div>
  );
}
