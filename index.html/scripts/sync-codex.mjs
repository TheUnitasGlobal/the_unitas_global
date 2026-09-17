#!/usr/bin/env node
// UNITAS sovereign codex drift gate.
//
// Canon = the 3 byte-identical root files (git repo root, one level above this
// operational root): CLAUDE.md, THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md,
// .roo/rules/unitas-constitution.md. Their full text (normalized: UTF-8 BOM
// stripped, CRLF -> LF) is embedded verbatim, between
// `<!-- UNITAS-CODEX-VERBATIM BEGIN/END -->` markers, in 4 operational copies
// under this directory (index.html/). This script re-derives the canonical
// sha256 from the root files every run (never hardcodes it) and fails closed
// if any copy's marker block has drifted, or if the root 3 disagree with
// each other.
//
// Vercel's Root Directory is scoped to this operational root, so its build
// checkout does not include the git-root canon files one level up (by
// deliberate infra config, not an error — see CLAUDE.md). When they're
// absent, this script falls back to treating the first operational copy as
// the reference and only checks the 4 copies against each other, so a
// missing root doesn't fail a legitimate deploy but a copy actually
// drifting from its siblings still does.
//
// Usage:
//   node scripts/sync-codex.mjs            verify (default) — exit 1 on drift
//   node scripts/sync-codex.mjs --write     rewrite each copy's marker block
//                                           from canon, then verify

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  EXPECTED_CHAPTERS,
  carriesDoctrine,
  verifyStructure,
} from '../web/scripts/codex-structure-core.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OPERATIONAL_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(OPERATIONAL_ROOT, '..');

const BEGIN_TAG = '<!-- UNITAS-CODEX-VERBATIM BEGIN -->\n';
const END_TAG = '<!-- UNITAS-CODEX-VERBATIM END -->';

const CANON_FILES = [
  'CLAUDE.md',
  'THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md',
  path.join('.roo', 'rules', 'unitas-constitution.md'),
].map((p) => path.join(REPO_ROOT, p));

const COPY_FILES = [
  'CLAUDE.md',
  'THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md',
  path.join('.roo', 'rules', 'unitas-constitution.md'),
  path.join('.continue', 'context', 'THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md'),
].map((p) => path.join(OPERATIONAL_ROOT, p));

// Files that do NOT carry the verbatim block but DO transcribe the chapter
// structure in their own prose. `--write` cannot repair these -- they are
// hand-written summaries -- so all this gate can do is prove they are not
// stale, which is exactly the failure that has recurred seven times
// (v17.0, v19.0, v20.0, v23.0, v26.0, v37.0, v41.0): the canon moves, the verbatim
// copies get re-written, and these five keep citing the superseded edition.
//
// `.aider.conf.yml` is gitignored, and none of these are guaranteed to exist
// in a deploy checkout, so a missing file is skipped with a warning rather
// than failing a legitimate build. A file that IS present must be current.
const SUMMARY_FILES = [
  path.join('.github', 'copilot-instructions.md'),
  path.join('.continue', 'config.yaml'),
  '.aider.conf.yml',
  path.join('.github', 'agents', 'unitas-orchestrator.agent.md'),
  path.join('.github', 'agents', 'unitas-claude-reviewer.agent.md'),
  path.join('.github', 'agents', 'unitas-ux-reviewer.agent.md'),
].map((p) => path.join(OPERATIONAL_ROOT, p));

// FINAL_REPORT A-4, half two: SUMMARY_FILES above resolve against
// OPERATIONAL_ROOT, so index.html/.github/copilot-instructions.md is gated and
// the git-root file of the same name never was -- by any gate, ever.
//
// It cannot simply be appended to the list. That path is owned by the
// claude-mem plugin, which rewrites it with a <claude-mem-context> block; a
// hard gate there would paint the build red every time a plugin wrote a file
// it owns. The rule is therefore CONTENT-based: it is checked when it carries
// doctrine, and skipped when it is a generated stub. If the founder ever
// promotes it to a real summary, it starts being gated on that commit with no
// further change here.
const CONDITIONAL_SUMMARY_FILES = [
  path.join('.github', 'copilot-instructions.md'),
].map((p) => path.join(REPO_ROOT, p));

/** Every `vNN.N` the text mentions, as numbers, highest last. */
function versionsIn(text) {
  return [...text.matchAll(/\bv(\d{1,3})\.(\d{1,3})\b/g)]
    .map((m) => Number(m[1]) + Number(m[2]) / 1000)
    .sort((a, b) => a - b);
}

/** The codex edition the canon declares, e.g. 37.0 -> 37. */
function canonVersion(canonText) {
  const m = canonText.match(/Ultimate Sovereign Master Codex v(\d{1,3})\.(\d{1,3})/);
  if (!m) throw new Error('canon does not declare an "Ultimate Sovereign Master Codex vNN.N" edition');
  return { label: `v${m[1]}.${m[2]}`, value: Number(m[1]) + Number(m[2]) / 1000 };
}

