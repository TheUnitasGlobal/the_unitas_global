import type { ReactNode } from 'react';
import type { SiteGroup, SiteSection, SiteSlug } from '@/lib/sitePages';
import { SiteArticleToc } from './SiteArticleToc';

export interface SiteArticleProps {
  /** `modal` = SiteLinkModalHost's bounded scroller; `route` = the
   *  /company|/legal|/support document. Drives the title level, the
   *  scroll owner and the sticky offset (globals.css). */
  host: 'modal' | 'route';
  group: SiteGroup;
  slug: SiteSlug;
  eyebrow: string;
  title: string;
  lede: string;
  /** Authored sections followed by any registry-generated ones. */
  sections: SiteSection[];
  highlights?: string[];
  updated?: string;
  labels: { updated: string; contents: string };
  /** Legal pages: the "informational only" line. */
  disclaimer?: string;
  /** Company / support pages: the non-legal corporate notice. */
  notice?: string;
  /** id of the title element (`site-page-title` -- E2E / aria contract). */
  titleId?: string;
  /** Host-specific actions rendered after the body (modal footer row). */
  children?: ReactNode;
}

export const sectionDomId = (slug: string, index: number) => `site-sec-${slug}-${index}`;

/**
 * REV-21 §6.1 (F-1) -- the one institutional-page body both hosts render:
 * eyebrow / title / lede, a sticky section index, the sections (with
 * registry rows where the page discloses third parties or storage keys),
 * highlights, the disclaimer or corporate notice, and the revision date.
 * No hooks, no client state: the server route renders it as-is and the
 * client modal imports it as a plain component. Painting: dark defaults in
 * globals.css, Quantum White in quantum-white-rev19.css §15b.
 */
export function SiteArticle({
  host,
  group,
  slug,
  eyebrow,
  title,
  lede,
  sections,
  highlights,
  updated,
  labels,
  disclaimer,
  notice,
  titleId = 'site-page-title',
  children,
}: SiteArticleProps) {
  const Title = host === 'route' ? 'h1' : 'h2';
  const toc = sections
    .map((s, i) => ({ id: sectionDomId(slug, i), heading: s.heading }))
    .filter((entry) => entry.heading.trim().length > 0);

  return (
    <article className="qw-site-article" data-site-page={slug} data-site-group={group} data-site-host={host}>
      <header className="qw-site-article-head">
        <p className="qw-site-article-eyebrow">{eyebrow}</p>
        <Title id={titleId} className="qw-site-article-title">
          {title}
        </Title>
        <p className="qw-site-article-lede">{lede}</p>
      </header>

      <div className="qw-site-article-body" data-site-article-body="">
        <SiteArticleToc label={labels.contents} entries={toc} />

        {sections.map((section, i) => (
          <section
            key={sectionDomId(slug, i)}
            id={sectionDomId(slug, i)}
            className="qw-site-article-section"
            data-site-registry={section.kind}
          >
            {section.heading.trim() ? <h3 className="qw-site-article-h">{section.heading}</h3> : null}
            {section.paragraphs.map((paragraph, j) => (
              <p key={j} className="qw-site-article-p">
                {paragraph}
              </p>
            ))}
            {section.items && section.items.length > 0 ? (
              <ul className="qw-site-article-items">
                {section.items.map((item, j) => (
                  <li key={`${item.name}-${j}`} className="qw-site-article-item">
                    <span className="qw-site-article-item-name">
                      {item.href ? (
                        <a href={item.href} target="_blank" rel="noopener noreferrer nofollow">
                          {item.name}
                        </a>
                      ) : (
                        item.name
                      )}
                    </span>
                    {item.meta ? <span className="qw-site-article-item-meta">{item.meta}</span> : null}
                    {item.note ? <span className="qw-site-article-item-note">{item.note}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        {highlights && highlights.length > 0 ? (
          <ul className="qw-site-article-highlights">
            {highlights.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : null}

        {notice ? <p className="qw-site-article-notice">{notice}</p> : null}
        {disclaimer ? <p className="qw-site-article-disclaimer">{disclaimer}</p> : null}
        {updated ? (
          <p className="qw-site-article-updated">
            <span>{labels.updated}</span> <time dateTime={updated}>{updated}</time>
          </p>
        ) : null}
      </div>

      {children}
    </article>
  );
}
