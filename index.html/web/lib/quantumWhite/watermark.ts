/**
 * REV-13 invisible ownership mark: a zero-width binary encoding that rides
 * along inside copied text (hero title, watermark span) without changing how
 * anything renders, so a lifted page can later be traced back to the build
 * that shipped it.
 *
 * Alphabet (all zero-width, all survive plain-text copy/paste in every
 * mainstream browser and chat client):
 *   U+200B ZERO WIDTH SPACE      -> bit 0
 *   U+200C ZERO WIDTH NON-JOINER -> bit 1
 *   U+200D ZERO WIDTH JOINER     -> separator between code points
 *   U+2060 WORD JOINER           -> start / end sentinel
 *
 * Each Unicode CODE POINT (not UTF-16 unit, so 'Ü' and astral glyphs round
 * trip) is written as its minimal big-endian binary string. Decoding scans
 * for the first sentinel pair anywhere in the input, so it works on a whole
 * pasted paragraph, and returns null for anything that carries no mark or a
 * corrupted one.
 */

export const ZW_ZERO = '​';
export const ZW_ONE = '‌';
export const ZW_SEP = '‍';
export const ZW_SENTINEL = '⁠';

/** Fixed prefix so a decoded mark is self-identifying without a schema lookup. */
export const INVISIBLE_MARK_PREFIX = 'UNITAS-GLOBAL-OU|REV13|';

const ZW_ANY = /[​‌‍⁠]/g;

export function encodeInvisible(text: string): string {
  const parts: string[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    let bits = '';
    for (const b of cp.toString(2)) bits += b === '1' ? ZW_ONE : ZW_ZERO;
    parts.push(bits);
  }
  return ZW_SENTINEL + parts.join(ZW_SEP) + ZW_SENTINEL;
}

export function decodeInvisible(s: string): string | null {
  if (typeof s !== 'string') return null;
  const start = s.indexOf(ZW_SENTINEL);
  if (start === -1) return null;
  const end = s.indexOf(ZW_SENTINEL, start + 1);
  if (end === -1) return null;
  const body = s.slice(start + 1, end);
  if (body.length === 0) return '';
  let out = '';
  for (const group of body.split(ZW_SEP)) {
    if (group.length === 0) return null;
    let cp = 0;
    for (const ch of group) {
      if (ch === ZW_ZERO) cp = cp * 2;
      else if (ch === ZW_ONE) cp = cp * 2 + 1;
      else return null;
      if (cp > 0x10ffff) return null;
    }
    try {
      out += String.fromCodePoint(cp);
    } catch {
      return null;
    }
  }
  return out;
}

/** The mark the home embeds: `UNITAS-GLOBAL-OU|REV13|<build fingerprint>`. */
export function buildInvisibleMark(fingerprint: string): string {
  return encodeInvisible(INVISIBLE_MARK_PREFIX + fingerprint);
}

/** Strips every mark character -- for tests and for search-index sanitising. */
export function stripInvisible(s: string): string {
  return s.replace(ZW_ANY, '');
}
