import { describe, expect, it } from 'vitest';
// The core is plain ESM (.mjs) with JSDoc types; import it as the daemon does.
import {
  attestationLine,
  compareDigests,
  fileEntries,
  parseRegistry,
  stampRegistry,
  taskEntries,
} from '../../scripts/trust-registry-core.mjs';

// REV-36 M1 -- the pure Trust Registry decision functions. No fs, no clock, so
// the whole comparison is testable from literal inputs.

const REG = {
  version: 1,
  doctrine: 'test',
  authorizedBy: 'Founder',
  entries: [
    { kind: 'scheduled-task', id: 't.task', name: 'UnitasIdleSensorStage3', forbidden: ['EncodedCommand'] },
    { kind: 'file', id: 'f.a', path: 'web/scripts/a.mjs', sha256: 'a'.repeat(64) },
    { kind: 'file', id: 'f.b', path: 'web/scripts/b.ps1', sha256: 'b'.repeat(64) },
    { kind: 'file', id: 'f.opt', path: 'web/scripts/opt.mjs', optional: true },
    { kind: 'derived-assembly', id: 'd.dll', path: '%LOCALAPPDATA%\\x.dll', source: 'f.b', pinned: false },
  ],
};

describe('parseRegistry', () => {
  it('accepts a well-formed registry', () => {
    expect(parseRegistry(structuredClone(REG)).entries).toHaveLength(5);
  });

  it('rejects shapes that could hide a missing check', () => {
    expect(() => parseRegistry(null)).toThrow();
    expect(() => parseRegistry({ ...REG, version: 2 })).toThrow(/version/);
    expect(() => parseRegistry({ ...REG, authorizedBy: '' })).toThrow(/authorizedBy/);
    expect(() => parseRegistry({ ...REG, entries: 'x' })).toThrow(/entries/);
    expect(() => parseRegistry({ ...REG, entries: [{ id: 'x' }] })).toThrow(/kind/);
    expect(() => parseRegistry({ ...REG, entries: [{ kind: 'file', id: 'x' }] })).toThrow(/path/);
    expect(() => parseRegistry({ ...REG, entries: [{ kind: 'file', id: 'x', path: 'p', sha256: 'nope' }] })).toThrow(/sha256/);
  });
});

describe('fileEntries / taskEntries', () => {
  it('partition the registry by kind', () => {
    const reg = parseRegistry(structuredClone(REG));
    expect(fileEntries(reg).map((e) => e.id)).toEqual(['f.a', 'f.b', 'f.opt']);
    expect(taskEntries(reg).map((e) => e.id)).toEqual(['t.task']);
  });
});

describe('compareDigests', () => {
  const reg = parseRegistry(structuredClone(REG));

  it('is OK when every present file matches and the optional one is absent', () => {
    const v = compareDigests(reg, { 'web/scripts/a.mjs': 'a'.repeat(64), 'web/scripts/b.ps1': 'b'.repeat(64), 'web/scripts/opt.mjs': null });
    expect(v.ok).toBe(true);
    expect(v.verified.sort()).toEqual(['f.a', 'f.b']);
    expect(v.pending).toEqual(['f.opt']);
    expect(v.mismatched).toEqual([]);
    expect(v.missing).toEqual([]);
  });

  it('flags a mismatch', () => {
    const v = compareDigests(reg, { 'web/scripts/a.mjs': 'c'.repeat(64), 'web/scripts/b.ps1': 'b'.repeat(64), 'web/scripts/opt.mjs': null });
    expect(v.ok).toBe(false);
    expect(v.mismatched).toEqual([{ id: 'f.a', path: 'web/scripts/a.mjs', expected: 'a'.repeat(64), actual: 'c'.repeat(64) }]);
  });

  it('flags a missing NON-optional file but treats an absent optional one as pending', () => {
    const v = compareDigests(reg, { 'web/scripts/a.mjs': null, 'web/scripts/b.ps1': 'b'.repeat(64), 'web/scripts/opt.mjs': null });
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual(['f.a']);
    expect(v.pending).toEqual(['f.opt']);
  });

  it('flags a present-but-unstamped file (no sha256 yet)', () => {
    const noHash = parseRegistry({ ...structuredClone(REG), entries: [{ kind: 'file', id: 'f.new', path: 'web/scripts/new.mjs' }] });
    const v = compareDigests(noHash, { 'web/scripts/new.mjs': 'e'.repeat(64) });
    expect(v.ok).toBe(false);
    expect(v.unstamped).toEqual(['f.new']);
  });
});

describe('stampRegistry', () => {
  it('refreshes present files, sets updatedAt, and leaves absent files unstamped', () => {
    const reg = parseRegistry(structuredClone(REG));
    const stamped = stampRegistry(reg, { 'web/scripts/a.mjs': 'x'.repeat(64), 'web/scripts/b.ps1': 'b'.repeat(64), 'web/scripts/opt.mjs': null }, '2026-09-16T00:00:00.000Z');
    expect(stamped.updatedAt).toBe('2026-09-16T00:00:00.000Z');
    const files = fileEntries(stamped);
    expect(files.find((e) => e.id === 'f.a')?.sha256).toBe('x'.repeat(64));
    expect(files.find((e) => e.id === 'f.opt')?.sha256).toBeUndefined();
  });
});

describe('attestationLine', () => {
  it('reads OK with a pending count', () => {
    expect(attestationLine({ ok: true, verified: ['a', 'b'], mismatched: [], missing: [], pending: ['c'], unstamped: [] })).toContain('OK');
    expect(attestationLine({ ok: true, verified: ['a', 'b'], mismatched: [], missing: [], pending: ['c'], unstamped: [] })).toContain('대기 1');
  });

  it('reads failed with the breakdown', () => {
    const line = attestationLine({ ok: false, verified: [], mismatched: [{ id: 'x', path: 'p', expected: 'a', actual: 'b' }], missing: ['y'], pending: [], unstamped: ['z'] });
    expect(line).toContain('실패');
    expect(line).toContain('불일치 1');
    expect(line).toContain('누락 1');
    expect(line).toContain('미각인 1');
  });
});
