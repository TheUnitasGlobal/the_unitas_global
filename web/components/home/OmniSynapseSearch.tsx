'use client';

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { sceneInteraction } from '@/lib/sceneInteraction';
import { analyzeQuery, type OmniSynapseAnalysis } from '@/lib/omniSynapse';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { ECOSYSTEMS, type EcosystemTheme } from '@/lib/ecosystems';
import { B2C_MODULES, B2B_PROTOCOLS, type B2CModule } from '@/lib/modules';

interface OmniSynapseSearchProps {
  onSelectEcosystem: (eco: EcosystemTheme) => void;
  onSelectModule: (module: B2CModule) => void;
}

/**
 * Decorative telemetry strip for the browse hub -- clearly stylistic HUD
 * flavor (matching the site's existing honestly-fictional placeholders like
 * the "Web Synthesis Layer" panel below), not a claim of real system data.
 */
const SYSTEM_METRICS = [
  { key: 'load', label: 'SYN-LOAD', value: '87%' },
  { key: 'nodes', label: 'NODES', value: '1,204' },
  { key: 'latency', label: 'LATENCY', value: '0.3ms' },
  { key: 'coherence', label: 'COHERENCE', value: '99.2%' },
];

/**
 * The OMNI-SYNAPSE search bar + browse hub + UNITAS ARCHITECT result panel.
 * Focusing the input drives the shared shader's black-hole suction effect
 * (see lib/sceneInteraction.ts + components/canvas/NeuralShader.tsx) AND
 * opens a categorized, filterable grid of every ecosystem/service/protocol
 * in the app (float-above glassmorphism panel, not a layout push -- avoids
 * reflowing the page under it). Submitting still runs the original client
 * -side heuristic across the 11 ecosystems -- see lib/omniSynapse.ts -- not
 * a real search index or LLM call. The "Web Synthesis Layer" and "Global
 * Unconscious Trends" panels stay honestly labeled as not-yet-connected.
 */
