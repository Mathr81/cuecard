'use client';

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { toWordChips, type WordChip } from '@/lib/subtitles/tokenize';

/** Assez long pour ne pas se déclencher sur un tap, assez court pour rester fluide. */
const LONG_PRESS_MS = 350;
/** Au-delà, le doigt part en balayage ou en défilement : ce n'est plus un appui. */
const MOVE_TOLERANCE_PX = 12;

export interface CueSelection {
  from: number;
  to: number;
}

interface Props {
  text: string;
  selection: CueSelection | null;
  onLookup: (selection: CueSelection, term: string) => void;
  /** Prévient le lecteur qu'un geste de sélection est en cours, pour qu'il
   *  n'interprète pas le glissement comme un changement de réplique. */
  onSelectingChange?: (selecting: boolean) => void;
}

interface PositionedChip extends WordChip {
  flatIndex: number;
}

/**
 * Affiche une réplique mot par mot. Chaque mot est une cible d'au moins 44px,
 * généreusement espacée : on doit pouvoir viser du pouce, dans le noir, sans
 * zoomer. L'appui long suivi d'un glissement sélectionne une expression
 * entière — indispensable pour les phrasal verbs et les idiomes.
 */
export function CueText({ text, selection, onLookup, onSelectingChange }: Props) {
  const lines = useMemo(() => {
    const perLine = text.split('\n').map((line) => toWordChips(line));
    // Index de départ de chaque ligne, pour que la sélection puisse courir
    // d'une ligne à l'autre sans se soucier des retours à la ligne.
    const startIndices = perLine.reduce<number[]>(
      (acc, chips) => [...acc, acc[acc.length - 1] + chips.length],
      [0]
    );

    return perLine.map((chips, lineIndex) =>
      chips.map<PositionedChip>((chip, index) => ({
        ...chip,
        flatIndex: startIndices[lineIndex] + index,
      }))
    );
  }, [text]);

  const chips = useMemo(() => lines.flat(), [lines]);

  const [dragging, setDragging] = useState<CueSelection | null>(null);
  const pressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number; index: number } | null>(null);
  const movedTooFar = useRef(false);

  const cancelPressTimer = useCallback(() => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const emit = useCallback(
    (from: number, to: number) => {
      const term = chips
        .slice(from, to + 1)
        .map((chip) => chip.word)
        .join(' ')
        .trim();
      if (term.length > 0) onLookup({ from, to }, term);
    },
    [chips, onLookup]
  );

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pressOrigin.current = { x: event.clientX, y: event.clientY, index };
    movedTooFar.current = false;

    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      setDragging({ from: index, to: index });
      onSelectingChange?.(true);
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const origin = pressOrigin.current;
    if (!origin) return;

    if (!dragging) {
      const travelled = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
      if (travelled > MOVE_TOLERANCE_PX) {
        movedTooFar.current = true;
        cancelPressTimer();
      }
      return;
    }

    // Sur mobile, les événements restent envoyés au mot initialement touché :
    // c'est la position du doigt, pas la cible de l'événement, qui compte.
    const under = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-chip-index]');
    if (!under) return;

    const index = Number(under.getAttribute('data-chip-index'));
    if (Number.isNaN(index)) return;
    setDragging((current) => (current ? { ...current, to: index } : current));
  }

  function onPointerUp() {
    cancelPressTimer();
    const origin = pressOrigin.current;
    pressOrigin.current = null;

    if (dragging) {
      const { from, to } = dragging;
      setDragging(null);
      // Le lecteur reprend la main un tick plus tard : le touchend de fin de
      // geste ne doit pas être lu comme un balayage de navigation.
      window.setTimeout(() => onSelectingChange?.(false), 0);
      emit(Math.min(from, to), Math.max(from, to));
      return;
    }

    if (origin && !movedTooFar.current) emit(origin.index, origin.index);
  }

  function onPointerCancel() {
    cancelPressTimer();
    pressOrigin.current = null;
    if (dragging) {
      setDragging(null);
      window.setTimeout(() => onSelectingChange?.(false), 0);
    }
  }

  const active = dragging
    ? { from: Math.min(dragging.from, dragging.to), to: Math.max(dragging.from, dragging.to) }
    : selection;

  return (
    <div
      className="flex flex-col items-center gap-1"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {lines.map((lineChips, lineIndex) => (
        <p
          key={lineIndex}
          className="flex flex-wrap justify-center gap-x-1 gap-y-1 text-balance text-center"
        >
          {lineChips.map((chip) => {
            const selected =
              active !== null && chip.flatIndex >= active.from && chip.flatIndex <= active.to;

            return (
              <button
                key={chip.flatIndex}
                type="button"
                data-chip-index={chip.flatIndex}
                aria-label={chip.word}
                onPointerDown={(event) => onPointerDown(event, chip.flatIndex)}
                onContextMenu={(event) => event.preventDefault()}
                className={`inline-flex min-h-11 touch-pan-y items-center rounded-lg px-1 py-1 transition-colors ${
                  selected ? 'bg-accent/25 text-accent' : ''
                }`}
              >
                {chip.display}
              </button>
            );
          })}
        </p>
      ))}
    </div>
  );
}
