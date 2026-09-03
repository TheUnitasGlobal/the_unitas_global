'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FocusEvent,
  type FormEvent,
} from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Paperclip,
  Video,
  PenTool,
  X,
  Image as ImageIcon,
  CornerDownLeft,
  ExternalLink,
  Globe,
  Loader2,
} from 'lucide-react';
import { sceneInteraction } from '@/lib/sceneInteraction';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useUai } from '@/lib/uai/useUai';
import { UaiDashboard } from '@/components/uai/UaiDashboard';
import { CanvasDrawInput } from '@/components/interaction/CanvasDrawInput';
import { HotShortcutMatrixStrip } from '@/components/home/HotShortcutMatrixStrip';
import { LiveLadderExplorer } from '@/components/home/LiveLadderExplorer';
import { DialogTower } from '@/components/ui/DialogTower';
import { AppLoopRow } from '@/components/interaction/AppLoopRow';
import { ECOSYSTEMS, type EcosystemTheme } from '@/lib/ecosystems';
import { MAX_UAI_ATTACHMENTS, type UaiImageAttachment } from '@/lib/uai/types';
import { buildLiveIndex, mergeLiveResults, searchLiveIndex, type LiveResult } from '@/lib/uai/liveSearchIndex';
import { fetchLiveSuggestions, type LiveSuggestion } from '@/lib/uai/liveSuggest';
import { isChoseongJamo } from '@/lib/hangul';
import type { AxisTranslators, HotShortcutAxis } from '@/lib/hotIssues';

interface OmniSynapseSearchProps {
  /** Lifted to HomeContent so the page can hide the ecosystem/module walls
      until a search has actually run (owner instruction 2026-08-30). */
  uai: ReturnType<typeof useUai>;
  onSelectEcosystem: (eco: EcosystemTheme) => void;
  /** Governance + hot-issue shortcuts (The Living Knowledge Ouroboros, now a
      multi-dimensional matrix) open HomeContent's HotShortcutResultModal --
      distinct from Section 4's pure 16-axis GovernanceLadderModal. */
  onOpenShortcut: (axis: HotShortcutAxis) => void;
  /** True while the search bar is focused on an empty query -- HomeContent
      uses this to sink (Focus Isolation) Sections 1-3 behind the ladder. */
  onOuroborosChange?: (active: boolean) => void;
}

/** Persists what was typed/open across a next-intl locale switch (which
 *  remounts the client tree and would otherwise wipe component state) --
 *  see The Living Knowledge Ouroboros's "keep results synced" requirement. */
const QUERY_STORAGE_KEY = 'unitas.ouroboros.query.v1';

/** Keystroke -> live-web prefix search debounce. Short enough that the list
 *  visibly tracks each syllable, long enough that a fast typist's
 *  intermediate shapes ('ㅅ' → '사' → '살') mostly never hit the network. */
const LIVE_SUGGEST_DEBOUNCE_MS = 180;

type VisualAttachment = UaiImageAttachment & { id: string; label: string };

/**
 * The OMNI-SYNAPSE search bar + live-typing hub + UNITAS ARCHITECT result
 * panel. Focusing the input drives the shared shader's black-hole suction
 * effect (see lib/sceneInteraction.ts + components/canvas/NeuralShader.tsx)
 * AND, once a query is being typed, opens the "글자 조합별 실시간 검색"
 * dropdown (owner instruction 2026-09-03): every keystroke -- including
 * half-composed Korean syllables, see lib/hangul.ts -- re-filters a local
 * corpus of the 30-axis shortcut matrix + direct-app launchers and merges
 * in debounced, keyless own-language Wikipedia prefix suggestions, each row
 * carrying title, one-line description and category. The old ecosystem /
 * module / protocol catalog cards are gone from here on purpose (they live
 * on the module walls below). Beneath the rows sits the live ladder
 * explorer (LiveLadderExplorer) and, untouched, the shortcut matrix strip.
 * Submitting still runs the client-side heuristic across the 11 ecosystems
 * -- see lib/omniSynapse.ts -- not a real search index or LLM call.
 *
 * Multi-modal context injection: dropping a file or a dragged browser tab/
 * link onto the bar attaches it as extra scoring context (text files are
 * read client-side via FileReader; binary files contribute their filename
 * only -- no OCR/parsing is attempted). "Swarm Cross-Reasoning" is the
 * collapsible section in the result panel showing all 11 ecosystems' scores
 * from that same heuristic simultaneously, not just the top match.
 *
 * Vision attachments (photo / video / sketch) feed the *deep* insight call
 * (Anthropic vision), capped at MAX_UAI_ATTACHMENTS total -- see
 * addVisualAttachment. A video attachment is really its one extracted
 * representative frame (Anthropic's Messages API has no video content
 * block); a canvas attachment is a PNG snapshot from CanvasDrawInput. Both
 * travel identically to a photo from this point on.
 *
 * When the bar is focused on an *empty* query ("ouroboros" mode), the
 * ecosystem/module walls sink behind a multi-dimensional shortcut marquee
 * (16 Governance axes + global hot-issue categories) instead of the browse
 * hub -- see HotShortcutMatrixStrip + onOuroborosChange.
 */
