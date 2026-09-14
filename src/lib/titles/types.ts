export type MediaType = 'movie' | 'tv';

/** Ce qui identifie ce que je regarde, film ou épisode précis. */
export interface TitleRef {
  mediaType: MediaType;
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
  season: number | null;
  episode: number | null;
  episodeName: string | null;
  /** Genres TMDB : « Crime, Drama » ne se traduit pas comme « Comedy ». */
  genres: string[];
  /** Identifiant IMDb : la seule clé que comprend l'API OpenSubtitles. */
  imdbId: string | null;
}

export interface RecentTitle extends TitleRef {
  lastOpenedAt: number;
}

export interface TmdbSearchResult {
  mediaType: MediaType;
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
  overview: string;
  popularity: number;
}

export interface TmdbSeason {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airYear: number | null;
}

export interface TmdbEpisode {
  episodeNumber: number;
  name: string;
  airDate: string | null;
}
