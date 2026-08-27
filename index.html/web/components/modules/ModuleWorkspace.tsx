'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { EcosystemTheme } from '@/lib/ecosystems';

interface ModuleWorkspaceProps {
  ecosystem: EcosystemTheme;
  children: ReactNode;
}

/**
 * Shared post-payment shell for the 11 Cognitive Ecosystem module pages:
 * themed header (title/description/rules, colored per ecosystem.color/glow)
 * plus a content slot for the actual engine. Coin spend already happened in
 * EcosystemEntryModal before the visitor got here -- this shell does not
 * re-check payment (see the "Known gaps" note in CLAUDE.md).
 */
export function ModuleWorkspace({ ecosystem, children }: ModuleWorkspaceProps) {
  const tEcosystems = useTranslations('Ecosystems');
  const tEntry = useTranslations('EntryModal');
  const tWorkspace = useTranslations('ModuleWorkspace');

  return (
    <main className="mx-auto max-w-3xl px-6 py-28">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-accent"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {tWorkspace('backLink')}
      </Link>

      <div className="mb-10 text-center">
        <h1
          className="glow-text mb-4 font-serif text-3xl font-bold text-white"
          style={{ textShadow: `0 0 24px ${ecosystem.glow}66` }}
        >
          {tEcosystems(`${ecosystem.messageKey}.title`)}
        </h1>
        <p className="mx-auto max-w-xl text-sm text-gray-400">
          {tEcosystems(`${ecosystem.messageKey}.description`)}
        </p>
      </div>

      <div
        className="mb-10 border-l-2 pl-4 text-left"
        style={{ borderColor: `${ecosystem.color}55` }}
      >
        <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">
          {tEntry('rulesLabel')}
        </p>
        <p className="text-xs italic text-gray-400">{tEcosystems(`${ecosystem.messageKey}.rules`)}</p>
      </div>

      <div
        className="border p-6"
        style={{ borderColor: `${ecosystem.color}33`, backgroundColor: '#0a0908' }}
      >
        {children}
      </div>
    </main>
  );
}
