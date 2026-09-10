import { describe, expect, it } from 'vitest';
import {
  handleAddress,
  handleBlocksSubmit,
  hasConfusables,
  isBrandOrRoleHandle,
  normalizeHandle,
  validateHandle,
} from '../../lib/auth/unitasHandle';

// REV-19 SPEC.md §8 (+ follow-up hardening) -- @theunitas.global handle
// reservation rules (pure).

describe('unitas mail handle', () => {
  it('normalizes case, whitespace and a pasted domain', () => {
    expect(normalizeHandle('  Dooyeong@theunitas.global ')).toBe('dooyeong');
    expect(handleAddress('Kai')).toBe('kai@theunitas.global');
  });
  it('accepts 3-20 char handles of a-z 0-9 . - _ that start and end alphanumeric', () => {
    expect(validateHandle('kai')).toBe('ok');
    expect(validateHandle('nomad.kai-01_x')).toBe('ok');
    expect(validateHandle('ab')).toBe('invalid');
    expect(validateHandle('a'.repeat(21))).toBe('invalid');
    expect(validateHandle('.kai')).toBe('invalid');
    expect(validateHandle('kai..x')).toBe('invalid');
    expect(validateHandle('kai x')).toBe('invalid');
    expect(validateHandle('')).toBe('empty');
  });
  it('requires at least one letter (digits-only handles read as numbers)', () => {
    expect(validateHandle('123456')).toBe('invalid');
    expect(validateHandle('1a2')).toBe('ok');
  });
  it('rejects look-alike glyphs instead of folding them into ASCII', () => {
    expect(hasConfusables('kai')).toBe(false);
    expect(hasConfusables('kаi')).toBe(true); // Cyrillic а
    expect(hasConfusables('ｋａｉ')).toBe(true); // full-width
    expect(validateHandle('kаi')).toBe('invalid');
    expect(validateHandle('ｋａｉ')).toBe('invalid');
    expect(validateHandle('kai​')).toBe('invalid'); // zero-width space
  });
  it('blocks reserved role, infrastructure and brand handles', () => {
    expect(validateHandle('admin')).toBe('reserved');
    expect(validateHandle('UNITAS')).toBe('reserved');
    expect(validateHandle('postmaster')).toBe('reserved');
    expect(validateHandle('mailer-daemon')).toBe('reserved');
    expect(validateHandle('dmarc')).toBe('reserved');
    expect(validateHandle('login')).toBe('reserved');
    expect(validateHandle('guest')).toBe('reserved');
  });
  it('blocks brand impersonation anywhere in the handle and role words as a prefix', () => {
    expect(isBrandOrRoleHandle('kai.unitas')).toBe(true);
    expect(validateHandle('the-unitas-team')).toBe('reserved');
    expect(validateHandle('u.n.i.t.a.s')).toBe('reserved');
    expect(validateHandle('ucoin.kai')).toBe('reserved');
    expect(validateHandle('admin2')).toBe('reserved');
    expect(validateHandle('support.kai')).toBe('reserved');
    expect(validateHandle('official-kai')).toBe('reserved');
    // ordinary handles that merely contain role letters stay fine
    expect(validateHandle('kai.supporter')).toBe('ok');
    expect(validateHandle('unit.kai')).toBe('ok');
  });
  it('gates sign-up submission on the field state', () => {
    expect(handleBlocksSubmit('empty', null)).toBe(false);
    expect(handleBlocksSubmit('invalid', null)).toBe(true);
    expect(handleBlocksSubmit('reserved', null)).toBe(true);
    expect(handleBlocksSubmit('ok', 'available')).toBe(false);
    expect(handleBlocksSubmit('ok', 'unchecked')).toBe(false);
    expect(handleBlocksSubmit('ok', 'checking')).toBe(true);
    expect(handleBlocksSubmit('ok', 'taken')).toBe(true);
  });
});
