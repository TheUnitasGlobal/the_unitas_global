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
      className="flex h-[52px] w-[52px] items-center justify-center border border-accent/50 bg-void/60 text-accent transition-all hover:bg-accent hover:text-void"
    >
      {muted ? <VolumeX size={26} /> : <Volume2 size={26} />}
    </button>
  );
}
