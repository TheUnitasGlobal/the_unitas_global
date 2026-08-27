'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import type { EcosystemTheme } from '@/lib/ecosystems';

/**
 * Content slot for the 9 ecosystems that share ModuleWorkspace's chrome and
 * coin-gating but don't have a bespoke engine yet (Echo and Oracle do --
 * see EchoEngine.tsx / OracleEngine.tsx). Access is already paid for by the
 * time a visitor sees this; it's an honest "not built yet", not a paywall.
 */
export function ModulePlaceholderEngine({ ecosystem }: { ecosystem: EcosystemTheme }) {
  const t = useTranslations('Placeholder');

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <motion.span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: ecosystem.color }}
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      />
      <p className="text-xs uppercase tracking-widest" style={{ color: ecosystem.color }}>
        {t('comingSoon')}
      </p>
    </div>
  );
}
