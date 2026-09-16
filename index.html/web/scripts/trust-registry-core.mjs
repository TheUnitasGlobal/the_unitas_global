/**
 * REV-36 MISSION 1 -- the Trust Registry, pure half (no fs, no process, no
 * clock). Codex ch.13 stage-3 runs a standing local automation (the idle
 * sensor) that a security reviewer or an anti-malware heuristic could
 * reasonably flag as "unauthorized persistence". The registry is the founder's
 * signed statement that these specific processes and files ARE authorized: a
 * list of scheduled tasks, the exact scripts that implement them (pinned by
 * sha256) and the derived assembly the probe compiles. `docs/security/
 * TRUST_REGISTRY.md` is the human policy; this module is the machine check.
 *
 * These functions decide everything; scripts/trust-registry.mjs only reads
 * files and hashes them and hands the digests here, so the whole comparison is
 * unit-testable without a filesystem.
 */

/**
 * @typedef {object} FileEntry
 * @property {'file'} kind
 * @property {string} id
 * @property {string} path            index.html-relative, forward slashes
 * @property {string} [sha256]        lower-case hex, 64 chars (absent until first --write)
 * @property {boolean} [optional]     an entry whose file may not exist yet (lane B's files)
 * @property {string} [purpose]
 * @property {string} [doctrine]
 *
 * @typedef {object} TaskEntry
 * @property {'scheduled-task'} kind
 * @property {string} id
 * @property {string} name
 * @property {string} [trigger]
 * @property {string} [principal]
 * @property {string} [action]
 * @property {string[]} [allowed]
 * @property {string[]} [forbidden]
 * @property {string} [purpose]
 * @property {string} [doctrine]
 *
 * @typedef {object} DerivedEntry
 * @property {'derived-assembly'} kind
 * @property {string} id
 * @property {string} path
 * @property {string} source          id of the source entry that produces it
 * @property {boolean} pinned
 * @property {string} [purpose]
 *
 * @typedef {FileEntry | TaskEntry | DerivedEntry} Entry
 *
 * @typedef {object} Registry
 * @property {number} version
 * @property {string} doctrine
 * @property {string} authorizedBy
 * @property {string} [authorizedAt]
 * @property {string} [updatedAt]
 * @property {Entry[]} entries
 */

const SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * Parse and validate a registry object. Throws on a shape that could hide a
 * missing check (a bad version, a non-array entries, an entry without a kind).
 * @param {unknown} json
 * @returns {Registry}
 */
export function parseRegistry(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('trust-registry: root must be an object');
  const r = /** @type {Record<string, unknown>} */ (json);
  if (r.version !== 1) throw new Error(`trust-registry: unsupported version ${String(r.version)}`);
  if (typeof r.authorizedBy !== 'string' || !r.authorizedBy.trim()) throw new Error('trust-registry: authorizedBy is required');
  if (!Array.isArray(r.entries)) throw new Error('trust-registry: entries must be an array');
  for (const [i, raw] of r.entries.entries()) {
    if (!raw || typeof raw !== 'object') throw new Error(`trust-registry: entry ${i} is not an object`);
    const e = /** @type {Record<string, unknown>} */ (raw);
    if (e.kind !== 'file' && e.kind !== 'scheduled-task' && e.kind !== 'derived-assembly') {
      throw new Error(`trust-registry: entry ${i} has an unknown kind ${String(e.kind)}`);
    }
    if (typeof e.id !== 'string' || !e.id.trim()) throw new Error(`trust-registry: entry ${i} needs an id`);
    if (e.kind === 'file') {
      if (typeof e.path !== 'string' || !e.path.trim()) throw new Error(`trust-registry: file entry ${e.id} needs a path`);
      if (e.sha256 !== undefined && !(typeof e.sha256 === 'string' && SHA256_RE.test(e.sha256))) {
        throw new Error(`trust-registry: file entry ${e.id} has a malformed sha256`);
      }
    }
    if (e.kind === 'scheduled-task' && (typeof e.name !== 'string' || !e.name.trim())) {
      throw new Error(`trust-registry: scheduled-task entry ${e.id} needs a name`);
    }
    if (e.kind === 'derived-assembly' && (typeof e.path !== 'string' || typeof e.source !== 'string')) {
      throw new Error(`trust-registry: derived-assembly entry ${e.id} needs a path and a source`);
    }
  }
  return /** @type {Registry} */ (json);
}

