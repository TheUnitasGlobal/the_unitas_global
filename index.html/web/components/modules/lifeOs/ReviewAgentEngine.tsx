'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, PlayCircle, TriangleAlert, XCircle } from 'lucide-react';
import { lifeOsFetch } from '@/lib/lifeOs/clientFetch';
import type { ReviewFinding, ReviewLevel } from '@/lib/lifeOs/reviewAgent';

interface ReviewRunRow {
  id: string;
  run_at: string;
  status: ReviewLevel;
  summary: string;
  findings: ReviewFinding[];
  triggered_by: 'cron' | 'manual';
}

const LEVEL_ICON: Record<ReviewLevel, typeof CheckCircle2> = {
  ok: CheckCircle2,
  warn: TriangleAlert,
  error: XCircle,
};

const LEVEL_COLOR: Record<ReviewLevel, string> = {
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  error: 'text-rose-400',
};

/**
 * Review Agent: nightly automated audit + log archiving. The nightly cron
 * (web/vercel.json -> POST /api/life/review/run, CRON_SECRET) writes here
 * automatically; this panel also lets the founder trigger one on demand and
 * browse the last 20 runs. Actual archiving into ~/life/review/ on the
 * founder's own machine happens out-of-band via
 * scripts/review-agent-archive.mjs (a serverless function has no durable
 * home directory to write into) -- see that script's header comment.
 */
export function ReviewAgentEngine() {
  const t = useTranslations('LifeOs.reviewAgent');
  const tc = useTranslations('LifeOs.common');

  const [runs, setRuns] = useState<ReviewRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lifeOsFetch('/api/life/review/run');
      const json = await res.json();
      if (json.ok) setRuns(json.runs);
    } catch {
      /* fail-open */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const triggerRun = async () => {
    if (running) return;
    setRunning(true);
    try {
      await lifeOsFetch('/api/life/review/run', { method: 'POST' });
      await load();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => void triggerRun()}
        disabled={running}
        className="flex items-center gap-2 border border-accent/40 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-accent transition-colors hover:border-accent disabled:opacity-40"
      >
        {running ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <PlayCircle size={14} aria-hidden="true" />}
        {t('runNow')}
      </button>

      {loading ? (
        <p className="text-xs text-gray-500">{tc('loading')}</p>
      ) : runs.length === 0 ? (
        <p className="text-xs text-gray-500">{tc('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {runs.map((run) => {
            const Icon = LEVEL_ICON[run.status];
            return (
              <li key={run.id} className="border border-accent/15 bg-void/60 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest ${LEVEL_COLOR[run.status]}`}>
                    <Icon size={14} aria-hidden="true" />
                    {run.status.toUpperCase()}
                  </span>
                  <time className="font-mono text-[10px] text-gray-500" dateTime={run.run_at}>
                    {new Date(run.run_at).toLocaleString()}
                  </time>
                </div>
                <p className="mb-2 text-sm text-gray-300">{run.summary}</p>
                <ul className="space-y-1">
                  {run.findings.map((finding, i) => (
                    <li key={i} className="text-xs text-gray-500">
                      <span className={LEVEL_COLOR[finding.level]}>●</span> {finding.message}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[9px] uppercase tracking-widest text-gray-600">
                  {t('triggeredBy')}: {run.triggered_by === 'cron' ? t('triggeredByCron') : t('triggeredByManual')}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
