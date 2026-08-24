'use client';

import { useTranslations } from 'next-intl';
import { Volume2, VolumeX } from 'lucide-react';
import { useSpatialAudio } from './SpatialAudioProvider';

export function SoundToggle() {
  const t = useTranslations('Nav');
  const { muted, toggleMuted } = useSpatialAudio();

  return (
    <button
      type="button"
      onClick={toggleMuted}
      aria-label={muted ? t('soundOff') : t('soundOn')}
      aria-pressed={!muted}
      className="flex h-11 w-11 items-center justify-center text-accent/60 transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none"
    >
      {muted ? <VolumeX size={26} /> : <Volume2 size={26} />}
    </button>
  );
}
