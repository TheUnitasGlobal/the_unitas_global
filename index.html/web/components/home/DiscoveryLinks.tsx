'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, ExternalLink, Newspaper, Play, Search } from 'lucide-react';
import { discoveryLinks, type DiscoveryLinkKind } from '@/lib/live/hubThemes';

const ICON: Record<DiscoveryLinkKind, typeof Search> = {
  wikipedia: BookOpen,
  news: Newspaper,
  youtube: Play,
  search: Search,
};

/**
 * REV-19 §9-10 -- "Explore beyond": keyless outbound discovery links for a
 * subject (ranking entry, hub headline, short). New tab, `noopener`, no
 * fetch, 0원. Rendered inside the glass modals and the hub deep dives.
 */
export function DiscoveryLinks({ subject, locale, compact = false }: { subject: string; locale: string; compact?: boolean }) {
  const t = useTranslations('Rev19.discovery');
  const links = discoveryLinks(subject, locale);
  if (links.length === 0) return null;
  return (
    <div className="qw-discovery-block" data-discovery-links="">
      {!compact && (
        <p className="mb-2 text-[12px] font-bold uppercase tracking-widest text-accent">{t('label')}</p>
      )}
      <div className="qw-discovery-links">
        {links.map((link) => {
          const Icon = ICON[link.kind];
          return (
            <a
              key={link.kind}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="qw-discovery-link border border-white/15 text-accent"
            >
              <Icon size={12} aria-hidden="true" />
              {t(link.kind)}
              <ExternalLink size={10} aria-hidden="true" className="opacity-60" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
