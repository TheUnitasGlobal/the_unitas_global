'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useWallet } from '@/components/wallet/WalletProvider';
import { isAppLocale } from '@/lib/countryLocale';

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
      return;
    }
    if (!profile || appliedForUserId.current === session.user.id) return;
    appliedForUserId.current = session.user.id;

    if (isAppLocale(profile.locale) && profile.locale !== locale) {
      router.replace(pathname, { locale: profile.locale });
    }
  }, [session, profile, locale, pathname, router]);

  return null;
}
