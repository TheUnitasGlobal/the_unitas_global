import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MAX_LENGTH,
  evaluatePassword,
  isPasswordValid,
} from '../../lib/passwordPolicy';

// No shared fixtures with other __tests__/** files -- see CLAUDE.md
// "Module-level test isolation".
describe('passwordPolicy', () => {
  it('rejects a password that is missing character classes', () => {
    const result = evaluatePassword('alllowercase');
    expect(result.valid).toBe(false);
    expect(result.unmet).toEqual(expect.arrayContaining(['upper', 'digit', 'special']));
  });

  it('rejects a password shorter than the minimum', () => {
    expect(isPasswordValid('Aa1!aa')).toBe(false);
  });

  it('rejects a password longer than the bcrypt limit', () => {
    const tooLong = `Aa1!${'x'.repeat(PASSWORD_MAX_LENGTH)}`;
    expect(evaluatePassword(tooLong).unmet).toContain('length');
  });

  it('accepts a password meeting every rule', () => {
    const result = evaluatePassword('Sovereign-2026!');
    expect(result.valid).toBe(true);
    expect(result.unmet).toHaveLength(0);
    expect(result.score).toBe(4);
  });

  it('treats a range of common punctuation as special characters', () => {
    for (const ch of ['!', '@', '#', '$', '%', '^', '&', '*', '-', '_', '?']) {
      expect(evaluatePassword(`Abcdefgh1${ch}`).valid).toBe(true);
    }
  });
});
