import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Module-level test isolation (CLAUDE.md) -- pure static-CSS-text assertions
// only, no Supabase, no other module's fixtures.
//
// REV-15 (SPEC.md §1, §1.4): the field bug this guards against was a single
// declaration -- `html[data-unitas-surface='quantum-white'] body { filter:
// brightness(var(--qw-lum)) }` -- that made `<body>` the CSS containing
// block for every `position: fixed` descendant site-wide (the pre-launch
// curtain, the nav, every ModalPortal dialog, ExitGuard's shroud), so on a
// 667px-tall iPhone SE the curtain rendered 1702px tall (the full document
// height) instead of one viewport. `filter`, `backdrop-filter`, `transform`,
// `perspective`, `will-change` (naming any of those), `contain` (any value
// but `none`), and the individual transform properties `translate` /
// `rotate` / `scale` all trigger the same hijack when declared (with a
// non-`none` value) on `html`, `body`, or `.dashboard-zoom` -- the three
// ancestors common to every fixed-position layer in this app
// (`app/[locale]/layout.tsx`'s `.dashboard-zoom` wraps the nav + page
// content; the curtain, AudioGate, and every ModalPortal-portaled dialog
// render as siblings of it, still descending from `html`/`body`).
//
// This is a plain-text CSS scan (no PostCSS dependency), deliberately
// tolerant of nested @media/@supports wrappers: the extraction regex below
// only ever matches the INNERMOST `selector { declarations }` pair at each
// scan position (it cannot itself match a block containing a nested `{`),
// so it naturally skips straight past `@media (...) {` / `@supports (...) {`
// wrapper headers to the real style rules inside them -- exactly the rules
// this guard needs to inspect.

const CSS_FILES = ['app/quantum-white.css', 'app/globals.css', 'app/splash.css'];

const FORBIDDEN_PROPS = [
  'filter',
  'backdrop-filter',
  '-webkit-backdrop-filter',
  'transform',
  'perspective',
  'will-change',
  'contain',
  'translate',
  'rotate',
  'scale',
] as const;

interface CssRule {
  selector: string;
  body: string;
}

/** Extracts every leaf `selector { declarations }` pair from raw CSS text (comments stripped). */
function extractLeafRules(css: string): CssRule[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stripped)) !== null) {
    rules.push({ selector: match[1].trim(), body: match[2] });
  }
  return rules;
}

/**
 * True if this comma-separated selector PART's rightmost simple selector is
 * the bare root element -- `html` or `body`, whether written alone,
 * attribute-qualified (`html[data-unitas-surface='quantum-white']`), or as
 * a descendant combinator (`html[data-unitas-surface='quantum-white']
 * body`, the exact shape of the original bug's selector) -- or `.dashboard-
 * zoom`. Attribute selectors don't change WHICH real element a rule
 * targets when that element is `<html>`/`<body>` (there is exactly one of
 * each per document) or narrow the descendant chain to anything but that
 * same singular element, so only the rightmost token matters here; this
 * codebase's actual selectors never use `>`/`~`/`+` combinators.
 */
function isFixedLayerAncestorSelector(part: string): boolean {
  const trimmed = part.trim();
  if (trimmed === '.dashboard-zoom') return true;
  const stripped = trimmed
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped === '') return false;
  const tokens = stripped.split(' ');
  const last = tokens[tokens.length - 1];
  return last === 'html' || last === 'body';
}

/** True if `value` for `prop` actually establishes a fixed-position containing block. */
function isRiskyValue(prop: string, value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === '' || v === 'none') return false;
  if (prop === 'will-change') {
    return FORBIDDEN_PROPS.some((risky) => risky !== 'will-change' && v.includes(risky));
  }
  if (prop === 'contain') {
    // `contain: size` / `strict` / `content` alone don't include layout/paint in
    // every browser's interpretation, but `strict`/`content`/`paint`/`layout` all
    // do per spec -- treat any non-`none` value as risky (conservative, matches
    // SPEC.md's blanket prohibition).
    return true;
  }
  return true;
}

describe('REV-15 fixed-layer containing-block guard (SPEC.md §1, §1.4)', () => {
  for (const relPath of CSS_FILES) {
    it(`${relPath} declares no filter|backdrop-filter|transform|perspective|will-change|contain|translate|rotate|scale on html/body/.dashboard-zoom`, () => {
      const css = readFileSync(join(__dirname, '../..', relPath), 'utf8');
      const rules = extractLeafRules(css);
      const violations: string[] = [];

      for (const rule of rules) {
        const parts = rule.selector.split(',');
        if (!parts.some(isFixedLayerAncestorSelector)) continue;

        for (const decl of rule.body.split(';')) {
          const colon = decl.indexOf(':');
          if (colon === -1) continue;
          const prop = decl.slice(0, colon).trim().toLowerCase();
          const value = decl.slice(colon + 1);
          if ((FORBIDDEN_PROPS as readonly string[]).includes(prop) && isRiskyValue(prop, value)) {
            violations.push(`"${rule.selector}" { ${prop}: ${value.trim()} }`);
          }
        }
      }

      expect(violations, violations.join('\n')).toEqual([]);
    });
  }
});
