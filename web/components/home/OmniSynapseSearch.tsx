'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { sceneInteraction } from '@/lib/sceneInteraction';
import { analyzeQuery, type OmniSynapseAnalysis } from '@/lib/omniSynapse';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import type { EcosystemTheme } from '@/lib/ecosystems';

interface OmniSynapseSearchProps {
  onSelectEcosystem: (eco: EcosystemTheme) => void;
}

/**
 * The OMNI-SYNAPSE search bar + UNITAS ARCHITECT result panel. Focusing the
 * input drives the shared shader's black-hole suction effect (see
 * lib/sceneInteraction.ts + components/canvas/NeuralShader.tsx). Submitting
 * runs a real (if simple) client-side heuristic across the 11 ecosystems --
 * see lib/omniSynapse.ts -- not a real search index or LLM call. The "Web
 * Synthesis Layer" and "Global Unconscious Trends" panels are honestly
 * labeled as not-yet-connected rather than faking results.
 */
export function OmniSynapseSearch({ onSelectEcosystem }: OmniSynapseSearchProps) {
  const t = useTranslations('OmniSynapse');
  const tEcosystems = useTranslations('Ecosystems');
  const { playTypingTick, playQuestEnterSfx } = useSpatialAudio();

  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<OmniSynapseAnalysis | null>(null);

  function handleFocus() {
    setFocused(true);
    sceneInteraction.focusBoost = 1;
  }

  function handleBlur() {
    setFocused(false);
    sceneInteraction.focusBoost = 0;
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    playTypingTick();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || analyzing) return;
    setAnalyzing(true);
    setResult(null);
    playQuestEnterSfx();
    window.setTimeout(() => {
      setResult(analyzeQuery(value, tEcosystems));
      setAnalyzing(false);
    }, 1000);
  }

  const recommended = result?.matches[0]?.eco ?? null;

  return (
    <div className="mx-auto mt-10 w-full max-w-3xl px-6 md:w-[60%] md:max-w-none">
      <form onSubmit={handleSubmit}>
        <div
          className={`flex items-center gap-3 border bg-white/[0.04] px-5 py-4 backdrop-blur-2xl transition-all duration-300 ${
            focused ? 'border-accent' : 'border-white/15'
          }`}
          style={focused ? { boxShadow: '0 0 70px rgba(212,175,55,0.28)' } : undefined}
        >
          <Search size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <input
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={t('placeholder')}
            className="w-full bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
          />
        </div>
      </form>

      <AnimatePresence>
        {(analyzing || result) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glow-box mt-4 bg-quantum/90 p-6 backdrop-blur-xl"
          >
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-accent">
              {t('architectLabel')}
            </p>

            {analyzing && <p className="text-xs text-gray-400">{t('analyzing')}</p>}

            {result && (
              <>
                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    [t('dimDirectionality'), result.directionality],
                    [t('dimConcept'), result.concept],
                    [t('dimTendency'), result.tendency],
                    [t('dimBlueprint'), recommended ? tEcosystems(`${recommended.messageKey}.title`) : '—'],
                  ].map(([label, val], i) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.12 }}
                      className="border border-white/10 bg-void/60 p-3"
                    >
                      <p className="mb-1 text-[9px] uppercase tracking-widest text-gray-500">{label}</p>
                      <p className="text-xs font-bold text-neon">{val}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                      {t('ecosystemDataLabel')}
                    </p>
                    {result.matches.length === 0 ? (
                      <p className="text-[11px] text-gray-600">{t('noResults')}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {result.matches.map(({ eco, title }) => (
                          <li key={eco.key}>
                            <button
                              type="button"
                              onClick={() => onSelectEcosystem(eco)}
                              className="text-left text-xs hover:underline"
                              style={{ color: eco.color }}
                            >
                              {title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                      {t('webDataLabel')}
                    </p>
                    <p className="text-[11px] italic text-gray-600">{t('webDataPlaceholder')}</p>
                  </div>
                  <div>
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                      {t('trendsLabel')}
                    </p>
                    <p className="text-[11px] italic text-gray-600">{t('trendsPlaceholder')}</p>
                  </div>
                </div>

                {recommended && (
                  <button
                    type="button"
                    onClick={() => onSelectEcosystem(recommended)}
                    className="mt-6 w-full border py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all"
                    style={{ borderColor: recommended.color, color: recommended.color }}
                  >
                    {t('enterRecommended')}
                  </button>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