export function OmniSynapseSearch({ onSelectEcosystem, onSelectModule }: OmniSynapseSearchProps) {
  const t = useTranslations('OmniSynapse');
  const tEcosystems = useTranslations('Ecosystems');
  const tModules = useTranslations('Modules');
  const tCognitive = useTranslations('Cognitive');
  const tB2c = useTranslations('B2C');
  const tB2b = useTranslations('B2B');
  const { playTypingTick, playQuestEnterSfx, playHoverSfx } = useSpatialAudio();

  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<OmniSynapseAnalysis | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = value.trim().toLowerCase();

  const filteredEcosystems = useMemo(() => {
    if (!query) return ECOSYSTEMS;
    return ECOSYSTEMS.filter((eco) => {
      const title = tEcosystems(`${eco.messageKey}.title`).toLowerCase();
      const description = tEcosystems(`${eco.messageKey}.description`).toLowerCase();
      return title.includes(query) || description.includes(query) || eco.key.includes(query);
    });
  }, [query, tEcosystems]);

  const filteredModules = useMemo(() => {
    if (!query) return B2C_MODULES;
    return B2C_MODULES.filter((mod) => {
      const title = tModules(`${mod.messageKey}.title`).toLowerCase();
      const description = tModules(`${mod.messageKey}.description`).toLowerCase();
      return title.includes(query) || description.includes(query) || mod.key.includes(query);
    });
  }, [query, tModules]);

  const filteredProtocols = useMemo(() => {
    if (!query) return B2B_PROTOCOLS;
    return B2B_PROTOCOLS.filter((protocol) => {
      const title = tModules(`${protocol.messageKey}.title`).toLowerCase();
      const description = tModules(`${protocol.messageKey}.description`).toLowerCase();
      return title.includes(query) || description.includes(query) || protocol.key.includes(query);
    });
  }, [query, tModules]);

  const hasNoMatches =
    query.length > 0 &&
    filteredEcosystems.length === 0 &&
    filteredModules.length === 0 &&
    filteredProtocols.length === 0;

  function handleFocus() {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocused(true);
    sceneInteraction.focusBoost = 1;
  }

  function handleBlur() {
    // Deferred so a click/mousedown on a grid item inside the dropdown
    // still registers before the dropdown unmounts.
    blurTimeoutRef.current = setTimeout(() => {
      setFocused(false);
      sceneInteraction.focusBoost = 0;
    }, 150);
  }

  function closeBrowseHub() {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocused(false);
    sceneInteraction.focusBoost = 0;
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    if (result) setResult(null);
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
  const browsing = focused && !analyzing && !result;

  return (
    <div className="relative mx-auto mt-10 w-full max-w-3xl px-6 md:w-[60%] md:max-w-none">
      <form onSubmit={handleSubmit}>
        <div
          className={`flex items-center gap-3 border bg-white/[0.04] px-6 py-5 backdrop-blur-2xl transition-all duration-300 ${
            focused ? 'border-accent' : 'border-white/15'
          }`}
          style={focused ? { boxShadow: '0 0 70px rgba(212,175,55,0.28)' } : undefined}
        >
          <Search size={20} className="shrink-0 text-accent" aria-hidden="true" />
          <input
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={t('placeholder')}
            className="w-full bg-transparent text-base text-white placeholder:text-gray-500 focus:outline-none"
          />
        </div>
      </form>

      {/* Browse hub -- floats above the page (no layout push) so browsing
          never reflows or jitters the sections underneath. */}
      <AnimatePresence>
        {browsing && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onMouseDown={(e) => e.preventDefault()}
            className="absolute inset-x-0 top-full z-40 mt-3 max-h-[70vh] overflow-y-auto rounded-sm border border-white/15 bg-white/[0.045] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.3em] text-accent">
              {t('browseLabel')}
            </p>

            <p className="mb-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
              {t('metricsLabel')}
            </p>
            <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SYSTEM_METRICS.map((m) => (
                <div key={m.key} className="border border-neon/20 bg-neon/[0.04] px-3 py-2">
                  <p className="text-[8px] uppercase tracking-widest text-neon/70">{m.label}</p>
                  <p className="font-mono text-sm font-bold text-neon">{m.value}</p>
                </div>
              ))}
            </div>

            {hasNoMatches ? (
              <p className="py-8 text-center text-xs text-gray-500">{t('noBrowseMatches')}</p>
            ) : (
              <div className="space-y-7">
                {filteredEcosystems.length > 0 && (
                  <section>
                    <p className="mb-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                      {tCognitive('title')}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredEcosystems.map((eco) => (
                        <button
                          key={eco.key}
                          type="button"
                          onMouseEnter={() => playHoverSfx()}
                          onClick={() => {
                            onSelectEcosystem(eco);
                            closeBrowseHub();
                          }}
                          style={{ borderLeftColor: eco.color, borderLeftWidth: 3 }}
                          className="flex flex-col border border-white/10 border-l-[3px] bg-void/50 px-3 py-2 text-left transition-colors hover:border-white/25 hover:bg-void/70"
                        >
                          <span className="text-xs font-bold text-white">
                            {tEcosystems(`${eco.messageKey}.title`)}
                          </span>
                          <span className="truncate text-[10px] text-gray-500">
                            {tEcosystems(`${eco.messageKey}.description`)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {filteredModules.length > 0 && (
                  <section>
                    <p className="mb-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                      {tB2c('title')}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredModules.map((mod) => (
                        <button
                          key={mod.key}
                          type="button"
                          onMouseEnter={() => playHoverSfx()}
                          onClick={() => {
                            onSelectModule(mod);
                            closeBrowseHub();
                          }}
                          style={{ borderLeftColor: mod.metal, borderLeftWidth: 3 }}
                          className="flex flex-col border border-white/10 border-l-[3px] bg-void/50 px-3 py-2 text-left transition-colors hover:border-white/25 hover:bg-void/70"
                        >
                          <span className="text-xs font-bold text-white">
                            {tModules(`${mod.messageKey}.title`)}
                          </span>
                          <span className="truncate text-[10px] text-gray-500">
                            {tModules(`${mod.messageKey}.description`)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {filteredProtocols.length > 0 && (
                  <section>
                    <p className="mb-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                      {tB2b('title')}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredProtocols.map((protocol) => (
                        <Link
                          key={protocol.key}
                          href={`/${protocol.route}`}
                          onMouseEnter={() => playHoverSfx()}
                          onClick={closeBrowseHub}
                          className="flex flex-col border border-l-[3px] border-accent/30 border-l-accent bg-void/50 px-3 py-2 text-left transition-colors hover:border-accent/60 hover:bg-void/70"
                        >
                          <span className="text-xs font-bold text-white">
                            {tModules(`${protocol.messageKey}.title`)}
                          </span>
                          <span className="truncate text-[10px] text-gray-500">
                            {tModules(`${protocol.messageKey}.description`)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