export function OmniSynapseSearch({
  uai,
  onSelectEcosystem,
  onOpenShortcut,
  onOuroborosChange,
}: OmniSynapseSearchProps) {
  const t = useTranslations('OmniSynapse');
  const tEcosystems = useTranslations('Ecosystems');
  /** Toolbar tooltip strings shared verbatim with the shortcut tower, so the
   *  two popups' chrome reads identically in every locale. */
  const tTower = useTranslations('HotShortcutModal');
  const tCivic = useTranslations('Civic');
  const tHotIssue = useTranslations('HotIssue');
  const tFinance = useTranslations('Finance');
  const tRealEstate = useTranslations('RealEstate');
  const tDating = useTranslations('Dating');
  const tCareer = useTranslations('Career');
  const tEmail = useTranslations('Email');
  const tSocial = useTranslations('Social');
  const { playTypingTick, playQuestEnterSfx, playHoverSfx, playSearchFocusSfx } = useSpatialAudio();
  const locale = useLocale();
  const { session } = useWallet();

  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return sessionStorage.getItem(QUERY_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [focused, setFocused] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ id: string; label: string; content: string }>>([]);
  const [visualAttachments, setVisualAttachments] = useState<VisualAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [webSuggestions, setWebSuggestions] = useState<LiveSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  /** The whole bar + dropdown subtree: focus moving anywhere inside it (the
   *  weather city box, ladder chips) must NOT collapse the popup. */
  const rootRef = useRef<HTMLDivElement | null>(null);

  const TEXT_LIKE_RE = /\.(txt|md|json|csv|log|ya?ml)$/i;
  const MAX_ATTACHMENT_CHARS = 4000;
  // Vision input for the deep-insight endpoint (see lib/uai/provider.ts) --
  // up to MAX_UAI_ATTACHMENTS images at a time (photo / video-frame / canvas
  // sketch alike), sent to a multi-image vision call, not folded into the
  // free-tier text heuristic like the attachments above.
  const IMAGE_TYPE_RE = /^image\/(png|jpeg|jpg|webp|gif)$/;
  const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
  const VIDEO_CAPTURE_TIMEOUT_MS = 5000;

  useEffect(() => {
    try {
      sessionStorage.setItem(QUERY_STORAGE_KEY, value);
    } catch {
      // sessionStorage unavailable (private mode / disabled) -- non-fatal,
      // the ouroboros sync degrades to "not restored" rather than erroring.
    }
  }, [value]);

  function addAttachment(label: string, content: string) {
    setAttachments((prev) => [...prev.slice(-3), { id: `${Date.now()}-${label}`, label, content }]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function addVisualAttachment(item: VisualAttachment) {
    setAttachError(null);
    setVisualAttachments((prev) => [...prev.slice(-(MAX_UAI_ATTACHMENTS - 1)), item]);
  }

  function removeVisualAttachment(id: string) {
    setVisualAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function addImageFile(file: File) {
    setAttachError(null);
    if (!IMAGE_TYPE_RE.test(file.type)) {
      setAttachError(t('imageUnsupported'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setAttachError(t('imageTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      if (!base64) return;
      addVisualAttachment({
        id: `${Date.now()}-${file.name}`,
        label: file.name,
        mediaType: file.type,
        data: base64,
        kind: 'image',
      });
    };
    reader.readAsDataURL(file);
  }

  /**
   * Extracts one representative frame from a video file client-side and
   * attaches it as a plain image -- the only way to fold video content into
   * a vision call, since Anthropic's Messages API has no video content
   * block. Runs entirely off-DOM (a detached <video>/<canvas> pair); browsers
   * decode the first frame without the element needing to be mounted.
   */
  function addVideoFile(file: File) {
    setAttachError(null);
    if (!file.type.startsWith('video/')) {
      setAttachError(t('videoUnsupported'));
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      if (!ok) setAttachError(t('videoCaptureFailed'));
    };
    const timeoutId = setTimeout(() => finish(false), VIDEO_CAPTURE_TIMEOUT_MS);

    video.onloadeddata = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 320;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no-2d-context');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        if (!base64) throw new Error('empty-frame');
        addVisualAttachment({
          id: `${Date.now()}-${file.name}`,
          label: file.name,
          mediaType: 'image/jpeg',
          data: base64,
          kind: 'video-frame',
        });
        finish(true);
      } catch {
        finish(false);
      }
    };
    video.onerror = () => finish(false);
    video.src = url;
  }

  function handleCanvasAttach(data: string) {
    addVisualAttachment({
      id: `${Date.now()}-sketch`,
      label: t('drawTitle'),
      mediaType: 'image/png',
      data,
      kind: 'canvas',
    });
  }

  function processDroppedFiles(files: File[]) {
    files.forEach((file) => {
      if (IMAGE_TYPE_RE.test(file.type)) {
        addImageFile(file);
      } else if (file.type.startsWith('video/')) {
        addVideoFile(file);
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

  function handleVideoInputChange(e: ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files ?? []).forEach((file) => addVideoFile(file));
    e.target.value = '';
  }

  function handleRunDeep() {
    uai.runDeep(visualAttachments.length > 0 ? visualAttachments : undefined);
  }

  const query = value.trim();

  const axisT: AxisTranslators = useMemo(
    () => ({
      civic: tCivic,
      hotIssue: tHotIssue,
      finance: tFinance,
      realEstate: tRealEstate,
      dating: tDating,
      career: tCareer,
    }),
    [tCivic, tHotIssue, tFinance, tRealEstate, tDating, tCareer],
  );

  // Local, already-localized corpus (30 matrix axes + direct-app launchers)
  // -- built once per locale, filtered on every keystroke by the IME-aware
  // progressive matcher. Zero network.
  const liveIndex = useMemo(
    () =>
      buildLiveIndex({
        axisT,
        tabLabel: (tab) => t(`tab.${tab}`),
        appDescription: (app) => (app.family === 'email' ? tEmail : tSocial)('openAria', { brand: app.brand }),
      }),
    [axisT, t, tEmail, tSocial],
  );

  const localResults = useMemo(() => searchLiveIndex(liveIndex, query), [liveIndex, query]);

  const liveResults: LiveResult[] = useMemo(
    () => mergeLiveResults(localResults, webSuggestions, query, t('liveWebCategory')),
    [localResults, webSuggestions, query, t],
  );

  // Live-web half of the dropdown: debounced, abortable prefix search on the
  // visitor's own-language Wikipedia. A query made only of lone 초성 ('ㅅ')
  // is skipped -- nothing meaningful prefix-matches half a syllable, and the
  // local index already answers it.
  const suggestActive = focused && query.length > 0 && uai.phase === 'idle';
  useEffect(() => {
    if (!suggestActive) {
      setWebSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    const chars = Array.from(query);
    if (chars.every((c) => isChoseongJamo(c) || c === ' ')) {
      setWebSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    const controller = new AbortController();
    setSuggestLoading(true);
    const timer = setTimeout(() => {
      fetchLiveSuggestions(query, locale, controller.signal)
        .then((list) => {
          if (!controller.signal.aborted) setWebSuggestions(list);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggestLoading(false);
        });
    }, LIVE_SUGGEST_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [suggestActive, query, locale]);

  const hasNoMatches = query.length > 0 && liveResults.length === 0 && !suggestLoading;

  function cancelPendingBlur() {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }

  function handleFocus() {
    cancelPendingBlur();
    setFocused(true);
    sceneInteraction.focusBoost = 1;
    playSearchFocusSfx();
  }

  /** Root-level blur: fires for the search input AND every focusable inside
   *  the dropdown (weather city box, ladder chips). Focus merely moving
   *  between two of them is not a leave; only focus escaping the subtree
   *  collapses the hub -- deferred so a click on a non-focusable row still
   *  registers before the dropdown unmounts. */
  function handleRootBlur(e: FocusEvent<HTMLDivElement>) {
    const next = e.relatedTarget as Node | null;
    if (next && rootRef.current?.contains(next)) return;
    cancelPendingBlur();
    blurTimeoutRef.current = setTimeout(() => {
      setFocused(false);
      sceneInteraction.focusBoost = 0;
    }, 150);
  }

  function closeBrowseHub() {
    cancelPendingBlur();
    setFocused(false);
    sceneInteraction.focusBoost = 0;
  }

  /** A live result row: matrix axis -> the knowledge-ladder tower; direct
   *  app -> its own page (rendered as a link, never lands here); live web
   *  hit -> re-run the free U-AI pass on that exact title. */
  function activateLiveResult(result: LiveResult) {
    if (result.kind === 'axis' && result.axis) {
      closeBrowseHub();
      onOpenShortcut(result.axis);
      return;
    }
    runFollowupQuery(result.title);
  }

  /** Title with the progressively-matched span lit in accent. */
  function renderHighlighted(result: LiveResult) {
    if (!result.range) return <span className="text-white">{result.title}</span>;
    const chars = Array.from(result.title);
    return (
      <span className="text-white">
        {chars.slice(0, result.range.start).join('')}
        <mark className="bg-transparent text-accent">{chars.slice(result.range.start, result.range.end).join('')}</mark>
        {chars.slice(result.range.end).join('')}
      </span>
    );
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    if (uai.phase !== 'idle') uai.reset();
    playTypingTick();
  }

  function runSearch(query: string) {
    const context = attachments.map((a) => a.content).join(' ');
    uai.runSurface(query, { tEcosystems: (k) => tEcosystems(k), context });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!value.trim() && attachments.length === 0) || uai.phase === 'surface-loading') return;
    playQuestEnterSfx();
    runSearch(value);
  }

  /** [갱신] -- re-runs the live pass for the query the tower is showing. */
  function refreshSearchTower() {
    if (!value.trim() && attachments.length === 0) return;
    runSearch(value);
  }

  /** [뒤로 가기 / 창닫기] -- collapses the result tower back to the search
   *  bar; the typed query survives in the bar for refinement. */
  function closeSearchTower() {
    uai.reset();
  }

  /** [⌂ 홈으로 복귀] -- collapses the tower AND clears the query, landing on
   *  the bare home screen. */
  function homeFromSearchTower() {
    uai.reset();
    setValue('');
  }

  /** Follow-up chips inside the tower re-run the free pass in place. */
  function runFollowupQuery(q: string) {
    playQuestEnterSfx();
    setValue(q);
    runSearch(q);
  }

  function selectEcosystemByKey(key: string) {
    const eco = ECOSYSTEMS.find((e) => e.key === key);
    if (eco) onSelectEcosystem(eco);
  }

  // Browse hub surfaces only once the visitor is actually searching (a
  // non-empty query typed in) -- the bare home screen stays clean, the
  // ecosystem/module lists appear on search only (owner instruction 2026-08-30).
  const browsing = focused && query.length > 0 && uai.phase === 'idle';
  // "The Living Knowledge Ouroboros": focused on a *clean* (empty) search bar
  // -- shows the 16-axis Governance shortcut marquee instead, and tells
  // HomeContent to sink Sections 1-3 behind it (Focus Isolation).
  const ouroboros = focused && query.length === 0 && uai.phase === 'idle';
  const fullReportHref = `/${locale}/u-ai${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ''}`;

  useEffect(() => {
    onOuroborosChange?.(ouroboros);
  }, [ouroboros, onOuroborosChange]);

  return (
    <div
      ref={rootRef}
      onFocus={cancelPendingBlur}
      onBlur={handleRootBlur}
      className="relative mx-auto -mt-[19px] w-full max-w-7xl px-6"
    >
      <form onSubmit={handleSubmit}>
        <div
          id="omni-synapse-search"
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
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            multiple
            onChange={handleVideoInputChange}
            className="hidden"
          />
          <button
            type="button"
            title={t('dropZoneHint')}
            aria-label={t('attachImageAria')}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 text-gray-600 transition-colors hover:text-neon"
          >
            <Paperclip size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            title={t('attachVideoAria')}
            aria-label={t('attachVideoAria')}
            onClick={() => videoInputRef.current?.click()}
            className="shrink-0 text-gray-600 transition-colors hover:text-neon"
          >
            <Video size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            title={t('attachCanvasAria')}
            aria-label={t('attachCanvasAria')}
            onClick={() => setDrawOpen(true)}
            className="shrink-0 text-gray-600 transition-colors hover:text-neon"
          >
            <PenTool size={20} aria-hidden="true" />
          </button>
          {/* Real keyboard-Enter submit key (same ⏎ symbol as the tower's
              추가검색 bar), so running the search is a visible control, not
              only an implicit form submit. */}
          <button
            type="submit"
            title={t('searchSubmitAria')}
            aria-label={t('searchSubmitAria')}
            disabled={(!value.trim() && attachments.length === 0) || uai.phase === 'surface-loading'}
            className="flex shrink-0 items-center justify-center border border-accent/50 p-1.5 text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CornerDownLeft size={20} aria-hidden="true" />
          </button>
        </div>

        {attachError && <p className="mt-2 text-[11px] font-bold text-red-400">{attachError}</p>}

        {(attachments.length > 0 || visualAttachments.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="self-center text-[9px] font-bold uppercase tracking-widest text-gray-500">
              {t('attachedLabel')}
            </span>
            {visualAttachments.map((a) => {
              const Icon = a.kind === 'video-frame' ? Video : a.kind === 'canvas' ? PenTool : ImageIcon;
              return (
                <span
                  key={a.id}
                  className="flex items-center gap-1.5 border border-accent/30 bg-accent/[0.06] px-2 py-1 text-[11px] text-accent"
                >
                  <Icon size={11} aria-hidden="true" />
                  {a.label}
                  <button
                    type="button"
                    onClick={() => removeVisualAttachment(a.id)}
                    aria-label={t('removeAttachment')}
                    className="text-accent/60 hover:text-accent"
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
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
          never reflows or jitters the sections underneath. Deliberately NOT
          inside an AnimatePresence: an exit animation kept a second, dying
          copy of the popup on screen during rapid focus/typing transitions
          (the "다중 팝업" bug) -- a plain conditional guarantees exactly one
          instance ever. left-6/right-6 mirrors the container's px-6, so the
          popup's edges align pixel-exactly with the search box above. */}
      {browsing && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-6 right-6 top-full z-40 mt-3 max-h-[70vh] overflow-y-auto rounded-sm border border-white/15 bg-white/[0.045] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            {/* Section 1 -- "글자 조합별 실시간 검색": one row per live hit
                (matched span lit, one-line description, category chip),
                re-filtered on every keystroke incl. half-composed syllables.
                The legacy ecosystem/module/protocol catalog cards are gone
                (owner instruction 2026-09-03). */}
            <section className="mb-6">
              <p className="mb-2.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                {t('liveKeywordsLabel')}
                {suggestLoading && (
                  <span className="flex items-center gap-1 normal-case tracking-normal text-accent">
                    <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                    {t('liveSearching')}
                  </span>
                )}
              </p>
              {hasNoMatches ? (
                <p className="py-6 text-center text-xs text-gray-500">{t('noBrowseMatches')}</p>
              ) : (
                <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2" role="listbox" aria-label={t('liveKeywordsLabel')}>
                    {liveResults.map((result) => {
                      const Icon = result.icon ?? Globe;
                      const color = result.color ?? '#d4af37';
                      const inner = (
                        <>
                          <Icon size={16} className="mt-0.5 shrink-0" style={{ color }} aria-hidden="true" />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-[14px] font-bold sm:text-[15px]">{renderHighlighted(result)}</span>
                              <span
                                className="shrink-0 border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                                style={{ borderColor: `${color}55`, color }}
                              >
                                {result.category}
                              </span>
                            </span>
                            {result.description && (
                              <span className="line-clamp-1 text-[12px] text-gray-400">{result.description}</span>
                            )}
                          </span>
                          {result.kind === 'app' && (
                            <ExternalLink size={13} className="mt-1 shrink-0 text-gray-500" aria-hidden="true" />
                          )}
                        </>
                      );
                      const rowClass =
                        'flex w-full items-start gap-3 border border-white/10 bg-void/50 px-3 py-2.5 text-left transition-colors hover:border-white/30 hover:bg-void/70';
                      return (
                        <motion.li
                          key={result.id}
                          role="option"
                          aria-selected={false}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.14 }}
                        >
                          {result.kind === 'app' && result.url ? (
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onMouseEnter={() => playHoverSfx()}
                              title={t('liveOpenHint')}
                              className={rowClass}
                              style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                            >
                              {inner}
                            </a>
                          ) : (
                            <button
                              type="button"
                              onMouseEnter={() => playHoverSfx()}
                              onClick={() => activateLiveResult(result)}
                              title={t('liveOpenHint')}
                              className={rowClass}
                              style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                            >
                              {inner}
                            </button>
                          )}
                        </motion.li>
                      );
                    })}
                </ul>
              )}
            </section>

            {/* Section 2 -- "실시간 사다리 탐색": climb from the typed root
                through matrix / constitution / lens / live-keyword vectors to
                a composed result. */}
            <section className="mb-6">
              <p className="mb-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                {t('liveLadderLabel')}
              </p>
              <LiveLadderExplorer
                query={query}
                axisT={axisT}
                onOpenAxis={(axis) => {
                  closeBrowseHub();
                  onOpenShortcut(axis);
                }}
                onRunQuery={runFollowupQuery}
              />
            </section>

            {/* Section 3 -- the shortcut matrix strip, exactly as before:
                governance through the app/asset launchers, untouched. */}
            <section>
              <HotShortcutMatrixStrip onOpenShortcut={onOpenShortcut} />
            </section>
          </motion.div>
      )}

      <AnimatePresence>{ouroboros && <HotShortcutMatrixStrip onOpenShortcut={onOpenShortcut} />}</AnimatePresence>

      <CanvasDrawInput open={drawOpen} onClose={() => setDrawOpen(false)} onAttach={handleCanvasAttach} />

      {/* U-AI live search result tower -- the same full-size popup frame and
          [U-AI SEARCH RESULT / 갱신 / 홈으로 복귀 / 뒤로 가기 / 창닫기]
          toolbar as the shortcut ladder, hosting the full (non-compact)
          report in split architecture: 상단 = live results/feed, 하단 = the
          new sovereign design structures (owner instruction 2026-09-02). */}
      <DialogTower
        open={uai.phase !== 'idle'}
        title="U-AI SEARCH RESULT"
        titleId="uai-search-result-title"
        accent="#d4af37"
        accentGlow="#f2d675"
        historyMarker="unitasUaiSearchTower"
        labels={{
          refresh: tTower('refreshAria'),
          home: tTower('homeButton'),
          back: tTower('backButton'),
          close: tTower('closeAria'),
        }}
        refreshing={uai.phase === 'surface-loading' || uai.phase === 'deep-loading'}
        onRefresh={refreshSearchTower}
        onBack={closeSearchTower}
        onHome={homeFromSearchTower}
        onClose={closeSearchTower}
        onButtonHover={playHoverSfx}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-6 sm:px-4">
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
            onSelectEcosystem={(key) => {
              uai.reset();
              selectEcosystemByKey(key);
            }}
            onRunQuery={runFollowupQuery}
            split
            fullReportHref={fullReportHref}
          />
        </div>
        {/* Pinned app loop -- same fixed bottom bar as the shortcut ladder
            tower (owner instruction 2026-09-03: 모든 U-AI 팝업 공통 고정). */}
        <AppLoopRow accent="#d4af37" label={tTower('appLoopLabel')} onHover={playHoverSfx} />
      </DialogTower>
    </div>
  );
}
