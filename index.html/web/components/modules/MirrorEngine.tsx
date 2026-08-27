'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { MIRROR_QUESTIONS, scoreMirrorScan, type MirrorAxis, type MirrorResult } from '@/lib/engines/mirror';
import type { EcosystemTheme } from '@/lib/ecosystems';

const AXIS_LABEL_KEY: Record<MirrorAxis, string> = {
  risk: 'mirrorAxisRisk',
  speed: 'mirrorAxisSpeed',
  analytical: 'mirrorAxisAnalytical',
};

export function MirrorEngine({ ecosystem }: { ecosystem: EcosystemTheme }) {
  const t = useTranslations('ModuleEngine');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<MirrorResult | null>(null);

  function handleAnswer(optionKey: string) {
    const next = [...answers, optionKey];
    if (step + 1 >= MIRROR_QUESTIONS.length) {
      setResult(scoreMirrorScan(next));
    } else {
      setAnswers(next);
      setStep(step + 1);
    }
  }

  function handleRestart() {
    setStep(0);
    setAnswers([]);
    setResult(null);
  }

  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-left">
        <div className="mb-5 space-y-3">
          {(['risk', 'speed', 'analytical'] as MirrorAxis[]).map((axis) => (
            <div key={axis}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-gray-400">{t(AXIS_LABEL_KEY[axis])}</span>
                <span className="font-bold" style={{ color: ecosystem.color }}>
                  {t(result.bands[axis])}
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/5">
                <motion.div
                  className="h-1.5"
                  style={{ backgroundColor: ecosystem.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${result.scores[axis]}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mb-4 text-xs text-gray-500">
          {t('mirrorDominantLabel')}:{' '}
          <span className="font-bold" style={{ color: ecosystem.color }}>
            {t(AXIS_LABEL_KEY[result.dominantAxis])}
          </span>
        </p>
        <button
          type="button"
          onClick={handleRestart}
          className="w-full border py-2 text-[11px] font-bold uppercase tracking-widest transition-all"
          style={{ borderColor: ecosystem.color, color: ecosystem.color }}
        >
          {t('mirrorScanAgain')}
        </button>
      </motion.div>
    );
  }

  const question = MIRROR_QUESTIONS[step];

  return (
    <div className="text-left">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">
        {t('mirrorProgressLabel', { current: step + 1, total: MIRROR_QUESTIONS.length })}
      </p>
      <motion.div key={question.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="mb-4 text-sm text-white">{t(question.key)}</p>
        <div className="space-y-2">
          {question.options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleAnswer(opt.key)}
              className="w-full border border-white/15 bg-white/[0.03] px-4 py-2.5 text-left text-sm text-white transition-colors hover:border-white/40"
            >
              {t(opt.key)}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
