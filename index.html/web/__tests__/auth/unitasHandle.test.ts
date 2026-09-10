import { describe, expect, it } from 'vitest';
import { handleAddress, normalizeHandle, validateHandle } from '../../lib/auth/unitasHandle';

// REV-19 SPEC.md §8 -- @theunitas.global handle reservation rules (pure).

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
  it('blocks reserved role and brand handles', () => {
    expect(validateHandle('admin')).toBe('reserved');
    expect(validateHandle('UNITAS')).toBe('reserved');
    expect(validateHandle('postmaster')).toBe('reserved');
  });
});
