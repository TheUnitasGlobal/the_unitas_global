import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Module-level test isolation (CLAUDE.md) — pure static-text assertions over
 * repo files. No Supabase, no DOM, no other module's fixtures.
 *
 * MISSION 2 (founder directive 2026-09-18).
 *
 * `.claude/skills/unitas-component/SKILL.md` is a project skill: its text is
 * injected as instructions into any session that builds UI under web/. It had
 * drifted badly — it described SIX locales (twenty ship), never mentioned the
 * quantum-white surface, THE ONE CARD SKIN, the one-layer-glass rule, the
 * motion tokens, ModalPortal, the deep-modal history stack, the live-data truth
 * contract or the prebuild route validator, and it labelled `accent` as the
 * cyan brand colour when `accent` is gold and `neon` is the cyan.
 * docs/process/IMPECCABLE_TASTE.md §5 carried it as a known open item.
 *
 * The agent cannot repair it in place: the harness auto-mode classifier blocks
 * every write under `.claude/**` as [Self-Modification]. So the canonical text
 * lives in the repo at docs/skills/unitas-component/SKILL.md, where it is
 * reviewable in a diff and — here — machine-checked, and
 * scripts/agent/sync-component-skill.ps1 is the founder-run bridge that copies
 * it into place.
 *
 * This spec is the drift gate for the parts of that text that are claims about
 * this repository. The locale list and the stylesheet count are asserted
 * against the filesystem, so adding a 21st locale or an eighth sheet turns the
 * skill red instead of letting it quietly start lying again.
 */

const WEB_ROOT = join(__dirname, '../..'); // index.html/web
const OPS_ROOT = join(WEB_ROOT, '..'); // index.html

const STAGING = join(OPS_ROOT, 'docs', 'skills', 'unitas-component', 'SKILL.md');
const INSTALLED = join(OPS_ROOT, '.claude', 'skills', 'unitas-component', 'SKILL.md');
const SYNC_SCRIPT = join(OPS_ROOT, 'scripts', 'agent', 'sync-component-skill.ps1');

const SKILL = readFileSync(STAGING, 'utf8');
const SYNC = readFileSync(SYNC_SCRIPT, 'utf8');

/**
 * EOL-insensitive comparison. Both files are tracked and neither is pinned in
 * .gitattributes, so `core.autocrlf=true` rewrites them on checkout while CI on
 * Linux leaves them LF. A raw sha256 parity assertion would therefore be a
 * checkout-dependent coin flip; the content is what must not drift.
 */
function normalized(p: string): string {
  return readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}

/** Locale basenames actually shipped, e.g. ['de','en',...]. */
function shippedLocales(): string[] {
  return readdirSync(join(WEB_ROOT, 'messages'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

/** Stylesheet basenames under web/app, e.g. ['globals.css', ...]. */
function shippedSheets(): string[] {
  return readdirSync(join(WEB_ROOT, 'app'))
    .filter((f) => f.endsWith('.css'))
    .sort();
}

describe('unitas-component skill — staging copy exists and is installable', () => {
  it('opens with YAML frontmatter declaring the skill name', () => {
    // A SKILL.md without frontmatter stops loading as a skill, silently.
    expect(SKILL.startsWith('---\n')).toBe(true);
    expect(SKILL).toMatch(/^name:\s*unitas-component\s*$/m);
    expect(SKILL).toMatch(/^description:\s*\S/m);
  });

  it('is substantial enough to be the replacement rather than a stub', () => {
    expect(SKILL.length).toBeGreaterThan(8000);
  });

  it('is installed: the shipped skill matches the staging copy', () => {
    // Installed 2026-09-18 by the founder running scripts/agent/sync-component-skill.ps1.
    // Until that moment this assertion would have been red by construction, which is
    // why it lands now rather than with the staging copy. From here it is the drift
    // gate in both directions: editing docs/skills/... without re-running the bridge,
    // or hand-editing the .claude copy, turns `npm test` red.
    expect(existsSync(INSTALLED)).toBe(true);
    expect(normalized(INSTALLED)).toBe(normalized(STAGING));
  });

  it('ships the founder-run bridge that installs it, with its fail-closed checks', () => {
    expect(existsSync(SYNC_SCRIPT)).toBe(true);
    // The four guarantees the founder is relying on when running it blind.
    expect(SYNC).toContain('docs\\skills\\unitas-component\\SKILL.md');
    expect(SYNC).toContain('.claude\\skills\\unitas-component');
    expect(SYNC).toContain('SKILL.md.bak-'); // backup before overwrite
    expect(SYNC).toContain('UTF8Encoding($false)'); // no BOM ahead of the frontmatter
    expect(SYNC).toContain('Get-FileHash'); // write is verified, not assumed
  });
});

describe('unitas-component skill — the defects that made the old text harmful are gone', () => {
  it('no longer names the retired six-locale set as the mirroring target', () => {
    // The exact sentence from the superseded skill.
    expect(SKILL).not.toContain("`es.json`, `et.json`, `ja.json`, `ko.json`, `zh.json`");
  });

  it('states the true locale count and every shipped locale basename', () => {
    const locales = shippedLocales();
    expect(SKILL).toContain(`\`${locales.join(' ')}\``);
    expect(SKILL).toContain(`holds **${locales.length}** files`);
  });

  it('does not repeat the inverted accent/neon colour claim', () => {
    expect(SKILL).not.toMatch(/accent[^.\n]*cyan brand/i);
    expect(SKILL).toContain('#d4af37');
    expect(SKILL).toContain('#00f3ff');
  });

  it('states the stylesheet count the rule-1 guard actually scans', () => {
    expect(SKILL).toContain(`exactly ${shippedSheets().length} sheets`);
  });
});

describe('unitas-component skill — the load-bearing subsystems are all named', () => {
  // Each of these is a system a component author silently breaks by not knowing
  // it exists. The old skill mentioned none of them.
  const REQUIRED = [
    'quantum-white', // the second surface
    'SurfaceScope',
    '--qw-card-', // THE ONE CARD SKIN
    '--qw-ease', // motion tokens (doctrine rule 7)
    'backdrop-filter', // the one-layer glass rule
    'ModalPortal',
    'useHistoryLayer',
    'useGatedSurface',
    'DialogTower',
    '@/i18n/navigation', // locale-aware navigation wrappers
    'sovereign_auth', // the funnel gate: how to see your own work at all
    'apply-rev41-i18n.mjs', // the applicator to copy
    'unreadable', // the four-state truth contract
    'moduleAccessName', // p_module is not the registry key
    '(gated)', // page-level coin gate
    'validate-module-registry', // prebuild route registry
    'credentialShape', // shape validation, not truthiness
    '__tests__/**/*.test.ts', // the only collected guard shape
    'IMPECCABLE_TASTE.md',
  ];

  it.each(REQUIRED)('names %s', (needle) => {
    expect(SKILL).toContain(needle);
  });
});

describe('unitas-component skill — the drift gate can actually go red', () => {
  // A guard that cannot fail is worse than no guard (IMPECCABLE_TASTE rule 13).
  it('locale assertion fails when a locale is added to the filesystem but not the skill', () => {
    const withExtraLocale = [...shippedLocales(), 'xx'].sort();
    expect(SKILL).not.toContain(`\`${withExtraLocale.join(' ')}\``);
  });

  it('subsystem assertion fails for a subsystem the text does not name', () => {
    expect(SKILL).not.toContain('UIGateProvider is the React binding');
  });

  it('frontmatter assertion fails on a body with no frontmatter', () => {
    expect('# not a skill\n'.startsWith('---\n')).toBe(false);
  });
});
