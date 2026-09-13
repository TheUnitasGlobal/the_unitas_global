/**
 * IndexNow -- push URL changes to search engines instead of waiting to be
 * crawled (founder directive 2026-09-13).
 *
 * Every console REV-22 onward verified participates EXCEPT Google:
 * Bing, Yandex, Seznam.cz and Naver all consume IndexNow, and a submission to
 * any one participating endpoint is shared with all of them -- so this module
 * targets the shared endpoint once rather than fanning out per engine.
 *
 * Ownership is proved by hosting a text file named `<key>.txt` at the site
 * root whose entire body is the key ("Option 1" in the spec, the recommended
 * one: a key file placed anywhere else restricts submissions to URLs beneath
 * that directory). `INDEXNOW_KEY_FILE` and the real file in `public/` are
 * pinned to each other by __tests__/seo/indexnow.test.ts -- if they ever
 * disagree the endpoint answers 403 and nothing else in the build notices.
 *
 * Deliberately pure: no I/O, no `next/*`. scripts/indexnow-submit.mjs does the
 * network work and is run AFTER a production deploy, never as part of the
 * build -- submitting URLs whose content has not shipped yet is worse than not
 * submitting at all.
 */

import { SITE_HOST, SITE_URL } from './routes';

/**
 * The site's IndexNow key. Spec: 8-128 characters from [a-z A-Z 0-9 -].
 * Public by design -- it is served at INDEXNOW_KEY_URL, so it is a proof of
 * control, not a secret.
 */
export const INDEXNOW_KEY = 'unitas999indexnowkey';

/** Key file name. MUST be `<key>.txt` for root-hosted ("Option 1") ownership. */
export const INDEXNOW_KEY_FILE = `${INDEXNOW_KEY}.txt`;

/** Absolute URL the search engine fetches to verify the key. */
export const INDEXNOW_KEY_URL = `${SITE_URL}/${INDEXNOW_KEY_FILE}`;

/**
 * The shared endpoint. Submitting here reaches every participating engine;
 * per-engine hosts (www.bing.com, yandex.com, search.seznam.cz,
 * searchadvisor.naver.com) exist but would be redundant fan-out.
 */
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** Spec ceiling for one POST. Our full sitemap is 340 URLs, well under it. */
export const INDEXNOW_MAX_URLS_PER_REQUEST = 10000;

/** Spec: a submission is accepted at 200, or 202 while the key is validated. */
export const INDEXNOW_OK_STATUS: readonly number[] = [200, 202];

/** Spec charset and length. */
export function isValidIndexNowKey(key: string): boolean {
  return /^[A-Za-z0-9-]{8,128}$/.test(key);
}

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

/**
 * Split URLs into those this key may submit and those it may not.
 *
 * The endpoint answers 422 for a list containing a URL outside the declared
 * host, rejecting the WHOLE batch -- so one stray URL would silently cost the
 * other 339. Filtering here makes that impossible rather than unlikely.
 */
export function partitionSubmittableUrls(urls: readonly string[]): {
  accepted: string[];
  rejected: string[];
} {
  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const url of urls) {
    if (url === SITE_URL || url.startsWith(`${SITE_URL}/`)) accepted.push(url);
    else rejected.push(url);
  }
  return { accepted, rejected };
}

/** Build one spec-shaped POST body. Throws rather than submit a bad batch. */
export function indexNowPayload(urls: readonly string[]): IndexNowPayload {
  if (!isValidIndexNowKey(INDEXNOW_KEY)) {
    throw new Error(`IndexNow key fails the spec charset/length rule: ${INDEXNOW_KEY}`);
  }
  const { accepted, rejected } = partitionSubmittableUrls(urls);
  if (rejected.length > 0) {
    throw new Error(
      `IndexNow batch contains ${rejected.length} URL(s) outside ${SITE_URL}: ${rejected[0]}`,
    );
  }
  if (accepted.length === 0) throw new Error('IndexNow batch is empty.');
  if (accepted.length > INDEXNOW_MAX_URLS_PER_REQUEST) {
    throw new Error(
      `IndexNow batch of ${accepted.length} exceeds the ${INDEXNOW_MAX_URLS_PER_REQUEST} URL ceiling.`,
    );
  }
  return {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_URL,
    urlList: accepted,
  };
}

/** Chunk a URL list into spec-legal batches. */
export function indexNowBatches(urls: readonly string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < urls.length; i += INDEXNOW_MAX_URLS_PER_REQUEST) {
    out.push(urls.slice(i, i + INDEXNOW_MAX_URLS_PER_REQUEST));
  }
  return out;
}
