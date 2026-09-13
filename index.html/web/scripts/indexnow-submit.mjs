// IndexNow submission -- push the live sitemap's URLs to every participating
// search engine (Bing, Yandex, Seznam.cz, Naver; Google does not participate).
//
// Run this AFTER a production deploy, never during the build:
//     npm run seo:indexnow            (add --dry-run to print and stop)
//
// Submitting a URL whose new content has not shipped yet is worse than not
// submitting -- the engine crawls immediately and caches the OLD page. So this
// script refuses to run unless it can first prove, over the network, that the
// live site is already serving the key file. Everything here is fail-closed:
// it exits non-zero and submits nothing rather than submit something wrong.
//
// The key is NOT duplicated here. It is read from public/, by finding the one
// file whose name is its own contents -- which is exactly the invariant the
// IndexNow spec requires of a root-hosted key file, so locating it and
// validating it are the same act.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const SITE_URL = 'https://www.theunitas.global';
const SITE_HOST = 'www.theunitas.global';
const MAX_URLS_PER_REQUEST = 10000;
const OK_STATUS = [200, 202];
const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

const dryRun = process.argv.includes('--dry-run');

/**
 * Refusal is thrown, not `process.exit()`-ed.
 *
 * Calling process.exit() while a fetch is still in flight tears libuv's handle
 * table down underneath it: on Windows that aborts with
 * "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" and an exit code of
 * 0xC0000409 instead of 1 -- so a caller reading the status sees a crash
 * rather than a clean, deliberate refusal. Throwing and setting
 * `process.exitCode` lets Node drain its handles and exit 1 properly.
 */
class FailClosed extends Error {}

function fail(message) {
  throw new FailClosed(message);
}

/** The key file is the one whose basename equals its own contents. */
function findKey() {
  const hits = [];
  for (const name of readdirSync(publicDir)) {
    if (!name.endsWith('.txt')) continue;
    const base = name.slice(0, -4);
    if (!KEY_PATTERN.test(base)) continue;
    const body = readFileSync(path.join(publicDir, name), 'utf8');
    if (body.trim() === base) hits.push({ name, key: base, raw: body });
  }
  if (hits.length !== 1) {
    fail(`expected exactly 1 self-naming key file in public/, found ${hits.length}`);
  }
  const [hit] = hits;
  if (hit.raw !== hit.key) {
    fail(`public/${hit.name} has leading/trailing bytes around the key (BOM or newline?)`);
  }
  return hit.key;
}

async function fetchText(url, what) {
  let res;
  try {
    res = await fetch(url, { headers: { 'user-agent': 'unitas-indexnow/1.0' } });
  } catch (err) {
    fail(`could not reach ${what} at ${url}: ${err.message}`);
  }
  if (res.status !== 200) fail(`${what} at ${url} answered HTTP ${res.status}, expected 200`);
  return res.text();
}

/** Pull <loc> values without a regex escape -- split is enough and clearer. */
function sitemapLocs(xml) {
  const out = [];
  for (const chunk of xml.split('<loc>').slice(1)) {
    const end = chunk.indexOf('</loc>');
    if (end !== -1) out.push(chunk.slice(0, end).trim());
  }
  return out;
}

async function main() {
  const key = findKey();
  console.log(`[indexnow] key            : ${key} (public/${key}.txt)`);

  // Gate 1 -- the key must already be LIVE, or the engine answers 403 for the
  // whole batch and the submission is wasted.
  const liveKey = await fetchText(`${SITE_URL}/${key}.txt`, 'the live key file');
  if (liveKey.trim() !== key) {
    fail(`live key file serves "${liveKey.trim().slice(0, 40)}", expected "${key}" -- deploy first`);
  }
  console.log('[indexnow] live key file  : serving the matching key');

  // Gate 2 -- submit exactly what the live sitemap advertises, so the URL set
  // can never drift from what the consoles were already given.
  const xml = await fetchText(`${SITE_URL}/sitemap.xml`, 'the live sitemap');
  const locs = sitemapLocs(xml);
  if (locs.length === 0) fail('live sitemap contained no <loc> entries');

  const foreign = locs.filter((u) => u !== SITE_URL && !u.startsWith(`${SITE_URL}/`));
  if (foreign.length > 0) {
    fail(`sitemap contains ${foreign.length} URL(s) outside ${SITE_URL}, e.g. ${foreign[0]}`);
  }
  console.log(`[indexnow] sitemap URLs   : ${locs.length}`);

  const batches = [];
  for (let i = 0; i < locs.length; i += MAX_URLS_PER_REQUEST) {
    batches.push(locs.slice(i, i + MAX_URLS_PER_REQUEST));
  }

  if (dryRun) {
    console.log(`[indexnow] DRY RUN -- would POST ${batches.length} batch(es) to ${ENDPOINT}`);
    console.log(`[indexnow] first URL      : ${locs[0]}`);
    console.log(`[indexnow] last URL       : ${locs[locs.length - 1]}`);
    return;
  }

  let submitted = 0;
  for (const [i, urlList] of batches.entries()) {
    const body = JSON.stringify({
      host: SITE_HOST,
      key,
      keyLocation: `${SITE_URL}/${key}.txt`,
      urlList,
    });
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body,
    });
    const text = await res.text().catch(() => '');
    const label = `batch ${i + 1}/${batches.length} (${urlList.length} URLs)`;
    if (!OK_STATUS.includes(res.status)) {
      // 400 bad format, 403 bad key, 422 host/URL mismatch, 429 rate-limited.
      fail(`${label} rejected with HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    submitted += urlList.length;
    console.log(
      `[indexnow] ${label}: HTTP ${res.status}${res.status === 202 ? ' (accepted, key validating)' : ''}`,
    );
  }

  console.log(
    `[indexnow] DONE -- ${submitted} URL(s) pushed to every participating engine via ${ENDPOINT}`,
  );
}

try {
  await main();
} catch (err) {
  console.error(
    err instanceof FailClosed
      ? `[indexnow] FAIL-CLOSED: ${err.message}`
      : `[indexnow] UNEXPECTED: ${err?.stack ?? err}`,
  );
  process.exitCode = 1;
}
