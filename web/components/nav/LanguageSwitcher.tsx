'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { ChevronDown } from 'lucide-react';

const LANGUAGE_META: Record<(typeof routing.locales)[number], { flag: string; native: string }> = {
  en: { flag: '🇺🇸', native: 'English' },
  ko: { flag: '🇰🇷', native: '한국어' },
  et: { flag: '🇪🇪', native: 'Eesti' },
  ja: { flag: '🇯🇵', native: '日本語' },
  zh: { flag: '🇨🇳', native: '中文' },
  es: { flag: '🇪🇸', native: 'Español' },
};

/** 6-language flag/native-name dropdown, preserves the current page on switch. */
export function LanguageSwitcher() {
  const t = useTranslations('Nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const current = LANGUAGE_META[locale as (typeof routing.locales)[number]] ?? LANGUAGE_META.en;

  function selectLocale(nextLocale: string) {
    setOpen(false);
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t('languageLabel')}
        aria-expanded={open}
        className="flex items-center gap-2 border border-accent/40 bg-void px-3 py-2 text-sm font-bold uppercase tracking-widest text-accent transition-colors hover:border-accent"
      >
        <span className="text-base leading-none" aria-hidden="true">
          {current.flag}
        </span>
        <span className="leading-none">{locale}</span>
        <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <ul className="absolute right-0 z-50 mt-1 w-40 border border-accent/30 bg-quantum shadow-[0_0_30px_rgba(0,243,255,0.08)]">
            {routing.locales.map((loc) => (
              <li key={loc}>
                <button
                  type="button"
                  onClick={() => selectLocale(loc)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-accent/10 ${
                    loc === locale ? 'font-bold text-accent' : 'font-normal text-gray-300'
                  }`}
                >
                  <span className="text-sm leading-none" aria-hidden="true">
                    {LANGUAGE_META[loc].flag}
                  </span>
                  <span className="leading-none">{LANGUAGE_META[loc].native}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
