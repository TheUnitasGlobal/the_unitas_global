'use client';

import type { KeyboardEvent as ReactKeyboardEvent, LiHTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { HubRowEnter } from './HubTitleRow';

/**
 * REV-41 D-1 (founder directive 2026-09-17, mission 1-B) -- one sub-info
 * row of a hub card: the headline text, its ⏎ box riding the LAST GLYPH
 * like a tail, then the description / source lines underneath.
 *
 * REV-34 M1-C laid the row out as `display:flex` with the ⏎ box as a
 * sibling of the headline button, which pinned the box to the row's right
 * end (space-between) whether the text filled one line or two. The founder
 * retired that: the box must sit 6px after the final character, on one
 * line or two, so it reads as part of the sentence rather than a column.
 *
 * WHY THE TEXT IS A <span role="button"> AND NOT A <button> (SPEC §1-2):
 * a <button> is an atomic inline-level box -- even with `display:inline`
 * the browser lays it out as an inline-block, so nothing can follow the
 * text on its LAST line; a sibling always lands after the whole block.
 * Only a true inline element (a span) participates in the line boxes of
 * its parent, wraps across lines, and lets an inline-flex sibling take the
 * position right after the last glyph. The span keeps the button contract
 * by hand: `role="button"`, `tabIndex=0`, Enter / Space -> onOpen with the
 * default (page scroll on Space) prevented. `box-decoration-break: clone`
 * in the CSS (§27) gives every wrapped line its own rounded highlight.
 *
 * A second reason the text may not be a native button: rev21-hub-card
 * asserts the history card holds ZERO `button[aria-label]`, and the news
 * rows carry `titleAriaLabel` (Rev34 `detailAria`). On a span the label is
 * legal and the count stays at zero.
 *
 * Contract (SPEC §3, lane B1): the class names `qw-hub-headline` (E2E
 * clicks it) and `qw-row-enter[data-row-enter="row"]` (E2E counts it) are
 * load-bearing. The marker (HubDot / rank box / thumbnail) is a flex
 * sibling of the body so it never enters the inline flow of the text.
 * Every inner control stops propagation: the card container is inert
 * (REV-23 M2.3) or a single one-target hitbox (REV-41 D-2), and a row must
 * never also fire the card underneath it.
 */
export interface HubRowProps extends Omit<LiHTMLAttributes<HTMLLIElement>, 'title' | 'onClick'> {
  /** Text and ⏎ both route here. */
  onOpen: () => void;
  title: string;
  /** HubDot / rank box / thumbnail -- a flex sibling, outside the text flow. */
  marker?: ReactNode;
  description?: string;
  source?: string;
  /** News rows only (Rev34 `detailAria`); undefined omits the attribute. */
  titleAriaLabel?: string;
  onHover?: () => void;
}

function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

export function HubRow({
  onOpen,
  title,
  marker,
  description,
  source,
  titleAriaLabel,
  onHover,
  className = '',
  ...rest
}: HubRowProps): JSX.Element {
  return (
    <li className={`qw-hub-row ${className}`.trim()} data-hub-row="" {...rest}>
      {marker}
      <span className="qw-hub-row-body">
        <span className="qw-hub-row-line">
          <span
            role="button"
            tabIndex={0}
            className="qw-hub-headline text-white"
            aria-label={titleAriaLabel}
            onMouseEnter={onHover}
            onClick={(e: ReactMouseEvent<HTMLSpanElement>) => {
              e.stopPropagation();
              onOpen();
            }}
            onKeyDown={(e: ReactKeyboardEvent<HTMLSpanElement>) => {
              if (!isActivationKey(e.key)) return;
              // Space would scroll the page; Enter inside a form would
              // submit. A native button prevents both -- so does the span.
              e.preventDefault();
              onOpen();
            }}
          >
            <span className="qw-hub-headline-text">{title}</span>
          </span>
          {/* REV-41 D-1 (integration fix): U+00A0 is line-break GLUE (UAX #14
              LB12: no break after it), so the box can never wrap to a line
              of its own -- when the last line is full, the final glyph(s)
              move down WITH the box. It is the only whitespace between the
              text and the tail; the CSS margin supplies the rest of the gap. */}
          {'\u00A0'}
          <HubRowEnter size="row" onOpen={onOpen} />
        </span>
        {description && (
          <span className="qw-hub-desc mt-0.5 line-clamp-2 block text-[12px] leading-snug text-gray-400">{description}</span>
        )}
        {source && <span className="qw-hub-source mt-0.5 block text-gray-500">{source}</span>}
      </span>
    </li>
  );
}