/**
 * A summary passes when it names the current edition AND names no edition
 * newer than it. Citing an OLDER edition stays legal on purpose -- these
 * files carry lines like "구 v26.0의 25장 체계를 14장으로 통합 압축" -- but a
 * file whose newest citation is an older edition has been left behind.
 */
function verifySummaries(canon) {
  const version = canonVersion(canon.text);
  const lastChapter = EXPECTED_CHAPTERS[EXPECTED_CHAPTERS.length - 1].n;
  const results = [];
  for (const file of [...SUMMARY_FILES, ...CONDITIONAL_SUMMARY_FILES]) {
    const rel = path.relative(REPO_ROOT, file);
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        results.push({ file: rel, ok: true, skipped: true, reason: 'not present in this checkout' });
        continue;
      }
      results.push({ file: rel, ok: false, reason: `unreadable: ${err.message}` });
      continue;
    }
    const text = normalize(raw);

    // Conditional entries (git-root copilot-instructions.md) are only in scope
    // while they actually transcribe doctrine.
    if (CONDITIONAL_SUMMARY_FILES.includes(file) && !carriesDoctrine(text)) {
      results.push({ file: rel, ok: true, skipped: true, reason: 'not a doctrine summary in this checkout' });
      continue;
    }

    // The CHAPTER-STRUCTURE axis (FINAL_REPORT A-4, half one). The version
    // string is a label; the chapter spine is the document. Eight editions in
    // a row the label was updated and the spine was not, and this gate passed
    // every one of them. A file that enumerates the structure (>= 5 distinct
    // 제N장 citations) must reach the canon's LAST chapter and must not cite a
    // chapter beyond it. Files that merely mention a chapter or two in passing
    // are not enumerating the structure and are left alone.
    const citedChapters = new Set(
      [...text.matchAll(/제(\d{1,2})장/g)].map((m) => Number(m[1])),
    );
    if (citedChapters.size >= 5) {
      // A chapter number ABOVE the canon's last is NOT an error: these files
      // legitimately carry history ("구 v26.0 제23장의 ... 조항은 v37.0에서
      // 삭제되어 v41.0에도 없음"), exactly as versionsIn() lets them cite an
      // older vNN.N. The failure this axis exists to catch is the opposite,
      // and only the opposite: a file that enumerates the structure and
      // STOPS SHORT of the canon's last chapter -- which is what happened at
      // every one of the eight recurrences. Being AHEAD of canon is already
      // caught by the version rule below.
      if (!citedChapters.has(lastChapter)) {
        const highest = Math.max(...citedChapters);
        results.push({
          file: rel,
          ok: false,
          reason: `enumerates the chapter structure but stops at 제${highest}장; canon ends at 제${lastChapter}장 (superseded chapter map)`,
        });
        continue;
      }
    }

    const seen = versionsIn(text);
    if (!text.includes(version.label)) {
      results.push({
        file: rel,
        ok: false,
        reason: seen.length
          ? `never cites ${version.label}; newest edition it cites is v${seen[seen.length - 1].toFixed(1)}`
          : `never cites ${version.label}`,
      });
      continue;
    }
    const ahead = seen.filter((v) => v > version.value);
    if (ahead.length > 0) {
      results.push({ file: rel, ok: false, reason: `cites an edition newer than canon ${version.label}` });
      continue;
    }
    results.push({ file: rel, ok: true });
  }
  return { version, results };
}

