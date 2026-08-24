import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { routing } from '@/i18n/routing';

/**
 * Bare "/" entry point. Locale resolution used to run in edge middleware
 * (Accept-Language sniffing + redirect); there is no middleware.ts at all
 * anymore, so this Node.js-runtime route is the only place that logic runs --
 * a parsing edge case here can't take down every other request the way an
 * edge middleware crash would.
 */
export default function RootPage() {
  redirect(`/${resolvePreferredLocale()}`);
}

function resolvePreferredLocale(): string {
  try {
    const acceptLanguage = headers().get('accept-language') ?? '';
    for (const tag of acceptLanguage.split(',')) {
      const code = tag.trim().split(';')[0]?.split('-')[0]?.toLowerCase();
      if (code && (routing.locales as readonly string[]).includes(code)) {
        return code;
      }
    }
  } catch {
    // Fall through to the default locale below.
  }
  return routing.defaultLocale;
}
