'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { FlagIcon } from '@/components/nav/FlagIcon';

type Locale = (typeof routing.locales)[number];

/** Native (endonym) language names -- single source of truth for every surface. */
export const LOCALE_NATIVE_NAME: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  et: 'Eesti',
  ja: '日本語',
  zh: '中文',
  es: 'Español',
};

/** Shared with <ComingSoonCinema/> so the manual pick isn't re-overridden by auto-detect. */
export const LOCALE_PREF_KEY = 'unitas_locale_pref';

interface Props {
  /** Visual treatment: `glass` = frosted pill (dark overlays), `bare` = nav-bar inline. */
  variant?: 'glass' | 'bare';
  /** Dropdown alignment. */
  align?: 'left' | 'right';
  className?: string;
  /** Optional callback after a locale is chosen (e.g. close a parent menu). */
  onSelect?: (locale: string) => void;
}

/**
 * Flag + native-language selector shown on EVERY entry surface -- the audio
 * gate, the 30s cinematic, and (via NavBar's LanguageSwitcher twin) the main
 * site + all sub-pages -- so a visitor never hits a screen they can't read
 * (owner instruction 2026-08-29). Preserves the current route on switch and
 * persists the choice to `LOCALE_PREF_KEY`.
 */
export function GlobalLanguagePicker({
  variant = 'glass',
  align = 'right',
  className = '',
  onSelect,
}: Props) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = (routing.locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : ('en' as Locale);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function selectLocale(next: string) {
    setOpen(false);
    try {
      window.localStorage.setItem(LOCALE_PREF_KEY, next);
    } catch {
      /* storage blocked -- the route switch below still applies for this session */
    }
    onSelect?.(next);
    if (next !== locale) router.replace(pathname, { locale: next });
  }

  const triggerClass =
    variant === 'glass'
      ? 'cs-glass flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium uppercase tracking-[0.15em] text-white/80 transition-colors hover:text-white'
      : 'flex items-center gap-2 py-2 text-sm font-bold uppercase tracking-widest text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Language"
        className={triggerClass}
      >
        {variant === 'glass' && <Globe size={14} aria-hidden="true" />}
        <FlagIcon locale={active} size={variant === 'glass' ? 16 : 20} />
        <span className="leading-none">{LOCALE_NATIVE_NAME[active]}</span>
      </button>

      {open && (
        <ul
          className={`absolute z-50 mt-2 w-44 overflow-hidden rounded-2xl py-1 text-left ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${
            variant === 'glass'
              ? 'cs-glass'
              : 'bg-quantum/95 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-md'
          }`}
        >
          {routing.locales.map((loc) => (
            <li key={loc}>
              <button
                type="button"
                onClick={() => selectLocale(loc)}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-xs tracking-wide transition-colors hover:bg-white/10 ${
                  loc === active ? 'font-bold text-accent' : 'text-white/70'
                }`}
              >
                <FlagIcon locale={loc} size={18} />
                <span className="leading-none">{LOCALE_NATIVE_NAME[loc]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
