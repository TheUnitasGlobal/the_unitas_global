/**
 * Client-side password policy for UNITAS accounts.
 *
 * This is a UX pre-check only -- the real enforcement is Supabase Auth's own
 * password strength config (Dashboard -> Authentication -> Policies). Keeping
 * the rule set here in one typed place means every entry point (sign-up,
 * password change in Account settings, anonymous -> permanent upgrade) shows
 * the user the exact same requirements before the request is ever sent.
 *
 * Rules: 10-72 chars (72 = bcrypt's hard input limit), and at least one each
 * of lower-case, upper-case, digit, and a common punctuation character.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;

/** Punctuation accepted as a "special character" -- deliberately the common,
 *  keyboard-reachable set, no exotic unicode. */
export const PASSWORD_SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;:'\",.<>/?`~\\";

export type PasswordRuleId = 'length' | 'lower' | 'upper' | 'digit' | 'special';

export interface PasswordRule {
  id: PasswordRuleId;
  test: (value: string) => boolean;
}

const SPECIAL_RE = new RegExp(
  `[${PASSWORD_SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`,
);

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    test: (v) => v.length >= PASSWORD_MIN_LENGTH && v.length <= PASSWORD_MAX_LENGTH,
  },
  { id: 'lower', test: (v) => /[a-z]/.test(v) },
  { id: 'upper', test: (v) => /[A-Z]/.test(v) },
  { id: 'digit', test: (v) => /[0-9]/.test(v) },
  { id: 'special', test: (v) => SPECIAL_RE.test(v) },
];

export interface PasswordEvaluation {
  /** Every rule with a pass/fail flag, in display order. */
  results: { id: PasswordRuleId; ok: boolean }[];
  /** Rule ids not yet satisfied. */
  unmet: PasswordRuleId[];
  /** All rules satisfied. */
  valid: boolean;
  /** 0-4 coarse strength score for the meter (satisfied rules beyond length). */
  score: number;
}

export function evaluatePassword(value: string): PasswordEvaluation {
  const results = PASSWORD_RULES.map((rule) => ({ id: rule.id, ok: rule.test(value) }));
  const unmet = results.filter((r) => !r.ok).map((r) => r.id);
  const score = results.filter((r) => r.ok && r.id !== 'length').length;
  return { results, unmet, valid: unmet.length === 0, score };
}

export function isPasswordValid(value: string): boolean {
  return evaluatePassword(value).valid;
}
