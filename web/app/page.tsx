import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { routing } from '@/i18n/routing';

/**
 * Bare "/" entry point. This used to be handled by next-intl's edge
 * middleware (Accept-Language sniffing + redirect); that responsibility now
 * lives here instead, in the Node.js runtime, so a parsing edge case only
 * ever affects this one route instead of every request behind edge
 * middleware (see middleware.ts, which is now a trivial pass-through and
 * never touches locale logic at all).
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
