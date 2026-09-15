'use client';

/**
 * Page 0 of the infinity stream, rendered from the surface report with ZERO
 * network.
 *
 * REV-23 M2.2 (founder directive 2026-09-13): page 0 used to stack five
 * cards. Four of them are deleted outright -- `EssenceCard` (which carried
 * the free/paid reporter switch, the 3-second dimensional lens, the
 * commercial-bias shield, the 3-step action checklist and swarm
 * cross-reasoning), `AxisSpectrumCard`, `ChainCard` and `DeepGateCard` (deep
 * insight / The VOID), plus the page-1 `RedesignCard`. What remains is the
 * one the founder kept: the web synthesis, "웹 실시간 종합".
 *
 * Its outbound brand row went with the rest: REV-23 folded it into one
 * block, and REV-31 made that block the omni-open pair, so the result has
 * exactly one place that sends the visitor elsewhere instead of three.
 */
import { useTranslations } from 'next-intl';
import type { SurfaceReport } from '@/lib/uai/types';
import { CardShell } from './StreamCards';

export function SourcesCard({ surface }: { surface: SurfaceReport }) {
  const t = useTranslations('UAI');
  return (
    <CardShell kind="sources" page={0} scope="global">
      {/* The card's own kind label now reads "웹 실시간 종합" (M2.2 renamed
          `Rev21.stream.kinds.sources` from the generic "출처"), so the inner
          heading that used to repeat it two lines lower is gone. */}
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
    </CardShell>
  );
}
