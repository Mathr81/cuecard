import type { Cue } from '@/lib/subtitles/types';

/** Quatre répliques de chaque côté : assez pour la scène, assez court pour
 *  rester bon marché. */
export const CONTEXT_RADIUS = 4;

export interface Scene {
  lines: string[];
  /** Position de la réplique courante dans `lines`. */
  targetIndex: number;
}

/** La scène autour d'une réplique, rognée aux bords du fichier. */
export function sceneAround(cues: Cue[], index: number, radius = CONTEXT_RADIUS): Scene {
  const from = Math.max(0, index - radius);
  const to = Math.min(cues.length, index + radius + 1);

  return {
    lines: cues.slice(from, to).map((cue) => cue.text.replace(/\n/g, ' ')),
    targetIndex: index - from,
  };
}
