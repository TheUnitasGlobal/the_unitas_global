// Token-saving prompt packer (founder audit 2026-09-08). Pure, no I/O --
// unit-tested in __tests__/uai/tokenPack.test.ts.
//
// Pattern reference: the "tokenpack" family of tools (e.g. the npm package
// of the same name) packs a uniform array of JSON objects into a CSV-style
// table for LLM prompts instead of repeating every key name on every row --
// on a typical uniform array this cuts input tokens by roughly a third to
// half, because JSON's `{"code":...,"level":...,"message":...}` repeats
// three key names per row while CSV states them once, in the header. This
// module hand-rolls that exact pattern natively (no external dependency --
// the encoding is a few lines of straightforward code) so every place in
// this codebase that stuffs a structured array (Review Agent findings,
// ranking-detail facts, shortcut-cache rows, ...) into an LLM prompt can
// use it instead of `JSON.stringify`.

/** Heuristic: ~4 latin/CJK-mixed characters per token. Good enough for a
 *  before/after comparison -- callers needing exact counts should use the
 *  provider's own tokenizer, which isn't available client-side here. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function csvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Packs a uniform array of flat records into a compact CSV block, header
 * row first. Returns an empty string for an empty array (nothing to pack).
 * Only flat (string/number/boolean/null) field values are supported --
 * nested objects/arrays are JSON-stringified inline as a single field
 * rather than expanded into columns, since expanding would defeat the
 * point (variable columns per row breaks the fixed-header CSV shape).
 */
export function packRecordsForPrompt<T extends Record<string, unknown>>(records: T[]): string {
  if (records.length === 0) return '';
  const columns = Object.keys(records[0]);
  const header = columns.map(csvField).join(',');
  const rows = records.map((record) =>
    columns
      .map((col) => {
        const value = record[col];
        return csvField(
          value !== null && typeof value === 'object' ? JSON.stringify(value) : value,
        );
      })
      .join(','),
  );
  return [header, ...rows].join('\n');
}

export interface TokenSavings {
  jsonTokens: number;
  packedTokens: number;
  savedTokens: number;
  savedPercent: number;
}

/** Before/after comparison against the naive `JSON.stringify(records)` baseline. */
export function estimateTokenSavings<T extends Record<string, unknown>>(records: T[]): TokenSavings {
  const jsonTokens = estimateTokens(JSON.stringify(records));
  const packedTokens = estimateTokens(packRecordsForPrompt(records));
  const savedTokens = Math.max(0, jsonTokens - packedTokens);
  const savedPercent = jsonTokens === 0 ? 0 : Math.round((savedTokens / jsonTokens) * 100);
  return { jsonTokens, packedTokens, savedTokens, savedPercent };
}
