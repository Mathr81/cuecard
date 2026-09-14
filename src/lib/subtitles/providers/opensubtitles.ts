import { isEpisode, SUPPORTED_FORMATS } from './types';
import type { SubtitleCandidate, SubtitleFormat, SubtitleLookup, SubtitleProvider } from './types';

/** L'API historique, sans clé ni quota journalier, contrairement à l'API v1. */
const BASE_URL = 'https://rest.opensubtitles.org/search';

/** OpenSubtitles exige un User-Agent identifiant l'application. */
const USER_AGENT = 'cuecard v1.0';
const REQUEST_TIMEOUT_MS = 15_000;

interface RawEntry {
  IDSubtitleFile?: unknown;
  IDSubtitle?: unknown;
  SubFileName?: unknown;
  MovieReleaseName?: unknown;
  SubFormat?: unknown;
  SubDownloadsCnt?: unknown;
  SubDownloadLink?: unknown;
}

/**
 * L'API plafonne à cent résultats toutes langues confondues : sur un film
 * populaire, l'anglais n'y figure tout simplement pas. Le segment
 * `sublanguageid-eng` déplace le filtre côté serveur et règle le problème —
 * The Matrix passe de zéro résultat anglais à soixante-treize.
 */
export function buildSearchUrl(lookup: SubtitleLookup): string | null {
  const imdb = normalizeImdbId(lookup.imdbId);
  if (!imdb) return null;

  if (isEpisode(lookup)) {
    return `${BASE_URL}/episode-${lookup.episode}/imdbid-${imdb}/season-${lookup.season}/sublanguageid-eng`;
  }
  if (lookup.mediaType === 'tv') return null;

  return `${BASE_URL}/imdbid-${imdb}/sublanguageid-eng`;
}

/** L'API attend l'identifiant nu : « tt0133093 » devient « 0133093 ». */
export function normalizeImdbId(value: string | null | undefined): string | null {
  const digits = /^(?:tt)?(\d{6,10})$/i.exec(String(value ?? '').trim())?.[1];
  return digits ?? null;
}

export function mapEntries(payload: unknown): SubtitleCandidate[] {
  if (!Array.isArray(payload)) return [];

  const candidates: SubtitleCandidate[] = [];
  for (const raw of payload as RawEntry[]) {
    const url = typeof raw?.SubDownloadLink === 'string' ? raw.SubDownloadLink : '';
    if (!url) continue;

    const rawFormat = typeof raw?.SubFormat === 'string' ? raw.SubFormat.toLowerCase() : '';
    // Un format déclaré mais non géré est écarté ; un format absent est un
    // .srt dans l'immense majorité des cas.
    if (rawFormat && !SUPPORTED_FORMATS.has(rawFormat)) continue;

    const id =
      firstString(raw?.IDSubtitleFile, raw?.IDSubtitle) ?? url.slice(url.lastIndexOf('/') + 1);
    const releaseName = firstString(raw?.SubFileName, raw?.MovieReleaseName) ?? id;
    const downloadCount = Number(raw?.SubDownloadsCnt);

    candidates.push({
      id: `opensubtitles:${id}`,
      provider: 'opensubtitles',
      releaseName,
      url,
      format: (SUPPORTED_FORMATS.has(rawFormat) ? rawFormat : 'srt') as SubtitleFormat,
      encoding: 'gzip',
      downloadCount: Number.isFinite(downloadCount) ? downloadCount : null,
    });
  }
  return candidates;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

export const openSubtitlesProvider: SubtitleProvider = {
  id: 'opensubtitles',
  async search(lookup, signal) {
    const url = buildSearchUrl(lookup);
    if (!url) return [];

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
        : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`opensubtitles responded ${response.status}`);

    return mapEntries(await response.json());
  },
};
