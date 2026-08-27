'use client';

import { useTranslations } from 'next-intl';

// Order per request: About Us -> Legal -> Policies -> Customer Support.
const COLUMNS = [
  { headerKey: 'company', linkKeys: ['about', 'careers', 'press'] },
  { headerKey: 'legal', linkKeys: ['patentNotice', 'compliance', 'security'] },
  { headerKey: 'policies', linkKeys: ['privacyPolicy', 'cookiePolicy', 'termsOfService'] },
  { headerKey: 'customerService', linkKeys: ['helpCenter', 'contactUs', 'systemStatus'] },
] as const;

/**
 * Large static big-tech-style footer. All links are `#` placeholders --
 * there are no real destination pages for these yet, so they intentionally
 * don't pretend to navigate anywhere.
 */
export function Footer() {
  const t = useTranslations('Footer');

  return (
    <footer id="site-footer" className="scroll-mt-20 border-t border-white/10 bg-void/60">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.headerKey}>
              <h3 className="mb-5 text-[15px] font-bold uppercase tracking-[0.15em] text-accent">
                {t(col.headerKey)}
              </h3>
              <ul className="space-y-3.5">
                {col.linkKeys.map((linkKey) => (
                  <li key={linkKey}>
                    <a
                      href="#"
                      className="text-[18px] font-medium tracking-wide text-gray-300 transition-colors hover:text-white"
                    >
                      {t(linkKey)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-white/10 pt-10 text-center">
          <p className="font-serif text-[18px] font-semibold tracking-widest text-accent">UNITAS</p>
          <p className="mt-3 text-[15px] font-medium tracking-wide text-gray-400">
            © 2026 | THE UNITAS GLOBAL OÜ
          </p>
        </div>
      </div>
    </footer>
  );
}
