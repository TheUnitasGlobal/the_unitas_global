import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, parseBackupArgs, pruneList, sortArchives } from '../../scripts/claude-mem-backup.mjs';
import { parseRestoreArgs, validateManifest } from '../../scripts/claude-mem-restore.mjs';

// REV-39 M2 -- the pure half of the sovereign memory backup. The v37 audit
// found the permanent memory (2,585+ observations in a ~100 MB database) had no
// real snapshot: one disk failure would have erased it. These are the rules the
// pipeline refuses to break -- an archive is never restored unless its manifest
// is the right shape, and a wrong key or an altered archive must fail loudly
// rather than restore corrupted memory.

describe('vault listing and pruning', () => {
  const names = [
    'claude-mem-2026-09-14T00-00-00-000Z.enc',
    'claude-mem-2026-09-16T00-00-00-000Z.enc',
    'claude-mem-2026-09-15T00-00-00-000Z.enc',
    'claude-mem-2026-09-16T00-00-00-000Z.enc.json',
    'notes.txt',
  ];

  it('lists only archives, newest first', () => {
    expect(sortArchives(names)).toEqual([
      'claude-mem-2026-09-16T00-00-00-000Z.enc',
      'claude-mem-2026-09-15T00-00-00-000Z.enc',
      'claude-mem-2026-09-14T00-00-00-000Z.enc',
    ]);
  });

  it('prunes the oldest beyond the keep count, never the newest', () => {
    expect(pruneList(names, 2)).toEqual(['claude-mem-2026-09-14T00-00-00-000Z.enc']);
    expect(pruneList(names, 3)).toEqual([]);
    expect(pruneList(names, 99)).toEqual([]);
  });
});

describe('argument parsing', () => {
  it('backup defaults keep at least one archive and honour overrides', () => {
    const d = parseBackupArgs([]);
    expect(d.keep).toBeGreaterThanOrEqual(1);
    expect(d.verifyOnly).toBe(false);
    const a = parseBackupArgs(['--keep', '3', '--out', 'C:/vault', '--verify-only']);
    expect(a.keep).toBe(3);
    expect(a.out).toBe('C:/vault');
    expect(a.verifyOnly).toBe(true);
    // A nonsense keep must not become zero (which would delete everything).
    expect(parseBackupArgs(['--keep', 'abc']).keep).toBeGreaterThanOrEqual(1);
    expect(parseBackupArgs(['--keep', '0']).keep).toBeGreaterThanOrEqual(1);
  });

  it('restore parses the selection flags', () => {
    const r = parseRestoreArgs(['--latest', '--dry-run']);
    expect(r.latest).toBe(true);
    expect(r.dryRun).toBe(true);
    expect(parseRestoreArgs(['--file', 'a.enc']).file).toBe('a.enc');
    expect(parseRestoreArgs(['--list']).list).toBe(true);
  });
});

describe('manifest validation -- the gate before anything is written', () => {
  const good = {
    format: BACKUP_FORMAT,
    cipher: 'aes-256-gcm',
    salt: 'c2FsdA==',
    iv: 'aXY=',
    authTag: 'dGFn',
    plainSha256: 'a'.repeat(64),
    plainSize: 1024,
  };

  it('accepts a well-formed manifest', () => {
    expect(validateManifest(good)).toEqual([]);
  });

  it('refuses a foreign format or cipher', () => {
    expect(validateManifest({ ...good, format: 'something-else' }).join()).toContain('format');
    expect(validateManifest({ ...good, cipher: 'aes-256-cbc' }).join()).toContain('cipher');
  });

  it('refuses a manifest missing any integrity field', () => {
    for (const field of ['salt', 'iv', 'authTag', 'plainSha256']) {
      const bad = { ...good, [field]: '' };
      expect(validateManifest(bad).join(), field).toContain(field);
    }
    expect(validateManifest({ ...good, plainSize: 0 }).join()).toContain('plainSize');
  });

  it('refuses a non-object manifest outright', () => {
    expect(validateManifest(null).length).toBeGreaterThan(0);
    expect(validateManifest('nope').length).toBeGreaterThan(0);
  });
});
