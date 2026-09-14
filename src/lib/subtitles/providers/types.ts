export type SubtitleFormat = 'srt' | 'vtt';

/** Les fichiers d'OpenSubtitles arrivent gzippés, ceux de shegu en clair. */
export type SubtitleEncoding = 'gzip' | 'plain';

export interface SubtitleCandidate {
  /** `${provider}:${identifiant brut}` — stable d'une recherche à l'autre. */
  id: string;
  provider: 'opensubtitles' | 'shegu';
  /** Nom de release, ou à défaut ce que la source sait donner. */
  releaseName: string;
  url: string;
  format: SubtitleFormat;
  encoding: SubtitleEncoding;
  /** Absent chez shegu : c'est le meilleur signal de qualité quand il existe. */
  downloadCount: number | null;
}

/** Ce qu'une source a besoin de savoir du titre pour chercher. */
export interface SubtitleLookup {
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  /** Requis par OpenSubtitles, inutile à shegu. */
  imdbId: string | null;
  season: number | null;
  episode: number | null;
}

export interface SubtitleProvider {
  id: 'opensubtitles' | 'shegu';
  search(lookup: SubtitleLookup, signal?: AbortSignal): Promise<SubtitleCandidate[]>;
}

/** Notre parseur ne lit que ces deux formats ; ASS et MicroDVD sont écartés. */
export const SUPPORTED_FORMATS: ReadonlySet<string> = new Set(['srt', 'vtt']);

export function isEpisode(
  lookup: SubtitleLookup
): lookup is SubtitleLookup & { season: number; episode: number } {
  return lookup.mediaType === 'tv' && lookup.season !== null && lookup.episode !== null;
}
