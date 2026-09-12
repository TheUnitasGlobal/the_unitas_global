/**
 * REV-21 §2.1 -- pure assembly of the `SlotContext` every discovery slot
 * (and the Explore Deeper themes) loads with: the locale AND the visitor's
 * selected country, so a card can render its global section first and its
 * country section second, and so the card cache is keyed on both (L1-04: a
 * cache keyed on the slot alone kept serving the previous language for up
 * to 15 minutes after a switch).
 *
 * No React here -- the hook lives in useSlotContext.ts so this file stays
 * importable from node-environment unit tests.
 */
import { GOOGLE_NEWS_EDITION } from '@/lib/live/axisNews';
import { DEFAULT_PLACE } from '@/lib/live/useLiveWeather';
import { resolveCountry } from '@/lib/live/contextPriority';
import type { SlotContext } from '@/lib/live/discoverySlots';

/** Country the locale alone implies (its default place, else its Google
 *  News edition). Pure. */
export function localeCountry(locale: string): string {
  return DEFAULT_PLACE[locale]?.countryCode ?? GOOGLE_NEWS_EDITION[locale]?.gl ?? 'US';
}

/** Pure assembly -- the hook feeds it live inputs. */
export function buildSlotContext(locale: string, profileCountry: string | null | undefined, cachedPlaceCountry: string | null | undefined): SlotContext {
  return {
    locale,
    country: resolveCountry({ profileCountry, cachedPlaceCountry, localeCountry: localeCountry(locale) }),
  };
}

/** Stable cache key for a slot card under a context. */
export function slotCacheKey(ctx: Pick<SlotContext, 'locale' | 'country'>, key: string): string {
  return `${ctx.locale}:${ctx.country ?? localeCountry(ctx.locale)}:${key}`;
}
