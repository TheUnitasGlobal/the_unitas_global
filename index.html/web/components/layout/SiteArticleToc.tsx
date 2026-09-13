'use client';

import type { MouseEvent } from 'react';

export interface SiteArticleTocEntry {
  id: string;
  heading: string;
}

/**
 * REV-21 §6.1 (F-11) -- the sticky "On this page" section index. Buttons,
 * not `#hash` anchors: inside the inline modal the URL must not change
 * (E2E contract: the address bar stays put while a footer page is open),
 * and a hash write would also register with the deep modal history stack.
 * `scrollIntoView` scrolls whichever container owns the sections -- the
 * modal's bounded body scroller or the document on the full route.
 */
export function SiteArticleToc({ label, entries }: { label: string; entries: SiteArticleTocEntry[] }) {
  if (entries.length < 2) return null;

  function jump(event: MouseEvent<HTMLButtonElement>, id: string) {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    let reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reduce = false;
    }
    target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }

  return (
    <nav className="qw-site-article-toc" aria-label={label} data-site-toc="">
      <span className="qw-site-article-toc-label">{label}</span>
      <ol>
        {entries.map((entry, i) => (
          <li key={entry.id}>
            <button type="button" onClick={(event) => jump(event, entry.id)} data-site-toc-item={i}>
              {entry.heading}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
