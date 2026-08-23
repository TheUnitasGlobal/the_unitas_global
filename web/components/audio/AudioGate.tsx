'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { useSpatialAudio } from './SpatialAudioProvider';

const STORAGE_KEY = 'unitas_audio_gate_seen';

/**
 * Browsers block AudioContext output until a real user gesture, and this
 * provider previously relied on an incidental first click/keypress anywhere
 * on the page -- which resumed the context but left it muted, so the
 * ambient BGM and every SFX were silently dead. This is the explicit,
 * unmissable fix: a full-screen gate the user must click (or explicitly
 * skip) before touching the rest of the site. Clicking "Initiate" resumes
 * the AudioContext AND unmutes in the same gesture (unlockAndUnmute).
 * Shown once per browser session.
 */
export function AudioGate() {
  const t = useTranslations('AudioGate');
  const { unlocked, unlockAndUnmute } = useSpatialAudio();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  }

  function handleInitiate() {
    unlockAndUnmute();
    dismiss();
  }

  const open = !dismissed && !unlocked;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-void/95 px-6 text-center backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="audio-gate-title"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 22 }}
          >
            <Volume2 size={40} className="mx-auto mb-6 text-accent" aria-hidden="true" />
            <h2 id="audio-gate-title" className="mb-3 font-serif text-xl font-bold text-white md:text-2xl">
              {t('title')}
            </h2>
            <p className="mx-auto mb-8 max-w-sm text-xs text-gray-400 md:text-sm">{t('subtitle')}</p>

            <button
              type="button"
              onClick={handleInitiate}
              className="w-full max-w-xs border-2 border-accent bg-accent/10 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] text-accent shadow-[0_0_50px_rgba(212,175,55,0.25)] transition-all hover:bg-accent hover:text-void"
            >
              {t('title')}
            </button>

            <div>
              <button
                type="button"
                onClick={dismiss}
                className="mt-6 text-[10px] uppercase tracking-widest text-gray-600 underline-offset-4 hover:text-gray-400 hover:underline"
              >
                {t('skip')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
