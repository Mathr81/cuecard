'use client';

import { useMemo } from 'react';
import { toWordChips } from '@/lib/subtitles/tokenize';

/**
 * Affiche une réplique mot par mot. Chaque mot est une cible d'au moins 44px
 * de haut, généreusement espacée de ses voisines : on doit pouvoir viser du
 * pouce, dans le noir, sans zoomer. Le tap est branché à l'étape suivante.
 */
export function CueText({ text }: { text: string }) {
  const lines = useMemo(() => text.split('\n').map((line) => toWordChips(line)), [text]);

  return (
    <div className="flex flex-col items-center gap-1">
      {lines.map((chips, lineIndex) => (
        <p
          key={lineIndex}
          className="flex flex-wrap justify-center gap-x-1 gap-y-1 text-balance text-center"
        >
          {chips.map((chip, chipIndex) => (
            <span
              key={`${chip.start}-${chipIndex}`}
              className="inline-flex min-h-11 items-center rounded-lg px-1 py-1"
            >
              {chip.display}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
