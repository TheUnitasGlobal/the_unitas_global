import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareDigests, fileEntries, parseRegistry, taskEntries } from '../../scripts/trust-registry-core.mjs';

// REV-36 M1 -- the registry on disk must actually match the files on disk, and
// it must keep both scheduled tasks with the anti-persistence guard rails. This
// is the build gate behind "edit a registered file, then re-stamp": a changed
// pinned file with a stale digest fails here until `npm run security:trust:write`
// runs. Same mechanism as the codex-drift gate.

const REPO_ROOT = join(__dirname, '../../..'); // index.html
const REGISTRY = join(REPO_ROOT, 'config', 'security', 'trust-registry.json');

const reg = parseRegistry(JSON.parse(readFileSync(REGISTRY, 'utf8')));

function digestOf(rel: string): string | null {
  try {
    return createHash('sha256').update(readFileSync(join(REPO_ROOT, rel))).digest('hex');
  } catch {
    return null;
  }
}

describe('REV-36 trust registry parity', () => {
  it('every non-optional pinned file exists and its sha256 matches on disk', () => {
    const actual: Record<string, string | null> = {};
    for (const e of fileEntries(reg)) actual[e.path] = digestOf(e.path);
    const verdict = compareDigests(reg, actual);
    expect(verdict.mismatched, JSON.stringify(verdict.mismatched)).toEqual([]);
    expect(verdict.missing, JSON.stringify(verdict.missing)).toEqual([]);
    expect(verdict.unstamped, `unstamped -- run: npm run security:trust:write (${verdict.unstamped.join(', ')})`).toEqual([]);
    expect(verdict.ok).toBe(true);
  });

  it('registers both stage-3 / review scheduled tasks with the anti-persistence guard rails', () => {
    const tasks = taskEntries(reg);
    const names = tasks.map((t) => t.name);
    expect(names).toContain('UnitasIdleSensorStage3');
    expect(names).toContain('UnitasReviewAgentArchive');
    for (const t of tasks) {
      const forbidden = (t.forbidden ?? []).join(' ');
      expect(forbidden, `${t.name} must forbid EncodedCommand`).toContain('EncodedCommand');
    }
  });

  it('the idle-sensor daemon source contains no -EncodedCommand (it was removed in REV-36 M1)', () => {
    const daemon = readFileSync(join(REPO_ROOT, 'web/scripts/idle-sensor-daemon.mjs'), 'utf8');
    expect(daemon.includes('EncodedCommand')).toBe(false);
    const probe = readFileSync(join(REPO_ROOT, 'web/scripts/idle-sensor-probe.ps1'), 'utf8');
    expect(probe.includes('EncodedCommand')).toBe(false);
  });
});
