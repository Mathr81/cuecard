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

/** Places garanties à chaque source qui a répondu. Sans elles, shegu ne
 *  compte pas ses téléchargements, passe donc systématiquement derrière
 *  OpenSubtitles, et n'apparaît jamais — alors que c'est précisément l'autre
 *  source qu'on veut pouvoir essayer quand la première cale mal. */
const RESERVED_PER_PROVIDER = 2;

export interface SubtitleSearchResult {
  candidates: SubtitleCandidate[];
  /** Sources qui n'ont pas répondu, pour le dire au lieu de faire comme si. */
  failedProviders: string[];
}

/**
 * Deux sources valent mieux qu'une : OpenSubtitles a les noms de release et
 * les compteurs de téléchargement, shegu répond là où l'autre ne trouve rien.
 * L'échec de l'une ne doit jamais effacer les résultats de l'autre.
 */
export async function searchSubtitles(
  lookup: SubtitleLookup,
  providers: readonly SubtitleProvider[] = SUBTITLE_PROVIDERS,
  signal?: AbortSignal
): Promise<SubtitleSearchResult> {
  const settled = await Promise.allSettled(
    providers.map((provider) => provider.search(lookup, signal))
  );

  const candidates: SubtitleCandidate[] = [];
  const failedProviders: string[] = [];
  const reasons: string[] = [];

  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled' && Array.isArray(outcome.value)) {
      candidates.push(...outcome.value);
      return;
    }
    const reason = outcome.status === 'rejected' ? outcome.reason : 'non-array result';
    failedProviders.push(providers[index].id);
    reasons.push(`${providers[index].id}: ${reason instanceof Error ? reason.message : reason}`);
  });

  // Toutes les sources muettes : c'est une panne, pas un titre sans sous-titres.
  if (candidates.length === 0 && reasons.length === providers.length && providers.length > 0) {
    throw new ExternalApiError('upstream', reasons.join(' | '));
  }

  return { candidates: select(rank(dedupe(candidates))), failedProviders };
}

/**
 * Garde une place à chaque source avant de remplir au classement, puis rétablit
 * l'ordre général : les mieux notés d'abord, l'autre source visible au bout.
 */
function select(ranked: readonly SubtitleCandidate[]): SubtitleCandidate[] {
  const position = new Map(ranked.map((candidate, index) => [candidate.id, index]));
  const chosen = new Map<string, SubtitleCandidate>();
  const takenPerProvider = new Map<string, number>();

  for (const candidate of ranked) {
    if (chosen.size >= MAX_CANDIDATES) break;
    const taken = takenPerProvider.get(candidate.provider) ?? 0;
    if (taken >= RESERVED_PER_PROVIDER) continue;
    chosen.set(candidate.id, candidate);
    takenPerProvider.set(candidate.provider, taken + 1);
  }

  for (const candidate of ranked) {
    if (chosen.size >= MAX_CANDIDATES) break;
    if (!chosen.has(candidate.id)) chosen.set(candidate.id, candidate);
  }

  return [...chosen.values()].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
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