/** All file entries in the registry. @param {Registry} reg @returns {FileEntry[]} */
export function fileEntries(reg) {
  return /** @type {FileEntry[]} */ (reg.entries.filter((e) => e.kind === 'file'));
}

/** All scheduled-task entries. @param {Registry} reg @returns {TaskEntry[]} */
export function taskEntries(reg) {
  return /** @type {TaskEntry[]} */ (reg.entries.filter((e) => e.kind === 'scheduled-task'));
}

/**
 * @typedef {object} VerifyVerdict
 * @property {boolean} ok
 * @property {string[]} verified   ids whose on-disk digest matches
 * @property {{ id: string, path: string, expected: string, actual: string | null }[]} mismatched
 * @property {string[]} missing    ids of non-optional files that are absent
 * @property {string[]} pending    ids of optional files that are absent (reported, not a failure)
 * @property {string[]} unstamped  ids of present files that have no sha256 yet (need --write)
 */

/**
 * Compare the registry's pinned digests against the digests actually read off
 * disk. `actual` maps a file entry's path to its sha256, or null when the file
 * is absent. Pure: the caller does the reading and hashing.
 *
 * @param {Registry} reg
 * @param {Record<string, string | null>} actual  path -> sha256 | null
 * @returns {VerifyVerdict}
 */
export function compareDigests(reg, actual) {
  /** @type {VerifyVerdict} */
  const verdict = { ok: true, verified: [], mismatched: [], missing: [], pending: [], unstamped: [] };
  for (const e of fileEntries(reg)) {
    const got = Object.prototype.hasOwnProperty.call(actual, e.path) ? actual[e.path] : null;
    if (got === null) {
      if (e.optional) verdict.pending.push(e.id);
      else {
        verdict.missing.push(e.id);
        verdict.ok = false;
      }
      continue;
    }
    if (!e.sha256) {
      // Present but never stamped: not a corruption, but not verified either.
      verdict.unstamped.push(e.id);
      verdict.ok = false;
      continue;
    }
    if (e.sha256 === got) {
      verdict.verified.push(e.id);
    } else {
      verdict.mismatched.push({ id: e.id, path: e.path, expected: e.sha256, actual: got });
      verdict.ok = false;
    }
  }
  return verdict;
}

/**
 * A copy of the registry with every present file's sha256 refreshed from
 * `actual` and `updatedAt` set. Absent files keep whatever they had (an
 * optional file that does not exist yet stays unstamped). Pure.
 *
 * @param {Registry} reg
 * @param {Record<string, string | null>} actual
 * @param {string} updatedAt  ISO timestamp (the CLI supplies it; the core never reads a clock)
 * @returns {Registry}
 */
export function stampRegistry(reg, actual, updatedAt) {
  const entries = reg.entries.map((e) => {
    if (e.kind !== 'file') return e;
    const got = Object.prototype.hasOwnProperty.call(actual, e.path) ? actual[e.path] : null;
    return got ? { ...e, sha256: got } : e;
  });
  return { ...reg, updatedAt, entries };
}

/**
 * The one-line Korean attestation the daemon logs and the CLI prints.
 * @param {VerifyVerdict} verdict
 * @returns {string}
 */
export function attestationLine(verdict) {
  if (verdict.ok) {
    const pend = verdict.pending.length ? ` (대기 ${verdict.pending.length})` : '';
    return `신뢰 등록 검증 OK -- 파일 ${verdict.verified.length}건 일치${pend}`;
  }
  const parts = [];
  if (verdict.mismatched.length) parts.push(`불일치 ${verdict.mismatched.length}`);
  if (verdict.missing.length) parts.push(`누락 ${verdict.missing.length}`);
  if (verdict.unstamped.length) parts.push(`미각인 ${verdict.unstamped.length}`);
  return `신뢰 등록 검증 실패 -- ${parts.join(' · ')} (npm run security:trust:write 필요)`;
}
