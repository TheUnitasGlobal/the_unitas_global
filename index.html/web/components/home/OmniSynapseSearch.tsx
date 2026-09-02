'use client';

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { sceneInteraction } from '@/lib/sceneInteraction';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useUai } from '@/lib/uai/useUai';
import { UaiDashboard } from '@/components/uai/UaiDashboard';
import { ECOSYSTEMS, type EcosystemTheme } from '@/lib/ecosystems';
import { B2C_MODULES, B2B_PROTOCOLS, type B2CModule } from '@/lib/modules';

interface OmniSynapseSearchProps {
  /** Lifted to HomeContent so the page can hide the ecosystem/module walls
      until a search has actually run (owner instruction 2026-08-30). */
  uai: ReturnType<typeof useUai>;
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
 *
 * Multi-modal context injection: dropping a file or a dragged browser tab/
 * link onto the bar attaches it as extra scoring context (text files are
 * read client-side via FileReader; binary files contribute their filename
 * only -- no OCR/parsing is attempted). "Swarm Cross-Reasoning" is the
 * collapsible section in the result panel showing all 11 ecosystems' scores
 * from that same heuristic simultaneously, not just the top match.
 */
export function OmniSynapseSearch({ uai, onSelectEcosystem, onSelectModule }: OmniSynapseSearchProps) {
  const t = useTranslations('OmniSynapse');
  const tEcosystems = useTranslations('Ecosystems');
  const tModules = useTranslations('Modules');
  const tCognitive = useTranslations('Cognitive');
  const tB2c = useTranslations('B2C');
  const tB2b = useTranslations('B2B');
  const { playTypingTick, playQuestEnterSfx, playHoverSfx, playSearchFocusSfx } = useSpatialAudio();
  const locale = useLocale();
  const { session } = useWallet();

  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ id: string; label: string; content: string }>>([]);
  const [image, setImage] = useState<{ id: string; label: string; mediaType: string; data: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const TEXT_LIKE_RE = /\.(txt|md|json|csv|log|ya?ml)$/i;
  const MAX_ATTACHMENT_CHARS = 4000;
  // Vision input for the deep-insight endpoint (see lib/uai/provider.ts) --
  // one image at a time, since it's sent to a single-image vision call, not
  // folded into the free-tier text heuristic like the attachments above.
  const IMAGE_TYPE_RE = /^image\/(png|jpeg|jpg|webp|gif)$/;
  const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

  function addAttachment(label: string, content: string) {
    setAttachments((prev) => [...prev.slice(-3), { id: `${Date.now()}-${label}`, label, content }]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function addImageFile(file: File) {
    setImageError(null);
    if (!IMAGE_TYPE_RE.test(file.type)) {
      setImageError(t('imageUnsupported'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(t('imageTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      if (!base64) return;
      setImage({ id: `${Date.now()}-${file.name}`, label: file.name, mediaType: file.type, data: base64 });
    };
    reader.readAsDataURL(file);
  }

  function processDroppedFiles(files: File[]) {
    files.forEach((file) => {
      if (IMAGE_TYPE_RE.test(file.type)) {
        addImageFile(file);
      } else if (TEXT_LIKE_RE.test(file.name) || file.type.startsWith('text/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const text = typeof reader.result === 'string' ? reader.result.slice(0, MAX_ATTACHMENT_CHARS) : '';
          addAttachment(file.name, text);
        };
        reader.readAsText(file);
      } else {
        // Other binary files (PDFs, etc.) contribute their name as a context
        // signal only -- no parsing is attempted.
        addAttachment(file.name, file.name);
      }
    });
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) {
      processDroppedFiles(files);
      return;
    }

    // A dragged browser tab or link arrives as text/uri-list (or plain text),
    // not a File -- this is the "drag a tab in" half of multi-modal injection.
    const droppedText = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (droppedText) {
      addAttachment(droppedText.length > 40 ? `${droppedText.slice(0, 40)}...` : droppedText, droppedText);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    processDroppedFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  }

  function handleRunDeep() {
    uai.runDeep(image ? { mediaType: image.mediaType, data: image.data } : undefined);
  }

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
    playSearchFocusSfx();
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
    if (uai.phase !== 'idle') uai.reset();
    playTypingTick();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!value.trim() && attachments.length === 0) || uai.phase === 'surface-loading') return;
    playQuestEnterSfx();
    const context = attachments.map((a) => a.content).join(' ');
    uai.runSurface(value, { tEcosystems: (k) => tEcosystems(k), context });
  }

  function selectEcosystemByKey(key: string) {
    const eco = ECOSYSTEMS.find((e) => e.key === key);
    if (eco) onSelectEcosystem(eco);
  }

  // Browse hub surfaces only once the visitor is actually searching (a
  // non-empty query typed in) -- the bare home screen stays clean, the
  // ecosystem/module lists appear on search only (owner instruction 2026-08-30).
  const browsing = focused && query.length > 0 && uai.phase === 'idle';
  const fullReportHref = `/${locale}/u-ai${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ''}`;

  return (
    <div className="relative mx-auto -mt-[19px] w-full max-w-7xl px-6">
      <form onSubmit={handleSubmit}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex items-center gap-3 border bg-white/[0.04] px-6 py-5 backdrop-blur-2xl transition-all duration-300 ${
            dragActive ? 'border-neon' : focused ? 'border-accent' : 'border-white/15'
          }`}
          style={
            dragActive
              ? { boxShadow: '0 0 70px rgba(0,255,180,0.3)' }
              : focused
                ? { boxShadow: '0 0 70px rgba(212,175,55,0.28)' }
                : undefined
          }
        >
          <Search size={20} className="shrink-0 text-accent" aria-hidden="true" />
          <input
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={dragActive ? t('dropZoneHint') : t('placeholder')}
            className="w-full bg-transparent text-[19px] text-white placeholder:text-gray-400 focus:outline-none"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.json,.csv,.log,.yml,.yaml"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
          <button
            type="button"
            title={t('dropZoneHint')}
            aria-label={t('attachImageAria')}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 text-gray-600 transition-colors hover:text-neon"
          >
            <Paperclip size={16} aria-hidden="true" />
          </button>
        </div>

        {imageError && <p className="mt-2 text-[11px] font-bold text-red-400">{imageError}</p>}

        {(attachments.length > 0 || image) && (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="self-center text-[9px] font-bold uppercase tracking-widest text-gray-500">
              {t('attachedLabel')}
            </span>
            {image && (
              <span className="flex items-center gap-1.5 border border-accent/30 bg-accent/[0.06] px-2 py-1 text-[11px] text-accent">
                <ImageIcon size={11} aria-hidden="true" />
                {image.label}
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  aria-label={t('removeAttachment')}
                  className="text-accent/60 hover:text-accent"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {attachments.map((a) => (
              <span
                key={a.id}
                className="flex items-center gap-1.5 border border-neon/30 bg-neon/[0.06] px-2 py-1 text-[11px] text-neon"
              >
                {a.label}
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  aria-label={t('removeAttachment')}
                  className="text-neon/60 hover:text-neon"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
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

      <UaiDashboard
        phase={uai.phase}
        surface={uai.surface}
        deep={uai.deep}
        insight={uai.insight}
        trendHits={uai.trendHits}
        insightForging={uai.insightForging}
        error={uai.error}
        canDeep={uai.canDeep}
        deepAvailable={uai.deepAvailable}
        hasSession={Boolean(session)}
        onRunDeep={handleRunDeep}
        onSelectEcosystem={selectEcosystemByKey}
        compact
        fullReportHref={fullReportHref}
      />
    </div>
  );
}
