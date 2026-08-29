'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { ChevronDown } from 'lucide-react';
import { useGatedSurface } from '@/components/ui/useGatedSurface';
import { FlagIcon } from './FlagIcon';

type Locale = (typeof routing.locales)[number];

/** Native (endonym) language names shown beside each flag. */
const NATIVE_NAME: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  et: 'Eesti',
  ja: '日本語',
  zh: '中文',
  es: 'Español',
};

/** 6-language flag/native-name dropdown, preserves the current page on switch. */
export function LanguageSwitcher() {
  const t = useTranslations('Nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { open, blocked, setOpen, toggle } = useGatedSurface('nav:language');

  const activeLocale = (routing.locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : ('en' as Locale);

  function selectLocale(nextLocale: string) {
    setOpen(false);
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={t('languageLabel')}
        aria-expanded={open}
        aria-disabled={blocked || undefined}
        className={`flex items-center gap-2 py-2 text-sm font-bold uppercase tracking-widest text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none ${
          blocked ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        <FlagIcon locale={activeLocale} size={24} />
        <span className="leading-none">{activeLocale}</span>
        <ChevronDown size={22} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <ul className="absolute right-0 z-50 mt-3 w-40 bg-quantum/95 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
            {routing.locales.map((loc) => (
              <li key={loc}>
                <button
                  type="button"
                  onClick={() => selectLocale(loc)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-accent/10 ${
                    loc === activeLocale ? 'font-bold text-accent' : 'font-normal text-gray-300'
                  }`}
                >
                  <FlagIcon locale={loc} size={20} />
                  <span className="leading-none">{NATIVE_NAME[loc]}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
