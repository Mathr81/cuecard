import type { TitleRef } from './types';

/**
 * Clé stable d'un titre : un film est identifié par son id TMDB, un épisode
 * par le trio série / saison / épisode. C'est la clé du cache de sous-titres,
 * de l'historique et du décalage mémorisé.
 */
export function titleKey(
  ref: Pick<TitleRef, 'mediaType' | 'tmdbId' | 'season' | 'episode'>
): string {
  if (ref.mediaType === 'tv' && ref.season !== null && ref.episode !== null) {
    return `tv:${ref.tmdbId}:${ref.season}:${ref.episode}`;
  }
  return `${ref.mediaType}:${ref.tmdbId}`;
}

/** Libellé court d'un épisode : "S01E04". Vide pour un film. */
export function episodeLabel(ref: Pick<TitleRef, 'season' | 'episode'>): string {
  if (ref.season === null || ref.episode === null) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `S${pad(ref.season)}E${pad(ref.episode)}`;
}
