import 'server-only';
import { ExternalApiError } from '@/lib/external/errors';
import { fetchJson } from '@/lib/external/fetchJson';
import type { MediaType, TmdbEpisode, TmdbSearchResult, TmdbSeason } from '@/lib/titles/types';

const BASE = 'https://api.themoviedb.org/3';

interface TmdbMultiItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  popularity?: number;
}

function credentials(): { headers: Record<string, string>; keyQuery: string } {
  const key = process.env.TMDB_API_KEY?.trim();
  if (!key) throw new ExternalApiError('missing_key', 'TMDB_API_KEY');

  // TMDB distribue deux sortes de clés : la v3 passe en paramètre d'URL, le
  // jeton de lecture v4 en en-tête. Accepter les deux évite un échec opaque.
  return key.startsWith('eyJ')
    ? { headers: { Authorization: `Bearer ${key}` }, keyQuery: '' }
    : { headers: {}, keyQuery: `api_key=${encodeURIComponent(key)}` };
}

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const { keyQuery } = credentials();
  const search = new URLSearchParams(params).toString();
  return `${BASE}${path}?${[keyQuery, search].filter(Boolean).join('&')}`;
}

function yearOf(date: string | undefined): number | null {
  const year = Number(date?.slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : null;
}

export async function searchMulti(query: string, language: string): Promise<TmdbSearchResult[]> {
  const { headers } = credentials();
  const data = await fetchJson<{ results?: TmdbMultiItem[] }>(
    buildUrl('/search/multi', { query, language, include_adult: 'false' }),
    { headers }
  );

  return (data.results ?? [])
    .filter(
      (item): item is TmdbMultiItem & { media_type: MediaType } =>
        item.media_type === 'movie' || item.media_type === 'tv'
    )
    .map((item) => ({
      mediaType: item.media_type,
      tmdbId: item.id,
      name: item.title ?? item.name ?? '',
      year: yearOf(item.release_date ?? item.first_air_date),
      posterPath: item.poster_path ?? null,
      overview: item.overview ?? '',
      popularity: item.popularity ?? 0,
    }))
    .filter((item) => item.name.length > 0)
    .slice(0, 20);
}

export interface TmdbShow {
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
  seasons: TmdbSeason[];
}

export async function getShow(tmdbId: number, language: string): Promise<TmdbShow> {
  const { headers } = credentials();
  const data = await fetchJson<{
    id: number;
    name?: string;
    first_air_date?: string;
    poster_path?: string | null;
    seasons?: Array<{
      season_number: number;
      name?: string;
      episode_count?: number;
      air_date?: string;
    }>;
  }>(buildUrl(`/tv/${tmdbId}`, { language }), { headers });

  return {
    tmdbId: data.id,
    name: data.name ?? '',
    year: yearOf(data.first_air_date),
    posterPath: data.poster_path ?? null,
    seasons: (data.seasons ?? [])
      // La saison 0 regroupe les hors-série : jamais ce que je cherche.
      .filter((season) => season.season_number > 0 && (season.episode_count ?? 0) > 0)
      .map((season) => ({
        seasonNumber: season.season_number,
        name: season.name ?? `Season ${season.season_number}`,
        episodeCount: season.episode_count ?? 0,
        airYear: yearOf(season.air_date),
      })),
  };
}

export async function getMovie(
  tmdbId: number,
  language: string
): Promise<{ tmdbId: number; name: string; year: number | null; posterPath: string | null }> {
  const { headers } = credentials();
  const data = await fetchJson<{
    id: number;
    title?: string;
    release_date?: string;
    poster_path?: string | null;
  }>(buildUrl(`/movie/${tmdbId}`, { language }), { headers });

  return {
    tmdbId: data.id,
    name: data.title ?? '',
    year: yearOf(data.release_date),
    posterPath: data.poster_path ?? null,
  };
}

export async function getSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number,
  language: string
): Promise<TmdbEpisode[]> {
  const { headers } = credentials();
  const data = await fetchJson<{
    episodes?: Array<{ episode_number: number; name?: string; air_date?: string | null }>;
  }>(buildUrl(`/tv/${tmdbId}/season/${seasonNumber}`, { language }), { headers });

  return (data.episodes ?? []).map((episode) => ({
    episodeNumber: episode.episode_number,
    name: episode.name ?? '',
    airDate: episode.air_date ?? null,
  }));
}
