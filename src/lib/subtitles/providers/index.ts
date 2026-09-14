import { gunzipSync } from 'node:zlib';
import { ExternalApiError } from '@/lib/external/errors';
import { openSubtitlesProvider } from './opensubtitles';
import { sheguProvider } from './shegu';
import type { SubtitleCandidate, SubtitleLookup, SubtitleProvider } from './types';

export * from './types';
export { openSubtitlesProvider } from './opensubtitles';
export { sheguProvider } from './shegu';

export const SUBTITLE_PROVIDERS: readonly SubtitleProvider[] = [
  openSubtitlesProvider,
  sheguProvider,
];

/** Assez pour avoir le choix quand le premier fichier est mal calé, assez peu
 *  pour rester lisible d'un coup d'œil sur un téléphone. */
const MAX_CANDIDATES = 6;

/**
 * Deux sources valent mieux qu'une : OpenSubtitles a les noms de release et
 * les compteurs de téléchargement, shegu répond là où l'autre ne trouve rien.
 * L'échec de l'une ne doit jamais effacer les résultats de l'autre.
 */
export async function searchSubtitles(
  lookup: SubtitleLookup,
  providers: readonly SubtitleProvider[] = SUBTITLE_PROVIDERS,
  signal?: AbortSignal
): Promise<SubtitleCandidate[]> {
  const settled = await Promise.allSettled(
    providers.map((provider) => provider.search(lookup, signal))
  );

  const candidates: SubtitleCandidate[] = [];
  const failures: string[] = [];

  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled' && Array.isArray(outcome.value)) {
      candidates.push(...outcome.value);
      return;
    }
    const reason = outcome.status === 'rejected' ? outcome.reason : 'non-array result';
    failures.push(`${providers[index].id}: ${reason instanceof Error ? reason.message : reason}`);
  });

  // Toutes les sources muettes : c'est une panne, pas un titre sans sous-titres.
  if (candidates.length === 0 && failures.length === providers.length && providers.length > 0) {
    throw new ExternalApiError('upstream', failures.join(' | '));
  }

  return rank(dedupe(candidates)).slice(0, MAX_CANDIDATES);
}

function dedupe(candidates: readonly SubtitleCandidate[]): SubtitleCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

/** Le nombre de téléchargements d'abord ; sans lui, on passe derrière. */
function rank(candidates: SubtitleCandidate[]): SubtitleCandidate[] {
  return [...candidates].sort((a, b) => {
    const countDelta = (b.downloadCount ?? -1) - (a.downloadCount ?? -1);
    if (countDelta !== 0) return countDelta;
    return a.releaseName.localeCompare(b.releaseName);
  });
}

const GZIP_MAGIC = [0x1f, 0x8b];

/**
 * Les liens d'OpenSubtitles servent un `.gz` avec un type MIME générique :
 * `fetch` ne le décompresse pas tout seul. On se fie aux octets plutôt qu'aux
 * en-têtes, ce qui marche aussi le jour où une source change d'avis.
 */
export function decompressIfGzipped(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 2 || bytes[0] !== GZIP_MAGIC[0] || bytes[1] !== GZIP_MAGIC[1]) return buffer;

  const inflated = gunzipSync(bytes);
  return inflated.buffer.slice(
    inflated.byteOffset,
    inflated.byteOffset + inflated.byteLength
  ) as ArrayBuffer;
}

const DOWNLOAD_TIMEOUT_MS = 25_000;

export async function downloadCandidate(candidate: SubtitleCandidate): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(candidate.url, {
      headers: { 'User-Agent': 'cuecard v1.0' },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new ExternalApiError('network', cause instanceof Error ? cause.message : undefined);
  }

  if (!response.ok) throw new ExternalApiError('upstream', `download ${response.status}`);
  return decompressIfGzipped(await response.arrayBuffer());
}
