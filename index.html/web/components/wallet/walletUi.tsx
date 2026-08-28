'use client';

import type { ReactNode } from 'react';
import { InfoHint } from '@/components/ui/InfoHint';

interface HintCopy {
  label: string;
  title: string;
  description: string;
  howto: string;
  caution: string;
}

interface SectionHeaderProps {
  title: string;
  hint: HintCopy;
  hintKind?: 'info' | 'warn';
  ariaHintPrefix: string;
  sectionLabels: { description: string; howto: string; caution: string };
  tag?: { label: string; tone: 'live' | 'pending' | 'local' | 'sim' };
  children?: ReactNode;
}

const TAG_TONES: Record<'live' | 'pending' | 'local' | 'sim', string> = {
  live: 'border-green-400/40 bg-green-400/10 text-green-400',
  pending: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  local: 'border-neon/40 bg-neon/10 text-neon',
  sim: 'border-purple-400/40 bg-purple-400/10 text-purple-300',
};

/** Feature-block header: title + `[?]`/`[!]` hint + optional status chip. */
export function SectionHeader({
  title,
  hint,
  hintKind = 'info',
  ariaHintPrefix,
  sectionLabels,
  tag,
  children,
}: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h3 className="font-serif text-[13px] font-bold uppercase tracking-[0.14em] text-accent">
        {title}
      </h3>
      <InfoHint
        kind={hintKind}
        label={hint.label}
        title={hint.title}
        description={hint.description}
        howto={hint.howto}
        caution={hint.caution}
        ariaHintPrefix={ariaHintPrefix}
        sectionLabels={sectionLabels}
      />
      {tag && (
        <span
          className={`ml-auto shrink-0 border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${TAG_TONES[tag.tone]}`}
        >
          {tag.label}
        </span>
      )}
      {children}
    </div>
  );
}

interface StatusDotProps {
  tone: 'connected' | 'pending' | 'offline';
  label: string;
}

export function StatusDot({ tone, label }: StatusDotProps) {
  const color =
    tone === 'connected' ? 'bg-green-400' : tone === 'pending' ? 'bg-amber-400' : 'bg-gray-600';
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-400">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}
