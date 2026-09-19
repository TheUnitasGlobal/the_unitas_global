import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COUNTRY_CURRENCY,
  SLOT_SCOPES,
  buildSlotSections,
  fxCountryQuote,
  newsItemScope,
  slotScopes,
  withSlotSections,
} from '../../lib/live/slotSections';
import { DISCOVERY_ROTATION, FX_BASE, findDiscoverySlot, type SlotCard, type SlotKey } from '../../lib/live/discoverySlots';
import { localeCountry } from '../../lib/live/slotContext';
import { routing } from '../../i18n/routing';

// REV-21 SPEC.md §2.1 (§2A.3) -- "글로벌 1순위 · 선택 국가 2순위" as data:
// which scopes a slot speaks in, and how one loaded card splits into the
// sections the carousel and its deep modal render with `data-scope`.

const card = (partial: Partial<SlotCard>): SlotCard => ({
  facts: [],
  items: [],
  updatedAt: 0,
  cursor: null,
  ...partial,
});

describe('slot scope declaration', () => {
  it('declares a scope order for every slot in the rotation', () => {
    for (const key of DISCOVERY_ROTATION) {
      const scopes = slotScopes(key);
      expect(scopes.length).toBeGreaterThan(0);
      expect(scopes.length).toBeLessThanOrEqual(2);
      // Global always leads when a slot speaks in both.
      if (scopes.length === 2) expect(scopes[0]).toBe('global');
    }
  });

  it('keeps the SPEC 2A.3 global-only and country-only lists (REV-42 D-1: +cosmos global, +gastronomy both, -air)', () => {
    for (const key of ['cosmos', 'quake', 'crypto', 'devPulse', 'paper', 'library', 'art'] as SlotKey[]) {
      expect(SLOT_SCOPES[key], key).toEqual(['global']);
    }
    for (const key of ['weather', 'nation'] as SlotKey[]) {
      expect(SLOT_SCOPES[key], key).toEqual(['country']);
    }
    // fx is worldwide AND carries the visitor's own currency second.
    expect(SLOT_SCOPES.fx).toEqual(['global', 'country']);
    // REV-42 D-1: gastronomy is the second two-scope slot -- the world's
    // trends first, the visitor's own tradition + hidden local eats second.
    expect(SLOT_SCOPES.gastronomy).toEqual(['global', 'country']);
    // REV-23 M3.1: the nine news themes that used to race a worldwide leg
    // against the visitor's own are off this rail entirely; REV-42 D-1
    // retired `air` the same way.
    for (const key of ['game', 'sports', 'movie', 'food', 'air'] as string[]) {
      expect(SLOT_SCOPES[key], key).toBeUndefined();
    }
  });
});

describe('buildSlotSections', () => {
  it('returns no section at all for an empty card', () => {
    expect(buildSlotSections('quake', card({}))).toEqual([]);
  });

  it('gives a one-scope slot a single section carrying everything', () => {
    const sections = buildSlotSections('quake', card({ facts: [{ labelKey: 'a', value: '1' }], items: [{ id: 'i', title: 't' }] }));
    expect(sections).toHaveLength(1);
    expect(sections[0].scope).toBe('global');
    expect(sections[0].items).toHaveLength(1);
  });

  it('declares weather / nation as country sections', () => {
    const sections = buildSlotSections('weather', card({ facts: [{ labelKey: 'a', value: '1' }] }));
    expect(sections).toHaveLength(1);
    expect(sections[0].scope).toBe('country');
  });

  it('splits a two-scope card global first, country second', () => {
    const sections = buildSlotSections(
      'fx',
      card({
        items: [
          { id: 'c', title: 'own', scope: 'country' },
          { id: 'g', title: 'world', scope: 'global' },
        ],
      }),
    );
    expect(sections.map((s) => s.scope)).toEqual(['global', 'country']);
    expect(sections[0].items.map((i) => i.id)).toEqual(['g']);
    expect(sections[1].items.map((i) => i.id)).toEqual(['c']);
  });

  it('drops an empty country section rather than painting an empty header', () => {
    const sections = buildSlotSections('fx', card({ items: [{ id: 'g', title: 'world', scope: 'global' }] }));
    expect(sections).toHaveLength(1);
    expect(sections[0].scope).toBe('global');
  });

  it('treats unmarked facts and items as the first scope of the slot', () => {
    const sections = buildSlotSections('fx', card({ facts: [{ labelKey: 'a', value: '1' }], items: [{ id: 'g', title: 'x' }] }));
    expect(sections).toHaveLength(1);
    expect(sections[0].scope).toBe('global');
    expect(sections[0].facts).toHaveLength(1);
  });

  it('withSlotSections attaches them without disturbing the card', () => {
    const next = withSlotSections('quake', card({ items: [{ id: 'i', title: 't' }], updatedAt: 42 }));
    expect(next.updatedAt).toBe(42);
    expect(next.sections?.[0].scope).toBe('global');
  });
});

