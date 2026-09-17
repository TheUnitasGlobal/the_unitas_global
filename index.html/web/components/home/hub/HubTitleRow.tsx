'use client';

import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CornerDownLeft } from 'lucide-react';

/**
 * REV-34 M1-C (founder directive 2026-09-16) -- one click, two ways in.
 *
 * The strip's card titles used to go through `TwoStepTitle` (first click
 * arms, second opens). The founder retired the two-step on the strip: the
 * title text opens its deep modal on ONE click, hovering it changes the
 * colour only (no background, no ring), and a ⏎ "enter box" routes to the
 * very same place. Text or box, mouse or keyboard -- one action.
 *
 * REV-41 D-1 (founder directive 2026-09-17, mission 1-B) supersedes the
 * box's PLACE: it used to sit at the right end of the same row
 * (`display:flex` + space-between); now it is a tail that follows the last
 * character of the text. The markup here did not change -- the title is one
 * line (nowrap + ellipsis) so it stays a native <button>, and the layout
 * change is CSS only (quantum-white-rev19.css §27: `.qw-hub-title-row` is a
 * block, `.qw-hub-title-hit` an inline-block capped at `calc(100% - 40px)`,
 * the title box an inline-flex sibling with an 8px left margin, both
 * vertical-align: middle). The WRAPPING sub-info rows could not do that with
 * a button and moved to components/home/hub/HubRow.tsx.
 *
 * The box is derived from the search bar's ⏎ key (`.qw-enter-key` tokens:
 * 1.5px rim, quiet neutral at rest, blue on hover) but wears its own class
 * (`.qw-row-enter`) because the search bar's rule is scoped to its own id and
 * is an E2E contract. It carries `title` + sr-only text, NEVER `aria-label`:
 * rev21-hub-card asserts the history card holds zero `button[aria-label]`.
 *
 * `TwoStepTitle` itself stays for the U-AI stream (lib/uai/twoStepSelect.ts)
 * -- the directive's scope is the strip.
 */
export type HubRowEnterSize = 'title' | 'row';

const ENTER_ICON_PX: Record<HubRowEnterSize, number> = { title: 16, row: 14 };

export interface HubRowEnterProps {
  onOpen: () => void;
  /** 28px beside a card title, 24px at the end of a sub-info row. */
  size?: HubRowEnterSize;
  className?: string;
}

/** The ⏎ box. Stops propagation like every inner control of the inert card
 *  and never calls preventDefault: the strip's focus logic relies on the
 *  default mousedown / click path reaching its own handlers. */
export function HubRowEnter({ onOpen, size = 'row', className = '' }: HubRowEnterProps) {
  const t = useTranslations('Rev34.row');
  const label = t('open');
  return (
    <button
      type="button"
      className={`qw-row-enter ${className}`.trim()}
      data-row-enter={size}
      title={label}
      onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <CornerDownLeft size={ENTER_ICON_PX[size]} strokeWidth={2.75} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export interface HubTitleRowProps {
  children: ReactNode;
  onOpen: () => void;
  /** The row element; the E2E selectors key on the className passed here
   *  (`qw-hub-card-title`), so it stays on the wrapper as before. */
  as?: 'p' | 'span' | 'h3';
  className?: string;
}

/** Title text (colour-only hover) + the 28px ⏎ box riding its tail (REV-41
 *  D-1), both opening the same target. Enter / Space open on the FIRST
 *  press: a native button -- rev21-hub-card focuses `.qw-hub-title-hit` and
 *  presses Enter, so the title must stay a real <button>. */
export function HubTitleRow({ children, onOpen, as: Tag = 'p', className = '' }: HubTitleRowProps) {
  return (
    <Tag className={`qw-hub-title-row ${className}`.trim()} data-hub-title-row="">
      <button
        type="button"
        className="qw-hub-title-hit"
        onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        {children}
      </button>
      <HubRowEnter onOpen={onOpen} size="title" />
    </Tag>
  );
}
