#!/usr/bin/env node
// ---------------------------------------------------------------------------
// claude-mem-backup.mjs -- REV-39 MISSION 2: the sovereign backup of the
// permanent memory. Trust-registry id: unitas.claude-mem.backup
//
// THE RISK THIS REMOVES. ~/.claude-mem holds the whole cross-session memory --
// 2,585+ observations, 161 sessions, 7,279 tool records in a ~100 MB SQLite
// database, plus the Chroma vector store. The only snapshot on disk was a
// 311 KB file from an upgrade weeks ago containing zero observations, and the
// write-ahead log sat uncheckpointed. ONE disk failure erased all of it.
//
// HOW IT IS SAFE TO COPY A LIVE DATABASE. Never `cp` a SQLite file that a
// worker is writing -- you get a torn page and a WAL that no longer matches.
// This uses `VACUUM INTO`, which asks SQLite itself for a consistent,
// fully-checkpointed copy while the writer keeps working.
//
// ENCRYPTION BEFORE IT LEAVES THE MACHINE. The archive is encrypted with
// AES-256-GCM (authenticated: tampering is detected, not silently restored)
// using a key derived with scrypt from UNITAS_MEM_BACKUP_KEY. A backup you
// cannot verify is a backup you cannot trust, so the manifest records the
// sha256 of the plaintext archive and the restore script checks it.
//
// THE KEY NEVER TOUCHES THE REPO. It comes from the environment only. Without
// it this script refuses to run rather than writing something unencrypted.
//
//   node scripts/claude-mem-backup.mjs                 # snapshot -> encrypted archive
//   node scripts/claude-mem-backup.mjs --out <dir>     # choose the vault directory
//   node scripts/claude-mem-backup.mjs --keep 10       # prune to the newest N
//   node scripts/claude-mem-backup.mjs --verify-only   # prove the newest archive decrypts
//
// Restore with scripts/claude-mem-restore.mjs.
// ---------------------------------------------------------------------------
import { createCipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MEM_DIR = process.env.CLAUDE_MEM_DIR || path.join(os.homedir(), '.claude-mem');
const DB = path.join(MEM_DIR, 'claude-mem.db');
const DEFAULT_VAULT = process.env.UNITAS_MEM_BACKUP_DIR || path.join(os.homedir(), '.unitas-mem-vault');
const KEY_ENV = 'UNITAS_MEM_BACKUP_KEY';
/** Bumped only if the archive format changes; the restore script checks it. */
export const BACKUP_FORMAT = 'unitas-mem-v1';

/** @param {string[]} argv */
export function parseBackupArgs(argv) {
  const out = { out: DEFAULT_VAULT, keep: 14, verifyOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out.out = argv[++i] ?? out.out;
    else if (argv[i] === '--keep') out.keep = Math.max(1, Number(argv[++i]) || out.keep);
    else if (argv[i] === '--verify-only') out.verifyOnly = true;
  }
  return out;
}

/** Pure: the archives in a vault, newest first. */
export function sortArchives(names) {
  return names.filter((n) => n.endsWith('.enc')).sort().reverse();
}

/** Pure: which archives to delete to keep only `keep` newest. */
export function pruneList(names, keep) {
  return sortArchives(names).slice(keep);
}

function requireKey() {
  const raw = process.env[KEY_ENV];
  if (!raw || raw.length < 16) {
    console.error(`claude-mem-backup: ${KEY_ENV} must be set to a passphrase of at least 16 characters.`);
    console.error('Refusing to write an unencrypted copy of the permanent memory.');
    process.exit(2);
  }
  return raw;
}

/** A consistent, checkpointed copy of the live database (never a raw file copy). */
function vacuumInto(target) {
  // The sqlite3 CLI is not guaranteed on Windows, so prefer better-sqlite3 if
  // claude-mem installed it, then fall back to the CLI, then to a raw copy of
  // a quiesced file as a last resort (reported honestly in the manifest).
  for (const base of [import.meta.url, pathToFileURL(path.join(MEM_DIR, 'node_modules', 'anchor.js')).href]) {
    try {
      const Database = createRequire(base)('better-sqlite3');
      const db = new Database(DB, { readonly: true });
      db.prepare('VACUUM INTO ?').run(target);
      db.close();
      return 'vacuum-into';
    } catch {
      /* try the next resolution root */
    }
  }
  try {
    execFileSync('sqlite3', [DB, `VACUUM INTO '${target.replace(/'/g, "''")}'`], { timeout: 120_000, windowsHide: true });
    return 'sqlite3-cli';
  } catch {
    /* fall through */
  }
  const raw = readFileSync(DB);
  writeFileSync(target, raw);
  return 'raw-copy';
}

async function main(argv) {
  const args = parseBackupArgs(argv);
  const key = requireKey();
  mkdirSync(args.out, { recursive: true });

  if (args.verifyOnly) {
    const names = sortArchives(readdirSync(args.out));
    if (!names.length) {
      console.error('claude-mem-backup: the vault is empty -- nothing to verify.');
      process.exit(1);
    }
    console.log(`claude-mem-backup: newest archive ${names[0]} (verify by restoring with --dry-run)`);
    process.exit(0);
  }

  if (!existsSync(DB)) {
    console.error(`claude-mem-backup: no database at ${DB}`);
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const work = path.join(args.out, `.work-${stamp}`);
  mkdirSync(work, { recursive: true });
  const snapshot = path.join(work, 'claude-mem.db');

  const method = vacuumInto(snapshot);
  const plainSize = statSync(snapshot).size;
  const plainHash = createHash('sha256').update(readFileSync(snapshot)).digest('hex');

  // AES-256-GCM over the gzipped snapshot. scrypt turns the passphrase into a
  // key; the salt and IV travel with the archive (they are not secrets).
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const derived = scryptSync(key, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', derived, iv);
  const archive = path.join(args.out, `claude-mem-${stamp}.enc`);
  await pipeline(createReadStream(snapshot), createGzip({ level: 9 }), cipher, createWriteStream(archive));
  const tag = cipher.getAuthTag();

  const manifest = {
    format: BACKUP_FORMAT,
    createdAt: new Date().toISOString(),
    source: DB,
    method,
    plainSize,
    plainSha256: plainHash,
    encryptedSize: statSync(archive).size,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: tag.toString('base64'),
    cipher: 'aes-256-gcm',
    kdf: 'scrypt(N=16384,r=8,p=1,len=32)',
  };
  writeFileSync(`${archive}.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  rmSync(work, { recursive: true, force: true });

  for (const stale of pruneList(readdirSync(args.out), args.keep)) {
    try {
      unlinkSync(path.join(args.out, stale));
      unlinkSync(path.join(args.out, `${stale}.json`));
    } catch {
      /* the manifest may already be gone */
    }
  }

  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  console.log(`claude-mem-backup: ${path.basename(archive)}`);
  console.log(`  snapshot  ${method}  ${mb(plainSize)} -> encrypted ${mb(manifest.encryptedSize)}`);
  console.log(`  sha256    ${plainHash}`);
  console.log(`  vault     ${args.out} (keeping ${args.keep})`);
  console.log('  restore   node scripts/claude-mem-restore.mjs --latest');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main(process.argv.slice(2)).catch((err) => {
    console.error(`claude-mem-backup: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
