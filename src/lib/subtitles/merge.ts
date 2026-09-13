import type { Cue } from './types';

/** Au-delà, ce n'est plus une réplique simultanée mais un sous-titre décoratif
 *  affiché en continu (crédits, panneau) : on ne fusionne pas. */
const MAX_MERGED_SPAN_MS = 15_000;

/** Deux répliques identiques séparées par plus que ça sont deux vraies
 *  répliques ("Yeah." deux fois dans la scène), pas un doublon d'encodage. */
const MAX_DUPLICATE_GAP_MS = 500;

/**
 * Deux répliques qui se chevauchent étaient affichées en même temps à l'écran
 * (deux personnages, ou une traduction de panneau). Les garder séparées casse
 * la navigation : on passerait deux fois sur le même moment du film.
 */
export function mergeOverlappingCues(cues: Cue[]): Cue[] {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const merged: Cue[] = [];

  for (const cue of sorted) {
    const previous = merged[merged.length - 1];

    if (previous !== undefined) {
      const overlaps = cue.startMs < previous.endMs;
      const isDuplicate =
        previous.text === cue.text && cue.startMs - previous.endMs <= MAX_DUPLICATE_GAP_MS;
      const spanStaysReasonable =
        Math.max(previous.endMs, cue.endMs) - previous.startMs <= MAX_MERGED_SPAN_MS;

      if ((overlaps || isDuplicate) && spanStaysReasonable) {
        previous.endMs = Math.max(previous.endMs, cue.endMs);
        if (previous.text !== cue.text && !previous.text.includes(cue.text)) {
          previous.text = `${previous.text}\n${cue.text}`;
        }
        continue;
      }
    }

    merged.push({ ...cue });
  }

  return merged.map((cue, index) => ({ ...cue, index }));
}