function normalize(raw) {
  let s = raw;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.replace(/\r\n/g, '\n');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function extractBlock(normalizedContent, filePath) {
  const beginIndex = normalizedContent.indexOf(BEGIN_TAG);
  const endIndex = normalizedContent.indexOf(END_TAG);
  if (beginIndex === -1 || endIndex === -1) {
    throw new Error(`missing UNITAS-CODEX-VERBATIM markers in ${filePath}`);
  }
  return {
    before: normalizedContent.slice(0, beginIndex + BEGIN_TAG.length),
    block: normalizedContent.slice(beginIndex + BEGIN_TAG.length, endIndex),
    after: normalizedContent.slice(endIndex),
  };
}

function loadCanon() {
  const digests = new Map();
  for (const file of CANON_FILES) {
    let normalized;
    try {
      normalized = normalize(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return loadCanonFromFirstCopy(err);
      throw err;
    }
    digests.set(file, { normalized, hash: sha256(normalized) });
  }
  const hashes = new Set([...digests.values()].map((d) => d.hash));
  if (hashes.size > 1) {
    const detail = [...digests.entries()]
      .map(([file, d]) => `  ${path.relative(REPO_ROOT, file)} = ${d.hash}`)
      .join('\n');
    throw new Error(`canonical root files disagree with each other:\n${detail}`);
  }
  const [first] = digests.values();
  return { text: first.normalized, hash: first.hash, source: 'git-root canon' };
}

function loadCanonFromFirstCopy(rootErr) {
  console.warn(`[sync-codex] git-root canon unavailable (${rootErr.path}) — falling back to cross-copy check only.`);
  const [firstCopy] = COPY_FILES;
  const normalized = normalize(fs.readFileSync(firstCopy, 'utf8'));
  const { block } = extractBlock(normalized, firstCopy);
  return { text: block, hash: sha256(block), source: `first copy (${path.relative(OPERATIONAL_ROOT, firstCopy)})` };
}

function verify(canon) {
  const results = [];
  for (const file of COPY_FILES) {
    const rel = path.relative(REPO_ROOT, file);
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (err) {
      results.push({ file: rel, ok: false, reason: `unreadable: ${err.message}` });
      continue;
    }
    try {
      const { block } = extractBlock(normalize(raw), file);
      const hash = sha256(block);
      results.push({ file: rel, ok: hash === canon.hash, hash });
    } catch (err) {
      results.push({ file: rel, ok: false, reason: err.message });
    }
  }
  return results;
}

function write(canon) {
  for (const file of COPY_FILES) {
    const raw = fs.readFileSync(file, 'utf8');
    const { before, after } = extractBlock(normalize(raw), file);
    fs.writeFileSync(file, `${before}${canon.text}${after}`, 'utf8');
  }
}

function main() {
  const mode = process.argv.includes('--write') ? 'write' : 'verify';
  const canon = loadCanon();

  if (mode === 'write') {
    write(canon);
  }

  // Structural assertion FIRST. A canon whose chapter spine or 1000-slot list
  // is broken must not be propagated to four copies by --write, and must not
  // be certified by --verify: hashing a corrupted document only proves the
  // corruption is consistent.
  const structure = verifyStructure(canon.text);

  const results = verify(canon);
  const drifted = results.filter((r) => !r.ok);

  console.log(`[sync-codex] canon sha256 = ${canon.hash} (source: ${canon.source})`);
  console.log(
    `[sync-codex] structure: ${structure.chapters.length} chapters, ${structure.groups.length} slot groups, ${structure.stats.total} slots (결번 ${structure.stats.missing.length}), 표기 ${structure.stats.distinctTerms}종 중 ${structure.stats.repeatedTerms}종이 ${structure.stats.slotsWithRepeatedTerm}슬롯에 구조적 확장 등재`,
  );
  console.log(`[sync-codex] ${structure.ok ? 'PASS' : 'FAIL'}  canon structure (제1~제${EXPECTED_CHAPTERS[EXPECTED_CHAPTERS.length - 1].n}장 + 1000 슬롯)`);
  for (const f of structure.failures) console.error(`[sync-codex]   ✖ ${f}`);
  for (const r of results) {
    console.log(`[sync-codex] ${r.ok ? 'PASS' : 'FAIL'}  ${r.file}${r.ok ? '' : `  (${r.reason ?? `hash ${r.hash} != canon`})`}`);
  }

  const summary = verifySummaries(canon);
  const summaryStale = summary.results.filter((r) => !r.ok);
  console.log(`[sync-codex] canon edition = ${summary.version.label}`);
  for (const r of summary.results) {
    const tag = r.skipped ? 'SKIP' : r.ok ? 'PASS' : 'FAIL';
    console.log(`[sync-codex] ${tag}  ${r.file}${r.reason ? `  (${r.reason})` : ''}`);
  }

  if (drifted.length > 0 || summaryStale.length > 0 || !structure.ok) {
    if (!structure.ok) {
      console.error(`[sync-codex] canon structure is broken in ${structure.failures.length} way(s) — fail-closed.`);
      console.error('[sync-codex]   fix: repair CLAUDE.md, then mirror it byte-identically into');
      console.error('[sync-codex]        THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md and .roo/rules/unitas-constitution.md.');
      console.error('[sync-codex]   the ratified chapter table lives in web/scripts/codex-structure-core.mjs');
      console.error('[sync-codex]        (EXPECTED_CHAPTERS) — a founder-ratified edition moves both in one commit.');
    }
    if (drifted.length > 0) {
      console.error(`[sync-codex] drift detected in ${drifted.length} verbatim copy/copies — fail-closed.`);
      console.error('[sync-codex]   fix: node scripts/sync-codex.mjs --write');
    }
    if (summaryStale.length > 0) {
      console.error(`[sync-codex] ${summaryStale.length} summary file(s) still describe a superseded edition — fail-closed.`);
      console.error(`[sync-codex]   fix: hand-update each one to ${summary.version.label}; --write cannot repair prose.`);
    }
    process.exit(1);
  }
  console.log(`[sync-codex] drift=0, structure OK (제1~제${EXPECTED_CHAPTERS[EXPECTED_CHAPTERS.length - 1].n}장 · 1000/1000 슬롯), all copies verbatim-identical to canon and all summaries current at ${summary.version.label}.`);
}

main();
