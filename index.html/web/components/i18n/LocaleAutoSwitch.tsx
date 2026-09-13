'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useWallet } from '@/components/wallet/WalletProvider';
import { isAppLocale } from '@/lib/countryLocale';
import { readLocalePreference } from '@/lib/i18n/localePreference';
import { writeLocaleSwitchMarker } from '@/lib/i18n/localeSwitchMarker';
import { beginNavigation } from '@/lib/history/navigationLock';

/** REV-21 §4A (F6): module-scoped so a remount (locale switch, curtain
 *  hand-off) never re-applies the same account's preference a second time
 *  and bounces the visitor back. */
let appliedForUserIdGlobal: string | null = null;

/**
 * On login, applies the user's saved language preference (`profiles.locale`)
 * so it stays consistent across devices/browsers -- the Accept-Language
 * guess in app/page.tsx only ever fires once, on the bare "/" entry, and has
 * no idea who is signing in. A manual switch (LanguageSwitcher) writes back
 * to `profiles.locale` immediately, so that choice always wins on the next
 * login instead of being re-overridden here.
 *
 * Renders nothing. Mounted once inside <WalletProvider> in
 * app/[locale]/layout.tsx so it can read the live session/profile.
 */
export function LocaleAutoSwitch() {
  const { session, profile } = useWallet();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  // Guards against re-firing on every profile refetch during the same login
  // (e.g. after phone/email verification) -- only acts once per signed-in user.
  const appliedForUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!session) {
      appliedForUserId.current = null;
      appliedForUserIdGlobal = null;
      return;
    }
    if (!profile || appliedForUserId.current === session.user.id || appliedForUserIdGlobal === session.user.id) return;
    appliedForUserId.current = session.user.id;
    appliedForUserIdGlobal = session.user.id;

    // F6: a device whose persisted manual choice IS the current language
    // stays put -- the account's older preference must not re-bounce it.
    if (readLocalePreference() === locale) return;

    if (isAppLocale(profile.locale) && profile.locale !== locale) {
      writeLocaleSwitchMarker({ scrollY: window.scrollY });
      beginNavigation();
      router.replace(pathname, { locale: profile.locale, scroll: false });
    }
  }, [session, profile, locale, pathname, router]);

  return null;
}
