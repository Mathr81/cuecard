'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Lire la prononciation sans quitter la feuille. L'élément audio n'est créé
 * qu'au premier appui : inutile de préparer un son qu'on n'écoutera peut-être
 * jamais. Le parent remonte le composant via `key` quand l'URL change.
 */
export function AudioButton({ url, accent }: { url: string; accent: string | null }) {
  const t = useTranslations('definition');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => () => audioRef.current?.pause(), []);

  function play() {
    if (!audioRef.current) {
      const audio = new Audio(url);
      audio.addEventListener('ended', () => setPlaying(false));
      audio.addEventListener('error', () => {
        setPlaying(false);
        setBroken(true);
      });
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    audio.currentTime = 0;
    setPlaying(true);
    audio.play().catch(() => {
      setPlaying(false);
      setBroken(true);
    });
  }

  if (broken) return null;

  return (
    <button
      type="button"
      aria-label={t('playAudio')}
      onClick={play}
      className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface-high px-3 text-sm font-medium text-ink"
    >
      <span aria-hidden className={playing ? 'text-accent' : 'text-muted'}>
        ▶
      </span>
      {accent ? <span className="font-mono text-xs uppercase text-muted">{accent}</span> : null}
    </button>
  );
}
