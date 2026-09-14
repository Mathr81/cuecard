import 'server-only';
import { ExternalApiError } from '@/lib/external/errors';
import { fetchJson } from '@/lib/external/fetchJson';
import type { SubtitleCandidate, TitleRef } from '@/lib/titles/types';

const BASE = 'https://api.opensubtitles.com/api/v1';

/** OpenSubtitles exige un User-Agent identifiant l'application, et coupe sans
 *  prévenir au-delà de cinq requêtes par seconde. */
const USER_AGENT = 'cuecard v1.0';
const MIN_INTERVAL_MS = 250;

/** Trois candidats suffisent : au-delà je ne saurais pas choisir. */
const CANDIDATE_COUNT = 3;

let nextSlot = 0;

/** File d'attente minimale : les appels s'espacent au lieu de se faire jeter. */
async function throttle(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

function headers(): Record<string, string> {
  const key = process.env.OPENSUBTITLES_API_KEY?.trim();
  if (!key) throw new ExternalApiError('missing_key', 'OPENSUBTITLES_API_KEY');

  return {
    'Api-Key': key,
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

interface RawSubtitle {
  attributes?: {
    release?: string;
    download_count?: number;
    ratings?: number;
    from_trusted?: boolean;
    hearing_impaired?: boolean;
    upload_date?: string;
    files?: Array<{ file_id?: number; file_name?: string }>;
  };
}

export async function searchSubtitles(ref: TitleRef): Promise<SubtitleCandidate[]> {
  const params = new URLSearchParams({ languages: 'en' });

  if (ref.mediaType === 'tv' && ref.season !== null && ref.episode !== null) {
    // Pour un épisode, l'id de la série plus saison et épisode donne des
    // résultats bien plus fiables que l'id TMDB de l'épisode lui-même.
    params.set('parent_tmdb_id', String(ref.tmdbId));
    params.set('season_number', String(ref.season));
    params.set('episode_number', String(ref.episode));
  } else {
    params.set('tmdb_id', String(ref.tmdbId));
  }

  await throttle();
  const data = await fetchJson<{ data?: RawSubtitle[] }>(`${BASE}/subtitles?${params}`, {
    headers: headers(),
  });

  return (data.data ?? [])
    .flatMap((item) => {
      const attributes = item.attributes;
      const file = attributes?.files?.[0];
      if (!attributes || !file?.file_id) return [];

      return [
        {
          fileId: file.file_id,
          releaseName: attributes.release?.trim() || file.file_name?.trim() || '—',
          downloadCount: attributes.download_count ?? 0,
          ratings: attributes.ratings ?? null,
          fromTrusted: attributes.from_trusted ?? false,
          hearingImpaired: attributes.hearing_impaired ?? false,
          uploadDate: attributes.upload_date ?? null,
        } satisfies SubtitleCandidate,
      ];
    })
    .sort((a, b) => b.downloadCount - a.downloadCount)
    .slice(0, CANDIDATE_COUNT);
}

export interface DownloadTicket {
  link: string;
  /** Téléchargements restants sur le quota du jour, quand l'API le dit. */
  remaining: number | null;
  resetTime: string | null;
}

export async function requestDownload(fileId: number): Promise<DownloadTicket> {
  await throttle();
  const data = await fetchJson<{
    link?: string;
    remaining?: number;
    reset_time?: string;
    message?: string;
  }>(`${BASE}/download`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ file_id: fileId }),
  });

  if (!data.link) {
    // L'API répond 200 avec un message quand le quota journalier est épuisé.
    throw new ExternalApiError('quota_exhausted', data.message);
  }

  return {
    link: data.link,
    remaining: typeof data.remaining === 'number' ? data.remaining : null,
    resetTime: data.reset_time ?? null,
  };
}

export async function downloadSubtitleFile(link: string): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(link, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (cause) {
    throw new ExternalApiError('network', cause instanceof Error ? cause.message : undefined);
  }

  if (!response.ok) throw new ExternalApiError('upstream', `download ${response.status}`);
  return response.arrayBuffer();
}
