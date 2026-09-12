'use client';

/**
 * REV-21 §2.1 -- the live `SlotContext` for the discovery carousel and the
 * Explore Deeper block: locale from next-intl, the selected country from
 * the signed-in profile → the weather panel's last searched city → the
 * locale's default place (lib/live/contextPriority.ts resolveCountry).
 */
import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useWallet } from '@/components/wallet/WalletProvider';
import { readWeatherCache } from '@/lib/live/useLiveWeather';
import { buildSlotContext } from '@/lib/live/slotContext';
import type { SlotContext } from '@/lib/live/discoverySlots';

export function useSlotContext(): SlotContext {
  const locale = useLocale();
  const { profile } = useWallet();
  const profileCountry = profile?.country ?? null;
  return useMemo(() => {
    // Read the weather cache at assembly time (not at render) -- it lives in
    // localStorage and must never be touched during SSR.
    const cachedPlaceCountry = typeof window === 'undefined' ? null : readWeatherCache()?.place.countryCode ?? null;
    return buildSlotContext(locale, profileCountry, cachedPlaceCountry);
  }, [locale, profileCountry]);
}
