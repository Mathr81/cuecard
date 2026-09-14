'use client';

import { useTranslations } from 'next-intl';
import { useRef, type TouchEvent } from 'react';
import { CueText, type CueSelection } from '@/components/CueText';
import { formatTimestamp } from '@/lib/time';
import type { Cue } from '@/lib/subtitles/types';

const CONTEXT = 3;
/** En dessous, c'est un tremblement de pouce, pas un balayage. */
const SWIPE_THRESHOLD_PX = 48;

interface Props {
  cues: Cue[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onStep: (delta: number) => void;
  selection: CueSelection | null;
  onLookup: (selection: CueSelection, term: string) => void;
}

export function CuePlayer({ cues, currentIndex, onSelect, onStep, selection, onLookup }: Props) {
  const t = useTranslations('reader');
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const selecting = useRef(false);

  const current = cues[currentIndex];
  const before = cues.slice(Math.max(0, currentIndex - CONTEXT), currentIndex);
  const after = cues.slice(currentIndex + 1, currentIndex + 1 + CONTEXT);

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    gesture.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = gesture.current;
    gesture.current = null;
    if (!start) return;

    // Une sélection d'expression se termine par un glissement horizontal :
    // ce n'est pas une demande de changer de réplique.
    if (selecting.current) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Un geste plus vertical qu'horizontal est un défilement, pas une navigation.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;

    onStep(dx < 0 ? 1 : -1);
  }

  if (!current) return null;

  return (
    // Centré quand ça tient, défilant quand la réplique est longue : rien ne
    // doit disparaître sous le bord de l'écran.
    <div
      className="no-text-select flex flex-1 flex-col overflow-y-auto overscroll-contain px-4"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="m-auto flex w-full flex-col py-4">
        <div className="flex flex-col items-center gap-1 text-center">
          {before.map((cue) => (
            <ContextCue
              key={cue.index}
              cue={cue}
              distance={currentIndex - cue.index}
              onSelect={onSelect}
            />
          ))}
        </div>

        {/* La réplique courante est la seule chose qui compte sur cet écran :
            elle est deux fois plus grosse que ses voisines, et l'accent lui est
            réservé pour marquer ce que le doigt désigne. L'horodatage redevient
            ce qu'il est, une donnée de service. */}
        <div className="my-7 flex flex-col items-center gap-4">
          <span className="font-mono text-xs tabular-nums text-dim">
            {formatTimestamp(current.startMs)}
          </span>
          <div className="text-[1.75rem] font-medium leading-[1.2] tracking-[-0.01em] text-ink sm:text-[2.125rem]">
            <CueText
              text={current.text}
              selection={selection}
              onLookup={onLookup}
              onSelectingChange={(value) => {
                selecting.current = value;
              }}
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          {after.map((cue) => (
            <ContextCue
              key={cue.index}
              cue={cue}
              distance={cue.index - currentIndex}
              onSelect={onSelect}
            />
          ))}
        </div>

        <p className="sr-only">{t('swipeHint')}</p>
      </div>
    </div>
  );
}

function ContextCue({
  cue,
  distance,
  onSelect,
}: {
  cue: Cue;
  distance: number;
  onSelect: (index: number) => void;
}) {
  // Le dégradé donne le sens de lecture sans ajouter de chrome. Il s'arrête à
  // `dim`, qui reste lisible : ces lignes se touchent pour sauter à une autre
  // réplique, et une cible qu'on ne lit pas ne se vise pas.
  const tone = distance === 1 ? 'text-ink-soft' : distance === 2 ? 'text-muted' : 'text-dim';

  return (
    <button
      type="button"
      onClick={() => onSelect(cue.index)}
      className={`press line-clamp-2 min-h-11 w-full max-w-md rounded-xl px-2 text-[0.9375rem] leading-snug ${tone}`}
    >
      {cue.text.replace(/\n/g, ' ')}
    </button>
  );
}
