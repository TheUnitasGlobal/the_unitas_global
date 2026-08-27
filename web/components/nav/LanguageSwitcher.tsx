'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { ChevronDown } from 'lucide-react';
import { storeLocale } from '@/lib/preferences';
import { FlagIcon } from './FlagIcon';

type Locale = (typeof routing.locales)[number];

const LANGUAGE_META: Record<Locale, { native: string }> = {
  en: { native: 'English' },
  ko: { native: '한국어' },
  et: { native: 'Eesti' },
  ja: { native: '日本語' },
  zh: { native: '中文' },
  es: { native: 'Español' },
};

const MENU_WIDTH = 184;

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * 6-language flag + native-name dropdown, preserves the current page on
 * switch and remembers the pick (see lib/preferences -> app/page.tsx).
 *
 * The open menu is rendered through a portal into `document.body` with fixed
 * positioning: it must escape both the nav's horizontal swipe container
 * (`.nav-scroll`, `overflow` clips it on tablet/mobile) and `.dashboard-zoom`
 * (`zoom: 0.75`), so on every viewport the flags and native text show at
 * full, unclipped size.
 */
export function LanguageSwitcher() {
  const t = useTranslations('Nav');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });

  useEffect(() => setMounted(true), []);

  const current = LANGUAGE_META[locale] ?? LANGUAGE_META.en;

  const positionMenu = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    setMenuPos({ top: rect.bottom + 10, left });
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function selectLocale(nextLocale: Locale) {
    setOpen(false);
    storeLocale(nextLocale);
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t('languageLabel')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 py-2 text-sm font-bold uppercase tracking-widest text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none"
      >
        <FlagIcon locale={locale} className="h-[18px] w-[27px] shrink-0 rounded-[3px] ring-1 ring-white/15" />
        <span className="leading-none normal-case tracking-normal">{current.native}</span>
        <ChevronDown
          size={20}
          className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
        />
      </button>

      {open && mounted
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[190]"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <ul
                role="listbox"
                aria-label={t('languageLabel')}
                className="fixed z-[200] overflow-hidden rounded-lg border border-accent/25 bg-quantum/95 py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md"
                style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
              >
                {routing.locales.map((loc) => (
                  <li key={loc}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={loc === locale}
                      onClick={() => selectLocale(loc)}
                      className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] leading-none transition-colors hover:bg-accent/10 ${
                        loc === locale ? 'font-bold text-accent' : 'font-normal text-gray-200'
                      }`}
                    >
                      <FlagIcon
                        locale={loc}
                        className="h-4 w-6 shrink-0 rounded-[2px] ring-1 ring-white/15"
                      />
                      <span>{LANGUAGE_META[loc].native}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
