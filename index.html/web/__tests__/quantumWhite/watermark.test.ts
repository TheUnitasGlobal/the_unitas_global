import { describe, expect, it } from 'vitest';
import {
  INVISIBLE_MARK_PREFIX,
  ZW_ONE,
  ZW_SENTINEL,
  ZW_SEP,
  ZW_ZERO,
  buildInvisibleMark,
  decodeInvisible,
  encodeInvisible,
  stripInvisible,
} from '../../lib/quantumWhite/watermark';

// Module-level test isolation (CLAUDE.md). Pure zero-width encode/decode --
// no DOM, no React.

describe('encodeInvisible / decodeInvisible round-trip', () => {
  it('round-trips plain ASCII', () => {
    const encoded = encodeInvisible('UNITAS-GLOBAL-OU|REV13|rev13');
    expect(decodeInvisible(encoded)).toBe('UNITAS-GLOBAL-OU|REV13|rev13');
  });

  it('round-trips non-ASCII code points, including the Estonian "OÜ" mark', () => {
    const encoded = encodeInvisible('THE UNITAS GLOBAL OÜ');
    expect(decodeInvisible(encoded)).toBe('THE UNITAS GLOBAL OÜ');
  });

  it('round-trips astral-plane code points (surrogate pairs)', () => {
    const encoded = encodeInvisible('sig-🚀-end');
    expect(decodeInvisible(encoded)).toBe('sig-🚀-end');
  });

  it('round-trips an empty string as an empty sentinel pair', () => {
    const encoded = encodeInvisible('');
    expect(decodeInvisible(encoded)).toBe('');
  });

  it('produces output built only from the four zero-width alphabet characters', () => {
    const encoded = encodeInvisible('abc');
    const alphabet = new Set([ZW_ZERO, ZW_ONE, ZW_SEP, ZW_SENTINEL]);
    expect([...encoded].every((ch) => alphabet.has(ch))).toBe(true);
  });

  it('is invisible when interleaved into surrounding visible text', () => {
    const mark = encodeInvisible('X');
    const carrier = `UNITAS${mark} — hero title`;
    expect(decodeInvisible(carrier)).toBe('X');
    // The visible text survives untouched once the mark is stripped.
    expect(stripInvisible(carrier)).toBe('UNITAS — hero title');
  });
});

describe('decodeInvisible on unmarked / corrupted input', () => {
  it('returns null for plain text with no zero-width sentinel', () => {
    expect(decodeInvisible('just a regular sentence')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeInvisible('')).toBeNull();
  });

  it('returns null when only one sentinel is present (truncated mark, no closing sentinel)', () => {
    expect(decodeInvisible(ZW_SENTINEL + ZW_ZERO + ZW_ONE)).toBeNull();
  });

  it('returns null for a non-string input', () => {
    expect(decodeInvisible(undefined as unknown as string)).toBeNull();
    expect(decodeInvisible(null as unknown as string)).toBeNull();
  });

  it('returns null when a code-point group is empty (two separators back to back)', () => {
    // sentinel, bit, SEP, SEP, bit, sentinel -> the middle group has zero bits.
    const malformed = ZW_SENTINEL + ZW_ZERO + ZW_SEP + ZW_SEP + ZW_ONE + ZW_SENTINEL;
    expect(decodeInvisible(malformed)).toBeNull();
  });

  it('returns null when a group contains a character outside the zero-width 0/1 alphabet', () => {
    const malformed = ZW_SENTINEL + 'x' + ZW_SENTINEL;
    expect(decodeInvisible(malformed)).toBeNull();
  });
});

describe('buildInvisibleMark', () => {
  it('embeds the fixed ownership prefix plus the given fingerprint', () => {
    const mark = buildInvisibleMark('build-123');
    expect(decodeInvisible(mark)).toBe(`${INVISIBLE_MARK_PREFIX}build-123`);
  });

  it('is self-identifying: the decoded mark always starts with the prefix', () => {
    const mark = buildInvisibleMark('rev13');
    expect(decodeInvisible(mark)?.startsWith('UNITAS-GLOBAL-OU|REV13|')).toBe(true);
  });
});

describe('stripInvisible', () => {
  it('removes every zero-width watermark character and leaves plain text untouched', () => {
    const mark = buildInvisibleMark('abc');
    expect(stripInvisible(`hello${mark}world`)).toBe('helloworld');
  });

  it('is a no-op on text that carries no mark', () => {
    expect(stripInvisible('plain text, no marks here')).toBe('plain text, no marks here');
  });
});
