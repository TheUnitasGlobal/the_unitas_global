import { describe, expect, it } from 'vitest';
import {
  countryToLocale,
  detectBrowserCountryLocale,
  isAppLocale,
  parseLanguageTag,
} from '../../lib/countryLocale';

describe('isAppLocale', () => {
  it('accepts a supported locale code', () => {
    expect(isAppLocale('ko')).toBe(true);
  });

  it('rejects an unsupported code or null/undefined', () => {
    expect(isAppLocale('xx')).toBe(false);
    expect(isAppLocale(null)).toBe(false);
    expect(isAppLocale(undefined)).toBe(false);
  });
});

describe('countryToLocale', () => {
  it('maps a known country to its app locale', () => {
    expect(countryToLocale('KR')).toBe('ko');
    expect(countryToLocale('jp')).toBe('ja'); // case-insensitive
    expect(countryToLocale('BR')).toBe('pt');
  });

  it('falls back to null for an unmapped or missing country', () => {
    expect(countryToLocale('US')).toBeNull();
    expect(countryToLocale(null)).toBeNull();
    expect(countryToLocale('')).toBeNull();
  });
});

describe('parseLanguageTag', () => {
  it('splits language and region from a BCP-47 tag', () => {
    expect(parseLanguageTag('ko-KR')).toEqual({ language: 'ko', region: 'KR' });
  });

  it('handles a bare language tag with no region', () => {
    expect(parseLanguageTag('en')).toEqual({ language: 'en', region: null });
  });
});

describe('detectBrowserCountryLocale', () => {
  it('prefers the country-mapped locale over the bare language subtag', () => {
    // "en-JP" -- browser language is English but region is Japan: country
    // wins over the bare (unmapped-relevant) "en" language subtag.
    expect(detectBrowserCountryLocale('en-JP')).toEqual({ country: 'JP', locale: 'ja' });
  });

  it('falls back to the language subtag when the region is unmapped', () => {
    expect(detectBrowserCountryLocale('ko-US')).toEqual({ country: 'US', locale: 'ko' });
  });

  it('returns nulls when no language tag is available', () => {
    expect(detectBrowserCountryLocale(null)).toEqual({ country: null, locale: null });
  });
});
