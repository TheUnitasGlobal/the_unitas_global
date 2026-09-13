/**
 * REV-23 M2.3 -- the two-step activation state machine (founder directive
 * 2026-09-13, "클릭 UX 개편").
 *
 * THE DEFECT. A result card opened on any click that landed anywhere in it:
 * the header padding, the whitespace beside a chip, the card's own margin.
 * On top of that the top-right corner carried a shortcut arrow that opened
 * the same popup a third way. The founder's reading is exact -- the visitor
 * cannot tell what is clickable, so every stray click is a surprise popup.
 *
 * THE RULE. Only the TITLE TEXT is a target (card heading, sub-heading,
 * detail heading). The first click on a title SELECTS it -- visible
 * highlight and focus, nothing else happens. A second click on the SAME,
 * already-selected title OPENS. A double-click opens immediately, because
 * that is what a double-click means everywhere else. Blur or Escape
 * deselects, so a title never stays armed after attention moves away.
 *
 * Pure, so the rule is asserted once here and every surface that adopts it
 * inherits the same behaviour. Unit-tested in
 * __tests__/uai/twoStepSelect.test.ts.
 */

export type TwoStepAction = 'click' | 'dblclick';

export interface TwoStepState {
  /** Is the title currently armed (highlighted / focused)? */
  selected: boolean;
  /** Did THIS transition open the detail? */
  open: boolean;
}

/**
 * `selected` is the state BEFORE the action. The returned `open` is an
 * edge, not a state: the caller fires its open handler on `true` and never
 * re-reads it.
 */
export function nextSelectState(selected: boolean, action: TwoStepAction): TwoStepState {
  // A double-click is unambiguous intent, whatever the arm state was. It
  // stays selected so the opened detail's origin is still visibly marked.
  if (action === 'dblclick') return { selected: true, open: true };
  // First click: arm only. Second click on an armed title: open.
  return selected ? { selected: true, open: true } : { selected: true, open: false };
}

/**
 * Convenience for a surface that tracks which of MANY titles is armed by id
 * rather than a boolean per title (a list of sub-headings). `armed` is the
 * currently-armed id, or null.
 */
export function nextArmedId(
  armed: string | null,
  id: string,
  action: TwoStepAction,
): { armed: string | null; open: boolean } {
  const { open } = nextSelectState(armed === id, action);
  return { armed: id, open };
}
