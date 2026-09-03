'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { ChevronDown } from 'lucide-react';
import { useGatedSurface } from '@/components/ui/useGatedSurface';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { LOCALE_NATIVE_NAME } from '@/components/i18n/GlobalLanguagePicker';
import { FlagIcon } from './FlagIcon';

type Locale = (typeof routing.locales)[number];

/** Matches the dropdown's `w-40` Tailwind class (10rem @ 16px root = 160px). */
const MENU_WIDTH = 160;

/**
 * Native (endonym) language names shown beside each flag -- imported from the
 * single source of truth in <GlobalLanguagePicker/> so the nav-bar twin and the
 * entry-gate / cinematic picker can never drift apart (owner instruction
 * 2026-08-30: endonyms restored and locked consistently across every surface).
 */
const NATIVE_NAME = LOCALE_NATIVE_NAME;

/** 20-locale flag/native-name dropdown, preserves the current page on switch. */
export function LanguageSwitcher() {
  const t = useTranslations('Nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { open, blocked, setOpen, toggle } = useGatedSurface('nav:language');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const activeLocale = (routing.locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : ('en' as Locale);

  // The trigger lives inside NavBar's horizontally-swiping `.nav-scroll` strip.
  // That strip sets `overflow-x: auto`, which per the CSS overflow spec forces
  // the browser to compute its `overflow-y` as `auto` too (never left at
  // `visible` when the other axis isn't) -- so a `position: absolute` dropdown
  // anchored inside it renders but is clipped the instant it extends past the
  // strip's own ~44px row height, invisible on mobile. Positioning the menu
  // `fixed` from the trigger's live bounding rect escapes that clip entirely.
  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(
        Math.max(8, rect.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - 8,
      );
      setMenuPos({ top: rect.bottom + 12, left });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    // A swipe of the nav strip moves the trigger out from under the menu --
    // close rather than fight the scroll with continuous repositioning.
    const scrollParent = buttonRef.current?.closest('.nav-scroll');
    const closeOnScroll = () => setOpen(false);
    scrollParent?.addEventListener('scroll', closeOnScroll, { passive: true });
    return () => {
      window.removeEventListener('resize', updatePosition);
      scrollParent?.removeEventListener('scroll', closeOnScroll);
    };
  }, [open, setOpen]);

  function selectLocale(nextLocale: string) {
    setOpen(false);
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
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
        {/* flag + native language name (현지어) -- consistent with the entry
            gate / cinematic GlobalLanguagePicker across every surface. */}
        <span className="leading-none normal-case">{NATIVE_NAME[activeLocale]}</span>
        <ChevronDown size={22} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && menuPos && (
        <ModalPortal>
          {/* z-[130]/z-[140]: the DialogTower overlay sits at z-[120], and the
              menu drops down INTO the tower's area -- anything lower left the
              20 flags/names buried behind the tower's backdrop. */}
          <div className="fixed inset-0 z-[130]" onClick={() => setOpen(false)} aria-hidden="true" />
          <ul
            style={{ top: menuPos.top, left: menuPos.left, maxHeight: 'min(60vh, 420px)' }}
            className="fixed z-[140] w-40 overflow-y-auto overscroll-contain bg-quantum/95 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-md"
          >
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
                  <span className="whitespace-nowrap leading-none">{NATIVE_NAME[loc]}</span>
                </button>
              </li>
            ))}
          </ul>
        </ModalPortal>
      )}
    </div>
  );
}
