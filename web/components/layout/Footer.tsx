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
    <footer className="border-t border-white/10 bg-void/60">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.headerKey}>
              <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-accent">
                {t(col.headerKey)}
              </h3>
              <ul className="space-y-2.5">
                {col.linkKeys.map((linkKey) => (
                  <li key={linkKey}>
                    <a href="#" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
                      {t(linkKey)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/10 pt-8 text-center">
          <p className="font-serif text-xs tracking-widest text-accent">THE UNITAS GLOBAL OÜ</p>
          <p className="mt-2 text-[10px] text-gray-600">© 2026 THE UNITAS GLOBAL OÜ.</p>
        </div>
      </div>
    </footer>
  );
}
