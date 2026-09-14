import { isEpisode, SUPPORTED_FORMATS } from './types';
import type { SubtitleCandidate, SubtitleFormat, SubtitleLookup, SubtitleProvider } from './types';

/** Agrégateur qui interroge directement par identifiant TMDB : pas besoin de
 *  passer par l'IMDb, et il répond là où OpenSubtitles ne répond pas. */
const BASE_URL = 'https://subtitles.shegu.st';
const REQUEST_TIMEOUT_MS = 15_000;

interface RawEntry {
  id?: unknown;
  language?: unknown;
  url?: unknown;
  type?: unknown;
  display?: unknown;
  source?: unknown;
}

export function buildSearchUrl(lookup: SubtitleLookup): string | null {
  const tmdb = encodeURIComponent(String(lookup.tmdbId));

  if (isEpisode(lookup)) {
    return `${BASE_URL}/subtitles?type=tv&tmdb=${tmdb}&season=${lookup.season}&episode=${lookup.episode}`;
  }
  if (lookup.mediaType === 'tv') return null;

  return `${BASE_URL}/subtitles?type=movie&tmdb=${tmdb}`;
}

export function mapEntries(payload: unknown): SubtitleCandidate[] {
  const entries = (payload as { subtitles?: unknown } | null)?.subtitles;
  if (!Array.isArray(entries)) return [];

  const candidates: SubtitleCandidate[] = [];
  for (const raw of entries as RawEntry[]) {
    const url = typeof raw?.url === 'string' ? raw.url : '';
    const language = typeof raw?.language === 'string' ? raw.language.toLowerCase() : '';
    const format = typeof raw?.type === 'string' ? raw.type.toLowerCase() : '';

    // shegu renvoie toutes les langues d'un coup : on ne garde que l'anglais.
    if (!url || language !== 'en') continue;
    if (!SUPPORTED_FORMATS.has(format)) continue;

    const id = typeof raw?.id === 'string' && raw.id ? raw.id : url;
    const display = typeof raw?.display === 'string' && raw.display ? raw.display : 'shegu';
    const source = typeof raw?.source === 'string' && raw.source ? raw.source : null;

    candidates.push({
      id: `shegu:${id}`,
      provider: 'shegu',
      // « English (orpheus) » n'est pas un nom de release, mais c'est tout ce
      // que shegu donne : autant afficher aussi d'où il tient le fichier.
      releaseName: source ? `${display} · ${source}` : display,
      url,
      format: format as SubtitleFormat,
      encoding: 'plain',
      downloadCount: null,
    });
  }
  return candidates;
}

export const sheguProvider: SubtitleProvider = {
  id: 'shegu',
  async search(lookup, signal) {
    const url = buildSearchUrl(lookup);
    if (!url) return [];

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
        : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`shegu responded ${response.status}`);

    return mapEntries(await response.json());
  },
};
