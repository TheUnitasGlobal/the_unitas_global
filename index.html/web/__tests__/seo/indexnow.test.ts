import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_FILE,
  INDEXNOW_KEY_URL,
  INDEXNOW_MAX_URLS_PER_REQUEST,
  INDEXNOW_OK_STATUS,
  indexNowBatches,
  indexNowPayload,
  isValidIndexNowKey,
  partitionSubmittableUrls,
} from '@/lib/seo/indexnow';
import { SITE_HOST, SITE_URL } from '@/lib/seo/routes';

// IndexNow's failure mode is the dangerous kind: a wrong key, a misnamed key
// file or a foreign URL all typecheck, build and deploy perfectly, and surface
// only as an HTTP 403/422 from a search engine nobody is watching. Everything
// that can be pinned statically is pinned here.

const publicDir = join(__dirname, '../..', 'public');

describe('indexnow key', () => {
  it('satisfies the spec charset and length', () => {
    expect(isValidIndexNowKey(INDEXNOW_KEY)).toBe(true);
    expect(INDEXNOW_KEY.length).toBeGreaterThanOrEqual(8);
    expect(INDEXNOW_KEY.length).toBeLessThanOrEqual(128);
  });

  it('rejects keys the endpoint would answer 403 for', () => {
    expect(isValidIndexNowKey('short')).toBe(false);
    expect(isValidIndexNowKey('has spaces in it')).toBe(false);
    expect(isValidIndexNowKey('has_underscore_x')).toBe(false);
    expect(isValidIndexNowKey('a'.repeat(129))).toBe(false);
    expect(isValidIndexNowKey('a'.repeat(128))).toBe(true);
  });

  it('is hosted at the root as <key>.txt, holding EXACTLY the key', () => {
    // Root hosting ("Option 1") is what lets one key cover every URL on the
    // host; a key file anywhere else restricts submissions to URLs beneath its
    // own directory.
    expect(INDEXNOW_KEY_FILE).toBe(`${INDEXNOW_KEY}.txt`);
    expect(INDEXNOW_KEY_URL).toBe(`${SITE_URL}/${INDEXNOW_KEY_FILE}`);
    const raw = readFileSync(join(publicDir, INDEXNOW_KEY_FILE), 'utf8');
    // Deliberately not `.trim()` -- a BOM or a trailing newline is exactly the
    // defect this guards, and PowerShell's `Set-Content -Encoding utf8` writes
    // a BOM.
    expect(raw).toBe(INDEXNOW_KEY);
    expect(raw.charCodeAt(0)).not.toBe(0xfeff);
  });

  it('leaves exactly one self-naming key file in public/', () => {
    // The submission script locates the key by this very property, so a second
    // one would make it ambiguous -- and a stale one would keep authorising
    // submissions after a key rotation.
    const selfNaming = readdirSync(publicDir).filter((name) => {
      if (!name.endsWith('.txt')) return false;
      const base = name.slice(0, -4);
      if (!isValidIndexNowKey(base)) return false;
      return readFileSync(join(publicDir, name), 'utf8').trim() === base;
    });
    expect(selfNaming).toEqual([INDEXNOW_KEY_FILE]);
  });
});

describe('indexnow payload', () => {
  it('is shaped exactly as the spec requires', () => {
    const payload = indexNowPayload([SITE_URL, `${SITE_URL}/ko`]);
    expect(payload).toEqual({
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_URL,
      urlList: [SITE_URL, `${SITE_URL}/ko`],
    });
  });

  it('refuses a batch containing a foreign URL rather than lose the batch', () => {
    // The endpoint answers 422 for the WHOLE list if one URL is off-host, so a
    // single stray entry would cost every other URL in the same POST.
    expect(() => indexNowPayload([`${SITE_URL}/ko`, 'https://example.com/x'])).toThrow(/outside/);
  });

  it('refuses an empty batch', () => {
    expect(() => indexNowPayload([])).toThrow(/empty/);
  });

  it('partitions on-host and off-host URLs without throwing', () => {
    const { accepted, rejected } = partitionSubmittableUrls([
      SITE_URL,
      `${SITE_URL}/ja/u-ai`,
      'https://theunitas.global/ko',
      'https://evil.example/ko',
    ]);
    expect(accepted).toEqual([SITE_URL, `${SITE_URL}/ja/u-ai`]);
    // The apex is a DIFFERENT host to IndexNow even though it 308s to www --
    // submitting it would 422 the batch.
    expect(rejected).toEqual(['https://theunitas.global/ko', 'https://evil.example/ko']);
  });

  it('chunks to the spec ceiling', () => {
    expect(INDEXNOW_MAX_URLS_PER_REQUEST).toBe(10000);
    const urls = Array.from({ length: 25000 }, (_, i) => `${SITE_URL}/p${i}`);
    const batches = indexNowBatches(urls);
    expect(batches.map((b) => b.length)).toEqual([10000, 10000, 5000]);
    expect(batches.flat()).toHaveLength(urls.length);
  });

  it('treats 200 and 202 as accepted', () => {
    // 202 means "received, key still validating" -- failing on it would make
    // the first submission after a key rotation look like an error.
    expect([...INDEXNOW_OK_STATUS].sort()).toEqual([200, 202]);
  });
});

describe('indexnow submission script', () => {
  const script = readFileSync(join(__dirname, '../..', 'scripts/indexnow-submit.mjs'), 'utf8');

  it('targets the same shared endpoint as the module', () => {
    // The script cannot import the TS module, so the constants are restated
    // there. Pin them together rather than let them drift apart silently.
    expect(INDEXNOW_ENDPOINT).toBe('https://api.indexnow.org/indexnow');
    expect(script).toContain(INDEXNOW_ENDPOINT);
    expect(script).toContain(SITE_URL);
  });

  it('proves the key is live before submitting anything', () => {
    // Submitting URLs whose content has not deployed yet makes engines crawl
    // and cache the OLD page -- worse than not submitting at all.
    expect(script).toContain('the live key file');
    expect(script).toContain('deploy first');
  });
});
