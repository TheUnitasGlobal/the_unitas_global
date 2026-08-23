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
      className="flex h-9 w-9 items-center justify-center border border-accent/40 text-accent transition-colors hover:border-accent"
    >
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  );
}
