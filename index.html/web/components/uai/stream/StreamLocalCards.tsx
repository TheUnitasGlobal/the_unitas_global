'use client';

/**
 * REV-21 §5C / SPEC §12.7 -- page 0 of the infinity stream, rendered from
 * the surface report with ZERO network: essence · axisSpectrum · sources ·
 * chain · deepGate, plus the page-1 `redesign` card (the free 6-axis report
 * from Genesis Memory) and the re-injected chain. These are the former
 * UaiDashboard sections re-cut as cards; the copy is unchanged where the
 * founder had already approved it (reporter switch, deep gate, insight).
 */
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Globe, Layers, Lock, Search, ShieldHalf, Sparkles, Wand2 } from 'lucide-react';
import { UAI_DEEP_INSIGHT_COST, type ConstitutionRedesignReport, type DeepReport, type SurfaceReport } from '@/lib/uai/types';
import type { UaiError, UaiPhase } from '@/lib/uai/useUai';
import { AXIS_COLOR, Bar, CardShell, OutboundRow, type RunQuery } from './StreamCards';

const BAND_COLOR: Record<string, string> = { low: '#64748b', mid: '#22d3ee', high: '#d4af37' };
const SHIELD_COLOR: Record<string, string> = { clear: '#34d399', caution: '#fbbf24', biased: '#f87171' };

/** Follow-up queries (Phase-1 loop): two axis re-frames + own-language
 *  source titles (REV-21 §2.2: never a foreign-language page). */
export function useFollowups(surface: SurfaceReport | null): string[] {
  const t = useTranslations('UAI');
  return useMemo(() => {
    if (!surface) return [];
    const q = surface.query;
    const out: string[] = [`${q} · ${t(`constitution.${surface.topConstitutionAxis}`)}`, `${q} · ${t(`constitution.${surface.redesignAxis}`)}`];
    surface.web.sources
      .filter((s) => s.origin !== 'wiki-en' && s.origin !== 'ddg' && s.origin !== 'searx' && (!s.lang || !surface.web.lang || s.lang === surface.web.lang))
      .slice(0, 3)
      .forEach((s) => {
        if (s.title && s.title.toLowerCase() !== q.toLowerCase()) out.push(s.title);
      });
    return Array.from(new Set(out)).slice(0, 5);
  }, [surface, t]);
}

