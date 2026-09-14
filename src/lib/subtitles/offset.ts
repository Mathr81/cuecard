import type { Cue } from './types';

/** Au-delà, ce n'est plus un décalage de sous-titres mais une faute de frappe
 *  dans le temps saisi : refuser vaut mieux que mémoriser une absurdité. */
export const MAX_OFFSET_MS = 30 * 60 * 1000;

/** Les décalages réels vont de quelques secondes à une minute : au-delà on
 *  prévient sans bloquer, des cas tordus existent (montage différent). */
export const UNUSUAL_OFFSET_MS = 5 * 60 * 1000;

/**
 * Le temps affiché par Netflix moins le temps de la réplique dans le fichier.
 * Positif quand le fichier est en avance sur le lecteur — le cas courant :
 * le lecteur compte le récap et les logos que le fichier ignore.
 */
export function computeOffset(playerMs: number, cueStartMs: number): number {
  return playerMs - cueStartMs;
}

/** Le temps que je lis sur mon lecteur, ramené au temps du fichier. */
export function toCueTime(playerMs: number, offsetMs: number): number {
  return playerMs - offsetMs;
}

/**
 * La réplique affichée à cet instant, ou la plus proche s'il n'y en a aucune
 * (silence, changement de scène) : renvoyer « rien » enverrait dans le mur.
 */
export function findCueAtTime(cues: Cue[], targetMs: number): number {
  if (cues.length === 0) return -1;

  let low = 0;
  let high = cues.length - 1;
  let candidate = 0;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const cue = cues[middle];

    if (targetMs < cue.startMs) {
      high = middle - 1;
    } else if (targetMs > cue.endMs) {
      candidate = middle;
      low = middle + 1;
    } else {
      return middle;
    }
  }

  // Entre deux répliques : on prend la plus proche des deux bords.
  const next = Math.min(candidate + 1, cues.length - 1);
  const distanceToCandidate = Math.abs(targetMs - cues[candidate].endMs);
  const distanceToNext = Math.abs(cues[next].startMs - targetMs);
  return distanceToNext < distanceToCandidate ? next : candidate;
}
