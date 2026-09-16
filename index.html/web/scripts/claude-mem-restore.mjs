#!/usr/bin/env node
// ---------------------------------------------------------------------------
// claude-mem-restore.mjs -- REV-39 MISSION 2: bring the permanent memory back.
// Trust-registry id: unitas.claude-mem.restore
//
// A backup nobody has restored is a rumour, not a plan. This is the other half
// of claude-mem-backup.mjs and it is deliberately paranoid:
//
//   1. AES-256-GCM is AUTHENTICATED -- a tampered or truncated archive fails
//      decryption outright instead of restoring silently corrupted memory.
//   2. The decrypted snapshot's sha256 is compared with the manifest before a
//      single byte is written to ~/.claude-mem.
//   3. The existing database is moved aside (never overwritten in place), so a
//      restore can itself be undone.
//   4. --dry-run proves an archive is good WITHOUT touching the live memory --
//      run it whenever you want to know the vault is real.
//
//   node scripts/claude-mem-restore.mjs --latest --dry-run   # verify only
//   node scripts/claude-mem-restore.mjs --latest             # restore newest
//   node scripts/claude-mem-restore.mjs --file <archive.enc> # restore a specific one
//   node scripts/claude-mem-restore.mjs --list               # what is in the vault
//
// Stop the claude-mem worker before a real restore; a live writer will fight it.
// ---------------------------------------------------------------------------
import { createDecipheriv, createHash, scryptSync } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BACKUP_FORMAT, sortArchives } from './claude-mem-backup.mjs';

const MEM_DIR = process.env.CLAUDE_MEM_DIR || path.join(os.homedir(), '.claude-mem');
const DB = path.join(MEM_DIR, 'claude-mem.db');
const DEFAULT_VAULT = process.env.UNITAS_MEM_BACKUP_DIR || path.join(os.homedir(), '.unitas-mem-vault');
const KEY_ENV = 'UNITAS_MEM_BACKUP_KEY';

/** @param {string[]} argv */
export function parseRestoreArgs(argv) {
  const out = { vault: DEFAULT_VAULT, file: null, latest: false, dryRun: false, list: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--vault') out.vault = argv[++i] ?? out.vault;
    else if (argv[i] === '--file') out.file = argv[++i] ?? null;
    else if (argv[i] === '--latest') out.latest = true;
    else if (argv[i] === '--dry-run') out.dryRun = true;
    else if (argv[i] === '--list') out.list = true;
  }
  return out;
}

/** Pure: the manifest checks that must hold before anything is written. */
export function validateManifest(manifest, expectedFormat = BACKUP_FORMAT) {
  const problems = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest is not an object'];
  if (manifest.format !== expectedFormat) problems.push(`format ${manifest.format} != ${expectedFormat}`);
  if (manifest.cipher !== 'aes-256-gcm') problems.push(`unexpected cipher ${manifest.cipher}`);
  for (const field of ['salt', 'iv', 'authTag', 'plainSha256']) {
    if (typeof manifest[field] !== 'string' || !manifest[field]) problems.push(`missing ${field}`);
  }
  if (!Number.isFinite(manifest.plainSize) || manifest.plainSize <= 0) problems.push('missing plainSize');
  return problems;
}

async function main(argv) {
  const args = parseRestoreArgs(argv);

  if (args.list) {
    if (!existsSync(args.vault)) {
      console.log(`claude-mem-restore: no vault at ${args.vault}`);
      process.exit(0);
    }
    const names = sortArchives(readdirSync(args.vault));
    if (!names.length) console.log(`claude-mem-restore: vault ${args.vault} is EMPTY`);
    for (const n of names) {
      const size = statSync(path.join(args.vault, n)).size;
      console.log(`  ${n}  ${(size / 1024 / 1024).toFixed(1)} MB`);
    }
    process.exit(0);
  }

  const key = process.env[KEY_ENV];
  if (!key) {
    console.error(`claude-mem-restore: ${KEY_ENV} must be set to the passphrase the backup used.`);
    process.exit(2);
  }

  let archive = args.file;
  if (!archive) {
    if (!args.latest) {
      console.error('claude-mem-restore: pass --latest or --file <archive.enc>.');
      process.exit(2);
    }
    const names = sortArchives(existsSync(args.vault) ? readdirSync(args.vault) : []);
    if (!names.length) {
      console.error(`claude-mem-restore: vault ${args.vault} is empty -- nothing to restore.`);
      process.exit(1);
    }
    archive = path.join(args.vault, names[0]);
  }

  const manifest = JSON.parse(readFileSync(`${archive}.json`, 'utf8'));
  const problems = validateManifest(manifest);
  if (problems.length) {
    console.error(`claude-mem-restore: manifest rejected -- ${problems.join('; ')}`);
    process.exit(1);
  }

  // Decrypt + decompress to a scratch file first. Nothing under ~/.claude-mem
  // is touched until the hash matches.
  const scratch = `${archive}.restore-tmp`;
  const derived = scryptSync(key, Buffer.from(manifest.salt, 'base64'), 32);
  const decipher = createDecipheriv('aes-256-gcm', derived, Buffer.from(manifest.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(manifest.authTag, 'base64'));
  try {
    await pipeline(createReadStream(archive), decipher, createGunzip(), createWriteStream(scratch));
  } catch (err) {
    rmSync(scratch, { force: true });
    console.error('claude-mem-restore: DECRYPTION FAILED -- wrong key, or the archive was altered.');
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const got = createHash('sha256').update(readFileSync(scratch)).digest('hex');
  const size = statSync(scratch).size;
  if (got !== manifest.plainSha256 || size !== manifest.plainSize) {
    rmSync(scratch, { force: true });
    console.error('claude-mem-restore: INTEGRITY CHECK FAILED -- refusing to restore.');
    console.error(`  sha256 ${got} != ${manifest.plainSha256}`);
    process.exit(1);
  }

  if (args.dryRun) {
    rmSync(scratch, { force: true });
    console.log(`claude-mem-restore: VERIFIED ${path.basename(archive)}`);
    console.log(`  decrypts cleanly, sha256 matches, ${(size / 1024 / 1024).toFixed(1)} MB of memory recoverable`);
    console.log('  (dry run -- nothing was written)');
    process.exit(0);
  }

  mkdirSync(MEM_DIR, { recursive: true });
  if (existsSync(DB)) {
    const aside = `${DB}.replaced-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    renameSync(DB, aside);
    console.log(`claude-mem-restore: existing database moved aside -> ${path.basename(aside)}`);
  }
  // The WAL/SHM belong to the database that just moved; leaving them would let
  // SQLite replay a log against a different file.
  for (const side of ['-wal', '-shm']) rmSync(`${DB}${side}`, { force: true });
  renameSync(scratch, DB);

  console.log(`claude-mem-restore: RESTORED from ${path.basename(archive)}`);
  console.log(`  ${(size / 1024 / 1024).toFixed(1)} MB -> ${DB}`);
  console.log('  restart the claude-mem worker so it reopens the restored database.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main(process.argv.slice(2)).catch((err) => {
    console.error(`claude-mem-restore: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