export function EssenceCard({
  surface,
  hasSession,
  onGoPaid,
  onSelectEcosystem,
}: {
  surface: SurfaceReport;
  hasSession: boolean;
  onGoPaid: () => void;
  onSelectEcosystem?: (key: string) => void;
}) {
  const t = useTranslations('UAI');
  const tEco = useTranslations('Ecosystems');
  const tRev = useTranslations('Rev21');
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [swarmOpen, setSwarmOpen] = useState(false);
  const swarmRows = swarmOpen ? surface.swarm : surface.swarm.slice(0, 3);
  return (
    <CardShell kind="essence" page={0} scope="global" title="U-AI SEARCH RESULT">
      <div className="qw-stream-reporter">
        <span className="qw-stream-reporter-free">
          <Sparkles size={13} aria-hidden="true" /> {t('reporterFree')}
        </span>
        <button type="button" onClick={onGoPaid} className="qw-stream-reporter-paid" data-stream-reporter-paid>
          {!hasSession && <Lock size={12} aria-hidden="true" />}
          {t('reporterPaid')}
        </button>
      </div>

      <section className="qw-stream-section">
        <p className="qw-stream-label">{t('lensLabel')}</p>
        {surface.lenses.map((lens) => (
          <div key={lens.key} className="qw-stream-axis-row">
            <span className="qw-stream-axis-name">{t(`lens.${lens.key}`)}</span>
            <Bar value={lens.score} color={BAND_COLOR[lens.band]} />
            <span className="qw-stream-mono">{lens.score}</span>
          </div>
        ))}
      </section>

      <section className="qw-stream-section">
        <div className="flex items-center justify-between">
          <p className="qw-stream-label">
            <ShieldHalf size={13} aria-hidden="true" /> {t('shieldLabel')}
          </p>
          <span className="qw-stream-verdict" style={{ color: SHIELD_COLOR[surface.shield.verdict], borderColor: `${SHIELD_COLOR[surface.shield.verdict]}66` }}>
            {t(`shield.${surface.shield.verdict}`)}
          </span>
        </div>
        <Bar value={surface.shield.score} color={SHIELD_COLOR[surface.shield.verdict]} />
      </section>

      <section className="qw-stream-section">
        <p className="qw-stream-label">{t('checklistLabel')}</p>
        <ul className="qw-stream-checklist">
          {(t.raw(`checklist.${surface.checklistArchetype}`) as string[]).map((step, i) => (
            <li key={i}>
              <button type="button" onClick={() => setChecked((prev) => ({ ...prev, [i]: !prev[i] }))} className="qw-stream-check" data-checked={checked[i] ? '1' : '0'}>
                <span className="qw-stream-check-box" aria-hidden="true">
                  ✓
                </span>
                <span className="qw-stream-check-text">{step}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="qw-stream-section">
        <div className="flex items-center justify-between">
          <p className="qw-stream-label">{t('swarmLabel')}</p>
          {surface.swarm.length > 3 && (
            <button type="button" className="qw-stream-linkbtn" onClick={() => setSwarmOpen((v) => !v)} aria-expanded={swarmOpen}>
              {swarmOpen ? tRev('stream.swarmLess') : tRev('stream.swarmMore')}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {swarmRows.map((s) => (
            <button key={s.key} type="button" onClick={() => onSelectEcosystem?.(s.key)} disabled={!onSelectEcosystem} className="block w-full text-left disabled:cursor-default">
              <div className="mb-1 flex items-center justify-between text-[13px]">
                <span className="qw-stream-axis-name">{tEco(`${s.messageKey}.title`)}</span>
                <span className="qw-stream-mono">{s.score}</span>
              </div>
              <Bar value={s.score} color={s.color} />
            </button>
          ))}
        </div>
      </section>
    </CardShell>
  );
}

export function AxisSpectrumCard({ surface }: { surface: SurfaceReport }) {
  const t = useTranslations('UAI');
  return (
    <CardShell kind="axisSpectrum" page={0} scope="global">
      <section className="qw-stream-section">
        <p className="qw-stream-label">
          <Layers size={13} aria-hidden="true" /> {t('constitutionLabel')}
        </p>
        {surface.constitution.map((c) => (
          <div key={c.axis} className="qw-stream-axis-row">
            <span className="qw-stream-axis-name">{t(`constitution.${c.axis}`)}</span>
            <Bar value={c.score} color={AXIS_COLOR[c.axis]} />
            <span className="qw-stream-mono">{c.score}</span>
          </div>
        ))}
        <p className="qw-stream-note">{t('constitutionAxisNote', { axis: t(`constitution.${surface.redesignAxis}`) })}</p>
      </section>
      <section className="qw-stream-section">
        <p className="qw-stream-label">
          <Wand2 size={13} aria-hidden="true" /> {t('redesignLabel')}
        </p>
        <ol className="qw-stream-steps">
          {(t.raw('redesign') as string[]).map((step, i) => (
            <li key={i}>
              <span className="qw-stream-mono qw-stream-step-no">{String(i + 1).padStart(2, '0')}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>
    </CardShell>
  );
}

export function SourcesCard({ surface, lang }: { surface: SurfaceReport; lang: string }) {
  const t = useTranslations('UAI');
  return (
    <CardShell kind="sources" page={0} scope="global">
      <p className="qw-stream-label">
        <Globe size={13} aria-hidden="true" /> {t('webSourcesLabel')}
      </p>
      <p className="qw-stream-note">{t('webBlendNote')}</p>
      {surface.web.sourced ? (
        <>
          <p className="qw-stream-note qw-stream-note--neon">{t('webSourcedBadge', { count: surface.web.sources.length })}</p>
          <ul className="qw-stream-sources">
            {surface.web.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" data-source-origin={s.origin} data-source-lang={s.lang}>
                  <span className="qw-stream-item-title">{s.title}</span>
                  <span className="qw-stream-item-meta">{s.snippet}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="qw-stream-note">{t('webLocalBadge')}</p>
      )}
      <OutboundRow term={surface.query} lang={lang} />
    </CardShell>
  );
}

export function ChainCard({ page, followups, onQuery }: { page: number; followups: string[]; onQuery: RunQuery }) {
  const t = useTranslations('UAI');
  if (followups.length === 0) return null;
  return (
    <CardShell kind="chain" page={page} scope="global">
      <p className="qw-stream-label">
        <Search size={13} aria-hidden="true" /> {t('followupLabel')}
      </p>
      <p className="qw-stream-note">{t('followupHint')}</p>
      <div className="qw-stream-chips">
        {followups.map((fq) => (
          <button key={fq} type="button" onClick={() => onQuery(fq)} className="qw-stream-chip" data-stream-chip={fq}>
            {fq}
            <ArrowRight size={12} aria-hidden="true" />
          </button>
        ))}
      </div>
    </CardShell>
  );
}

export function RedesignCard({ insight, trendHits, forging }: { insight: ConstitutionRedesignReport | null; trendHits: number; forging: boolean }) {
  const t = useTranslations('UAI');
  return (
    <CardShell kind="redesign" page={1} scope="global" title={t('insightLabel')}>
      {insight ? (
        <>
          {!insight.cached && <p className="qw-stream-note qw-stream-note--neon">{t('insightFreshBadge')}</p>}
          <p className="qw-stream-synthesis">{insight.synthesis}</p>
          <div className="qw-stream-axes-grid">
            {insight.axes.map((ax) => (
              <div key={ax.axis} className="qw-stream-axis-card" style={{ borderTopColor: AXIS_COLOR[ax.axis] }}>
                <p className="qw-stream-axis-title" style={{ color: AXIS_COLOR[ax.axis] }}>
                  {t(`constitution.${ax.axis}`)}
                </p>
                <p className="qw-stream-axis-text">
                  <span className="qw-stream-axis-key">{t('insightAxisReading')} · </span>
                  {ax.reading}
                </p>
                <p className="qw-stream-axis-text qw-stream-axis-text--strong">
                  <span className="qw-stream-axis-key qw-stream-axis-key--accent">{t('insightAxisRedesign')} · </span>
                  {ax.redesign}
                </p>
              </div>
            ))}
          </div>
          <div className="qw-stream-vector">
            <p className="qw-stream-label qw-stream-label--accent">{t('insightVectorLabel')}</p>
            <p className="qw-stream-vector-text">{insight.vector}</p>
          </div>
          <p className="qw-stream-model">{t('modelNote', { model: insight.model })}</p>
        </>
      ) : forging || trendHits >= 3 ? (
        <p className="qw-stream-note qw-stream-note--pulse">{t('insightForging')}</p>
      ) : (
        <p className="qw-stream-note">{t('insightPending', { hits: trendHits })}</p>
      )}
    </CardShell>
  );
}

export function DeepGateCard({
  id,
  phase,
  deep,
  error,
  canDeep,
  deepAvailable,
  hasSession,
  onRunDeep,
}: {
  id: string;
  phase: UaiPhase;
  deep: DeepReport | null;
  error: UaiError | null;
  canDeep: boolean;
  deepAvailable: boolean;
  hasSession: boolean;
  onRunDeep: () => void;
}) {
  const t = useTranslations('UAI');
  const tRev = useTranslations('Rev21');
  return (
    <CardShell kind="deepGate" page={0} scope="global" id={id} title={t('deepLabel')}>
      <p className="qw-stream-note">{t('deepHint')}</p>
      {/* Charter ② -- the price and the credit's nature are stated before
          the button, never after. */}
      <p className="qw-stream-note qw-stream-credit" data-stream-credit-note>
        {tRev('stream.deepCreditNote', { cost: UAI_DEEP_INSIGHT_COST })}
      </p>
      {error && <p className="qw-stream-error">{t(`err.${error}`)}</p>}
      {!deep && phase !== 'deep-loading' && (
        deepAvailable ? (
          <button type="button" onClick={onRunDeep} disabled={!canDeep} className="qw-stream-deep-cta" data-stream-deep-cta>
            {!hasSession && <Lock size={13} aria-hidden="true" />}
            {hasSession ? t('deepCta', { cost: UAI_DEEP_INSIGHT_COST }) : t('err.signin')}
          </button>
        ) : (
          <p className="qw-stream-deep-locked">{t('deepLocked')}</p>
        )
      )}
      {phase === 'deep-loading' && <p className="qw-stream-note qw-stream-note--pulse">{t('deepScanning')}</p>}
      {deep && (
        <div className="qw-stream-deep" data-stream-deep-report>
          <section className="qw-stream-section">
            <p className="qw-stream-label">{t('chronosLabel')}</p>
            <ol className="qw-stream-chronos">
              {deep.chronos.map((point) => (
                <li key={point.horizon}>
                  <span className="qw-stream-timeline-dot" aria-hidden="true" />
                  <p className="qw-stream-axis-title qw-stream-axis-title--accent">{t(`chronos.${point.horizon}`)}</p>
                  <p className="qw-stream-text">{point.text}</p>
                </li>
              ))}
            </ol>
          </section>
          <section className="qw-stream-section qw-stream-binary">
            <p className="qw-stream-label">{t('binaryLabel')}</p>
            <div className="qw-stream-binary-grid">
              {(['A', 'B'] as const).map((opt) => (
                <div key={opt} className="qw-stream-binary-option" data-picked={deep.binary.pick === opt ? '1' : '0'}>
                  <span className="qw-stream-fact-label">{opt}</span>
                  {opt === 'A' ? deep.binary.optionA : deep.binary.optionB}
                </div>
              ))}
            </div>
            <div className="mb-2 flex items-center justify-between text-[12px]">
              <span className="qw-stream-note">{t('confidence')}</span>
              <span className="qw-stream-mono qw-stream-mono--neon">{deep.binary.confidence}%</span>
            </div>
            <Bar value={deep.binary.confidence} color="#22d3ee" />
            <p className="qw-stream-text">{deep.binary.rationale}</p>
          </section>
          <section className="qw-stream-section">
            <p className="qw-stream-label">{t('redPenLabel')}</p>
            <ul className="qw-stream-redpen">
              {deep.redPen.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
          <section className="qw-stream-section qw-stream-void">
            <p className="qw-stream-label qw-stream-label--accent">{t('voidLabel')}</p>
            <p className="qw-stream-void-text">{deep.voidInsight}</p>
          </section>
          <section className="qw-stream-section">
            <p className="qw-stream-label">{t('pathLabel')}</p>
            <ol className="qw-stream-steps">
              {deep.efficiencyPath.map((step, i) => (
                <li key={i}>
                  <span className="qw-stream-mono qw-stream-step-no">{String(i + 1).padStart(2, '0')}</span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
          <p className="qw-stream-model">
            {deep.cached && <span className="mr-2 text-neon/70">{t('cachedBadge')}</span>}
            {t('modelNote', { model: deep.model })}
          </p>
        </div>
      )}
    </CardShell>
  );
}