describe('newsItemScope', () => {
  it('reads the own-language leg of the visitor as the country section', () => {
    expect(newsItemScope('ko', 'ko')).toBe('country');
    expect(newsItemScope('en', 'ko')).toBe('global');
    expect(newsItemScope(undefined, 'ko')).toBe('global');
  });

  it('declares one global section for en, whose two legs are indistinguishable', () => {
    expect(newsItemScope('en', 'en')).toBe('global');
  });
});

describe('fxCountryQuote', () => {
  it('emphasises the currency of the visitor when the ECB publishes it', () => {
    expect(fxCountryQuote('KR', FX_BASE)).toBe('KRW');
    expect(fxCountryQuote('kr', FX_BASE)).toBe('KRW');
    expect(fxCountryQuote('EE', FX_BASE)).toBe('EUR');
    expect(fxCountryQuote('PH', FX_BASE)).toBe('PHP');
  });

  it('adds nothing when the currency IS the base or has no ECB rate', () => {
    expect(fxCountryQuote('US', FX_BASE)).toBeNull();
    expect(fxCountryQuote('KH', FX_BASE)).toBeNull(); // KHR
    expect(fxCountryQuote('VN', FX_BASE)).toBeNull(); // VND
    expect(fxCountryQuote('RU', FX_BASE)).toBeNull(); // RUB
    expect(fxCountryQuote(undefined, FX_BASE)).toBeNull();
    expect(fxCountryQuote('ZZ', FX_BASE)).toBeNull();
  });

  it('knows the currency of every country the 20 locales resolve to', () => {
    for (const locale of routing.locales) {
      expect(COUNTRY_CURRENCY[localeCountry(locale)]).toBeTruthy();
    }
  });
});

describe('registry wrapper', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** REV-41 D-3: the compass asks for the majors, the DXY basket and the
   *  home currency in ONE window request; answer whatever it asked for and
   *  let CoinGecko fail so only the Frankfurter leg is under test here. */
  const RATES: Record<string, number> = { EUR: 0.9, JPY: 147.1, GBP: 0.78, CNY: 7.12, CAD: 1.35, SEK: 10.4, CHF: 0.88, KRW: 1390.5 };
  const fxFetch = () =>
    vi.fn(async (input: string) => {
      if (!input.includes('api.frankfurter.dev')) return new Response('', { status: 429 });
      const quotes = (new URL(input).searchParams.get('quotes') ?? '').split(',');
      const rows = quotes.filter((q) => q in RATES).map((q) => ({ date: '2026-09-12', base: 'USD', quote: q, rate: RATES[q] }));
      return new Response(JSON.stringify(rows), { status: 200 });
    });

  it('attaches sections to a loaded card, fx putting the own currency second as a ROW (REV-41 D-3)', async () => {
    vi.stubGlobal('fetch', fxFetch());
    const loaded = await findDiscoverySlot('fx')!.load({ locale: 'ko', country: 'KR' });
    expect(loaded.sections?.map((s) => s.scope)).toEqual(['global', 'country']);
    const own = loaded.sections?.[1].items ?? [];
    expect(own).toHaveLength(1);
    expect(own[0].title).toContain('USD/KRW');
    // ...and the global section never repeats it.
    expect((loaded.sections?.[0].items ?? []).some((i) => i.title.includes('KRW'))).toBe(false);
    // The big figure is the widget's job now: no fact is emphasised.
    expect(loaded.facts.some((f) => f.emphasis)).toBe(false);
    expect(loaded.widget?.kind).toBe('fxCompass');
  });

  it('leaves the fx card of an en visitor global-only (the EUR fallback hero is not "their" currency)', async () => {
    vi.stubGlobal('fetch', fxFetch());
    const loaded = await findDiscoverySlot('fx')!.load({ locale: 'en', country: 'US' });
    expect(loaded.sections?.map((s) => s.scope)).toEqual(['global']);
    expect(loaded.items[0].title).toContain('USD/EUR');
  });
});
